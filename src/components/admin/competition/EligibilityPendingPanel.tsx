import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, AlertTriangle } from "lucide-react";

interface Props {
  eventId: string;
  sportEventId: string;
}

interface PendingItem {
  pse_id: string;
  participant_id: string;
  full_name: string;
  enrollment_status: string;
  has_active_credential: boolean;
  has_blocking_irregularity: boolean;
  irregularity_message: string;
}

export default function EligibilityPendingPanel({ eventId, sportEventId }: Props) {
  const { data: pending = [], isLoading } = useQuery({
    queryKey: ["eligibility-pending", eventId, sportEventId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rpc_list_eligibility_pending", {
        p_event_id: eventId,
        p_sport_event_id: sportEventId,
      });
      if (error) throw error;
      return (data as PendingItem[]) ?? [];
    },
  });

  const exportCSV = () => {
    if (pending.length === 0) return;
    const rows = [["Nome", "Status Inscrição", "Credencial Ativa", "Irregularidade Bloqueante", "Mensagem"].join(",")];
    for (const p of pending) {
      rows.push([
        `"${p.full_name}"`,
        p.enrollment_status,
        p.has_active_credential ? "Sim" : "Não",
        p.has_blocking_irregularity ? "Sim" : "Não",
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
                  <TableHead>Inscrição</TableHead>
                  <TableHead>Credencial</TableHead>
                  <TableHead>Irregularidade</TableHead>
                  <TableHead>Detalhe</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pending.map((p) => (
                  <TableRow key={p.pse_id}>
                    <TableCell className="font-medium">{p.full_name}</TableCell>
                    <TableCell>
                      <Badge variant={["confirmed", "approved", "valid", "active"].includes(p.enrollment_status) ? "default" : "destructive"}>
                        {p.enrollment_status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={p.has_active_credential ? "default" : "destructive"}>
                        {p.has_active_credential ? "Ativa" : "Sem credencial"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {p.has_blocking_irregularity ? (
                        <Badge variant="destructive">Bloqueante</Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs max-w-[200px] truncate">
                      {p.irregularity_message || "—"}
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
