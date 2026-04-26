import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PwaHeader } from "@/components/pwa/PwaHeader";
import { useEventContext } from "@/contexts/EventContext";
import { AlertTriangle, ClipboardList } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface IncidentItem {
  id: string;
  incident_description: string;
  incident_status: string;
  module: string;
  created_at: string;
}

const MODULE_LABELS: Record<string, string> = {
  transporte: "Transporte",
  alimentacao: "Alimentação",
  alojamento: "Alojamento",
  outro: "Geral",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendente",
  in_progress: "Em análise",
  resolved: "Resolvida",
};

export default function CoordenacaoIncidentesPage() {
  const navigate = useNavigate();
  const { activeEventId } = useEventContext();
  const [incidents, setIncidents] = useState<IncidentItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeEventId) return;
    
    (async () => {
      const { data } = await supabase
        .from("operational_incidents")
        .select("id, incident_description, incident_status, module, created_at")
        .eq("event_id", activeEventId)
        .order("created_at", { ascending: false })
        .limit(50);
      
      setIncidents((data as any) || []);
      setLoading(false);
    })();
  }, [activeEventId]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/pwa/login", { replace: true });
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-25" />
      <PwaHeader 
        title="Ocorrências" 
        icon={AlertTriangle} 
        backTo="/pwa/coordenacao-tecnica" 
        onSignOut={handleSignOut} 
      />

      <main className="relative mx-auto max-w-md space-y-3 p-4">
        {loading && [1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}

        {!loading && incidents.length === 0 && (
          <div className="text-center py-12 text-muted-foreground bg-card/50 rounded-2xl border border-dashed">
            <AlertTriangle className="h-10 w-10 mx-auto mb-2 opacity-20" />
            <p className="text-sm">Nenhuma ocorrência registrada</p>
          </div>
        )}

        {incidents.map((inc) => (
          <Card 
            key={inc.id} 
            className="cursor-pointer hover:bg-accent/50 active:scale-[0.98] transition-all border-border/60 bg-card/95 shadow-app-sm"
            onClick={() => navigate(`/pwa/coordenacao-tecnica/incidente/${inc.id}`)}
          >
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider">
                  {MODULE_LABELS[inc.module] ?? inc.module}
                </Badge>
                <Badge 
                  variant={inc.incident_status === "pending" ? "destructive" : "secondary"}
                  className="text-[10px] uppercase font-bold"
                >
                  {STATUS_LABELS[inc.incident_status] ?? inc.incident_status}
                </Badge>
              </div>
              
              <p className="text-sm font-medium text-foreground leading-snug line-clamp-2">
                {inc.incident_description}
              </p>
              
              <div className="pt-2 border-t border-border/40 flex items-center justify-between text-[10px] text-muted-foreground font-medium">
                <span>{format(new Date(inc.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
                <span className="flex items-center gap-1">
                  Ver detalhes <ClipboardList className="h-3 w-3" />
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </main>
    </div>
  );
}
