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
import { toast } from "sonner";
import { Loader2, Sparkles, FileText } from "lucide-react";
import { BULLETIN_STATUS } from "@/lib/resultStatus";
import {
  buildAutoBulletinContent,
  type BulletinScope,
  type BulletinStatusFilter,
} from "@/lib/competition/autoBulletin";

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
  }, [open, sportEventId, stageId]);

  const generate = async () => {
    setGenerating(true);
    try {
      // Resolve sport_event_ids da etapa via participant_event_stages → participant_sport_events
      let stageSportEventIds: string[] | null = null;
      if (scope === "stage" && stageId) {
        const { data: pse, error } = await supabase
          .from("participant_sport_events")
          .select("sport_event_id, participants!inner(participant_event_stages!inner(event_stage_id))")
          .eq("participants.participant_event_stages.event_stage_id", stageId);
        if (error) throw error;
        stageSportEventIds = Array.from(
          new Set(((pse ?? []) as Array<{ sport_event_id: string | null }>)
            .map((r) => r.sport_event_id)
            .filter((id): id is string => !!id)),
        );
      }

      const result = await buildAutoBulletinContent({
        eventId,
        scope,
        sportEventId: scope === "sport_event" ? sportEventId : null,
        stageSportEventIds,
        statusFilter,
        dateFrom: dateFrom || null,
        dateTo: dateTo || null,
      });

      setContent(result.contentMd);
      setTitle(result.suggestedTitle);
      setPreviewMeta({
        items: result.itemsCount,
        matches: result.matchesCount,
        number: result.suggestedNumber,
        matchIds: result.matchIds,
        sportEventIds: result.sportEventIds,
      });

      if (result.itemsCount === 0) {
        toast.warning("Nenhum resultado encontrado", {
          description: "Ajuste os filtros (status, escopo, datas) e tente novamente.",
        });
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

      const { data, error } = await supabase
        .from("official_bulletins")
        .insert({
          event_id: eventId,
          number: previewMeta.number,
          title: title.trim(),
          content_md: content,
          status: BULLETIN_STATUS.RASCUNHO,
          created_by: user?.id ?? null,
          updated_by: user?.id ?? null,
        })
        .select("id, number")
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      toast.success(`Boletim #${data.number} criado em rascunho`, {
        description: "Pronto para revisão e publicação.",
      });
      queryClient.invalidateQueries({ queryKey: ["bulletins-all"] });
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
                {previewMeta.items} item(ns) · {previewMeta.matches} partida(s) · próximo nº #{previewMeta.number}
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
