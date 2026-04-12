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
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const TRANSPORT_ROLES = ["admin", "secretaria", "coordenacao_tecnica", "transporte"] as const;
const FOOD_ROLES = ["admin", "secretaria", "coordenacao_tecnica", "alimentacao"] as const;
const LODGING_ROLES = ["admin", "secretaria", "coordenacao_tecnica"] as const;
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
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
          </EventProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
