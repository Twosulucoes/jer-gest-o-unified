import { supabase } from "@/integrations/supabase/client";
import { AppRole } from "@/types/auth";

export type DbOp = 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE';

interface TelemetryParams {
  moduleName: string;
  tableName: string;
  operation: DbOp;
  eventId?: string;
  isSuccess: boolean;
  errorCode?: string;
  rowsAffected?: number;
  metadata?: any;
}

export const dbTelemetry = {
  log: async ({
    moduleName,
    tableName,
    operation,
    eventId,
    isSuccess,
    errorCode,
    rowsAffected = 0,
    metadata = {}
  }: TelemetryParams) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get user role if possible (optional, can be done on server side too if we want, 
      // but let's try to get it from local storage or session if available to save a query)
      // For now, we'll let the database handle it if we used a trigger, 
      // but since we want to be explicit:
      
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      await supabase.from('db_operation_logs').insert({
        user_id: user.id,
        user_role: roleData?.role as AppRole,
        module_name: moduleName,
        table_name: tableName,
        operation,
        event_id: eventId,
        is_success: isSuccess,
        error_code: errorCode,
        rows_affected: rowsAffected,
        metadata
      });
    } catch (error) {
      // Don't let telemetry errors break the app
      console.error('Failed to log telemetry:', error);
    }
  }
};
