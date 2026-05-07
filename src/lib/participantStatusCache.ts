import { supabase } from "@/integrations/supabase/client";

// Cache TTL: 8 horas. Suficiente para um turno de campo.
const CACHE_TTL_MS = 8 * 60 * 60 * 1000;
const CACHE_KEY_PREFIX = "jer_psc_";

export interface ParticipantCacheEntry {
  participant_id: string;
  full_name: string;
  cpf: string | null;
  is_active: boolean;
  credentialed_at: string | null;
  needs_meals: boolean;
  needs_transport: boolean;
  needs_lodging: boolean;
}

interface ParticipantStatusCache {
  event_id: string;
  cached_at: number;
  // Código de credencial (ativo) → participant_id
  by_active_code: Record<string, string>;
  // Qualquer código (ativo ou inativo) → participant_id
  by_any_code: Record<string, string>;
  // CPF (só dígitos) → participant_id
  by_cpf: Record<string, string>;
  // Dados dos participantes
  participants: Record<string, ParticipantCacheEntry>;
}

function storageKey(eventId: string) {
  return CACHE_KEY_PREFIX + eventId;
}

function readCache(eventId: string): ParticipantStatusCache | null {
  try {
    const raw = localStorage.getItem(storageKey(eventId));
    if (!raw) return null;
    return JSON.parse(raw) as ParticipantStatusCache;
  } catch {
    return null;
  }
}

function writeCache(cache: ParticipantStatusCache): void {
  try {
    localStorage.setItem(storageKey(cache.event_id), JSON.stringify(cache));
  } catch {
    // localStorage cheio — ignora silenciosamente
  }
}

export function cacheIsStale(eventId: string): boolean {
  const cache = readCache(eventId);
  if (!cache) return true;
  return Date.now() - cache.cached_at > CACHE_TTL_MS;
}

export function getCacheAge(eventId: string): number | null {
  const cache = readCache(eventId);
  if (!cache) return null;
  return Date.now() - cache.cached_at;
}

/**
 * Popula o cache com todos os participantes do evento e seus códigos de credencial.
 * Deve ser chamado quando online (abertura do módulo, retorno de conexão).
 */
export async function populateParticipantCache(eventId: string): Promise<void> {
  // Busca participantes com dados de pessoa e credenciais ativas
  const { data: participants, error: partError } = await (supabase as any)
    .from("participants")
    .select(
      "id, is_active, credentialed_at, needs_meals, needs_transport, needs_lodging, person:people(full_name, cpf)",
    )
    .eq("event_id", eventId)
    .limit(5000);

  if (partError || !participants) return;

  // Busca todas as credenciais do evento (ativas e inativas) para indexar por código
  const { data: credentials } = await (supabase as any)
    .from("participant_credentials")
    .select("participant_id, credential_code, qr_code_value, status")
    .eq("event_id", eventId)
    .limit(10000);

  // Busca credenciais externas ativas
  const { data: extCredentials } = await (supabase as any)
    .from("external_credentials")
    .select("participant_id, credential_code, status")
    .eq("event_id", eventId)
    .limit(5000);

  const cache: ParticipantStatusCache = {
    event_id: eventId,
    cached_at: Date.now(),
    by_active_code: {},
    by_any_code: {},
    by_cpf: {},
    participants: {},
  };

  for (const p of participants) {
    const entry: ParticipantCacheEntry = {
      participant_id: p.id,
      full_name: p.person?.full_name ?? "",
      cpf: p.person?.cpf ?? null,
      is_active: p.is_active ?? false,
      credentialed_at: p.credentialed_at ?? null,
      needs_meals: p.needs_meals ?? true,
      needs_transport: p.needs_transport ?? true,
      needs_lodging: p.needs_lodging ?? true,
    };
    cache.participants[p.id] = entry;

    // Índice por CPF (só dígitos)
    if (entry.cpf) {
      const digits = entry.cpf.replace(/\D/g, "");
      if (digits.length === 11) cache.by_cpf[digits] = p.id;
    }
  }

  // Índice por código de credencial
  for (const cred of credentials ?? []) {
    const pid = cred.participant_id;
    if (!cache.participants[pid]) continue;

    const codes = [cred.credential_code, cred.qr_code_value].filter(Boolean) as string[];
    for (const code of codes) {
      const upper = code.toUpperCase();
      cache.by_any_code[upper] = pid;
      if (cred.status === "active") {
        cache.by_active_code[upper] = pid;
      }
    }
  }

  // Credenciais externas ativas
  for (const ext of extCredentials ?? []) {
    const pid = ext.participant_id;
    if (!cache.participants[pid]) continue;
    const upper = (ext.credential_code ?? "").toUpperCase();
    if (!upper) continue;
    cache.by_any_code[upper] = pid;
    if (ext.status === "active") {
      cache.by_active_code[upper] = pid;
    }
  }

  writeCache(cache);
}

// ----- Resultado da consulta offline -----

export type OfflineLookupResult =
  | { state: "credenciado"; entry: ParticipantCacheEntry }
  | { state: "nao_credenciado"; entry: ParticipantCacheEntry }
  | { state: "nao_cadastrado" }
  | { state: "sem_cache" }; // cache não disponível

/**
 * Verifica o estado do participante pelo código da credencial (offline-first).
 * Candidatos: o valor bruto e variações do código (maiúsculas, sem prefixo).
 */
export function lookupByCredentialCode(
  eventId: string,
  candidates: string[],
): OfflineLookupResult {
  const cache = readCache(eventId);
  if (!cache) return { state: "sem_cache" };

  const upperCandidates = candidates.map((c) => c.toUpperCase());

  // 1. Verifica se há credencial ativa
  for (const code of upperCandidates) {
    const pid = cache.by_active_code[code];
    if (pid && cache.participants[pid]) {
      const entry = cache.participants[pid];
      // Dupla verificação: credentialed_at
      if (entry.credentialed_at) return { state: "credenciado", entry };
    }
  }

  // 2. Verifica se está cadastrado mas sem credencial ativa
  for (const code of upperCandidates) {
    const pid = cache.by_any_code[code];
    if (pid && cache.participants[pid]) {
      const entry = cache.participants[pid];
      if (entry.credentialed_at) return { state: "credenciado", entry };
      return { state: "nao_credenciado", entry };
    }
  }

  // 3. Verifica por CPF (11 dígitos)
  for (const code of upperCandidates) {
    const digits = code.replace(/\D/g, "");
    if (digits.length === 11) {
      const pid = cache.by_cpf[digits];
      if (pid && cache.participants[pid]) {
        const entry = cache.participants[pid];
        if (entry.credentialed_at) return { state: "credenciado", entry };
        return { state: "nao_credenciado", entry };
      }
    }
  }

  return { state: "nao_cadastrado" };
}

/**
 * Busca participantes pelo nome/CPF no cache (para busca manual offline).
 */
export function searchParticipantsOffline(
  eventId: string,
  query: string,
): ParticipantCacheEntry[] {
  const cache = readCache(eventId);
  if (!cache) return [];

  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];

  const digits = q.replace(/\D/g, "");
  const results: ParticipantCacheEntry[] = [];

  for (const entry of Object.values(cache.participants)) {
    if (!entry.is_active) continue;

    const nameMatch = entry.full_name.toLowerCase().includes(q);
    const cpfMatch = digits.length >= 3 && entry.cpf?.replace(/\D/g, "").includes(digits);

    if (nameMatch || cpfMatch) results.push(entry);
    if (results.length >= 20) break;
  }

  return results;
}

export function clearParticipantCache(eventId: string): void {
  try {
    localStorage.removeItem(storageKey(eventId));
  } catch {
    // ignore
  }
}
