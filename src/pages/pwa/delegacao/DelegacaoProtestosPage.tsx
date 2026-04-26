import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Gavel, Plus, FileText } from "lucide-react";
import { PwaHeader } from "@/components/pwa/PwaHeader";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const STATUS_LABEL: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  protocolado: { label: "Protocolado", variant: "secondary" },
  em_analise: { label: "Em análise", variant: "default" },
  aguardando_documentos: { label: "Aguardando docs", variant: "outline" },
  decidido: { label: "Decidido", variant: "default" },
  arquivado: { label: "Arquivado", variant: "outline" },
};

export default function DelegacaoProtestosPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [list, setList] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("protests")
        .select("id, protocol_number, status, decision, created_at, deadline_at, match_id, competition_matches:match_id(match_number, match_date, start_time)")
        .order("created_at", { ascending: false });
      setList(data ?? []);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <PwaHeader title="Protestos" icon={Gavel} backTo="/pwa/delegacao" />

      <main className="p-4 max-w-md mx-auto space-y-3">
        <Button onClick={() => navigate("/pwa/delegacao/protestos/novo")} className="w-full" variant="gradient">
          <Plus className="h-4 w-4" /> Novo protesto
        </Button>

        {loading && <p className="text-center text-sm text-muted-foreground py-8">Carregando...</p>}

        {!loading && list.length === 0 && (
          <Card>
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
              Nenhum protesto registrado ainda.
            </CardContent>
          </Card>
        )}

        {list.map((p) => {
          const meta = STATUS_LABEL[p.status] ?? STATUS_LABEL.protocolado;
          return (
            <Card key={p.id} className="cursor-pointer hover:shadow-md" onClick={() => navigate(`/pwa/delegacao/protestos/${p.id}`)}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-mono text-xs text-muted-foreground">{p.protocol_number}</p>
                    <p className="text-sm font-medium">
                      Partida #{p.competition_matches?.match_number ?? "—"}
                    </p>
                  </div>
                  <Badge variant={meta.variant}>{meta.label}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Protocolado em {format(new Date(p.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                </p>
                {p.decision && (
                  <p className="text-xs">
                    Decisão: <span className="font-semibold uppercase">{p.decision}</span>
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </main>
    </div>
  );
}
