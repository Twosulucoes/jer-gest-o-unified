import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getSelectedFacility } from "@/lib/alojamentoRpc";
import { AlertTriangle, Plus } from "lucide-react";
import { PwaHeader } from "@/components/pwa/PwaHeader";

interface Incident {
  id: string;
  severity: string;
  category: string;
  description: string;
  status: string;
  created_at: string;
}

const severityColors: Record<string, string> = {
  baixa: "bg-blue-500/20 text-blue-700",
  media: "bg-amber-500/20 text-amber-700",
  alta: "bg-red-500/20 text-red-700",
};

const statusLabels: Record<string, string> = {
  aberta: "Aberta",
  em_atendimento: "Em atendimento",
  resolvida: "Resolvida",
};

export default function AlojamentoIncidentesPage() {
  const navigate = useNavigate();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("aberta");
  const facilityId = getSelectedFacility();

  useEffect(() => {
    if (!facilityId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    (async () => {
      const { data } = await supabase.rpc("get_alojamento_incidents" as any, {
        p_facility_id: facilityId,
        p_status: statusFilter,
      });
      setIncidents((Array.isArray(data) ? data : []) as Incident[]);
      setLoading(false);
    })();
  }, [facilityId, statusFilter]);

  return (
    <div className="min-h-screen bg-background">
      <PwaHeader 
        title="Ocorrências" 
        icon={AlertTriangle}
        backTo="/pwa/alojamento" 
      />

      <main className="p-4 max-w-md mx-auto space-y-4 pb-20">
        <div className="flex items-center justify-between">
          <Tabs value={statusFilter} onValueChange={setStatusFilter} className="flex-1 mr-2">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="aberta">Abertas</TabsTrigger>
              <TabsTrigger value="em_atendimento">Atendimento</TabsTrigger>
              <TabsTrigger value="resolvida">Resolvidas</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button size="icon" variant="module" className="h-9 w-9 rounded-xl" onClick={() => navigate("/pwa/alojamento/incidentes/nova")}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {loading ? (
          <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}</div>
        ) : incidents.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground bg-muted/20 rounded-2xl border-dashed">
             <AlertTriangle className="h-10 w-10 mx-auto mb-2 opacity-30" />
             <p className="text-sm">Nenhuma ocorrência encontrada</p>
          </div>
        ) : (
          <div className="space-y-3">
            {incidents.map((inc) => (
              <Card key={inc.id} className="overflow-hidden border-border/60 hover:shadow-md transition-shadow">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className={`${severityColors[inc.severity]} border-0 text-[10px] font-bold uppercase`}>
                      {inc.severity}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px] font-bold uppercase">{inc.category}</Badge>
                  </div>
                  <p className="text-sm font-medium text-foreground/90 line-clamp-2">{inc.description}</p>
                  <div className="flex items-center justify-between pt-1 border-t border-border/40">
                    <p className="text-[10px] text-muted-foreground font-medium">
                      {new Date(inc.created_at).toLocaleString("pt-BR", { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </p>
                    <Badge variant="outline" className="text-[10px] border-border/60">
                      {statusLabels[inc.status]}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
