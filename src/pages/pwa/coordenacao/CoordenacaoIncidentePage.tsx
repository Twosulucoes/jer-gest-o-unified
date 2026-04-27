import { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PwaHeader } from "@/components/pwa/PwaHeader";
import { useEventContext } from "@/contexts/EventContext";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertTriangle, ClipboardList, Phone, User, Save, MessageSquare } from "lucide-react";
import { 
  INCIDENT_MODULES, 
  INCIDENT_STATUSES, 
  type IncidentModule, 
  type IncidentStatus 
} from "@/types/incidents";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";

type IncidentDetail = {
  id: string;
  incident_description: string;
  incident_status: IncidentStatus;
  module: IncidentModule;
  reference_label: string | null;
  reference_id: string | null;
  reporter_name: string | null;
  reporter_phone: string | null;
  admin_response: string | null;
  created_at: string;
  resolved_at: string | null;
  event_stage_id: string;
};


export default function CoordenacaoIncidentePage() {
  const { incidentId } = useParams<{ incidentId: string }>();
  const navigate = useNavigate();
  const { activeEventId } = useEventContext();
  const { hasRole } = useAuth();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [row, setRow] = useState<IncidentDetail | null>(null);
  const [stageName, setStageName] = useState<string | null>(null);
  
  // Action states
  const [status, setStatus] = useState<IncidentStatus>("pending");
  const [adminResponse, setAdminResponse] = useState("");

  const isCoordinator = hasRole("coordenacao_tecnica") || hasRole("admin") || hasRole("super_admin");

  const fetchIncident = useCallback(async () => {
    if (!incidentId || !activeEventId) {
      setRow(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("operational_incidents")
        .select(
          "id, incident_description, incident_status, module, reference_label, reference_id, reporter_name, reporter_phone, admin_response, created_at, resolved_at, event_stage_id",
        )
        .eq("id", incidentId)
        .eq("event_id", activeEventId)
        .maybeSingle();

      if (error) throw error;
      
      if (!data) {
        setRow(null);
        return;
      }

      const incident = data as IncidentDetail;
      setRow(incident);
      setStatus(incident.incident_status);
      setAdminResponse(incident.admin_response || "");

      if (incident.event_stage_id) {
        const { data: st } = await supabase
          .from("event_stages")
          .select("name")
          .eq("id", incident.event_stage_id)
          .maybeSingle();
        if (st?.name) setStageName(st.name);
      } else {
        setStageName(null);
      }
    } catch (err: any) {
      console.error("Erro ao carregar incidente:", err);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os detalhes do incidente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [incidentId, activeEventId, toast]);

  useEffect(() => {
    fetchIncident();
  }, [fetchIncident]);

  const handleUpdate = async () => {
    if (!incidentId || !row) return;

    setUpdating(true);
    try {
      const updateData: any = {
        incident_status: status,
        admin_response: adminResponse,
        updated_at: new Date().toISOString(),
      };

      // Se mudou para resolvido agora
      if (status === "resolved" && row.incident_status !== "resolved") {
        updateData.resolved_at = new Date().toISOString();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          updateData.resolved_by_user_id = user.id;
        }
      }

      const { error } = await supabase
        .from("operational_incidents")
        .update(updateData)
        .eq("id", incidentId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Incidente atualizado com sucesso.",
      });
      
      await fetchIncident();
    } catch (err: any) {
      console.error("Erro ao atualizar incidente:", err);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o incidente: " + err.message,
        variant: "destructive",
      });
    } finally {
      setUpdating(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background pb-20">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-25" />
      <PwaHeader 
        title="Detalhes da Ocorrência" 
        icon={ClipboardList} 
        backTo="/pwa/coordenacao-tecnica/incidentes" 
        onSignOut={handleSignOut} 
      />

      <main className="relative mx-auto max-w-md space-y-4 p-4">
        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-48 w-full rounded-xl" />
            <Skeleton className="h-48 w-full rounded-xl" />
          </div>
        ) : !row ? (
          <Card className="border-destructive/40 bg-card/95">
            <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
              <AlertTriangle className="h-12 w-12 text-destructive opacity-50" />
              <h3 className="text-lg font-semibold text-foreground">Incidente não encontrado</h3>
              <p className="text-sm text-muted-foreground">O incidente solicitado não existe ou você não tem permissão para acessá-lo neste evento.</p>
              <Button variant="outline" onClick={() => navigate("/pwa/coordenacao-tecnica/incidentes")} className="mt-4">
                Voltar para a lista
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider">
                  {INCIDENT_MODULES[row.module]?.label ?? row.module}
                </Badge>
                <Badge 
                  variant={INCIDENT_STATUSES[row.incident_status]?.variant ?? "outline"}
                  className="text-[10px] uppercase font-bold"
                >
                  {INCIDENT_STATUSES[row.incident_status]?.label ?? row.incident_status}
                </Badge>
              </div>
              <span className="text-[10px] font-medium text-muted-foreground uppercase">
                ID: {row.id.split("-")[0]}
              </span>
            </div>

            <Card className="border-border/80 bg-card/95 shadow-app-sm">
              <CardHeader className="pb-2 border-b border-border/40 mb-2">
                <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <MessageSquare className="h-3 w-3" /> Descrição da Ocorrência
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 p-4">
                <div>
                  <p className="text-base font-medium leading-relaxed text-foreground">{row.incident_description}</p>
                </div>

                <div className="grid grid-cols-1 gap-3 pt-2 border-t border-border/40">
                  <div className="space-y-1">
                    <p className="text-[10px] font-semibold uppercase text-muted-foreground">Aberto em</p>
                    <p className="text-sm font-medium">{format(new Date(row.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
                  </div>
                  
                  {row.resolved_at && (
                    <div className="space-y-1">
                      <p className="text-[10px] font-semibold uppercase text-muted-foreground">Resolvido em</p>
                      <p className="text-sm font-medium">{format(new Date(row.resolved_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
                    </div>
                  )}

                  {stageName && (
                    <div className="space-y-1">
                      <p className="text-[10px] font-semibold uppercase text-muted-foreground">Etapa / Evento</p>
                      <p className="text-sm font-medium">{stageName}</p>
                    </div>
                  )}
                  
                  {row.reference_label && (
                    <div className="space-y-1">
                      <p className="text-[10px] font-semibold uppercase text-muted-foreground">Referência</p>
                      <p className="text-sm font-medium">{row.reference_label}</p>
                    </div>
                  )}
                </div>

                {(row.reporter_name || row.reporter_phone) && (
                  <div className="rounded-xl border border-primary/10 bg-primary/5 p-4 space-y-3 mt-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-primary/70 flex items-center gap-2">
                      <User className="h-3 w-3" /> Relatado por
                    </p>
                    <div className="space-y-2">
                      {row.reporter_name && (
                        <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                          {row.reporter_name}
                        </p>
                      )}
                      {row.reporter_phone && (
                        <a 
                          href={`tel:${row.reporter_phone}`}
                          className="flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                        >
                          <Phone className="h-3 w-3" />
                          {row.reporter_phone}
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {isCoordinator && (
              <Card className="border-primary/20 bg-card/95 shadow-app-md">
                <CardHeader className="pb-2 border-b border-border/40 mb-2">
                  <CardTitle className="text-xs font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                    <Save className="h-3 w-3" /> Ações da Coordenação
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5 p-4">
                  <div className="space-y-2">
                    <Label htmlFor="status" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Status da Ocorrência
                    </Label>
                    <Select value={status} onValueChange={(v) => setStatus(v as IncidentStatus)}>
                      <SelectTrigger id="status" className="h-11 bg-background/50 border-border/60">
                        <SelectValue placeholder="Selecione o status" />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.entries(INCIDENT_STATUSES) as [IncidentStatus, any][]).map(([key, config]) => (
                          <SelectItem key={key} value={key}>{config.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="response" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Resposta / Notas de Resolução
                    </Label>
                    <Textarea 
                      id="response"
                      placeholder="Descreva as ações tomadas ou a resolução desta ocorrência..."
                      className="min-h-[120px] bg-background/50 border-border/60 focus-visible:ring-primary/20 text-sm leading-relaxed"
                      value={adminResponse}
                      onChange={(e) => setAdminResponse(e.target.value)}
                    />
                  </div>

                  <Button 
                    className="w-full h-12 rounded-xl font-bold uppercase tracking-widest text-xs shadow-lg shadow-primary/20 transition-all active:scale-[0.98]"
                    onClick={handleUpdate}
                    disabled={updating}
                  >
                    {updating ? "Salvando..." : "Salvar Alterações"}
                  </Button>
                </CardContent>
              </Card>
            )}

            {!isCoordinator && row.admin_response && (
              <Card className="border-border/80 bg-card/95">
                <CardHeader className="pb-2 border-b border-border/40 mb-2">
                  <CardTitle className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Resposta da Organização
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <p className="whitespace-pre-wrap text-sm text-foreground/90 leading-relaxed italic border-l-2 border-primary/30 pl-3">
                    {row.admin_response}
                  </p>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </main>
    </div>
  );
}
