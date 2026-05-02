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
import { NavigationSyncManager } from "./components/pwa/NavigationSyncManager";
import { ContextLockGuard } from "./components/pwa/ContextLockGuard";
import { VersionValidator } from "./components/pwa/VersionValidator";
import { AppRoutes } from "./routes/AppRoutes";

installErrorReporter();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        if (error?.status === 404 || error?.status === 403) return false;
        return failureCount < 2;
      },
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 30,
      throwOnError: (error: any) => {
        // Only throw critical errors to the ErrorBoundary
        return error?.status === 500 || error?.severity === "critical";
      }
    },
    mutations: {
      onError: (error: any) => {
        console.error("Mutation error:", error);
        reportError({
          message: error.message || "Mutation failed",
          severity: "error",
          context: { error }
        });
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
                <NavigationSyncManager />
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