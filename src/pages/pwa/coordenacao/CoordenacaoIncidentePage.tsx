import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PwaHeader } from "@/components/pwa/PwaHeader";
import { useEventContext } from "@/contexts/EventContext";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertTriangle, ClipboardList, Phone, User } from "lucide-react";
import { 
  INCIDENT_MODULES, 
  INCIDENT_STATUSES, 
  type IncidentModule, 
  type IncidentStatus 
} from "@/types/incidents";

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
  const [loading, setLoading] = useState(true);
  const [row, setRow] = useState<IncidentDetail | null>(null);
  const [stageName, setStageName] = useState<string | null>(null);

  useEffect(() => {
    if (!incidentId || !activeEventId) {
      setRow(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const { data, error } = await supabase
        .from("operational_incidents")
        .select(
          "id, incident_description, incident_status, module, reference_label, reference_id, reporter_name, reporter_phone, admin_response, created_at, resolved_at, event_stage_id",
        )
        .eq("id", incidentId)
        .eq("event_id", activeEventId)
        .maybeSingle();

      if (cancelled) return;
      if (error || !data) {
        setRow(null);
        setLoading(false);
        return;
      }

      setRow(data as IncidentDetail);

      const sid = (data as IncidentDetail).event_stage_id;
      if (sid) {
        const { data: st } = await supabase.from("event_stages").select("name").eq("id", sid).maybeSingle();
        if (!cancelled && st?.name) setStageName(st.name);
      } else {
        setStageName(null);
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [incidentId, activeEventId]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/pwa/login", { replace: true });
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-25" />
      <PwaHeader title="Incidente" icon={ClipboardList} backTo="/pwa/coordenacao-tecnica" onSignOut={handleSignOut} />

      <main className="relative mx-auto max-w-md space-y-4 p-4">
        {loading && <p className="text-sm text-muted-foreground">Carregando…</p>}
        {!loading && !row && (
          <Card className="border-destructive/40 bg-card/95">
            <CardContent className="flex gap-3 p-4">
              <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
              <p className="text-sm">Incidente não encontrado ou não pertence ao evento ativo.</p>
            </CardContent>
          </Card>
        )}
        {row && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{MODULE_LABELS[row.module] ?? row.module}</Badge>
              <Badge variant={row.incident_status === "pending" ? "destructive" : "secondary"}>
                {STATUS_LABELS[row.incident_status] ?? row.incident_status}
              </Badge>
            </div>

            <Card className="border-border/80 bg-card/95 shadow-app-sm">
              <CardContent className="space-y-4 p-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Descrição</p>
                  <p className="mt-1 text-base font-medium leading-snug text-foreground">{row.incident_description}</p>
                </div>

                <div className="grid gap-2 text-sm">
                  <p className="text-muted-foreground">
                    <span className="font-medium text-foreground">Aberto em:</span>{" "}
                    {format(new Date(row.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </p>
                  {row.resolved_at && (
                    <p className="text-muted-foreground">
                      <span className="font-medium text-foreground">Resolvido em:</span>{" "}
                      {format(new Date(row.resolved_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </p>
                  )}
                  {stageName && (
                    <p className="text-muted-foreground">
                      <span className="font-medium text-foreground">Etapa:</span> {stageName}
                    </p>
                  )}
                  {row.reference_label && (
                    <p className="text-muted-foreground">
                      <span className="font-medium text-foreground">Referência:</span> {row.reference_label}
                    </p>
                  )}
                </div>

                {(row.reporter_name || row.reporter_phone) && (
                  <div className="rounded-lg border border-border/70 bg-muted/20 p-3 space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Quem reportou</p>
                    {row.reporter_name && (
                      <p className="flex items-center gap-2 text-sm text-foreground">
                        <User className="h-4 w-4 text-muted-foreground" />
                        {row.reporter_name}
                      </p>
                    )}
                    {row.reporter_phone && (
                      <p className="flex items-center gap-2 text-sm text-foreground">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        {row.reporter_phone}
                      </p>
                    )}
                  </div>
                )}

                {row.admin_response && (
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Resposta da organização</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-foreground/90">{row.admin_response}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
