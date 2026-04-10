import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { IdCard, QrCode, Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  participantId: string;
  eventId: string;
}

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  pending: { label: "Pendente", variant: "outline" },
  active: { label: "Ativa", variant: "default" },
  revoked: { label: "Revogada", variant: "destructive" },
  reissued: { label: "Reemitida", variant: "secondary" },
  suspended: { label: "Suspensa", variant: "destructive" },
};

export default function ParticipantCredencialTab({ participantId, eventId }: Props) {
  const { data: credentials = [], isLoading } = useQuery({
    queryKey: ["participant_credentials", participantId, eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("participant_credentials")
        .select("id, credential_code, qr_code_value, status, activated_at, issued_at, revoked_at, created_at")
        .eq("participant_id", participantId)
        .eq("event_id", eventId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return <div className="mt-4 space-y-2"><Skeleton className="h-32 w-full" /></div>;
  }

  const active = credentials.find(c => c.status === "active");

  if (credentials.length === 0) {
    return (
      <div className="mt-4 flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
        <IdCard className="h-8 w-8" />
        <p>Nenhuma credencial emitida para este participante.</p>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-4">
      {active && (
        <Card className="border-primary/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <IdCard className="h-4 w-4 text-primary" />Credencial Ativa
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Código</span>
              <span className="font-mono text-xs">{active.credential_code}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              <Badge variant="default">Ativa</Badge>
            </div>
            {active.activated_at && (
              <div className="flex justify-between">
                <span className="text-muted-foreground flex items-center gap-1"><Clock className="h-3.5 w-3.5" />Ativada em</span>
                <span>{new Date(active.activated_at).toLocaleString("pt-BR")}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {credentials.length > 1 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Histórico de Credenciais</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {credentials.filter(c => c.id !== active?.id).map(c => {
                const st = STATUS_LABELS[c.status] ?? { label: c.status, variant: "outline" as const };
                return (
                  <div key={c.id} className="flex items-center justify-between text-sm border-b last:border-0 pb-2">
                    <span className="font-mono text-xs text-muted-foreground">{c.credential_code}</span>
                    <Badge variant={st.variant} className="text-xs">{st.label}</Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
