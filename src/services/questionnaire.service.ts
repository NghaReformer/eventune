/**
 * Questionnaire Service
 * Fetches questionnaire fields from database for the public order flow
 *
 * Separated from admin.service.ts to avoid import issues and keep
 * public-facing code lightweight.
 */

import { getServerClient } from '../lib/supabase/server';

// Cache TTL in milliseconds
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Cache storage
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

/**
 * Get from cache or fetch fresh data
 */
function getCached<T>(key: string): T | null {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (entry && entry.expiresAt > Date.now()) {
    return entry.data;
  }
  return null;
}

/**
 * Set cache entry
 */
function setCache<T>(key: string, data: T): void {
  cache.set(key, {
    data,
    expiresAt: Date.now() + CACHE_TTL,
  });
}

/**
 * Questionnaire field type definition
 */
export interface QuestionnaireField {
  id: string;
  occasion_slug: string | null;
  field_name: string;
  field_type: 'text' | 'textarea' | 'select' | 'radio' | 'checkbox' | 'number' | 'date' | 'email' | 'tel';
  field_label: string;
  placeholder: string | null;
  help_text: string | null;
  required: boolean;
  display_order: number;
  options: { value: string; label: string }[] | null;
  field_group: 'recipient' | 'relationship' | 'memories' | 'song_preferences' | 'additional';
  validation_rules: {
    min_length?: number;
    max_length?: number;
    pattern?: string;
    min?: number;
    max?: number;
  } | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Get questionnaire fields for a specific occasion
 * Includes both common fields (null occasion_slug) and occasion-specific fields
 *
 * @param occasionSlug - The occasion slug to fetch fields for
 * @returns Array of questionnaire fields sorted by group and display order
 */
export async function getQuestionnaireFields(occasionSlug: string): Promise<QuestionnaireField[]> {
  // Check cache first
  const cacheKey = `questionnaire:${occasionSlug}`;
  const cached = getCached<QuestionnaireField[]>(cacheKey);
  if (cached) {
    console.log('[Questionnaire] Using cached fields for:', occasionSlug);
    return cached;
  }

  try {
    const supabase = getServerClient();

    // Fetch both common fields (NULL occasion_slug) and occasion-specific fields
    const { data, error } = await supabase
      .from('config_questionnaire_fields')
      .select('*')
      .eq('is_active', true)
      .or(`occasion_slug.is.null,occasion_slug.eq.${occasionSlug}`)
      .order('field_group', { ascending: true })
      .order('display_order', { ascending: true });

    if (error) {
      console.error('[Questionnaire] Database error:', error);
      return [];
    }

    if (!data || data.length === 0) {
      console.log('[Questionnaire] No fields found for:', occasionSlug);
      return [];
    }

    // Parse JSONB fields that might come as strings
    const fields = data.map((field) => ({
      ...field,
      options: typeof field.options === 'string' ? JSON.parse(field.options) : field.options,
      validation_rules: typeof field.validation_rules === 'string' ? JSON.parse(field.validation_rules) : field.validation_rules,
    })) as QuestionnaireField[];

    console.log(`[Questionnaire] Fetched ${fields.length} fields for:`, occasionSlug);

    // Cache the result
    setCache(cacheKey, fields);

    return fields;
  } catch (error) {
    console.error('[Questionnaire] Error fetching fields:', error);
    return [];
  }
}

/**
 * Get only common questionnaire fields (applies to all occasions)
 *
 * @returns Array of common questionnaire fields
 */
export async function getCommonQuestionnaireFields(): Promise<QuestionnaireField[]> {
  // Check cache first
  const cacheKey = 'questionnaire:common';
  const cached = getCached<QuestionnaireField[]>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const supabase = getServerClient();

    const { data, error } = await supabase
      .from('config_questionnaire_fields')
      .select('*')
      .eq('is_active', true)
      .is('occasion_slug', null)
      .order('field_group', { ascending: true })
      .order('display_order', { ascending: true });

    if (error) {
      console.error('[Questionnaire] Database error:', error);
      return [];
    }

    // Parse JSONB fields
    const fields = (data || []).map((field) => ({
      ...field,
      options: typeof field.options === 'string' ? JSON.parse(field.options) : field.options,
      validation_rules: typeof field.validation_rules === 'string' ? JSON.parse(field.validation_rules) : field.validation_rules,
    })) as QuestionnaireField[];

    // Cache the result
    setCache(cacheKey, fields);

    return fields;
  } catch (error) {
    console.error('[Questionnaire] Error fetching common fields:', error);
    return [];
  }
}

/**
 * Group questionnaire fields by their field_group
 *
 * @param fields - Array of questionnaire fields
 * @returns Object with field groups as keys and arrays of fields as values
 */
export function groupFieldsByGroup(fields: QuestionnaireField[]): Record<string, QuestionnaireField[]> {
  return fields.reduce((groups, field) => {
    const group = field.field_group;
    if (!groups[group]) {
      groups[group] = [];
    }
    groups[group].push(field);
    return groups;
  }, {} as Record<string, QuestionnaireField[]>);
}

/**
 * Clear the questionnaire cache (call after admin updates)
 */
export function clearQuestionnaireCache(): void {
  const keys = Array.from(cache.keys()).filter(key => key.startsWith('questionnaire:'));
  keys.forEach(key => cache.delete(key));
  console.log('[Questionnaire] Cache cleared');
}
