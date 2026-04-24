import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { read, utils } from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  FileSpreadsheet, CheckCircle2, AlertTriangle, XCircle,
  Loader2, Send, RotateCcw, FileWarning, Clock,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useParams } from "react-router-dom";
import { useActiveEventId } from "@/contexts/EventContext";
import ImportErrorsTable from "@/components/admin/ImportErrorsTable";
import ModuleHeader from "@/components/admin/ModuleHeader";
import ColumnMappingStep from "@/components/admin/ColumnMappingStep";
import ImportResetCard from "@/components/admin/ImportResetCard";

// ─── Types ───────────────────────────────────────────────────────────

interface ValidateResult {
  status: string;
  operator_id: string;
  event_id: string;
  event_stage_id?: string;
  event_stage?: { id: string; name: string; slug: string };
  event?: { id: string; name: string; year: number };
  file_name?: string | null;
  timestamp: string;
  summary: {
    total_linhas: number;
    ok_para_importar: number;
    pendencias: number;
    erros_bloqueantes: number;
    skipped_rows: number;
    warnings: number;
  };
  counters: {
    novos_cpfs_validos: number;
    cpfs_existentes_reutilizados: number;
    pessoas_sem_cpf: number;
    cpfs_invalidos: number;
    datas_invalidas: number;
    sport_events_nao_encontrados: number;
    institutions_que_seriam_criadas: number;
    delegations_que_seriam_criadas: number;
  };
  errors: Array<{ row: number; field: string; value: unknown; code: string; message: string }>;
  warnings: Array<{ row: number; field: string; value: unknown; code: string; message: string }>;
  pendencias_preview: Array<{
    row_number: number;
    reason_code: string;
    reason_detail: string;
    fingerprint: string;
    normalized_name: string;
    cpf_raw: string | null;
    candidate_person_id: string | null;
  }>;
  institutions_preview: string[];
}

interface CommitResult {
  status: string;
  partial_success?: boolean;
  operator_id: string;
  event_id: string;
  event_stage_id?: string;
  event_stage?: { id: string; name: string; slug: string };
  event?: { id: string; name: string; year: number };
  file_name?: string | null;
  timestamp: string;
  result: {
    people_created: number;
    people_reused: number;
    participants_created: number;
    participants_reused: number;
    participant_event_stages_created?: number;
    participant_event_stages_reused?: number;
    participant_sport_events_created: number;
    participant_sport_events_reused: number;
    institutions_created: number;
    delegations_created: number;
    pendencias_created: number;
    rows_skipped_as_duplicate: number;
    rows_failed: number;
  };
  errors_preview: Array<{ row_number: number; error_code: string; error_message: string }>;
  warnings: ValidateResult["warnings"];
}

// ─── Page ────────────────────────────────────────────────────────────

export default function ImportacaoPage() {
  const { hasRole } = useAuth();
  const { stageId } = useParams<{ stageId: string }>();
  const canWrite = hasRole("admin") || hasRole("secretaria");

  const selectedEventId = useActiveEventId();
  const [selectedStageId, setSelectedStageId] = useState<string>("");

  // Sync with URL stageId if present
  useEffect(() => {
    if (stageId) setSelectedStageId(stageId);
  }, [stageId]);
  const [file, setFile] = useState<File | null>(null);
  const [validating, setValidating] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [validateResult, setValidateResult] = useState<ValidateResult | null>(null);
  const [commitResult, setCommitResult] = useState<CommitResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [rawParsedRows, setRawParsedRows] = useState<Record<string, unknown>[]>([]);
  const [detectedHeaders, setDetectedHeaders] = useState<string[]>([]);
  const [showMapping, setShowMapping] = useState(false);
  const [confirmedMapping, setConfirmedMapping] = useState<Record<string, string> | null>(null);

  const { data: events = [] } = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events").select("*").order("year", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: stages = [] } = useQuery({
    queryKey: ["event_stages", selectedEventId],
    enabled: !!selectedEventId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_stages" as never)
        .select("id, name, slug, kind, sort_order, status")
        .eq("event_id", selectedEventId)
        .eq("status", "active")
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; name: string; slug: string; kind: string; sort_order: number; status: string }>;
    },
  });

  const parseXlsxClientSide = async (f: File): Promise<Record<string, unknown>[]> => {
    const buffer = await f.arrayBuffer();
    const workbook = read(new Uint8Array(buffer), { type: "array" });
    const COLUMN_ALIASES: Record<string, string[]> = {
      "NOME": ["NOME", "NOME COMPLETO", "NOME_COMPLETO", "NOME DO ALUNO", "ALUNO"],
      "ESCOLA": ["ESCOLA", "INSTITUICAO", "INSTITUIÇÃO", "UNIDADE ESCOLAR", "ESCOLA/INSTITUICAO"],
      "MODALIDADE": ["MODALIDADE", "ESPORTE", "SPORT", "MOD"],
      "PROVA": ["PROVA", "EVENTO", "DISCIPLINE", "PROVA/EVENTO"],
      "COMPETICAO": ["COMPETICAO", "COMPETIÇÃO", "COMPETIÇÃO/CATEGORIA", "CATEGORIA", "CATEGORY", "COMP"],
    };
    const REQUIRED_HEADERS = ["NOME", "ESCOLA", "MODALIDADE", "PROVA"];
    const normalize = (s: string) => s.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9 _/-]/g, " ").replace(/\s+/g, " ");
    const hasAlias = (headers: string[], aliases: string[]) =>
      aliases.some((alias) => headers.some((header) => normalize(header) === normalize(alias)));

    let sheetName = workbook.SheetNames[0];
    for (const name of workbook.SheetNames) {
      const sheet = workbook.Sheets[name];
      const sample = utils.sheet_to_json(sheet, { defval: null, range: 0 }) as Record<string, unknown>[];
      if (sample.length > 0) {
        const headers = Object.keys(sample[0]);
        if (REQUIRED_HEADERS.every((header) => hasAlias(headers, COLUMN_ALIASES[header] ?? [header]))) {
          sheetName = name;
          break;
        }
      }
    }
    const sheet = workbook.Sheets[sheetName];
    return utils.sheet_to_json(sheet, { defval: null }) as Record<string, unknown>[];
  };

  const applyMapping = (rows: Record<string, unknown>[], mapping: Record<string, string>): Record<string, unknown>[] => {
    const reverseMap = new Map<string, string>();
    for (const [targetKey, sourceHeader] of Object.entries(mapping)) {
      reverseMap.set(sourceHeader, targetKey);
    }
    return rows.map((row) => {
      const newRow: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(row)) {
        const target = reverseMap.get(key);
        if (target) newRow[target] = value;
        newRow[key] = value;
      }
      return newRow;
    });
  };

  const handleFileSelected = async (f: File) => {
    try {
      const rows = await parseXlsxClientSide(f);
      if (rows.length === 0) { toast.error("Planilha vazia ou sem dados."); return; }
      setRawParsedRows(rows);
      setDetectedHeaders(Object.keys(rows[0]));
      setShowMapping(true);
      setConfirmedMapping(null);
      setValidateResult(null);
      setCommitResult(null);
    } catch (err) {
      toast.error(`Erro ao ler planilha: ${(err as Error).message}`);
    }
  };

  const handleMappingConfirm = (mapping: Record<string, string>) => {
    setConfirmedMapping(mapping);
    setShowMapping(false);
    toast.success("Mapeamento confirmado. Agora clique em Validar.");
  };

  const handleMappingCancel = () => {
    setShowMapping(false); setFile(null); setRawParsedRows([]); setDetectedHeaders([]); setConfirmedMapping(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const callEdgeFunction = async (
    mode: "validate" | "commit",
    options?: { rowsOverride?: any[]; importLogId?: string; chunkIndex?: number; chunkTotal?: number; rowOffset?: number }
  ) => {
    if (!file || !selectedEventId || !selectedStageId || !confirmedMapping) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { toast.error("Sessão expirada. Faça login novamente."); return; }
    const rows = options?.rowsOverride ?? applyMapping(rawParsedRows, confirmedMapping);
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const url = `https://${projectId}.supabase.co/functions/v1/import-inscricoes`;
    const payload: Record<string, unknown> = {
      rows, event_id: selectedEventId, event_stage_id: selectedStageId, mode, file_name: file.name,
    };
    if (options?.importLogId) payload.import_log_id = options.importLogId;
    if (typeof options?.chunkIndex === "number") payload.chunk_index = options.chunkIndex;
    if (typeof options?.chunkTotal === "number") payload.chunk_total = options.chunkTotal;
    if (typeof options?.rowOffset === "number") payload.row_offset = options.rowOffset;

    const tag = `[IMPORT ${mode}${typeof options?.chunkIndex === "number" ? ` lote ${options.chunkIndex + 1}/${options.chunkTotal}` : ""}]`;
    const t0 = performance.now();
    // eslint-disable-next-line no-console
    console.log(`${tag} → POST ${url}`, {
      rows_count: rows.length,
      event_id: selectedEventId,
      event_stage_id: selectedStageId,
      file_name: file.name,
      import_log_id: options?.importLogId,
      row_offset: options?.rowOffset,
    });

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
    } catch (netErr) {
      // eslint-disable-next-line no-console
      console.error(`${tag} ✖ network error`, netErr);
      throw new Error(`Falha de rede ao chamar a edge function: ${(netErr as Error).message}`);
    }

    const elapsedMs = Math.round(performance.now() - t0);
    const requestId = response.headers.get("sb-request-id") ?? response.headers.get("x-request-id");
    const rawText = await response.text();
    let json: any = null;
    try { json = rawText ? JSON.parse(rawText) : null; } catch { /* keep rawText */ }

    if (!response.ok) {
      // eslint-disable-next-line no-console
      console.error(`${tag} ✖ HTTP ${response.status} em ${elapsedMs}ms`, {
        request_id: requestId,
        response: json ?? rawText?.slice(0, 2000),
      });
      const baseMsg = json?.error || json?.message || rawText?.slice(0, 300) || `HTTP ${response.status}`;
      throw new Error(`${baseMsg}${requestId ? ` (request_id: ${requestId})` : ""}`);
    }

    // eslint-disable-next-line no-console
    console.log(`${tag} ✓ HTTP ${response.status} em ${elapsedMs}ms`, {
      request_id: requestId,
      response_keys: json ? Object.keys(json) : [],
      import_log_id: json?.import_log_id,
      async: json?.async,
      rows_failed: json?.result?.rows_failed,
      summary: json?.result ?? json?.summary,
    });
    return json;
  };

  const handleValidate = async () => {
    setValidating(true); setValidateResult(null); setCommitResult(null);
    try {
      const result = await callEdgeFunction("validate");
      setValidateResult(result);
      if (result.summary.erros_bloqueantes > 0) {
        toast.warning(`Validação: ${result.summary.erros_bloqueantes} erro(s) bloqueante(s).`);
      } else if (result.summary.pendencias > 0) {
        toast.info(`Validação: ${result.summary.ok_para_importar} OK, ${result.summary.pendencias} pendência(s).`);
      } else {
        toast.success(`Validação: ${result.summary.ok_para_importar} linha(s) prontas para importar.`);
      }
    } catch (err) {
      toast.error(`Erro na validação: ${(err as Error).message}`);
    } finally {
      setValidating(false);
    }
  };

  const pollImportLog = async (importLogId: string): Promise<CommitResult> => {
    const maxAttempts = 360; // ~12 min (2s interval)
    let attempt = 0;
    while (attempt < maxAttempts) {
      await new Promise((r) => setTimeout(r, 2000));
      attempt++;
      const { data, error } = await supabase
        .from("import_logs")
        .select("id, status, result_summary, error_message, file_name, event_id, event_stage_id")
        .eq("id", importLogId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) continue;

      const summary = (data.result_summary as Record<string, unknown> | null) ?? {};
      const progress = (summary.progress as { processed: number; total: number } | undefined);
      if (progress) {
        const pct = Math.min(100, Math.round((progress.processed / Math.max(1, progress.total)) * 100));
        toast.message(`Importando… ${progress.processed}/${progress.total} (${pct}%)`, { id: "import-progress" });
      }

      if (data.status === "success" || data.status === "partial" || data.status === "error") {
        return {
          status: data.status === "success" ? "committed" : data.status,
          partial_success: data.status === "partial",
          operator_id: "",
          event_id: data.event_id as string,
          event_stage_id: data.event_stage_id as string | undefined,
          file_name: data.file_name as string | null,
          timestamp: new Date().toISOString(),
          result: {
            people_created: Number(summary.people_created ?? 0),
            people_reused: Number(summary.people_reused ?? 0),
            participants_created: Number(summary.participants_created ?? 0),
            participants_reused: Number(summary.participants_reused ?? 0),
            participant_event_stages_created: Number(summary.participant_event_stages_created ?? 0),
            participant_event_stages_reused: Number(summary.participant_event_stages_reused ?? 0),
            participant_sport_events_created: Number(summary.participant_sport_events_created ?? 0),
            participant_sport_events_reused: Number(summary.participant_sport_events_reused ?? 0),
            institutions_created: Number(summary.institutions_created ?? 0),
            delegations_created: Number(summary.delegations_created ?? 0),
            pendencias_created: Number(summary.pendencias_created ?? 0),
            rows_skipped_as_duplicate: Number(summary.rows_skipped_as_duplicate ?? 0),
            rows_failed: Number(summary.rows_failed ?? 0),
          },
          errors_preview: [],
          warnings: [],
        };
      }
    }
    throw new Error("Tempo de processamento excedido. Verifique os logs de importação.");
  };

  const handleCommit = async () => {
    setCommitting(true);
    try {
      const CHUNK_SIZE = 400;
      const allRows = applyMapping(rawParsedRows, confirmedMapping!);
      const totalRows = allRows.length;

      // Small datasets: keep legacy single-call path (background async)
      if (totalRows <= CHUNK_SIZE) {
        const result = await callEdgeFunction("commit");
        let finalResult: CommitResult;
        if (result?.async && result?.import_log_id) {
          toast.info(`Importação iniciada (${result?.planned?.valid_rows ?? 0} linhas). Acompanhando…`, { duration: 4000 });
          finalResult = await pollImportLog(result.import_log_id);
          toast.dismiss("import-progress");
        } else {
          finalResult = result as CommitResult;
        }
        setCommitResult(finalResult);
        const failed = finalResult?.result?.rows_failed ?? 0;
        if (failed > 0) toast.warning(`Importação com ${failed} falha(s).`);
        else toast.success("Importação concluída sem erros.");
        return;
      }

      // Chunked path: client-side chunking, synchronous per-chunk processing
      const chunks: any[][] = [];
      for (let i = 0; i < totalRows; i += CHUNK_SIZE) chunks.push(allRows.slice(i, i + CHUNK_SIZE));
      let importLogId: string | undefined;

      toast.info(`Importação iniciada: ${totalRows} linhas em ${chunks.length} lotes…`, { duration: 4000 });

      for (let idx = 0; idx < chunks.length; idx++) {
        const offset = idx * CHUNK_SIZE;
        const pct = Math.round((offset / totalRows) * 100);
        toast.message(`Importando lote ${idx + 1}/${chunks.length} … ${offset}/${totalRows} (${pct}%)`, { id: "import-progress" });
        const resp = await callEdgeFunction("commit", {
          rowsOverride: chunks[idx],
          importLogId,
          chunkIndex: idx,
          chunkTotal: chunks.length,
          rowOffset: offset,
        });
        if (!importLogId && resp?.import_log_id) importLogId = resp.import_log_id;
      }
      toast.dismiss("import-progress");

      if (importLogId) {
        const { data } = await supabase
          .from("import_logs")
          .select("id, status, result_summary, file_name, event_id, event_stage_id")
          .eq("id", importLogId).maybeSingle();
        const summary = (data?.result_summary as Record<string, unknown> | null) ?? {};
        const finalResult: CommitResult = {
          status: data?.status === "success" ? "committed" : ((data?.status as any) ?? "committed"),
          partial_success: data?.status === "partial",
          operator_id: "",
          event_id: (data?.event_id as string) ?? selectedEventId!,
          event_stage_id: (data?.event_stage_id as string) ?? selectedStageId!,
          file_name: (data?.file_name as string) ?? file?.name ?? null,
          timestamp: new Date().toISOString(),
          result: {
            people_created: Number(summary.people_created ?? 0),
            people_reused: Number(summary.people_reused ?? 0),
            participants_created: Number(summary.participants_created ?? 0),
            participants_reused: Number(summary.participants_reused ?? 0),
            participant_event_stages_created: Number(summary.participant_event_stages_created ?? 0),
            participant_event_stages_reused: Number(summary.participant_event_stages_reused ?? 0),
            participant_sport_events_created: Number(summary.participant_sport_events_created ?? 0),
            participant_sport_events_reused: Number(summary.participant_sport_events_reused ?? 0),
            institutions_created: Number(summary.institutions_created ?? 0),
            delegations_created: Number(summary.delegations_created ?? 0),
            pendencias_created: Number(summary.pendencias_created ?? 0),
            rows_skipped_as_duplicate: Number(summary.rows_skipped_as_duplicate ?? 0),
            rows_failed: Number(summary.rows_failed ?? 0),
          },
          errors_preview: [],
          warnings: [],
        };
        setCommitResult(finalResult);
        const failed = finalResult.result.rows_failed ?? 0;
        if (failed > 0) toast.warning(`Importação concluída com ${failed} falha(s).`);
        else toast.success(`Importação concluída: ${totalRows} linhas processadas.`);
      }
    } catch (err) {
      toast.dismiss("import-progress");
      const msg = (err as Error).message;
      // eslint-disable-next-line no-console
      console.error("[IMPORT commit] ✖ erro fatal", err);
      // tenta buscar contexto extra do import_logs mais recente deste evento/etapa
      try {
        const { data: lastLog } = await supabase
          .from("import_logs")
          .select("id, status, error_message, result_summary, created_at, file_name")
          .eq("event_id", selectedEventId!)
          .eq("event_stage_id", selectedStageId!)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (lastLog) {
          // eslint-disable-next-line no-console
          console.error("[IMPORT commit] último import_log:", lastLog);
        }
      } catch (logErr) {
        // eslint-disable-next-line no-console
        console.warn("[IMPORT commit] não consegui ler import_logs:", logErr);
      }
      toast.error(`Erro na importação: ${msg}`, { duration: 15000, description: "Abra o console (F12) para ver detalhes técnicos." });
    } finally {
      setCommitting(false);
    }
  };

  const handleReset = () => {
    setFile(null); setValidateResult(null); setCommitResult(null);
    setRawParsedRows([]); setDetectedHeaders([]); setShowMapping(false); setConfirmedMapping(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] ?? null;
    setFile(selected); setValidateResult(null); setCommitResult(null); setConfirmedMapping(null);
    if (selected) handleFileSelected(selected);
  };

  const _selectedEvent = events.find((e) => e.id === selectedEventId);
  const _selectedStage = stages.find((s) => s.id === selectedStageId);
  const canValidate = !!file && !!selectedEventId && !!selectedStageId && !!confirmedMapping && !validating && !committing;
  const canCommit = validateResult && validateResult.summary.erros_bloqueantes === 0 && validateResult.summary.ok_para_importar > 0 && !committing && !commitResult;

  if (!canWrite) {
    return (
      <div className="animate-fade-in flex flex-col items-center justify-center py-16">
        <XCircle className="h-10 w-10 text-destructive mb-3" />
        <p className="text-muted-foreground font-medium">Acesso restrito</p>
        <p className="text-sm text-muted-foreground mt-1">Apenas administradores e secretaria podem realizar importações.</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      <ModuleHeader
        route="/admin/importacao"
        actions={
          <Button asChild variant="outline" size="sm">
            <a href="/admin/importacao/modelo">
              <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5" />
              Baixar modelo .xlsx
            </a>
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            1. Selecionar evento e planilha
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Evento</label>
              <Select value={selectedEventId} disabled>
                <SelectTrigger><SelectValue placeholder="Selecione o evento" /></SelectTrigger>
                <SelectContent>
                  {events.map((e) => (<SelectItem key={e.id} value={e.id}>{e.name} ({e.year})</SelectItem>))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Definido pelo seletor global de evento ativo.</p>
            </div>
            {!stageId && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Etapa <span className="text-destructive">*</span>
                </label>
                <Select
                  value={selectedStageId}
                  onValueChange={(v) => { setSelectedStageId(v); setValidateResult(null); setCommitResult(null); }}
                  disabled={!!commitResult || stages.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={stages.length === 0 ? "Nenhuma etapa cadastrada" : "Selecione a etapa"} />
                  </SelectTrigger>
                  <SelectContent>
                    {stages.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} <span className="text-xs text-muted-foreground">({s.kind})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {stages.length === 0 ? (
                  <p className="text-xs text-destructive">
                    Cadastre uma etapa em <a href="/admin/eventos/etapas" className="underline">Eventos → Etapas</a>.
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">Obrigatório. Toda inscrição será vinculada a esta etapa.</p>
                )}
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Planilha (.xlsx)</label>
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleFileChange} disabled={!!commitResult || !selectedStageId}
                className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer disabled:opacity-50" />
              {!selectedStageId && <p className="text-xs text-muted-foreground">Selecione uma etapa primeiro.</p>}
            </div>
          </div>

          {file && confirmedMapping && !showMapping && (
            <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
              <CheckCircle2 className="h-4 w-4" />
              Mapeamento confirmado ({Object.keys(confirmedMapping).length} campos)
              <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => setShowMapping(true)}>Editar</Button>
            </div>
          )}

          {!showMapping && (
            <div className="flex gap-3">
              <Button onClick={handleValidate} disabled={!canValidate} variant="outline">
                {validating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                {validating ? "Validando…" : "Validar"}
              </Button>
              {commitResult && <Button onClick={handleReset} variant="ghost"><RotateCcw className="mr-2 h-4 w-4" /> Nova importação</Button>}
            </div>
          )}
        </CardContent>
      </Card>

      {showMapping && (
        <ColumnMappingStep headers={detectedHeaders} sampleRows={rawParsedRows.slice(0, 5)} onConfirm={handleMappingConfirm} onCancel={handleMappingCancel} />
      )}

      {validateResult && !commitResult && !showMapping && (
        <ValidateResultCard validateResult={validateResult} committing={committing} canCommit={!!canCommit} selectedEvent={_selectedEvent} selectedStage={_selectedStage} onCommit={handleCommit} onReset={handleReset} />
      )}

      {commitResult && selectedEventId && (
        <CommitResultCard commitResult={commitResult} eventId={selectedEventId} selectedStage={_selectedStage} onReset={handleReset} />
      )}

      {hasRole("admin") && (
        <ImportResetCard
          eventId={selectedEventId || null}
          stageId={selectedStageId || null}
          stageName={_selectedStage?.name ?? null}
          onDone={handleReset}
        />
      )}
    </div>
  );
}

// ─── Validate Result Card ────────────────────────────────────────────

function ValidateResultCard({
  validateResult, committing, canCommit, selectedEvent, selectedStage, onCommit, onReset,
}: {
  validateResult: ValidateResult;
  committing: boolean;
  canCommit: boolean;
  selectedEvent: { name: string; year: number } | undefined;
  selectedStage: { name: string; slug: string; kind: string } | undefined;
  onCommit: () => void;
  onReset: () => void;
}) {
  const s = validateResult.summary;
  const c = validateResult.counters;
  const hasPending = s.pendencias > 0;
  const hasErrors = s.erros_bloqueantes > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          {hasErrors ? <XCircle className="h-5 w-5 text-destructive" /> : hasPending ? <Clock className="h-5 w-5 text-yellow-600" /> : <CheckCircle2 className="h-5 w-5 text-green-600" />}
          Resultado da validação {hasPending && !hasErrors && <Badge variant="outline" className="ml-2 text-yellow-600 border-yellow-300">Com pendências</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Evento + Etapa */}
        <div className="rounded-lg border bg-muted/30 p-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
          <div><span className="text-muted-foreground">Etapa:</span> <strong className="text-foreground">{selectedStage?.name ?? "—"}</strong> {selectedStage && <Badge variant="outline" className="ml-1 text-xs">{selectedStage.kind}</Badge>}</div>
          {validateResult.file_name && <div><span className="text-muted-foreground">Arquivo:</span> <strong className="text-foreground">{validateResult.file_name}</strong></div>}
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <SummaryCard label="Total linhas" value={s.total_linhas} />
          <SummaryCard label="OK para importar" value={s.ok_para_importar} variant="success" />
          <SummaryCard label="Pendências" value={s.pendencias} variant={s.pendencias > 0 ? "warning" : "muted"} />
          <SummaryCard label="Erros bloqueantes" value={s.erros_bloqueantes} variant={s.erros_bloqueantes > 0 ? "error" : "muted"} />
          <SummaryCard label="Ignoradas" value={s.skipped_rows} variant="muted" />
        </div>

        {/* CPF & Data Counters */}
        <div>
          <h3 className="text-sm font-medium text-foreground mb-2">Deduplicação e CPF</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <SummaryCard label="CPFs novos válidos" value={c.novos_cpfs_validos} variant="success" />
            <SummaryCard label="CPFs reutilizados" value={c.cpfs_existentes_reutilizados} variant="muted" />
            <SummaryCard label="CPFs inválidos" value={c.cpfs_invalidos} variant={c.cpfs_invalidos > 0 ? "warning" : "muted"} />
            <SummaryCard label="Sem CPF" value={c.pessoas_sem_cpf} variant={c.pessoas_sem_cpf > 0 ? "warning" : "muted"} />
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium text-foreground mb-2">Catálogo e entidades</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <SummaryCard label="Datas inválidas" value={c.datas_invalidas} variant={c.datas_invalidas > 0 ? "warning" : "muted"} />
            <SummaryCard label="Provas não encontradas" value={c.sport_events_nao_encontrados} variant={c.sport_events_nao_encontrados > 0 ? "warning" : "muted"} />
            <SummaryCard label="Instituições a criar" value={c.institutions_que_seriam_criadas} />
            <SummaryCard label="Delegações a criar" value={c.delegations_que_seriam_criadas} />
          </div>
        </div>

        {/* Atalho para resolução manual de TM 2012 */}
        {(validateResult as any).pending_by_code?.TM_2012_MANUAL_CATEGORY_SELECTION > 0 && (
          <div className="rounded-md border border-yellow-300 bg-yellow-50 p-3 text-sm flex items-center justify-between">
            <span>
              <strong>{(validateResult as any).pending_by_code.TM_2012_MANUAL_CATEGORY_SELECTION}</strong> pendência(s) de Tênis de Mesa 2012 requerem escolha manual da categoria.
            </span>
            <a href="/admin/importacao/pendencias" className="underline font-medium">Resolver agora →</a>
          </div>
        )}

        {/* Pendencias preview */}
        {validateResult.pendencias_preview.length > 0 && (
          <Accordion type="single" collapsible>
            <AccordionItem value="pendencias">
              <AccordionTrigger className="text-sm font-medium text-yellow-600">
                <span className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  {s.pendencias} pendência(s) — preview
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="rounded-lg border max-h-64 overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">Linha</TableHead>
                        <TableHead>Código</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>CPF</TableHead>
                        <TableHead>Detalhe</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {validateResult.pendencias_preview.map((p, i) => (
                        <TableRow key={i}>
                          <TableCell>{p.row_number}</TableCell>
                          <TableCell><Badge variant="outline" className="text-xs">{p.reason_code}</Badge></TableCell>
                          <TableCell className="text-sm">{p.normalized_name}</TableCell>
                          <TableCell className="text-xs font-mono text-muted-foreground">{p.cpf_raw || "—"}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{p.reason_detail}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {s.pendencias > validateResult.pendencias_preview.length && (
                  <p className="text-xs text-muted-foreground mt-2">Exibindo {validateResult.pendencias_preview.length} de {s.pendencias} pendências.</p>
                )}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}

        {/* Errors */}
        {validateResult.errors.length > 0 && (
          <Accordion type="single" collapsible>
            <AccordionItem value="errors">
              <AccordionTrigger className="text-sm font-medium text-destructive">
                <span className="flex items-center gap-2"><XCircle className="h-4 w-4" />{validateResult.errors.length} erro(s) bloqueante(s)</span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="rounded-lg border max-h-64 overflow-auto">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead className="w-16">Linha</TableHead><TableHead>Campo</TableHead><TableHead>Código</TableHead><TableHead>Mensagem</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {validateResult.errors.map((e, i) => (
                        <TableRow key={i}>
                          <TableCell>{e.row}</TableCell>
                          <TableCell><Badge variant="outline">{e.field}</Badge></TableCell>
                          <TableCell className="text-xs font-mono">{e.code}</TableCell>
                          <TableCell>{e.message}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}

        {/* Warnings */}
        {validateResult.warnings.length > 0 && (
          <Accordion type="single" collapsible>
            <AccordionItem value="warnings">
              <AccordionTrigger className="text-sm font-medium text-yellow-600">
                <span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" />{s.warnings} aviso(s)</span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="rounded-lg border max-h-64 overflow-auto">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead className="w-16">Linha</TableHead><TableHead>Campo</TableHead><TableHead>Código</TableHead><TableHead>Mensagem</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {validateResult.warnings.map((w, i) => (
                        <TableRow key={i}>
                          <TableCell>{w.row}</TableCell>
                          <TableCell><Badge variant="outline">{w.field}</Badge></TableCell>
                          <TableCell className="text-xs font-mono">{w.code}</TableCell>
                          <TableCell>{w.message}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}

        {/* Info about pendencias */}
        {hasPending && !hasErrors && (
          <div className="flex items-start gap-2 rounded-lg border border-yellow-300 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950/30 p-3">
            <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 shrink-0" />
            <p className="text-sm text-yellow-800 dark:text-yellow-300">
              {s.pendencias} linha(s) serão enviadas para a tabela de pendências. Linhas OK ({s.ok_para_importar}) serão importadas normalmente.
            </p>
          </div>
        )}

        {/* Commit */}
        <div className="flex gap-3 pt-2 border-t">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button disabled={!canCommit} className="bg-green-600 hover:bg-green-700 text-white">
                {committing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                {committing ? "Importando…" : "Confirmar importação"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />Confirmar importação
                </AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="space-y-3">
                    <p>
                      Esta ação vai <strong className="text-foreground">gravar dados permanentemente</strong> no sistema
                      para o evento <strong className="text-foreground">{selectedEvent?.name} ({selectedEvent?.year})</strong>.
                    </p>
                    <Separator />
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="flex justify-between rounded-md bg-muted px-3 py-1.5">
                        <span className="text-muted-foreground">Linhas OK</span>
                        <span className="font-semibold text-foreground">{s.ok_para_importar}</span>
                      </div>
                      <div className="flex justify-between rounded-md bg-muted px-3 py-1.5">
                        <span className="text-muted-foreground">Pendências</span>
                        <span className="font-semibold text-foreground">{s.pendencias}</span>
                      </div>
                      <div className="flex justify-between rounded-md bg-muted px-3 py-1.5">
                        <span className="text-muted-foreground">Pessoas novas</span>
                        <span className="font-semibold text-foreground">{c.novos_cpfs_validos}</span>
                      </div>
                      <div className="flex justify-between rounded-md bg-muted px-3 py-1.5">
                        <span className="text-muted-foreground">Pessoas reutilizadas</span>
                        <span className="font-semibold text-foreground">{c.cpfs_existentes_reutilizados}</span>
                      </div>
                    </div>
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={onCommit} className="bg-green-600 hover:bg-green-700 text-white">
                  <Send className="mr-2 h-4 w-4" /> Sim, importar agora
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button onClick={onReset} variant="ghost"><RotateCcw className="mr-2 h-4 w-4" /> Cancelar</Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Commit Result Card ──────────────────────────────────────────────

function CommitResultCard({
  commitResult, eventId, selectedStage, onReset,
}: {
  commitResult: CommitResult;
  eventId: string;
  selectedStage: { name: string; slug: string; kind: string } | undefined;
  onReset: () => void;
}) {
  const r = commitResult.result;
  const isPartial = r.rows_failed > 0;
  const errorsPreview = commitResult.errors_preview ?? [];

  return (
    <Card className={isPartial
      ? "border-yellow-200 bg-yellow-50/50 dark:border-yellow-900 dark:bg-yellow-950/20"
      : "border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20"
    }>
      <CardHeader>
        <CardTitle className={`text-base flex items-center gap-2 ${isPartial ? "text-yellow-700 dark:text-yellow-400" : "text-green-700 dark:text-green-400"}`}>
          {isPartial ? <FileWarning className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
          {isPartial ? "Importação parcial" : "Importação concluída"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Evento + Etapa */}
        <div className="rounded-lg border bg-background/60 p-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
          <div><span className="text-muted-foreground">Etapa:</span> <strong className="text-foreground">{commitResult.event_stage?.name ?? selectedStage?.name ?? "—"}</strong> {(commitResult.event_stage || selectedStage) && <Badge variant="outline" className="ml-1 text-xs">{selectedStage?.kind ?? ""}</Badge>}</div>
          {commitResult.file_name && <div><span className="text-muted-foreground">Arquivo:</span> <strong className="text-foreground">{commitResult.file_name}</strong></div>}
        </div>
        <div>
          <h3 className="text-sm font-medium text-foreground mb-2">Criados</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <SummaryCard label="Pessoas" value={r.people_created} variant="success" />
            <SummaryCard label="Participantes" value={r.participants_created} variant="success" />
            <SummaryCard label="Entradas em provas" value={r.participant_sport_events_created} variant="success" />
            <SummaryCard label="Instituições" value={r.institutions_created} variant="success" />
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium text-foreground mb-2">Reutilizados</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <SummaryCard label="Pessoas" value={r.people_reused} variant="muted" />
            <SummaryCard label="Participantes" value={r.participants_reused} variant="muted" />
            <SummaryCard label="Entradas duplicadas" value={r.participant_sport_events_reused} variant="muted" />
            <SummaryCard label="Delegações" value={r.delegations_created} variant="success" />
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium text-foreground mb-2">Pendências e erros</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <SummaryCard label="Pendências criadas" value={r.pendencias_created} variant={r.pendencias_created > 0 ? "warning" : "muted"} />
            <SummaryCard label="Duplicadas ignoradas" value={r.rows_skipped_as_duplicate} variant="muted" />
            <SummaryCard label="Falhas" value={r.rows_failed} variant={r.rows_failed > 0 ? "error" : "muted"} />
          </div>
        </div>

        {r.pendencias_created > 0 && (
          <div className="flex items-start gap-2 rounded-lg border border-yellow-300 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950/30 p-3">
            <Clock className="h-4 w-4 text-yellow-600 mt-0.5 shrink-0" />
            <p className="text-sm text-yellow-800 dark:text-yellow-300">
              {r.pendencias_created} linha(s) foram enviadas para a tabela de pendências. Resolva-as manualmente e reimporte se necessário.
            </p>
          </div>
        )}

        {isPartial && errorsPreview.length > 0 && (
          <Accordion type="single" collapsible defaultValue="errors-preview">
            <AccordionItem value="errors-preview">
              <AccordionTrigger className="text-sm font-medium text-destructive">
                <span className="flex items-center gap-2"><XCircle className="h-4 w-4" />{errorsPreview.length} erro(s)</span>
              </AccordionTrigger>
              <AccordionContent>
                <ImportErrorsTable eventId={eventId} mode="preview" previewErrors={errorsPreview} />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}

        {isPartial && (
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm"><FileWarning className="mr-2 h-4 w-4" />Ver log completo</Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Erros de importação — Log completo</DialogTitle></DialogHeader>
              <ImportErrorsTable eventId={eventId} mode="full" />
            </DialogContent>
          </Dialog>
        )}

        <div className="pt-2">
          <Button onClick={onReset} variant="outline"><RotateCcw className="mr-2 h-4 w-4" /> Nova importação</Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Summary Card ────────────────────────────────────────────────────

function SummaryCard({ label, value, variant = "default" }: { label: string; value: number; variant?: "default" | "success" | "warning" | "error" | "muted" }) {
  const colors = {
    default: "text-foreground",
    success: "text-green-600 dark:text-green-400",
    warning: "text-yellow-600 dark:text-yellow-400",
    error: "text-destructive",
    muted: "text-muted-foreground",
  };
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-xl font-bold ${colors[variant]}`}>{value}</p>
    </div>
  );
}
