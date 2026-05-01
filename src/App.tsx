import { ThemeProvider } from "@/components/ui/theme-provider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { EventProvider } from "@/contexts/EventContext";
import { StageProvider } from "@/contexts/StageContext";
import { ScrollToTop } from "@/components/ScrollToTop";
import { CompetitionProvider } from "@/contexts/CompetitionContext";
import { NetworkStatusBanner } from "@/components/navigation/NetworkStatusBanner";
import { OfflineSyncManager } from "@/components/pwa/OfflineSyncManager";
import { MonitoringErrorBoundary } from "@/components/MonitoringErrorBoundary";
import { installErrorReporter } from "@/lib/monitoring/errorReporter";
import { PwaUpdateNotice } from "./components/pwa/PwaUpdateNotice";
import { PwaInstallNotice } from "./components/pwa/PwaInstallNotice";
import { AppStatePreserver } from "./components/pwa/AppStatePreserver";
import { ContextLockGuard } from "./components/pwa/ContextLockGuard";
import { VersionValidator } from "./components/pwa/VersionValidator";
import { AppRoutes } from "./routes/AppRoutes";

installErrorReporter();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: unknown) => {
        const err = error as { status?: number };
        if (err?.status === 404 || err?.status === 403) return false;
        return failureCount < 2;
      },
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 30,
    },
    mutations: {
      onError: (error: unknown) => {
        console.error("Mutation error:", error);
      }
    }
  },
});

const App = () => (
  <MonitoringErrorBoundary>
    <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <ScrollToTop />
        <PwaUpdateNotice />
        <PwaInstallNotice />
        <NetworkStatusBanner />

        <AuthProvider>
          <OfflineSyncManager />
          <VersionValidator>
            <EventProvider>
              <StageProvider>
                <AppStatePreserver />
                <ContextLockGuard />
                <CompetitionProvider>
                  <AppRoutes />
                </CompetitionProvider>
              </StageProvider>
            </EventProvider>
          </VersionValidator>
        </AuthProvider>
      </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
    </QueryClientProvider>
  </MonitoringErrorBoundary>
);

export default App;