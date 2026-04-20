import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Gavel, FileText, Paperclip } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const STATUS_OPTIONS = [
  { value: "protocolado", label: "Protocolado" },
  { value: "em_analise", label: "Em análise" },
  { value: "aguardando_documentos", label: "Aguardando docs" },
  { value: "decidido", label: "Decidido" },
  { value: "arquivado", label: "Arquivado" },
];

export default function ProtestosFilaPage() {
  const [list, setList] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selected, setSelected] = useState<any>(null);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [decision, setDecision] = useState<string>("");
  const [reason, setReason] = useState("");
  const [newStatus, setNewStatus] = useState("decidido");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    let q = supabase
      .from("protests")
      .select("*, delegations:delegation_id(school_name), competition_matches:match_id(match_number, end_time)")
      .order("created_at", { ascending: false });
    if (statusFilter !== "all") q = q.eq("status", statusFilter);
    const { data } = await q;
    setList(data ?? []);
  };

  useEffect(() => { load(); }, [statusFilter]);

  const open = async (p: any) => {
    setSelected(p);
    setDecision(p.decision ?? "");
    setReason(p.decision_reason ?? "");
    setNewStatus(p.status);
    const { data } = await supabase.from("protest_attachments").select("*").eq("protest_id", p.id);
    setAttachments(data ?? []);
  };

  const downloadFile = async (path: string, name: string) => {
    const { data } = await supabase.storage.from("protestos").createSignedUrl(path, 60);
    if (data?.signedUrl) {
      const a = document.createElement("a");
      a.href = data.signedUrl; a.download = name; a.click();
    }
  };

  const decide = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const { error } = await supabase.rpc("rpc_decide_protest", {
        p_protest_id: selected.id,
        p_decision: decision || null,
        p_decision_reason: reason || null,
        p_new_status: newStatus,
      });
      if (error) throw error;
      toast({ title: "Decisão registrada" });
      setSelected(null);
      load();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Gavel className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Protestos — Fila CDE</h1>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {STATUS_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {list.length === 0 && (
        <Card><CardContent className="p-8 text-center text-muted-foreground">Nenhum protesto encontrado.</CardContent></Card>
      )}

      <div className="grid gap-3">
        {list.map((p) => (
          <Card key={p.id} className="cursor-pointer hover:shadow-md" onClick={() => open(p)}>
            <CardContent className="p-4 flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-semibold">{p.protocol_number}</span>
                  <Badge>{p.status}</Badge>
                  {p.decision && <Badge variant="outline" className="uppercase">{p.decision}</Badge>}
                </div>
                <p className="text-sm">
                  <strong>{p.delegations?.school_name ?? "—"}</strong> — Partida #{p.competition_matches?.match_number ?? "—"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Protocolado em {format(new Date(p.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="font-mono">{selected.protocol_number}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Fundamentação</CardTitle></CardHeader>
                  <CardContent className="text-sm whitespace-pre-wrap">{selected.fundamentation}</CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Pedido</CardTitle></CardHeader>
                  <CardContent className="text-sm whitespace-pre-wrap">{selected.request}</CardContent>
                </Card>

                {attachments.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold mb-2 flex items-center gap-1"><Paperclip className="h-4 w-4" /> Anexos</p>
                    {attachments.map((a) => (
                      <button key={a.id} onClick={() => downloadFile(a.storage_path, a.file_name)} className="flex items-center gap-2 text-sm text-primary hover:underline">
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
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Decisão {newStatus === "decidido" && "*"}</Label>
                    <Select value={decision} onValueChange={setDecision}>
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="deferido">Deferido</SelectItem>
                        <SelectItem value="indeferido">Indeferido</SelectItem>
                        <SelectItem value="parcial">Parcialmente deferido</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Fundamentação da decisão {newStatus === "decidido" && "*"}</Label>
                    <Textarea rows={4} value={reason} onChange={(e) => setReason(e.target.value)} />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSelected(null)}>Cancelar</Button>
                <Button onClick={decide} disabled={saving} variant="gradient">{saving ? "Salvando..." : "Registrar julgamento"}</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
