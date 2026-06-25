import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Gavel, FileText, Paperclip, RefreshCcw } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const STATUS_OPTIONS = [
  { value: "pendente", label: "Pendente" },
  { value: "protocolado", label: "Protocolado" },
  { value: "em_analise", label: "Em análise" },
  { value: "aguardando_documentos", label: "Aguardando docs" },
  { value: "decidido", label: "Decidido" },
  { value: "arquivado", label: "Arquivado" },
];

const DECISION_OPTIONS = [
  { value: "deferido", label: "Deferido" },
  { value: "indeferido", label: "Indeferido" },
  { value: "parcial", label: "Parcialmente deferido" },
];

type CdeItem = {
  id: string;
  origem: "protests" | "cde_cases";
  protocolo: string;
  status: string;
  decision?: string | null;
  decision_reason?: string | null;
  created_at?: string | null;

  escola?: string | null;
  municipio?: string | null;
  modalidade?: string | null;
  categoria?: string | null;
  naipe?: string | null;
  professor_nome?: string | null;
  professor_email?: string | null;
  professor_telefone?: string | null;
  jogo_descricao?: string | null;
  tipo_recurso?: string | null;
  relato?: string | null;
  pedido?: string | null;
  public_token?: string | null;

  raw: any;
};

function statusLabel(status: string) {
  return STATUS_OPTIONS.find((s) => s.value === status)?.label || status;
}

function decisionLabel(decision?: string | null) {
  if (!decision) return "";
  return DECISION_OPTIONS.find((d) => d.value === decision)?.label || decision;
}

function safeDate(date?: string | null) {
  if (!date) return "—";
  try {
    return format(new Date(date), "dd/MM/yyyy HH:mm", { locale: ptBR });
  } catch {
    return "—";
  }
}

export default function ProtestosFilaPage() {
  const [list, setList] = useState<CdeItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [selected, setSelected] = useState<CdeItem | null>(null);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [decision, setDecision] = useState<string>("");
  const [reason, setReason] = useState("");
  const [newStatus, setNewStatus] = useState("decidido");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  const consultaUrl = useMemo(() => {
    if (!selected?.public_token) return "";
    return `${window.location.origin}/cde/consulta/${selected.public_token}`;
  }, [selected]);

  const load = async () => {
    setLoading(true);

    try {
      let antigos: CdeItem[] = [];
      let novos: CdeItem[] = [];

      if (sourceFilter === "all" || sourceFilter === "protests") {
        let q = supabase
          .from("protests")
          .select(
            "*, delegations:delegation_id(institutions(name)), competition_matches:match_id(match_number, end_time)"
          )
          .order("created_at", { ascending: false });

        if (statusFilter !== "all") q = q.eq("status", statusFilter);

        const { data, error } = await q;

        if (!error && data) {
          antigos = data.map((p: any) => ({
            id: p.id,
            origem: "protests",
            protocolo: p.protocol_number || "SEM-PROTOCOLO",
            status: p.status || "protocolado",
            decision: p.decision,
            decision_reason: p.decision_reason,
            created_at: p.created_at,
            escola: p.delegations?.institutions?.name ?? "—",
            jogo_descricao: p.competition_matches?.match_number
              ? `Partida #${p.competition_matches.match_number}`
              : "—",
            tipo_recurso: "Protesto de partida",
            relato: p.fundamentation,
            pedido: p.request,
            raw: p,
          }));
        }
      }

      if (sourceFilter === "all" || sourceFilter === "cde_cases") {
        let q = (supabase as any)
          .from("cde_cases")
          .select("*")
          .order("created_at", { ascending: false });

        if (statusFilter !== "all") q = q.eq("status", statusFilter);

        const { data, error } = await q;

        if (!error && data) {
          novos = data.map((c: any) => ({
            id: c.id,
            origem: "cde_cases",
            protocolo: c.protocol || "SEM-PROTOCOLO",
            status: c.status || "pendente",
            decision: c.decision || null,
            decision_reason: c.decision_text || null,
            created_at: c.created_at,
            escola: c.escola,
            municipio: c.municipio,
            modalidade: c.modalidade,
            categoria: c.categoria,
            naipe: c.naipe,
            professor_nome: c.professor_nome,
            professor_email: c.professor_email,
            professor_telefone: c.professor_telefone,
            jogo_descricao: c.jogo_descricao,
            tipo_recurso: c.tipo_recurso,
            relato: c.relato,
            pedido: c.pedido,
            public_token: c.public_token,
            raw: c,
          }));
        }
      }

      const merged = [...novos, ...antigos].sort((a, b) => {
        const da = new Date(a.created_at || 0).getTime();
        const db = new Date(b.created_at || 0).getTime();
        return db - da;
      });

      setList(merged);
    } catch (e: any) {
      toast({
        title: "Erro ao carregar CDE",
        description: e?.message || "Não foi possível carregar a fila.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [statusFilter, sourceFilter]);

  const open = async (item: CdeItem) => {
    setSelected(item);
    setDecision(item.decision ?? "");
    setReason(item.decision_reason ?? "");
    setNewStatus(item.status || "em_analise");
    setAttachments([]);

    if (item.origem === "protests") {
      const { data } = await supabase
        .from("protest_attachments")
        .select("*")
        .eq("protest_id", item.id);

      setAttachments(data ?? []);
    }
  };

  const downloadFile = async (path: string, name: string) => {
    const { data } = await supabase.storage
      .from("protestos")
      .createSignedUrl(path, 60);

    if (data?.signedUrl) {
      const a = document.createElement("a");
      a.href = data.signedUrl;
      a.download = name;
      a.click();
    }
  };

  const decide = async () => {
    if (!selected) return;

    if (newStatus === "decidido" && (!decision || !reason.trim())) {
      toast({
        title: "Preencha a decisão",
        description: "Para marcar como decidido, informe a decisão e a fundamentação.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);

    try {
      if (selected.origem === "protests") {
        const { error } = await supabase.rpc("rpc_decide_protest", {
          p_protest_id: selected.id,
          p_decision: decision || null,
          p_decision_reason: reason || null,
          p_new_status: newStatus,
        });

        if (error) throw error;
      }

      if (selected.origem === "cde_cases") {
        const payload: any = {
          status: newStatus,
          decision: decision || null,
          decision_text: reason || null,
          updated_at: new Date().toISOString(),
        };

        if (newStatus === "decidido") {
          payload.decided_at = new Date().toISOString();
        }

        const { error } = await (supabase as any)
          .from("cde_cases")
          .update(payload)
          .eq("id", selected.id);

        if (error) throw error;
      }

      toast({ title: "Julgamento registrado" });
      setSelected(null);
      load();
    } catch (e: any) {
      toast({
        title: "Erro",
        description: e.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <Gavel className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">CDE — Fila Disciplinar</h1>
            <p className="text-sm text-muted-foreground">
              Protestos, recursos públicos e julgamentos da Comissão Disciplinar Especial.
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCcw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>

          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Origem" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas origens</SelectItem>
              <SelectItem value="cde_cases">Recursos públicos</SelectItem>
              <SelectItem value="protests">Protestos PWA</SelectItem>
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[190px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {list.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            {loading ? "Carregando..." : "Nenhum processo encontrado."}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3">
        {list.map((p) => (
          <Card
            key={`${p.origem}-${p.id}`}
            className="cursor-pointer hover:shadow-md"
            onClick={() => open(p)}
          >
            <CardContent className="p-4 flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm font-semibold">
                    {p.protocolo}
                  </span>

                  <Badge>{statusLabel(p.status)}</Badge>

                  <Badge variant="outline">
                    {p.origem === "cde_cases" ? "Recurso público" : "Protesto PWA"}
                  </Badge>

                  {p.decision && (
                    <Badge variant="secondary" className="uppercase">
                      {decisionLabel(p.decision)}
                    </Badge>
                  )}
                </div>

                <p className="text-sm">
                  <strong>{p.escola ?? "—"}</strong>
                  {p.modalidade ? ` — ${p.modalidade}` : ""}
                  {p.categoria ? ` — ${p.categoria}` : ""}
                  {p.naipe ? ` — ${p.naipe}` : ""}
                </p>

                {p.jogo_descricao && (
                  <p className="text-xs text-muted-foreground">
                    {p.jogo_descricao}
                  </p>
                )}

                <p className="text-xs text-muted-foreground">
                  Protocolado em {safeDate(p.created_at)}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="font-mono">
                  {selected.protocolo}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <div className="grid md:grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Origem</p>
                    <p className="font-semibold">
                      {selected.origem === "cde_cases"
                        ? "Recurso público"
                        : "Protesto PWA"}
                    </p>
                  </div>

                  <div>
                    <p className="text-muted-foreground">Status atual</p>
                    <p className="font-semibold">{statusLabel(selected.status)}</p>
                  </div>

                  <div>
                    <p className="text-muted-foreground">Escola</p>
                    <p className="font-semibold">{selected.escola || "—"}</p>
                  </div>

                  <div>
                    <p className="text-muted-foreground">Município</p>
                    <p className="font-semibold">{selected.municipio || "—"}</p>
                  </div>

                  <div>
                    <p className="text-muted-foreground">Modalidade</p>
                    <p className="font-semibold">{selected.modalidade || "—"}</p>
                  </div>

                  <div>
                    <p className="text-muted-foreground">Categoria/Naipe</p>
                    <p className="font-semibold">
                      {selected.categoria || "—"} / {selected.naipe || "—"}
                    </p>
                  </div>

                  {selected.professor_nome && (
                    <>
                      <div>
                        <p className="text-muted-foreground">Professor</p>
                        <p className="font-semibold">{selected.professor_nome}</p>
                      </div>

                      <div>
                        <p className="text-muted-foreground">Contato</p>
                        <p className="font-semibold">
                          {selected.professor_email || "—"}
                          {selected.professor_telefone
                            ? ` / ${selected.professor_telefone}`
                            : ""}
                        </p>
                      </div>
                    </>
                  )}
                </div>

                {consultaUrl && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Consulta pública</CardTitle>
                    </CardHeader>
                    <CardContent className="text-xs break-all">
                      {consultaUrl}
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">
                      {selected.tipo_recurso || "Fundamentação"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm whitespace-pre-wrap">
                    {selected.relato || "—"}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Pedido</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm whitespace-pre-wrap">
                    {selected.pedido || "—"}
                  </CardContent>
                </Card>

                {attachments.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold mb-2 flex items-center gap-1">
                      <Paperclip className="h-4 w-4" /> Anexos
                    </p>

                    {attachments.map((a) => (
                      <button
                        key={a.id}
                        onClick={() => downloadFile(a.storage_path, a.file_name)}
                        className="flex items-center gap-2 text-sm text-primary hover:underline"
                      >
                        <FileText className="h-4 w-4" /> {a.file_name}
                      </button>
                    ))}
                  </div>
                )}

                <div className="border-t pt-4 space-y-3">
                  <h3 className="font-semibold">Julgamento</h3>

                  <div>
                    <Label>Status</Label>
                    <Select value={newStatus} onValueChange={setNewStatus}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((s) => (
                          <SelectItem key={s.value} value={s.value}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Decisão {newStatus === "decidido" && "*"}</Label>
                    <Select value={decision} onValueChange={setDecision}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {DECISION_OPTIONS.map((d) => (
                          <SelectItem key={d.value} value={d.value}>
                            {d.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>
                      Fundamentação da decisão {newStatus === "decidido" && "*"}
                    </Label>
                    <Textarea
                      rows={5}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Descreva a decisão da Comissão Disciplinar Especial..."
                    />
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setSelected(null)}>
                  Cancelar
                </Button>

                <Button onClick={decide} disabled={saving}>
                  {saving ? "Salvando..." : "Registrar julgamento"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}