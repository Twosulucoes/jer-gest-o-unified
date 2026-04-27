export type Json = any;
export interface Database { public: { Tables: Record<string, any>; Views: Record<string, any>; Functions: Record<string, any>; Enums: Record<string, any>; } }
export type Tables<T extends keyof Database["public"]["Tables"]> = any;
export type Enums<T extends keyof Database["public"]["Enums"]> = any;
