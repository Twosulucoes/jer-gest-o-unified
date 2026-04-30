import { lazy, Suspense } from "react";
import { Route, Routes, Navigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import ProtectedRoute from "@/components/ProtectedRoute";
import SuperAdminRoute from "@/components/SuperAdminRoute";
import AdminLayout from "@/components/AdminLayout";
import RedirectToEtapas from "@/components/admin/RedirectToEtapas";
import StageLayout from "@/components/StageLayout";
import SuperAdminLayout from "@/components/SuperAdminLayout";
import PwaRouteGuard from "@/components/pwa/PwaRouteGuard";
import { COMPETITION_ROLES } from "@/config/accessControl";

// Core Pages
import Index from "../pages/Index";
import LoginPage from "../pages/LoginPage";
import StatusPage from "../pages/Status";

// Admin Pages
const DashboardPage = lazy(() => import("../pages/admin/DashboardPage"));
const EventosPage = lazy(() => import("../pages/admin/EventosPage"));
const EventStagesPage = lazy(() => import("../pages/admin/EventStagesPage"));
const EtapasIndexPage = lazy(() => import("../pages/admin/EtapasIndexPage"));
const EtapaHubPage = lazy(() => import("../pages/admin/EtapaHubPage"));
const ModalidadesPage = lazy(() => import("../pages/admin/ModalidadesPage"));
const CategoriasPage = lazy(() => import("../pages/admin/CategoriasPage"));
const LocaisPage = lazy(() => import("../pages/admin/LocaisPage"));
const InstituicoesPage = lazy(() => import("../pages/admin/InstituicoesPage"));
const DelegacoesPage = lazy(() => import("../pages/admin/DelegacoesPage"));
const DelegacaoDetalhePage = lazy(() => import("../pages/admin/DelegacaoDetalhePage"));
const ImportacaoPage = lazy(() => import("../pages/admin/ImportacaoPage"));
const ImportacaoModeloPage = lazy(() => import("../pages/admin/ImportacaoModeloPage"));
const ImportacaoPendenciasPage = lazy(() => import("../pages/admin/ImportacaoPendenciasPage"));
const ImportacaoAliasesPage = lazy(() => import("../pages/admin/ImportacaoAliasesPage"));
const ParticipantesPage = lazy(() => import("../pages/admin/ParticipantesPage"));
const HistoricoBuscaPage = lazy(() => import("../pages/admin/HistoricoBuscaPage"));
const DuplicidadesPessoasPage = lazy(() => import("../pages/admin/DuplicidadesPessoasPage"));
const ParticipanteDetalhePage = lazy(() => import("../pages/admin/ParticipanteDetalhePage"));
const ParticipanteHistoricoPage = lazy(() => import("../pages/admin/ParticipanteHistoricoPage"));
const PessoasPage = lazy(() => import("../pages/admin/PessoasPage"));
const EventuaisPage = lazy(() => import("../pages/admin/EventuaisPage"));
const ArbitrosPage = lazy(() => import("../pages/admin/ArbitrosPage"));
const RegrasPage = lazy(() => import("../pages/admin/RegrasPage"));
const ComplianceDashboardPage = lazy(() => import("../pages/admin/ComplianceDashboardPage"));
const AuditoriaPage = lazy(() => import("../pages/admin/AuditoriaPage"));
const PwaStatusPage = lazy(() => import("../pages/admin/PwaStatusPage"));
const DatabaseMonitoringPage = lazy(() => import("../pages/admin/DatabaseMonitoringPage"));
const SistemaDiagnosticoPage = lazy(() => import("../pages/admin/SistemaDiagnosticoPage"));
const SistemaDiagnosticoKpiPage = lazy(() => import("../pages/admin/SistemaDiagnosticoKpiPage"));
const CentralDadosPage = lazy(() => import("../pages/admin/CentralDadosPage"));
const CentralControlePage = lazy(() => import("../pages/admin/CentralControlePage"));
const SchemaValidadorPage = lazy(() => import("../pages/admin/SchemaValidadorPage"));
const ResetPasswordPage = lazy(() => import("../pages/ResetPasswordPage"));
const ModuleSelectorPage = lazy(() => import("../pages/ModuleSelectorPage"));
const AccessDeniedPage = lazy(() => import("../pages/AccessDeniedPage"));
const CoordenadorModalidadeDashboard = lazy(() => import("../pages/admin/CoordenadorModalidadeDashboard"));
const AjudaChamadosPage = lazy(() => import("../pages/admin/AjudaChamadosPage"));
const AjudaChatPage = lazy(() => import("../pages/admin/AjudaChatPage"));
const AjudaManualPage = lazy(() => import("../pages/admin/AjudaManualPage"));
const CompeticaoPartidaDetalhePage = lazy(() => import("../pages/admin/CompeticaoPartidaDetalhePage"));
const CompeticaoLancamentoScorePage = lazy(() => import("../pages/admin/CompeticaoLancamentoScorePage"));
const CompeticaoLancamentoSetsPage = lazy(() => import("../pages/admin/CompeticaoLancamentoSetsPage"));
const CompeticaoLancamentoCombatPage = lazy(() => import("../pages/admin/CompeticaoLancamentoCombatPage"));
const CompeticaoLancamentoTimeMarkPage = lazy(() => import("../pages/admin/CompeticaoLancamentoTimeMarkPage"));
const CompeticaoPainelTimeMarkPage = lazy(() => import("../pages/admin/CompeticaoPainelTimeMarkPage"));
const CompeticaoPainelRankingPage = lazy(() => import("../pages/admin/CompeticaoPainelRankingPage"));
const CredencialModelosPage = lazy(() => import("../pages/admin/CredencialModelosPage"));
const AcessosDelegacoesPage = lazy(() => import("../pages/admin/AcessosDelegacoesPage"));
const AcessosUsuariosPage = lazy(() => import("../pages/admin/AcessosUsuariosPage"));
const AcessosPwaAuditPage = lazy(() => import("../pages/admin/AcessosPwaAuditPage"));
const IrregularidadesPage = lazy(() => import("../pages/admin/IrregularidadesPage"));
const NormalizacaoProvasPage = lazy(() => import("../pages/admin/NormalizacaoProvasPage"));
const BoletinsPorModalidadePage = lazy(() => import("../pages/admin/relatorios/BoletinsPorModalidadePage"));
const DashboardOperacionalPage = lazy(() => import("../pages/admin/relatorios/DashboardOperacionalPage"));
const QuadroMedalhasPage = lazy(() => import("../pages/admin/relatorios/QuadroMedalhasPage"));
const PrestacaoContasOscPage = lazy(() => import("../pages/admin/relatorios/PrestacaoContasOscPage"));
const CompeticaoPublicacaoPage = lazy(() => import("../pages/admin/CompeticaoPublicacaoPage"));
const CompeticaoBoletinsPage = lazy(() => import("../pages/admin/CompeticaoBoletinsPage"));
const LinksPage = lazy(() => import("../pages/admin/LinksPage"));
const LinkFormPage = lazy(() => import("../pages/admin/LinkFormPage"));
const LinkPreviewPage = lazy(() => import("../pages/admin/LinkPreviewPage"));
const RegistrosPage = lazy(() => import("../pages/admin/registros/RegistrosPage"));
const ConfigOscPage = lazy(() => import("../pages/admin/registros/ConfigOscPage"));
const OscAccountabilityModule = lazy(() => import("../pages/admin/registros/OscAccountabilityModule"));
const SeedLogisticaEtapaPage = lazy(() => import("../pages/admin/SeedLogisticaEtapaPage"));
const ClonarLogisticaPage = lazy(() => import("../pages/admin/ClonarLogisticaPage"));
const DebugPublicadosPage = lazy(() => import("../pages/admin/DebugPublicadosPage"));
const EmailTemplatesPage = lazy(() => import("../pages/admin/EmailTemplatesPage"));
const StageHomePage = lazy(() => import("../pages/admin/StageHomePage"));
const StageReportsPage = lazy(() => import("../pages/admin/StageReportsPage"));

// Operational Module Pages (Admin/Stage)
const CredenciamentoPage = lazy(() => import("../pages/admin/CredenciamentoPage"));
const CredenciamentoExternoPage = lazy(() => import("../pages/admin/CredenciamentoExternoPage"));
const ValidacaoQRPage = lazy(() => import("../pages/admin/ValidacaoQRPage"));
const CompeticaoPartidasAgendaPage = lazy(() => import("../pages/admin/CompeticaoPartidasAgendaPage"));
const CompeticaoResultadosPage = lazy(() => import("../pages/admin/CompeticaoResultadosPage"));
const AlojamentoHubPage = lazy(() => import("../pages/admin/AlojamentoHubPage"));
const AlimentacaoHubPage = lazy(() => import("../pages/admin/AlimentacaoHubPage"));
const TransporteHubPage = lazy(() => import("../pages/admin/TransporteHubPage"));
const OcorrenciasPage = lazy(() => import("../pages/admin/OcorrenciasPage"));
const PesquisaDashboardPage = lazy(() => import("../pages/admin/PesquisaDashboardPage"));
const VouchersPage = lazy(() => import("../pages/admin/VouchersPage"));
const ProtestosFilaPage = lazy(() => import("../pages/admin/ProtestosFilaPage"));

// Transporte Subpages (Admin)
const AdminTransporteViagensPage = lazy(() => import("../pages/admin/TransporteViagensPage"));
const AdminTransporteRotasPage = lazy(() => import("../pages/admin/TransporteRotasPage"));
const AdminTransporteEmbarquePage = lazy(() => import("../pages/admin/TransporteEmbarquePage"));
const AdminTransporteVeiculosPage = lazy(() => import("../pages/admin/TransporteVeiculosPage"));

// Alimentacao Subpages (Admin)
const AdminAlimentacaoJanelasPage = lazy(() => import("../pages/admin/AlimentacaoJanelasPage"));
const AdminAlimentacaoConsumoPage = lazy(() => import("../pages/admin/AlimentacaoConsumoPage"));
const AdminAlimentacaoPrevisaoPage = lazy(() => import("../pages/admin/AlimentacaoPrevisaoPage"));

// Alojamento Subpages (Admin)
const AdminAlojamentoOcupacaoPage = lazy(() => import("../pages/admin/AlojamentoOcupacaoPage"));
const AdminAlojamentoUnidadesPage = lazy(() => import("../pages/admin/AlojamentoUnidadesPage"));
const AdminAlojamentoPresencaPage = lazy(() => import("../pages/admin/AlojamentoPresencaPage"));

// Competicao Subpages (Admin)
const CompeticaoPainelPage = lazy(() => import("../pages/admin/CompeticaoPainelPage"));
const CompeticaoEquipesPage = lazy(() => import("../pages/admin/CompeticaoEquipesPage"));




// Super Pages
const SuperDashboardPage = lazy(() => import("../pages/super/SuperDashboardPage"));
const SuperEventosPage = lazy(() => import("../pages/super/SuperEventosPage"));
const SuperLogsPage = lazy(() => import("../pages/super/SuperLogsPage"));
const SuperConfigPage = lazy(() => import("../pages/super/SuperConfigPage"));
const SuperMonitorPage = lazy(() => import("../pages/super/SuperMonitorPage"));
const SuperManualPage = lazy(() => import("../pages/super/SuperManualPage"));
const SuperChamadosPage = lazy(() => import("../pages/super/SuperChamadosPage"));
const SuperInspectorPage = lazy(() => import("../pages/super/SuperInspectorPage"));
const SuperPermissionsPage = lazy(() => import("../pages/super/SuperPermissionsPage"));
const SuperFamiliasInferidasPage = lazy(() => import("../pages/super/SuperFamiliasInferidasPage"));
const DocumentationPage = lazy(() => import("../pages/super/DocumentationPage"));


// PWA Pages
const PwaLayout = lazy(() => import("../components/pwa/PwaLayout"));
const PwaLandingPage = lazy(() => import("../pages/pwa/PwaLandingPage"));
const PwaModulePage = lazy(() => import("../pages/pwa/PwaModulePage"));
const PwaInstallPage = lazy(() => import("../pages/pwa/PwaInstallPage"));
const AlojamentoHomePage = lazy(() => import("../pages/pwa/alojamento/AlojamentoHomePage"));
const AlojamentoScanPage = lazy(() => import("../pages/pwa/alojamento/AlojamentoScanPage"));
const AlojamentoBuscarPage = lazy(() => import("../pages/pwa/alojamento/AlojamentoBuscarPage"));
const AlojamentoOcupacaoPage = lazy(() => import("../pages/pwa/alojamento/AlojamentoOcupacaoPage"));
const AlojamentoPessoaPage = lazy(() => import("../pages/pwa/alojamento/AlojamentoPessoaPage"));
const AlojamentoIncidentesPage = lazy(() => import("../pages/pwa/alojamento/AlojamentoIncidentesPage"));
const AlojamentoNovoIncidentePage = lazy(() => import("../pages/pwa/alojamento/AlojamentoNovoIncidentePage"));
const AlojamentoListaCompletaPage = lazy(() => import("../pages/pwa/alojamento/AlojamentoListaCompletaPage"));
const AlojamentoUnidadeFaltososPage = lazy(() => import("../pages/pwa/alojamento/AlojamentoUnidadeFaltososPage"));
const TransporteHomePage = lazy(() => import("../pages/pwa/transporte/TransporteHomePage"));
const TransporteViagensPage = lazy(() => import("../pages/pwa/transporte/TransporteViagensPage"));
const TransporteScanPage = lazy(() => import("../pages/pwa/transporte/TransporteScanPage"));
const TransporteEmbarquePage = lazy(() => import("../pages/pwa/transporte/TransporteEmbarquePage"));
const TransporteRotasPage = lazy(() => import("../pages/pwa/transporte/TransporteRotasPage"));
const TransportePassageirosPage = lazy(() => import("../pages/pwa/transporte/TransportePassageirosPage"));
const AlimentacaoHomePage = lazy(() => import("../pages/pwa/alimentacao/AlimentacaoHomePage"));
const AlimentacaoScanPage = lazy(() => import("../pages/pwa/alimentacao/AlimentacaoScanPage"));
const AlimentacaoBuscarPage = lazy(() => import("../pages/pwa/alimentacao/AlimentacaoBuscarPage"));
const AlimentacaoJanelasPage = lazy(() => import("../pages/pwa/alimentacao/AlimentacaoJanelasPage"));
const AlimentacaoListaConsumosPage = lazy(() => import("../pages/pwa/alimentacao/AlimentacaoListaConsumosPage"));
const CoordenacaoHomePage = lazy(() => import("../pages/pwa/coordenacao/CoordenacaoHomePage"));
const CoordenacaoAgendaPage = lazy(() => import("../pages/pwa/coordenacao/CoordenacaoAgendaPage"));
const CoordenacaoPartidasPage = lazy(() => import("../pages/pwa/coordenacao/CoordenacaoPartidasPage"));
const CoordenacaoPartidaDetalhePage = lazy(() => import("../pages/pwa/coordenacao/CoordenacaoPartidaDetalhePage"));
const CoordenacaoResultadosPage = lazy(() => import("../pages/pwa/coordenacao/CoordenacaoResultadosPage"));
const CoordenacaoEstatisticasPage = lazy(() => import("../pages/pwa/coordenacao/CoordenacaoEstatisticasPage"));
const CoordenacaoConsultaPage = lazy(() => import("../pages/pwa/coordenacao/CoordenacaoConsultaPage"));
const CoordenacaoIncidentePage = lazy(() => import("../pages/pwa/coordenacao/CoordenacaoIncidentePage"));
const CoordenacaoIncidentesPage = lazy(() => import("../pages/pwa/coordenacao/CoordenacaoIncidentesPage"));
const ResultadosHomePage = lazy(() => import("../pages/pwa/resultados/ResultadosHomePage"));
const ResultadosPartidasPage = lazy(() => import("../pages/pwa/resultados/ResultadosPartidasPage"));
const ResultadosPartidaFormPage = lazy(() => import("../pages/pwa/resultados/ResultadosPartidaFormPage"));
const DelegacaoHomePage = lazy(() => import("../pages/pwa/delegacao/DelegacaoHomePage"));
const DelegacaoParticipantesPage = lazy(() => import("../pages/pwa/delegacao/DelegacaoParticipantesPage"));
const DelegacaoAgendaPage = lazy(() => import("../pages/pwa/delegacao/DelegacaoAgendaPage"));
const DelegacaoLogisticaPage = lazy(() => import("../pages/pwa/delegacao/DelegacaoLogisticaPage"));
const DelegacaoLocaisPage = lazy(() => import("../pages/pwa/delegacao/DelegacaoLocaisPage"));
const DelegacaoProtestosPage = lazy(() => import("../pages/pwa/delegacao/DelegacaoProtestosPage"));
const DelegacaoProtestoNovoPage = lazy(() => import("../pages/pwa/delegacao/DelegacaoProtestoNovoPage"));
const DelegacaoProtestoDetalhePage = lazy(() => import("../pages/pwa/delegacao/DelegacaoProtestoDetalhePage"));
const PwaDebugPage = lazy(() => import("../pages/pwa/PwaDebugPage"));
const QrDiagnosticoPage = lazy(() => import("../pages/pwa/diagnostico/QrDiagnosticoPage"));
const VincularCredencialPage = lazy(() => import("../pages/pwa/credenciamento/VincularCredencialPage"));
const PwaSelectionFallback = lazy(() => import("../pages/pwa/PwaSelectionFallback"));
const PwaNotFoundHandler = lazy(() => import("../components/pwa/PwaNotFoundHandler"));


// Public Pages
const PublicResultsPage = lazy(() => import("../pages/public/PublicResultsPage"));
const PublicMedalTablePage = lazy(() => import("../pages/public/PublicMedalTablePage"));
const AtletaPublicProfilePage = lazy(() => import("../pages/public/AtletaPublicProfilePage"));
const EntregaTecnicaPage = lazy(() => import("../pages/public/EntregaTecnicaPage"));
const NotFound = lazy(() => import("../pages/NotFound"));

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[50vh]">
    <div className="space-y-4 text-center">
      <Skeleton className="h-8 w-48 mx-auto" />
      <Skeleton className="h-4 w-64 mx-auto" />
    </div>
  </div>
);

export const AppRoutes = () => (
  <Suspense fallback={<PageLoader />}>
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/status" element={<StatusPage />} />
      <Route path="/redefinir-senha" element={<ResetPasswordPage />} />
      <Route path="/selecionar-modulo" element={<ModuleSelectorPage />} />
      <Route path="/acesso-negado" element={<AccessDeniedPage />} />

      {/* Super Admin routes */}
      <Route path="/super" element={<SuperAdminRoute><SuperAdminLayout /></SuperAdminRoute>}>
        <Route index element={<SuperDashboardPage />} />
        <Route path="eventos" element={<SuperEventosPage />} />
        <Route path="logs" element={<SuperLogsPage />} />
        <Route path="config" element={<SuperConfigPage />} />
        <Route path="monitor" element={<SuperMonitorPage />} />
        <Route path="registros/familias-inferidas" element={<SuperFamiliasInferidasPage />} />
        <Route path="manual" element={<SuperManualPage />} />
        <Route path="chamados" element={<SuperChamadosPage />} />
        <Route path="validador" element={<SchemaValidadorPage />} />
        <Route path="inspector" element={<SuperInspectorPage />} />
        <Route path="permissoes" element={<SuperPermissionsPage />} />
        <Route path="dados" element={<CentralDadosPage />} />
        <Route path="diagnostico" element={<SistemaDiagnosticoPage />} />
        <Route path="documentacao" element={<DocumentationPage />} />
      </Route>

      <Route path="/admin" element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}>
        <Route index element={<DashboardPage />} />
        <Route path="coordenador-modalidade" element={<ProtectedRoute allowedRoles={["coordenador_modalidade"]}><CoordenadorModalidadeDashboard /></ProtectedRoute>} />
        <Route path="ajuda/chamados" element={<AjudaChamadosPage />} />
        <Route path="eventos" element={<ProtectedRoute allowedRoles={["admin", "secretaria", "coordenacao_tecnica"]}><EventosPage /></ProtectedRoute>} />
        <Route path="eventos/etapas" element={<ProtectedRoute allowedRoles={["admin", "secretaria", "coordenacao_tecnica"]}><EventStagesPage /></ProtectedRoute>} />
        <Route path="etapas" element={<ProtectedRoute allowedRoles={["admin", "secretaria", "coordenacao_tecnica", "coordenador_modalidade"]}><EtapasIndexPage /></ProtectedRoute>} />
        <Route path="etapas/:stageId" element={<ProtectedRoute allowedRoles={["admin", "secretaria", "coordenacao_tecnica", "coordenador_modalidade"]}><EtapaHubPage /></ProtectedRoute>} />
        <Route path="etapa/:stageId" element={<ProtectedRoute allowedRoles={["admin", "secretaria", "coordenacao_tecnica", "coordenador_modalidade"]}><StageLayout /></ProtectedRoute>}>
           <Route index element={<StageHomePage />} />
           <Route path="reports" element={<StageReportsPage />} />
           <Route path="credenciamento" element={<CredenciamentoPage />} />
           <Route path="credenciamento-externo" element={<CredenciamentoExternoPage />} />
           <Route path="validacao-qr" element={<ValidacaoQRPage />} />
           <Route path="competicao/partidas-agenda" element={<CompeticaoPartidasAgendaPage />} />
           <Route path="competicao/resultados" element={<CompeticaoResultadosPage />} />
           <Route path="competicao/painel" element={<CompeticaoPainelPage />} />
           <Route path="competicao/equipes" element={<CompeticaoEquipesPage />} />
           <Route path="competicao/partida/:matchId" element={<CompeticaoPartidaDetalhePage />} />
           <Route path="competicao" element={<Navigate to="partidas-agenda" replace />} />
           <Route path="alojamento" element={<AlojamentoHubPage />} />
           <Route path="alojamento/ocupacao" element={<AdminAlojamentoOcupacaoPage />} />
           <Route path="alojamento/unidades" element={<AdminAlojamentoUnidadesPage />} />
           <Route path="alojamento/presenca" element={<AdminAlojamentoPresencaPage />} />
           <Route path="alimentacao" element={<AlimentacaoHubPage />} />
           <Route path="alimentacao/janelas" element={<AdminAlimentacaoJanelasPage />} />
           <Route path="alimentacao/consumos" element={<AdminAlimentacaoConsumoPage />} />
           <Route path="alimentacao/previsao" element={<AdminAlimentacaoPrevisaoPage />} />
           <Route path="transporte" element={<TransporteHubPage />} />
           <Route path="transporte/viagens" element={<AdminTransporteViagensPage />} />
           <Route path="transporte/rotas" element={<AdminTransporteRotasPage />} />
           <Route path="transporte/veiculos" element={<AdminTransporteVeiculosPage />} />
           <Route path="transporte/embarque/:tripId" element={<AdminTransporteEmbarquePage />} />
           <Route path="ocorrencias" element={<OcorrenciasPage />} />
           <Route path="pesquisa" element={<PesquisaDashboardPage />} />
           <Route path="vouchers" element={<VouchersPage />} />
           <Route path="protestos" element={<ProtestosFilaPage />} />
           <Route path="relatorios" element={<StageReportsPage />} />
        </Route>


        <Route path="arbitragem" element={<ProtectedRoute allowedRoles={["admin", "secretaria", "coordenacao_tecnica"]}><ArbitrosPage /></ProtectedRoute>} />
        <Route path="modalidades" element={<ProtectedRoute allowedRoles={["admin", "secretaria", "coordenacao_tecnica"]}><ModalidadesPage /></ProtectedRoute>} />
        <Route path="categorias" element={<ProtectedRoute allowedRoles={["admin", "secretaria", "coordenacao_tecnica"]}><CategoriasPage /></ProtectedRoute>} />
        <Route path="locais" element={<ProtectedRoute allowedRoles={["admin", "secretaria", "coordenacao_tecnica"]}><LocaisPage /></ProtectedRoute>} />
        <Route path="instituicoes" element={<ProtectedRoute allowedRoles={["admin", "secretaria", "coordenacao_tecnica"]}><InstituicoesPage /></ProtectedRoute>} />
        <Route path="delegacoes" element={<ProtectedRoute allowedRoles={["admin", "secretaria", "coordenacao_tecnica"]}><DelegacoesPage /></ProtectedRoute>} />
        <Route path="delegacoes/:delegationId" element={<ProtectedRoute allowedRoles={["admin", "secretaria", "coordenacao_tecnica"]}><DelegacaoDetalhePage /></ProtectedRoute>} />
        <Route path="importacao" element={<ProtectedRoute allowedRoles={["admin", "secretaria", "super_admin"]}><ImportacaoPage /></ProtectedRoute>} />
        <Route path="importacao/modelo" element={<ProtectedRoute allowedRoles={["admin", "secretaria"]}><ImportacaoModeloPage /></ProtectedRoute>} />
        <Route path="importacao/pendencias" element={<ProtectedRoute allowedRoles={["admin", "secretaria"]}><ImportacaoPendenciasPage /></ProtectedRoute>} />
        <Route path="importacao/aliases" element={<ProtectedRoute allowedRoles={["super_admin"]}><ImportacaoAliasesPage /></ProtectedRoute>} />
        <Route path="participantes" element={<ProtectedRoute allowedRoles={["admin", "secretaria", "coordenacao_tecnica", "coordenador_modalidade"]}><ParticipantesPage /></ProtectedRoute>} />
        <Route path="participantes/historico" element={<ProtectedRoute allowedRoles={["admin", "secretaria", "coordenacao_tecnica", "coordenador_modalidade"]}><HistoricoBuscaPage /></ProtectedRoute>} />
        <Route path="participantes/duplicidades" element={<ProtectedRoute allowedRoles={["admin", "secretaria"]}><DuplicidadesPessoasPage /></ProtectedRoute>} />
        <Route path="participantes/:participantId" element={<ProtectedRoute allowedRoles={["admin", "secretaria", "coordenacao_tecnica", "coordenador_modalidade"]}><ParticipanteDetalhePage /></ProtectedRoute>} />
        <Route path="participantes/:participantId/esportivo" element={<ProtectedRoute allowedRoles={["admin", "secretaria", "coordenacao_tecnica", "coordenador_modalidade"]}><ParticipanteHistoricoPage /></ProtectedRoute>} />
        <Route path="pessoas" element={<ProtectedRoute allowedRoles={["admin", "secretaria", "super_admin"]}><PessoasPage /></ProtectedRoute>} />
        <Route path="pessoas/duplicidades" element={<ProtectedRoute allowedRoles={["admin", "secretaria", "super_admin"]}><DuplicidadesPessoasPage /></ProtectedRoute>} />
        <Route path="pessoas/eventuais" element={<ProtectedRoute allowedRoles={["admin", "secretaria", "super_admin"]}><EventuaisPage /></ProtectedRoute>} />
        <Route path="credenciais/modelos" element={<ProtectedRoute allowedRoles={["admin", "secretaria", "coordenacao_tecnica"]}><CredencialModelosPage /></ProtectedRoute>} />
        <Route path="acessos/delegacoes" element={<ProtectedRoute allowedRoles={["super_admin", "admin", "secretaria"]}><AcessosDelegacoesPage /></ProtectedRoute>} />
        <Route path="acessos/usuarios" element={<ProtectedRoute allowedRoles={["super_admin", "admin", "secretaria"]}><AcessosUsuariosPage /></ProtectedRoute>} />
        <Route path="acessos/pwa" element={<ProtectedRoute allowedRoles={["super_admin", "admin", "secretaria"]}><AcessosPwaAuditPage /></ProtectedRoute>} />
        <Route path="central-controle" element={<ProtectedRoute allowedRoles={["super_admin"]}><CentralControlePage /></ProtectedRoute>} />
        <Route path="auditoria" element={<ProtectedRoute allowedRoles={["super_admin", "admin", "secretaria"]}><AuditoriaPage /></ProtectedRoute>} />
        <Route path="conformidade" element={<ProtectedRoute allowedRoles={["admin", "secretaria", "coordenacao_tecnica", "super_admin"]}><ComplianceDashboardPage /></ProtectedRoute>} />
        <Route path="regras" element={<ProtectedRoute allowedRoles={["admin", "secretaria", "coordenacao_tecnica"]}><RegrasPage /></ProtectedRoute>} />
        <Route path="irregularidades" element={<ProtectedRoute allowedRoles={["admin", "secretaria", "coordenacao_tecnica"]}><IrregularidadesPage /></ProtectedRoute>} />
        <Route path="normalizacao-provas" element={<ProtectedRoute allowedRoles={["admin", "secretaria", "coordenacao_tecnica"]}><NormalizacaoProvasPage /></ProtectedRoute>} />
        <Route path="sistema/diagnostico" element={<ProtectedRoute allowedRoles={["super_admin"]}><SistemaDiagnosticoPage /></ProtectedRoute>} />
        <Route path="sistema/diagnostico/kpi" element={<ProtectedRoute allowedRoles={["admin", "super_admin"]}><SistemaDiagnosticoKpiPage /></ProtectedRoute>} />
        <Route path="monitoramento-db" element={<ProtectedRoute allowedRoles={["super_admin", "admin"]}><DatabaseMonitoringPage /></ProtectedRoute>}>
        </Route>
        <Route path="pwa-status" element={<ProtectedRoute allowedRoles={["super_admin", "admin", "secretaria"]}><PwaStatusPage /></ProtectedRoute>} />
        <Route path="sistema/debug-pwa" element={<ProtectedRoute allowedRoles={["admin", "super_admin"]}><PwaDebugPage /></ProtectedRoute>} />
        <Route path="sistema/debug-qr" element={<ProtectedRoute allowedRoles={["admin", "super_admin"]}><QrDiagnosticoPage /></ProtectedRoute>} />
        <Route path="dados" element={<ProtectedRoute allowedRoles={["super_admin"]}><CentralDadosPage /></ProtectedRoute>} />
        <Route path="relatorios/boletins" element={<ProtectedRoute allowedRoles={["admin", "secretaria", "coordenacao_tecnica", "coordenador_modalidade"]}><BoletinsPorModalidadePage /></ProtectedRoute>} />
        <Route path="relatorios/dashboard" element={<ProtectedRoute allowedRoles={["admin", "secretaria"]}><DashboardOperacionalPage /></ProtectedRoute>} />
        <Route path="relatorios/quadro-medalhas" element={<ProtectedRoute allowedRoles={["admin", "secretaria", "coordenacao_tecnica", "coordenador_modalidade"]}><QuadroMedalhasPage /></ProtectedRoute>} />
        <Route path="relatorios/osc" element={<ProtectedRoute allowedRoles={["admin", "secretaria", "super_admin"]}><PrestacaoContasOscPage /></ProtectedRoute>} />
        <Route path="seed-logistica" element={<ProtectedRoute allowedRoles={["super_admin"]}><SeedLogisticaEtapaPage /></ProtectedRoute>} />
        <Route path="clonar-logistica" element={<ProtectedRoute allowedRoles={["admin", "secretaria", "super_admin"]}><ClonarLogisticaPage /></ProtectedRoute>} />
        <Route path="debug-publicados" element={<ProtectedRoute allowedRoles={["super_admin"]}><DebugPublicadosPage /></ProtectedRoute>} />
        <Route path="auth/email-templates" element={<ProtectedRoute allowedRoles={["super_admin"]}><EmailTemplatesPage /></ProtectedRoute>} />
        <Route path="competicao/publicacao" element={<ProtectedRoute allowedRoles={["admin", "secretaria"]}><CompeticaoPublicacaoPage /></ProtectedRoute>} />
        <Route path="competicao/boletins" element={<ProtectedRoute allowedRoles={["admin", "secretaria", "coordenacao_tecnica", "delegacao"]}><CompeticaoBoletinsPage /></ProtectedRoute>} />
        <Route path="competicao/partida/:matchId" element={<ProtectedRoute allowedRoles={[...COMPETITION_ROLES, "mesario"]}><CompeticaoPartidaDetalhePage /></ProtectedRoute>} />
        <Route path="competicao/resultados" element={<ProtectedRoute allowedRoles={["admin", "secretaria", "coordenacao_tecnica", "coordenador_modalidade"]}><BoletinsPorModalidadePage /></ProtectedRoute>} />
        <Route path="competicao/painel-score/:sportEventId/confronto/:matchId/resultado" element={<ProtectedRoute allowedRoles={[...COMPETITION_ROLES, "mesario"]}><CompeticaoLancamentoScorePage /></ProtectedRoute>} />
        <Route path="competicao/painel-sets/:sportEventId/confronto/:matchId/resultado" element={<ProtectedRoute allowedRoles={[...COMPETITION_ROLES, "mesario"]}><CompeticaoLancamentoSetsPage /></ProtectedRoute>} />
        <Route path="competicao/painel-combat/:sportEventId/confronto/:matchId/resultado" element={<ProtectedRoute allowedRoles={[...COMPETITION_ROLES, "mesario"]}><CompeticaoLancamentoCombatPage /></ProtectedRoute>} />
        <Route path="competicao/painel-time-mark/:sportEventId" element={<ProtectedRoute allowedRoles={[...COMPETITION_ROLES]}><CompeticaoPainelTimeMarkPage /></ProtectedRoute>} />
        <Route path="competicao/painel-ranking/:sportEventId" element={<ProtectedRoute allowedRoles={[...COMPETITION_ROLES]}><CompeticaoPainelRankingPage /></ProtectedRoute>} />
        <Route path="competicao/painel-time-mark/:sportEventId/serie/:matchId/resultado" element={<ProtectedRoute allowedRoles={[...COMPETITION_ROLES, "mesario"]}><CompeticaoLancamentoTimeMarkPage /></ProtectedRoute>} />

        <Route path="ajuda" element={<ProtectedRoute allowedRoles={["admin", "secretaria", "coordenacao_tecnica", "coordenador_modalidade"]}><AjudaChatPage /></ProtectedRoute>} />
        <Route path="ajuda/chat" element={<ProtectedRoute allowedRoles={["admin", "secretaria", "coordenacao_tecnica", "coordenador_modalidade"]}><AjudaChatPage /></ProtectedRoute>} />
        <Route path="ajuda/manual" element={<ProtectedRoute><AjudaManualPage /></ProtectedRoute>} />
        <Route path="links" element={<ProtectedRoute allowedRoles={["admin", "secretaria", "super_admin"]}><LinksPage /></ProtectedRoute>} />
        <Route path="links/novo" element={<ProtectedRoute allowedRoles={["admin", "secretaria"]}><LinkFormPage /></ProtectedRoute>} />
        <Route path="links/:id" element={<ProtectedRoute allowedRoles={["admin", "secretaria"]}><LinkFormPage /></ProtectedRoute>} />
        <Route path="links/preview/:id" element={<ProtectedRoute allowedRoles={["admin", "secretaria"]}><LinkPreviewPage /></ProtectedRoute>} />
        <Route path="registros" element={<ProtectedRoute allowedRoles={["admin", "secretaria", "coordenacao_tecnica"]}><RegistrosPage /></ProtectedRoute>} />
        <Route path="registros/prestacao-contas" element={<ProtectedRoute allowedRoles={["admin", "secretaria", "coordenacao_tecnica"]}><OscAccountabilityModule /></ProtectedRoute>} />
        <Route path="registros/configuracao-osc" element={<ProtectedRoute allowedRoles={["admin", "secretaria"]}><ConfigOscPage /></ProtectedRoute>} />
        
        {/* Redirecionamentos operacionais */}
        <Route path="credenciamento" element={<RedirectToEtapas />} />
        <Route path="vouchers" element={<RedirectToEtapas />} />
        <Route path="transporte" element={<RedirectToEtapas />} />
        <Route path="alimentacao" element={<RedirectToEtapas />} />
        <Route path="alojamento" element={<RedirectToEtapas />} />
        <Route path="competicao" element={<RedirectToEtapas />} />
        <Route path="protestos" element={<RedirectToEtapas />} />
        <Route path="ocorrencias" element={<RedirectToEtapas />} />
        <Route path="pesquisa" element={<RedirectToEtapas />} />
      </Route>

      <Route path="/pwa" element={<PwaRouteGuard><PwaLayout /></PwaRouteGuard>}>
        <Route index element={<PwaLandingPage />} />
        <Route path="configuracao" element={<PwaSelectionFallback />} />
        <Route path="install" element={<PwaInstallPage />} />
        <Route path=":module" element={<PwaModulePage />} />

        <Route path="alojamento" element={<AlojamentoHomePage />} />
        <Route path="alojamento/scan" element={<AlojamentoScanPage />} />
        <Route path="alojamento/buscar" element={<AlojamentoBuscarPage />} />
        <Route path="alojamento/ocupacao" element={<AlojamentoOcupacaoPage />} />
        <Route path="alojamento/pessoa/:id" element={<AlojamentoPessoaPage />} />
        <Route path="alojamento/incidentes" element={<AlojamentoIncidentesPage />} />
        <Route path="alojamento/incidentes/novo" element={<AlojamentoNovoIncidentePage />} />
        <Route path="alojamento/lista-completa" element={<AlojamentoListaCompletaPage />} />
        <Route path="alojamento/unidade/:id/faltosos" element={<AlojamentoUnidadeFaltososPage />} />

        <Route path="transporte" element={<TransporteHomePage />} />
        <Route path="transporte/viagens" element={<TransporteViagensPage />} />
        <Route path="transporte/scan" element={<TransporteScanPage />} />
        <Route path="transporte/embarque/:tripId" element={<TransporteEmbarquePage />} />
        <Route path="transporte/rotas" element={<TransporteRotasPage />} />
        <Route path="transporte/passageiros/:tripId" element={<TransportePassageirosPage />} />

        <Route path="alimentacao" element={<AlimentacaoHomePage />} />
        <Route path="alimentacao/scan" element={<AlimentacaoScanPage />} />
        <Route path="alimentacao/buscar" element={<AlimentacaoBuscarPage />} />
        <Route path="alimentacao/janelas" element={<AlimentacaoJanelasPage />} />
        <Route path="alimentacao/consumos" element={<AlimentacaoListaConsumosPage />} />

        <Route path="coordenacao" element={<CoordenacaoHomePage />} />
        <Route path="coordenacao/agenda" element={<CoordenacaoAgendaPage />} />
        <Route path="coordenacao/partidas" element={<CoordenacaoPartidasPage />} />
        <Route path="coordenacao/partida/:id" element={<CoordenacaoPartidaDetalhePage />} />
        <Route path="coordenacao/resultados" element={<CoordenacaoResultadosPage />} />
        <Route path="coordenacao/estatisticas" element={<CoordenacaoEstatisticasPage />} />
        <Route path="coordenacao/consulta" element={<CoordenacaoConsultaPage />} />
        <Route path="coordenacao/incidentes" element={<CoordenacaoIncidentesPage />} />
        <Route path="coordenacao/incidentes/novo" element={<CoordenacaoIncidentePage />} />

        <Route path="resultados" element={<ResultadosHomePage />} />
        <Route path="resultados/partidas" element={<ResultadosPartidasPage />} />
        <Route path="resultados/partida/:id" element={<ResultadosPartidaFormPage />} />

        <Route path="delegacao" element={<DelegacaoHomePage />} />
        <Route path="delegacao/participantes" element={<DelegacaoParticipantesPage />} />
        <Route path="delegacao/agenda" element={<DelegacaoAgendaPage />} />
        <Route path="delegacao/logistica" element={<DelegacaoLogisticaPage />} />
        <Route path="delegacao/locais" element={<DelegacaoLocaisPage />} />
        <Route path="delegacao/protestos" element={<DelegacaoProtestosPage />} />
        <Route path="delegacao/protestos/novo" element={<DelegacaoProtestoNovoPage />} />
        <Route path="delegacao/protestos/:id" element={<DelegacaoProtestoDetalhePage />} />

        <Route path="debug" element={<PwaDebugPage />} />
        <Route path="qr-diagnostico" element={<QrDiagnosticoPage />} />
        <Route path="vincular-credencial" element={<VincularCredencialPage />} />
        
        {/* Catch-all for /pwa/* routes */}
        <Route path="*" element={<PwaNotFoundHandler />} />
      </Route>


      <Route path="/resultados-publicos" element={<PublicResultsPage />} />
      <Route path="/public/results" element={<Navigate to="/resultados-publicos" replace />} />
      <Route path="/quadro-medalhas" element={<PublicMedalTablePage />} />
      <Route path="/atleta/:id" element={<AtletaPublicProfilePage />} />
      <Route path="/entrega-tecnica" element={<EntregaTecnicaPage />} />
      
      <Route path="*" element={<NotFound />} />
    </Routes>
  </Suspense>
);
