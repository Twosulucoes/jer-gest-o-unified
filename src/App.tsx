import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { EventProvider } from "@/contexts/EventContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import SuperAdminRoute from "@/components/SuperAdminRoute";
import { ScrollToTop } from "@/components/ScrollToTop";
import AdminLayout from "@/components/AdminLayout";
import RedirectToEtapas from "@/components/admin/RedirectToEtapas";
import StageLayout from "@/components/StageLayout";
import StageHomePage from "./pages/admin/StageHomePage";
import StageReportsPage from "./pages/admin/StageReportsPage";
import SuperAdminLayout from "@/components/SuperAdminLayout";
import Index from "./pages/Index";
import LoginPage from "./pages/LoginPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import ModuleSelectorPage from "./pages/ModuleSelectorPage";
import DashboardPage from "./pages/admin/DashboardPage";
import EventosPage from "./pages/admin/EventosPage";
import EventStagesPage from "./pages/admin/EventStagesPage";
import EtapasIndexPage from "./pages/admin/EtapasIndexPage";
import EtapaHubPage from "./pages/admin/EtapaHubPage";
import ModalidadesPage from "./pages/admin/ModalidadesPage";
import CategoriasPage from "./pages/admin/CategoriasPage";
import LocaisPage from "./pages/admin/LocaisPage";
import InstituicoesPage from "./pages/admin/InstituicoesPage";
import DelegacoesPage from "./pages/admin/DelegacoesPage";
import ImportacaoPage from "./pages/admin/ImportacaoPage";
import ImportacaoModeloPage from "./pages/admin/ImportacaoModeloPage";
import ImportacaoPendenciasPage from "./pages/admin/ImportacaoPendenciasPage";
// ImportacaoCatalogoPage removed — consolidated into RegrasPage
import CredenciamentoPage from "./pages/admin/CredenciamentoPage";
import CredenciamentoExternoPage from "./pages/admin/CredenciamentoExternoPage";
import ValidacaoQRPage from "./pages/admin/ValidacaoQRPage";
import TransporteHubPage from "./pages/admin/TransporteHubPage";
import TransporteVeiculosPage from "./pages/admin/TransporteVeiculosPage";
import TransporteRotasPage from "./pages/admin/TransporteRotasPage";
import TransporteViagensPage from "./pages/admin/TransporteViagensPage";
import TransporteEmbarquePage from "./pages/admin/TransporteEmbarquePage";
import AlimentacaoHubPage from "./pages/admin/AlimentacaoHubPage";
import AlimentacaoTiposPage from "./pages/admin/AlimentacaoTiposPage";
import AlimentacaoJanelasPage from "./pages/admin/AlimentacaoJanelasPage";
import AlimentacaoConsumoPage from "./pages/admin/AlimentacaoConsumoPage";
import AlimentacaoDashboardPage from "./pages/admin/AlimentacaoDashboardPage";
import AlojamentoHubPage from "./pages/admin/AlojamentoHubPage";
import AlojamentoLocaisPage from "./pages/admin/AlojamentoLocaisPage";
import AlojamentoUnidadesPage from "./pages/admin/AlojamentoUnidadesPage";
import AlojamentoOcupacaoPage from "./pages/admin/AlojamentoOcupacaoPage";
import TransporteRelatoriosPage from "./pages/admin/TransporteRelatoriosPage";
import AlimentacaoRelatoriosPage from "./pages/admin/AlimentacaoRelatoriosPage";
import AlojamentoRelatoriosPage from "./pages/admin/AlojamentoRelatoriosPage";
import CompeticaoFasesPage from "./pages/admin/CompeticaoFasesPage";
import CompeticaoPartidasAgendaPage from "./pages/admin/CompeticaoPartidasAgendaPage";
import CompeticaoPartidaDetalhePage from "./pages/admin/CompeticaoPartidaDetalhePage";
import CompeticaoResultadosPage from "./pages/admin/CompeticaoResultadosPage";
import CompeticaoGruposPage from "./pages/admin/CompeticaoGruposPage";
import CompeticaoEquipesPage from "./pages/admin/CompeticaoEquipesPage";
// NOTE: CompeticaoPartidasPage and CompeticaoAgendaPage removed — consolidated into CompeticaoPartidasAgendaPage
import CompeticaoCentralPage from "./pages/admin/CompeticaoCentralPage";
import SincronizarEquipesPage from "./pages/admin/SincronizarEquipesPage";
import PreValidacaoPage from "./pages/admin/PreValidacaoPage";
import CompeticaoPainelPage from "./pages/admin/CompeticaoPainelPage";
import ParticipantesPage from "./pages/admin/ParticipantesPage";
import VoucherValidarPage from "./pages/admin/VoucherValidarPage";
import DuplicidadesPessoasPage from "./pages/admin/DuplicidadesPessoasPage";
import PessoasPage from "./pages/admin/PessoasPage";
import VouchersPage from "./pages/admin/VouchersPage";
import LogisticaConsolidadaPage from "./pages/admin/LogisticaConsolidadaPage";
import ParticipanteHistoricoPage from "./pages/admin/ParticipanteHistoricoPage";
import ParticipanteDetalhePage from "./pages/admin/ParticipanteDetalhePage";
import DelegacaoDetalhePage from "./pages/admin/DelegacaoDetalhePage";
import CredencialModelosPage from "./pages/admin/CredencialModelosPage";
import AcessosDelegacoesPage from "./pages/admin/AcessosDelegacoesPage";
import AcessosUsuariosPage from "./pages/admin/AcessosUsuariosPage";
// ParametrosEventoPage removed — consolidated into RegrasEventoPage
import IrregularidadesPage from "./pages/admin/IrregularidadesPage";
import NormalizacaoProvasPage from "./pages/admin/NormalizacaoProvasPage";
import SchemaValidadorPage from "./pages/admin/SchemaValidadorPage";
import OcorrenciasPage from "./pages/admin/OcorrenciasPage";
// MapaSistemaPage and DiagnosticoCompeticaoPage accessed only via SistemaDiagnosticoPage
import SistemaDiagnosticoPage from "./pages/admin/SistemaDiagnosticoPage";
import CentralDadosPage from "./pages/admin/CentralDadosPage";
import BoletinsPorModalidadePage from "./pages/admin/relatorios/BoletinsPorModalidadePage";
import DashboardOperacionalPage from "./pages/admin/relatorios/DashboardOperacionalPage";
import QuadroMedalhasPage from "./pages/admin/relatorios/QuadroMedalhasPage";
import PrestacaoContasOscPage from "./pages/admin/relatorios/PrestacaoContasOscPage";
import RegrasProvaPage from "./pages/admin/RegrasProvaPage";
import RegrasLotePage from "./pages/admin/RegrasLotePage";
// RegrasEventoPage removed — consolidated into RegrasPage
import RegrasPage from "./pages/admin/RegrasPage";
import ImportacaoAliasesPage from "./pages/admin/ImportacaoAliasesPage";
import AjudaChatPage from "./pages/admin/AjudaChatPage";
import AjudaManualPage from "./pages/admin/AjudaManualPage";
import SuperManualPage from "./pages/super/SuperManualPage";
import SuperChamadosPage from "./pages/super/SuperChamadosPage";
import AjudaChamadosPage from "./pages/admin/AjudaChamadosPage";
import SeedLogisticaEtapaPage from "./pages/admin/SeedLogisticaEtapaPage";
import DebugPublicadosPage from "./pages/admin/DebugPublicadosPage";
import SuperDashboardPage from "./pages/super/SuperDashboardPage";
import SuperEventosPage from "./pages/super/SuperEventosPage";
import SuperLogsPage from "./pages/super/SuperLogsPage";
import SuperConfigPage from "./pages/super/SuperConfigPage";
import SuperMonitorPage from "./pages/super/SuperMonitorPage";
import SuperInspectorPage from "./pages/super/SuperInspectorPage";
import EmailTemplatesPage from "./pages/admin/EmailTemplatesPage";
import LinksPage from "./pages/admin/LinksPage";
import LinkFormPage from "./pages/admin/LinkFormPage";
import ReportCenterPage from "./reports/ui/ReportCenterPage";
import RelatoriosHubPage from "./pages/admin/RelatoriosHubPage";
import IdentidadeVisualPage from "./pages/admin/IdentidadeVisualPage";
import LinkPreviewPage from "./pages/admin/LinkPreviewPage";
import CoordenadorModalidadeDashboard from "./pages/admin/CoordenadorModalidadeDashboard";
import GoRedirectPage from "./pages/public/GoRedirectPage";
// Evento Rules Center pages removed — consolidated into RegrasEventoPage
import PublicPagePage from "./pages/public/PublicPagePage";
import PesquisaDashboardPage from "./pages/admin/PesquisaDashboardPage";
import PesquisaEventosPage from "./pages/admin/PesquisaEventosPage";
import PesquisaFormEditorPage from "./pages/admin/PesquisaFormEditorPage";
import PesquisaPesquisadoresPage from "./pages/admin/PesquisaPesquisadoresPage";
// PWA pages
import PesquisaLoginPage from "./pages/pwa/PesquisaLoginPage";
import PesquisaHomePage from "./pages/pwa/PesquisaHomePage";
import PesquisaNovaPage from "./pages/pwa/PesquisaNovaPage";
import PesquisaConfirmacaoPage from "./pages/pwa/PesquisaConfirmacaoPage";
// PwaLoginPage removed — unified login at /login
import PwaSetPasswordPage from "./pages/pwa/PwaSetPasswordPage";
import PwaLandingPage from "./pages/pwa/PwaLandingPage";
import PwaModulePage from "./pages/pwa/PwaModulePage";
// PWA Alojamento pages
import AlojamentoHomePage from "./pages/pwa/alojamento/AlojamentoHomePage";
import AlojamentoScanPage from "./pages/pwa/alojamento/AlojamentoScanPage";
import AlojamentoBuscarPage from "./pages/pwa/alojamento/AlojamentoBuscarPage";
import AlojamentoOcupacaoPage2 from "./pages/pwa/alojamento/AlojamentoOcupacaoPage";
import AlojamentoPessoaPage from "./pages/pwa/alojamento/AlojamentoPessoaPage";
import AlojamentoIncidentesPage from "./pages/pwa/alojamento/AlojamentoIncidentesPage";
import AlojamentoNovoIncidentePage from "./pages/pwa/alojamento/AlojamentoNovoIncidentePage";
import AlojamentoListaCompletaPage from "./pages/pwa/alojamento/AlojamentoListaCompletaPage";
// PWA Transporte pages
import TransporteHomePage from "./pages/pwa/transporte/TransporteHomePage";
import TransporteViagensPwaPage from "./pages/pwa/transporte/TransporteViagensPage";
import TransporteScanPage from "./pages/pwa/transporte/TransporteScanPage";
import TransporteEmbarquePwaPage from "./pages/pwa/transporte/TransporteEmbarquePage";
import TransporteRotasPwaPage from "./pages/pwa/transporte/TransporteRotasPage";
import TransportePassageirosPage from "./pages/pwa/transporte/TransportePassageirosPage";
// PWA Alimentação pages
import AlimentacaoHomePage from "./pages/pwa/alimentacao/AlimentacaoHomePage";
import AlimentacaoScanPage from "./pages/pwa/alimentacao/AlimentacaoScanPage";
import AlimentacaoBuscarPwaPage from "./pages/pwa/alimentacao/AlimentacaoBuscarPage";
import AlimentacaoJanelasPwaPage from "./pages/pwa/alimentacao/AlimentacaoJanelasPage";
import AlimentacaoHistoricoPage from "./pages/pwa/alimentacao/AlimentacaoHistoricoPage";
import AlimentacaoListaConsumosPage from "./pages/pwa/alimentacao/AlimentacaoListaConsumosPage";
// PWA Coordenação Técnica pages
import CoordenacaoHomePage from "./pages/pwa/coordenacao/CoordenacaoHomePage";
import CoordenacaoAgendaPage from "./pages/pwa/coordenacao/CoordenacaoAgendaPage";
import CoordenacaoPartidasPage from "./pages/pwa/coordenacao/CoordenacaoPartidasPage";
import CoordenacaoPartidaDetalhePage from "./pages/pwa/coordenacao/CoordenacaoPartidaDetalhePage";
import CoordenacaoResultadosPwaPage from "./pages/pwa/coordenacao/CoordenacaoResultadosPage";
import CoordenacaoEstatisticasPage from "./pages/pwa/coordenacao/CoordenacaoEstatisticasPage";
import CoordenacaoConsultaPage from "./pages/pwa/coordenacao/CoordenacaoConsultaPage";
// PWA Delegação pages
import DelegacaoHomePage from "./pages/pwa/delegacao/DelegacaoHomePage";
import DelegacaoParticipantesPage from "./pages/pwa/delegacao/DelegacaoParticipantesPage";
import DelegacaoAgendaPage from "./pages/pwa/delegacao/DelegacaoAgendaPage";
import DelegacaoLogisticaPage from "./pages/pwa/delegacao/DelegacaoLogisticaPage";
import DelegacaoLocaisPage from "./pages/pwa/delegacao/DelegacaoLocaisPage";
import DelegacaoProtestosPage from "./pages/pwa/delegacao/DelegacaoProtestosPage";
import DelegacaoProtestoNovoPage from "./pages/pwa/delegacao/DelegacaoProtestoNovoPage";
import DelegacaoProtestoDetalhePage from "./pages/pwa/delegacao/DelegacaoProtestoDetalhePage";
import ProtestosFilaPage from "./pages/admin/ProtestosFilaPage";
import QrDiagnosticoPage from "./pages/pwa/diagnostico/QrDiagnosticoPage";
import PwaDebugPage from "./pages/pwa/PwaDebugPage";
import NotFound from "./pages/NotFound";
import PwaRouteGuard from "./components/pwa/PwaRouteGuard";
import PwaAcessoNegadoPage from "./pages/pwa/PwaAcessoNegadoPage";
import { COMPETITION_ROLES, FOOD_ROLES, LODGING_ROLES, TRANSPORT_ROLES } from "@/config/accessControl";
import PublicResultsPage from "./pages/public/PublicResultsPage";
import AtletaPublicProfilePage from "./pages/public/AtletaPublicProfilePage";
import AtletaQrCodePage from "./pages/admin/AtletaQrCodePage";
// Ao Vivo PWA (lazy loaded)
const AoVivoLoginPage = lazy(() => import("./pages/aovivo/AoVivoLoginPage"));
const AoVivoHomePage = lazy(() => import("./pages/aovivo/AoVivoHomePage"));
const AoVivoMatchPage = lazy(() => import("./pages/aovivo/AoVivoMatchPage"));

const queryClient = new QueryClient();


const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <ScrollToTop />
        <AuthProvider>
          <EventProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/redefinir-senha" element={<ResetPasswordPage />} />
            <Route path="/selecionar-modulo" element={<ModuleSelectorPage />} />
            {/* Super Admin routes */}
            <Route
              path="/super"
              element={
                <SuperAdminRoute>
                  <SuperAdminLayout />
                </SuperAdminRoute>
              }
            >
              <Route index element={<SuperDashboardPage />} />
              <Route path="eventos" element={<SuperEventosPage />} />
              <Route path="logs" element={<SuperLogsPage />} />
              <Route path="config" element={<SuperConfigPage />} />
              <Route path="monitor" element={<SuperMonitorPage />} />
              <Route path="manual" element={<SuperManualPage />} />
              <Route path="chamados" element={<SuperChamadosPage />} />
              <Route path="validador" element={<SchemaValidadorPage />} />
              <Route path="inspector" element={<SuperInspectorPage />} />
            </Route>
            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <AdminLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<DashboardPage />} />
              <Route path="coordenador-modalidade" element={<ProtectedRoute allowedRoles={["coordenador_modalidade"]}><CoordenadorModalidadeDashboard /></ProtectedRoute>} />
              <Route path="ajuda/chamados" element={<AjudaChamadosPage />} />
              <Route path="eventos" element={<ProtectedRoute allowedRoles={["admin", "secretaria", "coordenacao_tecnica"]}><EventosPage /></ProtectedRoute>} />
              <Route path="eventos/etapas" element={<ProtectedRoute allowedRoles={["admin", "secretaria", "coordenacao_tecnica"]}><EventStagesPage /></ProtectedRoute>} />
              <Route path="etapas" element={<ProtectedRoute allowedRoles={["admin", "secretaria", "coordenacao_tecnica"]}><EtapasIndexPage /></ProtectedRoute>} />
              <Route path="etapas/:stageId" element={<ProtectedRoute allowedRoles={["admin", "secretaria", "coordenacao_tecnica"]}><EtapaHubPage /></ProtectedRoute>} />
              <Route path="modalidades" element={<ProtectedRoute allowedRoles={["admin", "secretaria", "coordenacao_tecnica"]}><ModalidadesPage /></ProtectedRoute>} />
              <Route path="categorias" element={<ProtectedRoute allowedRoles={["admin", "secretaria", "coordenacao_tecnica"]}><CategoriasPage /></ProtectedRoute>} />
              <Route path="locais" element={<ProtectedRoute allowedRoles={["admin", "secretaria", "coordenacao_tecnica"]}><LocaisPage /></ProtectedRoute>} />
              <Route path="instituicoes" element={<ProtectedRoute allowedRoles={["admin", "secretaria", "coordenacao_tecnica"]}><InstituicoesPage /></ProtectedRoute>} />
              <Route path="delegacoes" element={<ProtectedRoute allowedRoles={["admin", "secretaria", "coordenacao_tecnica"]}><DelegacoesPage /></ProtectedRoute>} />
              <Route path="delegacoes/:delegationId" element={<ProtectedRoute allowedRoles={["admin", "secretaria", "coordenacao_tecnica"]}><DelegacaoDetalhePage /></ProtectedRoute>} />
              <Route path="importacao" element={<ProtectedRoute allowedRoles={["admin", "secretaria"]}><ImportacaoPage /></ProtectedRoute>} />
              <Route path="importacao/modelo" element={<ProtectedRoute allowedRoles={["admin", "secretaria"]}><ImportacaoModeloPage /></ProtectedRoute>} />
              <Route path="importacao/pendencias" element={<ProtectedRoute allowedRoles={["admin", "secretaria"]}><ImportacaoPendenciasPage /></ProtectedRoute>} />
              <Route path="importacao/catalogo" element={<Navigate to="/admin/regras" replace />} />
              <Route path="importacao/aliases" element={<ProtectedRoute allowedRoles={["admin", "secretaria", "coordenacao_tecnica"]}><ImportacaoAliasesPage /></ProtectedRoute>} />
              <Route path="participantes" element={<ProtectedRoute allowedRoles={["admin", "secretaria", "coordenacao_tecnica"]}><ParticipantesPage /></ProtectedRoute>} />
              <Route path="participantes/:participantId" element={<ProtectedRoute allowedRoles={["admin", "secretaria", "coordenacao_tecnica"]}><ParticipanteDetalhePage /></ProtectedRoute>} />
              <Route path="participantes/:participantId/esportivo" element={<ProtectedRoute allowedRoles={["admin", "secretaria", "coordenacao_tecnica"]}><ParticipanteHistoricoPage /></ProtectedRoute>} />
              <Route path="credenciamento" element={<RedirectToEtapas />} />
              <Route path="credenciamento-externo" element={<RedirectToEtapas />} />
              <Route path="validacao-qr" element={<RedirectToEtapas />} />
              {/* Transporte — operacional, redireciona para Etapa */}
              <Route path="transporte" element={<RedirectToEtapas />} />
              <Route path="transporte/veiculos" element={<RedirectToEtapas />} />
              <Route path="transporte/rotas" element={<RedirectToEtapas />} />
              <Route path="transporte/viagens" element={<RedirectToEtapas />} />
              <Route path="transporte/embarque/:tripId" element={<RedirectToEtapas />} />
              <Route path="transporte/relatorios" element={<RedirectToEtapas />} />
              {/* Alimentação — operacional, redireciona para Etapa */}
              <Route path="alimentacao" element={<RedirectToEtapas />} />
              <Route path="alimentacao/tipos" element={<RedirectToEtapas />} />
              <Route path="alimentacao/janelas" element={<RedirectToEtapas />} />
              <Route path="alimentacao/consumo" element={<RedirectToEtapas />} />
              <Route path="alimentacao/dashboard" element={<RedirectToEtapas />} />
              <Route path="alimentacao/relatorios" element={<RedirectToEtapas />} />
              {/* Alojamento — operacional, redireciona para Etapa */}
              <Route path="alojamento" element={<RedirectToEtapas />} />
              <Route path="alojamento/locais" element={<RedirectToEtapas />} />
              <Route path="alojamento/unidades" element={<RedirectToEtapas />} />
              <Route path="alojamento/ocupacao" element={<RedirectToEtapas />} />
              <Route path="alojamento/relatorios" element={<RedirectToEtapas />} />
              {/* Competição — operacional, redireciona para Etapa */}
              <Route path="competicao/painel" element={<RedirectToEtapas />} />
              <Route path="competicao/pre-validacao" element={<RedirectToEtapas />} />
              <Route path="competicao/central" element={<RedirectToEtapas />} />
              <Route path="competicao/fases" element={<RedirectToEtapas />} />
              <Route path="competicao/grupos" element={<RedirectToEtapas />} />
              <Route path="competicao/partidas" element={<RedirectToEtapas />} />
              <Route path="competicao/agenda" element={<RedirectToEtapas />} />
              <Route path="competicao/partidas-agenda" element={<RedirectToEtapas />} />
              <Route path="competicao/partida/:matchId" element={<ProtectedRoute allowedRoles={[...COMPETITION_ROLES, "mesario"]}><CompeticaoPartidaDetalhePage /></ProtectedRoute>} />
              <Route path="competicao/equipes" element={<RedirectToEtapas />} />
              <Route path="competicao/resultados" element={<RedirectToEtapas />} />
              <Route path="competicao/sincronizar-equipes" element={<RedirectToEtapas />} />
              <Route path="competicao/regras" element={<RedirectToEtapas />} />
              <Route path="competicao/regras/lote" element={<RedirectToEtapas />} />
              {/* Credenciais */}
              <Route path="credenciais/modelos" element={<ProtectedRoute allowedRoles={["admin", "secretaria", "coordenacao_tecnica"]}><CredencialModelosPage /></ProtectedRoute>} />
              {/* Acessos */}
              <Route path="acessos/delegacoes" element={<ProtectedRoute allowedRoles={["admin", "secretaria"]}><AcessosDelegacoesPage /></ProtectedRoute>} />
              <Route path="acessos/usuarios" element={<ProtectedRoute allowedRoles={["admin", "secretaria"]}><AcessosUsuariosPage /></ProtectedRoute>} />
              {/* Parâmetros e Regras — consolidados em /admin/regras */}
              <Route path="parametros-evento" element={<Navigate to="/admin/regras" replace />} />
              <Route path="regras-evento" element={<Navigate to="/admin/regras" replace />} />
              <Route path="regras" element={<ProtectedRoute allowedRoles={["admin", "secretaria", "coordenacao_tecnica"]}><RegrasPage /></ProtectedRoute>} />
              <Route path="regras-legacy" element={<Navigate to="/admin/regras" replace />} />
              {/* Irregularidades e Normalização */}
              <Route path="irregularidades" element={<ProtectedRoute allowedRoles={["admin", "secretaria", "coordenacao_tecnica"]}><IrregularidadesPage /></ProtectedRoute>} />
              <Route path="normalizacao-provas" element={<ProtectedRoute allowedRoles={["admin", "secretaria", "coordenacao_tecnica"]}><NormalizacaoProvasPage /></ProtectedRoute>} />
              {/* Schema Validator */}
              <Route path="schema/validador" element={<ProtectedRoute allowedRoles={["admin", "secretaria"]}><SchemaValidadorPage /></ProtectedRoute>} />
              <Route path="mapa" element={<Navigate to="/admin/sistema/diagnostico" replace />} />
              <Route path="diagnostico-competicao" element={<Navigate to="/admin/sistema/diagnostico" replace />} />
              <Route path="sistema/diagnostico" element={<ProtectedRoute allowedRoles={["admin", "secretaria", "coordenacao_tecnica"]}><SistemaDiagnosticoPage /></ProtectedRoute>} />
              <Route path="dados" element={<ProtectedRoute allowedRoles={["admin", "secretaria", "coordenacao_tecnica"]}><CentralDadosPage /></ProtectedRoute>} />
              <Route path="boletins" element={<Navigate to="/admin/relatorios/boletins" replace />} />
              <Route path="relatorios/boletins" element={<ProtectedRoute allowedRoles={["admin", "secretaria", "coordenacao_tecnica"]}><BoletinsPorModalidadePage /></ProtectedRoute>} />
              <Route path="relatorios/dashboard" element={<ProtectedRoute allowedRoles={["admin", "secretaria"]}><DashboardOperacionalPage /></ProtectedRoute>} />
              <Route path="relatorios/quadro-medalhas" element={<ProtectedRoute allowedRoles={["admin", "secretaria", "coordenacao_tecnica"]}><QuadroMedalhasPage /></ProtectedRoute>} />
              <Route path="relatorios/osc" element={<ProtectedRoute allowedRoles={["admin", "secretaria"]}><PrestacaoContasOscPage /></ProtectedRoute>} />
              <Route path="seed-logistica" element={<ProtectedRoute allowedRoles={["admin"]}><SeedLogisticaEtapaPage /></ProtectedRoute>} />
              <Route path="debug-publicados" element={<ProtectedRoute allowedRoles={["admin", "secretaria"]}><DebugPublicadosPage /></ProtectedRoute>} />
              <Route path="auth/email-templates" element={<ProtectedRoute allowedRoles={["admin", "secretaria", "coordenacao_tecnica"]}><EmailTemplatesPage /></ProtectedRoute>} />
              {/* Pesquisa de Satisfação — operacional, redireciona para Etapa */}
              <Route path="pesquisa" element={<RedirectToEtapas />} />
              <Route path="pesquisa/eventos" element={<RedirectToEtapas />} />
              <Route path="pesquisa/eventos/:eventId/form" element={<RedirectToEtapas />} />
              <Route path="pesquisa/pesquisadores" element={<RedirectToEtapas />} />
              {/* Links & Páginas */}
              <Route path="ajuda" element={<ProtectedRoute allowedRoles={["admin", "secretaria", "coordenacao_tecnica", "coordenador_modalidade"]}><AjudaChatPage /></ProtectedRoute>} />
              <Route path="ajuda/chat" element={<ProtectedRoute allowedRoles={["admin", "secretaria", "coordenacao_tecnica", "coordenador_modalidade"]}><AjudaChatPage /></ProtectedRoute>} />
              <Route path="ajuda/manual" element={<ProtectedRoute><AjudaManualPage /></ProtectedRoute>} />
              <Route path="links" element={<ProtectedRoute allowedRoles={["admin", "secretaria"]}><LinksPage /></ProtectedRoute>} />
              <Route path="links/novo" element={<ProtectedRoute allowedRoles={["admin", "secretaria"]}><LinkFormPage /></ProtectedRoute>} />
              <Route path="links/:id" element={<ProtectedRoute allowedRoles={["admin", "secretaria"]}><LinkFormPage /></ProtectedRoute>} />
              <Route path="links/preview/:id" element={<ProtectedRoute allowedRoles={["admin", "secretaria"]}><LinkPreviewPage /></ProtectedRoute>} />
              {/* Relatórios Globais */}
              <Route path="relatorios" element={<ProtectedRoute allowedRoles={["admin", "secretaria", "coordenacao_tecnica"]}><RelatoriosHubPage /></ProtectedRoute>} />
              <Route path="relatorios/central" element={<ProtectedRoute allowedRoles={["admin", "secretaria", "coordenacao_tecnica"]}><ReportCenterPage /></ProtectedRoute>} />
              <Route path="configuracoes/identidade-visual" element={<ProtectedRoute allowedRoles={["admin"]}><IdentidadeVisualPage /></ProtectedRoute>} />
              <Route path="atletas/qrcode" element={<ProtectedRoute allowedRoles={["admin", "secretaria"]}><AtletaQrCodePage /></ProtectedRoute>} />
              {/* Ocorrências — operacional, redireciona para Etapa */}
              <Route path="ocorrencias" element={<RedirectToEtapas />} />
            </Route>

            {/* ======================================================== */}
            {/* CONTEXTO DA ETAPA — layout dedicado, sem itens do Global  */}
            {/* ======================================================== */}
            <Route
              path="/admin/etapa/:stageId"
              element={
                <ProtectedRoute allowedRoles={["admin", "secretaria", "coordenacao_tecnica", "transporte", "alimentacao", "alojamento", "coordenador_modalidade"]}>
                  <StageLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<StageHomePage />} />
              <Route path="relatorios" element={<StageReportsPage />} />
              {/* Credenciamento */}
              <Route path="credenciamento" element={<ProtectedRoute allowedRoles={["admin", "secretaria", "coordenacao_tecnica"]}><CredenciamentoPage /></ProtectedRoute>} />
              <Route path="credenciamento-externo" element={<ProtectedRoute allowedRoles={["admin", "secretaria", "coordenacao_tecnica"]}><CredenciamentoExternoPage /></ProtectedRoute>} />
              <Route path="validacao-qr" element={<ProtectedRoute allowedRoles={["admin", "secretaria", "coordenacao_tecnica"]}><ValidacaoQRPage /></ProtectedRoute>} />
              <Route path="voucher/validar" element={<ProtectedRoute allowedRoles={["admin", "secretaria", "coordenacao_tecnica", "transporte", "alimentacao", "alojamento"]}><VoucherValidarPage /></ProtectedRoute>} />
              <Route path="pessoas" element={<ProtectedRoute allowedRoles={["admin", "secretaria", "super_admin"]}><PessoasPage /></ProtectedRoute>} />
              <Route path="pessoas/duplicidades" element={<ProtectedRoute allowedRoles={["admin", "secretaria", "super_admin"]}><DuplicidadesPessoasPage /></ProtectedRoute>} />
              <Route path="vouchers" element={<ProtectedRoute allowedRoles={["admin", "secretaria"]}><VouchersPage /></ProtectedRoute>} />
              <Route path="logistica/consolidada" element={<ProtectedRoute allowedRoles={["admin", "secretaria", "coordenacao_tecnica", "transporte", "alimentacao", "alojamento"]}><LogisticaConsolidadaPage /></ProtectedRoute>} />
              {/* Competição */}
              <Route path="competicao" element={<Navigate to="painel" replace />} />
              <Route path="competicao/painel" element={<ProtectedRoute allowedRoles={[...COMPETITION_ROLES]}><CompeticaoPainelPage /></ProtectedRoute>} />
              <Route path="competicao/pre-validacao" element={<ProtectedRoute allowedRoles={[...COMPETITION_ROLES]}><PreValidacaoPage /></ProtectedRoute>} />
              <Route path="competicao/central" element={<ProtectedRoute allowedRoles={[...COMPETITION_ROLES]}><CompeticaoCentralPage /></ProtectedRoute>} />
              <Route path="competicao/fases" element={<ProtectedRoute allowedRoles={[...COMPETITION_ROLES]}><CompeticaoFasesPage /></ProtectedRoute>} />
              <Route path="competicao/grupos" element={<ProtectedRoute allowedRoles={[...COMPETITION_ROLES]}><CompeticaoGruposPage /></ProtectedRoute>} />
              <Route path="competicao/partidas-agenda" element={<ProtectedRoute allowedRoles={[...COMPETITION_ROLES]}><CompeticaoPartidasAgendaPage /></ProtectedRoute>} />
              <Route path="competicao/partida/:matchId" element={<ProtectedRoute allowedRoles={[...COMPETITION_ROLES, "mesario"]}><CompeticaoPartidaDetalhePage /></ProtectedRoute>} />
              <Route path="competicao/equipes" element={<ProtectedRoute allowedRoles={[...COMPETITION_ROLES]}><CompeticaoEquipesPage /></ProtectedRoute>} />
              <Route path="competicao/resultados" element={<ProtectedRoute allowedRoles={[...COMPETITION_ROLES]}><CompeticaoResultadosPage /></ProtectedRoute>} />
              <Route path="competicao/sincronizar-equipes" element={<ProtectedRoute allowedRoles={[...COMPETITION_ROLES]}><SincronizarEquipesPage /></ProtectedRoute>} />
              <Route path="competicao/regras" element={<ProtectedRoute allowedRoles={[...COMPETITION_ROLES]}><RegrasProvaPage /></ProtectedRoute>} />
              <Route path="competicao/regras/lote" element={<ProtectedRoute allowedRoles={[...COMPETITION_ROLES]}><RegrasLotePage /></ProtectedRoute>} />
              {/* Alojamento */}
              <Route path="alojamento" element={<ProtectedRoute allowedRoles={[...LODGING_ROLES]}><AlojamentoHubPage /></ProtectedRoute>} />
              <Route path="alojamento/locais" element={<ProtectedRoute allowedRoles={[...LODGING_ROLES]}><AlojamentoLocaisPage /></ProtectedRoute>} />
              <Route path="alojamento/unidades" element={<ProtectedRoute allowedRoles={[...LODGING_ROLES]}><AlojamentoUnidadesPage /></ProtectedRoute>} />
              <Route path="alojamento/ocupacao" element={<ProtectedRoute allowedRoles={[...LODGING_ROLES]}><AlojamentoOcupacaoPage /></ProtectedRoute>} />
              <Route path="alojamento/relatorios" element={<ProtectedRoute allowedRoles={[...LODGING_ROLES]}><AlojamentoRelatoriosPage /></ProtectedRoute>} />
              {/* Alimentação */}
              <Route path="alimentacao" element={<ProtectedRoute allowedRoles={[...FOOD_ROLES]}><AlimentacaoHubPage /></ProtectedRoute>} />
              <Route path="alimentacao/tipos" element={<ProtectedRoute allowedRoles={[...FOOD_ROLES]}><AlimentacaoTiposPage /></ProtectedRoute>} />
              <Route path="alimentacao/janelas" element={<ProtectedRoute allowedRoles={[...FOOD_ROLES]}><AlimentacaoJanelasPage /></ProtectedRoute>} />
              <Route path="alimentacao/consumo" element={<ProtectedRoute allowedRoles={[...FOOD_ROLES]}><AlimentacaoConsumoPage /></ProtectedRoute>} />
              <Route path="alimentacao/dashboard" element={<ProtectedRoute allowedRoles={[...FOOD_ROLES]}><AlimentacaoDashboardPage /></ProtectedRoute>} />
              <Route path="alimentacao/relatorios" element={<ProtectedRoute allowedRoles={[...FOOD_ROLES]}><AlimentacaoRelatoriosPage /></ProtectedRoute>} />
              {/* Transporte */}
              <Route path="transporte" element={<ProtectedRoute allowedRoles={[...TRANSPORT_ROLES]}><TransporteHubPage /></ProtectedRoute>} />
              <Route path="transporte/veiculos" element={<ProtectedRoute allowedRoles={[...TRANSPORT_ROLES]}><TransporteVeiculosPage /></ProtectedRoute>} />
              <Route path="transporte/rotas" element={<ProtectedRoute allowedRoles={[...TRANSPORT_ROLES]}><TransporteRotasPage /></ProtectedRoute>} />
              <Route path="transporte/viagens" element={<ProtectedRoute allowedRoles={[...TRANSPORT_ROLES]}><TransporteViagensPage /></ProtectedRoute>} />
              <Route path="transporte/embarque/:tripId" element={<ProtectedRoute allowedRoles={[...TRANSPORT_ROLES]}><TransporteEmbarquePage /></ProtectedRoute>} />
              <Route path="transporte/relatorios" element={<ProtectedRoute allowedRoles={[...TRANSPORT_ROLES]}><TransporteRelatoriosPage /></ProtectedRoute>} />
              {/* Ocorrências */}
              <Route path="ocorrencias" element={<ProtectedRoute allowedRoles={["admin", "secretaria", "coordenacao_tecnica"]}><OcorrenciasPage /></ProtectedRoute>} />
              <Route path="protestos" element={<ProtectedRoute allowedRoles={["admin", "secretaria", "cde", "super_admin"]}><ProtestosFilaPage /></ProtectedRoute>} />
              {/* Pesquisa */}
              <Route path="pesquisa" element={<ProtectedRoute allowedRoles={["admin", "secretaria", "coordenacao_tecnica"]}><PesquisaDashboardPage /></ProtectedRoute>} />
              <Route path="pesquisa/eventos" element={<ProtectedRoute allowedRoles={["admin", "secretaria", "coordenacao_tecnica"]}><PesquisaEventosPage /></ProtectedRoute>} />
              <Route path="pesquisa/eventos/:eventId/form" element={<ProtectedRoute allowedRoles={["admin", "secretaria", "coordenacao_tecnica"]}><PesquisaFormEditorPage /></ProtectedRoute>} />
              <Route path="pesquisa/pesquisadores" element={<ProtectedRoute allowedRoles={["admin", "secretaria", "coordenacao_tecnica"]}><PesquisaPesquisadoresPage /></ProtectedRoute>} />
            </Route>
            {/* PWA Auth — redirect old login paths to unified login */}
            <Route path="/pwa/login" element={<Navigate to="/login" replace />} />
            <Route path="/pwa/recover" element={<Navigate to="/login" replace />} />
            <Route path="/pwa/set-password" element={<PwaSetPasswordPage />} />
            {/* PWA Landing (requires auth) */}
            <Route path="/pwa" element={<PwaLandingPage />} />
            
            {/* PWA Alojamento — perfil alojamento */}
            <Route path="/pwa/alojamento" element={<PwaRouteGuard allowedRoles={["alojamento"]}><AlojamentoHomePage /></PwaRouteGuard>} />
            <Route path="/pwa/alojamento/scan" element={<PwaRouteGuard allowedRoles={["alojamento"]}><AlojamentoScanPage /></PwaRouteGuard>} />
            <Route path="/pwa/alojamento/buscar" element={<PwaRouteGuard allowedRoles={["alojamento"]}><AlojamentoBuscarPage /></PwaRouteGuard>} />
            <Route path="/pwa/alojamento/ocupacao" element={<PwaRouteGuard allowedRoles={["alojamento"]}><AlojamentoOcupacaoPage2 /></PwaRouteGuard>} />
            <Route path="/pwa/alojamento/pessoa/:id" element={<PwaRouteGuard allowedRoles={["alojamento"]}><AlojamentoPessoaPage /></PwaRouteGuard>} />
            <Route path="/pwa/alojamento/incidentes" element={<PwaRouteGuard allowedRoles={["alojamento"]}><AlojamentoIncidentesPage /></PwaRouteGuard>} />
            <Route path="/pwa/alojamento/incidentes/nova" element={<PwaRouteGuard allowedRoles={["alojamento"]}><AlojamentoNovoIncidentePage /></PwaRouteGuard>} />
            <Route path="/pwa/alojamento/lista-completa" element={<PwaRouteGuard allowedRoles={["alojamento"]}><AlojamentoListaCompletaPage /></PwaRouteGuard>} />
            
            {/* PWA Transporte — perfil transporte */}
            <Route path="/pwa/transporte" element={<PwaRouteGuard allowedRoles={["transporte"]}><TransporteHomePage /></PwaRouteGuard>} />
            <Route path="/pwa/transporte/viagens" element={<PwaRouteGuard allowedRoles={["transporte"]}><TransporteViagensPwaPage /></PwaRouteGuard>} />
            <Route path="/pwa/transporte/scan" element={<PwaRouteGuard allowedRoles={["transporte"]}><TransporteScanPage /></PwaRouteGuard>} />
            <Route path="/pwa/transporte/embarque" element={<PwaRouteGuard allowedRoles={["transporte"]}><TransporteEmbarquePwaPage /></PwaRouteGuard>} />
            <Route path="/pwa/transporte/embarque/:tripId" element={<PwaRouteGuard allowedRoles={["transporte"]}><TransporteEmbarquePwaPage /></PwaRouteGuard>} />
            <Route path="/pwa/transporte/rotas" element={<PwaRouteGuard allowedRoles={["transporte"]}><TransporteRotasPwaPage /></PwaRouteGuard>} />
            <Route path="/pwa/transporte/viagem/:tripId/passageiros" element={<PwaRouteGuard allowedRoles={["transporte"]}><TransportePassageirosPage /></PwaRouteGuard>} />
            
            {/* PWA Alimentação — perfil alimentacao */}
            <Route path="/pwa/alimentacao" element={<PwaRouteGuard allowedRoles={["alimentacao"]}><AlimentacaoHomePage /></PwaRouteGuard>} />
            <Route path="/pwa/alimentacao/scan" element={<PwaRouteGuard allowedRoles={["alimentacao"]}><AlimentacaoScanPage /></PwaRouteGuard>} />
            <Route path="/pwa/alimentacao/buscar" element={<PwaRouteGuard allowedRoles={["alimentacao"]}><AlimentacaoBuscarPwaPage /></PwaRouteGuard>} />
            <Route path="/pwa/alimentacao/janelas" element={<PwaRouteGuard allowedRoles={["alimentacao"]}><AlimentacaoJanelasPwaPage /></PwaRouteGuard>} />
            <Route path="/pwa/alimentacao/historico" element={<PwaRouteGuard allowedRoles={["alimentacao"]}><AlimentacaoHistoricoPage /></PwaRouteGuard>} />
            <Route path="/pwa/alimentacao/lista-consumos" element={<PwaRouteGuard allowedRoles={["alimentacao"]}><AlimentacaoListaConsumosPage /></PwaRouteGuard>} />
            
            {/* PWA Coordenação Técnica — perfil coordenacao_tecnica */}
            <Route path="/pwa/coordenacao-tecnica" element={<PwaRouteGuard allowedRoles={["coordenacao_tecnica"]}><CoordenacaoHomePage /></PwaRouteGuard>} />
            <Route path="/pwa/coordenacao-tecnica/agenda" element={<PwaRouteGuard allowedRoles={["coordenacao_tecnica"]}><CoordenacaoAgendaPage /></PwaRouteGuard>} />
            <Route path="/pwa/coordenacao-tecnica/partidas" element={<PwaRouteGuard allowedRoles={["coordenacao_tecnica"]}><CoordenacaoPartidasPage /></PwaRouteGuard>} />
            <Route path="/pwa/coordenacao-tecnica/partida/:matchId" element={<PwaRouteGuard allowedRoles={["coordenacao_tecnica"]}><CoordenacaoPartidaDetalhePage /></PwaRouteGuard>} />
            <Route path="/pwa/coordenacao-tecnica/resultados" element={<PwaRouteGuard allowedRoles={["coordenacao_tecnica"]}><CoordenacaoResultadosPwaPage /></PwaRouteGuard>} />
            <Route path="/pwa/coordenacao-tecnica/estatisticas" element={<PwaRouteGuard allowedRoles={["coordenacao_tecnica"]}><CoordenacaoEstatisticasPage /></PwaRouteGuard>} />
            <Route path="/pwa/coordenacao-tecnica/consulta" element={<PwaRouteGuard allowedRoles={["coordenacao_tecnica"]}><CoordenacaoConsultaPage /></PwaRouteGuard>} />
            
            {/* PWA Delegação — perfil delegacao */}
            <Route path="/pwa/delegacao" element={<PwaRouteGuard allowedRoles={["delegacao"]}><DelegacaoHomePage /></PwaRouteGuard>} />
            <Route path="/pwa/delegacao/participantes" element={<PwaRouteGuard allowedRoles={["delegacao"]}><DelegacaoParticipantesPage /></PwaRouteGuard>} />
            <Route path="/pwa/delegacao/agenda" element={<PwaRouteGuard allowedRoles={["delegacao"]}><DelegacaoAgendaPage /></PwaRouteGuard>} />
            <Route path="/pwa/delegacao/logistica" element={<PwaRouteGuard allowedRoles={["delegacao"]}><DelegacaoLogisticaPage /></PwaRouteGuard>} />
            <Route path="/pwa/delegacao/locais" element={<PwaRouteGuard allowedRoles={["delegacao"]}><DelegacaoLocaisPage /></PwaRouteGuard>} />
            <Route path="/pwa/delegacao/protestos" element={<PwaRouteGuard allowedRoles={["delegacao"]}><DelegacaoProtestosPage /></PwaRouteGuard>} />
            <Route path="/pwa/delegacao/protestos/novo" element={<PwaRouteGuard allowedRoles={["delegacao"]}><DelegacaoProtestoNovoPage /></PwaRouteGuard>} />
            <Route path="/pwa/delegacao/protestos/:id" element={<PwaRouteGuard allowedRoles={["delegacao"]}><DelegacaoProtestoDetalhePage /></PwaRouteGuard>} />

            {/* PWA Module pages (Catch-all for implemented modules but also placeholder for future ones) */}
            <Route path="/pwa/:module" element={<PwaModulePage />} />
            {/* PWA Pesquisa (PIN auth, no Supabase Auth) */}
            <Route path="/pwa/pesquisa/login" element={<PesquisaLoginPage />} />
            <Route path="/pwa/pesquisa/home" element={<PesquisaHomePage />} />
            <Route path="/pwa/pesquisa/nova" element={<PesquisaNovaPage />} />
            <Route path="/pwa/pesquisa/confirmacao" element={<PesquisaConfirmacaoPage />} />
            {/* PWA Acesso Negado */}
            <Route path="/pwa/acesso-negado" element={<PwaAcessoNegadoPage />} />
            <Route path="/pwa/debug" element={<PwaDebugPage />} />
            <Route path="/pwa/diagnostico/qr" element={<QrDiagnosticoPage />} />
            {/* PWA Diagnóstico */}
            <Route path="/pwa/diagnostico/qr" element={<QrDiagnosticoPage />} />
            <Route path="/pwa/debug" element={<PwaDebugPage />} />
            {/* Ao Vivo PWA — qualquer autenticado */}
            <Route path="/aovivo/login" element={<Suspense fallback={null}><AoVivoLoginPage /></Suspense>} />
            <Route path="/aovivo" element={<Suspense fallback={null}><AoVivoHomePage /></Suspense>} />
            <Route path="/aovivo/partida/:matchId" element={<Suspense fallback={null}><AoVivoMatchPage /></Suspense>} />
            {/* Public content routes */}
            <Route path="/public/results" element={<PublicResultsPage />} />
            <Route path="/go/:slug" element={<GoRedirectPage />} />
            <Route path="/p/:slug" element={<PublicPagePage />} />
            <Route path="/a/:token" element={<AtletaPublicProfilePage />} />
            {/* Evento Rules Center routes removed — consolidated into /admin/regras-evento */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          </EventProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
