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
          created_at: string
          distance_cm: number | null
          id: string
          match_entry_id: string
          match_id: string
          notes: string | null
          outcome: string | null
          penalty_notes: string | null
          points: number | null
          position: number | null
          published_at: string | null
          published_bulletin_id: string | null
          published_by: string | null
          recorded_at: string
          recorded_by: string
          result_status: string
          result_text: string | null
          score: string | null
          seed_batch_id: string | null
          seed_tag: string | null
          time_ms: number | null
          updated_at: string
          validated_at: string | null
          validated_by: string | null
        }
        Insert: {
          created_at?: string
          distance_cm?: number | null
          id?: string
          match_entry_id: string
          match_id: string
          notes?: string | null
          outcome?: string | null
          penalty_notes?: string | null
          points?: number | null
          position?: number | null
          published_at?: string | null
          published_bulletin_id?: string | null
          published_by?: string | null
          recorded_at?: string
          recorded_by: string
          result_status?: string
          result_text?: string | null
          score?: string | null
          seed_batch_id?: string | null
          seed_tag?: string | null
          time_ms?: number | null
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Update: {
          created_at?: string
          distance_cm?: number | null
          id?: string
          match_entry_id?: string
          match_id?: string
          notes?: string | null
          outcome?: string | null
          penalty_notes?: string | null
          points?: number | null
          position?: number | null
          published_at?: string | null
          published_bulletin_id?: string | null
          published_by?: string | null
          recorded_at?: string
          recorded_by?: string
          result_status?: string
          result_text?: string | null
          score?: string | null
          seed_batch_id?: string | null
          seed_tag?: string | null
          time_ms?: number | null
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
          bracket_config: Json
          created_at: string
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
          bracket_config?: Json
          created_at?: string
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
          bracket_config?: Json
          created_at?: string
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
      event_participation_rules: {
        Row: {
          created_at: string
          created_by: string | null
          event_id: string
          max_collective_teams_per_athlete: number
          max_events_per_individual_sport: number
          max_individual_sports_per_athlete: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          event_id: string
          max_collective_teams_per_athlete?: number
          max_events_per_individual_sport?: number
          max_individual_sports_per_athlete?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          event_id?: string
          max_collective_teams_per_athlete?: number
          max_events_per_individual_sport?: number
          max_individual_sports_per_athlete?: number
          updated_at?: string
          updated_by?: string | null
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
      lodging_locations: {
        Row: {
          address: string | null
          created_at: string
          event_id: string
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
          seed_batch_id: string | null
          seed_tag: string | null
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
          seed_batch_id?: string | null
          seed_tag?: string | null
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
          seed_batch_id: string | null
          seed_tag: string | null
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
          seed_batch_id?: string | null
          seed_tag?: string | null
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
            foreignKeyName: "meal_windows_meal_type_id_fkey"
            columns: ["meal_type_id"]
            isOneToOne: false
            referencedRelation: "meal_types"
            referencedColumns: ["id"]
          },
        ]
      }
      official_bulletins: {
        Row: {
          content_md: string
          created_at: string
          created_by: string | null
          event_id: string
          id: string
          number: number
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
          seed_batch_id: string | null
          seed_tag: string | null
          sport_event_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          participant_id: string
          seed_batch_id?: string | null
          seed_tag?: string | null
          sport_event_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          participant_id?: string
          seed_batch_id?: string | null
          seed_tag?: string | null
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
          seed_batch_id: string | null
          seed_tag: string | null
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
          seed_batch_id?: string | null
          seed_tag?: string | null
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
          seed_batch_id?: string | null
          seed_tag?: string | null
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
          id: string
          location: string | null
          name: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          event_date?: string | null
          id?: string
          location?: string | null
          name: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          event_date?: string | null
          id?: string
          location?: string | null
          name?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      pesquisa_researchers: {
        Row: {
          active: boolean
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
          created_at: string
          created_by: string | null
          event_id: string | null
          id: string
          is_active: boolean
          rules: Json
          rules_version: number
          sport_event_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          event_id?: string | null
          id?: string
          is_active?: boolean
          rules?: Json
          rules_version?: number
          sport_event_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          event_id?: string | null
          id?: string
          is_active?: boolean
          rules?: Json
          rules_version?: number
          sport_event_id?: string
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
          created_at: string
          delegation_id: string
          event_id: string
          id: string
          name: string
          notes: string | null
          seed_batch_id: string | null
          seed_tag: string | null
          sport_event_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          delegation_id: string
          event_id: string
          id?: string
          name: string
          notes?: string | null
          seed_batch_id?: string | null
          seed_tag?: string | null
          sport_event_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          delegation_id?: string
          event_id?: string
          id?: string
          name?: string
          notes?: string | null
          seed_batch_id?: string | null
          seed_tag?: string | null
          sport_event_id?: string
          status?: string
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
          seed_batch_id: string | null
          seed_tag: string | null
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
          seed_batch_id?: string | null
          seed_tag?: string | null
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
          seed_batch_id: string | null
          seed_tag: string | null
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
          seed_batch_id?: string | null
          seed_tag?: string | null
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
          seed_batch_id?: string | null
          seed_tag?: string | null
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
          seed_batch_id: string | null
          seed_tag: string | null
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
          seed_batch_id?: string | null
          seed_tag?: string | null
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
      venues: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          event_id: string
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
    }
    Functions: {
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
      list_blocked_participants: {
        Args: { p_event_id: string }
        Returns: {
          participant_id: string
        }[]
      }
      normalize_prova_slug: { Args: { p: string }; Returns: string }
      normalize_text: { Args: { p: string }; Returns: string }
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
      recompute_participation_irregularities: {
        Args: { p_event_id: string }
        Returns: Json
      }
      refresh_sport_event_prova_map: {
        Args: { p_event_id: string }
        Returns: Json
      }
      reset_all_data: { Args: { p_confirm?: string }; Returns: Json }
      reset_demo: { Args: { p_event_id: string }; Returns: Json }
      resolve_prova_slug: {
        Args: { p_event_id: string; p_prova_raw: string; p_sport_id: string }
        Returns: Json
      }
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
      rpc_detect_schedule_conflicts: {
        Args: { p_event_id: string; p_sport_event_id: string }
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
      rpc_seed_sport_event_rules_for_event: {
        Args: { p_dry_run?: boolean; p_event_id: string; p_mode?: string }
        Returns: Json
      }
      rpc_sync_collective_teams: {
        Args: { p_event_id: string; p_sport_event_id?: string }
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
      seed_event_demo: { Args: { p_event_id: string }; Returns: Json }
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
