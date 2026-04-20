import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const PAGE = 1000;
const CHUNK_IN = 300;

interface Options {
  eventId: string | null | undefined;
  select: string;
  /** Filtros adicionais (eq) aplicados em toda a query */
  baseFilters?: { column: string; value: any }[];
  /** Filtro de status .in("status", [...]) */
  statusIn?: string[];
  /** is_active = true */
  onlyActive?: boolean;
  /** Quando definido, a query pagina e aplica .in("id", chunk) em cada slice */
  participantIdsScope?: string[] | null;
  /** Coluna usada no .order() */
  orderBy?: string;
  /** Identificador para a chave de cache/reset */
  cacheKey: string;
  /** Quando false, não dispara fetches */
  enabled?: boolean;
}

/**
 * Carrega participantes em páginas de 1000, expondo a primeira página
 * imediatamente (firstPageReady) e continuando em segundo plano.
 *
 * Estratégia: ao invés de aguardar um Promise.all gigante, mantemos um estado
 * acumulador `data` que cresce a cada página. UI pode renderizar assim que
 * `firstPageReady` for true (≤ 1000 linhas) enquanto `isBackgroundLoading`
 * indica que mais dados estão a caminho.
 */
export function useProgressiveParticipants<T = any>(opts: Options) {
  const {
    eventId,
    select,
    baseFilters = [],
    statusIn,
    onlyActive = true,
    participantIdsScope,
    orderBy = "id",
    cacheKey,
    enabled = true,
  } = opts;

  const [data, setData] = useState<T[]>([]);
  const [firstPageReady, setFirstPageReady] = useState(false);
  const [isBackgroundLoading, setIsBackgroundLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const filtersKey = JSON.stringify(baseFilters);
  const statusKey = (statusIn ?? []).join(",");
  const scopeKey = participantIdsScope?.length ?? -1;

  useEffect(() => {
    // Cada execução do efeito tem seu próprio token de cancelamento.
    // IMPORTANTE: não usar uma única ref compartilhada entre execuções,
    // pois o reset (cancelRef.current = false) do novo efeito permitiria
    // que requisições em voo do efeito anterior continuassem populando
    // o estado — causando DUPLICAÇÃO dos números.
    const token = { cancelled: false };

    setData([]);
    setFirstPageReady(false);
    setIsBackgroundLoading(false);
    setError(null);

    if (!enabled || !eventId) return () => { token.cancelled = true; };
    // Quando há scope mas vazio, retorna imediatamente
    if (participantIdsScope && participantIdsScope.length === 0) {
      setFirstPageReady(true);
      return () => { token.cancelled = true; };
    }

    const run = async () => {
      try {
        setIsBackgroundLoading(true);

        const buildBase = () => {
          let q = (supabase.from("participants") as any).select(select).eq("event_id", eventId);
          if (onlyActive) q = q.eq("is_active", true);
          if (statusIn && statusIn.length) q = q.in("status", statusIn);
          for (const f of baseFilters) q = q.eq(f.column, f.value);
          return q;
        };

        // Define lista de "buckets" a paginar.
        // Sem scope: 1 bucket (null). Com scope: chunks de CHUNK_IN ids
        // (deduplicados defensivamente por garantia).
        const dedupedScope = participantIdsScope
          ? Array.from(new Set(participantIdsScope))
          : null;
        const buckets: (string[] | null)[] = dedupedScope
          ? Array.from(
              { length: Math.ceil(dedupedScope.length / CHUNK_IN) },
              (_, i) => dedupedScope.slice(i * CHUNK_IN, (i + 1) * CHUNK_IN),
            )
          : [null];

        let isFirst = true;
        // Set para deduplicar entre páginas/buckets — proteção extra contra
        // quaisquer linhas repetidas vindas do banco/RLS.
        const seenIds = new Set<string>();

        for (const ids of buckets) {
          let from = 0;
          // eslint-disable-next-line no-constant-condition
          while (true) {
            if (token.cancelled) return;
            let q = buildBase();
            if (ids) q = q.in("id", ids);
            const { data: rows, error: err } = await q
              .order(orderBy, { ascending: true })
              .range(from, from + PAGE - 1);
            if (token.cancelled) return;
            if (err) throw err;
            const list = (rows ?? []) as T[];
            const fresh = list.filter((row: any) => {
              const id = row?.id;
              if (!id) return true;
              if (seenIds.has(id)) return false;
              seenIds.add(id);
              return true;
            });
            if (fresh.length > 0) {
              setData((prev) => prev.concat(fresh));
            }
            if (isFirst) {
              isFirst = false;
              setFirstPageReady(true);
            }
            if (list.length < PAGE) break;
            from += PAGE;
          }
        }

        if (!token.cancelled) setFirstPageReady(true);
      } catch (e: any) {
        if (!token.cancelled) setError(e);
      } finally {
        if (!token.cancelled) setIsBackgroundLoading(false);
      }
    };

    run();

    return () => {
      token.cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, cacheKey, filtersKey, statusKey, scopeKey, enabled]);

  return { data, firstPageReady, isBackgroundLoading, error };
}
