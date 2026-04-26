import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/integrations/supabase/types";
import { dbTelemetry, DbOp } from "./dbTelemetry";

/**
 * Instruments a Supabase client to automatically log SELECT, INSERT, UPDATE, and DELETE operations.
 */
export function instrumentSupabaseClient<T extends SupabaseClient<any>>(client: T): T {
  const originalFrom = client.from;

  client.from = function (tableName: string) {
    const builder = originalFrom.apply(this, [tableName]);

    // Skip telemetry for the log tables themselves to avoid infinite loops
    if (tableName === 'db_operation_logs' || tableName === 'audit_events') {
      return builder;
    }

    const wrapMethod = (originalMethod: any, operation: DbOp) => {
      if (typeof originalMethod !== 'function') return originalMethod;
      
      return function (this: any, ...args: any[]) {
        const resultBuilder = originalMethod.apply(this, args);

        // Intercept the execution of the query (which is thenable)
        const originalThen = resultBuilder.then;
        resultBuilder.then = function (this: any, onfulfilled: any, onrejected: any) {
          return originalThen.call(this, async (result: any) => {
            // Log the operation
            try {
              // Get rows affected from data if available
              let rowsAffected = 0;
              if (result.data) {
                if (Array.isArray(result.data)) {
                  rowsAffected = result.data.length;
                } else {
                  rowsAffected = 1;
                }
              } else if (result.count !== null && result.count !== undefined) {
                rowsAffected = result.count;
              }

              // Run telemetry asynchronously without blocking the main response
              dbTelemetry.log({
                moduleName: 'PWA_AUTO_INSTRUMENTATION',
                tableName,
                operation,
                isSuccess: !result.error,
                errorCode: result.error?.code,
                rowsAffected,
                metadata: {
                  timestamp: new Date().toISOString(),
                  // Avoid logging full URL or sensitive data if possible
                }
              }).catch(err => console.error('[Telemetry] Error logging:', err));
            } catch (telemetryError) {
              console.error('[Telemetry] Failed to process database operation for logging:', telemetryError);
            }

            if (onfulfilled) return onfulfilled(result);
            return result;
          }, onrejected);
        };

        return resultBuilder;
      };
    };

    // Override the main operation methods
    // We use property descriptors to keep types and avoid making them non-configurable if possible
    const methods: { name: keyof typeof builder, op: DbOp }[] = [
      { name: 'select', op: 'SELECT' },
      { name: 'insert', op: 'INSERT' },
      { name: 'update', op: 'UPDATE' },
      { name: 'delete', op: 'DELETE' }
    ];

    methods.forEach(({ name, op }) => {
      const originalMethod = (builder as any)[name];
      if (originalMethod) {
        (builder as any)[name] = wrapMethod(originalMethod, op);
      }
    });

    return builder;
  } as any;

  return client;
}
