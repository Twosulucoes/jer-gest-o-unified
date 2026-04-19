import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useEventContext } from "@/contexts/EventContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import {
  Loader2, RefreshCw, Sparkles, CheckCircle2, AlertTriangle,
  ClipboardCopy, ChevronDown, ChevronUp, Info,
} from "lucide-react";

interface Pendencia {
  id: string;
  source_row_number: number;
  normalized_name: string | null;
  raw_cpf: string | null;
  raw_birth_date: string | null;
  modality_raw: string | null;
  prova_raw: string | null;
  institution_raw: string | null;
  pending_reason_code: string;
  pending_reason_detail: string | null;
  resolution_status: string;
  raw_payload_json: Record<string, unknown> | null;
  created_at: string;
}

interface AiSuggestion {
  id: string;
  action: "set_category_slug" | "set_sport_event_id" | "tm_category" | "institution_match" | "fix_spreadsheet" | "dismiss";
  value?: string;
  hint: string;
  confidence: "high" | "medium" | "low";
  reasoning: string;
}

const TM_CHOICES = [
  { value: "tm-12-14", label: "tm-12-14 (12 a 14 anos)" },
  { value: "tm-14-15", label: "tm-14-15 (14 a 15 anos)" },
];

const REASON_LABELS: Record<string, { label: string; color: "destructive" | "secondary" | "outline" | "warning" }> = {
  TM_2012_MANUAL_CATEGORY_SELECTION: { label: "TM 2012 — escolha categoria", color: "warning" },
  SPORT_EVENT_NOT_FOUND: { label: "Prova não encontrada", color: "destructive" },
  SPORT_PARSE_FAILED: { label: "Modalidade não identificada", color: "destructive" },
  CATEGORY_PARSE_FAILED: { label: "Categoria não resolvida", color: "secondary" },
  BIRTH_DATE_MISSING: { label: "Data de nascimento ausente", color: "secondary" },
  BIRTH_DATE_INVALID: { label: "Data de nascimento inválida", color: "secondary" },
  CPF_INVALID: { label: "CPF inválido", color: "outline" },
  CPF_MISSING: { label: "CPF ausente", color: "outline" },
  INSTITUTION_NOT_FOUND: { label: "Escola não encontrada", color: "secondary" },
  PERSON_MATCH_AMBIGUOUS: { label: "Pessoa ambígua", color: "destructive" },
  MANUAL_REVIEW_REQUIRED: { label: "Revisão manual", color: "secondary" },
};

const CONFIDENCE_COLORS: Record<string, string> = {
  high: "text-green-600 bg-green-50 border-green-200",
  medium: "text-yellow-700 bg-yellow-50 border-yellow-200",
  low: "text-gray-500 bg-gray-50 border-gray-200",
};

const CONFIDENCE_LABELS: Record<string, string> = {
  high: "Alta confiança",
  medium: "Média confiança",
  low: "Baixa confiança",
};

export default function ImportacaoPendenciasPage() {
  const { activeEventId } = useEventContext();
  const [loading, setLoading] = useState(false);
  const [pendencias, setPendencias] = useState<Pendencia[]>([]);
  const [filterCode, setFilterCode] = useState<string>("all");
  const [showResolved, setShowResolved] = useState(false);

  // TM 2012 manual choices
  const [tmChoices, setTmChoices] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  // AI suggestions
  const [aiSuggestions, setAiSuggestions] = useState<Record<string, AiSuggestion>>({});
  const [aiLoading, setAiLoading] = useState(false);
  const [expandedReasoning, setExpandedReasoning] = useState<Set<string>>(new Set());

  async function load() {
    if (!activeEventId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("import_pendencias")
      .select("id, source_row_number, normalized_name, raw_cpf, raw_birth_date, modality_raw, prova_raw, institution_raw, pending_reason_code, pending_reason_detail, resolution_status, raw_payload_json, created_at")
      .eq("event_id", activeEventId)
      .order("created_at", { ascending: false })
      .limit(500);
    setLoading(false);
    if (error) { toast.error("Falha ao carregar pendências: " + error.message); return; }
    setPendencias((data ?? []) as Pendencia[]);
  }

  useEffect(() => { load(); }, [activeEventId]);

  // Derive available reason codes for filter
  const availableCodes = useMemo(() => {
    const codes = new Set(pendencias.map((p) => p.pending_reason_code));
    return Array.from(codes).sort();
  }, [pendencias]);

  const filtered = useMemo(() => {
    return pendencias.filter((p) => {
      if (!showResolved && p.resolution_status === "resolved") return false;
      if (filterCode !== "all" && p.pending_reason_code !== filterCode) return false;
      return true;
    });
  }, [pendencias, filterCode, showResolved]);

  const stats = useMemo(() => {
    const total = pendencias.length;
    const pending = pendencias.filter((p) => p.resolution_status === "pending").length;
    const resolved = total - pending;
    const byCode = pendencias.reduce<Record<string, number>>((acc, p) => {
      if (p.resolution_status === "pending") acc[p.pending_reason_code] = (acc[p.pending_reason_code] ?? 0) + 1;
      return acc;
    }, {});
    return { total, pending, resolved, byCode };
  }, [pendencias]);

  // ── AI analysis ──────────────────────────────────────────────────────
  async function runAiAnalysis() {
    if (!activeEventId) return;
    const pendingIds = pendencias
      .filter((p) => p.resolution_status === "pending")
      .map((p) => p.id);
    if (pendingIds.length === 0) { toast.info("Nenhuma pendência aberta para analisar."); return; }

    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-resolve-pendencias", {
        body: { event_id: activeEventId, pending_ids: pendingIds.slice(0, 50) },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);

      const suggestions: AiSuggestion[] = (data as any).suggestions ?? [];
      const map: Record<string, AiSuggestion> = {};
      for (const s of suggestions) map[s.id] = s;
      setAiSuggestions((prev) => ({ ...prev, ...map }));

      // Auto-fill TM choices from AI suggestions
      const newChoices: Record<string, string> = {};
      for (const s of suggestions) {
        if (s.action === "tm_category" && s.value) newChoices[s.id] = s.value;
      }
      if (Object.keys(newChoices).length > 0) {
        setTmChoices((prev) => ({ ...prev, ...newChoices }));
      }

      const provider = (data as any).provider as string | undefined;
      const providerLabel = provider === "grok" ? "Grok (xAI)" : provider === "claude" ? "Claude (Anthropic)" : provider === "deepseek" ? "DeepSeek" : "IA";
      toast.success(`${providerLabel} analisou ${suggestions.length} pendência(s).`);
    } catch (e: any) {
      toast.error("Falha na análise IA: " + (e?.message ?? String(e)));
    } finally {
      setAiLoading(false);
    }
  }

  // ── TM 2012 save ─────────────────────────────────────────────────────
  async function saveTmChoice(p: Pendencia) {
    const chosen = tmChoices[p.id];
    if (!chosen) { toast.error("Selecione uma categoria primeiro"); return; }
    setSavingId(p.id);
    try {
      const { data, error } = await supabase.functions.invoke("import-inscricoes", {
        body: { action: "apply_manual_resolution", pending_id: p.id, chosen_category_slug: chosen },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(`Categoria gravada: ${chosen}. Reimporte a planilha para reprocessar.`);
      await load();
    } catch (e: any) {
      toast.error("Falha: " + (e?.message ?? String(e)));
    } finally {
      setSavingId(null);
    }
  }

  // ── Mark reviewed (non-TM types) ─────────────────────────────────────
  async function markReviewed(p: Pendencia) {
    setSavingId(p.id);
    try {
      const { data, error } = await supabase.functions.invoke("import-inscricoes", {
        body: {
          action: "mark_reviewed",
          pending_id: p.id,
          ai_suggestion: aiSuggestions[p.id] ?? null,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("Marcado como revisado.");
      await load();
    } catch (e: any) {
      toast.error("Falha: " + (e?.message ?? String(e)));
    } finally {
      setSavingId(null);
    }
  }

  function toggleReasoning(id: string) {
    setExpandedReasoning((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function copyHint(hint: string) {
    navigator.clipboard.writeText(hint).then(() => toast.info("Copiado!"));
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Pendências de importação</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Itens que precisam de revisão ou correção antes de serem importados. Use a IA para sugestões automáticas.
        </p>
      </div>

      {/* Stats */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">Total: {stats.total}</Badge>
        <Badge variant="secondary">Pendentes: {stats.pending}</Badge>
        <Badge className="bg-green-600">Resolvidas: {stats.resolved}</Badge>
        {Object.entries(stats.byCode).map(([code, count]) => (
          <Badge key={code} variant="outline" className="text-xs cursor-pointer" onClick={() => setFilterCode(code)}>
            {REASON_LABELS[code]?.label ?? code}: {count}
          </Badge>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Recarregar
        </Button>

        <Button
          size="sm"
          onClick={runAiAnalysis}
          disabled={aiLoading || stats.pending === 0}
          className="gap-2"
        >
          {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {aiLoading ? "Analisando com IA…" : "Analisar com IA"}
        </Button>

        <Select value={filterCode} onValueChange={setFilterCode}>
          <SelectTrigger className="w-[220px] h-9 text-xs">
            <SelectValue placeholder="Filtrar por tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {availableCodes.map((code) => (
              <SelectItem key={code} value={code}>
                {REASON_LABELS[code]?.label ?? code}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowResolved((v) => !v)}
          className="text-xs"
        >
          {showResolved ? "Ocultar resolvidas" : "Mostrar resolvidas"}
        </Button>
      </div>

      {/* AI info banner */}
      {Object.keys(aiSuggestions).length > 0 && (
        <Alert className="border-primary/30 bg-primary/5">
          <Sparkles className="h-4 w-4 text-primary" />
          <AlertDescription className="text-sm">
            IA gerou {Object.keys(aiSuggestions).length} sugestões. Revise e aplique abaixo.
            Para TM 2012, a categoria já foi pré-preenchida — clique em <strong>Salvar</strong> para confirmar.
            Para outros tipos, leia a sugestão, corrija na planilha e clique em <strong>Revisado</strong>.
          </AlertDescription>
        </Alert>
      )}

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lista de pendências</CardTitle>
          <CardDescription>
            Após corrigir itens na planilha, reimporte — a importação é idempotente e não duplica dados.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground p-6">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground p-6">
              {pendencias.length === 0 ? "Nenhuma pendência para este evento." : "Nenhuma pendência neste filtro."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-14">Linha</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Nascimento</TableHead>
                    <TableHead>Modalidade / Prova</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Sugestão IA</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((p) => {
                    const isResolved = p.resolution_status === "resolved";
                    const isTm = p.pending_reason_code === "TM_2012_MANUAL_CATEGORY_SELECTION";
                    const isSaving = savingId === p.id;
                    const suggestion = aiSuggestions[p.id];
                    const mr = (p.raw_payload_json as any)?.manual_resolution;
                    const expanded = expandedReasoning.has(p.id);

                    return (
                      <TableRow key={p.id} className={isResolved ? "opacity-50" : ""}>
                        {/* Linha */}
                        <TableCell className="text-xs text-muted-foreground">{p.source_row_number}</TableCell>

                        {/* Nome */}
                        <TableCell>
                          <p className="font-medium text-sm">{p.normalized_name ?? "—"}</p>
                          {p.raw_cpf && <p className="font-mono text-[11px] text-muted-foreground">{p.raw_cpf}</p>}
                        </TableCell>

                        {/* Nascimento */}
                        <TableCell className="text-sm">{p.raw_birth_date ?? "—"}</TableCell>

                        {/* Modalidade / Prova */}
                        <TableCell>
                          <p className="text-xs">{p.modality_raw ?? "—"}</p>
                          {p.prova_raw && <p className="text-[11px] text-muted-foreground">{p.prova_raw}</p>}
                          {p.institution_raw && <p className="text-[11px] text-muted-foreground italic">{p.institution_raw}</p>}
                        </TableCell>

                        {/* Tipo */}
                        <TableCell>
                          <Badge variant={REASON_LABELS[p.pending_reason_code]?.color ?? "outline"} className="text-[10px] whitespace-nowrap">
                            {REASON_LABELS[p.pending_reason_code]?.label ?? p.pending_reason_code}
                          </Badge>
                          {p.pending_reason_detail && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Info className="h-3 w-3 text-muted-foreground ml-1 inline cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs text-xs">{p.pending_reason_detail}</TooltipContent>
                            </Tooltip>
                          )}
                        </TableCell>

                        {/* Sugestão IA */}
                        <TableCell className="max-w-xs">
                          {suggestion ? (
                            <div className="space-y-1">
                              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${CONFIDENCE_COLORS[suggestion.confidence]}`}>
                                {CONFIDENCE_LABELS[suggestion.confidence]}
                              </span>
                              <div className="flex items-start gap-1">
                                <p className="text-xs text-foreground leading-snug flex-1">{suggestion.hint}</p>
                                {(suggestion.action === "fix_spreadsheet" || suggestion.action === "institution_match") && (
                                  <button onClick={() => copyHint(suggestion.hint)} className="shrink-0 mt-0.5">
                                    <ClipboardCopy className="h-3 w-3 text-muted-foreground hover:text-primary" />
                                  </button>
                                )}
                              </div>
                              {isTm && suggestion.value && (
                                <p className="text-[10px] text-primary font-mono">→ {suggestion.value}</p>
                              )}
                              <button
                                onClick={() => toggleReasoning(p.id)}
                                className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
                              >
                                {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                {expanded ? "Ocultar" : "Ver raciocínio"}
                              </button>
                              {expanded && (
                                <p className="text-[11px] text-muted-foreground italic border-l-2 border-muted pl-2 leading-snug">
                                  {suggestion.reasoning}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-[11px] text-muted-foreground">—</span>
                          )}
                        </TableCell>

                        {/* Status */}
                        <TableCell>
                          {isResolved ? (
                            <div className="flex items-center gap-1 text-green-600">
                              <CheckCircle2 className="h-4 w-4" />
                              <span className="text-xs">Resolvida</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-yellow-600">
                              <AlertTriangle className="h-4 w-4" />
                              <span className="text-xs">Pendente</span>
                            </div>
                          )}
                          {mr?.chosen_category_slug && (
                            <p className="font-mono text-[10px] text-muted-foreground mt-0.5">
                              {mr.chosen_category_slug}
                            </p>
                          )}
                        </TableCell>

                        {/* Ação */}
                        <TableCell className="text-right">
                          {isResolved ? null : isTm ? (
                            <div className="flex items-center gap-2 justify-end">
                              <Select
                                value={tmChoices[p.id] ?? mr?.chosen_category_slug ?? ""}
                                onValueChange={(v) => setTmChoices((prev) => ({ ...prev, [p.id]: v }))}
                              >
                                <SelectTrigger className="w-[160px] h-8 text-xs">
                                  <SelectValue placeholder="Categoria…" />
                                </SelectTrigger>
                                <SelectContent>
                                  {TM_CHOICES.map((c) => (
                                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Button
                                size="sm"
                                onClick={() => saveTmChoice(p)}
                                disabled={isSaving || !tmChoices[p.id]}
                              >
                                {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Salvar"}
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => markReviewed(p)}
                              disabled={isSaving}
                            >
                              {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Revisado"}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
