import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, AlertTriangle, UserCheck, ShieldAlert, Eye } from "lucide-react";
import { Link } from "react-router-dom";

interface Props {
  eventId: string;
  sportEventId: string;
}

interface PendingItem {
  pse_id: string;
  participant_id: string;
  person_id: string;
  delegation_id: string;
  full_name: string;
  institution_name: string | null;
  enrollment_status: string;
  has_active_credential: boolean;
  has_blocking_irregularity: boolean;
  irregularity_message: string;
  reason_code: string;
}

const REASON_LABELS: Record<string, string> = {
  NO_CREDENTIAL: "Sem credencial",
  ENROLLMENT_INVALID: "Inscrição inválida",
  BLOCKING_IRREGULARITY: "Irregularidade bloqueante",
};

export default function EligibilityPendingPanel({ eventId, sportEventId }: Props) {
  const { data: pending = [], isLoading } = useQuery({
    queryKey: ["eligibility-pending", eventId, sportEventId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rpc_list_eligibility_pending", {
        p_event_id: eventId,
        p_sport_event_id: sportEventId,
      });
      if (error) throw error;
      return (data as unknown as PendingItem[]) ?? [];
    },
  });

  const exportCSV = () => {
    if (pending.length === 0) return;
    const rows = [["Nome", "Instituição", "Status Inscrição", "Credencial Ativa", "Irregularidade", "Motivo", "Mensagem"].join(",")];
    for (const p of pending) {
      rows.push([
        `"${p.full_name}"`,
        `"${p.institution_name ?? ""}"`,
        p.enrollment_status,
        p.has_active_credential ? "Sim" : "Não",
        p.has_blocking_irregularity ? "Sim" : "Não",
        REASON_LABELS[p.reason_code] ?? p.reason_code,
        `"${p.irregularity_message}"`,
      ].join(","));
    }
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "pendencias-elegibilidade.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-orange-500" />
          Pendências de Elegibilidade
        </h3>
        <Button variant="outline" size="sm" onClick={exportCSV} disabled={pending.length === 0}>
          <Download className="h-4 w-4 mr-1" /> Exportar CSV
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : pending.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma pendência encontrada. Todos os inscritos estão elegíveis. ✅
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Instituição</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Detalhe</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pending.map((p) => (
                  <TableRow key={p.pse_id}>
                    <TableCell className="font-medium">{p.full_name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.institution_name ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={p.reason_code === "BLOCKING_IRREGULARITY" ? "destructive" : "secondary"}>
                        {REASON_LABELS[p.reason_code] ?? p.reason_code}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs max-w-[200px] truncate">
                      {p.irregularity_message || "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {p.reason_code === "NO_CREDENTIAL" && (
                          <Link to={`/admin/credenciamento?participantId=${p.participant_id}`}>
                            <Button variant="outline" size="sm" title="Credenciar">
                              <UserCheck className="h-3.5 w-3.5" />
                            </Button>
                          </Link>
                        )}
                        {p.reason_code === "BLOCKING_IRREGULARITY" && (
                          <Link to="/admin/irregularidades">
                            <Button variant="outline" size="sm" title="Irregularidades">
                              <ShieldAlert className="h-3.5 w-3.5" />
                            </Button>
                          </Link>
                        )}
                        <Link to={`/admin/participantes/${p.participant_id}`}>
                          <Button variant="ghost" size="sm" title="Ver participante">
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
