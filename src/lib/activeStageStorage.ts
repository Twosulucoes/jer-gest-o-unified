/** Mesma chave usada em `StageLayout` / `RedirectToEtapas` para última etapa admin. */
export const LAST_ACTIVE_STAGE_STORAGE_KEY = "jer_last_active_stage_id";

export function readLastActiveStageId(): string | null {
  try {
    return localStorage.getItem(LAST_ACTIVE_STAGE_STORAGE_KEY);
  } catch {
    return null;
  }
}
