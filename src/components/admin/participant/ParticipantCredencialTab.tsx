import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IdCard, Clock, Eye, Tag, ScanLine, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  participantId: string;
  eventId: string;
  onEmitLabel?: () => void;
  onPreviewCredential?: () => void;
}

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  pending: { label: "Pendente", variant: "outline" },
  active: { label: "Ativa", variant: "default" },
  revoked: { label: "Revogada", variant: "destructive" },
  reissued: { label: "Reemitida", variant: "secondary" },
  suspended: { label: "Suspensa", variant: "destructive" },
};

const SCAN_RESULT_INFO: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
  valid: { label: "Válido", icon: <CheckCircle className="h-3.5 w-3.5 text-green-600" />, className: "text-green-700" },
  invalid: { label: "Inválido", icon: <XCircle className="h-3.5 w-3.5 text-destructive" />, className: "text-destructive" },
  revoked: { label: "Revogada", icon: <XCircle className="h-3.5 w-3.5 text-destructive" />, className: "text-destructive" },
  not_found: { label: "Não encontrada", icon: <AlertCircle className="h-3.5 w-3.5 text-orange-500" />, className: "text-orange-600" },
};

const SCAN_POINT_LABELS: Record<string, string> = {
  general: "Geral",
  meal: "Alimentação",
  transport: "Transporte",
  lodging: "Alojamento",
  competition: "Competição",
};

export default function ParticipantCredencialTab({ participantId, eventId, onEmitLabel, onPreviewCredential }: Props) {
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

  // Scan history for all credentials of this participant
  const credentialIds = credentials.map(c => c.id);
  const { data: scans = [] } = useQuery({
    queryKey: ["credential_scans", participantId, credentialIds],
    queryFn: async () => {
      if (!credentialIds.length) return [];
      const { data, error } = await supabase
        .from("credential_scans")
        .select("id, scanned_at, scan_point, scan_result, credential_id")
        .in("credential_id", credentialIds)
        .order("scanned_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
    enabled: credentialIds.length > 0,
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
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <IdCard className="h-4 w-4 text-primary" />Credencial Ativa
              </CardTitle>
              <div className="flex gap-1.5">
                {onPreviewCredential && (
                  <Button size="sm" variant="outline" onClick={onPreviewCredential}>
                    <Eye className="h-3.5 w-3.5 mr-1" />Visualizar
                  </Button>
                )}
                {onEmitLabel && (
                  <Button size="sm" variant="outline" onClick={onEmitLabel}>
                    <Tag className="h-3.5 w-3.5 mr-1" />Etiqueta
                  </Button>
                )}
              </div>
            </div>
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

      {/* Scan history */}
      {scans.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ScanLine className="h-4 w-4" />Últimas Validações
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {scans.map(s => {
                const info = SCAN_RESULT_INFO[s.scan_result] ?? { label: s.scan_result, icon: null, className: "" };
                return (
                  <div key={s.id} className="flex items-center justify-between text-sm border-b last:border-0 pb-2">
                    <div className="flex items-center gap-2">
                      {info.icon}
                      <div>
                        <span className={`font-medium ${info.className}`}>{info.label}</span>
                        <span className="text-muted-foreground ml-2 text-xs">
                          {SCAN_POINT_LABELS[s.scan_point] ?? s.scan_point}
                        </span>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(s.scanned_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                    </span>
                  </div>
                );
              })}
            </div>
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
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">{c.credential_code}</span>
                      {c.revoked_at && (
                        <span className="text-xs text-muted-foreground">
                          {new Date(c.revoked_at).toLocaleDateString("pt-BR")}
                        </span>
                      )}
                    </div>
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
