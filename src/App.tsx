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
              <Route path="eventos" element={<EventosPage />} />
              <Route path="modalidades" element={<ModalidadesPage />} />
              <Route path="categorias" element={<CategoriasPage />} />
              <Route path="locais" element={<LocaisPage />} />
              <Route path="instituicoes" element={<InstituicoesPage />} />
              <Route path="delegacoes" element={<DelegacoesPage />} />
              <Route path="importacao" element={<ImportacaoPage />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
