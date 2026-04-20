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
  const cancelRef = useRef(false);

  const filtersKey = JSON.stringify(baseFilters);
  const statusKey = (statusIn ?? []).join(",");
  const scopeKey = participantIdsScope?.length ?? -1;

  useEffect(() => {
    cancelRef.current = false;
    setData([]);
    setFirstPageReady(false);
    setIsBackgroundLoading(false);
    setError(null);

    if (!enabled || !eventId) return;
    // Quando há scope mas vazio, retorna imediatamente
    if (participantIdsScope && participantIdsScope.length === 0) {
      setFirstPageReady(true);
      return;
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
        // Sem scope: 1 bucket (null). Com scope: chunks de CHUNK_IN ids.
        const buckets: (string[] | null)[] = participantIdsScope
          ? Array.from(
              { length: Math.ceil(participantIdsScope.length / CHUNK_IN) },
              (_, i) => participantIdsScope.slice(i * CHUNK_IN, (i + 1) * CHUNK_IN),
            )
          : [null];

        let isFirst = true;

        for (const ids of buckets) {
          let from = 0;
          // eslint-disable-next-line no-constant-condition
          while (true) {
            if (cancelRef.current) return;
            let q = buildBase();
            if (ids) q = q.in("id", ids);
            const { data: rows, error: err } = await q
              .order(orderBy, { ascending: true })
              .range(from, from + PAGE - 1);
            if (err) throw err;
            const list = (rows ?? []) as T[];
            if (list.length > 0) {
              setData((prev) => prev.concat(list));
            }
            if (isFirst) {
              isFirst = false;
              setFirstPageReady(true);
            }
            if (list.length < PAGE) break;
            from += PAGE;
          }
        }

        setFirstPageReady(true);
      } catch (e: any) {
        if (!cancelRef.current) setError(e);
      } finally {
        if (!cancelRef.current) setIsBackgroundLoading(false);
      }
    };

    run();

    return () => {
      cancelRef.current = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, cacheKey, filtersKey, statusKey, scopeKey, enabled]);

  return { data, firstPageReady, isBackgroundLoading, error };
}
