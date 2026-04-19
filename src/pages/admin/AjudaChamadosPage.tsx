import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useActiveEventId } from "@/contexts/EventContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { LifeBuoy, Plus, MessageCircle, Send } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const STATUS_LABEL: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  aberto: { label: "Aberto", variant: "default" },
  em_analise: { label: "Em análise", variant: "secondary" },
  resolvido: { label: "Resolvido", variant: "outline" },
  fechado: { label: "Fechado", variant: "outline" },
};

const CATEGORY_LABEL: Record<string, string> = {
  bug: "🐛 Bug / Erro",
  duvida: "❓ Dúvida",
  melhoria: "💡 Melhoria",
  acesso: "🔐 Acesso/Permissão",
  outro: "📌 Outro",
};

const PRIORITY_LABEL: Record<string, string> = {
  baixa: "Baixa",
  normal: "Normal",
  alta: "Alta",
  critica: "Crítica",
};

export default function AjudaChamadosPage() {
  const { user, profile } = useAuth();
  const eventId = useActiveEventId();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  const [form, setForm] = useState({
    subject: "",
    description: "",
    category: "duvida",
    priority: "normal",
  });

  const ticketsQuery = useQuery({
    queryKey: ["my-support-tickets", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createMut = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Não autenticado");
      const { error } = await supabase.from("support_tickets").insert({
        created_by: user.id,
        event_id: eventId ?? null,
        reporter_name: profile?.full_name ?? null,
        reporter_email: user.email ?? null,
        subject: form.subject.trim(),
        description: form.description.trim(),
        category: form.category,
        priority: form.priority,
        current_url: window.location.href,
        user_agent: navigator.userAgent,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Chamado enviado", description: "Sua solicitação foi encaminhada ao Super Admin." });
      setForm({ subject: "", description: "", category: "duvida", priority: "normal" });
      setShowForm(false);
      qc.invalidateQueries({ queryKey: ["my-support-tickets"] });
    },
    onError: (e: Error) => {
      toast({ title: "Erro ao enviar", description: e.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <LifeBuoy className="h-6 w-6 text-primary" />
            Chamados Técnicos
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Reporte problemas, tire dúvidas ou sugira melhorias. Sua mensagem vai direto ao Super Admin.
          </p>
        </div>
        {!showForm && (
          <Button onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-2" /> Abrir chamado
          </Button>
        )}
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Novo chamado</CardTitle>
            <CardDescription>Descreva com clareza o que aconteceu ou o que você precisa.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Categoria</Label>
                <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORY_LABEL).map(([k, l]) => (
                      <SelectItem key={k} value={k}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Prioridade</Label>
                <Select value={form.priority} onValueChange={(v) => setForm((f) => ({ ...f, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PRIORITY_LABEL).map(([k, l]) => (
                      <SelectItem key={k} value={k}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Assunto *</Label>
              <Input
                value={form.subject}
                onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                placeholder="Ex.: Erro ao gerar credencial"
                maxLength={200}
              />
            </div>
            <div>
              <Label>Descrição *</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Descreva o que aconteceu, em qual tela, e o que você esperava."
                rows={6}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Anexamos automaticamente: usuário, URL atual e navegador para ajudar no diagnóstico.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button
                onClick={() => createMut.mutate()}
                disabled={!form.subject.trim() || !form.description.trim() || createMut.isPending}
              >
                <Send className="h-4 w-4 mr-2" />
                {createMut.isPending ? "Enviando..." : "Enviar chamado"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase">Meus chamados</h2>
        {ticketsQuery.isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
        {ticketsQuery.data?.length === 0 && (
          <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Você ainda não abriu nenhum chamado.</CardContent></Card>
        )}
        {ticketsQuery.data?.map((t) => (
          <Card key={t.id} className="cursor-pointer hover:border-primary transition" onClick={() => setSelectedTicketId(selectedTicketId === t.id ? null : t.id)}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={STATUS_LABEL[t.status]?.variant ?? "outline"}>{STATUS_LABEL[t.status]?.label ?? t.status}</Badge>
                    <span className="text-xs text-muted-foreground">{CATEGORY_LABEL[t.category] ?? t.category}</span>
                    <span className="text-xs text-muted-foreground">• {PRIORITY_LABEL[t.priority]}</span>
                  </div>
                  <CardTitle className="text-base mt-1 truncate">{t.subject}</CardTitle>
                  <CardDescription className="text-xs">
                    {format(new Date(t.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            {selectedTicketId === t.id && (
              <CardContent className="space-y-3 border-t pt-4">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-1">Descrição</p>
                  <p className="text-sm whitespace-pre-wrap">{t.description}</p>
                </div>
                {t.resolution_notes && (
                  <div className="bg-muted/50 rounded-md p-3">
                    <p className="text-xs font-semibold text-muted-foreground mb-1">Resposta do Super Admin</p>
                    <p className="text-sm whitespace-pre-wrap">{t.resolution_notes}</p>
                  </div>
                )}
                <TicketCommentsThread ticketId={t.id} canPost={t.status === "aberto" || t.status === "em_analise"} />
              </CardContent>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

function TicketCommentsThread({ ticketId, canPost }: { ticketId: string; canPost: boolean }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [body, setBody] = useState("");

  const commentsQuery = useQuery({
    queryKey: ["ticket-comments", ticketId],
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
        is_internal: false,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setBody("");
      qc.invalidateQueries({ queryKey: ["ticket-comments", ticketId] });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
        <MessageCircle className="h-3 w-3" /> Conversa
      </p>
      {commentsQuery.data?.length === 0 && <p className="text-xs text-muted-foreground">Sem mensagens ainda.</p>}
      {commentsQuery.data?.map((c) => (
        <div key={c.id} className="text-sm bg-muted/30 rounded p-2">
          <p className="whitespace-pre-wrap">{c.body}</p>
          <p className="text-[10px] text-muted-foreground mt-1">
            {format(new Date(c.created_at), "dd/MM HH:mm", { locale: ptBR })}
          </p>
        </div>
      ))}
      {canPost && (
        <div className="flex gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
          <Input value={body} onChange={(e) => setBody(e.target.value)} placeholder="Escreva uma mensagem..." />
          <Button size="sm" onClick={() => postMut.mutate()} disabled={!body.trim() || postMut.isPending}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
