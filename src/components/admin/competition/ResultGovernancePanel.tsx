import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEventId } from "@/contexts/EventContext";
import { RESULT_STATUS, BULLETIN_STATUS } from "@/lib/resultStatus";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CheckCircle, Send, Loader2, FileText, Plus, ArrowRight, Undo2, User, Calendar } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  sportEventId: string | null;
}

export default function ResultGovernancePanel({ sportEventId }: Props) {
  const eventId = useActiveEventId();
  const queryClient = useQueryClient();
  const [selectedBulletinId, setSelectedBulletinId] = useState<string>("");
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  // Counts of results by status for this sport_event
  const { data: counts } = useQuery({
    queryKey: ["governance-counts", eventId, sportEventId],
    enabled: !!sportEventId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("competition_match_results")
        .select("id, result_status, match_id, competition_matches!inner(event_id, sport_event_id)")
        .eq("competition_matches.event_id", eventId)
        .eq("competition_matches.sport_event_id", sportEventId!);
      if (error) throw error;
      const launched = (data || []).filter(r => r.result_status === RESULT_STATUS.LAUNCHED).length;
      const validated = (data || []).filter(r => r.result_status === RESULT_STATUS.VALIDATED).length;
      const published = (data || []).filter(r => r.result_status === RESULT_STATUS.PUBLISHED).length;
      return { launched, validated, published, total: (data || []).length };
    },
  });

  // Bulletins (any status) for context + dropdown
  const { data: bulletins = [] } = useQuery({
    queryKey: ["bulletins-all", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("official_bulletins")
        .select("id, number, title, status, published_at")
        .eq("event_id", eventId)
        .order("number", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const publishedBulletins = bulletins.filter((b: any) => b.status === BULLETIN_STATUS.PUBLICADO);

  // Published results with bulletin info + auditoria de quem publicou
  const { data: publishedRows = [] } = useQuery({
    queryKey: ["published-results-bulletin", eventId, sportEventId],
    enabled: !!sportEventId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("competition_match_results")
        .select(`
          id, published_at, published_bulletin_id, published_by,
          competition_matches!inner(match_number, event_id, sport_event_id),
          official_bulletins:published_bulletin_id(number, title)
        `)
        .eq("competition_matches.event_id", eventId)
        .eq("competition_matches.sport_event_id", sportEventId!)
        .eq("result_status", RESULT_STATUS.PUBLISHED)
        .order("published_at", { ascending: false })
        .limit(10);
      if (error) throw error;

      // Buscar nomes dos publicadores (lookup separado — não há FK declarada para profiles)
      const publisherIds = Array.from(new Set((data || []).map((r: any) => r.published_by).filter(Boolean)));
      let publisherMap: Record<string, string> = {};
      if (publisherIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", publisherIds);
        publisherMap = Object.fromEntries((profs || []).map((p: any) => [p.id, p.full_name]));
      }
      return (data || []).map((r: any) => ({ ...r, publisher_name: r.published_by ? publisherMap[r.published_by] ?? "—" : null }));
    },
  });

  const validateResults = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("rpc_validate_results_for_sport_event", {
        p_event_id: eventId,
        p_sport_event_id: sportEventId!,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      toast.success(`${data.validated_count} resultado(s) validado(s).`);
      queryClient.invalidateQueries({ queryKey: ["governance-counts"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const publishResults = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("rpc_publish_results_for_sport_event", {
        p_event_id: eventId,
        p_sport_event_id: sportEventId!,
        p_bulletin_id: selectedBulletinId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: async (data: any) => {
      toast.success(`${data.published_count} resultado(s) publicado(s).`);
      setSelectedBulletinId("");
      queryClient.invalidateQueries({ queryKey: ["governance-counts"] });
      queryClient.invalidateQueries({ queryKey: ["published-results-bulletin"] });
      queryClient.invalidateQueries({ queryKey: ["competition_phases"] });
      if (sportEventId) {
        try {
          const { data: transResult } = await supabase.rpc("check_phase_transitions", { p_sport_event_id: sportEventId });
          const transitions = (transResult as any)?.transitions || [];
          for (const t of transitions) {
            if (t.action === "completed") toast.info(`Fase "${t.phase_name}" concluída automaticamente.`);
            if (t.action === "started") toast.info(`Fase "${t.phase_name}" iniciada automaticamente.`);
          }
        } catch {}
      }
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Despublicar — volta resultados de 'publicado' para 'resultado_validado'
  const [unpublishReason, setUnpublishReason] = useState("");
  const unpublishResults = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("rpc_unpublish_results_for_sport_event" as any, {
        p_event_id: eventId,
        p_sport_event_id: sportEventId!,
        p_reason: unpublishReason.trim() || null,
      } as any);
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      const count = data?.unpublished_count ?? 0;
      if (count === 0) {
        toast.info("Nenhum resultado publicado para despublicar.");
      } else {
        toast.success(`${count} resultado(s) despublicado(s). Saíram do portal público.`);
      }
      setUnpublishReason("");
      queryClient.invalidateQueries({ queryKey: ["governance-counts"] });
      queryClient.invalidateQueries({ queryKey: ["published-results-bulletin"] });
      queryClient.invalidateQueries({ queryKey: ["public-results"] });
    },
    onError: (e: any) => toast.error(e.message),
  });
  const createBulletin = useMutation({
    mutationFn: async () => {
      if (!newTitle.trim()) throw new Error("Informe um título para o boletim.");
      const nextNumber = (bulletins[0]?.number ?? 0) + 1;
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("official_bulletins")
        .insert({
          event_id: eventId,
          number: nextNumber,
          title: newTitle.trim(),
          status: BULLETIN_STATUS.PUBLICADO,
          published_at: new Date().toISOString(),
          published_by: user?.id ?? null,
          content_md: `# Boletim Oficial #${nextNumber}\n\n${newTitle.trim()}`,
        })
        .select("id, number, title")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      toast.success(`Boletim #${data.number} criado e publicado.`);
      setSelectedBulletinId(data.id);
      setNewTitle("");
      setCreateOpen(false);
      queryClient.invalidateQueries({ queryKey: ["bulletins-all"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!sportEventId) {
    return <p className="text-sm text-muted-foreground">Selecione uma prova para gerenciar governança.</p>;
  }

  return (
    <div className="space-y-4">
      {/* Visual step guide */}
      <Card className="bg-muted/30">
        <CardContent className="pt-4">
          <div className="flex items-center justify-between gap-2 text-xs">
            <StepBadge n={1} label="Lançar" desc="mesário registra placar" active={(counts?.launched ?? 0) > 0} />
            <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
            <StepBadge n={2} label="Validar" desc="coordenação confere" active={(counts?.validated ?? 0) > 0} />
            <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
            <StepBadge n={3} label="Publicar" desc="vincular a um boletim" active={(counts?.published ?? 0) > 0} />
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            Apenas resultados <strong>publicados</strong> ficam visíveis no portal público. Publicar exige um <strong>Boletim Oficial</strong> publicado.
          </p>
        </CardContent>
      </Card>

      {/* Counters */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold">{counts?.launched ?? "—"}</p>
            <p className="text-xs text-muted-foreground">Lançados</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-primary">{counts?.validated ?? "—"}</p>
            <p className="text-xs text-muted-foreground">Validados</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-success">{counts?.published ?? "—"}</p>
            <p className="text-xs text-muted-foreground">Publicados</p>
          </CardContent>
        </Card>
      </div>

      {/* Validate */}
      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><CheckCircle className="h-4 w-4" /> 2. Validar Resultados</CardTitle></CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">
            Marca todos os resultados "lançados" desta prova como "validados". {counts?.launched || 0} pendente(s).
          </p>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" disabled={!counts?.launched || validateResults.isPending}>
                {validateResults.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle className="h-4 w-4 mr-1" />}
                Validar {counts?.launched || 0} resultado(s)
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Validar resultados?</AlertDialogTitle>
                <AlertDialogDescription>{counts?.launched} resultado(s) lançado(s) serão marcados como validados.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => validateResults.mutate()}>Validar</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>

      {/* Publish */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2"><Send className="h-4 w-4" /> 3. Publicar Resultados</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Publica resultados validados vinculando a um <strong>Boletim Oficial</strong>. {counts?.validated || 0} pendente(s).
            {publishedBulletins.length === 0 && (
              <span className="block mt-1 text-warning">⚠️ Nenhum boletim publicado disponível — crie um abaixo.</span>
            )}
          </p>

          <div className="flex gap-2 items-end flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <Label className="text-xs font-medium mb-1 block">Boletim publicado</Label>
              <Select value={selectedBulletinId} onValueChange={setSelectedBulletinId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um boletim..." />
                </SelectTrigger>
                <SelectContent>
                  {publishedBulletins.map((b: any) => (
                    <SelectItem key={b.id} value={b.id}>
                      <span className="flex items-center gap-1"><FileText className="h-3 w-3" /> #{b.number} — {b.title}</span>
                    </SelectItem>
                  ))}
                  {publishedBulletins.length === 0 && (
                    <div className="p-2 text-xs text-muted-foreground">Nenhum boletim publicado.</div>
                  )}
                </SelectContent>
              </Select>
            </div>

            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <Plus className="h-4 w-4 mr-1" />
                  Novo boletim
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Criar novo Boletim Oficial</DialogTitle>
                  <DialogDescription>
                    Será criado como <strong>#{(bulletins[0]?.number ?? 0) + 1}</strong> e já publicado, pronto para vincular resultados.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-2 py-2">
                  <Label htmlFor="bulletin-title">Título do boletim *</Label>
                  <Input
                    id="bulletin-title"
                    placeholder="Ex: Resultados do dia 18/04 - Manhã"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Você pode editar conteúdo completo, PDF e demais detalhes em <em>Relatórios → Boletins</em>.
                  </p>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
                  <Button onClick={() => createBulletin.mutate()} disabled={!newTitle.trim() || createBulletin.isPending}>
                    {createBulletin.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                    Criar e publicar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" disabled={!counts?.validated || !selectedBulletinId || publishResults.isPending}>
                  {publishResults.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
                  Publicar {counts?.validated || 0}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Publicar resultados?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {counts?.validated} resultado(s) validado(s) serão publicados e vinculados ao boletim selecionado. Esta ação é definitiva.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => publishResults.mutate()}>Publicar</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>

      {/* Published list with bulletin reference + auditoria + despublicar */}
      {publishedRows.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="h-4 w-4" /> Resultados publicados (últimos 10)
            </CardTitle>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="outline" className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/5 hover:text-destructive">
                  {unpublishResults.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Undo2 className="h-3.5 w-3.5" />}
                  Despublicar todos
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Despublicar resultados desta prova?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Os {counts?.published ?? 0} resultado(s) publicado(s) voltarão para o status <strong>Validado</strong> e <strong>sairão do portal público imediatamente</strong>. A ação fica registrada na auditoria.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="py-2 space-y-2">
                  <Label htmlFor="unpub-reason" className="text-xs">Motivo (opcional, mas recomendado)</Label>
                  <Input
                    id="unpub-reason"
                    placeholder="Ex.: erro de digitação no placar, recurso CDE deferido…"
                    value={unpublishReason}
                    onChange={(e) => setUnpublishReason(e.target.value)}
                  />
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => unpublishResults.mutate()}
                    className="bg-destructive text-white hover:bg-destructive/90"
                  >
                    Despublicar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {publishedRows.map((r: any) => (
                <div key={r.id} className="flex flex-col gap-1 text-xs border-b pb-2 last:border-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="font-medium">Partida #{r.competition_matches?.match_number ?? "?"}</span>
                    {r.official_bulletins ? (
                      <Badge variant="secondary" className="font-normal">
                        <FileText className="h-3 w-3 mr-1" />
                        Boletim #{r.official_bulletins.number} — {r.official_bulletins.title}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="font-normal text-muted-foreground">sem boletim</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                    {r.published_at && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(r.published_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </span>
                    )}
                    {r.publisher_name && (
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {r.publisher_name}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StepBadge({ n, label, desc, active }: { n: number; label: string; desc: string; active: boolean }) {
  return (
    <div className="flex items-center gap-2 flex-1 min-w-0">
      <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground border"}`}>
        {n}
      </div>
      <div className="min-w-0">
        <p className="font-medium leading-tight truncate">{label}</p>
        <p className="text-[10px] text-muted-foreground leading-tight truncate">{desc}</p>
      </div>
    </div>
  );
}
