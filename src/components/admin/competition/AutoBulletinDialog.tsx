import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2, Sparkles, FileText, Lock, RefreshCw, Layers } from "lucide-react";
import { BULLETIN_STATUS } from "@/lib/resultStatus";
import {
  buildAutoBulletinContent,
  buildAutoBulletinByPhase,
  type BulletinScope,
  type BulletinStatusFilter,
  type AutoBulletinResult,
  type PhaseBulletin,
} from "@/lib/competition/autoBulletin";
import { useNextBulletinNumber } from "@/hooks/useNextBulletinNumber";

interface Props {
  eventId: string;
  /** Prova atual selecionada na Central (opcional, habilita escopo "prova"). */
  sportEventId?: string | null;
  /** Etapa atual (opcional, habilita escopo "etapa"). */
  stageId?: string | null;
}

export default function AutoBulletinDialog({ eventId, sportEventId, stageId }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  // Prévia em tempo real do próximo número (revalida ao focar a janela).
  // O número definitivo é reservado server-side pela RPC `rpc_create_bulletin`.
  const nextNumberQuery = useNextBulletinNumber(eventId, open);

  const [scope, setScope] = useState<BulletinScope>(
    sportEventId ? "sport_event" : stageId ? "stage" : "event",
  );
  const [statusFilter, setStatusFilter] = useState<BulletinStatusFilter>("publicado");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [previewMeta, setPreviewMeta] = useState<{
    items: number;
    matches: number;
    number: number;
    matchIds: string[];
    sportEventIds: string[];
  } | null>(null);
  const [generating, setGenerating] = useState(false);

  // Modo "separar por fase": além do agregado em rascunho, gera 1 boletim por fase.
  const [splitByPhase, setSplitByPhase] = useState(false);
  const [phasesPreview, setPhasesPreview] = useState<PhaseBulletin[]>([]);

  // Reset ao abrir
  useEffect(() => {
    if (!open) return;
    setScope(sportEventId ? "sport_event" : stageId ? "stage" : "event");
    setStatusFilter("publicado");
    setDateFrom("");
    setDateTo("");
    setTitle("");
    setContent("");
    setPreviewMeta(null);
    setSplitByPhase(false);
    setPhasesPreview([]);
  }, [open, sportEventId, stageId]);

  const resolveStageSportEventIds = async (): Promise<string[] | null> => {
    if (scope !== "stage" || !stageId) return null;
    const { data: pse, error } = await supabase
      .from("participant_sport_events")
      .select("sport_event_id, participants!inner(participant_event_stages!inner(event_stage_id))")
      .eq("participants.participant_event_stages.event_stage_id", stageId);
    if (error) throw error;
    return Array.from(
      new Set(((pse ?? []) as Array<{ sport_event_id: string | null }>)
        .map((r) => r.sport_event_id)
        .filter((id): id is string => !!id)),
    );
  };

  const generate = async () => {
    setGenerating(true);
    try {
      const stageSportEventIds = await resolveStageSportEventIds();
      const baseFilters = {
        eventId,
        scope,
        sportEventId: scope === "sport_event" ? sportEventId : null,
        stageSportEventIds,
        statusFilter,
        dateFrom: dateFrom || null,
        dateTo: dateTo || null,
      };

      let result: AutoBulletinResult;
      let phases: PhaseBulletin[] = [];

      if (splitByPhase) {
        const byPhase = await buildAutoBulletinByPhase(baseFilters);
        result = byPhase.aggregate;
        phases = byPhase.perPhase;
      } else {
        result = await buildAutoBulletinContent(baseFilters);
      }

      setContent(result.contentMd);
      setTitle(result.suggestedTitle);
      setPreviewMeta({
        items: result.itemsCount,
        matches: result.matchesCount,
        number: result.suggestedNumber,
        matchIds: result.matchIds,
        sportEventIds: result.sportEventIds,
      });
      setPhasesPreview(phases);

      if (result.itemsCount === 0) {
        toast.warning("Nenhum resultado encontrado", {
          description: "Ajuste os filtros (status, escopo, datas) e tente novamente.",
        });
      } else if (splitByPhase) {
        toast.success(
          `${result.itemsCount} item(ns) · ${phases.length} fase(s) com resultado`,
        );
      } else {
        toast.success(`${result.itemsCount} item(ns) compilado(s)`);
      }
    } catch (e: any) {
      toast.error("Erro ao gerar boletim", { description: e?.message ?? String(e) });
    } finally {
      setGenerating(false);
    }
  };

  const saveDraft = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error("Informe um título.");
      if (!content.trim()) throw new Error("Gere o conteúdo antes de salvar.");
      if (!previewMeta) throw new Error("Pré-visualize o conteúdo antes de salvar.");

      // 1) Reserva atômica do número via RPC (server-side, evita duplicidade
      //    quando dois usuários criam boletins simultaneamente).
      const { data: rpcData, error: rpcErr } = await supabase.rpc("rpc_create_bulletin", {
        p_event_id: eventId,
        p_title: title.trim(),
        p_content_md: content,
      });
      if (rpcErr) throw rpcErr;

      const reserved = rpcData as { id: string; number: number };
      const bulletinId = reserved.id;
      const reservedNumber = reserved.number;

      // 2) Garante status `rascunho` e rastreia updated_by (RPC cria com defaults).
      const { error: updErr } = await supabase
        .from("official_bulletins")
        .update({
          status: BULLETIN_STATUS.RASCUNHO,
          updated_by: user?.id ?? null,
        })
        .eq("id", bulletinId);
      if (updErr) throw updErr;

      const data = { id: bulletinId, number: reservedNumber };

      let linkWarn = "";
      if (previewMeta.sportEventIds.length > 0) {
        const rows = previewMeta.sportEventIds.map((sport_event_id) => ({
          bulletin_id: bulletinId,
          sport_event_id,
        }));
        const { error: linkErr } = await (supabase as any)
          .from("bulletin_sport_events")
          .insert(rows);
        if (linkErr) {
          console.warn("[AutoBulletin] vínculo sport_events falhou:", linkErr.message);
          linkWarn = linkErr.message;
        }
      }
      if (previewMeta.matchIds.length > 0) {
        const rows = previewMeta.matchIds.map((match_id) => ({
          bulletin_id: bulletinId,
          match_id,
        }));
        const { error: linkErr } = await (supabase as any)
          .from("bulletin_matches")
          .insert(rows);
        if (linkErr) {
          console.warn("[AutoBulletin] vínculo matches falhou:", linkErr.message);
          linkWarn = linkErr.message;
        }
      }

      return { ...data, linkWarn };
    },
    onSuccess: (data: any) => {
      const previewN = previewMeta?.number;
      const reservedN = data.number;
      const numberShifted = previewN != null && previewN !== reservedN;
      toast.success(`Boletim #${reservedN} criado em rascunho`, {
        description: [
          numberShifted ? `Número reajustado (prévia era #${previewN}, outro usuário gerou primeiro).` : null,
          data.linkWarn
            ? `Vínculos não persistidos: ${data.linkWarn}`
            : `${previewMeta?.matchIds.length ?? 0} partida(s) e ${previewMeta?.sportEventIds.length ?? 0} prova(s) vinculadas.`,
        ].filter(Boolean).join(" "),
      });
      queryClient.invalidateQueries({ queryKey: ["bulletins-all"] });
      queryClient.invalidateQueries({ queryKey: ["next-bulletin-number", eventId] });
      setOpen(false);
    },
    onError: (e: any) => toast.error("Falha ao salvar", { description: e?.message }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary" className="gap-1">
          <Sparkles className="h-4 w-4" />
          Gerar boletim automático
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Gerar Boletim Oficial automaticamente
          </DialogTitle>
          <DialogDescription>
            Compila as partidas com resultado em Markdown agrupado por modalidade e fase. O boletim é salvo
            como <strong>rascunho</strong>, pronto para revisão, assinatura e publicação.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Prévia do próximo número (com trava server-side) */}
          <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2">
            <div className="flex items-center gap-2">
              <Lock className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Próximo número (prévia):</span>
              {nextNumberQuery.isLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Badge variant="secondary" className="font-mono">
                  #{nextNumberQuery.data ?? "—"}
                </Badge>
              )}
              <span className="text-[11px] text-muted-foreground">
                Reservado de forma atômica no salvamento.
              </span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs"
              onClick={() => nextNumberQuery.refetch()}
              disabled={nextNumberQuery.isFetching}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${nextNumberQuery.isFetching ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          </div>

          {/* Filtros */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Escopo</Label>
              <Select value={scope} onValueChange={(v) => setScope(v as BulletinScope)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="event">Evento inteiro</SelectItem>
                  {stageId && <SelectItem value="stage">Etapa atual</SelectItem>}
                  {sportEventId && <SelectItem value="sport_event">Apenas esta prova</SelectItem>}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Status dos resultados</Label>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as BulletinStatusFilter)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="publicado">Publicados</SelectItem>
                  <SelectItem value="resultado_validado">Validados (pré-publicação)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Data inicial (opcional)</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Data final (opcional)</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button size="sm" onClick={generate} disabled={generating}>
              {generating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
              Gerar prévia
            </Button>
            {previewMeta && (
              <Badge variant="outline">
                {previewMeta.items} item(ns) · {previewMeta.matches} partida(s) · {previewMeta.sportEventIds.length} prova(s) · próximo nº #{previewMeta.number}
              </Badge>
            )}
          </div>

          {/* Título e conteúdo editáveis */}
          {content && (
            <>
              <div className="space-y-1">
                <Label className="text-xs">Título do boletim</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Conteúdo (Markdown editável)</Label>
                <ScrollArea className="h-[280px] rounded-md border">
                  <Textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="min-h-[280px] border-0 font-mono text-xs"
                  />
                </ScrollArea>
                <p className="text-[11px] text-muted-foreground">
                  Você pode editar livremente antes de salvar. O boletim ficará como <strong>rascunho</strong>.
                </p>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button
            onClick={() => saveDraft.mutate()}
            disabled={!content || !title.trim() || saveDraft.isPending}
          >
            {saveDraft.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Salvar como rascunho
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
