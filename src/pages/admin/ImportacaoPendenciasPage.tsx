import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useEventContext } from "@/contexts/EventContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Loader2, RefreshCw } from "lucide-react";
import { Loader2, RefreshCw } from "lucide-react";

interface Pendencia {
  id: string;
  source_row_number: number;
  normalized_name: string | null;
  raw_cpf: string | null;
  raw_birth_date: string | null;
  modality_raw: string | null;
  prova_raw: string | null;
  pending_reason_code: string;
  pending_reason_detail: string | null;
  resolution_status: string;
  raw_payload_json: Record<string, unknown> | null;
  created_at: string;
}

const TM_CHOICES = [
  { value: "tm-12-14", label: "tm-12-14 (12 a 14 anos)" },
  { value: "tm-14-15", label: "tm-14-15 (14 a 15 anos)" },
];

export default function ImportacaoPendenciasPage() {
  const { activeEventId } = useEventContext();
  const [loading, setLoading] = useState(false);
  const [pendencias, setPendencias] = useState<Pendencia[]>([]);
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  async function load() {
    if (!activeEventId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("import_pendencias")
      .select("id, source_row_number, normalized_name, raw_cpf, raw_birth_date, modality_raw, prova_raw, pending_reason_code, pending_reason_detail, resolution_status, raw_payload_json, created_at")
      .eq("event_id", activeEventId)
      .eq("pending_reason_code", "TM_2012_MANUAL_CATEGORY_SELECTION")
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) {
      toast.error("Falha ao carregar pendências: " + error.message);
      return;
    }
    setPendencias((data ?? []) as Pendencia[]);
  }

  useEffect(() => { load(); }, [activeEventId]);

  const stats = useMemo(() => {
    const total = pendencias.length;
    const pending = pendencias.filter(p => p.resolution_status === "pending").length;
    const resolved = total - pending;
    return { total, pending, resolved };
  }, [pendencias]);

  async function saveChoice(p: Pendencia) {
    const chosen = choices[p.id];
    if (!chosen) {
      toast.error("Selecione uma categoria primeiro");
      return;
    }
    setSavingId(p.id);
    try {
      const { data, error } = await supabase.functions.invoke("import-inscricoes", {
        body: {
          action: "apply_manual_resolution",
          pending_id: p.id,
          chosen_category_slug: chosen,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(`Escolha gravada: ${chosen}. Reimporte a planilha (mesma etapa) para reprocessar.`);
      await load();
    } catch (e: any) {
      toast.error("Falha ao salvar: " + (e?.message ?? String(e)));
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Pendências de importação — TM 2012</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Atletas de Tênis de Mesa nascidos em 2012 que requerem escolha manual de categoria entre tm-12-14 e tm-14-15.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Recarregar
        </Button>
        <Badge variant="outline">Total: {stats.total}</Badge>
        <Badge variant="secondary">Pendentes: {stats.pending}</Badge>
        <Badge>Resolvidas: {stats.resolved}</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista</CardTitle>
          <CardDescription>
            Após escolher e salvar, reimporte a mesma planilha (mesma etapa) para que a linha seja reprocessada com a categoria escolhida.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</div>
          ) : pendencias.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma pendência TM 2012 para este evento.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Linha</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>CPF</TableHead>
                  <TableHead>Nascimento</TableHead>
                  <TableHead>Modalidade</TableHead>
                  <TableHead>Candidatas</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Escolha</TableHead>
                  <TableHead>Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendencias.map(p => {
                  const mr = (p.raw_payload_json as any)?.manual_resolution;
                  const isResolved = p.resolution_status === "resolved";
                  return (
                    <TableRow key={p.id}>
                      <TableCell>{p.source_row_number}</TableCell>
                      <TableCell className="font-medium">{p.normalized_name ?? "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{p.raw_cpf ?? "—"}</TableCell>
                      <TableCell>{p.raw_birth_date ?? "—"}</TableCell>
                      <TableCell>{p.modality_raw ?? "—"}</TableCell>
                      <TableCell className="text-xs">tm-12-14, tm-14-15</TableCell>
                      <TableCell>
                        {isResolved ? (
                          <Badge>resolvida → {mr?.chosen_category_slug}</Badge>
                        ) : (
                          <Badge variant="secondary">pendente</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={choices[p.id] ?? mr?.chosen_category_slug ?? ""}
                          onValueChange={(v) => setChoices(prev => ({ ...prev, [p.id]: v }))}
                          disabled={isResolved}
                        >
                          <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="Selecione…" />
                          </SelectTrigger>
                          <SelectContent>
                            {TM_CHOICES.map(c => (
                              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          onClick={() => saveChoice(p)}
                          disabled={isResolved || savingId === p.id || !choices[p.id]}
                        >
                          {savingId === p.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Salvar"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
