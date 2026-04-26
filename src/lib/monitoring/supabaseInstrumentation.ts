import { dbTelemetry, DbOp } from "./dbTelemetry";

/**
 * Creates a fetch interceptor for Supabase to automatically log database operations.
 * This approach is type-safe as it doesn't modify the Supabase client methods.
 */
export function createSupabaseFetchInterceptor(originalFetch: typeof fetch) {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const response = await originalFetch(input, init);
    
    // We only care about REST calls to the database
    const url = typeof input === 'string' ? input : (input instanceof URL ? input.toString() : input.url);
    
    if (url.includes('/rest/v1/')) {
      // Process telemetry in the background
      handleRestTelemetry(url, init, response.clone()).catch(err => {
        console.error('[Telemetry] Failed to process REST telemetry:', err);
      });
    }

    return response;
  };
}

async function handleRestTelemetry(url: string, init: RequestInit | undefined, response: Response) {
  try {
    // 1. Extract table name
    // URL format: .../rest/v1/table_name?query_params
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    const tableName = pathParts[pathParts.length - 1];

    // Skip telemetry for logging tables
    if (tableName === 'db_operation_logs' || tableName === 'audit_events' || tableName === 'rpc') {
      return;
    }

    // 2. Determine operation
    const method = init?.method?.toUpperCase() || 'GET';
    let operation: DbOp = 'SELECT';
    if (method === 'POST') {
      // Check if it's an insert or an RPC call disguised as POST (though we skip rpc above)
      operation = 'INSERT';
    } else if (method === 'PATCH') {
      operation = 'UPDATE';
    } else if (method === 'DELETE') {
      operation = 'DELETE';
    } else if (method === 'GET') {
      operation = 'SELECT';
    }

    // 3. Get response details
    let isSuccess = response.ok;
    let errorCode: string | undefined;
    let rowsAffected = 0;

    if (response.ok) {
      try {
        const data = await response.json();
        if (Array.isArray(data)) {
          rowsAffected = data.length;
        } else if (data && typeof data === 'object') {
          rowsAffected = 1;
        }
      } catch (e) {
        // Not JSON or empty response
      }
    } else {
      try {
        const errorData = await response.json();
        errorCode = errorData?.code || errorData?.message || String(response.status);
      } catch (e) {
        errorCode = String(response.status);
      }
    }

    // 4. Log to telemetry
    await dbTelemetry.log({
      moduleName: 'PWA_AUTO_FETCH',
      tableName,
      operation,
      isSuccess,
      errorCode,
      rowsAffected,
      metadata: {
        method,
        timestamp: new Date().toISOString(),
      }
    });
  } catch (error) {
    // Fail silently to not impact app performance
  }
}
