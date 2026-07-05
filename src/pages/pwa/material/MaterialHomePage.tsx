import { Navigate } from "react-router-dom";

/**
 * MaterialHomePage
 * ----------------
 * A tela operacional do módulo de Entrega de Material é `/pwa/material/scan`
 * (kit ativo, contadores, scanner inline e busca em uma única tela).
 * O endpoint `/pwa/material` apenas redireciona para a tela unificada,
 * mantendo compatibilidade com o `homeTo` do PwaLayout.
 */
export default function MaterialHomePage() {
  return <Navigate to="/pwa/material/scan" replace />;
}
