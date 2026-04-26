import { dbTelemetry, DbOp } from "./dbTelemetry";

/**
 * Instruments a Supabase client to automatically log SELECT, INSERT, UPDATE, and DELETE operations.
 */
export function instrumentSupabaseClient(client: any) {
  const originalFrom = client.from;

  client.from = function (tableName: string) {
    const builder = originalFrom.apply(this, [tableName]);

    // Skip telemetry for the log tables themselves to avoid infinite loops
    if (tableName === 'db_operation_logs' || tableName === 'audit_events') {
      return builder;
    }

    const wrapMethod = (originalMethod: any, operation: DbOp) => {
      return function (...args: any[]) {
        const resultBuilder = originalMethod.apply(this, args);

        // Intercept the execution of the query (which is thenable)
        const originalThen = resultBuilder.then;
        resultBuilder.then = function (onfulfilled: any, onrejected: any) {
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

              await dbTelemetry.log({
                moduleName: 'PWA_AUTO_INSTRUMENTATION',
                tableName,
                operation,
                isSuccess: !result.error,
                errorCode: result.error?.code,
                rowsAffected,
                metadata: {
                  // We avoid logging full data to save space/privacy
                  timestamp: new Date().toISOString(),
                  url: resultBuilder.url?.toString(),
                }
              });
            } catch (telemetryError) {
              console.error('[Telemetry] Failed to log database operation:', telemetryError);
            }

            if (onfulfilled) return onfulfilled(result);
            return result;
          }, onrejected);
        };

        return resultBuilder;
      };
    };

    // Override the main operation methods
    const originalSelect = builder.select;
    const originalInsert = builder.insert;
    const originalUpdate = builder.update;
    const originalDelete = builder.delete;

    if (typeof originalSelect === 'function') builder.select = wrapMethod(originalSelect, 'SELECT');
    if (typeof originalInsert === 'function') builder.insert = wrapMethod(originalInsert, 'INSERT');
    if (typeof originalUpdate === 'function') builder.update = wrapMethod(originalUpdate, 'UPDATE');
    if (typeof originalDelete === 'function') builder.delete = wrapMethod(originalDelete, 'DELETE');

    return builder;
  };

  return client;
}
