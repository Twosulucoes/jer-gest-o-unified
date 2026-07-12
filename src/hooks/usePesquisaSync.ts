import { useEffect, useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getQueue, saveQueue, getSession } from '@/lib/pesquisaSession';

export function usePesquisaSync() {
  const [pendingCount, setPendingCount] = useState(getQueue().length);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const syncQueue = useCallback(async () => {
    const session = getSession();
    if (!session) return;

    const queue = getQueue();
    if (queue.length === 0) return;

    const remaining = [...queue];
    let changed = false;

    // Itera sobre um snapshot estável: o loop remove itens sincronizados de `remaining`
    // via splice, e iterar diretamente sobre o array que está sendo mutado pularia itens.
    for (const item of [...remaining]) {
      try {
        const { data, error } = await supabase.rpc('pesquisa_pwa_submit_survey', {
          p_session_id: session.session_id,
          p_payload: item.payload as any,
        });
        if (error) throw error;
        const result = data as any;
        if (result?.error === 'SESSION_INVALID') {
          // Don't retry if session is invalid
          break;
        }
        // 'created' | 'duplicate' -> sucesso. 'invalid' -> payload rejeitado pelo
        // servidor (nunca vai passar): descarta em vez de reenviar pra sempre.
        const idx = remaining.indexOf(item);
        remaining.splice(idx, 1);
        changed = true;
        if (result?.status === 'invalid') {
          console.error('[pesquisa] item descartado (invalid):', result?.reason, item.client_uuid);
        }
      } catch (err: any) {
        item.attempts += 1;
        item.last_error = err.message || 'Unknown error';
        // Backstop: descarta após muitas tentativas para não travar a fila.
        if (item.attempts >= 25) {
          const idx = remaining.indexOf(item);
          if (idx >= 0) remaining.splice(idx, 1);
        }
        changed = true;
      }
    }

    if (changed) {
      saveQueue(remaining);
      setPendingCount(remaining.length);
    }
  }, []);

  useEffect(() => {
    const handleOnline = () => { setIsOnline(true); syncQueue(); };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial sync
    syncQueue();

    // Periodic sync every 30s
    const interval = setInterval(() => {
      if (navigator.onLine) syncQueue();
    }, 30000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [syncQueue]);

  return { isOnline, pendingCount, syncQueue };
}
