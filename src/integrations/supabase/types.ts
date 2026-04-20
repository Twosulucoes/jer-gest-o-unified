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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_events: {
        Row: {
          action: string
          created_at: string
          created_by: string | null
          id: string
          payload: Json | null
          record_id: string
          table_name: string
        }
        Insert: {
          action: string
          created_at?: string
          created_by?: string | null
          id?: string
          payload?: Json | null
          record_id: string
          table_name: string
        }
        Update: {
          action?: string
          created_at?: string
          created_by?: string | null
          id?: string
          payload?: Json | null
          record_id?: string
          table_name?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          event_id: string
          gender_scope: string
          id: string
          max_birth_year: number | null
          min_birth_year: number | null
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          event_id: string
          gender_scope?: string
          id?: string
          max_birth_year?: number | null
          min_birth_year?: number | null
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          event_id?: string
          gender_scope?: string
          id?: string
          max_birth_year?: number | null
          min_birth_year?: number | null
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      competition_groups: {
        Row: {
          created_at: string
          event_id: string
          id: string
          name: string
          phase_id: string
          seed_batch_id: string | null
          seed_tag: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          name: string
          phase_id: string
          seed_batch_id?: string | null
          seed_tag?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          name?: string
          phase_id?: string
          seed_batch_id?: string | null
          seed_tag?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "competition_groups_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_groups_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "competition_phases"
            referencedColumns: ["id"]
          },
        ]
      }
      competition_match_entries: {
        Row: {
          created_at: string
          id: string
          match_id: string
          participant_sport_event_id: string | null
          seed: number | null
          seed_batch_id: string | null
          seed_tag: string | null
          side: string
          team_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          match_id: string
          participant_sport_event_id?: string | null
          seed?: number | null
          seed_batch_id?: string | null
          seed_tag?: string | null
          side?: string
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          match_id?: string
          participant_sport_event_id?: string | null
          seed?: number | null
          seed_batch_id?: string | null
          seed_tag?: string | null
          side?: string
          team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "competition_match_entries_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "competition_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_match_entries_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "public_results_view"
            referencedColumns: ["match_id"]
          },
          {
            foreignKeyName: "competition_match_entries_participant_sport_event_id_fkey"
            columns: ["participant_sport_event_id"]
            isOneToOne: false
            referencedRelation: "participant_sport_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_match_entries_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      competition_match_results: {
        Row: {
          awarded_entry_id: string | null
          combat_detail: Json | null
          created_at: string
          distance_cm: number | null
          id: string
          justification_notes: string | null
          match_entry_id: string
          match_id: string
          notes: string | null
          official_start_at: string | null
          outcome: string | null
          penalized_entry_id: string | null
          penalty_notes: string | null
          points: number | null
          position: number | null
          published_at: string | null
          published_bulletin_id: string | null
          published_by: string | null
          recorded_at: string
          recorded_by: string
          restart_announced_at: string | null
          result_status: string
          result_text: string | null
          result_type: string | null
          score: string | null
          seed_batch_id: string | null
          seed_tag: string | null
          time_ms: number | null
          transport_exception_confirmed: boolean | null
          updated_at: string
          validated_at: string | null
          validated_by: string | null
          wo_deadline_at: string | null
          wxo_deadline_at: string | null
        }
        Insert: {
          awarded_entry_id?: string | null
          combat_detail?: Json | null
          created_at?: string
          distance_cm?: number | null
          id?: string
          justification_notes?: string | null
          match_entry_id: string
          match_id: string
          notes?: string | null
          official_start_at?: string | null
          outcome?: string | null
          penalized_entry_id?: string | null
          penalty_notes?: string | null
          points?: number | null
          position?: number | null
          published_at?: string | null
          published_bulletin_id?: string | null
          published_by?: string | null
          recorded_at?: string
          recorded_by: string
          restart_announced_at?: string | null
          result_status?: string
          result_text?: string | null
          result_type?: string | null
          score?: string | null
          seed_batch_id?: string | null
          seed_tag?: string | null
          time_ms?: number | null
          transport_exception_confirmed?: boolean | null
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
          wo_deadline_at?: string | null
          wxo_deadline_at?: string | null
        }
        Update: {
          awarded_entry_id?: string | null
          combat_detail?: Json | null
          created_at?: string
          distance_cm?: number | null
          id?: string
          justification_notes?: string | null
          match_entry_id?: string
          match_id?: string
          notes?: string | null
          official_start_at?: string | null
          outcome?: string | null
          penalized_entry_id?: string | null
          penalty_notes?: string | null
          points?: number | null
          position?: number | null
          published_at?: string | null
          published_bulletin_id?: string | null
          published_by?: string | null
          recorded_at?: string
          recorded_by?: string
          restart_announced_at?: string | null
          result_status?: string
          result_text?: string | null
          result_type?: string | null
          score?: string | null
          seed_batch_id?: string | null
          seed_tag?: string | null
          time_ms?: number | null
          transport_exception_confirmed?: boolean | null
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
          wo_deadline_at?: string | null
          wxo_deadline_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "competition_match_results_match_entry_id_fkey"
            columns: ["match_entry_id"]
            isOneToOne: true
            referencedRelation: "competition_match_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_match_results_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "competition_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_match_results_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "public_results_view"
            referencedColumns: ["match_id"]
          },
          {
            foreignKeyName: "competition_match_results_published_bulletin_id_fkey"
            columns: ["published_bulletin_id"]
            isOneToOne: false
            referencedRelation: "official_bulletins"
            referencedColumns: ["id"]
          },
        ]
      }
      competition_matches: {
        Row: {
          created_at: string
          end_time: string | null
          event_id: string
          group_id: string | null
          id: string
          match_date: string | null
          match_number: number | null
          notes: string | null
          phase_id: string
          round_number: number | null
          seed_batch_id: string | null
          seed_tag: string | null
          sport_event_id: string | null
          start_time: string | null
          status: string
          updated_at: string
          venue_id: string | null
        }
        Insert: {
          created_at?: string
          end_time?: string | null
          event_id: string
          group_id?: string | null
          id?: string
          match_date?: string | null
          match_number?: number | null
          notes?: string | null
          phase_id: string
          round_number?: number | null
          seed_batch_id?: string | null
          seed_tag?: string | null
          sport_event_id?: string | null
          start_time?: string | null
          status?: string
          updated_at?: string
          venue_id?: string | null
        }
        Update: {
          created_at?: string
          end_time?: string | null
          event_id?: string
          group_id?: string | null
          id?: string
          match_date?: string | null
          match_number?: number | null
          notes?: string | null
          phase_id?: string
          round_number?: number | null
          seed_batch_id?: string | null
          seed_tag?: string | null
          sport_event_id?: string | null
          start_time?: string | null
          status?: string
          updated_at?: string
          venue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "competition_matches_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_matches_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "competition_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_matches_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "competition_phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_matches_sport_event_id_fkey"
            columns: ["sport_event_id"]
            isOneToOne: false
            referencedRelation: "public_results_view"
            referencedColumns: ["sport_event_id"]
          },
          {
            foreignKeyName: "competition_matches_sport_event_id_fkey"
            columns: ["sport_event_id"]
            isOneToOne: false
            referencedRelation: "sport_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_matches_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      competition_phases: {
        Row: {
          auto_transition: boolean
          bracket_config: Json
          created_at: string
          disputes_published_at: string | null
          disputes_published_by: string | null
          disputes_unpublished_reason: string | null
          disputes_updated_at: string | null
          event_id: string
          id: string
          name: string
          phase_type: string
          seed_batch_id: string | null
          seed_tag: string | null
          sort_order: number
          sport_event_id: string
          status: string
          updated_at: string
        }
        Insert: {
          auto_transition?: boolean
          bracket_config?: Json
          created_at?: string
          disputes_published_at?: string | null
          disputes_published_by?: string | null
          disputes_unpublished_reason?: string | null
          disputes_updated_at?: string | null
          event_id: string
          id?: string
          name: string
          phase_type?: string
          seed_batch_id?: string | null
          seed_tag?: string | null
          sort_order?: number
          sport_event_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          auto_transition?: boolean
          bracket_config?: Json
          created_at?: string
          disputes_published_at?: string | null
          disputes_published_by?: string | null
          disputes_unpublished_reason?: string | null
          disputes_updated_at?: string | null
          event_id?: string
          id?: string
          name?: string
          phase_type?: string
          seed_batch_id?: string | null
          seed_tag?: string | null
          sort_order?: number
          sport_event_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "competition_phases_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_phases_sport_event_id_fkey"
            columns: ["sport_event_id"]
            isOneToOne: false
            referencedRelation: "public_results_view"
            referencedColumns: ["sport_event_id"]
          },
          {
            foreignKeyName: "competition_phases_sport_event_id_fkey"
            columns: ["sport_event_id"]
            isOneToOne: false
            referencedRelation: "sport_events"
            referencedColumns: ["id"]
          },
        ]
      }
      credential_scans: {
        Row: {
          credential_id: string
          event_id: string
          id: string
          notes: string | null
          scan_point: string
          scan_result: string
          scanned_at: string
          scanned_by: string
        }
        Insert: {
          credential_id: string
          event_id: string
          id?: string
          notes?: string | null
          scan_point?: string
          scan_result?: string
          scanned_at?: string
          scanned_by: string
        }
        Update: {
          credential_id?: string
          event_id?: string
          id?: string
          notes?: string | null
          scan_point?: string
          scan_result?: string
          scanned_at?: string
          scanned_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "credential_scans_credential_id_fkey"
            columns: ["credential_id"]
            isOneToOne: false
            referencedRelation: "participant_credentials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credential_scans_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      credential_templates: {
        Row: {
          background_url: string | null
          created_at: string
          event_id: string
          field_config: Json
          height: number
          id: string
          is_active: boolean
          name: string
          notes: string | null
          updated_at: string
          width: number
        }
        Insert: {
          background_url?: string | null
          created_at?: string
          event_id: string
          field_config?: Json
          height?: number
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          updated_at?: string
          width?: number
        }
        Update: {
          background_url?: string | null
          created_at?: string
          event_id?: string
          field_config?: Json
          height?: number
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          updated_at?: string
          width?: number
        }
        Relationships: [
          {
            foreignKeyName: "credential_templates_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      delegation_requests: {
        Row: {
          created_at: string
          deadline_snapshot: string | null
          decision_at: string | null
          decision_by_user_id: string | null
          decision_notes: string | null
          delegation_id: string
          event_id: string
          food_donation_kg: number | null
          id: number
          payload_json: Json | null
          request_type: string
          requested_at: string
          requested_by_user_id: string | null
          status: string
          target_participant_id: string | null
          target_sport_event_id: string | null
          technical_meeting_at_snapshot: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          deadline_snapshot?: string | null
          decision_at?: string | null
          decision_by_user_id?: string | null
          decision_notes?: string | null
          delegation_id: string
          event_id: string
          food_donation_kg?: number | null
          id?: number
          payload_json?: Json | null
          request_type: string
          requested_at?: string
          requested_by_user_id?: string | null
          status: string
          target_participant_id?: string | null
          target_sport_event_id?: string | null
          technical_meeting_at_snapshot?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          deadline_snapshot?: string | null
          decision_at?: string | null
          decision_by_user_id?: string | null
          decision_notes?: string | null
          delegation_id?: string
          event_id?: string
          food_donation_kg?: number | null
          id?: number
          payload_json?: Json | null
          request_type?: string
          requested_at?: string
          requested_by_user_id?: string | null
          status?: string
          target_participant_id?: string | null
          target_sport_event_id?: string | null
          technical_meeting_at_snapshot?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_delegation_requests_delegation"
            columns: ["delegation_id"]
            isOneToOne: false
            referencedRelation: "delegations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_delegation_requests_event"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_delegation_requests_target_participant"
            columns: ["target_participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_delegation_requests_target_participant"
            columns: ["target_participant_id"]
            isOneToOne: false
            referencedRelation: "vw_person_logistics_consumption"
            referencedColumns: ["participant_id"]
          },
          {
            foreignKeyName: "fk_delegation_requests_target_sport_event"
            columns: ["target_sport_event_id"]
            isOneToOne: false
            referencedRelation: "public_results_view"
            referencedColumns: ["sport_event_id"]
          },
          {
            foreignKeyName: "fk_delegation_requests_target_sport_event"
            columns: ["target_sport_event_id"]
            isOneToOne: false
            referencedRelation: "sport_events"
            referencedColumns: ["id"]
          },
        ]
      }
      delegations: {
        Row: {
          chief_email: string | null
          chief_name: string | null
          chief_phone: string | null
          created_at: string
          event_id: string
          id: string
          institution_id: string
          notes: string | null
          school_city: string | null
          school_contact_email: string | null
          school_contact_name: string | null
          school_contact_phone: string | null
          school_district: string | null
          school_is_active: boolean
          school_name: string
          school_network_type: string
          school_official_name: string | null
          school_slug: string
          school_state: string | null
          seed_batch_id: string | null
          seed_tag: string | null
          status: string
          updated_at: string
        }
        Insert: {
          chief_email?: string | null
          chief_name?: string | null
          chief_phone?: string | null
          created_at?: string
          event_id: string
          id?: string
          institution_id: string
          notes?: string | null
          school_city?: string | null
          school_contact_email?: string | null
          school_contact_name?: string | null
          school_contact_phone?: string | null
          school_district?: string | null
          school_is_active?: boolean
          school_name: string
          school_network_type: string
          school_official_name?: string | null
          school_slug: string
          school_state?: string | null
          seed_batch_id?: string | null
          seed_tag?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          chief_email?: string | null
          chief_name?: string | null
          chief_phone?: string | null
          created_at?: string
          event_id?: string
          id?: string
          institution_id?: string
          notes?: string | null
          school_city?: string | null
          school_contact_email?: string | null
          school_contact_name?: string | null
          school_contact_phone?: string | null
          school_district?: string | null
          school_is_active?: boolean
          school_name?: string
          school_network_type?: string
          school_official_name?: string | null
          school_slug?: string
          school_state?: string | null
          seed_batch_id?: string | null
          seed_tag?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delegations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delegations_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      disciplinary_cases: {
        Row: {
          case_type: string
          complainant_participant_id: string | null
          created_at: string
          decision_summary: string | null
          event_id: string
          evidence_notes: string | null
          facts: string | null
          id: number
          minutes_after_event: number | null
          opened_at: string
          source_incident_id: string | null
          source_match_id: string | null
          status: string
          target_delegation_id: string | null
          target_participant_id: string | null
          updated_at: string
        }
        Insert: {
          case_type: string
          complainant_participant_id?: string | null
          created_at?: string
          decision_summary?: string | null
          event_id: string
          evidence_notes?: string | null
          facts?: string | null
          id?: number
          minutes_after_event?: number | null
          opened_at?: string
          source_incident_id?: string | null
          source_match_id?: string | null
          status?: string
          target_delegation_id?: string | null
          target_participant_id?: string | null
          updated_at?: string
        }
        Update: {
          case_type?: string
          complainant_participant_id?: string | null
          created_at?: string
          decision_summary?: string | null
          event_id?: string
          evidence_notes?: string | null
          facts?: string | null
          id?: number
          minutes_after_event?: number | null
          opened_at?: string
          source_incident_id?: string | null
          source_match_id?: string | null
          status?: string
          target_delegation_id?: string | null
          target_participant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_disciplinary_cases_complainant"
            columns: ["complainant_participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_disciplinary_cases_complainant"
            columns: ["complainant_participant_id"]
            isOneToOne: false
            referencedRelation: "vw_person_logistics_consumption"
            referencedColumns: ["participant_id"]
          },
          {
            foreignKeyName: "fk_disciplinary_cases_event"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_disciplinary_cases_incident"
            columns: ["source_incident_id"]
            isOneToOne: false
            referencedRelation: "operational_incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_disciplinary_cases_match"
            columns: ["source_match_id"]
            isOneToOne: false
            referencedRelation: "competition_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_disciplinary_cases_match"
            columns: ["source_match_id"]
            isOneToOne: false
            referencedRelation: "public_results_view"
            referencedColumns: ["match_id"]
          },
          {
            foreignKeyName: "fk_disciplinary_cases_target_delegation"
            columns: ["target_delegation_id"]
            isOneToOne: false
            referencedRelation: "delegations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_disciplinary_cases_target_participant"
            columns: ["target_participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_disciplinary_cases_target_participant"
            columns: ["target_participant_id"]
            isOneToOne: false
            referencedRelation: "vw_person_logistics_consumption"
            referencedColumns: ["participant_id"]
          },
        ]
      }
      disciplinary_sanctions: {
        Row: {
          case_id: number
          created_at: string
          ends_at: string | null
          id: number
          sanction_type: string
          scope_json: Json | null
          starts_at: string | null
          updated_at: string
        }
        Insert: {
          case_id: number
          created_at?: string
          ends_at?: string | null
          id?: number
          sanction_type: string
          scope_json?: Json | null
          starts_at?: string | null
          updated_at?: string
        }
        Update: {
          case_id?: number
          created_at?: string
          ends_at?: string | null
          id?: number
          sanction_type?: string
          scope_json?: Json | null
          starts_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "disciplinary_sanctions_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "disciplinary_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      document_requirements: {
        Row: {
          created_at: string
          disability_type: string | null
          document_type: string
          event_id: string
          event_type: string | null
          hard_block: boolean
          id: number
          is_external_technician: boolean | null
          is_required: boolean
          notes: string | null
          requirement_group: string | null
          role_type: string | null
          satisfaction_mode: string | null
          updated_at: string
          uses_lodging: boolean | null
        }
        Insert: {
          created_at?: string
          disability_type?: string | null
          document_type: string
          event_id: string
          event_type?: string | null
          hard_block?: boolean
          id?: number
          is_external_technician?: boolean | null
          is_required?: boolean
          notes?: string | null
          requirement_group?: string | null
          role_type?: string | null
          satisfaction_mode?: string | null
          updated_at?: string
          uses_lodging?: boolean | null
        }
        Update: {
          created_at?: string
          disability_type?: string | null
          document_type?: string
          event_id?: string
          event_type?: string | null
          hard_block?: boolean
          id?: number
          is_external_technician?: boolean | null
          is_required?: boolean
          notes?: string | null
          requirement_group?: string | null
          role_type?: string | null
          satisfaction_mode?: string | null
          updated_at?: string
          uses_lodging?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_document_requirements_event"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_branding: {
        Row: {
          assinatura_cargo: string | null
          assinatura_nome: string | null
          created_at: string
          created_by: string | null
          event_id: string
          local_ano: string | null
          logos: Json
          nome_oficial: string | null
          rodape_texto: string | null
          subtitulo: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          assinatura_cargo?: string | null
          assinatura_nome?: string | null
          created_at?: string
          created_by?: string | null
          event_id: string
          local_ano?: string | null
          logos?: Json
          nome_oficial?: string | null
          rodape_texto?: string | null
          subtitulo?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          assinatura_cargo?: string | null
          assinatura_nome?: string | null
          created_at?: string
          created_by?: string | null
          event_id?: string
          local_ano?: string | null
          logos?: Json
          nome_oficial?: string | null
          rodape_texto?: string | null
          subtitulo?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_branding_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_edition_rules: {
        Row: {
          created_at: string
          created_by: string | null
          effective_from: string | null
          effective_to: string | null
          event_id: string
          id: string
          is_active: boolean | null
          notes: string | null
          precedence_json: Json | null
          published_at: string | null
          published_by: string | null
          regulation_date: string | null
          regulation_name: string | null
          rule_version: string | null
          rules_snapshot_json: Json | null
          scope: string | null
          sections: Json
          source_document_ref: string | null
          status: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          effective_from?: string | null
          effective_to?: string | null
          event_id: string
          id?: string
          is_active?: boolean | null
          notes?: string | null
          precedence_json?: Json | null
          published_at?: string | null
          published_by?: string | null
          regulation_date?: string | null
          regulation_name?: string | null
          rule_version?: string | null
          rules_snapshot_json?: Json | null
          scope?: string | null
          sections?: Json
          source_document_ref?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          effective_from?: string | null
          effective_to?: string | null
          event_id?: string
          id?: string
          is_active?: boolean | null
          notes?: string | null
          precedence_json?: Json | null
          published_at?: string | null
          published_by?: string | null
          regulation_date?: string | null
          regulation_name?: string | null
          rule_version?: string | null
          rules_snapshot_json?: Json | null
          scope?: string | null
          sections?: Json
          source_document_ref?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "event_edition_rules_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_participation_rules: {
        Row: {
          alcohol_and_smoking_prohibited: boolean | null
          both_genders_with_lodging_requires_each_gender_responsible:
            | boolean
            | null
          children_under_12_forbidden_in_official_lodging: boolean | null
          created_at: string
          created_by: string | null
          credential_second_copy_max_hours: number | null
          event_id: string
          female_official_required_even_without_female_athletes: boolean | null
          food_donation_kg: number | null
          image_assignment_required: boolean | null
          jerpa_registration_end: string | null
          jerpa_registration_start: string | null
          jers_registration_end: string | null
          jers_registration_start: string | null
          max_collective_teams_per_athlete: number
          max_events_per_individual_sport: number
          max_individual_sports_per_athlete: number
          max_jerpa_modalities_per_athlete: number | null
          max_jers_collective_modalities_per_athlete: number | null
          max_jers_individual_modalities_per_athlete: number | null
          medical_fitness_report_required: boolean | null
          min_female_official_required: boolean | null
          national_no_show_ban_years: number | null
          protest_deadline_minutes: number | null
          staff_jerpa_per_wheelchair_athlete: number | null
          student_enrollment_deadline: string | null
          updated_at: string
          updated_by: string | null
          weapons_prohibited: boolean | null
          wo_minutes: number | null
          wxo_minutes: number | null
        }
        Insert: {
          alcohol_and_smoking_prohibited?: boolean | null
          both_genders_with_lodging_requires_each_gender_responsible?:
            | boolean
            | null
          children_under_12_forbidden_in_official_lodging?: boolean | null
          created_at?: string
          created_by?: string | null
          credential_second_copy_max_hours?: number | null
          event_id: string
          female_official_required_even_without_female_athletes?: boolean | null
          food_donation_kg?: number | null
          image_assignment_required?: boolean | null
          jerpa_registration_end?: string | null
          jerpa_registration_start?: string | null
          jers_registration_end?: string | null
          jers_registration_start?: string | null
          max_collective_teams_per_athlete?: number
          max_events_per_individual_sport?: number
          max_individual_sports_per_athlete?: number
          max_jerpa_modalities_per_athlete?: number | null
          max_jers_collective_modalities_per_athlete?: number | null
          max_jers_individual_modalities_per_athlete?: number | null
          medical_fitness_report_required?: boolean | null
          min_female_official_required?: boolean | null
          national_no_show_ban_years?: number | null
          protest_deadline_minutes?: number | null
          staff_jerpa_per_wheelchair_athlete?: number | null
          student_enrollment_deadline?: string | null
          updated_at?: string
          updated_by?: string | null
          weapons_prohibited?: boolean | null
          wo_minutes?: number | null
          wxo_minutes?: number | null
        }
        Update: {
          alcohol_and_smoking_prohibited?: boolean | null
          both_genders_with_lodging_requires_each_gender_responsible?:
            | boolean
            | null
          children_under_12_forbidden_in_official_lodging?: boolean | null
          created_at?: string
          created_by?: string | null
          credential_second_copy_max_hours?: number | null
          event_id?: string
          female_official_required_even_without_female_athletes?: boolean | null
          food_donation_kg?: number | null
          image_assignment_required?: boolean | null
          jerpa_registration_end?: string | null
          jerpa_registration_start?: string | null
          jers_registration_end?: string | null
          jers_registration_start?: string | null
          max_collective_teams_per_athlete?: number
          max_events_per_individual_sport?: number
          max_individual_sports_per_athlete?: number
          max_jerpa_modalities_per_athlete?: number | null
          max_jers_collective_modalities_per_athlete?: number | null
          max_jers_individual_modalities_per_athlete?: number | null
          medical_fitness_report_required?: boolean | null
          min_female_official_required?: boolean | null
          national_no_show_ban_years?: number | null
          protest_deadline_minutes?: number | null
          staff_jerpa_per_wheelchair_athlete?: number | null
          student_enrollment_deadline?: string | null
          updated_at?: string
          updated_by?: string | null
          weapons_prohibited?: boolean | null
          wo_minutes?: number | null
          wxo_minutes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "event_participation_rules_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_role_catalog: {
        Row: {
          code: string
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      event_rules_audit_log: {
        Row: {
          action: string
          changes_summary: string | null
          edition_rules_id: string | null
          event_id: string
          id: string
          new_value: Json | null
          old_value: Json | null
          performed_at: string
          performed_by: string | null
          section: string
        }
        Insert: {
          action: string
          changes_summary?: string | null
          edition_rules_id?: string | null
          event_id: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          performed_at?: string
          performed_by?: string | null
          section: string
        }
        Update: {
          action?: string
          changes_summary?: string | null
          edition_rules_id?: string | null
          event_id?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          performed_at?: string
          performed_by?: string | null
          section?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_rules_audit_log_edition_rules_id_fkey"
            columns: ["edition_rules_id"]
            isOneToOne: false
            referencedRelation: "event_edition_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_rules_audit_log_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_stages: {
        Row: {
          created_at: string
          created_by: string | null
          ends_at: string | null
          event_id: string
          id: string
          kind: string
          name: string
          slug: string
          sort_order: number
          starts_at: string | null
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          event_id: string
          id?: string
          kind?: string
          name: string
          slug: string
          sort_order?: number
          starts_at?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          event_id?: string
          id?: string
          kind?: string
          name?: string
          slug?: string
          sort_order?: number
          starts_at?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_stages_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string
          end_date: string | null
          id: string
          name: string
          slug: string
          start_date: string | null
          status: string
          updated_at: string
          year: number
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          id?: string
          name: string
          slug: string
          start_date?: string | null
          status?: string
          updated_at?: string
          year: number
        }
        Update: {
          created_at?: string
          end_date?: string | null
          id?: string
          name?: string
          slug?: string
          start_date?: string | null
          status?: string
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      external_credentials: {
        Row: {
          created_at: string
          credential_code: string
          event_id: string
          id: string
          linked_at: string
          linked_by_user_id: string | null
          notes: string | null
          participant_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          credential_code: string
          event_id: string
          id?: string
          linked_at?: string
          linked_by_user_id?: string | null
          notes?: string | null
          participant_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          credential_code?: string
          event_id?: string
          id?: string
          linked_at?: string
          linked_by_user_id?: string | null
          notes?: string | null
          participant_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_credentials_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_credentials_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_credentials_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "vw_person_logistics_consumption"
            referencedColumns: ["participant_id"]
          },
        ]
      }
      group_draw_lots: {
        Row: {
          created_at: string
          created_by: string | null
          group_id: string
          seed: number
          team_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          group_id: string
          seed: number
          team_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          group_id?: string
          seed?: number
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_draw_lots_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "competition_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_draw_lots_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      help_manual_sections: {
        Row: {
          category: string
          content_md: string
          created_at: string
          created_by: string | null
          id: string
          is_published: boolean
          sort_order: number
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          category?: string
          content_md?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_published?: boolean
          sort_order?: number
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          category?: string
          content_md?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_published?: boolean
          sort_order?: number
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      import_aliases: {
        Row: {
          alias_norm: string
          canonical_slug: string
          created_at: string
          created_by: string | null
          event_id: string | null
          id: string
          kind: string
          notes: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          alias_norm: string
          canonical_slug: string
          created_at?: string
          created_by?: string | null
          event_id?: string | null
          id?: string
          kind: string
          notes?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          alias_norm?: string
          canonical_slug?: string
          created_at?: string
          created_by?: string | null
          event_id?: string | null
          id?: string
          kind?: string
          notes?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "import_aliases_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      import_logs: {
        Row: {
          created_at: string
          error_message: string | null
          event_id: string
          event_stage_id: string | null
          file_name: string | null
          id: string
          performed_by: string
          result_summary: Json | null
          row_count: number | null
          source_phase_name: string | null
          source_phase_slug: string | null
          status: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          event_id: string
          event_stage_id?: string | null
          file_name?: string | null
          id?: string
          performed_by: string
          result_summary?: Json | null
          row_count?: number | null
          source_phase_name?: string | null
          source_phase_slug?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          event_id?: string
          event_stage_id?: string | null
          file_name?: string | null
          id?: string
          performed_by?: string
          result_summary?: Json | null
          row_count?: number | null
          source_phase_name?: string | null
          source_phase_slug?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_logs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_logs_event_stage_id_fkey"
            columns: ["event_stage_id"]
            isOneToOne: false
            referencedRelation: "event_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      import_pendencias: {
        Row: {
          candidate_person_id: string | null
          created_at: string
          event_id: string
          event_stage_id: string | null
          fallback_fingerprint: string | null
          id: string
          import_log_id: string | null
          institution_raw: string | null
          modality_raw: string | null
          normalized_name: string | null
          pending_reason_code: string
          pending_reason_detail: string | null
          prova_raw: string | null
          raw_birth_date: string | null
          raw_cpf: string | null
          raw_payload_json: Json | null
          resolution_status: string
          resolved_at: string | null
          resolved_by: string | null
          source_file_name: string | null
          source_phase_name: string | null
          source_phase_slug: string | null
          source_row_number: number
          updated_at: string
        }
        Insert: {
          candidate_person_id?: string | null
          created_at?: string
          event_id: string
          event_stage_id?: string | null
          fallback_fingerprint?: string | null
          id?: string
          import_log_id?: string | null
          institution_raw?: string | null
          modality_raw?: string | null
          normalized_name?: string | null
          pending_reason_code: string
          pending_reason_detail?: string | null
          prova_raw?: string | null
          raw_birth_date?: string | null
          raw_cpf?: string | null
          raw_payload_json?: Json | null
          resolution_status?: string
          resolved_at?: string | null
          resolved_by?: string | null
          source_file_name?: string | null
          source_phase_name?: string | null
          source_phase_slug?: string | null
          source_row_number: number
          updated_at?: string
        }
        Update: {
          candidate_person_id?: string | null
          created_at?: string
          event_id?: string
          event_stage_id?: string | null
          fallback_fingerprint?: string | null
          id?: string
          import_log_id?: string | null
          institution_raw?: string | null
          modality_raw?: string | null
          normalized_name?: string | null
          pending_reason_code?: string
          pending_reason_detail?: string | null
          prova_raw?: string | null
          raw_birth_date?: string | null
          raw_cpf?: string | null
          raw_payload_json?: Json | null
          resolution_status?: string
          resolved_at?: string | null
          resolved_by?: string | null
          source_file_name?: string | null
          source_phase_name?: string | null
          source_phase_slug?: string | null
          source_row_number?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_pendencias_candidate_person_id_fkey"
            columns: ["candidate_person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_pendencias_candidate_person_id_fkey"
            columns: ["candidate_person_id"]
            isOneToOne: false
            referencedRelation: "vw_person_logistics_consumption"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "import_pendencias_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_pendencias_event_stage_id_fkey"
            columns: ["event_stage_id"]
            isOneToOne: false
            referencedRelation: "event_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_pendencias_import_log_id_fkey"
            columns: ["import_log_id"]
            isOneToOne: false
            referencedRelation: "import_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      import_row_errors: {
        Row: {
          created_at: string
          created_by: string | null
          entity: string | null
          error_code: string | null
          error_message: string
          event_id: string
          id: string
          import_log_id: string | null
          payload: Json | null
          row_number: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          entity?: string | null
          error_code?: string | null
          error_message: string
          event_id: string
          id?: string
          import_log_id?: string | null
          payload?: Json | null
          row_number: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          entity?: string | null
          error_code?: string | null
          error_message?: string
          event_id?: string
          id?: string
          import_log_id?: string | null
          payload?: Json | null
          row_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "import_row_errors_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      institutions: {
        Row: {
          city: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          district: string | null
          id: string
          is_active: boolean
          name: string
          network_type: string
          official_name: string | null
          seed_batch_id: string | null
          seed_tag: string | null
          slug: string
          state: string | null
          updated_at: string
        }
        Insert: {
          city?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          district?: string | null
          id?: string
          is_active?: boolean
          name: string
          network_type?: string
          official_name?: string | null
          seed_batch_id?: string | null
          seed_tag?: string | null
          slug: string
          state?: string | null
          updated_at?: string
        }
        Update: {
          city?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          district?: string | null
          id?: string
          is_active?: boolean
          name?: string
          network_type?: string
          official_name?: string | null
          seed_batch_id?: string | null
          seed_tag?: string | null
          slug?: string
          state?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      jerpa_functional_classifications: {
        Row: {
          board_name: string | null
          classification_date: string | null
          classification_location: string | null
          classification_status: string
          classifier_names: Json | null
          created_at: string
          disability_type: string
          event_id: string
          functional_class_code: string | null
          id: number
          is_provisional: boolean
          medical_document_id: number | null
          notes: string | null
          participant_id: string
          previous_classification_document_id: number | null
          updated_at: string
        }
        Insert: {
          board_name?: string | null
          classification_date?: string | null
          classification_location?: string | null
          classification_status: string
          classifier_names?: Json | null
          created_at?: string
          disability_type: string
          event_id: string
          functional_class_code?: string | null
          id?: number
          is_provisional?: boolean
          medical_document_id?: number | null
          notes?: string | null
          participant_id: string
          previous_classification_document_id?: number | null
          updated_at?: string
        }
        Update: {
          board_name?: string | null
          classification_date?: string | null
          classification_location?: string | null
          classification_status?: string
          classifier_names?: Json | null
          created_at?: string
          disability_type?: string
          event_id?: string
          functional_class_code?: string | null
          id?: number
          is_provisional?: boolean
          medical_document_id?: number | null
          notes?: string | null
          participant_id?: string
          previous_classification_document_id?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_jerpa_fc_event"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_jerpa_fc_medical_document"
            columns: ["medical_document_id"]
            isOneToOne: false
            referencedRelation: "participant_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_jerpa_fc_participant"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_jerpa_fc_participant"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "vw_person_logistics_consumption"
            referencedColumns: ["participant_id"]
          },
          {
            foreignKeyName: "fk_jerpa_fc_previous_document"
            columns: ["previous_classification_document_id"]
            isOneToOne: false
            referencedRelation: "participant_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      jerpa_support_needs: {
        Row: {
          accessibility_notes: string | null
          created_at: string
          event_id: string
          id: number
          is_wheelchair_user: boolean | null
          needs_functional_support: boolean | null
          needs_guide_athlete: boolean | null
          participant_id: string
          updated_at: string
        }
        Insert: {
          accessibility_notes?: string | null
          created_at?: string
          event_id: string
          id?: number
          is_wheelchair_user?: boolean | null
          needs_functional_support?: boolean | null
          needs_guide_athlete?: boolean | null
          participant_id: string
          updated_at?: string
        }
        Update: {
          accessibility_notes?: string | null
          created_at?: string
          event_id?: string
          id?: number
          is_wheelchair_user?: boolean | null
          needs_functional_support?: boolean | null
          needs_guide_athlete?: boolean | null
          participant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_jerpa_support_event"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_jerpa_support_participant"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_jerpa_support_participant"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "vw_person_logistics_consumption"
            referencedColumns: ["participant_id"]
          },
        ]
      }
      lodging_locations: {
        Row: {
          address: string | null
          created_at: string
          event_id: string
          event_stage_id: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          seed_batch_id: string | null
          seed_tag: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          event_id: string
          event_stage_id?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          seed_batch_id?: string | null
          seed_tag?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          event_id?: string
          event_stage_id?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          seed_batch_id?: string | null
          seed_tag?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lodging_locations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lodging_locations_event_stage_id_fkey"
            columns: ["event_stage_id"]
            isOneToOne: false
            referencedRelation: "event_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      lodging_occupancies: {
        Row: {
          checked_in_at: string | null
          checked_in_by: string | null
          checked_out_at: string | null
          checked_out_by: string | null
          created_at: string
          event_id: string
          event_stage_id: string | null
          id: string
          notes: string | null
          participant_id: string
          status: string
          unit_id: string
          updated_at: string
        }
        Insert: {
          checked_in_at?: string | null
          checked_in_by?: string | null
          checked_out_at?: string | null
          checked_out_by?: string | null
          created_at?: string
          event_id: string
          event_stage_id?: string | null
          id?: string
          notes?: string | null
          participant_id: string
          status?: string
          unit_id: string
          updated_at?: string
        }
        Update: {
          checked_in_at?: string | null
          checked_in_by?: string | null
          checked_out_at?: string | null
          checked_out_by?: string | null
          created_at?: string
          event_id?: string
          event_stage_id?: string | null
          id?: string
          notes?: string | null
          participant_id?: string
          status?: string
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lodging_occupancies_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lodging_occupancies_event_stage_id_fkey"
            columns: ["event_stage_id"]
            isOneToOne: false
            referencedRelation: "event_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lodging_occupancies_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lodging_occupancies_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "vw_person_logistics_consumption"
            referencedColumns: ["participant_id"]
          },
          {
            foreignKeyName: "lodging_occupancies_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "lodging_units"
            referencedColumns: ["id"]
          },
        ]
      }
      lodging_supervisions: {
        Row: {
          created_at: string
          delegation_id: string
          ended_at: string | null
          event_id: string
          id: number
          location_id: string | null
          notes: string | null
          responsible_gender: string | null
          responsible_participant_id: string
          started_at: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          delegation_id: string
          ended_at?: string | null
          event_id: string
          id?: number
          location_id?: string | null
          notes?: string | null
          responsible_gender?: string | null
          responsible_participant_id: string
          started_at?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          delegation_id?: string
          ended_at?: string | null
          event_id?: string
          id?: number
          location_id?: string | null
          notes?: string | null
          responsible_gender?: string | null
          responsible_participant_id?: string
          started_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_lodging_supervisions_delegation"
            columns: ["delegation_id"]
            isOneToOne: false
            referencedRelation: "delegations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_lodging_supervisions_event"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_lodging_supervisions_location"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "lodging_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_lodging_supervisions_responsible"
            columns: ["responsible_participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_lodging_supervisions_responsible"
            columns: ["responsible_participant_id"]
            isOneToOne: false
            referencedRelation: "vw_person_logistics_consumption"
            referencedColumns: ["participant_id"]
          },
        ]
      }
      lodging_units: {
        Row: {
          accessible_features_json: Json | null
          capacity: number
          created_at: string
          event_id: string
          event_stage_id: string | null
          gender_restriction: string
          gender_zone: string | null
          id: string
          is_accessible: boolean | null
          is_active: boolean
          location_id: string
          min_age_policy: string | null
          name: string
          notes: string | null
          seed_batch_id: string | null
          seed_tag: string | null
          updated_at: string
        }
        Insert: {
          accessible_features_json?: Json | null
          capacity?: number
          created_at?: string
          event_id: string
          event_stage_id?: string | null
          gender_restriction?: string
          gender_zone?: string | null
          id?: string
          is_accessible?: boolean | null
          is_active?: boolean
          location_id: string
          min_age_policy?: string | null
          name: string
          notes?: string | null
          seed_batch_id?: string | null
          seed_tag?: string | null
          updated_at?: string
        }
        Update: {
          accessible_features_json?: Json | null
          capacity?: number
          created_at?: string
          event_id?: string
          event_stage_id?: string | null
          gender_restriction?: string
          gender_zone?: string | null
          id?: string
          is_accessible?: boolean | null
          is_active?: boolean
          location_id?: string
          min_age_policy?: string | null
          name?: string
          notes?: string | null
          seed_batch_id?: string | null
          seed_tag?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lodging_units_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lodging_units_event_stage_id_fkey"
            columns: ["event_stage_id"]
            isOneToOne: false
            referencedRelation: "event_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lodging_units_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "lodging_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      match_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_type: string
          file_url: string
          id: string
          match_id: string
          notes: string | null
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          file_type?: string
          file_url: string
          id?: string
          match_id: string
          notes?: string | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          file_type?: string
          file_url?: string
          id?: string
          match_id?: string
          notes?: string | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "match_attachments_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "competition_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_attachments_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "public_results_view"
            referencedColumns: ["match_id"]
          },
        ]
      }
      match_attempts: {
        Row: {
          attempt_number: number
          created_at: string
          id: string
          is_valid: boolean
          match_entry_id: string
          match_id: string
          notes: string | null
          participant_id: string
          updated_at: string
          value_cm: number | null
          value_ms: number | null
          value_points: number | null
        }
        Insert: {
          attempt_number: number
          created_at?: string
          id?: string
          is_valid?: boolean
          match_entry_id: string
          match_id: string
          notes?: string | null
          participant_id: string
          updated_at?: string
          value_cm?: number | null
          value_ms?: number | null
          value_points?: number | null
        }
        Update: {
          attempt_number?: number
          created_at?: string
          id?: string
          is_valid?: boolean
          match_entry_id?: string
          match_id?: string
          notes?: string | null
          participant_id?: string
          updated_at?: string
          value_cm?: number | null
          value_ms?: number | null
          value_points?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "match_attempts_match_entry_id_fkey"
            columns: ["match_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_match_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_attempts_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "competition_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_attempts_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "public_results_view"
            referencedColumns: ["match_id"]
          },
          {
            foreignKeyName: "match_attempts_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_attempts_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "vw_person_logistics_consumption"
            referencedColumns: ["participant_id"]
          },
        ]
      }
      match_discipline: {
        Row: {
          created_at: string
          created_by: string | null
          event_id: string
          id: string
          match_entry_id: string
          match_id: string
          red_cards: number
          updated_at: string
          updated_by: string | null
          yellow_cards: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          event_id: string
          id?: string
          match_entry_id: string
          match_id: string
          red_cards?: number
          updated_at?: string
          updated_by?: string | null
          yellow_cards?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          event_id?: string
          id?: string
          match_entry_id?: string
          match_id?: string
          red_cards?: number
          updated_at?: string
          updated_by?: string | null
          yellow_cards?: number
        }
        Relationships: [
          {
            foreignKeyName: "match_discipline_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_discipline_match_entry_id_fkey"
            columns: ["match_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_match_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_discipline_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "competition_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_discipline_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "public_results_view"
            referencedColumns: ["match_id"]
          },
        ]
      }
      match_events: {
        Row: {
          created_at: string
          event_key: string
          id: string
          match_entry_id: string | null
          match_id: string
          match_lineup_id: string | null
          minute: number | null
          notes: string | null
          participant_id: string | null
          period: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          event_key: string
          id?: string
          match_entry_id?: string | null
          match_id: string
          match_lineup_id?: string | null
          minute?: number | null
          notes?: string | null
          participant_id?: string | null
          period?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          event_key?: string
          id?: string
          match_entry_id?: string | null
          match_id?: string
          match_lineup_id?: string | null
          minute?: number | null
          notes?: string | null
          participant_id?: string | null
          period?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_events_match_entry_id_fkey"
            columns: ["match_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_match_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "competition_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "public_results_view"
            referencedColumns: ["match_id"]
          },
          {
            foreignKeyName: "match_events_match_lineup_id_fkey"
            columns: ["match_lineup_id"]
            isOneToOne: false
            referencedRelation: "match_lineups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "vw_person_logistics_consumption"
            referencedColumns: ["participant_id"]
          },
        ]
      }
      match_lineups: {
        Row: {
          created_at: string
          id: string
          is_starter: boolean
          jersey_number: number | null
          match_entry_id: string
          match_id: string
          participant_id: string
          position: string | null
          status: string
          team_member_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_starter?: boolean
          jersey_number?: number | null
          match_entry_id: string
          match_id: string
          participant_id: string
          position?: string | null
          status?: string
          team_member_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_starter?: boolean
          jersey_number?: number | null
          match_entry_id?: string
          match_id?: string
          participant_id?: string
          position?: string | null
          status?: string
          team_member_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_lineups_match_entry_id_fkey"
            columns: ["match_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_match_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_lineups_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "competition_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_lineups_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "public_results_view"
            referencedColumns: ["match_id"]
          },
          {
            foreignKeyName: "match_lineups_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_lineups_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "vw_person_logistics_consumption"
            referencedColumns: ["participant_id"]
          },
          {
            foreignKeyName: "match_lineups_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      match_officials: {
        Row: {
          created_at: string
          id: string
          match_id: string
          name: string
          notes: string | null
          role: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          match_id: string
          name: string
          notes?: string | null
          role?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          match_id?: string
          name?: string
          notes?: string | null
          role?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_officials_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "competition_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_officials_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "public_results_view"
            referencedColumns: ["match_id"]
          },
        ]
      }
      match_penalties: {
        Row: {
          created_at: string
          id: string
          match_entry_id: string | null
          match_id: string
          match_lineup_id: string | null
          minute: number | null
          notes: string | null
          participant_id: string | null
          penalty_key: string
          period: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          match_entry_id?: string | null
          match_id: string
          match_lineup_id?: string | null
          minute?: number | null
          notes?: string | null
          participant_id?: string | null
          penalty_key: string
          period?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          match_entry_id?: string | null
          match_id?: string
          match_lineup_id?: string | null
          minute?: number | null
          notes?: string | null
          participant_id?: string | null
          penalty_key?: string
          period?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_penalties_match_entry_id_fkey"
            columns: ["match_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_match_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_penalties_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "competition_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_penalties_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "public_results_view"
            referencedColumns: ["match_id"]
          },
          {
            foreignKeyName: "match_penalties_match_lineup_id_fkey"
            columns: ["match_lineup_id"]
            isOneToOne: false
            referencedRelation: "match_lineups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_penalties_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_penalties_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "vw_person_logistics_consumption"
            referencedColumns: ["participant_id"]
          },
        ]
      }
      match_player_stats: {
        Row: {
          created_at: string
          id: string
          match_id: string
          match_lineup_id: string
          participant_id: string
          period: number | null
          stat_key: string
          stat_value: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          match_id: string
          match_lineup_id: string
          participant_id: string
          period?: number | null
          stat_key: string
          stat_value?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          match_id?: string
          match_lineup_id?: string
          participant_id?: string
          period?: number | null
          stat_key?: string
          stat_value?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_player_stats_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "competition_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_player_stats_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "public_results_view"
            referencedColumns: ["match_id"]
          },
          {
            foreignKeyName: "match_player_stats_match_lineup_id_fkey"
            columns: ["match_lineup_id"]
            isOneToOne: false
            referencedRelation: "match_lineups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_player_stats_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_player_stats_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "vw_person_logistics_consumption"
            referencedColumns: ["participant_id"]
          },
        ]
      }
      match_scores: {
        Row: {
          created_at: string
          id: string
          match_entry_id: string
          match_id: string
          outcome: string | null
          score_detail: Json | null
          score_final: string | null
          seed_batch_id: string | null
          seed_tag: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          match_entry_id: string
          match_id: string
          outcome?: string | null
          score_detail?: Json | null
          score_final?: string | null
          seed_batch_id?: string | null
          seed_tag?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          match_entry_id?: string
          match_id?: string
          outcome?: string | null
          score_detail?: Json | null
          score_final?: string | null
          seed_batch_id?: string | null
          seed_tag?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_scores_match_entry_id_fkey"
            columns: ["match_entry_id"]
            isOneToOne: true
            referencedRelation: "competition_match_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_scores_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "competition_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_scores_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "public_results_view"
            referencedColumns: ["match_id"]
          },
        ]
      }
      match_user_assignments: {
        Row: {
          created_at: string
          created_by: string | null
          event_id: string
          id: string
          match_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          event_id: string
          id?: string
          match_id: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          event_id?: string
          id?: string
          match_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_user_assignments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_user_assignments_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "competition_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_user_assignments_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "public_results_view"
            referencedColumns: ["match_id"]
          },
        ]
      }
      meal_consumptions: {
        Row: {
          consumed_at: string
          created_at: string
          id: string
          meal_window_id: string
          method: string
          notes: string | null
          participant_id: string
          registered_by: string
        }
        Insert: {
          consumed_at?: string
          created_at?: string
          id?: string
          meal_window_id: string
          method?: string
          notes?: string | null
          participant_id: string
          registered_by: string
        }
        Update: {
          consumed_at?: string
          created_at?: string
          id?: string
          meal_window_id?: string
          method?: string
          notes?: string | null
          participant_id?: string
          registered_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_consumptions_meal_window_id_fkey"
            columns: ["meal_window_id"]
            isOneToOne: false
            referencedRelation: "meal_windows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_consumptions_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_consumptions_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "vw_person_logistics_consumption"
            referencedColumns: ["participant_id"]
          },
        ]
      }
      meal_types: {
        Row: {
          created_at: string
          event_id: string
          event_stage_id: string | null
          id: string
          is_active: boolean
          name: string
          seed_batch_id: string | null
          seed_tag: string | null
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          event_id: string
          event_stage_id?: string | null
          id?: string
          is_active?: boolean
          name: string
          seed_batch_id?: string | null
          seed_tag?: string | null
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          event_id?: string
          event_stage_id?: string | null
          id?: string
          is_active?: boolean
          name?: string
          seed_batch_id?: string | null
          seed_tag?: string | null
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_types_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_types_event_stage_id_fkey"
            columns: ["event_stage_id"]
            isOneToOne: false
            referencedRelation: "event_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_windows: {
        Row: {
          created_at: string
          end_time: string
          event_id: string
          event_stage_id: string | null
          id: string
          is_active: boolean
          label: string | null
          location: string | null
          meal_type_id: string
          seed_batch_id: string | null
          seed_tag: string | null
          service_date: string
          start_time: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_time: string
          event_id: string
          event_stage_id?: string | null
          id?: string
          is_active?: boolean
          label?: string | null
          location?: string | null
          meal_type_id: string
          seed_batch_id?: string | null
          seed_tag?: string | null
          service_date: string
          start_time: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_time?: string
          event_id?: string
          event_stage_id?: string | null
          id?: string
          is_active?: boolean
          label?: string | null
          location?: string | null
          meal_type_id?: string
          seed_batch_id?: string | null
          seed_tag?: string | null
          service_date?: string
          start_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_windows_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_windows_event_stage_id_fkey"
            columns: ["event_stage_id"]
            isOneToOne: false
            referencedRelation: "event_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_windows_meal_type_id_fkey"
            columns: ["meal_type_id"]
            isOneToOne: false
            referencedRelation: "meal_types"
            referencedColumns: ["id"]
          },
        ]
      }
      monitoring_alert_state: {
        Row: {
          alert_key: string
          last_sent_at: string
          payload: Json | null
        }
        Insert: {
          alert_key: string
          last_sent_at?: string
          payload?: Json | null
        }
        Update: {
          alert_key?: string
          last_sent_at?: string
          payload?: Json | null
        }
        Relationships: []
      }
      monitoring_errors: {
        Row: {
          acknowledged: boolean
          acknowledged_at: string | null
          acknowledged_by: string | null
          context: Json | null
          created_at: string
          id: string
          message: string
          severity: string
          source: string
          stack: string | null
          url: string | null
          user_agent: string | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          acknowledged?: boolean
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          context?: Json | null
          created_at?: string
          id?: string
          message: string
          severity?: string
          source: string
          stack?: string | null
          url?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          acknowledged?: boolean
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          context?: Json | null
          created_at?: string
          id?: string
          message?: string
          severity?: string
          source?: string
          stack?: string | null
          url?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      monitoring_events: {
        Row: {
          created_at: string
          description: string | null
          entity_id: string | null
          entity_label: string | null
          event_id: string | null
          event_type: string
          id: string
          metadata: Json | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          entity_id?: string | null
          entity_label?: string | null
          event_id?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
        }
        Update: {
          created_at?: string
          description?: string | null
          entity_id?: string | null
          entity_label?: string | null
          event_id?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
        }
        Relationships: []
      }
      monitoring_metrics: {
        Row: {
          active_users: number
          bucket_at: string
          bucket_size: string
          created_at: string
          details: Json | null
          edge_function_calls: number
          errors_count: number
          id: string
          new_inscriptions: number
          new_matches: number
          new_results: number
          requests_count: number
        }
        Insert: {
          active_users?: number
          bucket_at: string
          bucket_size?: string
          created_at?: string
          details?: Json | null
          edge_function_calls?: number
          errors_count?: number
          id?: string
          new_inscriptions?: number
          new_matches?: number
          new_results?: number
          requests_count?: number
        }
        Update: {
          active_users?: number
          bucket_at?: string
          bucket_size?: string
          created_at?: string
          details?: Json | null
          edge_function_calls?: number
          errors_count?: number
          id?: string
          new_inscriptions?: number
          new_matches?: number
          new_results?: number
          requests_count?: number
        }
        Relationships: []
      }
      official_bulletins: {
        Row: {
          content_md: string
          created_at: string
          created_by: string | null
          event_id: string
          id: string
          number: number
          pdf_url: string | null
          published_at: string | null
          published_by: string | null
          rectifies_bulletin_id: string | null
          status: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          content_md?: string
          created_at?: string
          created_by?: string | null
          event_id: string
          id?: string
          number: number
          pdf_url?: string | null
          published_at?: string | null
          published_by?: string | null
          rectifies_bulletin_id?: string | null
          status?: string
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          content_md?: string
          created_at?: string
          created_by?: string | null
          event_id?: string
          id?: string
          number?: number
          pdf_url?: string | null
          published_at?: string | null
          published_by?: string | null
          rectifies_bulletin_id?: string | null
          status?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "official_bulletins_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "official_bulletins_rectifies_bulletin_id_fkey"
            columns: ["rectifies_bulletin_id"]
            isOneToOne: false
            referencedRelation: "official_bulletins"
            referencedColumns: ["id"]
          },
        ]
      }
      operational_incidents: {
        Row: {
          admin_response: string | null
          created_at: string
          event_id: string
          event_stage_id: string
          id: string
          incident_description: string
          incident_status: Database["public"]["Enums"]["incident_status"]
          module: Database["public"]["Enums"]["incident_module"]
          reference_id: string | null
          reference_label: string | null
          reported_by_user_id: string
          reporter_name: string | null
          reporter_phone: string | null
          resolved_at: string | null
          resolved_by_user_id: string | null
          updated_at: string
        }
        Insert: {
          admin_response?: string | null
          created_at?: string
          event_id: string
          event_stage_id: string
          id?: string
          incident_description: string
          incident_status?: Database["public"]["Enums"]["incident_status"]
          module?: Database["public"]["Enums"]["incident_module"]
          reference_id?: string | null
          reference_label?: string | null
          reported_by_user_id: string
          reporter_name?: string | null
          reporter_phone?: string | null
          resolved_at?: string | null
          resolved_by_user_id?: string | null
          updated_at?: string
        }
        Update: {
          admin_response?: string | null
          created_at?: string
          event_id?: string
          event_stage_id?: string
          id?: string
          incident_description?: string
          incident_status?: Database["public"]["Enums"]["incident_status"]
          module?: Database["public"]["Enums"]["incident_module"]
          reference_id?: string | null
          reference_label?: string | null
          reported_by_user_id?: string
          reporter_name?: string | null
          reporter_phone?: string | null
          resolved_at?: string | null
          resolved_by_user_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "operational_incidents_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operational_incidents_event_stage_id_fkey"
            columns: ["event_stage_id"]
            isOneToOne: false
            referencedRelation: "event_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      participant_credentials: {
        Row: {
          activated_at: string | null
          activated_by: string | null
          binding_source: string
          created_at: string
          credential_code: string
          credential_type: string | null
          event_id: string
          external_participant_id: string | null
          external_registration_id: string | null
          external_system: string
          function_label: string | null
          id: string
          is_active: boolean
          issued_at: string | null
          issued_by: string | null
          last_reissue_request_id: number | null
          last_validated_at: string | null
          participant_id: string
          printed_snapshot_json: Json | null
          qr_code_value: string
          raw_payload: Json | null
          reissued_count: number | null
          revoked_at: string | null
          revoked_reason: string | null
          status: string
          updated_at: string
        }
        Insert: {
          activated_at?: string | null
          activated_by?: string | null
          binding_source?: string
          created_at?: string
          credential_code: string
          credential_type?: string | null
          event_id: string
          external_participant_id?: string | null
          external_registration_id?: string | null
          external_system?: string
          function_label?: string | null
          id?: string
          is_active?: boolean
          issued_at?: string | null
          issued_by?: string | null
          last_reissue_request_id?: number | null
          last_validated_at?: string | null
          participant_id: string
          printed_snapshot_json?: Json | null
          qr_code_value: string
          raw_payload?: Json | null
          reissued_count?: number | null
          revoked_at?: string | null
          revoked_reason?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          activated_at?: string | null
          activated_by?: string | null
          binding_source?: string
          created_at?: string
          credential_code?: string
          credential_type?: string | null
          event_id?: string
          external_participant_id?: string | null
          external_registration_id?: string | null
          external_system?: string
          function_label?: string | null
          id?: string
          is_active?: boolean
          issued_at?: string | null
          issued_by?: string | null
          last_reissue_request_id?: number | null
          last_validated_at?: string | null
          participant_id?: string
          printed_snapshot_json?: Json | null
          qr_code_value?: string
          raw_payload?: Json | null
          reissued_count?: number | null
          revoked_at?: string | null
          revoked_reason?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "participant_credentials_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participant_credentials_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participant_credentials_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "vw_person_logistics_consumption"
            referencedColumns: ["participant_id"]
          },
        ]
      }
      participant_documents: {
        Row: {
          created_at: string
          document_type: string
          event_id: string
          expires_at: string | null
          file_url: string | null
          id: number
          mime_type: string | null
          notes: string | null
          participant_id: string
          status: string
          storage_path: string | null
          updated_at: string
          validated_at: string | null
          validated_by_user_id: string | null
        }
        Insert: {
          created_at?: string
          document_type: string
          event_id: string
          expires_at?: string | null
          file_url?: string | null
          id?: number
          mime_type?: string | null
          notes?: string | null
          participant_id: string
          status?: string
          storage_path?: string | null
          updated_at?: string
          validated_at?: string | null
          validated_by_user_id?: string | null
        }
        Update: {
          created_at?: string
          document_type?: string
          event_id?: string
          expires_at?: string | null
          file_url?: string | null
          id?: number
          mime_type?: string | null
          notes?: string | null
          participant_id?: string
          status?: string
          storage_path?: string | null
          updated_at?: string
          validated_at?: string | null
          validated_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_participant_documents_event"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_participant_documents_participant"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_participant_documents_participant"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "vw_person_logistics_consumption"
            referencedColumns: ["participant_id"]
          },
        ]
      }
      participant_event_roles: {
        Row: {
          assigned_by_user_id: string | null
          change_reason: string | null
          created_at: string
          delegation_id: string | null
          ended_at: string | null
          event_id: string
          food_donation_kg: number | null
          id: number
          is_active: boolean
          participant_id: string
          role_type: string
          source_request_id: number | null
          started_at: string
          updated_at: string
        }
        Insert: {
          assigned_by_user_id?: string | null
          change_reason?: string | null
          created_at?: string
          delegation_id?: string | null
          ended_at?: string | null
          event_id: string
          food_donation_kg?: number | null
          id?: number
          is_active?: boolean
          participant_id: string
          role_type: string
          source_request_id?: number | null
          started_at?: string
          updated_at?: string
        }
        Update: {
          assigned_by_user_id?: string | null
          change_reason?: string | null
          created_at?: string
          delegation_id?: string | null
          ended_at?: string | null
          event_id?: string
          food_donation_kg?: number | null
          id?: number
          is_active?: boolean
          participant_id?: string
          role_type?: string
          source_request_id?: number | null
          started_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_participant_event_roles_delegation"
            columns: ["delegation_id"]
            isOneToOne: false
            referencedRelation: "delegations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_participant_event_roles_event"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_participant_event_roles_participant"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_participant_event_roles_participant"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "vw_person_logistics_consumption"
            referencedColumns: ["participant_id"]
          },
          {
            foreignKeyName: "fk_participant_event_roles_request"
            columns: ["source_request_id"]
            isOneToOne: false
            referencedRelation: "delegation_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      participant_event_stages: {
        Row: {
          created_at: string
          created_by: string | null
          event_id: string
          event_stage_id: string
          id: string
          participant_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          event_id: string
          event_stage_id: string
          id?: string
          participant_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          event_id?: string
          event_stage_id?: string
          id?: string
          participant_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "participant_event_stages_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participant_event_stages_event_stage_id_fkey"
            columns: ["event_stage_id"]
            isOneToOne: false
            referencedRelation: "event_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participant_event_stages_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participant_event_stages_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "vw_person_logistics_consumption"
            referencedColumns: ["participant_id"]
          },
        ]
      }
      participant_national_eligibility: {
        Row: {
          created_at: string
          eligibility_status: string
          evaluated_at: string | null
          evaluated_by_user_id: string | null
          event_id: string
          id: number
          national_event_type: string
          participant_id: string
          reason_code: string | null
          rule_snapshot_json: Json | null
          sport_event_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          eligibility_status: string
          evaluated_at?: string | null
          evaluated_by_user_id?: string | null
          event_id: string
          id?: number
          national_event_type: string
          participant_id: string
          reason_code?: string | null
          rule_snapshot_json?: Json | null
          sport_event_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          eligibility_status?: string
          evaluated_at?: string | null
          evaluated_by_user_id?: string | null
          event_id?: string
          id?: number
          national_event_type?: string
          participant_id?: string
          reason_code?: string | null
          rule_snapshot_json?: Json | null
          sport_event_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_participant_national_eligibility_event"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_participant_national_eligibility_participant"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_participant_national_eligibility_participant"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "vw_person_logistics_consumption"
            referencedColumns: ["participant_id"]
          },
          {
            foreignKeyName: "fk_participant_national_eligibility_sport_event"
            columns: ["sport_event_id"]
            isOneToOne: false
            referencedRelation: "public_results_view"
            referencedColumns: ["sport_event_id"]
          },
          {
            foreignKeyName: "fk_participant_national_eligibility_sport_event"
            columns: ["sport_event_id"]
            isOneToOne: false
            referencedRelation: "sport_events"
            referencedColumns: ["id"]
          },
        ]
      }
      participant_sport_events: {
        Row: {
          block_reason_code: string | null
          category_rule_code: string | null
          created_at: string
          event_stage_id: string | null
          gender_snapshot: string | null
          id: string
          is_blocked_by_documentation: boolean | null
          is_nationally_eligible: boolean | null
          notes: string | null
          participant_id: string
          proof_or_weight_snapshot: Json | null
          registration_source: string | null
          registration_status: string | null
          seed_batch_id: string | null
          seed_tag: string | null
          sport_event_id: string
          status: string
          updated_at: string
        }
        Insert: {
          block_reason_code?: string | null
          category_rule_code?: string | null
          created_at?: string
          event_stage_id?: string | null
          gender_snapshot?: string | null
          id?: string
          is_blocked_by_documentation?: boolean | null
          is_nationally_eligible?: boolean | null
          notes?: string | null
          participant_id: string
          proof_or_weight_snapshot?: Json | null
          registration_source?: string | null
          registration_status?: string | null
          seed_batch_id?: string | null
          seed_tag?: string | null
          sport_event_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          block_reason_code?: string | null
          category_rule_code?: string | null
          created_at?: string
          event_stage_id?: string | null
          gender_snapshot?: string | null
          id?: string
          is_blocked_by_documentation?: boolean | null
          is_nationally_eligible?: boolean | null
          notes?: string | null
          participant_id?: string
          proof_or_weight_snapshot?: Json | null
          registration_source?: string | null
          registration_status?: string | null
          seed_batch_id?: string | null
          seed_tag?: string | null
          sport_event_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "participant_sport_events_event_stage_id_fkey"
            columns: ["event_stage_id"]
            isOneToOne: false
            referencedRelation: "event_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participant_sport_events_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participant_sport_events_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "vw_person_logistics_consumption"
            referencedColumns: ["participant_id"]
          },
          {
            foreignKeyName: "participant_sport_events_sport_event_id_fkey"
            columns: ["sport_event_id"]
            isOneToOne: false
            referencedRelation: "public_results_view"
            referencedColumns: ["sport_event_id"]
          },
          {
            foreignKeyName: "participant_sport_events_sport_event_id_fkey"
            columns: ["sport_event_id"]
            isOneToOne: false
            referencedRelation: "sport_events"
            referencedColumns: ["id"]
          },
        ]
      }
      participants: {
        Row: {
          active_status: string | null
          biological_sex: string | null
          birth_date: string | null
          coach_name: string | null
          coach_phone: string | null
          created_at: string
          credentialed_at: string | null
          credentialed_by: string | null
          delegation_id: string | null
          disability_type: string | null
          eja_flag: boolean | null
          enrollment_date: string | null
          event_id: string
          guardian_name: string | null
          guardian_phone: string | null
          id: string
          is_active: boolean
          logistics_notes: string | null
          logistics_restrictions: string | null
          national_ban_until: string | null
          needs_lodging: boolean
          needs_meals: boolean
          needs_transport: boolean
          notes: string | null
          participant_type: string
          person_id: string
          regular_attendance_confirmed: boolean | null
          school_role_label: string | null
          seed_batch_id: string | null
          seed_tag: string | null
          status: string
          updated_at: string
          wheelchair_user_flag: boolean | null
        }
        Insert: {
          active_status?: string | null
          biological_sex?: string | null
          birth_date?: string | null
          coach_name?: string | null
          coach_phone?: string | null
          created_at?: string
          credentialed_at?: string | null
          credentialed_by?: string | null
          delegation_id?: string | null
          disability_type?: string | null
          eja_flag?: boolean | null
          enrollment_date?: string | null
          event_id: string
          guardian_name?: string | null
          guardian_phone?: string | null
          id?: string
          is_active?: boolean
          logistics_notes?: string | null
          logistics_restrictions?: string | null
          national_ban_until?: string | null
          needs_lodging?: boolean
          needs_meals?: boolean
          needs_transport?: boolean
          notes?: string | null
          participant_type?: string
          person_id: string
          regular_attendance_confirmed?: boolean | null
          school_role_label?: string | null
          seed_batch_id?: string | null
          seed_tag?: string | null
          status?: string
          updated_at?: string
          wheelchair_user_flag?: boolean | null
        }
        Update: {
          active_status?: string | null
          biological_sex?: string | null
          birth_date?: string | null
          coach_name?: string | null
          coach_phone?: string | null
          created_at?: string
          credentialed_at?: string | null
          credentialed_by?: string | null
          delegation_id?: string | null
          disability_type?: string | null
          eja_flag?: boolean | null
          enrollment_date?: string | null
          event_id?: string
          guardian_name?: string | null
          guardian_phone?: string | null
          id?: string
          is_active?: boolean
          logistics_notes?: string | null
          logistics_restrictions?: string | null
          national_ban_until?: string | null
          needs_lodging?: boolean
          needs_meals?: boolean
          needs_transport?: boolean
          notes?: string | null
          participant_type?: string
          person_id?: string
          regular_attendance_confirmed?: boolean | null
          school_role_label?: string | null
          seed_batch_id?: string | null
          seed_tag?: string | null
          status?: string
          updated_at?: string
          wheelchair_user_flag?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "participants_delegation_id_fkey"
            columns: ["delegation_id"]
            isOneToOne: false
            referencedRelation: "delegations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participants_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participants_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participants_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "vw_person_logistics_consumption"
            referencedColumns: ["person_id"]
          },
        ]
      }
      participation_irregularities: {
        Row: {
          context: Json
          created_at: string
          created_by: string | null
          event_id: string
          id: string
          message: string
          participant_id: string
          resolved_at: string | null
          resolved_by: string | null
          rule_code: string
          severity: string
          status: string
        }
        Insert: {
          context?: Json
          created_at?: string
          created_by?: string | null
          event_id: string
          id?: string
          message: string
          participant_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          rule_code: string
          severity?: string
          status?: string
        }
        Update: {
          context?: Json
          created_at?: string
          created_by?: string | null
          event_id?: string
          id?: string
          message?: string
          participant_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          rule_code?: string
          severity?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "participation_irregularities_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participation_irregularities_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participation_irregularities_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "vw_person_logistics_consumption"
            referencedColumns: ["participant_id"]
          },
        ]
      }
      people: {
        Row: {
          birth_date: string
          cpf: string | null
          created_at: string
          disability_type: string | null
          email: string | null
          food_restrictions: string | null
          full_name: string
          gender: string
          id: string
          institution_id: string | null
          is_active: boolean
          medical_notes: string | null
          phone: string | null
          photo_url: string | null
          rg: string | null
          seed_batch_id: string | null
          seed_tag: string | null
          updated_at: string
        }
        Insert: {
          birth_date: string
          cpf?: string | null
          created_at?: string
          disability_type?: string | null
          email?: string | null
          food_restrictions?: string | null
          full_name: string
          gender?: string
          id?: string
          institution_id?: string | null
          is_active?: boolean
          medical_notes?: string | null
          phone?: string | null
          photo_url?: string | null
          rg?: string | null
          seed_batch_id?: string | null
          seed_tag?: string | null
          updated_at?: string
        }
        Update: {
          birth_date?: string
          cpf?: string | null
          created_at?: string
          disability_type?: string | null
          email?: string | null
          food_restrictions?: string | null
          full_name?: string
          gender?: string
          id?: string
          institution_id?: string | null
          is_active?: boolean
          medical_notes?: string | null
          phone?: string | null
          photo_url?: string | null
          rg?: string | null
          seed_batch_id?: string | null
          seed_tag?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "people_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      pesquisa_events: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          event_date: string | null
          event_stage_id: string | null
          id: string
          location: string | null
          name: string
          questions_config: Json | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          event_date?: string | null
          event_stage_id?: string | null
          id?: string
          location?: string | null
          name: string
          questions_config?: Json | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          event_date?: string | null
          event_stage_id?: string | null
          id?: string
          location?: string | null
          name?: string
          questions_config?: Json | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pesquisa_events_event_stage_id_fkey"
            columns: ["event_stage_id"]
            isOneToOne: false
            referencedRelation: "event_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      pesquisa_researchers: {
        Row: {
          active: boolean
          assigned_location: string | null
          created_at: string
          created_by: string | null
          event_id: string
          id: string
          last_login_at: string | null
          name: string
          pin_hash: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          assigned_location?: string | null
          created_at?: string
          created_by?: string | null
          event_id: string
          id?: string
          last_login_at?: string | null
          name: string
          pin_hash: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          assigned_location?: string | null
          created_at?: string
          created_by?: string | null
          event_id?: string
          id?: string
          last_login_at?: string | null
          name?: string
          pin_hash?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pesquisa_researchers_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "pesquisa_events"
            referencedColumns: ["id"]
          },
        ]
      }
      pesquisa_sessions: {
        Row: {
          created_at: string
          device_id: string
          event_id: string
          expires_at: string
          id: string
          last_seen_at: string | null
          researcher_id: string
          revoked_at: string | null
        }
        Insert: {
          created_at?: string
          device_id: string
          event_id: string
          expires_at: string
          id?: string
          last_seen_at?: string | null
          researcher_id: string
          revoked_at?: string | null
        }
        Update: {
          created_at?: string
          device_id?: string
          event_id?: string
          expires_at?: string
          id?: string
          last_seen_at?: string | null
          researcher_id?: string
          revoked_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pesquisa_sessions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "pesquisa_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pesquisa_sessions_researcher_id_fkey"
            columns: ["researcher_id"]
            isOneToOne: false
            referencedRelation: "pesquisa_researchers"
            referencedColumns: ["id"]
          },
        ]
      }
      pesquisa_surveys: {
        Row: {
          application_location: string | null
          client_uuid: string
          collected_at: string
          created_at: string
          created_by: string | null
          d1_alimentacao: number
          d1_infraestrutura: number
          d1_organizacao: number
          d1_seguranca: number
          d1_transporte: number
          d2_acessibilidade: number
          d2_igualdade: number
          d2_inclusao: number
          d3_aprendizado: number
          d3_cidadania: number
          d3_convivencia: number
          d3_superacao: number
          device_id: string | null
          event_id: string
          id: string
          mode: string
          ponto_positivo: string | null
          researcher_id: string
          respondent_age: string
          respondent_gender: string
          respondent_type: string
          sugestao: string | null
        }
        Insert: {
          application_location?: string | null
          client_uuid: string
          collected_at?: string
          created_at?: string
          created_by?: string | null
          d1_alimentacao: number
          d1_infraestrutura: number
          d1_organizacao: number
          d1_seguranca: number
          d1_transporte: number
          d2_acessibilidade: number
          d2_igualdade: number
          d2_inclusao: number
          d3_aprendizado: number
          d3_cidadania: number
          d3_convivencia: number
          d3_superacao: number
          device_id?: string | null
          event_id: string
          id?: string
          mode: string
          ponto_positivo?: string | null
          researcher_id: string
          respondent_age: string
          respondent_gender: string
          respondent_type: string
          sugestao?: string | null
        }
        Update: {
          application_location?: string | null
          client_uuid?: string
          collected_at?: string
          created_at?: string
          created_by?: string | null
          d1_alimentacao?: number
          d1_infraestrutura?: number
          d1_organizacao?: number
          d1_seguranca?: number
          d1_transporte?: number
          d2_acessibilidade?: number
          d2_igualdade?: number
          d2_inclusao?: number
          d3_aprendizado?: number
          d3_cidadania?: number
          d3_convivencia?: number
          d3_superacao?: number
          device_id?: string | null
          event_id?: string
          id?: string
          mode?: string
          ponto_positivo?: string | null
          researcher_id?: string
          respondent_age?: string
          respondent_gender?: string
          respondent_type?: string
          sugestao?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pesquisa_surveys_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "pesquisa_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pesquisa_surveys_researcher_id_fkey"
            columns: ["researcher_id"]
            isOneToOne: false
            referencedRelation: "pesquisa_researchers"
            referencedColumns: ["id"]
          },
        ]
      }
      phase_qualification_rules: {
        Row: {
          auto_qualify_if_registered_teams_eq: number | null
          base_slots: number | null
          created_at: string
          event_id: string
          host_scope_code: string
          id: number
          phase_id: string | null
          priority_order: number | null
          reallocate_to_scope_code: string | null
          special_rule_json: Json | null
          sport_event_id: string | null
          updated_at: string
        }
        Insert: {
          auto_qualify_if_registered_teams_eq?: number | null
          base_slots?: number | null
          created_at?: string
          event_id: string
          host_scope_code: string
          id?: number
          phase_id?: string | null
          priority_order?: number | null
          reallocate_to_scope_code?: string | null
          special_rule_json?: Json | null
          sport_event_id?: string | null
          updated_at?: string
        }
        Update: {
          auto_qualify_if_registered_teams_eq?: number | null
          base_slots?: number | null
          created_at?: string
          event_id?: string
          host_scope_code?: string
          id?: number
          phase_id?: string | null
          priority_order?: number | null
          reallocate_to_scope_code?: string | null
          special_rule_json?: Json | null
          sport_event_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_phase_qualification_rules_event"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_phase_qualification_rules_phase"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "competition_phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_phase_qualification_rules_sport_event"
            columns: ["sport_event_id"]
            isOneToOne: false
            referencedRelation: "public_results_view"
            referencedColumns: ["sport_event_id"]
          },
          {
            foreignKeyName: "fk_phase_qualification_rules_sport_event"
            columns: ["sport_event_id"]
            isOneToOne: false
            referencedRelation: "sport_events"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      protest_attachments: {
        Row: {
          created_at: string
          file_name: string
          id: string
          mime_type: string | null
          protest_id: string
          size_bytes: number | null
          storage_path: string
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          file_name: string
          id?: string
          mime_type?: string | null
          protest_id: string
          size_bytes?: number | null
          storage_path: string
          updated_at?: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          file_name?: string
          id?: string
          mime_type?: string | null
          protest_id?: string
          size_bytes?: number | null
          storage_path?: string
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "protest_attachments_protest_id_fkey"
            columns: ["protest_id"]
            isOneToOne: false
            referencedRelation: "protests"
            referencedColumns: ["id"]
          },
        ]
      }
      protest_audit_log: {
        Row: {
          action: string
          id: number
          new_value: Json | null
          notes: string | null
          old_value: Json | null
          performed_at: string
          performed_by: string | null
          protest_id: string
        }
        Insert: {
          action: string
          id?: number
          new_value?: Json | null
          notes?: string | null
          old_value?: Json | null
          performed_at?: string
          performed_by?: string | null
          protest_id: string
        }
        Update: {
          action?: string
          id?: number
          new_value?: Json | null
          notes?: string | null
          old_value?: Json | null
          performed_at?: string
          performed_by?: string | null
          protest_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "protest_audit_log_protest_id_fkey"
            columns: ["protest_id"]
            isOneToOne: false
            referencedRelation: "protests"
            referencedColumns: ["id"]
          },
        ]
      }
      protests: {
        Row: {
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          created_by: string
          deadline_at: string
          decided_at: string | null
          decided_by: string | null
          decision: string | null
          decision_reason: string | null
          delegation_id: string
          disciplinary_case_id: number | null
          event_id: string
          fundamentation: string
          id: string
          match_end_at: string | null
          match_id: string
          protocol_number: string
          request: string
          sport_event_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by: string
          deadline_at: string
          decided_at?: string | null
          decided_by?: string | null
          decision?: string | null
          decision_reason?: string | null
          delegation_id: string
          disciplinary_case_id?: number | null
          event_id: string
          fundamentation: string
          id?: string
          match_end_at?: string | null
          match_id: string
          protocol_number: string
          request: string
          sport_event_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string
          deadline_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision?: string | null
          decision_reason?: string | null
          delegation_id?: string
          disciplinary_case_id?: number | null
          event_id?: string
          fundamentation?: string
          id?: string
          match_end_at?: string | null
          match_id?: string
          protocol_number?: string
          request?: string
          sport_event_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "protests_delegation_id_fkey"
            columns: ["delegation_id"]
            isOneToOne: false
            referencedRelation: "delegations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "protests_disciplinary_case_id_fkey"
            columns: ["disciplinary_case_id"]
            isOneToOne: false
            referencedRelation: "disciplinary_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "protests_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "protests_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "competition_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "protests_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "public_results_view"
            referencedColumns: ["match_id"]
          },
          {
            foreignKeyName: "protests_sport_event_id_fkey"
            columns: ["sport_event_id"]
            isOneToOne: false
            referencedRelation: "public_results_view"
            referencedColumns: ["sport_event_id"]
          },
          {
            foreignKeyName: "protests_sport_event_id_fkey"
            columns: ["sport_event_id"]
            isOneToOne: false
            referencedRelation: "sport_events"
            referencedColumns: ["id"]
          },
        ]
      }
      prova_aliases: {
        Row: {
          created_at: string
          created_by: string | null
          event_id: string
          id: string
          prova_display_override: string | null
          prova_raw_normalized: string
          prova_slug_override: string
          sport_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          event_id: string
          id?: string
          prova_display_override?: string | null
          prova_raw_normalized: string
          prova_slug_override: string
          sport_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          event_id?: string
          id?: string
          prova_display_override?: string | null
          prova_raw_normalized?: string
          prova_slug_override?: string
          sport_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prova_aliases_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prova_aliases_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "public_results_view"
            referencedColumns: ["sport_id"]
          },
          {
            foreignKeyName: "prova_aliases_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
        ]
      }
      prova_catalog: {
        Row: {
          age_band: string | null
          created_at: string
          created_by: string | null
          event_id: string
          id: string
          prova_display: string
          prova_raw: string
          prova_raw_normalized: string
          prova_slug: string
          sex: string | null
          sport_id: string
        }
        Insert: {
          age_band?: string | null
          created_at?: string
          created_by?: string | null
          event_id: string
          id?: string
          prova_display: string
          prova_raw: string
          prova_raw_normalized: string
          prova_slug: string
          sex?: string | null
          sport_id: string
        }
        Update: {
          age_band?: string | null
          created_at?: string
          created_by?: string | null
          event_id?: string
          id?: string
          prova_display?: string
          prova_raw?: string
          prova_raw_normalized?: string
          prova_slug?: string
          sex?: string | null
          sport_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prova_catalog_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prova_catalog_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "public_results_view"
            referencedColumns: ["sport_id"]
          },
          {
            foreignKeyName: "prova_catalog_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
        ]
      }
      public_content: {
        Row: {
          active: boolean
          content_md: string | null
          created_at: string
          created_by: string | null
          description: string | null
          destination_url: string | null
          id: string
          kind: string
          open_in_new_tab: boolean
          slug: string
          sort_order: number
          tags: string[] | null
          title: string
          updated_at: string
          updated_by: string | null
          visibility: string
        }
        Insert: {
          active?: boolean
          content_md?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          destination_url?: string | null
          id?: string
          kind: string
          open_in_new_tab?: boolean
          slug: string
          sort_order?: number
          tags?: string[] | null
          title: string
          updated_at?: string
          updated_by?: string | null
          visibility?: string
        }
        Update: {
          active?: boolean
          content_md?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          destination_url?: string | null
          id?: string
          kind?: string
          open_in_new_tab?: boolean
          slug?: string
          sort_order?: number
          tags?: string[] | null
          title?: string
          updated_at?: string
          updated_by?: string | null
          visibility?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          active: boolean
          auth: string
          created_at: string
          endpoint: string
          id: string
          last_used_at: string | null
          p256dh: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          active?: boolean
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          last_used_at?: string | null
          p256dh: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          active?: boolean
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          last_used_at?: string | null
          p256dh?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      report_presets: {
        Row: {
          columns: Json | null
          created_at: string
          created_by: string
          event_id: string | null
          filters: Json
          id: string
          name: string
          report_id: string
        }
        Insert: {
          columns?: Json | null
          created_at?: string
          created_by: string
          event_id?: string | null
          filters?: Json
          id?: string
          name: string
          report_id: string
        }
        Update: {
          columns?: Json | null
          created_at?: string
          created_by?: string
          event_id?: string | null
          filters?: Json
          id?: string
          name?: string
          report_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_presets_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      service_voucher_uses: {
        Row: {
          context_id: string | null
          id: string
          notes: string | null
          service_kind: string
          used_at: string
          used_by: string | null
          voucher_id: string
        }
        Insert: {
          context_id?: string | null
          id?: string
          notes?: string | null
          service_kind: string
          used_at?: string
          used_by?: string | null
          voucher_id: string
        }
        Update: {
          context_id?: string | null
          id?: string
          notes?: string | null
          service_kind?: string
          used_at?: string
          used_by?: string | null
          voucher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_voucher_uses_voucher_id_fkey"
            columns: ["voucher_id"]
            isOneToOne: false
            referencedRelation: "service_vouchers"
            referencedColumns: ["id"]
          },
        ]
      }
      service_vouchers: {
        Row: {
          created_at: string
          current_uses: number
          event_id: string
          id: string
          issued_by: string | null
          max_uses: number | null
          notes: string | null
          participant_id: string
          qr_code_value: string
          revoke_reason: string | null
          revoked_at: string | null
          revoked_by: string | null
          scope_lodging: boolean
          scope_meals: boolean
          scope_transport: boolean
          status: string
          updated_at: string
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          created_at?: string
          current_uses?: number
          event_id: string
          id?: string
          issued_by?: string | null
          max_uses?: number | null
          notes?: string | null
          participant_id: string
          qr_code_value: string
          revoke_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          scope_lodging?: boolean
          scope_meals?: boolean
          scope_transport?: boolean
          status?: string
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
        }
        Update: {
          created_at?: string
          current_uses?: number
          event_id?: string
          id?: string
          issued_by?: string | null
          max_uses?: number | null
          notes?: string | null
          participant_id?: string
          qr_code_value?: string
          revoke_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          scope_lodging?: boolean
          scope_meals?: boolean
          scope_transport?: boolean
          status?: string
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_vouchers_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_vouchers_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_vouchers_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "vw_person_logistics_consumption"
            referencedColumns: ["participant_id"]
          },
        ]
      }
      sport_event_prova_map: {
        Row: {
          event_id: string
          prova_display: string
          prova_raw: string
          prova_raw_normalized: string
          prova_slug: string
          sport_event_id: string
          sport_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          event_id: string
          prova_display: string
          prova_raw: string
          prova_raw_normalized: string
          prova_slug: string
          sport_event_id: string
          sport_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          event_id?: string
          prova_display?: string
          prova_raw?: string
          prova_raw_normalized?: string
          prova_slug?: string
          sport_event_id?: string
          sport_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sport_event_prova_map_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sport_event_prova_map_sport_event_id_fkey"
            columns: ["sport_event_id"]
            isOneToOne: true
            referencedRelation: "public_results_view"
            referencedColumns: ["sport_event_id"]
          },
          {
            foreignKeyName: "sport_event_prova_map_sport_event_id_fkey"
            columns: ["sport_event_id"]
            isOneToOne: true
            referencedRelation: "sport_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sport_event_prova_map_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "public_results_view"
            referencedColumns: ["sport_id"]
          },
          {
            foreignKeyName: "sport_event_prova_map_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
        ]
      }
      sport_event_rules: {
        Row: {
          allowed_genders: string | null
          allows_external_technician: boolean | null
          change_category_hours_before_technical_meeting: number | null
          created_at: string
          created_by: string | null
          discipline_type: string | null
          event_id: string | null
          id: string
          institution_max_female: number | null
          institution_max_male: number | null
          is_active: boolean
          is_nationally_eligible_by_age: boolean | null
          is_official_for_national_selection: boolean | null
          is_state_competition_only: boolean | null
          national_eligibility_notes: string | null
          national_eligibility_reason_code: string | null
          national_eligibility_rule_json: Json | null
          national_eligibility_snapshot: Json
          national_event_type: string | null
          notes: string | null
          released_at: string | null
          released_by: string | null
          requires_cref_for_technician: boolean | null
          requires_school_authorization_for_external_technician: boolean | null
          rules: Json
          rules_version: number
          selection_method: string | null
          selection_rule_json: Json | null
          sport_event_id: string
          substitution_cap: number | null
          team_max_size: number | null
          team_min_size: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          allowed_genders?: string | null
          allows_external_technician?: boolean | null
          change_category_hours_before_technical_meeting?: number | null
          created_at?: string
          created_by?: string | null
          discipline_type?: string | null
          event_id?: string | null
          id?: string
          institution_max_female?: number | null
          institution_max_male?: number | null
          is_active?: boolean
          is_nationally_eligible_by_age?: boolean | null
          is_official_for_national_selection?: boolean | null
          is_state_competition_only?: boolean | null
          national_eligibility_notes?: string | null
          national_eligibility_reason_code?: string | null
          national_eligibility_rule_json?: Json | null
          national_eligibility_snapshot?: Json
          national_event_type?: string | null
          notes?: string | null
          released_at?: string | null
          released_by?: string | null
          requires_cref_for_technician?: boolean | null
          requires_school_authorization_for_external_technician?: boolean | null
          rules?: Json
          rules_version?: number
          selection_method?: string | null
          selection_rule_json?: Json | null
          sport_event_id: string
          substitution_cap?: number | null
          team_max_size?: number | null
          team_min_size?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          allowed_genders?: string | null
          allows_external_technician?: boolean | null
          change_category_hours_before_technical_meeting?: number | null
          created_at?: string
          created_by?: string | null
          discipline_type?: string | null
          event_id?: string | null
          id?: string
          institution_max_female?: number | null
          institution_max_male?: number | null
          is_active?: boolean
          is_nationally_eligible_by_age?: boolean | null
          is_official_for_national_selection?: boolean | null
          is_state_competition_only?: boolean | null
          national_eligibility_notes?: string | null
          national_eligibility_reason_code?: string | null
          national_eligibility_rule_json?: Json | null
          national_eligibility_snapshot?: Json
          national_event_type?: string | null
          notes?: string | null
          released_at?: string | null
          released_by?: string | null
          requires_cref_for_technician?: boolean | null
          requires_school_authorization_for_external_technician?: boolean | null
          rules?: Json
          rules_version?: number
          selection_method?: string | null
          selection_rule_json?: Json | null
          sport_event_id?: string
          substitution_cap?: number | null
          team_max_size?: number | null
          team_min_size?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sport_event_rules_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sport_event_rules_sport_event_id_fkey"
            columns: ["sport_event_id"]
            isOneToOne: true
            referencedRelation: "public_results_view"
            referencedColumns: ["sport_event_id"]
          },
          {
            foreignKeyName: "sport_event_rules_sport_event_id_fkey"
            columns: ["sport_event_id"]
            isOneToOne: true
            referencedRelation: "sport_events"
            referencedColumns: ["id"]
          },
        ]
      }
      sport_events: {
        Row: {
          category_id: string
          created_at: string
          event_id: string
          id: string
          is_active: boolean
          name: string
          slug: string
          sport_id: string
          updated_at: string
        }
        Insert: {
          category_id: string
          created_at?: string
          event_id: string
          id?: string
          is_active?: boolean
          name: string
          slug: string
          sport_id: string
          updated_at?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          event_id?: string
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          sport_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sport_events_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sport_events_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sport_events_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "public_results_view"
            referencedColumns: ["sport_id"]
          },
          {
            foreignKeyName: "sport_events_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
        ]
      }
      sports: {
        Row: {
          created_at: string
          event_id: string
          id: string
          is_collective: boolean
          is_paralympic: boolean
          match_config: Json
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          is_collective?: boolean
          is_paralympic?: boolean
          match_config?: Json
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          is_collective?: boolean
          is_paralympic?: boolean
          match_config?: Json
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sports_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      state_selection_callups: {
        Row: {
          called_up_at: string | null
          created_at: string
          event_id: string
          id: number
          national_ban_until: string | null
          participant_id: string
          selection_origin: string
          selection_percentage_group: string | null
          sport_event_id: string
          status: string
          updated_at: string
        }
        Insert: {
          called_up_at?: string | null
          created_at?: string
          event_id: string
          id?: number
          national_ban_until?: string | null
          participant_id: string
          selection_origin: string
          selection_percentage_group?: string | null
          sport_event_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          called_up_at?: string | null
          created_at?: string
          event_id?: string
          id?: number
          national_ban_until?: string | null
          participant_id?: string
          selection_origin?: string
          selection_percentage_group?: string | null
          sport_event_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_state_selection_callups_event"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_state_selection_callups_participant"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_state_selection_callups_participant"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "vw_person_logistics_consumption"
            referencedColumns: ["participant_id"]
          },
          {
            foreignKeyName: "fk_state_selection_callups_sport_event"
            columns: ["sport_event_id"]
            isOneToOne: false
            referencedRelation: "public_results_view"
            referencedColumns: ["sport_event_id"]
          },
          {
            foreignKeyName: "fk_state_selection_callups_sport_event"
            columns: ["sport_event_id"]
            isOneToOne: false
            referencedRelation: "sport_events"
            referencedColumns: ["id"]
          },
        ]
      }
      support_ticket_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          is_internal: boolean
          ticket_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          is_internal?: boolean
          ticket_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          is_internal?: boolean
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_comments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          assigned_to: string | null
          category: string
          context: Json
          created_at: string
          created_by: string
          current_url: string | null
          description: string
          event_id: string | null
          id: string
          priority: string
          reporter_email: string | null
          reporter_name: string | null
          resolution_notes: string | null
          resolved_at: string | null
          status: string
          subject: string
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          assigned_to?: string | null
          category?: string
          context?: Json
          created_at?: string
          created_by: string
          current_url?: string | null
          description: string
          event_id?: string | null
          id?: string
          priority?: string
          reporter_email?: string | null
          reporter_name?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          status?: string
          subject: string
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          assigned_to?: string | null
          category?: string
          context?: Json
          created_at?: string
          created_by?: string
          current_url?: string | null
          description?: string
          event_id?: string | null
          id?: string
          priority?: string
          reporter_email?: string | null
          reporter_name?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          status?: string
          subject?: string
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      system_config: {
        Row: {
          created_at: string
          id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      team_members: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          jersey_number: number | null
          participant_id: string
          role: string | null
          team_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          jersey_number?: number | null
          participant_id: string
          role?: string | null
          team_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          jersey_number?: number | null
          participant_id?: string
          role?: string | null
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "vw_person_logistics_consumption"
            referencedColumns: ["participant_id"]
          },
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          category_code: string | null
          created_at: string
          delegation_id: string
          event_id: string
          gender: string | null
          id: string
          name: string
          notes: string | null
          origin_scope_code: string | null
          qualified_from_phase_id: string | null
          qualified_rule_snapshot_json: Json | null
          seed_batch_id: string | null
          seed_tag: string | null
          sport_event_id: string
          status: string
          team_type: string | null
          updated_at: string
        }
        Insert: {
          category_code?: string | null
          created_at?: string
          delegation_id: string
          event_id: string
          gender?: string | null
          id?: string
          name: string
          notes?: string | null
          origin_scope_code?: string | null
          qualified_from_phase_id?: string | null
          qualified_rule_snapshot_json?: Json | null
          seed_batch_id?: string | null
          seed_tag?: string | null
          sport_event_id: string
          status?: string
          team_type?: string | null
          updated_at?: string
        }
        Update: {
          category_code?: string | null
          created_at?: string
          delegation_id?: string
          event_id?: string
          gender?: string | null
          id?: string
          name?: string
          notes?: string | null
          origin_scope_code?: string | null
          qualified_from_phase_id?: string | null
          qualified_rule_snapshot_json?: Json | null
          seed_batch_id?: string | null
          seed_tag?: string | null
          sport_event_id?: string
          status?: string
          team_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_delegation_id_fkey"
            columns: ["delegation_id"]
            isOneToOne: false
            referencedRelation: "delegations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_sport_event_id_fkey"
            columns: ["sport_event_id"]
            isOneToOne: false
            referencedRelation: "public_results_view"
            referencedColumns: ["sport_event_id"]
          },
          {
            foreignKeyName: "teams_sport_event_id_fkey"
            columns: ["sport_event_id"]
            isOneToOne: false
            referencedRelation: "sport_events"
            referencedColumns: ["id"]
          },
        ]
      }
      transport_passengers: {
        Row: {
          alighted_at: string | null
          alighted_by: string | null
          boarded_at: string | null
          boarded_by: string | null
          created_at: string
          id: string
          identity_photo_url: string | null
          is_manual: boolean
          manual_cpf: string | null
          manual_name: string | null
          no_show: boolean
          notes: string | null
          participant_id: string | null
          status: string
          trip_id: string
          updated_at: string
        }
        Insert: {
          alighted_at?: string | null
          alighted_by?: string | null
          boarded_at?: string | null
          boarded_by?: string | null
          created_at?: string
          id?: string
          identity_photo_url?: string | null
          is_manual?: boolean
          manual_cpf?: string | null
          manual_name?: string | null
          no_show?: boolean
          notes?: string | null
          participant_id?: string | null
          status?: string
          trip_id: string
          updated_at?: string
        }
        Update: {
          alighted_at?: string | null
          alighted_by?: string | null
          boarded_at?: string | null
          boarded_by?: string | null
          created_at?: string
          id?: string
          identity_photo_url?: string | null
          is_manual?: boolean
          manual_cpf?: string | null
          manual_name?: string | null
          no_show?: boolean
          notes?: string | null
          participant_id?: string | null
          status?: string
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transport_passengers_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_passengers_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "vw_person_logistics_consumption"
            referencedColumns: ["participant_id"]
          },
          {
            foreignKeyName: "transport_passengers_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "transport_trips"
            referencedColumns: ["id"]
          },
        ]
      }
      transport_routes: {
        Row: {
          created_at: string
          destination: string | null
          event_id: string
          event_stage_id: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          origin: string | null
          seed_batch_id: string | null
          seed_tag: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          destination?: string | null
          event_id: string
          event_stage_id?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          origin?: string | null
          seed_batch_id?: string | null
          seed_tag?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          destination?: string | null
          event_id?: string
          event_stage_id?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          origin?: string | null
          seed_batch_id?: string | null
          seed_tag?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transport_routes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_routes_event_stage_id_fkey"
            columns: ["event_stage_id"]
            isOneToOne: false
            referencedRelation: "event_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      transport_trips: {
        Row: {
          arrived_at: string | null
          assigned_driver_id: string | null
          created_at: string
          created_by: string | null
          departed_at: string | null
          driver_checked_in_at: string | null
          driver_name: string | null
          driver_phone: string | null
          event_id: string
          event_stage_id: string | null
          has_incidents: boolean
          id: string
          notes: string | null
          route_id: string
          scheduled_at: string | null
          seed_batch_id: string | null
          seed_tag: string | null
          status: string
          trip_status: string
          updated_at: string
          vehicle_id: string | null
        }
        Insert: {
          arrived_at?: string | null
          assigned_driver_id?: string | null
          created_at?: string
          created_by?: string | null
          departed_at?: string | null
          driver_checked_in_at?: string | null
          driver_name?: string | null
          driver_phone?: string | null
          event_id: string
          event_stage_id?: string | null
          has_incidents?: boolean
          id?: string
          notes?: string | null
          route_id: string
          scheduled_at?: string | null
          seed_batch_id?: string | null
          seed_tag?: string | null
          status?: string
          trip_status?: string
          updated_at?: string
          vehicle_id?: string | null
        }
        Update: {
          arrived_at?: string | null
          assigned_driver_id?: string | null
          created_at?: string
          created_by?: string | null
          departed_at?: string | null
          driver_checked_in_at?: string | null
          driver_name?: string | null
          driver_phone?: string | null
          event_id?: string
          event_stage_id?: string | null
          has_incidents?: boolean
          id?: string
          notes?: string | null
          route_id?: string
          scheduled_at?: string | null
          seed_batch_id?: string | null
          seed_tag?: string | null
          status?: string
          trip_status?: string
          updated_at?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transport_trips_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_trips_event_stage_id_fkey"
            columns: ["event_stage_id"]
            isOneToOne: false
            referencedRelation: "event_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_trips_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "transport_routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_trips_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "transport_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      transport_vehicles: {
        Row: {
          capacity: number
          created_at: string
          event_id: string
          event_stage_id: string | null
          id: string
          is_active: boolean
          label: string | null
          plate: string
          seed_batch_id: string | null
          seed_tag: string | null
          updated_at: string
          vehicle_type: string
        }
        Insert: {
          capacity?: number
          created_at?: string
          event_id: string
          event_stage_id?: string | null
          id?: string
          is_active?: boolean
          label?: string | null
          plate: string
          seed_batch_id?: string | null
          seed_tag?: string | null
          updated_at?: string
          vehicle_type?: string
        }
        Update: {
          capacity?: number
          created_at?: string
          event_id?: string
          event_stage_id?: string | null
          id?: string
          is_active?: boolean
          label?: string | null
          plate?: string
          seed_batch_id?: string | null
          seed_tag?: string | null
          updated_at?: string
          vehicle_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "transport_vehicles_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_vehicles_event_stage_id_fkey"
            columns: ["event_stage_id"]
            isOneToOne: false
            referencedRelation: "event_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      user_delegations: {
        Row: {
          created_at: string
          delegation_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          delegation_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          delegation_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_delegations_delegation_id_fkey"
            columns: ["delegation_id"]
            isOneToOne: false
            referencedRelation: "delegations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_sessions: {
        Row: {
          id: string
          ip_address: string | null
          login_at: string
          logout_at: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          id?: string
          ip_address?: string | null
          login_at?: string
          logout_at?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          id?: string
          ip_address?: string | null
          login_at?: string
          logout_at?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_sport_links: {
        Row: {
          created_at: string
          created_by: string | null
          event_id: string
          id: string
          sport_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          event_id: string
          id?: string
          sport_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          event_id?: string
          id?: string
          sport_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_sport_links_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_sport_links_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "public_results_view"
            referencedColumns: ["sport_id"]
          },
          {
            foreignKeyName: "user_sport_links_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
        ]
      }
      user_stage_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          created_at: string
          event_stage_id: string
          id: string
          notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          created_at?: string
          event_stage_id: string
          id?: string
          notes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          created_at?: string
          event_stage_id?: string
          id?: string
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_stage_assignments_event_stage_id_fkey"
            columns: ["event_stage_id"]
            isOneToOne: false
            referencedRelation: "event_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      venues: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          event_id: string
          event_stage_id: string
          id: string
          is_active: boolean
          name: string
          seed_batch_id: string | null
          seed_tag: string | null
          updated_at: string
          venue_type: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          event_id: string
          event_stage_id: string
          id?: string
          is_active?: boolean
          name: string
          seed_batch_id?: string | null
          seed_tag?: string | null
          updated_at?: string
          venue_type?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          event_id?: string
          event_stage_id?: string
          id?: string
          is_active?: boolean
          name?: string
          seed_batch_id?: string | null
          seed_tag?: string | null
          updated_at?: string
          venue_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "venues_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venues_event_stage_id_fkey"
            columns: ["event_stage_id"]
            isOneToOne: false
            referencedRelation: "event_stages"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      public_results_view: {
        Row: {
          bulletin_number: number | null
          bulletin_published_at: string | null
          bulletin_title: string | null
          category_name: string | null
          display_name: string | null
          distance_cm: number | null
          entry_type: string | null
          event_id: string | null
          event_name: string | null
          event_stage_id: string | null
          event_year: number | null
          institution_name: string | null
          match_date: string | null
          match_id: string | null
          match_number: number | null
          outcome: string | null
          points: number | null
          position: number | null
          result_status: string | null
          score: string | null
          sport_event_id: string | null
          sport_event_name: string | null
          sport_id: string | null
          sport_name: string | null
          start_time: string | null
          time_ms: number | null
          venue_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "competition_matches_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_participant_sport_history: {
        Row: {
          aggregated_stats_json: Json | null
          attempts_count: number | null
          best_attempt_cm: number | null
          best_attempt_ms: number | null
          best_attempt_points: number | null
          delegation_id: string | null
          delegation_name: string | null
          distance_cm: number | null
          entry_id: string | null
          event_id: string | null
          group_id: string | null
          group_name: string | null
          institution_id: string | null
          institution_name: string | null
          match_date: string | null
          match_id: string | null
          outcome: string | null
          participant_id: string | null
          participation_type: string | null
          penalties_count: number | null
          phase_id: string | null
          phase_name: string | null
          points: number | null
          position: number | null
          published_at: string | null
          result_id: string | null
          result_notes: string | null
          result_status: string | null
          result_text: string | null
          score: string | null
          sport_event_id: string | null
          sport_event_name: string | null
          team_id: string | null
          team_name: string | null
          time_ms: number | null
          validated_at: string | null
        }
        Relationships: []
      }
      vw_person_logistics_consumption: {
        Row: {
          cpf: string | null
          delegation_id: string | null
          delegation_name: string | null
          event_id: string | null
          full_name: string | null
          lodging_nights: number | null
          meals_consumed: number | null
          needs_lodging: boolean | null
          needs_meals: boolean | null
          needs_transport: boolean | null
          participant_id: string | null
          participant_type: string | null
          person_id: string | null
          transport_boardings: number | null
          voucher_uses_total: number | null
        }
        Relationships: [
          {
            foreignKeyName: "participants_delegation_id_fkey"
            columns: ["delegation_id"]
            isOneToOne: false
            referencedRelation: "delegations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participants_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      _seed_logistics_sede_code: {
        Args: { p_event_id: string }
        Returns: string
      }
      admin_deactivate_athlete_public_token: {
        Args: { p_athlete_id: string }
        Returns: undefined
      }
      admin_generate_qr: {
        Args: { p_entity_id: string; p_qr_type: string }
        Returns: Json
      }
      admin_list_users: {
        Args: never
        Returns: {
          active: boolean
          created_at: string
          full_name: string
          roles: string[]
          user_id: string
        }[]
      }
      admin_upsert_athlete_public_token: {
        Args: {
          p_athlete_id: string
          p_expires_at?: string
          p_rotate?: boolean
        }
        Returns: Json
      }
      check_phase_transitions: {
        Args: { p_sport_event_id: string }
        Returns: Json
      }
      clear_logistics_seed_all_stages: {
        Args: { p_event_id: string }
        Returns: Json
      }
      clear_logistics_seed_by_stage: {
        Args: { p_event_id: string }
        Returns: Json
      }
      create_alojamento_incident: {
        Args: {
          p_category: string
          p_created_by?: string
          p_description: string
          p_facility_id: string
          p_severity: string
        }
        Returns: undefined
      }
      find_duplicate_people: {
        Args: never
        Returns: {
          birth_date: string
          cpf: string
          created_at: string
          full_name: string
          group_key: string
          match_kind: string
          participants_count: number
          person_id: string
        }[]
      }
      generate_public_token: { Args: never; Returns: string }
      get_alojamento_duplicates: {
        Args: { p_facility_id: string }
        Returns: Json
      }
      get_alojamento_incidents: {
        Args: { p_facility_id: string; p_status?: string }
        Returns: Json
      }
      get_alojamento_kpis: { Args: { p_facility_id: string }; Returns: Json }
      get_alojamento_ocupacao: {
        Args: { p_facility_id: string }
        Returns: Json
      }
      get_alojamento_person_detail: {
        Args: { p_facility_id: string; p_participant_id: string }
        Returns: Json
      }
      get_athlete_public_profile: { Args: { p_token: string }; Returns: Json }
      get_blocking_irregularities: {
        Args: { p_event_id: string; p_participant_id: string }
        Returns: Json
      }
      get_event_participation_rules: {
        Args: { p_event_id: string }
        Returns: Json
      }
      get_group_standings: { Args: { p_group_id: string }; Returns: Json }
      get_participant_sport_history: {
        Args: { _participant_id: string }
        Returns: {
          aggregated_stats_json: Json | null
          attempts_count: number | null
          best_attempt_cm: number | null
          best_attempt_ms: number | null
          best_attempt_points: number | null
          delegation_id: string | null
          delegation_name: string | null
          distance_cm: number | null
          entry_id: string | null
          event_id: string | null
          group_id: string | null
          group_name: string | null
          institution_id: string | null
          institution_name: string | null
          match_date: string | null
          match_id: string | null
          outcome: string | null
          participant_id: string | null
          participation_type: string | null
          penalties_count: number | null
          phase_id: string | null
          phase_name: string | null
          points: number | null
          position: number | null
          published_at: string | null
          result_id: string | null
          result_notes: string | null
          result_status: string | null
          result_text: string | null
          score: string | null
          sport_event_id: string | null
          sport_event_name: string | null
          team_id: string | null
          team_name: string | null
          time_ms: number | null
          validated_at: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "vw_participant_sport_history"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_user_delegation_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      import_inscricoes_batch: { Args: { payload: Json }; Returns: Json }
      is_admin_or_secretaria: { Args: never; Returns: boolean }
      is_protected_user: { Args: { _user_id: string }; Returns: boolean }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      list_alojamento_facilities: { Args: never; Returns: Json }
      list_blocked_participants: {
        Args: { p_event_id: string }
        Returns: {
          participant_id: string
        }[]
      }
      merge_people: {
        Args: { p_drop_id: string; p_keep_id: string }
        Returns: Json
      }
      normalize_prova_slug: { Args: { p: string }; Returns: string }
      normalize_text: { Args: { p: string }; Returns: string }
      pesquisa_get_event_config: { Args: { p_event_id: string }; Returns: Json }
      pesquisa_hash_pin: { Args: { pin: string }; Returns: string }
      pesquisa_login_with_pin: {
        Args: { p_device_id: string; p_pin: string }
        Returns: Json
      }
      pesquisa_pwa_get_home: { Args: { p_session_id: string }; Returns: Json }
      pesquisa_pwa_list_recent: {
        Args: { p_limit?: number; p_session_id: string }
        Returns: Json
      }
      pesquisa_pwa_submit_survey: {
        Args: { p_payload: Json; p_session_id: string }
        Returns: Json
      }
      pesquisa_revoke_session: {
        Args: { p_session_id: string }
        Returns: undefined
      }
      pesquisa_touch_session: {
        Args: { p_session_id: string }
        Returns: undefined
      }
      pesquisa_verify_pin: {
        Args: { pin: string; pin_hash: string }
        Returns: boolean
      }
      pwa_assign_bed: {
        Args: {
          p_bed_token: string
          p_device_id: string
          p_person_token: string
        }
        Returns: Json
      }
      pwa_checkin: {
        Args: {
          p_device_id: string
          p_facility_id: string
          p_mode?: string
          p_token: string
        }
        Returns: Json
      }
      pwa_checkout: {
        Args: { p_device_id: string; p_facility_id: string; p_token: string }
        Returns: Json
      }
      pwa_search_person: {
        Args: { p_facility_id: string; p_limit?: number; p_query: string }
        Returns: Json
      }
      recompute_participation_irregularities: {
        Args: { p_event_id: string }
        Returns: Json
      }
      redeem_voucher: {
        Args: {
          p_context_id?: string
          p_qr_value: string
          p_service_kind: string
        }
        Returns: Json
      }
      refresh_sport_event_prova_map: {
        Args: { p_event_id: string }
        Returns: Json
      }
      reset_all_data: { Args: { p_confirm?: string }; Returns: Json }
      reset_demo: { Args: { p_event_id: string }; Returns: Json }
      resolve_import_alias: {
        Args: { _alias_norm: string; _event_id?: string; _kind: string }
        Returns: string
      }
      resolve_prova_slug: {
        Args: { p_event_id: string; p_prova_raw: string; p_sport_id: string }
        Returns: Json
      }
      resolve_qr: { Args: { p_token: string }; Returns: Json }
      rpc_build_preset_rules: { Args: { p_preset_key: string }; Returns: Json }
      rpc_can_regenerate_matches: {
        Args: { p_event_id: string; p_sport_event_id: string }
        Returns: Json
      }
      rpc_compute_ranking_simple: {
        Args: {
          p_event_id: string
          p_phase_id?: string
          p_sport_event_id: string
        }
        Returns: Json
      }
      rpc_compute_standings_score: {
        Args: {
          p_event_id: string
          p_group_id?: string
          p_phase_id?: string
          p_sport_event_id: string
        }
        Returns: Json
      }
      rpc_compute_standings_sets: {
        Args: {
          p_event_id: string
          p_group_id?: string
          p_phase_id?: string
          p_sport_event_id: string
        }
        Returns: Json
      }
      rpc_create_bulletin: {
        Args: { p_content_md?: string; p_event_id: string; p_title: string }
        Returns: Json
      }
      rpc_create_protest: {
        Args: {
          p_contact_email?: string
          p_contact_name?: string
          p_contact_phone?: string
          p_fundamentation: string
          p_match_id: string
          p_request: string
        }
        Returns: {
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          created_by: string
          deadline_at: string
          decided_at: string | null
          decided_by: string | null
          decision: string | null
          decision_reason: string | null
          delegation_id: string
          disciplinary_case_id: number | null
          event_id: string
          fundamentation: string
          id: string
          match_end_at: string | null
          match_id: string
          protocol_number: string
          request: string
          sport_event_id: string | null
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "protests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      rpc_decide_protest: {
        Args: {
          p_decision: string
          p_decision_reason: string
          p_new_status?: string
          p_protest_id: string
        }
        Returns: {
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          created_by: string
          deadline_at: string
          decided_at: string | null
          decided_by: string | null
          decision: string | null
          decision_reason: string | null
          delegation_id: string
          disciplinary_case_id: number | null
          event_id: string
          fundamentation: string
          id: string
          match_end_at: string | null
          match_id: string
          protocol_number: string
          request: string
          sport_event_id: string | null
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "protests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      rpc_detect_schedule_conflicts: {
        Args: { p_event_id: string; p_sport_event_id: string }
        Returns: Json
      }
      rpc_diff_rules_vs_truth: {
        Args: { p_event_id: string; p_payload: Json }
        Returns: Json
      }
      rpc_extract_match_outcome: { Args: { p_match_id: string }; Returns: Json }
      rpc_generate_groups: {
        Args: {
          p_event_id: string
          p_group_count: number
          p_phase_id: string
          p_seed_mode?: string
          p_sport_event_id: string
        }
        Returns: Json
      }
      rpc_generate_matches_collective: {
        Args: {
          p_event_id: string
          p_group_id?: string
          p_phase_id: string
          p_sport_event_id: string
        }
        Returns: Json
      }
      rpc_generate_matches_individual: {
        Args: {
          p_event_id: string
          p_heat_size?: number
          p_phase_id: string
          p_sport_event_id: string
        }
        Returns: Json
      }
      rpc_generate_matches_knockout: {
        Args: {
          p_event_id: string
          p_force?: boolean
          p_participants: Json
          p_phase_id: string
          p_seeding_mode?: string
          p_sport_event_id: string
        }
        Returns: Json
      }
      rpc_get_competition_summary: {
        Args: { p_event_id: string; p_sport_event_id: string }
        Returns: Json
      }
      rpc_get_group_points_rules: {
        Args: { p_sport_event_id: string }
        Returns: Json
      }
      rpc_get_knockout_bracket: { Args: { p_phase_id: string }; Returns: Json }
      rpc_get_rls_policies: { Args: never; Returns: Json }
      rpc_get_schema_columns: { Args: never; Returns: Json }
      rpc_get_schema_constraints: { Args: never; Returns: Json }
      rpc_get_schema_tables: { Args: never; Returns: Json }
      rpc_get_sport_event_rules: {
        Args: { p_event_id?: string; p_sport_event_id: string }
        Returns: Json
      }
      rpc_kpi_partidas_sem_resultado: {
        Args: { p_event_id: string }
        Returns: Json
      }
      rpc_kpi_provas_sem_partidas: {
        Args: { p_event_id: string }
        Returns: Json
      }
      rpc_launch_match_result: {
        Args: { p_event_id: string; p_match_id: string; p_payload: Json }
        Returns: Json
      }
      rpc_list_eligibility_pending: {
        Args: { p_event_id: string; p_sport_event_id: string }
        Returns: Json
      }
      rpc_publish_bulletin: { Args: { p_bulletin_id: string }; Returns: Json }
      rpc_publish_results_for_sport_event: {
        Args: {
          p_bulletin_id: string
          p_event_id: string
          p_sport_event_id: string
        }
        Returns: Json
      }
      rpc_reprocess_event: { Args: { p_event_id: string }; Returns: Json }
      rpc_reset_import_data: {
        Args: { p_event_id: string; p_force?: boolean; p_stage_id?: string }
        Returns: Json
      }
      rpc_resolve_import_alias: {
        Args: { p_event_id: string; p_input: string; p_kind: string }
        Returns: string
      }
      rpc_seed_sport_event_rules_for_event: {
        Args: { p_dry_run?: boolean; p_event_id: string; p_mode?: string }
        Returns: Json
      }
      rpc_sync_collective_teams: {
        Args: { p_event_id: string; p_sport_event_id?: string }
        Returns: Json
      }
      rpc_sync_match_scores_to_results: {
        Args: { p_match_id: string }
        Returns: Json
      }
      rpc_sync_rules_from_truth: {
        Args: { p_event_id: string; p_payload: Json }
        Returns: Json
      }
      rpc_upsert_sport_event_rules: {
        Args: {
          p_event_id: string
          p_is_active?: boolean
          p_rules: Json
          p_sport_event_id: string
        }
        Returns: undefined
      }
      rpc_validate_results_for_sport_event: {
        Args: { p_event_id: string; p_sport_event_id: string }
        Returns: Json
      }
      rpc_validate_sport_event_quorum: {
        Args: { p_event_id: string; p_sport_event_id: string }
        Returns: Json
      }
      seed_event_demo: { Args: { p_event_id: string }; Returns: Json }
      seed_jer_2026_core_rules: {
        Args: { p_event_id_text: string }
        Returns: undefined
      }
      seed_jer_2026_core_rules_v3: {
        Args: { p_event_id: string }
        Returns: Json
      }
      seed_jer_2026_sport_event_and_phase_rules_v21: {
        Args: { p_event_id: string }
        Returns: Json
      }
      seed_logistics_all_stages: { Args: { p_event_id: string }; Returns: Json }
      seed_logistics_by_stage: { Args: { p_event_id: string }; Returns: Json }
      seed_logistics_stage_template: {
        Args: { p_event_id: string; p_seed_tag?: string; p_stage_name?: string }
        Returns: Json
      }
      seed_logistics_template_to_all_stages: {
        Args: { p_event_id: string; p_source_stage_slug?: string }
        Returns: Json
      }
      unaccent: { Args: { "": string }; Returns: string }
      upsert_event_participation_rules: {
        Args: {
          p_event_id: string
          p_max_collective_teams_per_athlete: number
          p_max_events_per_individual_sport: number
          p_max_individual_sports_per_athlete: number
        }
        Returns: undefined
      }
      user_belongs_to_delegation: {
        Args: { _delegation_id: string; _user_id: string }
        Returns: boolean
      }
      user_can_access_stage: {
        Args: { _stage_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "secretaria"
        | "transporte"
        | "alimentacao"
        | "coordenacao_tecnica"
        | "delegacao"
        | "alojamento"
        | "arbitragem"
        | "cde"
        | "coordenador_modalidade"
        | "mesario"
        | "super_admin"
      incident_module: "transporte" | "alimentacao" | "alojamento" | "outro"
      incident_status: "pending" | "in_progress" | "resolved"
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
      app_role: [
        "admin",
        "secretaria",
        "transporte",
        "alimentacao",
        "coordenacao_tecnica",
        "delegacao",
        "alojamento",
        "arbitragem",
        "cde",
        "coordenador_modalidade",
        "mesario",
        "super_admin",
      ],
      incident_module: ["transporte", "alimentacao", "alojamento", "outro"],
      incident_status: ["pending", "in_progress", "resolved"],
    },
  },
} as const
