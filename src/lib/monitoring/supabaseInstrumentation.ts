import { dbTelemetry, DbOp } from "./dbTelemetry";
import type { PostgrestError } from "@supabase/supabase-js";

/**
 * Creates a fetch interceptor for Supabase to automatically log database operations.
 * This approach is type-safe as it doesn't modify the Supabase client methods.
 */
/**
 * Creates a fetch interceptor for Supabase with automatic retry logic and telemetry.
 */
export function createSupabaseFetchInterceptor(originalFetch: typeof fetch) {
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 1000; // 1 second

  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    let lastError: any;
    const url = typeof input === 'string' ? input : (input instanceof URL ? input.toString() : input.url);
    const isRestCall = url.includes('/rest/v1/');

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const response = await originalFetch(input, init);

        // Process telemetry in the background
        if (isRestCall) {
          handleRestTelemetry(url, init, response.clone(), attempt).catch(err => {
            console.error('[Telemetry] Failed to process REST telemetry:', err);
          });
        }

        // Retry on server errors (5xx) or rate limits (429)
        if (response.status >= 500 || response.status === 429) {
          if (attempt < MAX_RETRIES - 1) {
            const delay = RETRY_DELAY * Math.pow(2, attempt); // Exponential backoff
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
        }

        return response;
      } catch (err) {
        lastError = err;
        if (attempt < MAX_RETRIES - 1) {
          const delay = RETRY_DELAY * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }
    }

    throw lastError || new Error("Failed to fetch after multiple attempts");
  };
}

async function handleRestTelemetry(url: string, init: RequestInit | undefined, response: Response, retryCount: number = 0) {
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
      } catch (_e) {
        // Not JSON or empty response
      }
    } else {
      try {
        const errorData = await response.json();
        errorCode = errorData?.code || errorData?.message || String(response.status);
      } catch (_e) {
        errorCode = String(response.status);
      }
    }

    const moduleName = window.location.pathname.split('/').filter(Boolean).slice(0, 2).join('_').toUpperCase() || 'PWA_AUTO';

    await dbTelemetry.log({
      moduleName,
      tableName,
      operation,
      isSuccess,
      errorCode,
      rowsAffected,
      metadata: {
        method,
        timestamp: new Date().toISOString(),
        retry_count: retryCount,
        was_retried: retryCount > 0
      }
    });
  } catch (_error) {
    // Fail silently to not impact app performance
  }
}
