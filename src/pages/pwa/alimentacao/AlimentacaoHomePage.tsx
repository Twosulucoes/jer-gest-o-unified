import { Navigate } from "react-router-dom";

/**
 * AlimentacaoHomePage
 * --------------------
 * A tela operacional foi unificada em `/pwa/alimentacao/scan`
 * (janela ativa, contadores, scanner inline e busca em uma única tela
 * sem scroll). O endpoint `/pwa/alimentacao` continua válido para
 * compatibilidade com links externos e com o `homeTo` do PwaLayout —
 * apenas redireciona para a tela unificada.
 */
export default function AlimentacaoHomePage() {
  return <Navigate to="/pwa/alimentacao/scan" replace />;
}
