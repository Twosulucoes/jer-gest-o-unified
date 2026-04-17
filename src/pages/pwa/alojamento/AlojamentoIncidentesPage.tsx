import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getSelectedFacility } from "@/hooks/useAlojamento";
import { ArrowLeft, AlertTriangle, Plus } from "lucide-react";

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
    if (!facilityId) return;
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
      <header className="flex items-center justify-between border-b bg-card px-4 h-14">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate("/pwa/alojamento")} className="text-muted-foreground">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          <span className="font-semibold text-foreground">Ocorrências</span>
        </div>
        <Button size="sm" onClick={() => navigate("/pwa/alojamento/incidentes/nova")}>
          <Plus className="h-4 w-4 mr-1" /> Nova
        </Button>
      </header>

      <main className="p-4 max-w-md mx-auto space-y-4">
        <Tabs value={statusFilter} onValueChange={setStatusFilter}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="aberta">Abertas</TabsTrigger>
            <TabsTrigger value="em_atendimento">Atendimento</TabsTrigger>
            <TabsTrigger value="resolvida">Resolvidas</TabsTrigger>
          </TabsList>
        </Tabs>

        {loading ? (
          <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
        ) : incidents.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">Nenhuma ocorrência</div>
        ) : (
          <div className="space-y-2">
            {incidents.map((inc) => (
              <Card key={inc.id}>
                <CardContent className="p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <Badge className={severityColors[inc.severity]}>{inc.severity}</Badge>
                    <Badge variant="outline">{inc.category}</Badge>
                  </div>
                  <p className="text-sm line-clamp-2">{inc.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(inc.created_at).toLocaleString("pt-BR")} · {statusLabels[inc.status]}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
