/**
 * Server-side Supabase Client
 * For SSR operations with service role access
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/database.types';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseServiceKey = import.meta.env.SUPABASE_SERVICE_KEY;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error('Missing PUBLIC_SUPABASE_URL environment variable');
}

/**
 * Server client with service role for admin operations
 * WARNING: Only use on server-side, never expose to client
 *
 * In development, falls back to anon key for read-only operations
 */
export function createServerClient(): SupabaseClient<Database> {
  // Use service key if available, fall back to anon key for development
  const key = supabaseServiceKey || supabaseAnonKey;

  if (!key) {
    throw new Error(
      'Missing SUPABASE_SERVICE_KEY or PUBLIC_SUPABASE_ANON_KEY environment variable'
    );
  }

  if (!supabaseServiceKey && supabaseAnonKey) {
    console.warn(
      '[Supabase] Using anon key as fallback - some admin features will not work'
    );
  }

  return createClient<Database>(supabaseUrl, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Server client for specific user context
 * Useful for impersonating user in server actions
 */
export function createServerClientWithToken(
  accessToken: string
): SupabaseClient<Database> {
  const anonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

  if (!anonKey) {
    throw new Error('Missing PUBLIC_SUPABASE_ANON_KEY environment variable');
  }

  return createClient<Database>(supabaseUrl, anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Get server client
 *
 * In serverless environments, we create a fresh client each request to avoid
 * stale connection issues. Supabase-js handles connection pooling internally.
 *
 * For long-running processes, consider implementing a TTL-based cache.
 */
export function getServerClient(): SupabaseClient<Database> {
  // Create fresh client per request for serverless compatibility
  // Supabase-js manages connection pooling internally
  return createServerClient();
}
