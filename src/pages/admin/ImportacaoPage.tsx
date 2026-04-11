import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  Send,
  RotateCcw,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { useActiveEventId } from "@/contexts/EventContext";

interface ValidateResult {
  status: string;
  operator_id: string;
  event_id: string;
  timestamp: string;
  summary: {
    total_rows: number;
    skipped_rows: number;
    valid: number;
    warnings: number;
    errors: number;
  };
  preview: {
    people_to_create: number;
    people_to_reuse: number;
    participants_to_create: number;
    sport_events_to_create: number;
    enrollments_to_create: number;
    staff_to_create?: number;
    institutions_created?: number;
    sports_created?: number;
    categories_created?: number;
  };
  errors: Array<{ row: number; field: string; value: unknown; code: string; message: string }>;
  warnings: Array<{ row: number; field: string; value: unknown; code: string; message: string }>;
}

interface CommitResult {
  status: string;
  operator_id: string;
  event_id: string;
  timestamp: string;
  result: {
    created: { people: number; participants: number; sport_events: number; participant_sport_events: number };
    skipped: { people_existing: number; participants_existing: number; sport_events_existing: number; duplicate_enrollments: number };
  };
  warnings: ValidateResult["warnings"];
}

export default function ImportacaoPage() {
  const { hasRole } = useAuth();
  const canWrite = hasRole("admin") || hasRole("secretaria");

  const selectedEventId = useActiveEventId();
  const [file, setFile] = useState<File | null>(null);
  const [validating, setValidating] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [validateResult, setValidateResult] = useState<ValidateResult | null>(null);
  const [commitResult, setCommitResult] = useState<CommitResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: events = [] } = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .order("year", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const callEdgeFunction = async (mode: "validate" | "commit") => {
    if (!file || !selectedEventId) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error("Sessão expirada. Faça login novamente.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("event_id", selectedEventId);
    formData.append("mode", mode);

    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const url = `https://${projectId}.supabase.co/functions/v1/import-inscricoes`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: formData,
    });

    const json = await response.json();

    if (!response.ok) {
      throw new Error(json.error || json.message || "Erro desconhecido");
    }

    return json;
  };

  const handleValidate = async () => {
    setValidating(true);
    setValidateResult(null);
    setCommitResult(null);
    try {
      const result = await callEdgeFunction("validate");
      setValidateResult(result);
      if (result.summary.errors > 0) {
        toast.warning(`Validação concluída com ${result.summary.errors} erro(s).`);
      } else {
        toast.success(`Validação concluída: ${result.summary.valid} linha(s) válida(s).`);
      }
    } catch (err) {
      toast.error(`Erro na validação: ${(err as Error).message}`);
    } finally {
      setValidating(false);
    }
  };

  const handleCommit = async () => {
    setCommitting(true);
    try {
      const result = await callEdgeFunction("commit");
      setCommitResult(result);
      toast.success("Importação realizada com sucesso!");
    } catch (err) {
      toast.error(`Erro na importação: ${(err as Error).message}`);
    } finally {
      setCommitting(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setValidateResult(null);
    setCommitResult(null);
    // event is managed globally via EventContext
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] ?? null;
    setFile(selected);
    setValidateResult(null);
    setCommitResult(null);
  };

  const _selectedEvent = events.find((e) => e.id === selectedEventId);
  const canValidate = !!file && !!selectedEventId && !validating && !committing;
  const canCommit =
    validateResult &&
    validateResult.summary.errors === 0 &&
    validateResult.summary.valid > 0 &&
    !committing &&
    !commitResult;

  if (!canWrite) {
    return (
      <div className="animate-fade-in flex flex-col items-center justify-center py-16">
        <XCircle className="h-10 w-10 text-destructive mb-3" />
        <p className="text-muted-foreground font-medium">Acesso restrito</p>
        <p className="text-sm text-muted-foreground mt-1">
          Apenas administradores e secretaria podem importar inscrições.
        </p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-foreground">
          Importar Inscrições
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Importe atletas e inscrições a partir de uma planilha XLSX
        </p>
      </div>

      {/* Step 1: Event + File */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Selecionar evento e planilha
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Evento</label>
              <Select
                value={selectedEventId}
                onValueChange={(v) => {
                  ;
                  setValidateResult(null);
                  setCommitResult(null);
                }}
                disabled={!!commitResult}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o evento" />
                </SelectTrigger>
                <SelectContent>
                  {events.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name} ({e.year})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Planilha (.xlsx)
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                disabled={!!commitResult}
                className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              onClick={handleValidate}
              disabled={!canValidate}
              variant="outline"
            >
              {validating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              )}
              {validating ? "Validando…" : "Validar"}
            </Button>

            {commitResult && (
              <Button onClick={handleReset} variant="ghost">
                <RotateCcw className="mr-2 h-4 w-4" />
                Nova importação
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Validate result */}
      {validateResult && !commitResult && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              {validateResult.summary.errors > 0 ? (
                <XCircle className="h-5 w-5 text-destructive" />
              ) : (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              )}
              Resultado da validação
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <SummaryCard label="Total linhas" value={validateResult.summary.total_rows} />
              <SummaryCard label="Ignoradas" value={validateResult.summary.skipped_rows} variant="muted" />
              <SummaryCard label="Válidas" value={validateResult.summary.valid} variant="success" />
              <SummaryCard label="Avisos" value={validateResult.summary.warnings} variant="warning" />
              <SummaryCard label="Erros" value={validateResult.summary.errors} variant="error" />
            </div>

            {/* Preview */}
            <div>
              <h3 className="text-sm font-medium text-foreground mb-2">
                Entidades auto-criadas
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <SummaryCard label="Instituições" value={validateResult.preview.institutions_created ?? 0} variant="success" />
                <SummaryCard label="Modalidades" value={validateResult.preview.sports_created ?? 0} variant="success" />
                <SummaryCard label="Categorias" value={validateResult.preview.categories_created ?? 0} variant="success" />
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-foreground mb-2">
                Preview de criação
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                <SummaryCard label="Pessoas (criar)" value={validateResult.preview.people_to_create} />
                <SummaryCard label="Pessoas (reusar)" value={validateResult.preview.people_to_reuse} variant="muted" />
                <SummaryCard label="Participantes" value={validateResult.preview.participants_to_create} />
                <SummaryCard label="Provas" value={validateResult.preview.sport_events_to_create} />
                <SummaryCard label="Inscrições" value={validateResult.preview.enrollments_to_create} />
                <SummaryCard label="Comissão/Staff" value={validateResult.preview.staff_to_create ?? 0} variant="muted" />
              </div>
            </div>

            {/* Errors */}
            {validateResult.errors.length > 0 && (
              <Accordion type="single" collapsible>
                <AccordionItem value="errors">
                  <AccordionTrigger className="text-sm font-medium text-destructive">
                    <span className="flex items-center gap-2">
                      <XCircle className="h-4 w-4" />
                      {validateResult.errors.length} erro(s) encontrado(s)
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="rounded-lg border max-h-64 overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-16">Linha</TableHead>
                            <TableHead>Campo</TableHead>
                            <TableHead>Código</TableHead>
                            <TableHead>Mensagem</TableHead>
                          </TableRow>
                        </TableHeader>
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
                    <span className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      {validateResult.warnings.length} aviso(s)
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="rounded-lg border max-h-64 overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-16">Linha</TableHead>
                            <TableHead>Campo</TableHead>
                            <TableHead>Código</TableHead>
                            <TableHead>Mensagem</TableHead>
                          </TableRow>
                        </TableHeader>
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

            {/* Commit button */}
            <div className="flex gap-3 pt-2 border-t">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    disabled={!canCommit}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    {committing ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="mr-2 h-4 w-4" />
                    )}
                    {committing ? "Importando…" : "Confirmar importação"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-yellow-600" />
                      Confirmar importação
                    </AlertDialogTitle>
                    <AlertDialogDescription asChild>
                      <div className="space-y-3">
                        <p>
                          Esta ação vai <strong className="text-foreground">gravar dados permanentemente</strong> no sistema
                          para o evento <strong className="text-foreground">{_selectedEvent?.name} ({_selectedEvent?.year})</strong>.
                        </p>
                        <p>
                          Certifique-se de ter revisado todos os erros e avisos antes de prosseguir.
                        </p>
                        <Separator />
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="flex justify-between rounded-md bg-muted px-3 py-1.5">
                            <span className="text-muted-foreground">Linhas válidas</span>
                            <span className="font-semibold text-foreground">{validateResult.summary.valid}</span>
                          </div>
                          <div className="flex justify-between rounded-md bg-muted px-3 py-1.5">
                            <span className="text-muted-foreground">Avisos</span>
                            <span className="font-semibold text-foreground">{validateResult.summary.warnings}</span>
                          </div>
                          <div className="flex justify-between rounded-md bg-muted px-3 py-1.5">
                            <span className="text-muted-foreground">Pessoas a criar</span>
                            <span className="font-semibold text-foreground">{validateResult.preview.people_to_create}</span>
                          </div>
                          <div className="flex justify-between rounded-md bg-muted px-3 py-1.5">
                            <span className="text-muted-foreground">Participantes</span>
                            <span className="font-semibold text-foreground">{validateResult.preview.participants_to_create}</span>
                          </div>
                          <div className="flex justify-between rounded-md bg-muted px-3 py-1.5 col-span-2">
                            <span className="text-muted-foreground">Inscrições esportivas</span>
                            <span className="font-semibold text-foreground">{validateResult.preview.enrollments_to_create}</span>
                          </div>
                        </div>
                      </div>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleCommit}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      <Send className="mr-2 h-4 w-4" />
                      Sim, importar agora
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <Button onClick={handleReset} variant="ghost">
                <RotateCcw className="mr-2 h-4 w-4" />
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Commit result */}
      {commitResult && (
        <Card className="border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-green-700 dark:text-green-400">
              <CheckCircle2 className="h-5 w-5" />
              Importação concluída
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <SummaryCard label="Pessoas criadas" value={commitResult.result.created.people} variant="success" />
              <SummaryCard label="Participantes criados" value={commitResult.result.created.participants} variant="success" />
              <SummaryCard label="Provas criadas" value={commitResult.result.created.sport_events} variant="success" />
              <SummaryCard label="Inscrições criadas" value={commitResult.result.created.participant_sport_events} variant="success" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <SummaryCard label="Pessoas existentes" value={commitResult.result.skipped.people_existing} variant="muted" />
              <SummaryCard label="Participantes existentes" value={commitResult.result.skipped.participants_existing} variant="muted" />
              <SummaryCard label="Provas existentes" value={commitResult.result.skipped.sport_events_existing} variant="muted" />
              <SummaryCard label="Inscrições duplicadas" value={commitResult.result.skipped.duplicate_enrollments} variant="muted" />
            </div>
            <div className="pt-2">
              <Button onClick={handleReset} variant="outline">
                <RotateCcw className="mr-2 h-4 w-4" />
                Nova importação
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  variant = "default",
}: {
  label: string;
  value: number;
  variant?: "default" | "success" | "warning" | "error" | "muted";
}) {
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
