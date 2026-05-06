/**
 * Cache de janelas de refeição no localStorage chaveado por evento+etapa.
 *
 * Auditoria PWA Alimentação (bloqueador 4): a chave única
 * `pwa_meal_windows_cache` era compartilhada entre eventos/etapas.
 * Trocar de contexto e abrir uma tela do PWA exibia janelas do contexto
 * antigo até o fetch de rede sobrescrever, com risco real de o operador
 * registrar consumo na janela errada.
 *
 * Aqui o cache passa a ser segmentado por `(event_id, stage_id)` e a
 * leitura sem essas chaves retorna vazio. Mantemos a chave legada para
 * limpeza única no boot, evitando lixo eterno em devices já instalados.
 */

const LEGACY_KEY = "pwa_meal_windows_cache";
const PREFIX = "pwa_meal_windows_cache::";

export type MealWindowCachePayload<T = unknown> = {
  updated_at: string;
  windows: T[];
};

function safeStorage(): Storage | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

function buildKey(eventId: string | null | undefined, stageId: string | null | undefined): string | null {
  if (!eventId) return null;
  return `${PREFIX}${eventId}::${stageId ?? "no-stage"}`;
}

export function readMealWindowsCache<T = unknown>(
  eventId: string | null | undefined,
  stageId: string | null | undefined,
): MealWindowCachePayload<T> | null {
  const storage = safeStorage();
  const key = buildKey(eventId, stageId);
  if (!storage || !key) return null;
  const raw = storage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as MealWindowCachePayload<T>;
  } catch {
    storage.removeItem(key);
    return null;
  }
}

export function writeMealWindowsCache<T = unknown>(
  eventId: string | null | undefined,
  stageId: string | null | undefined,
  windows: T[],
): void {
  const storage = safeStorage();
  const key = buildKey(eventId, stageId);
  if (!storage || !key) return;
  const payload: MealWindowCachePayload<T> = {
    updated_at: new Date().toISOString(),
    windows,
  };
  try {
    storage.setItem(key, JSON.stringify(payload));
  } catch {
    /* quota exceeded; cache é otimização, não dado crítico */
  }
}

export function clearAllMealWindowsCache(): void {
  const storage = safeStorage();
  if (!storage) return;
  storage.removeItem(LEGACY_KEY);
  const toRemove: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key && key.startsWith(PREFIX)) toRemove.push(key);
  }
  toRemove.forEach((k) => storage.removeItem(k));
}

/**
 * Remove a chave legada compartilhada. Útil no boot do PWA para limpar
 * lixo de devices já instalados antes do refactor.
 */
export function removeLegacyMealWindowsCache(): void {
  const storage = safeStorage();
  if (!storage) return;
  storage.removeItem(LEGACY_KEY);
}
