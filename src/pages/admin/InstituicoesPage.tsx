import { Navigate } from "react-router-dom";

/**
 * Instituições foi unificada com Delegações (cada delegação representa uma escola).
 * Esta rota agora apenas redireciona para /admin/delegacoes.
 */
export default function InstituicoesPage() {
  return <Navigate to="/admin/delegacoes" replace />;
}
