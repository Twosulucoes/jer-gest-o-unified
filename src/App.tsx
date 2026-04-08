import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
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
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
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
              <Route
                path="eventos"
                element={
                  <ProtectedRoute allowedRoles={["admin", "secretaria", "coordenacao_tecnica"]}>
                    <EventosPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="modalidades"
                element={
                  <ProtectedRoute allowedRoles={["admin", "secretaria", "coordenacao_tecnica"]}>
                    <ModalidadesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="categorias"
                element={
                  <ProtectedRoute allowedRoles={["admin", "secretaria", "coordenacao_tecnica"]}>
                    <CategoriasPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="locais"
                element={
                  <ProtectedRoute allowedRoles={["admin", "secretaria", "coordenacao_tecnica"]}>
                    <LocaisPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="instituicoes"
                element={
                  <ProtectedRoute allowedRoles={["admin", "secretaria", "coordenacao_tecnica"]}>
                    <InstituicoesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="delegacoes"
                element={
                  <ProtectedRoute allowedRoles={["admin", "secretaria", "coordenacao_tecnica"]}>
                    <DelegacoesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="importacao"
                element={
                  <ProtectedRoute allowedRoles={["admin", "secretaria"]}>
                    <ImportacaoPage />
                  </ProtectedRoute>
                }
              />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
