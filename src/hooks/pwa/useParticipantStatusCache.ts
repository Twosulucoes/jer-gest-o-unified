import { useEffect, useRef, useState } from "react";
import {
  cacheIsStale,
  getCacheAge,
  populateParticipantCache,
  lookupByCredentialCode,
  searchParticipantsOffline,
  type OfflineLookupResult,
  type ParticipantCacheEntry,
} from "@/lib/participantStatusCache";
import { extractCandidates } from "@/lib/resolveQrCredential";

interface UsePscOptions {
  /** ID do evento ativo. Nada acontece se null. */
  eventId: string | null;
  /** Se false, não tenta popular o cache (ex.: usuário offline na abertura). */
  online?: boolean;
}

interface UsePscReturn {
  /** Cache pronto e não expirado */
  cacheReady: boolean;
  /** Milissegundos desde a última atualização do cache */
  cacheAgeMs: number | null;
  /** Força repopulação imediata */
  refreshCache: () => Promise<void>;
  /** Verifica o estado do participante pelo valor bruto do QR (offline-aware) */
  lookupQr: (rawValue: string) => OfflineLookupResult;
  /** Busca participantes por nome/CPF no cache (offline) */
  searchOffline: (query: string) => ParticipantCacheEntry[];
}

/**
 * Gerencia o cache de status de participantes para uso offline em campo.
 *
 * Popula automaticamente quando online e o cache está expirado.
 * Atualiza silenciosamente em background quando há conectividade.
 */
export function useParticipantStatusCache({
  eventId,
  online = true,
}: UsePscOptions): UsePscReturn {
  const [cacheReady, setCacheReady] = useState<boolean>(
    eventId ? !cacheIsStale(eventId) : false,
  );
  const [cacheAgeMs, setCacheAgeMs] = useState<number | null>(
    eventId ? getCacheAge(eventId) : null,
  );
  const populatingRef = useRef(false);

  const populate = async (eid: string) => {
    if (populatingRef.current) return;
    populatingRef.current = true;
    try {
      await populateParticipantCache(eid);
      setCacheReady(true);
      setCacheAgeMs(getCacheAge(eid));
    } catch {
      // erro de rede — mantém cache anterior
    } finally {
      populatingRef.current = false;
    }
  };

  // Popula na montagem e quando o evento muda (se online)
  useEffect(() => {
    if (!eventId || !online) return;
    if (cacheIsStale(eventId)) {
      void populate(eventId);
    } else {
      setCacheReady(true);
      setCacheAgeMs(getCacheAge(eventId));
    }
  }, [eventId, online]);

  // Atualiza silenciosamente quando o usuário volta a ter conexão
  useEffect(() => {
    if (!eventId || !online) return;
    // Se ficou offline e o cache está velho, atualiza agora que voltou
    if (cacheIsStale(eventId)) {
      void populate(eventId);
    }
  }, [online]);

  const lookupQr = (rawValue: string): OfflineLookupResult => {
    if (!eventId) return { state: "sem_cache" };
    const { values } = extractCandidates(rawValue);
    return lookupByCredentialCode(eventId, values);
  };

  const searchOffline = (query: string): ParticipantCacheEntry[] => {
    if (!eventId) return [];
    return searchParticipantsOffline(eventId, query);
  };

  const refreshCache = async () => {
    if (!eventId || !online) return;
    await populate(eventId);
  };

  return { cacheReady, cacheAgeMs, refreshCache, lookupQr, searchOffline };
}
