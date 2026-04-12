import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { EventProvider } from "@/contexts/EventContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AdminLayout from "@/components/AdminLayout";
import Index from "./pages/Index";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/admin/DashboardPage";
import EventosPage from "./pages/admin/EventosPage";
import ModalidadesPage from "./pages/admin/ModalidadesPage";
import CategoriasPage from "./pages/admin/CategoriasPage";
import LocaisPage from "./pages/admin/LocaisPage";
import InstituicoesPage from "./pages/admin/InstituicoesPage";
import DelegacoesPage from "./pages/admin/DelegacoesPage";
import ImportacaoPage from "./pages/admin/ImportacaoPage";
import CredenciamentoPage from "./pages/admin/CredenciamentoPage";
import ValidacaoQRPage from "./pages/admin/ValidacaoQRPage";
import TransporteVeiculosPage from "./pages/admin/TransporteVeiculosPage";
import TransporteRotasPage from "./pages/admin/TransporteRotasPage";
import TransporteViagensPage from "./pages/admin/TransporteViagensPage";
import TransporteEmbarquePage from "./pages/admin/TransporteEmbarquePage";
import AlimentacaoTiposPage from "./pages/admin/AlimentacaoTiposPage";
import AlimentacaoJanelasPage from "./pages/admin/AlimentacaoJanelasPage";
import AlimentacaoConsumoPage from "./pages/admin/AlimentacaoConsumoPage";
import AlojamentoLocaisPage from "./pages/admin/AlojamentoLocaisPage";
import AlojamentoUnidadesPage from "./pages/admin/AlojamentoUnidadesPage";
import AlojamentoOcupacaoPage from "./pages/admin/AlojamentoOcupacaoPage";
import CompeticaoFasesPage from "./pages/admin/CompeticaoFasesPage";
import CompeticaoPartidasPage from "./pages/admin/CompeticaoPartidasPage";
import CompeticaoAgendaPage from "./pages/admin/CompeticaoAgendaPage";
import CompeticaoPartidaDetalhePage from "./pages/admin/CompeticaoPartidaDetalhePage";
import CompeticaoResultadosPage from "./pages/admin/CompeticaoResultadosPage";
import CompeticaoGruposPage from "./pages/admin/CompeticaoGruposPage";
import CompeticaoEquipesPage from "./pages/admin/CompeticaoEquipesPage";
import CompeticaoCentralPage from "./pages/admin/CompeticaoCentralPage";
import SincronizarEquipesPage from "./pages/admin/SincronizarEquipesPage";
import ParticipantesPage from "./pages/admin/ParticipantesPage";
import ParticipanteHistoricoPage from "./pages/admin/ParticipanteHistoricoPage";
import ParticipanteDetalhePage from "./pages/admin/ParticipanteDetalhePage";
import DelegacaoDetalhePage from "./pages/admin/DelegacaoDetalhePage";
import CredencialModelosPage from "./pages/admin/CredencialModelosPage";
import AcessosDelegacoesPage from "./pages/admin/AcessosDelegacoesPage";
import AcessosUsuariosPage from "./pages/admin/AcessosUsuariosPage";
import ParametrosEventoPage from "./pages/admin/ParametrosEventoPage";
import IrregularidadesPage from "./pages/admin/IrregularidadesPage";
import NormalizacaoProvasPage from "./pages/admin/NormalizacaoProvasPage";
import SchemaValidadorPage from "./pages/admin/SchemaValidadorPage";
import MapaSistemaPage from "./pages/admin/MapaSistemaPage";
import DiagnosticoCompeticaoPage from "./pages/admin/DiagnosticoCompeticaoPage";
import CentralDadosPage from "./pages/admin/CentralDadosPage";
import BoletinsPage from "./pages/admin/BoletinsPage";
import RegrasProvaPage from "./pages/admin/RegrasProvaPage";
import RegrasLotePage from "./pages/admin/RegrasLotePage";
import DemoSeedsPage from "./pages/admin/DemoSeedsPage";
import EmailTemplatesPage from "./pages/admin/EmailTemplatesPage";
import LinksPage from "./pages/admin/LinksPage";
import LinkFormPage from "./pages/admin/LinkFormPage";
import ReportCenterPage from "./reports/ui/ReportCenterPage";
import LinkPreviewPage from "./pages/admin/LinkPreviewPage";
import GoRedirectPage from "./pages/public/GoRedirectPage";
import PublicPagePage from "./pages/public/PublicPagePage";
import PesquisaDashboardPage from "./pages/admin/PesquisaDashboardPage";
import PesquisaEventosPage from "./pages/admin/PesquisaEventosPage";
import PesquisaPesquisadoresPage from "./pages/admin/PesquisaPesquisadoresPage";
// PWA pages
import PesquisaLoginPage from "./pages/pwa/PesquisaLoginPage";
import PesquisaHomePage from "./pages/pwa/PesquisaHomePage";
import PesquisaNovaPage from "./pages/pwa/PesquisaNovaPage";
import PesquisaConfirmacaoPage from "./pages/pwa/PesquisaConfirmacaoPage";
import PwaLoginPage from "./pages/pwa/PwaLoginPage";
import PwaRecoverPage from "./pages/pwa/PwaRecoverPage";
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
// PWA Transporte pages
import TransporteHomePage from "./pages/pwa/transporte/TransporteHomePage";
import TransporteViagensPwaPage from "./pages/pwa/transporte/TransporteViagensPage";
import TransporteScanPage from "./pages/pwa/transporte/TransporteScanPage";
import TransporteEmbarquePwaPage from "./pages/pwa/transporte/TransporteEmbarquePage";
import TransporteRotasPwaPage from "./pages/pwa/transporte/TransporteRotasPage";
// PWA Alimentação pages
import AlimentacaoHomePage from "./pages/pwa/alimentacao/AlimentacaoHomePage";
import AlimentacaoScanPage from "./pages/pwa/alimentacao/AlimentacaoScanPage";
import AlimentacaoBuscarPwaPage from "./pages/pwa/alimentacao/AlimentacaoBuscarPage";
import AlimentacaoJanelasPwaPage from "./pages/pwa/alimentacao/AlimentacaoJanelasPage";
import AlimentacaoHistoricoPage from "./pages/pwa/alimentacao/AlimentacaoHistoricoPage";
// PWA Coordenação Técnica pages
import CoordenacaoHomePage from "./pages/pwa/coordenacao/CoordenacaoHomePage";
import CoordenacaoAgendaPage from "./pages/pwa/coordenacao/CoordenacaoAgendaPage";
import CoordenacaoPartidasPage from "./pages/pwa/coordenacao/CoordenacaoPartidasPage";
import CoordenacaoPartidaDetalhePage from "./pages/pwa/coordenacao/CoordenacaoPartidaDetalhePage";
import CoordenacaoResultadosPwaPage from "./pages/pwa/coordenacao/CoordenacaoResultadosPage";
import CoordenacaoEstatisticasPage from "./pages/pwa/coordenacao/CoordenacaoEstatisticasPage";
// PWA Delegação pages
import DelegacaoHomePage from "./pages/pwa/delegacao/DelegacaoHomePage";
import DelegacaoParticipantesPage from "./pages/pwa/delegacao/DelegacaoParticipantesPage";
import DelegacaoAgendaPage from "./pages/pwa/delegacao/DelegacaoAgendaPage";
import DelegacaoLogisticaPage from "./pages/pwa/delegacao/DelegacaoLogisticaPage";
import DelegacaoLocaisPage from "./pages/pwa/delegacao/DelegacaoLocaisPage";
import QrDiagnosticoPage from "./pages/pwa/diagnostico/QrDiagnosticoPage";
import NotFound from "./pages/NotFound";
import AtletaPublicProfilePage from "./pages/public/AtletaPublicProfilePage";
import AtletaQrCodePage from "./pages/admin/AtletaQrCodePage";

const queryClient = new QueryClient();

const TRANSPORT_ROLES = ["admin", "secretaria", "coordenacao_tecnica", "transporte"] as const;
const FOOD_ROLES = ["admin", "secretaria", "coordenacao_tecnica", "alimentacao"] as const;
const LODGING_ROLES = ["admin", "secretaria", "coordenacao_tecnica", "alojamento"] as const;
const COMPETITION_ROLES = ["admin", "secretaria", "coordenacao_tecnica"] as const;

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <EventProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <AdminLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<DashboardPage />} />
              <Route path="eventos" element={<ProtectedRoute allowedRoles={["admin", "secretaria", "coordenacao_tecnica"]}><EventosPage /></ProtectedRoute>} />
              <Route path="modalidades" element={<ProtectedRoute allowedRoles={["admin", "secretaria", "coordenacao_tecnica"]}><ModalidadesPage /></ProtectedRoute>} />
              <Route path="categorias" element={<ProtectedRoute allowedRoles={["admin", "secretaria", "coordenacao_tecnica"]}><CategoriasPage /></ProtectedRoute>} />
              <Route path="locais" element={<ProtectedRoute allowedRoles={["admin", "secretaria", "coordenacao_tecnica"]}><LocaisPage /></ProtectedRoute>} />
              <Route path="instituicoes" element={<ProtectedRoute allowedRoles={["admin", "secretaria", "coordenacao_tecnica"]}><InstituicoesPage /></ProtectedRoute>} />
              <Route path="delegacoes" element={<ProtectedRoute allowedRoles={["admin", "secretaria", "coordenacao_tecnica"]}><DelegacoesPage /></ProtectedRoute>} />
              <Route path="delegacoes/:delegationId" element={<ProtectedRoute allowedRoles={["admin", "secretaria", "coordenacao_tecnica"]}><DelegacaoDetalhePage /></ProtectedRoute>} />
              <Route path="importacao" element={<ProtectedRoute allowedRoles={["admin", "secretaria"]}><ImportacaoPage /></ProtectedRoute>} />
              <Route path="participantes" element={<ProtectedRoute allowedRoles={["admin", "secretaria", "coordenacao_tecnica"]}><ParticipantesPage /></ProtectedRoute>} />
              <Route path="participantes/:participantId" element={<ProtectedRoute allowedRoles={["admin", "secretaria", "coordenacao_tecnica"]}><ParticipanteDetalhePage /></ProtectedRoute>} />
              <Route path="participantes/:participantId/esportivo" element={<ProtectedRoute allowedRoles={["admin", "secretaria", "coordenacao_tecnica"]}><ParticipanteHistoricoPage /></ProtectedRoute>} />
              <Route path="credenciamento" element={<ProtectedRoute allowedRoles={["admin", "secretaria", "coordenacao_tecnica"]}><CredenciamentoPage /></ProtectedRoute>} />
              <Route path="validacao-qr" element={<ProtectedRoute allowedRoles={["admin", "secretaria", "coordenacao_tecnica", "transporte", "alimentacao"]}><ValidacaoQRPage /></ProtectedRoute>} />
              {/* Transporte */}
              <Route path="transporte/veiculos" element={<ProtectedRoute allowedRoles={[...TRANSPORT_ROLES]}><TransporteVeiculosPage /></ProtectedRoute>} />
              <Route path="transporte/rotas" element={<ProtectedRoute allowedRoles={[...TRANSPORT_ROLES]}><TransporteRotasPage /></ProtectedRoute>} />
              <Route path="transporte/viagens" element={<ProtectedRoute allowedRoles={[...TRANSPORT_ROLES]}><TransporteViagensPage /></ProtectedRoute>} />
              <Route path="transporte/embarque/:tripId" element={<ProtectedRoute allowedRoles={[...TRANSPORT_ROLES]}><TransporteEmbarquePage /></ProtectedRoute>} />
              {/* Alimentação */}
              <Route path="alimentacao/tipos" element={<ProtectedRoute allowedRoles={[...FOOD_ROLES]}><AlimentacaoTiposPage /></ProtectedRoute>} />
              <Route path="alimentacao/janelas" element={<ProtectedRoute allowedRoles={[...FOOD_ROLES]}><AlimentacaoJanelasPage /></ProtectedRoute>} />
              <Route path="alimentacao/consumo" element={<ProtectedRoute allowedRoles={[...FOOD_ROLES]}><AlimentacaoConsumoPage /></ProtectedRoute>} />
              {/* Alojamento */}
              <Route path="alojamento/locais" element={<ProtectedRoute allowedRoles={[...LODGING_ROLES]}><AlojamentoLocaisPage /></ProtectedRoute>} />
              <Route path="alojamento/unidades" element={<ProtectedRoute allowedRoles={[...LODGING_ROLES]}><AlojamentoUnidadesPage /></ProtectedRoute>} />
              <Route path="alojamento/ocupacao" element={<ProtectedRoute allowedRoles={[...LODGING_ROLES]}><AlojamentoOcupacaoPage /></ProtectedRoute>} />
              {/* Competição */}
              <Route path="competicao/central" element={<ProtectedRoute allowedRoles={[...COMPETITION_ROLES]}><CompeticaoCentralPage /></ProtectedRoute>} />
              <Route path="competicao/fases" element={<ProtectedRoute allowedRoles={[...COMPETITION_ROLES]}><CompeticaoFasesPage /></ProtectedRoute>} />
              <Route path="competicao/grupos" element={<ProtectedRoute allowedRoles={[...COMPETITION_ROLES]}><CompeticaoGruposPage /></ProtectedRoute>} />
              <Route path="competicao/partidas" element={<ProtectedRoute allowedRoles={[...COMPETITION_ROLES]}><CompeticaoPartidasPage /></ProtectedRoute>} />
              <Route path="competicao/agenda" element={<ProtectedRoute allowedRoles={[...COMPETITION_ROLES]}><CompeticaoAgendaPage /></ProtectedRoute>} />
              <Route path="competicao/partida/:matchId" element={<ProtectedRoute allowedRoles={[...COMPETITION_ROLES]}><CompeticaoPartidaDetalhePage /></ProtectedRoute>} />
              <Route path="competicao/equipes" element={<ProtectedRoute allowedRoles={[...COMPETITION_ROLES]}><CompeticaoEquipesPage /></ProtectedRoute>} />
              <Route path="competicao/resultados" element={<ProtectedRoute allowedRoles={[...COMPETITION_ROLES]}><CompeticaoResultadosPage /></ProtectedRoute>} />
              <Route path="competicao/sincronizar-equipes" element={<ProtectedRoute allowedRoles={[...COMPETITION_ROLES]}><SincronizarEquipesPage /></ProtectedRoute>} />
              <Route path="competicao/regras" element={<ProtectedRoute allowedRoles={[...COMPETITION_ROLES]}><RegrasProvaPage /></ProtectedRoute>} />
              <Route path="competicao/regras/lote" element={<ProtectedRoute allowedRoles={[...COMPETITION_ROLES]}><RegrasLotePage /></ProtectedRoute>} />
              {/* Credenciais */}
              <Route path="credenciais/modelos" element={<ProtectedRoute allowedRoles={["admin", "secretaria", "coordenacao_tecnica"]}><CredencialModelosPage /></ProtectedRoute>} />
              {/* Acessos */}
              <Route path="acessos/delegacoes" element={<ProtectedRoute allowedRoles={["admin", "secretaria"]}><AcessosDelegacoesPage /></ProtectedRoute>} />
              <Route path="acessos/usuarios" element={<ProtectedRoute allowedRoles={["admin", "secretaria"]}><AcessosUsuariosPage /></ProtectedRoute>} />
              {/* Parâmetros */}
              <Route path="parametros-evento" element={<ProtectedRoute allowedRoles={["admin", "secretaria", "coordenacao_tecnica"]}><ParametrosEventoPage /></ProtectedRoute>} />
              {/* Irregularidades e Normalização */}
              <Route path="irregularidades" element={<ProtectedRoute allowedRoles={["admin", "secretaria", "coordenacao_tecnica"]}><IrregularidadesPage /></ProtectedRoute>} />
              <Route path="normalizacao-provas" element={<ProtectedRoute allowedRoles={["admin", "secretaria", "coordenacao_tecnica"]}><NormalizacaoProvasPage /></ProtectedRoute>} />
              {/* Schema Validator */}
              <Route path="schema/validador" element={<ProtectedRoute allowedRoles={["admin", "secretaria"]}><SchemaValidadorPage /></ProtectedRoute>} />
              <Route path="mapa" element={<ProtectedRoute allowedRoles={["admin", "secretaria", "coordenacao_tecnica"]}><MapaSistemaPage /></ProtectedRoute>} />
              <Route path="diagnostico-competicao" element={<ProtectedRoute allowedRoles={["admin", "coordenacao_tecnica"]}><DiagnosticoCompeticaoPage /></ProtectedRoute>} />
              <Route path="dados" element={<ProtectedRoute allowedRoles={["admin", "secretaria", "coordenacao_tecnica"]}><CentralDadosPage /></ProtectedRoute>} />
              <Route path="boletins" element={<ProtectedRoute allowedRoles={["admin", "secretaria", "coordenacao_tecnica"]}><BoletinsPage /></ProtectedRoute>} />
              <Route path="demo" element={<ProtectedRoute allowedRoles={["admin", "coordenacao_tecnica"]}><DemoSeedsPage /></ProtectedRoute>} />
              <Route path="auth/email-templates" element={<ProtectedRoute allowedRoles={["admin", "secretaria", "coordenacao_tecnica"]}><EmailTemplatesPage /></ProtectedRoute>} />
              {/* Pesquisa */}
              <Route path="pesquisa" element={<ProtectedRoute allowedRoles={["admin", "secretaria"]}><PesquisaDashboardPage /></ProtectedRoute>} />
              <Route path="pesquisa/eventos" element={<ProtectedRoute allowedRoles={["admin", "secretaria"]}><PesquisaEventosPage /></ProtectedRoute>} />
              <Route path="pesquisa/pesquisadores" element={<ProtectedRoute allowedRoles={["admin", "secretaria"]}><PesquisaPesquisadoresPage /></ProtectedRoute>} />
              {/* Links & Páginas */}
              <Route path="links" element={<ProtectedRoute allowedRoles={["admin", "secretaria"]}><LinksPage /></ProtectedRoute>} />
              <Route path="links/novo" element={<ProtectedRoute allowedRoles={["admin", "secretaria"]}><LinkFormPage /></ProtectedRoute>} />
              <Route path="links/:id" element={<ProtectedRoute allowedRoles={["admin", "secretaria"]}><LinkFormPage /></ProtectedRoute>} />
              <Route path="links/preview/:id" element={<ProtectedRoute allowedRoles={["admin", "secretaria"]}><LinkPreviewPage /></ProtectedRoute>} />
              {/* Relatórios */}
              <Route path="relatorios" element={<ProtectedRoute allowedRoles={["admin", "secretaria", "coordenacao_tecnica"]}><ReportCenterPage /></ProtectedRoute>} />
              <Route path="atletas/qrcode" element={<ProtectedRoute allowedRoles={["admin", "secretaria"]}><AtletaQrCodePage /></ProtectedRoute>} />
            </Route>
            {/* PWA Auth pages (public) */}
            <Route path="/pwa/login" element={<PwaLoginPage />} />
            <Route path="/pwa/recover" element={<PwaRecoverPage />} />
            <Route path="/pwa/set-password" element={<PwaSetPasswordPage />} />
            {/* PWA Landing (requires auth) */}
            <Route path="/pwa" element={<PwaLandingPage />} />
            {/* PWA Module pages */}
            <Route path="/pwa/:module" element={<PwaModulePage />} />
            {/* PWA Pesquisa (PIN auth, no Supabase Auth) */}
            <Route path="/pwa/pesquisa/login" element={<PesquisaLoginPage />} />
            <Route path="/pwa/pesquisa/home" element={<PesquisaHomePage />} />
            <Route path="/pwa/pesquisa/nova" element={<PesquisaNovaPage />} />
            <Route path="/pwa/pesquisa/confirmacao" element={<PesquisaConfirmacaoPage />} />
            {/* PWA Alojamento */}
            <Route path="/pwa/alojamento" element={<AlojamentoHomePage />} />
            <Route path="/pwa/alojamento/scan" element={<AlojamentoScanPage />} />
            <Route path="/pwa/alojamento/buscar" element={<AlojamentoBuscarPage />} />
            <Route path="/pwa/alojamento/ocupacao" element={<AlojamentoOcupacaoPage2 />} />
            <Route path="/pwa/alojamento/pessoa/:id" element={<AlojamentoPessoaPage />} />
            <Route path="/pwa/alojamento/incidentes" element={<AlojamentoIncidentesPage />} />
            <Route path="/pwa/alojamento/incidentes/nova" element={<AlojamentoNovoIncidentePage />} />
            {/* PWA Transporte */}
            <Route path="/pwa/transporte" element={<TransporteHomePage />} />
            <Route path="/pwa/transporte/viagens" element={<TransporteViagensPwaPage />} />
            <Route path="/pwa/transporte/scan" element={<TransporteScanPage />} />
            <Route path="/pwa/transporte/embarque" element={<TransporteEmbarquePwaPage />} />
            <Route path="/pwa/transporte/rotas" element={<TransporteRotasPwaPage />} />
            {/* PWA Alimentação */}
            <Route path="/pwa/alimentacao" element={<AlimentacaoHomePage />} />
            <Route path="/pwa/alimentacao/scan" element={<AlimentacaoScanPage />} />
            <Route path="/pwa/alimentacao/buscar" element={<AlimentacaoBuscarPwaPage />} />
            <Route path="/pwa/alimentacao/janelas" element={<AlimentacaoJanelasPwaPage />} />
            <Route path="/pwa/alimentacao/historico" element={<AlimentacaoHistoricoPage />} />
            {/* PWA Coordenação Técnica */}
            <Route path="/pwa/coordenacao-tecnica" element={<CoordenacaoHomePage />} />
            <Route path="/pwa/coordenacao-tecnica/agenda" element={<CoordenacaoAgendaPage />} />
            <Route path="/pwa/coordenacao-tecnica/partidas" element={<CoordenacaoPartidasPage />} />
            <Route path="/pwa/coordenacao-tecnica/partida/:matchId" element={<CoordenacaoPartidaDetalhePage />} />
            <Route path="/pwa/coordenacao-tecnica/resultados" element={<CoordenacaoResultadosPwaPage />} />
            <Route path="/pwa/coordenacao-tecnica/estatisticas" element={<CoordenacaoEstatisticasPage />} />
            {/* PWA Delegação */}
            <Route path="/pwa/delegacao" element={<DelegacaoHomePage />} />
            <Route path="/pwa/delegacao/participantes" element={<DelegacaoParticipantesPage />} />
            <Route path="/pwa/delegacao/agenda" element={<DelegacaoAgendaPage />} />
            <Route path="/pwa/delegacao/logistica" element={<DelegacaoLogisticaPage />} />
            <Route path="/pwa/delegacao/locais" element={<DelegacaoLocaisPage />} />
            {/* Public content routes */}
            <Route path="/go/:slug" element={<GoRedirectPage />} />
            <Route path="/p/:slug" element={<PublicPagePage />} />
            <Route path="/a/:token" element={<AtletaPublicProfilePage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          </EventProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
