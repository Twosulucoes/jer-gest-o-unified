import { useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { toast } from "sonner";

const STORAGE_KEY = "jer_last_active_stage_id";

/**
 * Map old top-level operational paths to their stage-scoped equivalent.
 * Anything not in this map (e.g. weird subpaths) just falls back to the
 * generic stage selector.
 */
function rewriteToStagePath(pathname: string, stageId: string): string | null {
  // Compat: páginas legadas mescladas em "partidas-agenda"
  if (pathname === `/admin/competicao/agenda` || pathname === `/admin/competicao/partidas`) {
    return `/admin/etapa/${stageId}/competicao/partidas-agenda`;
  }

  // /admin/credenciamento[/...] → /admin/etapa/:stageId/credenciamento[/...]
  const match = pathname.match(
    /^\/admin\/(credenciamento(?:-externo)?|validacao-qr|competicao(?:\/.*)?|alojamento(?:\/.*)?|alimentacao(?:\/.*)?|transporte(?:\/.*)?|ocorrencias|protestos|pesquisa(?:\/.*)?)$/,
  );
  if (!match) return null;
  return `/admin/etapa/${stageId}/${match[1]}`;
}

/**
 * Used by legacy operational routes (e.g. /admin/credenciamento, /admin/competicao/...).
 * Operational modules now live INSIDE a stage context. If the user already has a recently
 * used stage, we send them straight to the equivalent route inside that stage. Otherwise
 * we ask them to pick a stage.
 */
export default function RedirectToEtapas() {
  const location = useLocation();
  const lastStageId = (() => {
    try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
  })();

  const target = lastStageId ? rewriteToStagePath(location.pathname, lastStageId) : null;

  useEffect(() => {
    if (target) return; // silent jump — nothing to inform
    toast.info("Selecione uma etapa primeiro", {
      description: "Os módulos operacionais agora ficam dentro de uma etapa do evento.",
    });
  }, [location.pathname, target]);

  if (target) {
    return <Navigate to={target + location.search} replace />;
  }
  return <Navigate to="/admin/etapas" replace state={{ from: location.pathname }} />;
}
