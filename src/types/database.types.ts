/**
 * Database Types
 * Generated from Supabase schema - run `pnpm generate-types` to update
 *
 * This file contains TypeScript types that match the database schema.
 * It is auto-generated and should not be manually edited.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          phone: string | null;
          preferred_currency: string;
          locale: string;
          admin_role: 'super_admin' | 'order_manager' | 'support' | null;
          admin_2fa_secret: string | null;
          gdpr_consent_at: string | null;
          marketing_consent: boolean;
          anonymized_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          phone?: string | null;
          preferred_currency?: string;
          locale?: string;
          admin_role?: 'super_admin' | 'order_manager' | 'support' | null;
          admin_2fa_secret?: string | null;
          gdpr_consent_at?: string | null;
          marketing_consent?: boolean;
          anonymized_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          phone?: string | null;
          preferred_currency?: string;
          locale?: string;
          admin_role?: 'super_admin' | 'order_manager' | 'support' | null;
          admin_2fa_secret?: string | null;
          gdpr_consent_at?: string | null;
          marketing_consent?: boolean;
          anonymized_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      orders: {
        Row: {
          id: string;
          order_number: string;
          customer_id: string | null;
          customer_name: string | null;
          customer_email: string;
          customer_phone: string | null;
          package_slug: string | null;
          occasion_slug: string | null;
          status: string;
          currency: string;
          amount_expected: number;
          amount_paid: number | null;
          payment_provider: string | null;
          payment_method: string | null;
          payment_reference: string | null;
          payment_status: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded' | 'partially_refunded';
          stripe_checkout_session: string | null;
          stripe_payment_intent: string | null;
          campay_reference: string | null;
          campay_operator: string | null;
          due_date: string | null;
          paid_at: string | null;
          delivered_at: string | null;
          delivery_url: string | null;
          questionnaire_id: string | null;
          song_title: string | null;
          refund_status: 'none' | 'requested' | 'approved' | 'processed' | 'denied' | null;
          refund_amount: number | null;
          refund_reason: string | null;
          refunded_at: string | null;
          notes: string | null;
          internal_notes: string | null;
          source: string;
          utm_source: string | null;
          utm_medium: string | null;
          utm_campaign: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          order_number?: string;
          customer_id?: string | null;
          customer_name?: string | null;
          customer_email: string;
          customer_phone?: string | null;
          package_slug?: string | null;
          occasion_slug?: string | null;
          status?: string;
          currency: string;
          amount_expected: number;
          amount_paid?: number | null;
          payment_provider?: string | null;
          payment_method?: string | null;
          payment_reference?: string | null;
          payment_status?: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded' | 'partially_refunded';
          stripe_checkout_session?: string | null;
          stripe_payment_intent?: string | null;
          campay_reference?: string | null;
          campay_operator?: string | null;
          due_date?: string | null;
          paid_at?: string | null;
          delivered_at?: string | null;
          delivery_url?: string | null;
          questionnaire_id?: string | null;
          song_title?: string | null;
          refund_status?: 'none' | 'requested' | 'approved' | 'processed' | 'denied' | null;
          refund_amount?: number | null;
          refund_reason?: string | null;
          refunded_at?: string | null;
          notes?: string | null;
          internal_notes?: string | null;
          source?: string;
          utm_source?: string | null;
          utm_medium?: string | null;
          utm_campaign?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          order_number?: string;
          customer_id?: string | null;
          customer_name?: string | null;
          customer_email?: string;
          customer_phone?: string | null;
          package_slug?: string | null;
          occasion_slug?: string | null;
          status?: string;
          currency?: string;
          amount_expected?: number;
          amount_paid?: number | null;
          payment_provider?: string | null;
          payment_method?: string | null;
          payment_reference?: string | null;
          payment_status?: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded' | 'partially_refunded';
          stripe_checkout_session?: string | null;
          stripe_payment_intent?: string | null;
          campay_reference?: string | null;
          campay_operator?: string | null;
          due_date?: string | null;
          paid_at?: string | null;
          delivered_at?: string | null;
          delivery_url?: string | null;
          questionnaire_id?: string | null;
          song_title?: string | null;
          refund_status?: 'none' | 'requested' | 'approved' | 'processed' | 'denied' | null;
          refund_amount?: number | null;
          refund_reason?: string | null;
          refunded_at?: string | null;
          notes?: string | null;
          internal_notes?: string | null;
          source?: string;
          utm_source?: string | null;
          utm_medium?: string | null;
          utm_campaign?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      questionnaires: {
        Row: {
          id: string;
          order_id: string;
          /** AES-256-GCM encrypted JSON containing all questionnaire fields */
          encrypted_data: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          /** AES-256-GCM encrypted JSON containing all questionnaire fields */
          encrypted_data: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          /** AES-256-GCM encrypted JSON containing all questionnaire fields */
          encrypted_data?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      order_status_history: {
        Row: {
          id: string;
          order_id: string;
          status: string;
          previous_status: string | null;
          changed_by: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          status: string;
          previous_status?: string | null;
          changed_by?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          status?: string;
          previous_status?: string | null;
          changed_by?: string | null;
          notes?: string | null;
          created_at?: string;
        };
      };
      payment_events: {
        Row: {
          id: string;
          order_id: string;
          provider: string;
          event_type: string;
          event_data: Json;
          idempotency_key: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          provider: string;
          event_type: string;
          event_data: Json;
          idempotency_key?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          provider?: string;
          event_type?: string;
          event_data?: Json;
          idempotency_key?: string | null;
          created_at?: string;
        };
      };
      payment_sessions: {
        Row: {
          id: string;
          order_id: string;
          provider: string;
          session_id: string;
          status: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded' | 'partially_refunded';
          amount: number;
          currency: string;
          expires_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          provider: string;
          session_id: string;
          status?: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded' | 'partially_refunded';
          amount: number;
          currency: string;
          expires_at: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          provider?: string;
          session_id?: string;
          status?: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded' | 'partially_refunded';
          amount?: number;
          currency?: string;
          expires_at?: string;
          created_at?: string;
        };
      };
      admin_audit_log: {
        Row: {
          id: string;
          admin_id: string;
          action: string;
          entity_type: string;
          entity_id: string;
          old_data: Json | null;
          new_data: Json | null;
          ip_address: string | null;
          user_agent: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          admin_id: string;
          action: string;
          entity_type: string;
          entity_id: string;
          old_data?: Json | null;
          new_data?: Json | null;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          admin_id?: string;
          action?: string;
          entity_type?: string;
          entity_id?: string;
          old_data?: Json | null;
          new_data?: Json | null;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
      };
      security_events: {
        Row: {
          id: string;
          event_type: string;
          severity: 'low' | 'medium' | 'high' | 'critical';
          description: string;
          user_id: string | null;
          ip_address: string | null;
          user_agent: string | null;
          metadata: Json | null;
          resolved_at: string | null;
          resolved_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_type: string;
          severity: 'low' | 'medium' | 'high' | 'critical';
          description: string;
          user_id?: string | null;
          ip_address?: string | null;
          user_agent?: string | null;
          metadata?: Json | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          event_type?: string;
          severity?: 'low' | 'medium' | 'high' | 'critical';
          description?: string;
          user_id?: string | null;
          ip_address?: string | null;
          user_agent?: string | null;
          metadata?: Json | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          created_at?: string;
        };
      };
      failed_login_attempts: {
        Row: {
          id: string;
          email: string;
          ip_address: string;
          user_agent: string | null;
          attempt_count: number;
          locked_until: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          ip_address: string;
          user_agent?: string | null;
          attempt_count?: number;
          locked_until?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          ip_address?: string;
          user_agent?: string | null;
          attempt_count?: number;
          locked_until?: string | null;
          created_at?: string;
        };
      };
      notification_queue: {
        Row: {
          id: string;
          recipient_id: string | null;
          recipient_email: string;
          channel: 'email' | 'sms' | 'push';
          template: string;
          data: Json;
          status: 'pending' | 'sent' | 'failed';
          sent_at: string | null;
          error: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          recipient_id?: string | null;
          recipient_email: string;
          channel: 'email' | 'sms' | 'push';
          template: string;
          data: Json;
          status?: 'pending' | 'sent' | 'failed';
          sent_at?: string | null;
          error?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          recipient_id?: string | null;
          recipient_email?: string;
          channel?: 'email' | 'sms' | 'push';
          template?: string;
          data?: Json;
          status?: 'pending' | 'sent' | 'failed';
          sent_at?: string | null;
          error?: string | null;
          created_at?: string;
        };
      };
      config_packages: {
        Row: {
          id: string;
          slug: string;
          name: string;
          description: string | null;
          price_usd: number;
          price_xaf: number;
          song_length_min: number;
          song_length_max: number;
          includes_discovery_call: boolean;
          revision_count: number;
          includes_instrumental: boolean;
          includes_full_rights: boolean;
          delivery_days_min: number;
          delivery_days_max: number;
          display_order: number;
          is_popular: boolean;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          description?: string | null;
          price_usd: number;
          price_xaf: number;
          song_length_min?: number;
          song_length_max?: number;
          includes_discovery_call?: boolean;
          revision_count?: number;
          includes_instrumental?: boolean;
          includes_full_rights?: boolean;
          delivery_days_min?: number;
          delivery_days_max?: number;
          display_order?: number;
          is_popular?: boolean;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          name?: string;
          description?: string | null;
          price_usd?: number;
          price_xaf?: number;
          song_length_min?: number;
          song_length_max?: number;
          includes_discovery_call?: boolean;
          revision_count?: number;
          includes_instrumental?: boolean;
          includes_full_rights?: boolean;
          delivery_days_min?: number;
          delivery_days_max?: number;
          display_order?: number;
          is_popular?: boolean;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      config_occasions: {
        Row: {
          id: string;
          slug: string;
          name: string;
          description: string | null;
          tagline: string | null;
          icon: string | null;
          meta_title: string | null;
          meta_description: string | null;
          display_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          description?: string | null;
          tagline?: string | null;
          icon?: string | null;
          meta_title?: string | null;
          meta_description?: string | null;
          display_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          slug?: string;
          name?: string;
          description?: string | null;
          tagline?: string | null;
          icon?: string | null;
          meta_title?: string | null;
          meta_description?: string | null;
          display_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string | null;
        };
      };
      config_payment_methods: {
        Row: {
          id: string;
          provider: string;
          method_type: string;
          display_name: string;
          currencies: string[];
          countries: string[] | null;
          fee_percentage: number;
          display_order: number;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          provider: string;
          method_type: string;
          display_name: string;
          currencies: string[];
          countries?: string[] | null;
          fee_percentage?: number;
          display_order?: number;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          provider?: string;
          method_type?: string;
          display_name?: string;
          currencies?: string[];
          countries?: string[] | null;
          fee_percentage?: number;
          display_order?: number;
          is_active?: boolean;
          created_at?: string;
        };
      };
      config_order_statuses: {
        Row: {
          id: string;
          slug: string;
          name: string;
          description: string | null;
          next_statuses: string[];
          requires_admin: boolean;
          send_email: boolean;
          email_template: string | null;
          color: string | null;
          icon: string | null;
          display_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          description?: string | null;
          next_statuses?: string[];
          requires_admin?: boolean;
          send_email?: boolean;
          email_template?: string | null;
          color?: string | null;
          icon?: string | null;
          display_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          name?: string;
          description?: string | null;
          next_statuses?: string[];
          requires_admin?: boolean;
          send_email?: boolean;
          email_template?: string | null;
          color?: string | null;
          icon?: string | null;
          display_order?: number;
          created_at?: string;
        };
      };
      config_capacity: {
        Row: {
          id: string;
          date: string;
          max_orders: number;
          current_orders: number;
          is_blackout: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          date: string;
          max_orders?: number;
          current_orders?: number;
          is_blackout?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          date?: string;
          max_orders?: number;
          current_orders?: number;
          is_blackout?: boolean;
          created_at?: string;
        };
      };
      config_refund_policies: {
        Row: {
          id: string;
          status_slug: string;
          refund_percentage: number;
          description: string | null;
          requires_manual_review: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          status_slug: string;
          refund_percentage: number;
          description?: string | null;
          requires_manual_review?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          status_slug?: string;
          refund_percentage?: number;
          description?: string | null;
          requires_manual_review?: boolean;
          created_at?: string;
        };
      };
      config_testimonials: {
        Row: {
          id: string;
          customer_name: string;
          customer_location: string | null;
          occasion: string;
          quote: string;
          rating: number;
          avatar_url: string | null;
          is_featured: boolean;
          is_active: boolean;
          display_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          customer_name: string;
          customer_location?: string | null;
          occasion: string;
          quote: string;
          rating?: number;
          avatar_url?: string | null;
          is_featured?: boolean;
          is_active?: boolean;
          display_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          customer_name?: string;
          customer_location?: string | null;
          occasion?: string;
          quote?: string;
          rating?: number;
          avatar_url?: string | null;
          is_featured?: boolean;
          is_active?: boolean;
          display_order?: number;
          created_at?: string;
        };
      };
      config_faq: {
        Row: {
          id: string;
          question: string;
          answer: string;
          category: string;
          display_order: number;
          is_active: boolean;
          locale: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          question: string;
          answer: string;
          category?: string;
          display_order?: number;
          is_active?: boolean;
          locale?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          question?: string;
          answer?: string;
          category?: string;
          display_order?: number;
          is_active?: boolean;
          locale?: string;
          created_at?: string;
        };
      };
      config_samples: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          occasion_slug: string | null;
          genre: string | null;
          style: string | null; // deprecated, use genre
          audio_url: string;
          audio_source_type: 'url' | 'embed';
          video_url: string | null;
          media_type: 'audio' | 'video';
          cover_image_url: string | null;
          duration_seconds: number | null;
          is_featured: boolean;
          is_active: boolean;
          display_order: number;
          created_at: string;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          occasion_slug?: string | null;
          genre?: string | null;
          style?: string | null;
          audio_url: string;
          audio_source_type?: 'url' | 'embed';
          video_url?: string | null;
          media_type?: 'audio' | 'video';
          cover_image_url?: string | null;
          duration_seconds?: number | null;
          is_featured?: boolean;
          is_active?: boolean;
          display_order?: number;
          created_at?: string;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string | null;
          occasion_slug?: string | null;
          genre?: string | null;
          style?: string | null;
          audio_url?: string;
          audio_source_type?: 'url' | 'embed';
          video_url?: string | null;
          media_type?: 'audio' | 'video';
          cover_image_url?: string | null;
          duration_seconds?: number | null;
          is_featured?: boolean;
          is_active?: boolean;
          display_order?: number;
          created_at?: string;
          updated_at?: string | null;
        };
      };
      config_settings: {
        Row: {
          id: string;
          key: string;
          value: string;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          key: string;
          value: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          key?: string;
          value?: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      config_video_products: {
        Row: {
          id: string;
          slug: string;
          name: string;
          description: string | null;
          category: 'lyric_video' | 'music_video';
          price_usd: number;
          price_xaf: number;
          delivery_days_additional: number;
          display_order: number;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          description?: string | null;
          category: 'lyric_video' | 'music_video';
          price_usd: number;
          price_xaf: number;
          delivery_days_additional?: number;
          display_order?: number;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          name?: string;
          description?: string | null;
          category?: 'lyric_video' | 'music_video';
          price_usd?: number;
          price_xaf?: number;
          delivery_days_additional?: number;
          display_order?: number;
          is_active?: boolean;
          created_at?: string;
        };
      };
      config_addons: {
        Row: {
          id: string;
          slug: string;
          name: string;
          description: string | null;
          category: 'delivery' | 'revision' | 'license' | 'extra' | 'physical';
          price_type: 'fixed' | 'percentage';
          price_usd: number | null;
          price_xaf: number | null;
          percentage: number | null;
          display_order: number;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          description?: string | null;
          category: 'delivery' | 'revision' | 'license' | 'extra' | 'physical';
          price_type: 'fixed' | 'percentage';
          price_usd?: number | null;
          price_xaf?: number | null;
          percentage?: number | null;
          display_order?: number;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          name?: string;
          description?: string | null;
          category?: 'delivery' | 'revision' | 'license' | 'extra' | 'physical';
          price_type?: 'fixed' | 'percentage';
          price_usd?: number | null;
          price_xaf?: number | null;
          percentage?: number | null;
          display_order?: number;
          is_active?: boolean;
          created_at?: string;
        };
      };
      config_bundles: {
        Row: {
          id: string;
          slug: string;
          name: string;
          description: string | null;
          song_count: number;
          discount_percentage: number;
          display_order: number;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          description?: string | null;
          song_count: number;
          discount_percentage: number;
          display_order?: number;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          name?: string;
          description?: string | null;
          song_count?: number;
          discount_percentage?: number;
          display_order?: number;
          is_active?: boolean;
          created_at?: string;
        };
      };
      contact_submissions: {
        Row: {
          id: string;
          first_name: string;
          last_name: string;
          email: string;
          phone: string | null;
          occasion: string | null;
          message: string;
          status: 'new' | 'read' | 'replied' | 'archived';
          ip_address: string | null;
          user_agent: string | null;
          replied_at: string | null;
          replied_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          first_name: string;
          last_name: string;
          email: string;
          phone?: string | null;
          occasion?: string | null;
          message: string;
          status?: 'new' | 'read' | 'replied' | 'archived';
          ip_address?: string | null;
          user_agent?: string | null;
          replied_at?: string | null;
          replied_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          first_name?: string;
          last_name?: string;
          email?: string;
          phone?: string | null;
          occasion?: string | null;
          message?: string;
          status?: 'new' | 'read' | 'replied' | 'archived';
          ip_address?: string | null;
          user_agent?: string | null;
          replied_at?: string | null;
          replied_by?: string | null;
          created_at?: string;
        };
      };
      config_questionnaire_fields: {
        Row: {
          id: string;
          occasion_slug: string | null;
          field_name: string;
          field_type: 'text' | 'textarea' | 'select' | 'radio' | 'checkbox' | 'date' | 'number' | 'email' | 'phone';
          field_label: string;
          placeholder: string | null;
          help_text: string | null;
          required: boolean;
          display_order: number;
          options: Json | null;
          field_group: 'recipient' | 'relationship' | 'memories' | 'song_preferences' | 'additional';
          validation_rules: Json | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          occasion_slug?: string | null;
          field_name: string;
          field_type: 'text' | 'textarea' | 'select' | 'radio' | 'checkbox' | 'date' | 'number' | 'email' | 'phone';
          field_label: string;
          placeholder?: string | null;
          help_text?: string | null;
          required?: boolean;
          display_order?: number;
          options?: Json | null;
          field_group?: 'recipient' | 'relationship' | 'memories' | 'song_preferences' | 'additional';
          validation_rules?: Json | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          occasion_slug?: string | null;
          field_name?: string;
          field_type?: 'text' | 'textarea' | 'select' | 'radio' | 'checkbox' | 'date' | 'number' | 'email' | 'phone';
          field_label?: string;
          placeholder?: string | null;
          help_text?: string | null;
          required?: boolean;
          display_order?: number;
          options?: Json | null;
          field_group?: 'recipient' | 'relationship' | 'memories' | 'song_preferences' | 'additional';
          validation_rules?: Json | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      is_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      is_super_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      generate_order_number: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      calculate_due_date: {
        Args: {
          package_slug: string;
          created_at: string;
        };
        Returns: string;
      };
      anonymize_user: {
        Args: {
          user_uuid: string;
        };
        Returns: undefined;
      };
    };
    Enums: {
      admin_role: 'super_admin' | 'order_manager' | 'support';
      payment_status: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded' | 'partially_refunded';
      notification_channel: 'email' | 'sms' | 'push';
      notification_status: 'pending' | 'sent' | 'failed';
      security_severity: 'low' | 'medium' | 'high' | 'critical';
    };
  };
};

/**
 * Helper type to get typed table rows
 */
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];

/**
 * Helper type to get typed insert types
 */
export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];

/**
 * Helper type to get typed update types
 */
export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];

/**
 * Helper type for enums
 */
export type Enums<T extends keyof Database['public']['Enums']> =
  Database['public']['Enums'][T];
