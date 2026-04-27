export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      credential_scans: {
        Row: {
          credential_id: string
          event_id: string
          id: string
          legacy_format: boolean
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
          legacy_format?: boolean
          notes?: string | null
          scan_point?: string
          scan_result: string
          scanned_at?: string
          scanned_by: string
        }
        Update: {
          credential_id?: string
          event_id?: string
          id?: string
          legacy_format?: boolean
          notes?: string | null
          scan_point?: string
          scan_result?: string
          scanned_at?: string
          scanned_by?: string
        }
      }
      lodging_occupancies: {
        Row: {
          allocated_at: string
          allocated_by: string | null
          checked_in_at: string | null
          checked_out_at: string | null
          event_id: string
          id: string
          participant_id: string
          status: string
          unit_id: string
        }
        Insert: {
          allocated_at?: string
          allocated_by?: string | null
          checked_in_at?: string | null
          checked_out_at?: string | null
          event_id: string
          id?: string
          participant_id: string
          status?: string
          unit_id: string
        }
        Update: {
          allocated_at?: string
          allocated_by?: string | null
          checked_in_at?: string | null
          checked_out_at?: string | null
          event_id?: string
          id?: string
          participant_id?: string
          status?: string
          unit_id?: string
        }
      }
      participants: { Row: any; Insert: any; Update: any }
      delegations: { Row: any; Insert: any; Update: any }
      lodging_units: { Row: any; Insert: any; Update: any }
      lodging_locations: { Row: any; Insert: any; Update: any }
      events: { Row: any; Insert: any; Update: any }
      categories: { Row: any; Insert: any; Update: any }
      institutions: { Row: any; Insert: any; Update: any }
      meal_types: { Row: any; Insert: any; Update: any }
      transport_routes: { Row: any; Insert: any; Update: any }
      sports: { Row: any; Insert: any; Update: any }
      transport_vehicles: { Row: any; Insert: any; Update: any }
      venues: { Row: any; Insert: any; Update: any }
      meal_window_eligibility: { Row: any; Insert: any; Update: any }
      operational_evidence: { Row: any; Insert: any; Update: any }
      meal_locations: { Row: any; Insert: any; Update: any }
      credential_templates: { Row: any; Insert: any; Update: any }
      meal_windows: { Row: any; Insert: any; Update: any }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      rpc_allocate_lodging_batch: {
        Args: {
          p_event_id: string
          p_delegation_id: string
          p_allocations: Json
          p_allocated_by?: string
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
  }
}

export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"]
export type Enums<T extends keyof Database["public"]["Enums"]> = Database["public"]["Enums"][T]
