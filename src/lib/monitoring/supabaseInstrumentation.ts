import { SupabaseClient } from "@supabase/supabase-js";
import { dbTelemetry, DbOp } from "./dbTelemetry";

/**
 * Instruments a Supabase client to automatically log SELECT, INSERT, UPDATE, and DELETE operations.
 * Uses Proxies to maintain type integrity and intercept method calls.
 */
export function instrumentSupabaseClient<T extends SupabaseClient<any>>(client: T): T {
  return new Proxy(client, {
    get(target, prop, receiver) {
      const originalValue = Reflect.get(target, prop, receiver);

      if (prop === 'from' && typeof originalValue === 'function') {
        return (...args: any[]) => {
          const tableName = args[0];
          const queryBuilder = originalValue.apply(target, args);

          // Skip telemetry for logging tables
          if (tableName === 'db_operation_logs' || tableName === 'audit_events') {
            return queryBuilder;
          }

          return instrumentQueryBuilder(queryBuilder, tableName);
        };
      }

      return typeof originalValue === 'function' ? originalValue.bind(target) : originalValue;
    }
  });
}

function instrumentQueryBuilder(builder: any, tableName: string) {
  return new Proxy(builder, {
    get(target, prop, receiver) {
      const originalValue = Reflect.get(target, prop, receiver);

      const methods: Record<string, DbOp> = {
        select: 'SELECT',
        insert: 'INSERT',
        update: 'UPDATE',
        delete: 'DELETE'
      };

      if (typeof prop === 'string' && methods[prop] && typeof originalValue === 'function') {
        return (...args: any[]) => {
          const result = originalValue.apply(target, args);
          return instrumentThenable(result, tableName, methods[prop as string]);
        };
      }

      return typeof originalValue === 'function' ? originalValue.bind(target) : originalValue;
    }
  });
}

function instrumentThenable(thenable: any, tableName: string, operation: DbOp) {
  // PostgrestFilterBuilder and others are thenable. 
  // We wrap the then method to intercept the result.
  const originalThen = thenable.then;

  thenable.then = function(onfulfilled?: any, onrejected?: any) {
    return originalThen.call(this, async (result: any) => {
      try {
        let rowsAffected = 0;
        if (result.data) {
          rowsAffected = Array.isArray(result.data) ? result.data.length : 1;
        } else if (result.count !== null && result.count !== undefined) {
          rowsAffected = result.count;
        }

        // Fire and forget telemetry
        dbTelemetry.log({
          moduleName: 'PWA_AUTO',
          tableName,
          operation,
          isSuccess: !result.error,
          errorCode: result.error?.code,
          rowsAffected,
          metadata: {
            timestamp: new Date().toISOString(),
          }
        }).catch(err => console.error('[Telemetry] Error:', err));
      } catch (e) {
        console.error('[Telemetry] Processing error:', e);
      }

      if (onfulfilled) return onfulfilled(result);
      return result;
    }, onrejected);
  };

  return thenable;
}
