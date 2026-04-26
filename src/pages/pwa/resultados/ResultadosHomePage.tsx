import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ClipboardList, ChevronRight, Trophy } from "lucide-react";
import { PwaHeader } from "@/components/pwa/PwaHeader";
import { useMinhasModalidades } from "@/hooks/useLancamentoResultados";

export default function ResultadosHomePage() {
  const navigate = useNavigate();
  const { modalidades, isLoading } = useMinhasModalidades();

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) navigate("/pwa/login", { replace: true });
    })();
  }, [navigate]);

  // Se só tem uma modalidade, redireciona direto
  useEffect(() => {
    if (!isLoading && modalidades.length === 1) {
      navigate(`/pwa/resultados/partidas?se=${modalidades[0].id}`, { replace: true });
    }
  }, [isLoading, modalidades, navigate]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/pwa/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <PwaHeader title="Lançamento de Resultados" icon={Trophy} onSignOut={handleSignOut} />

      <main className="flex-1 p-4 max-w-md mx-auto w-full space-y-4">
        <p className="text-sm text-muted-foreground">Selecione a modalidade que deseja gerenciar.</p>

        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
          </div>
        )}

        {!isLoading && modalidades.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center space-y-2">
            <ClipboardList className="h-10 w-10 text-muted-foreground/40" />
            <p className="font-medium text-foreground">Nenhuma modalidade atribuída</p>
            <p className="text-xs text-muted-foreground">Solicite ao administrador que vincule você a uma modalidade.</p>
          </div>
        )}

        <div className="space-y-3">
          {modalidades.map((m) => (
            <button
              key={m.id}
              onClick={() => navigate(`/pwa/resultados/partidas?se=${m.id}`)}
              className="w-full flex items-center gap-4 p-4 bg-card border rounded-xl text-left active:scale-[0.98] transition-transform hover:bg-accent/40"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Trophy className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground truncate">{m.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-muted-foreground">{m.sport?.name ?? "—"}</span>
                  {m.sport?.is_collective && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Coletivo</Badge>
                  )}
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
