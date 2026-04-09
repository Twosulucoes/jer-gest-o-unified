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
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          name: string
          phase_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          name?: string
          phase_id?: string
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
          participant_sport_event_id: string
          seed: number | null
          side: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          match_id: string
          participant_sport_event_id: string
          seed?: number | null
          side?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          match_id?: string
          participant_sport_event_id?: string
          seed?: number | null
          side?: string
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
            foreignKeyName: "competition_match_entries_participant_sport_event_id_fkey"
            columns: ["participant_sport_event_id"]
            isOneToOne: false
            referencedRelation: "participant_sport_events"
            referencedColumns: ["id"]
          },
        ]
      }
      competition_match_results: {
        Row: {
          created_at: string
          id: string
          match_entry_id: string
          match_id: string
          notes: string | null
          position: number | null
          published_at: string | null
          published_by: string | null
          recorded_at: string
          recorded_by: string
          result_status: string
          result_text: string | null
          score: string | null
          updated_at: string
          validated_at: string | null
          validated_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          match_entry_id: string
          match_id: string
          notes?: string | null
          position?: number | null
          published_at?: string | null
          published_by?: string | null
          recorded_at?: string
          recorded_by: string
          result_status?: string
          result_text?: string | null
          score?: string | null
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          match_entry_id?: string
          match_id?: string
          notes?: string | null
          position?: number | null
          published_at?: string | null
          published_by?: string | null
          recorded_at?: string
          recorded_by?: string
          result_status?: string
          result_text?: string | null
          score?: string | null
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
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
        ]
      }
      competition_matches: {
        Row: {
          created_at: string
          event_id: string
          group_id: string | null
          id: string
          match_date: string | null
          match_number: number | null
          notes: string | null
          phase_id: string
          sport_event_id: string | null
          start_time: string | null
          status: string
          updated_at: string
          venue_id: string | null
        }
        Insert: {
          created_at?: string
          event_id: string
          group_id?: string | null
          id?: string
          match_date?: string | null
          match_number?: number | null
          notes?: string | null
          phase_id: string
          sport_event_id?: string | null
          start_time?: string | null
          status?: string
          updated_at?: string
          venue_id?: string | null
        }
        Update: {
          created_at?: string
          event_id?: string
          group_id?: string | null
          id?: string
          match_date?: string | null
          match_number?: number | null
          notes?: string | null
          phase_id?: string
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
          created_at: string
          event_id: string
          id: string
          name: string
          phase_type: string
          sort_order: number
          sport_event_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          name: string
          phase_type?: string
          sort_order?: number
          sport_event_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          name?: string
          phase_type?: string
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
      import_logs: {
        Row: {
          created_at: string
          error_message: string | null
          event_id: string
          file_name: string | null
          id: string
          performed_by: string
          result_summary: Json | null
          row_count: number | null
          status: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          event_id: string
          file_name?: string | null
          id?: string
          performed_by: string
          result_summary?: Json | null
          row_count?: number | null
          status?: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          event_id?: string
          file_name?: string | null
          id?: string
          performed_by?: string
          result_summary?: Json | null
          row_count?: number | null
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
          slug?: string
          state?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      lodging_locations: {
        Row: {
          address: string | null
          created_at: string
          event_id: string
          id: string
          is_active: boolean
          name: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          event_id: string
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          event_id?: string
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
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
            foreignKeyName: "lodging_occupancies_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
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
      lodging_units: {
        Row: {
          capacity: number
          created_at: string
          event_id: string
          gender_restriction: string
          id: string
          is_active: boolean
          location_id: string
          name: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          capacity?: number
          created_at?: string
          event_id: string
          gender_restriction?: string
          id?: string
          is_active?: boolean
          location_id: string
          name: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          capacity?: number
          created_at?: string
          event_id?: string
          gender_restriction?: string
          id?: string
          is_active?: boolean
          location_id?: string
          name?: string
          notes?: string | null
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
            foreignKeyName: "lodging_units_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "lodging_locations"
            referencedColumns: ["id"]
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
        ]
      }
      meal_types: {
        Row: {
          created_at: string
          event_id: string
          id: string
          is_active: boolean
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          is_active?: boolean
          name?: string
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
        ]
      }
      meal_windows: {
        Row: {
          created_at: string
          end_time: string
          event_id: string
          id: string
          is_active: boolean
          label: string | null
          location: string | null
          meal_type_id: string
          service_date: string
          start_time: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_time: string
          event_id: string
          id?: string
          is_active?: boolean
          label?: string | null
          location?: string | null
          meal_type_id: string
          service_date: string
          start_time: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_time?: string
          event_id?: string
          id?: string
          is_active?: boolean
          label?: string | null
          location?: string | null
          meal_type_id?: string
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
            foreignKeyName: "meal_windows_meal_type_id_fkey"
            columns: ["meal_type_id"]
            isOneToOne: false
            referencedRelation: "meal_types"
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
          event_id: string
          external_participant_id: string | null
          external_registration_id: string | null
          external_system: string
          id: string
          issued_at: string | null
          issued_by: string | null
          last_validated_at: string | null
          participant_id: string
          qr_code_value: string
          raw_payload: Json | null
          revoked_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          activated_at?: string | null
          activated_by?: string | null
          binding_source?: string
          created_at?: string
          credential_code: string
          event_id: string
          external_participant_id?: string | null
          external_registration_id?: string | null
          external_system?: string
          id?: string
          issued_at?: string | null
          issued_by?: string | null
          last_validated_at?: string | null
          participant_id: string
          qr_code_value: string
          raw_payload?: Json | null
          revoked_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          activated_at?: string | null
          activated_by?: string | null
          binding_source?: string
          created_at?: string
          credential_code?: string
          event_id?: string
          external_participant_id?: string | null
          external_registration_id?: string | null
          external_system?: string
          id?: string
          issued_at?: string | null
          issued_by?: string | null
          last_validated_at?: string | null
          participant_id?: string
          qr_code_value?: string
          raw_payload?: Json | null
          revoked_at?: string | null
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
        ]
      }
      participant_sport_events: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          participant_id: string
          sport_event_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          participant_id: string
          sport_event_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          participant_id?: string
          sport_event_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "participant_sport_events_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
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
          created_at: string
          credentialed_at: string | null
          credentialed_by: string | null
          delegation_id: string
          event_id: string
          id: string
          is_active: boolean
          notes: string | null
          participant_type: string
          person_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          credentialed_at?: string | null
          credentialed_by?: string | null
          delegation_id: string
          event_id: string
          id?: string
          is_active?: boolean
          notes?: string | null
          participant_type?: string
          person_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          credentialed_at?: string | null
          credentialed_by?: string | null
          delegation_id?: string
          event_id?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          participant_type?: string
          person_id?: string
          status?: string
          updated_at?: string
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
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
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
      transport_passengers: {
        Row: {
          alighted_at: string | null
          alighted_by: string | null
          boarded_at: string | null
          boarded_by: string | null
          created_at: string
          id: string
          notes: string | null
          participant_id: string
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
          notes?: string | null
          participant_id: string
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
          notes?: string | null
          participant_id?: string
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
          id: string
          is_active: boolean
          name: string
          notes: string | null
          origin: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          destination?: string | null
          event_id: string
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          origin?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          destination?: string | null
          event_id?: string
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          origin?: string | null
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
        ]
      }
      transport_trips: {
        Row: {
          arrived_at: string | null
          created_at: string
          created_by: string | null
          departed_at: string | null
          driver_name: string | null
          driver_phone: string | null
          event_id: string
          id: string
          notes: string | null
          route_id: string
          scheduled_at: string | null
          status: string
          updated_at: string
          vehicle_id: string | null
        }
        Insert: {
          arrived_at?: string | null
          created_at?: string
          created_by?: string | null
          departed_at?: string | null
          driver_name?: string | null
          driver_phone?: string | null
          event_id: string
          id?: string
          notes?: string | null
          route_id: string
          scheduled_at?: string | null
          status?: string
          updated_at?: string
          vehicle_id?: string | null
        }
        Update: {
          arrived_at?: string | null
          created_at?: string
          created_by?: string | null
          departed_at?: string | null
          driver_name?: string | null
          driver_phone?: string | null
          event_id?: string
          id?: string
          notes?: string | null
          route_id?: string
          scheduled_at?: string | null
          status?: string
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
          id: string
          is_active: boolean
          label: string | null
          plate: string
          updated_at: string
          vehicle_type: string
        }
        Insert: {
          capacity?: number
          created_at?: string
          event_id: string
          id?: string
          is_active?: boolean
          label?: string | null
          plate: string
          updated_at?: string
          vehicle_type?: string
        }
        Update: {
          capacity?: number
          created_at?: string
          event_id?: string
          id?: string
          is_active?: boolean
          label?: string | null
          plate?: string
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
      venues: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          event_id: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
          venue_type: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          event_id: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
          venue_type?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          event_id?: string
          id?: string
          is_active?: boolean
          name?: string
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
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      import_inscricoes_batch: { Args: { payload: Json }; Returns: Json }
    }
    Enums: {
      app_role:
        | "admin"
        | "secretaria"
        | "transporte"
        | "alimentacao"
        | "coordenacao_tecnica"
        | "delegacao"
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
      ],
    },
  },
} as const
