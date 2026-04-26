import { rawSupabase as supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];
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
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const userId = session.user.id;
      
      // Get user role if possible
      const { data: roleData } = await (supabase
        .from('user_roles' as any)
        .select('role')
        .eq('user_id', userId)
        .maybeSingle() as any);

      const userRole = roleData?.role;


      await (supabase.from('db_operation_logs' as any) as any).insert({
        user_id: userId,
        user_role: userRole,
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

