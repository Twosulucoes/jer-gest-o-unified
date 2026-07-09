import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

export type RealtimeChangeEvent = "INSERT" | "UPDATE" | "DELETE" | "*";

export interface RealtimeTableWatch {
  table: string;
  event?: RealtimeChangeEvent;
  /** Filtro no formato `coluna=eq.valor` (mesma sintaxe do supabase-js). */
  filter?: string;
  schema?: string;
}

interface UseRealtimeSyncOptions {
  /** Nome do canal — inclua os ids de escopo (kit, janela, evento, etapa...) para não colidir com outras assinaturas. */
  channelName: string;
  /** Tabelas a observar. Precisam estar na publication `supabase_realtime` (ver supabase/migrations) — senão o canal nunca recebe nada. */
  tables: RealtimeTableWatch[];
  /** Chamado a cada mudança recebida (após o debounce, se houver). Refetch manual ou `queryClient.invalidateQueries` funcionam igual. */
  onChange: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void;
  enabled?: boolean;
  /** Coalesce rajadas de eventos (ex: vários scans em sequência) num único refetch. */
  debounceMs?: number;
}

/**
 * Hook genérico para sincronização em tempo real entre dispositivos: assina
 * `postgres_changes` em uma ou mais tabelas e dispara `onChange` para que a
 * tela dependente possa refazer o fetch (ou invalidar o cache do React
 * Query). Centraliza o boilerplate de channel/on/subscribe/removeChannel
 * repetido nas telas do PWA (alimentação, material) para os demais módulos.
 */
export function useRealtimeSync({
  channelName,
  tables,
  onChange,
  enabled = true,
  debounceMs = 0,
}: UseRealtimeSyncOptions) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const tablesKey = tables
    .map((t) => `${t.schema ?? "public"}:${t.table}:${t.event ?? "*"}:${t.filter ?? ""}`)
    .join("|");

  useEffect(() => {
    if (!enabled || tables.length === 0) return;

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const trigger = (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
      if (debounceMs <= 0) {
        onChangeRef.current(payload);
        return;
      }
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => onChangeRef.current(payload), debounceMs);
    };

    let channel = supabase.channel(channelName);
    for (const t of tables) {
      channel = channel.on(
        "postgres_changes",
        {
          event: t.event ?? "*",
          schema: t.schema ?? "public",
          table: t.table,
          ...(t.filter ? { filter: t.filter } : {}),
        } as any,
        trigger,
      );
    }
    channel.subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      void supabase.removeChannel(channel);
    };
    // tablesKey resume o conteúdo de `tables` — evita recriar o canal a cada render por causa de um array literal novo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelName, tablesKey, enabled, debounceMs]);
}
