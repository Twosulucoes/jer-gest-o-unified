import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { LifeBuoy, Send, Trash2, ExternalLink, MessageCircle, Filter } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const STATUS_OPTIONS = [
  { value: "aberto", label: "Aberto" },
  { value: "em_analise", label: "Em análise" },
  { value: "resolvido", label: "Resolvido" },
  { value: "fechado", label: "Fechado" },
];

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  aberto: "default",
  em_analise: "secondary",
  resolvido: "outline",
  fechado: "outline",
};

const CATEGORY_LABEL: Record<string, string> = {
  bug: "🐛 Bug",
  duvida: "❓ Dúvida",
  melhoria: "💡 Melhoria",
  acesso: "🔐 Acesso",
  outro: "📌 Outro",
};

const PRIORITY_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  baixa: "outline",
  normal: "secondary",
  alta: "default",
  critica: "destructive",
};

export default function SuperChamadosPage() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const ticketsQuery = useQuery({
    queryKey: ["super-support-tickets", statusFilter],
    queryFn: async () => {
      let q = supabase.from("support_tickets").select("*").order("created_at", { ascending: false });
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const updateMut = useMutation({
    mutationFn: async (payload: { id: string; patch: Record<string, unknown> }) => {
      const { error } = await supabase.from("support_tickets").update(payload.patch as never).eq("id", payload.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Atualizado" });
      qc.invalidateQueries({ queryKey: ["super-support-tickets"] });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("support_tickets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Chamado excluído" });
      setSelectedId(null);
      qc.invalidateQueries({ queryKey: ["super-support-tickets"] });
    },
  });

  const counts = ticketsQuery.data?.reduce<Record<string, number>>((acc, t) => {
    acc[t.status] = (acc[t.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2 text-zinc-100">
          <LifeBuoy className="h-6 w-6 text-amber-400" />
          Chamados Técnicos
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          Atendimento de reports, dúvidas e solicitações enviados pelos usuários do sistema.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {STATUS_OPTIONS.map((s) => (
          <Card key={s.value} className="bg-zinc-900 border-zinc-800">
            <CardContent className="p-4">
              <p className="text-xs text-zinc-400">{s.label}</p>
              <p className="text-2xl font-bold text-zinc-100 mt-1">{counts?.[s.value] ?? 0}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-zinc-400" />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48 bg-zinc-900 border-zinc-800 text-zinc-200"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {STATUS_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        {ticketsQuery.isLoading && <p className="text-sm text-zinc-400">Carregando...</p>}
        {ticketsQuery.data?.length === 0 && (
          <Card className="bg-zinc-900 border-zinc-800"><CardContent className="py-8 text-center text-sm text-zinc-400">Nenhum chamado encontrado.</CardContent></Card>
        )}
        {ticketsQuery.data?.map((t) => {
          const expanded = selectedId === t.id;
          return (
            <Card key={t.id} className="bg-zinc-900 border-zinc-800">
              <CardHeader className="pb-3 cursor-pointer" onClick={() => setSelectedId(expanded ? null : t.id)}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={STATUS_VARIANT[t.status]}>{STATUS_OPTIONS.find(s => s.value === t.status)?.label ?? t.status}</Badge>
                      <Badge variant={PRIORITY_VARIANT[t.priority]} className="capitalize">{t.priority}</Badge>
                      <span className="text-xs text-zinc-400">{CATEGORY_LABEL[t.category] ?? t.category}</span>
                    </div>
                    <CardTitle className="text-base mt-1 text-zinc-100 truncate">{t.subject}</CardTitle>
                    <CardDescription className="text-xs text-zinc-500">
                      {t.reporter_name ?? t.reporter_email ?? "—"} • {format(new Date(t.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              {expanded && (
                <CardContent className="space-y-4 border-t border-zinc-800 pt-4">
                  <div>
                    <p className="text-xs font-semibold text-zinc-400 mb-1">Descrição</p>
                    <p className="text-sm whitespace-pre-wrap text-zinc-200">{t.description}</p>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3 text-xs text-zinc-400">
                    {t.current_url && (
                      <div>
                        <p className="font-semibold mb-0.5">URL</p>
                        <a href={t.current_url} target="_blank" rel="noreferrer" className="text-amber-400 inline-flex items-center gap-1 break-all">
                          {t.current_url} <ExternalLink className="h-3 w-3 shrink-0" />
                        </a>
                      </div>
                    )}
                    {t.user_agent && (
                      <div>
                        <p className="font-semibold mb-0.5">Navegador</p>
                        <p className="break-all">{t.user_agent}</p>
                      </div>
                    )}
                  </div>

                  <ManageTicket ticket={t} updateMut={updateMut} />
                  <SuperCommentsThread ticketId={t.id} />

                  <div className="flex justify-end pt-2 border-t border-zinc-800">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => { if (confirm("Excluir este chamado?")) deleteMut.mutate(t.id); }}
                    >
                      <Trash2 className="h-4 w-4 mr-2" /> Excluir
                    </Button>
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function ManageTicket({
  ticket,
  updateMut,
}: {
  ticket: any;
  updateMut: ReturnType<typeof useMutation<void, Error, { id: string; patch: Record<string, unknown> }>>;
}) {
  const [status, setStatus] = useState(ticket.status);
  const [priority, setPriority] = useState(ticket.priority);
  const [resolutionNotes, setResolutionNotes] = useState(ticket.resolution_notes ?? "");

  const dirty = status !== ticket.status || priority !== ticket.priority || resolutionNotes !== (ticket.resolution_notes ?? "");

  return (
    <div className="grid gap-3 bg-zinc-950/50 p-3 rounded-md border border-zinc-800">
      <p className="text-xs font-semibold text-zinc-300">Gerenciamento</p>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <Label className="text-zinc-400 text-xs">Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="bg-zinc-900 border-zinc-800 text-zinc-200"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-zinc-400 text-xs">Prioridade</Label>
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger className="bg-zinc-900 border-zinc-800 text-zinc-200"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="baixa">Baixa</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="alta">Alta</SelectItem>
              <SelectItem value="critica">Crítica</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label className="text-zinc-400 text-xs">Resposta visível ao solicitante</Label>
        <Textarea
          value={resolutionNotes}
          onChange={(e) => setResolutionNotes(e.target.value)}
          rows={3}
          className="bg-zinc-900 border-zinc-800 text-zinc-200"
          placeholder="Resposta oficial mostrada para quem abriu o chamado."
        />
      </div>
      <div className="flex justify-end">
        <Button
          size="sm"
          disabled={!dirty || updateMut.isPending}
          onClick={() => {
            const patch: Record<string, unknown> = { status, priority, resolution_notes: resolutionNotes || null };
            if ((status === "resolvido" || status === "fechado") && !ticket.resolved_at) {
              patch.resolved_at = new Date().toISOString();
            }
            updateMut.mutate({ id: ticket.id, patch });
          }}
        >
          Salvar alterações
        </Button>
      </div>
    </div>
  );
}

function SuperCommentsThread({ ticketId }: { ticketId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const [isInternal, setIsInternal] = useState(false);

  const commentsQuery = useQuery({
    queryKey: ["super-ticket-comments", ticketId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_ticket_comments")
        .select("*")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const postMut = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Não autenticado");
      const { error } = await supabase.from("support_ticket_comments").insert({
        ticket_id: ticketId,
        author_id: user.id,
        body: body.trim(),
        is_internal: isInternal,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setBody("");
      qc.invalidateQueries({ queryKey: ["super-ticket-comments", ticketId] });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-zinc-300 flex items-center gap-1">
        <MessageCircle className="h-3 w-3" /> Conversa
      </p>
      {commentsQuery.data?.length === 0 && <p className="text-xs text-zinc-500">Sem mensagens.</p>}
      {commentsQuery.data?.map((c) => (
        <div key={c.id} className={`text-sm rounded p-2 ${c.is_internal ? "bg-amber-500/10 border border-amber-500/30" : "bg-zinc-800/50"}`}>
          {c.is_internal && <p className="text-[10px] uppercase font-bold text-amber-400 mb-1">Nota interna</p>}
          <p className="whitespace-pre-wrap text-zinc-200">{c.body}</p>
          <p className="text-[10px] text-zinc-500 mt-1">{format(new Date(c.created_at), "dd/MM HH:mm", { locale: ptBR })}</p>
        </div>
      ))}
      <div className="flex flex-col gap-2 pt-1">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Escreva uma mensagem..."
          rows={2}
          className="bg-zinc-900 border-zinc-800 text-zinc-200"
        />
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-xs text-zinc-400">
            <Checkbox checked={isInternal} onCheckedChange={(v) => setIsInternal(!!v)} />
            Nota interna (não visível ao solicitante)
          </label>
          <Button size="sm" onClick={() => postMut.mutate()} disabled={!body.trim() || postMut.isPending}>
            <Send className="h-4 w-4 mr-2" /> Enviar
          </Button>
        </div>
      </div>
    </div>
  );
}
