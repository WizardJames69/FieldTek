export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      ai_audit_logs: {
        Row: {
          ai_response: string | null
          block_reason: string | null
          chunk_ids: string[] | null
          context_id: string | null
          context_type: string | null
          correlation_id: string | null
          created_at: string
          document_names: string[] | null
          documents_available: number | null
          documents_with_content: number | null
          enforcement_rules_triggered: string[] | null
          equipment_type: string | null
          had_citations: boolean | null
          human_review_reasons: string[] | null
          human_review_required: boolean | null
          human_review_status: string | null
          id: string
          injection_detected: boolean | null
          model_output_hash: string | null
          model_used: string | null
          refusal_flag: boolean | null
          response_blocked: boolean | null
          response_modified: boolean | null
          response_time_ms: number | null
          retrieval_quality_score: number | null
          semantic_search_count: number | null
          similarity_scores: number[] | null
          system_prompt_hash: string | null
          tenant_id: string
          token_count_prompt: number | null
          token_count_response: number | null
          user_id: string
          user_message: string
          validation_patterns_matched: string[] | null
        }
        Insert: {
          ai_response?: string | null
          block_reason?: string | null
          chunk_ids?: string[] | null
          context_id?: string | null
          context_type?: string | null
          correlation_id?: string | null
          created_at?: string
          document_names?: string[] | null
          documents_available?: number | null
          documents_with_content?: number | null
          enforcement_rules_triggered?: string[] | null
          equipment_type?: string | null
          had_citations?: boolean | null
          human_review_reasons?: string[] | null
          human_review_required?: boolean | null
          human_review_status?: string | null
          id?: string
          injection_detected?: boolean | null
          model_output_hash?: string | null
          model_used?: string | null
          refusal_flag?: boolean | null
          response_blocked?: boolean | null
          response_modified?: boolean | null
          response_time_ms?: number | null
          retrieval_quality_score?: number | null
          semantic_search_count?: number | null
          similarity_scores?: number[] | null
          system_prompt_hash?: string | null
          tenant_id: string
          token_count_prompt?: number | null
          token_count_response?: number | null
          user_id: string
          user_message: string
          validation_patterns_matched?: string[] | null
        }
        Update: {
          ai_response?: string | null
          block_reason?: string | null
          chunk_ids?: string[] | null
          context_id?: string | null
          context_type?: string | null
          correlation_id?: string | null
          created_at?: string
          document_names?: string[] | null
          documents_available?: number | null
          documents_with_content?: number | null
          enforcement_rules_triggered?: string[] | null
          equipment_type?: string | null
          had_citations?: boolean | null
          human_review_reasons?: string[] | null
          human_review_required?: boolean | null
          human_review_status?: string | null
          id?: string
          injection_detected?: boolean | null
          model_output_hash?: string | null
          model_used?: string | null
          refusal_flag?: boolean | null
          response_blocked?: boolean | null
          response_modified?: boolean | null
          response_time_ms?: number | null
          retrieval_quality_score?: number | null
          semantic_search_count?: number | null
          similarity_scores?: number[] | null
          system_prompt_hash?: string | null
          tenant_id?: string
          token_count_prompt?: number | null
          token_count_response?: number | null
          user_id?: string
          user_message?: string
          validation_patterns_matched?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_audit_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_audit_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_response_feedback: {
        Row: {
          id: string
          audit_log_id: string | null
          tenant_id: string
          user_id: string
          rating: string
          feedback_text: string | null
          feedback_category: string | null
          created_at: string
        }
        Insert: {
          id?: string
          audit_log_id?: string | null
          tenant_id: string
          user_id: string
          rating: string
          feedback_text?: string | null
          feedback_category?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          audit_log_id?: string | null
          tenant_id?: string
          user_id?: string
          rating?: string
          feedback_text?: string | null
          feedback_category?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_response_feedback_audit_log_id_fkey"
            columns: ["audit_log_id"]
            isOneToOne: false
            referencedRelation: "ai_audit_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_response_feedback_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      announcement_dismissals: {
        Row: {
          announcement_id: string
          dismissed_at: string
          id: string
          user_id: string
        }
        Insert: {
          announcement_id: string
          dismissed_at?: string
          id?: string
          user_id: string
        }
        Update: {
          announcement_id?: string
          dismissed_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_dismissals_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          announcement_type: string
          content: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          is_dismissible: boolean
          is_published: boolean
          priority: number
          published_at: string | null
          target_roles: string[] | null
          target_tiers: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          announcement_type?: string
          content: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_dismissible?: boolean
          is_published?: boolean
          priority?: number
          published_at?: string | null
          target_roles?: string[] | null
          target_tiers?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          announcement_type?: string
          content?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_dismissible?: boolean
          is_published?: boolean
          priority?: number
          published_at?: string | null
          target_roles?: string[] | null
          target_tiers?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      beta_applications: {
        Row: {
          company_name: string
          created_at: string
          email: string
          email_error: string | null
          email_sent_at: string | null
          id: string
          industry: string | null
          interest_reason: string | null
          promo_code: string | null
          status: string
          technician_count: string | null
          updated_at: string
        }
        Insert: {
          company_name: string
          created_at?: string
          email: string
          email_error?: string | null
          email_sent_at?: string | null
          id?: string
          industry?: string | null
          interest_reason?: string | null
          promo_code?: string | null
          status?: string
          technician_count?: string | null
          updated_at?: string
        }
        Update: {
          company_name?: string
          created_at?: string
          email?: string
          email_error?: string | null
          email_sent_at?: string | null
          id?: string
          industry?: string | null
          interest_reason?: string | null
          promo_code?: string | null
          status?: string
          technician_count?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      beta_feedback: {
        Row: {
          admin_notes: string | null
          created_at: string
          description: string
          feedback_type: string
          id: string
          page_context: string | null
          screenshot_url: string | null
          status: string | null
          tenant_id: string | null
          title: string
          updated_at: string
          urgency: string | null
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          description: string
          feedback_type: string
          id?: string
          page_context?: string | null
          screenshot_url?: string | null
          status?: string | null
          tenant_id?: string | null
          title: string
          updated_at?: string
          urgency?: string | null
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          description?: string
          feedback_type?: string
          id?: string
          page_context?: string | null
          screenshot_url?: string | null
          status?: string | null
          tenant_id?: string | null
          title?: string
          updated_at?: string
          urgency?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "beta_feedback_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "beta_feedback_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_sync_tokens: {
        Row: {
          created_at: string
          google_access_token: string | null
          google_calendar_id: string | null
          google_refresh_token: string | null
          google_token_expiry: string | null
          ical_token: string
          id: string
          last_synced_at: string | null
          outlook_access_token: string | null
          outlook_calendar_id: string | null
          outlook_refresh_token: string | null
          outlook_token_expiry: string | null
          sync_enabled: boolean
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          google_access_token?: string | null
          google_calendar_id?: string | null
          google_refresh_token?: string | null
          google_token_expiry?: string | null
          ical_token: string
          id?: string
          last_synced_at?: string | null
          outlook_access_token?: string | null
          outlook_calendar_id?: string | null
          outlook_refresh_token?: string | null
          outlook_token_expiry?: string | null
          sync_enabled?: boolean
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          google_access_token?: string | null
          google_calendar_id?: string | null
          google_refresh_token?: string | null
          google_token_expiry?: string | null
          ical_token?: string
          id?: string
          last_synced_at?: string | null
          outlook_access_token?: string | null
          outlook_calendar_id?: string | null
          outlook_refresh_token?: string | null
          outlook_token_expiry?: string | null
          sync_enabled?: boolean
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_sync_tokens_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_sync_tokens_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          state: string | null
          tenant_id: string
          updated_at: string
          user_id: string | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          state?: string | null
          tenant_id: string
          updated_at?: string
          user_id?: string | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          state?: string | null
          tenant_id?: string
          updated_at?: string
          user_id?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          context_id: string | null
          context_type: string | null
          created_at: string
          id: string
          tenant_id: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          context_id?: string | null
          context_type?: string | null
          created_at?: string
          id?: string
          tenant_id: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          context_id?: string | null
          context_type?: string | null
          created_at?: string
          id?: string
          tenant_id?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_requests: {
        Row: {
          company_name: string | null
          converted_at: string | null
          converted_tenant_id: string | null
          created_at: string | null
          demo_completed_at: string | null
          email: string
          id: string
          industry: string | null
          message: string | null
          name: string
          notes: string | null
          phone: string | null
          pipeline_stage: string | null
          preferred_date: string | null
          preferred_time: string | null
          scheduled_at: string | null
          status: string | null
          team_size: string | null
          trial_started_at: string | null
        }
        Insert: {
          company_name?: string | null
          converted_at?: string | null
          converted_tenant_id?: string | null
          created_at?: string | null
          demo_completed_at?: string | null
          email: string
          id?: string
          industry?: string | null
          message?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          pipeline_stage?: string | null
          preferred_date?: string | null
          preferred_time?: string | null
          scheduled_at?: string | null
          status?: string | null
          team_size?: string | null
          trial_started_at?: string | null
        }
        Update: {
          company_name?: string | null
          converted_at?: string | null
          converted_tenant_id?: string | null
          created_at?: string | null
          demo_completed_at?: string | null
          email?: string
          id?: string
          industry?: string | null
          message?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          pipeline_stage?: string | null
          preferred_date?: string | null
          preferred_time?: string | null
          scheduled_at?: string | null
          status?: string | null
          team_size?: string | null
          trial_started_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "demo_requests_converted_tenant_id_fkey"
            columns: ["converted_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demo_requests_converted_tenant_id_fkey"
            columns: ["converted_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_sandbox_sessions: {
        Row: {
          company_name: string | null
          converted_at: string | null
          converted_to_trial: boolean | null
          created_at: string | null
          email: string | null
          expires_at: string | null
          features_explored: Json | null
          id: string
          industry: string | null
          ip_address: string | null
          last_activity_at: string | null
          name: string | null
          pages_visited: Json | null
          session_token: string
        }
        Insert: {
          company_name?: string | null
          converted_at?: string | null
          converted_to_trial?: boolean | null
          created_at?: string | null
          email?: string | null
          expires_at?: string | null
          features_explored?: Json | null
          id?: string
          industry?: string | null
          ip_address?: string | null
          last_activity_at?: string | null
          name?: string | null
          pages_visited?: Json | null
          session_token?: string
        }
        Update: {
          company_name?: string | null
          converted_at?: string | null
          converted_to_trial?: boolean | null
          created_at?: string | null
          email?: string | null
          expires_at?: string | null
          features_explored?: Json | null
          id?: string
          industry?: string | null
          ip_address?: string | null
          last_activity_at?: string | null
          name?: string | null
          pages_visited?: Json | null
          session_token?: string
        }
        Relationships: []
      }
      demo_sessions: {
        Row: {
          auto_ended: boolean | null
          completed: boolean | null
          created_at: string
          duration_seconds: number | null
          ended_at: string | null
          id: string
          ip_address: string | null
          lead_captured: boolean | null
          max_duration_seconds: number | null
          scenes_viewed: Json | null
          session_token: string
          started_at: string
          user_id: string | null
        }
        Insert: {
          auto_ended?: boolean | null
          completed?: boolean | null
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          ip_address?: string | null
          lead_captured?: boolean | null
          max_duration_seconds?: number | null
          scenes_viewed?: Json | null
          session_token?: string
          started_at?: string
          user_id?: string | null
        }
        Update: {
          auto_ended?: boolean | null
          completed?: boolean | null
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          ip_address?: string | null
          lead_captured?: boolean | null
          max_duration_seconds?: number | null
          scenes_viewed?: Json | null
          session_token?: string
          started_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      document_chunks: {
        Row: {
          chunk_index: number
          chunk_text: string
          created_at: string
          document_id: string
          embedding: string | null
          id: string
          tenant_id: string
          token_count: number | null
        }
        Insert: {
          chunk_index: number
          chunk_text: string
          created_at?: string
          document_id: string
          embedding?: string | null
          id?: string
          tenant_id: string
          token_count?: number | null
        }
        Update: {
          chunk_index?: number
          chunk_text?: string
          created_at?: string
          document_id?: string
          embedding?: string | null
          id?: string
          tenant_id?: string
          token_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "document_chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_chunks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_chunks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          embedding_status: string | null
          equipment_types: Json | null
          extracted_text: string | null
          extraction_status: string | null
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          is_public: boolean | null
          name: string
          tenant_id: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          embedding_status?: string | null
          equipment_types?: Json | null
          extracted_text?: string | null
          extraction_status?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          is_public?: boolean | null
          name: string
          tenant_id: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          embedding_status?: string | null
          equipment_types?: Json | null
          extracted_text?: string | null
          extraction_status?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          is_public?: boolean | null
          name?: string
          tenant_id?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      email_campaigns: {
        Row: {
          content: string
          created_at: string
          id: string
          recipient_count: number | null
          sent_at: string | null
          sent_by: string | null
          status: string
          subject: string
          target_audience: Json
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          recipient_count?: number | null
          sent_at?: string | null
          sent_by?: string | null
          status?: string
          subject: string
          target_audience?: Json
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          recipient_count?: number | null
          sent_at?: string | null
          sent_by?: string | null
          status?: string
          subject?: string
          target_audience?: Json
          updated_at?: string
        }
        Relationships: []
      }
      equipment_registry: {
        Row: {
          brand: string | null
          client_id: string | null
          created_at: string
          equipment_type: string
          id: string
          install_date: string | null
          location_notes: string | null
          model: string | null
          serial_number: string | null
          specifications: Json | null
          status: string | null
          tenant_id: string
          updated_at: string
          warranty_expiry: string | null
          warranty_start_date: string | null
          warranty_type: string | null
        }
        Insert: {
          brand?: string | null
          client_id?: string | null
          created_at?: string
          equipment_type: string
          id?: string
          install_date?: string | null
          location_notes?: string | null
          model?: string | null
          serial_number?: string | null
          specifications?: Json | null
          status?: string | null
          tenant_id: string
          updated_at?: string
          warranty_expiry?: string | null
          warranty_start_date?: string | null
          warranty_type?: string | null
        }
        Update: {
          brand?: string | null
          client_id?: string | null
          created_at?: string
          equipment_type?: string
          id?: string
          install_date?: string | null
          location_notes?: string | null
          model?: string | null
          serial_number?: string | null
          specifications?: Json | null
          status?: string | null
          tenant_id?: string
          updated_at?: string
          warranty_expiry?: string | null
          warranty_start_date?: string | null
          warranty_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "equipment_registry_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_registry_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_registry_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      external_calendar_events: {
        Row: {
          end_at: string
          external_id: string
          id: string
          is_all_day: boolean
          provider: string
          start_at: string
          synced_at: string
          tenant_id: string
          title: string | null
          user_id: string
        }
        Insert: {
          end_at: string
          external_id: string
          id?: string
          is_all_day?: boolean
          provider: string
          start_at: string
          synced_at?: string
          tenant_id: string
          title?: string | null
          user_id: string
        }
        Update: {
          end_at?: string
          external_id?: string
          id?: string
          is_all_day?: boolean
          provider?: string
          start_at?: string
          synced_at?: string
          tenant_id?: string
          title?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_calendar_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_calendar_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flags: {
        Row: {
          allowed_tenant_ids: string[] | null
          blocked_tenant_ids: string[] | null
          created_at: string
          created_by: string | null
          description: string | null
          ends_at: string | null
          id: string
          is_enabled: boolean
          key: string
          metadata: Json | null
          name: string
          rollout_percentage: number
          starts_at: string | null
          updated_at: string
        }
        Insert: {
          allowed_tenant_ids?: string[] | null
          blocked_tenant_ids?: string[] | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          is_enabled?: boolean
          key: string
          metadata?: Json | null
          name: string
          rollout_percentage?: number
          starts_at?: string | null
          updated_at?: string
        }
        Update: {
          allowed_tenant_ids?: string[] | null
          blocked_tenant_ids?: string[] | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          is_enabled?: boolean
          key?: string
          metadata?: Json | null
          name?: string
          rollout_percentage?: number
          starts_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      invoice_line_items: {
        Row: {
          created_at: string
          description: string
          id: string
          invoice_id: string
          item_type: string | null
          quantity: number | null
          total: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          invoice_id: string
          item_type?: string | null
          quantity?: number | null
          total: number
          unit_price: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string
          item_type?: string | null
          quantity?: number | null
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_line_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          client_id: string | null
          created_at: string
          due_date: string | null
          id: string
          invoice_number: string
          job_id: string | null
          notes: string | null
          paid_at: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["invoice_status"] | null
          subtotal: number | null
          tax_amount: number | null
          tenant_id: string
          total: number | null
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          invoice_number: string
          job_id?: string | null
          notes?: string | null
          paid_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["invoice_status"] | null
          subtotal?: number | null
          tax_amount?: number | null
          tenant_id: string
          total?: number | null
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          invoice_number?: string
          job_id?: string | null
          notes?: string | null
          paid_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["invoice_status"] | null
          subtotal?: number | null
          tax_amount?: number | null
          tenant_id?: string
          total?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "scheduled_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      job_checklist_completions: {
        Row: {
          checklist_item: string
          completed: boolean | null
          completed_at: string | null
          completed_by: string | null
          created_at: string
          id: string
          job_id: string
          notes: string | null
          photos: Json | null
          stage_name: string
        }
        Insert: {
          checklist_item: string
          completed?: boolean | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          job_id: string
          notes?: string | null
          photos?: Json | null
          stage_name: string
        }
        Update: {
          checklist_item?: string
          completed?: boolean | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          job_id?: string
          notes?: string | null
          photos?: Json | null
          stage_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_checklist_completions_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "scheduled_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_parts: {
        Row: {
          added_by: string | null
          added_to_invoice: boolean | null
          created_at: string
          id: string
          job_id: string
          notes: string | null
          part_name: string
          part_number: string | null
          purchased: boolean | null
          quantity: number
          receipt_url: string | null
          supplier: string | null
          tenant_id: string
          unit_cost: number
          updated_at: string
        }
        Insert: {
          added_by?: string | null
          added_to_invoice?: boolean | null
          created_at?: string
          id?: string
          job_id: string
          notes?: string | null
          part_name: string
          part_number?: string | null
          purchased?: boolean | null
          quantity?: number
          receipt_url?: string | null
          supplier?: string | null
          tenant_id: string
          unit_cost?: number
          updated_at?: string
        }
        Update: {
          added_by?: string | null
          added_to_invoice?: boolean | null
          created_at?: string
          id?: string
          job_id?: string
          notes?: string | null
          part_name?: string
          part_number?: string | null
          purchased?: boolean | null
          quantity?: number
          receipt_url?: string | null
          supplier?: string | null
          tenant_id?: string
          unit_cost?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_parts_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "scheduled_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_parts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_parts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      job_stage_templates: {
        Row: {
          checklist_items: Json | null
          created_at: string
          id: string
          job_type: string | null
          order_index: number | null
          stage_name: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          checklist_items?: Json | null
          created_at?: string
          id?: string
          job_type?: string | null
          order_index?: number | null
          stage_name: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          checklist_items?: Json | null
          created_at?: string
          id?: string
          job_type?: string | null
          order_index?: number | null
          stage_name?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_stage_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_stage_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          metadata: Json | null
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          link: string | null
          message: string
          read: boolean
          tenant_id: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          link?: string | null
          message: string
          read?: boolean
          tenant_id: string
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          link?: string | null
          message?: string
          read?: boolean
          tenant_id?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_progress: {
        Row: {
          branding_completed: boolean | null
          branding_completed_at: string | null
          company_info_completed: boolean | null
          company_info_completed_at: string | null
          created_at: string
          first_client_added: boolean | null
          first_client_added_at: string | null
          first_document_uploaded: boolean | null
          first_document_uploaded_at: string | null
          first_invoice_created: boolean | null
          first_invoice_created_at: string | null
          first_job_created: boolean | null
          first_job_created_at: string | null
          first_service_request_received: boolean | null
          first_service_request_received_at: string | null
          first_team_member_invited: boolean | null
          first_team_member_invited_at: string | null
          id: string
          onboarding_completed: boolean | null
          onboarding_completed_at: string | null
          payment_method_added: boolean | null
          payment_method_added_at: string | null
          stripe_connect_completed: boolean | null
          stripe_connect_completed_at: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          branding_completed?: boolean | null
          branding_completed_at?: string | null
          company_info_completed?: boolean | null
          company_info_completed_at?: string | null
          created_at?: string
          first_client_added?: boolean | null
          first_client_added_at?: string | null
          first_document_uploaded?: boolean | null
          first_document_uploaded_at?: string | null
          first_invoice_created?: boolean | null
          first_invoice_created_at?: string | null
          first_job_created?: boolean | null
          first_job_created_at?: string | null
          first_service_request_received?: boolean | null
          first_service_request_received_at?: string | null
          first_team_member_invited?: boolean | null
          first_team_member_invited_at?: string | null
          id?: string
          onboarding_completed?: boolean | null
          onboarding_completed_at?: string | null
          payment_method_added?: boolean | null
          payment_method_added_at?: string | null
          stripe_connect_completed?: boolean | null
          stripe_connect_completed_at?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          branding_completed?: boolean | null
          branding_completed_at?: string | null
          company_info_completed?: boolean | null
          company_info_completed_at?: string | null
          created_at?: string
          first_client_added?: boolean | null
          first_client_added_at?: string | null
          first_document_uploaded?: boolean | null
          first_document_uploaded_at?: string | null
          first_invoice_created?: boolean | null
          first_invoice_created_at?: string | null
          first_job_created?: boolean | null
          first_job_created_at?: string | null
          first_service_request_received?: boolean | null
          first_service_request_received_at?: string | null
          first_team_member_invited?: boolean | null
          first_team_member_invited_at?: string | null
          id?: string
          onboarding_completed?: boolean | null
          onboarding_completed_at?: string | null
          payment_method_added?: boolean | null
          payment_method_added_at?: string | null
          stripe_connect_completed?: boolean | null
          stripe_connect_completed_at?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_progress_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_progress_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      parts_catalog: {
        Row: {
          category: string | null
          created_at: string
          created_by: string | null
          default_unit_cost: number
          id: string
          part_name: string
          part_number: string | null
          supplier: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          default_unit_cost?: number
          id?: string
          part_name: string
          part_number?: string | null
          supplier?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          default_unit_cost?: number
          id?: string
          part_name?: string
          part_number?: string | null
          supplier?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "parts_catalog_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parts_catalog_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_invitations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_invitations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_admins: {
        Row: {
          created_at: string | null
          email: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      portal_invitations: {
        Row: {
          accepted_at: string | null
          client_id: string
          created_at: string
          email: string
          expires_at: string
          id: string
          tenant_id: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          client_id: string
          created_at?: string
          email: string
          expires_at: string
          id?: string
          tenant_id: string
          token: string
        }
        Update: {
          accepted_at?: string | null
          client_id?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          tenant_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_invitations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_invitations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_invitations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          certifications: Json | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          notification_preferences: Json | null
          phone: string | null
          skills: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          certifications?: Json | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          notification_preferences?: Json | null
          phone?: string | null
          skills?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          certifications?: Json | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          notification_preferences?: Json | null
          phone?: string | null
          skills?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth_key: string
          created_at: string
          endpoint: string
          id: string
          p256dh_key: string
          tenant_id: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth_key: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh_key: string
          tenant_id: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth_key?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh_key?: string
          tenant_id?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_subscriptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          created_at: string
          id: string
          identifier: string
          identifier_type: string
          request_count: number
          window_start: string
        }
        Insert: {
          created_at?: string
          id?: string
          identifier: string
          identifier_type: string
          request_count?: number
          window_start?: string
        }
        Update: {
          created_at?: string
          id?: string
          identifier?: string
          identifier_type?: string
          request_count?: number
          window_start?: string
        }
        Relationships: []
      }
      recurring_job_templates: {
        Row: {
          address: string | null
          advance_days: number
          assigned_to: string | null
          auto_assign: boolean
          client_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          end_date: string | null
          equipment_id: string | null
          estimated_duration: number | null
          id: string
          is_active: boolean
          job_type: string | null
          next_occurrence: string
          notes: string | null
          priority: Database["public"]["Enums"]["job_priority"]
          recurrence_day: number
          recurrence_interval: number
          recurrence_pattern: string
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          advance_days?: number
          assigned_to?: string | null
          auto_assign?: boolean
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          equipment_id?: string | null
          estimated_duration?: number | null
          id?: string
          is_active?: boolean
          job_type?: string | null
          next_occurrence: string
          notes?: string | null
          priority?: Database["public"]["Enums"]["job_priority"]
          recurrence_day?: number
          recurrence_interval?: number
          recurrence_pattern: string
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          advance_days?: number
          assigned_to?: string | null
          auto_assign?: boolean
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          equipment_id?: string | null
          estimated_duration?: number | null
          id?: string
          is_active?: boolean
          job_type?: string | null
          next_occurrence?: string
          notes?: string | null
          priority?: Database["public"]["Enums"]["job_priority"]
          recurrence_day?: number
          recurrence_interval?: number
          recurrence_pattern?: string
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_job_templates_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_job_templates_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment_registry"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_job_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_job_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_jobs: {
        Row: {
          actual_end: string | null
          actual_start: string | null
          address: string | null
          assigned_to: string | null
          checklist_progress: Json | null
          client_id: string | null
          created_at: string
          created_by: string | null
          current_stage: string | null
          description: string | null
          equipment_id: string | null
          estimated_duration: number | null
          id: string
          internal_notes: string | null
          job_type: string | null
          notes: string | null
          priority: Database["public"]["Enums"]["job_priority"] | null
          recurring_template_id: string | null
          scheduled_date: string | null
          scheduled_time: string | null
          stage_data: Json | null
          status: Database["public"]["Enums"]["job_status"] | null
          tenant_id: string
          title: string
          updated_at: string
          workflow_stage: string | null
        }
        Insert: {
          actual_end?: string | null
          actual_start?: string | null
          address?: string | null
          assigned_to?: string | null
          checklist_progress?: Json | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          current_stage?: string | null
          description?: string | null
          equipment_id?: string | null
          estimated_duration?: number | null
          id?: string
          internal_notes?: string | null
          job_type?: string | null
          notes?: string | null
          priority?: Database["public"]["Enums"]["job_priority"] | null
          recurring_template_id?: string | null
          scheduled_date?: string | null
          scheduled_time?: string | null
          stage_data?: Json | null
          status?: Database["public"]["Enums"]["job_status"] | null
          tenant_id: string
          title: string
          updated_at?: string
          workflow_stage?: string | null
        }
        Update: {
          actual_end?: string | null
          actual_start?: string | null
          address?: string | null
          assigned_to?: string | null
          checklist_progress?: Json | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          current_stage?: string | null
          description?: string | null
          equipment_id?: string | null
          estimated_duration?: number | null
          id?: string
          internal_notes?: string | null
          job_type?: string | null
          notes?: string | null
          priority?: Database["public"]["Enums"]["job_priority"] | null
          recurring_template_id?: string | null
          scheduled_date?: string | null
          scheduled_time?: string | null
          stage_data?: Json | null
          status?: Database["public"]["Enums"]["job_status"] | null
          tenant_id?: string
          title?: string
          updated_at?: string
          workflow_stage?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_jobs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_jobs_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment_registry"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_jobs_recurring_template_id_fkey"
            columns: ["recurring_template_id"]
            isOneToOne: false
            referencedRelation: "recurring_job_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_jobs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_jobs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      service_requests: {
        Row: {
          ai_analysis: Json | null
          ai_analyzed_at: string | null
          client_id: string | null
          converted_job_id: string | null
          created_at: string
          description: string | null
          id: string
          photos: Json | null
          priority: Database["public"]["Enums"]["job_priority"] | null
          request_type: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["request_status"] | null
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          ai_analysis?: Json | null
          ai_analyzed_at?: string | null
          client_id?: string | null
          converted_job_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          photos?: Json | null
          priority?: Database["public"]["Enums"]["job_priority"] | null
          request_type?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["request_status"] | null
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          ai_analysis?: Json | null
          ai_analyzed_at?: string | null
          client_id?: string | null
          converted_job_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          photos?: Json | null
          priority?: Database["public"]["Enums"]["job_priority"] | null
          request_type?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["request_status"] | null
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_requests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_converted_job_id_fkey"
            columns: ["converted_job_id"]
            isOneToOne: false
            referencedRelation: "scheduled_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      system_alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          alert_type: string
          created_at: string
          id: string
          message: string
          metadata: Json | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          source: string | null
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type: string
          created_at?: string
          id?: string
          message: string
          metadata?: Json | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity: string
          source?: string | null
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type?: string
          created_at?: string
          id?: string
          message?: string
          metadata?: Json | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          source?: string | null
        }
        Relationships: []
      }
      system_health_metrics: {
        Row: {
          id: string
          metadata: Json | null
          metric_type: string
          metric_value: number | null
          recorded_at: string
          status: string
        }
        Insert: {
          id?: string
          metadata?: Json | null
          metric_type: string
          metric_value?: number | null
          recorded_at?: string
          status?: string
        }
        Update: {
          id?: string
          metadata?: Json | null
          metric_type?: string
          metric_value?: number | null
          recorded_at?: string
          status?: string
        }
        Relationships: []
      }
      team_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id: string
          token: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_invitations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_invitations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_api_keys: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          revoked_at: string | null
          scopes: string[]
          tenant_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: string
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          revoked_at?: string | null
          scopes?: string[]
          tenant_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          revoked_at?: string | null
          scopes?: string[]
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_api_keys_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_api_keys_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_branding: {
        Row: {
          company_name: string | null
          created_at: string
          favicon_url: string | null
          id: string
          logo_url: string | null
          primary_color: string | null
          secondary_color: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          company_name?: string | null
          created_at?: string
          favicon_url?: string | null
          id?: string
          logo_url?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          company_name?: string | null
          created_at?: string
          favicon_url?: string | null
          id?: string
          logo_url?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_branding_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_branding_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_settings: {
        Row: {
          country: string | null
          created_at: string
          currency: string | null
          document_categories: Json | null
          equipment_types: Json | null
          features_enabled: Json | null
          id: string
          job_types: Json | null
          tax_rate: number | null
          tenant_id: string
          timezone: string | null
          updated_at: string
          workflow_stages: Json | null
        }
        Insert: {
          country?: string | null
          created_at?: string
          currency?: string | null
          document_categories?: Json | null
          equipment_types?: Json | null
          features_enabled?: Json | null
          id?: string
          job_types?: Json | null
          tax_rate?: number | null
          tenant_id: string
          timezone?: string | null
          updated_at?: string
          workflow_stages?: Json | null
        }
        Update: {
          country?: string | null
          created_at?: string
          currency?: string | null
          document_categories?: Json | null
          equipment_types?: Json | null
          features_enabled?: Json | null
          id?: string
          job_types?: Json | null
          tax_rate?: number | null
          tenant_id?: string
          timezone?: string | null
          updated_at?: string
          workflow_stages?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_users: {
        Row: {
          created_at: string
          id: string
          invited_at: string | null
          invited_by: string | null
          is_active: boolean | null
          joined_at: string | null
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          is_active?: boolean | null
          joined_at?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          is_active?: boolean | null
          joined_at?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_users_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_users_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          id: string
          industry: Database["public"]["Enums"]["industry_type"] | null
          is_beta_founder: boolean | null
          name: string
          owner_id: string | null
          phone: string | null
          slug: string
          stripe_connect_account_id: string | null
          stripe_connect_onboarded_at: string | null
          stripe_connect_status: string | null
          subscription_status:
            | Database["public"]["Enums"]["subscription_status"]
            | null
          subscription_tier:
            | Database["public"]["Enums"]["subscription_tier"]
            | null
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          industry?: Database["public"]["Enums"]["industry_type"] | null
          is_beta_founder?: boolean | null
          name: string
          owner_id?: string | null
          phone?: string | null
          slug: string
          stripe_connect_account_id?: string | null
          stripe_connect_onboarded_at?: string | null
          stripe_connect_status?: string | null
          subscription_status?:
            | Database["public"]["Enums"]["subscription_status"]
            | null
          subscription_tier?:
            | Database["public"]["Enums"]["subscription_tier"]
            | null
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          industry?: Database["public"]["Enums"]["industry_type"] | null
          is_beta_founder?: boolean | null
          name?: string
          owner_id?: string | null
          phone?: string | null
          slug?: string
          stripe_connect_account_id?: string | null
          stripe_connect_onboarded_at?: string | null
          stripe_connect_status?: string | null
          subscription_status?:
            | Database["public"]["Enums"]["subscription_status"]
            | null
          subscription_tier?:
            | Database["public"]["Enums"]["subscription_tier"]
            | null
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      tutorials: {
        Row: {
          category: string
          created_at: string
          description: string | null
          display_order: number
          duration_seconds: number
          feature_key: string | null
          id: string
          is_published: boolean
          thumbnail_url: string | null
          title: string
          updated_at: string
          video_url: string | null
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          display_order?: number
          duration_seconds?: number
          feature_key?: string | null
          id?: string
          is_published?: boolean
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          display_order?: number
          duration_seconds?: number
          feature_key?: string | null
          id?: string
          is_published?: boolean
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          video_url?: string | null
        }
        Relationships: []
      }
      user_tutorial_progress: {
        Row: {
          completed: boolean
          id: string
          tutorial_id: string
          user_id: string
          watch_duration_seconds: number | null
          watched_at: string
        }
        Insert: {
          completed?: boolean
          id?: string
          tutorial_id: string
          user_id: string
          watch_duration_seconds?: number | null
          watched_at?: string
        }
        Update: {
          completed?: boolean
          id?: string
          tutorial_id?: string
          user_id?: string
          watch_duration_seconds?: number | null
          watched_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_tutorial_progress_tutorial_id_fkey"
            columns: ["tutorial_id"]
            isOneToOne: false
            referencedRelation: "tutorials"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_usage_logs: {
        Row: {
          character_count: number | null
          created_at: string
          duration_seconds: number | null
          function_name: string
          id: string
          metadata: Json | null
          model_id: string | null
          tenant_id: string | null
          user_id: string
          voice_id: string | null
        }
        Insert: {
          character_count?: number | null
          created_at?: string
          duration_seconds?: number | null
          function_name: string
          id?: string
          metadata?: Json | null
          model_id?: string | null
          tenant_id?: string | null
          user_id: string
          voice_id?: string | null
        }
        Update: {
          character_count?: number | null
          created_at?: string
          duration_seconds?: number | null
          function_name?: string
          id?: string
          metadata?: Json | null
          model_id?: string | null
          tenant_id?: string | null
          user_id?: string
          voice_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "voice_usage_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_usage_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      waitlist_signups: {
        Row: {
          company_name: string | null
          converted_at: string | null
          created_at: string | null
          email: string
          id: string
          industry: string | null
          notified_at: string | null
          source: string | null
          technician_count: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          company_name?: string | null
          converted_at?: string | null
          created_at?: string | null
          email: string
          id?: string
          industry?: string | null
          notified_at?: string | null
          source?: string | null
          technician_count?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          company_name?: string | null
          converted_at?: string | null
          created_at?: string | null
          email?: string
          id?: string
          industry?: string | null
          notified_at?: string | null
          source?: string | null
          technician_count?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      team_invitations_safe: {
        Row: {
          accepted_at: string | null
          created_at: string | null
          email: string | null
          expires_at: string | null
          id: string | null
          invited_by: string | null
          role: Database["public"]["Enums"]["app_role"] | null
          tenant_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string | null
          email?: string | null
          expires_at?: string | null
          id?: string | null
          invited_by?: string | null
          role?: Database["public"]["Enums"]["app_role"] | null
          tenant_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          created_at?: string | null
          email?: string | null
          expires_at?: string | null
          id?: string | null
          invited_by?: string | null
          role?: Database["public"]["Enums"]["app_role"] | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_invitations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_invitations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants_public: {
        Row: {
          address: string | null
          created_at: string | null
          email: string | null
          id: string | null
          industry: Database["public"]["Enums"]["industry_type"] | null
          name: string | null
          phone: string | null
          slug: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          email?: string | null
          id?: string | null
          industry?: Database["public"]["Enums"]["industry_type"] | null
          name?: string | null
          phone?: string | null
          slug?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          email?: string | null
          id?: string | null
          industry?: Database["public"]["Enums"]["industry_type"] | null
          name?: string | null
          phone?: string | null
          slug?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_team_invitation: {
        Args: { p_token: string; p_user_id: string }
        Returns: Json
      }
      cleanup_old_health_metrics: { Args: never; Returns: undefined }
      cleanup_old_rate_limits: { Args: never; Returns: undefined }
      create_default_stage_templates: {
        Args: { p_tenant_id: string }
        Returns: undefined
      }
      create_demo_sandbox_session: {
        Args: { p_industry?: string }
        Returns: string
      }
      get_dashboard_stats: {
        Args: { p_tenant_id: string }
        Returns: {
          completed: number
          in_progress: number
          total: number
          urgent: number
        }[]
      }
      get_demo_sandbox_session_by_token: {
        Args: { p_session_token: string }
        Returns: {
          company_name: string
          converted_to_trial: boolean
          email: string
          expires_at: string
          features_explored: Json
          id: string
          industry: string
          last_activity_at: string
          name: string
          pages_visited: Json
        }[]
      }
      get_demo_session_by_token: {
        Args: { p_session_token: string }
        Returns: {
          auto_ended: boolean
          completed: boolean
          duration_seconds: number
          ended_at: string
          id: string
          max_duration_seconds: number
          scenes_viewed: Json
          started_at: string
        }[]
      }
      get_invitation_by_token: { Args: { p_token: string }; Returns: Json }
      get_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_user_tenant_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_tenant_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _tenant_id: string
          _user_id: string
        }
        Returns: boolean
      }
      is_platform_admin: { Args: never; Returns: boolean }
      is_tenant_admin: { Args: never; Returns: boolean }
      search_document_chunks: {
        Args: {
          p_match_count?: number
          p_match_threshold?: number
          p_query_embedding: string
          p_tenant_id: string
        }
        Returns: {
          chunk_text: string
          document_category: string
          document_id: string
          document_name: string
          id: string
          similarity: number
        }[]
      }
      update_demo_sandbox_session_by_token: {
        Args: {
          p_company_name?: string
          p_converted_at?: string
          p_converted_to_trial?: boolean
          p_email?: string
          p_features_explored?: Json
          p_last_activity_at?: string
          p_name?: string
          p_pages_visited?: Json
          p_session_token: string
        }
        Returns: boolean
      }
      update_demo_session_by_token: {
        Args: {
          p_auto_ended?: boolean
          p_completed?: boolean
          p_duration_seconds?: number
          p_ended_at?: string
          p_lead_captured?: boolean
          p_scenes_viewed?: Json
          p_session_token: string
        }
        Returns: boolean
      }
      user_belongs_to_tenant: { Args: { _tenant_id: string }; Returns: boolean }
      validate_portal_invitation_token: {
        Args: { p_token: string }
        Returns: {
          accepted_at: string
          client_id: string
          email: string
          expires_at: string
          id: string
          tenant_id: string
        }[]
      }
    }
    Enums: {
      app_role: "owner" | "admin" | "dispatcher" | "technician" | "client"
      industry_type:
        | "hvac"
        | "plumbing"
        | "electrical"
        | "mechanical"
        | "general"
        | "elevator"
        | "home_automation"
      invoice_status: "draft" | "sent" | "paid" | "overdue" | "cancelled"
      job_priority: "low" | "medium" | "high" | "urgent"
      job_status:
        | "pending"
        | "scheduled"
        | "in_progress"
        | "completed"
        | "cancelled"
      request_status: "new" | "reviewed" | "approved" | "rejected" | "converted"
      subscription_status: "trial" | "active" | "cancelled" | "past_due"
      subscription_tier:
        | "trial"
        | "starter"
        | "growth"
        | "professional"
        | "enterprise"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["owner", "admin", "dispatcher", "technician", "client"],
      industry_type: [
        "hvac",
        "plumbing",
        "electrical",
        "mechanical",
        "general",
        "elevator",
        "home_automation",
      ],
      invoice_status: ["draft", "sent", "paid", "overdue", "cancelled"],
      job_priority: ["low", "medium", "high", "urgent"],
      job_status: [
        "pending",
        "scheduled",
        "in_progress",
        "completed",
        "cancelled",
      ],
      request_status: ["new", "reviewed", "approved", "rejected", "converted"],
      subscription_status: ["trial", "active", "cancelled", "past_due"],
      subscription_tier: [
        "trial",
        "starter",
        "growth",
        "professional",
        "enterprise",
      ],
    },
  },
} as const
