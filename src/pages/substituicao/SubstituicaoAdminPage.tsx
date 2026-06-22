import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useActiveEventId } from "@/contexts/EventContext";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Check,
  X,
  Search,
  Eye,
  FileText,
  Download,
  PlayCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const STATUS_LABEL: Record<
  string,
  { label: string; tone: "default" | "secondary" | "destructive" | "outline" }
> = {
  requested: { label: "Solicitada", tone: "outline" },
  approved: { label: "Aprovada", tone: "default" },
  rejected: { label: "Rejeitada", tone: "destructive" },
  executed: { label: "Executada", tone: "secondary" },
  cancelled: { label: "Cancelada", tone: "destructive" },
};

const REASON_LABEL: Record<string, string> = {
  lesao: "Lesão",
  desistencia: "Desistência",
  disciplinar: "Disciplinar",
  convocacao: "Convocação externa",
  outro: "Outro",
};

const DOC_LABEL: Record<string, string> = {
  foto_atleta: "Foto do atleta entrante",
  rg_atleta: "RG do atleta",
  termo_inscricao: "Termo de inscrição",
  termo_aptidao: "Termo de aptidão",
  oficio_substituicao: "Ofício de substituição",
};

export default function SubstituicoesPage() {
  const qc = useQueryClient();
  const { hasRole, user } = useAuth();
  const eventId = useActiveEventId();

  const canDecide =
    hasRole("admin") ||
    hasRole("secretaria") ||
    hasRole("coordenacao_tecnica");

  const [statusFilter, setStatusFilter] = useState("all");
  const [municipioFilter, setMunicipioFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<any | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<any | null>(null);

  const [pendingDecision, setPendingDecision] = useState<{
    id: string;
    action: "reject" | "cancel";
  } | null>(null);

  const [rejectionNotes, setRejectionNotes] = useState("");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["substitutions-admin", eventId, statusFilter],
    enabled: !!eventId,
    queryFn: async () => {
      let q = (supabase as any)
        .from("substitutions")
        .select("*")
        .eq("event_id", eventId)
        .order("requested_at", { ascending: false });

      if (statusFilter !== "all") {
        q = q.eq("status", statusFilter);
      }

      const { data, error } = await q;

      if (error) throw error;

      const substitutions = data ?? [];
      const ids = substitutions.map((s: any) => s.id);

      if (ids.length === 0) return [];

      const { data: docs, error: docsError } = await (supabase as any)
        .from("substitution_documents")
        .select("*")
        .in("substitution_id", ids)
        .order("created_at", { ascending: true });

      if (docsError) {
        console.error("Erro ao buscar documentos:", docsError);
      }

      const docsMap = new Map<string, any[]>();

      (docs ?? []).forEach((doc: any) => {
        if (!docsMap.has(doc.substitution_id)) {
          docsMap.set(doc.substitution_id, []);
        }

        docsMap.get(doc.substitution_id)?.push(doc);
      });

      return substitutions.map((item: any) => ({
        ...item,
        substitution_documents: docsMap.get(item.id) ?? [],
      }));
    },
  });

  const municipios = useMemo(() => {
    const set = new Set<string>();

    rows.forEach((r) => {
      if (r.municipio_text) set.add(r.municipio_text);
    });

    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();

    return rows.filter((r) => {
      if (municipioFilter !== "all" && r.municipio_text !== municipioFilter) {
        return false;
      }

      if (!term) return true;

      const searchable = [
        r.protocol_number,
        r.municipio_text,
        r.school_name_text,
        r.modality_type_text,
        r.modality_name_text,
        r.proof_name_text,
        r.category_text,
        r.gender_text,
        r.athlete_out_name_text,
        r.athlete_in_name_text,
        r.requester_name,
        r.requester_phone,
        r.contact_email,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(term);
    });
  }, [rows, search, municipioFilter]);

  const approveMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("substitutions")
        .update({
          status: "approved",
          approved_by: user?.id,
          approved_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("status", "requested");

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Substituição aprovada");
      qc.invalidateQueries({ queryKey: ["substitutions-admin"] });
    },
    onError: (e: Error) => toast.error(`Erro: ${e.message}`),
  });

  const rejectMut = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      const { error } = await (supabase as any)
        .from("substitutions")
        .update({
          status: "rejected",
          rejected_by: user?.id,
          rejected_at: new Date().toISOString(),
          rejection_notes: notes || null,
        })
        .eq("id", id)
        .eq("status", "requested");

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Substituição rejeitada");
      qc.invalidateQueries({ queryKey: ["substitutions-admin"] });
    },
    onError: (e: Error) => toast.error(`Erro: ${e.message}`),
  });

  const cancelMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("substitutions")
        .update({
          status: "cancelled",
          rejected_by: user?.id,
          rejected_at: new Date().toISOString(),
        })
        .eq("id", id)
        .in("status", ["requested", "approved"]);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Substituição cancelada");
      qc.invalidateQueries({ queryKey: ["substitutions-admin"] });
    },
    onError: (e: Error) => toast.error(`Erro: ${e.message}`),
  });

  const executeMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("substitutions")
        .update({
          status: "executed",
        })
        .eq("id", id)
        .eq("status", "approved");

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Substituição marcada como executada");
      qc.invalidateQueries({ queryKey: ["substitutions-admin"] });
    },
    onError: (e: Error) => toast.error(`Erro ao executar: ${e.message}`),
  });

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-foreground">
          Gestão de Substituições
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Visualize, confira documentos, aprove ou rejeite solicitações públicas.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium uppercase text-muted-foreground">
                Município
              </label>

              <Select value={municipioFilter} onValueChange={setMunicipioFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {municipios.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium uppercase text-muted-foreground">
                Status
              </label>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {Object.entries(STATUS_LABEL).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-2 space-y-1">
              <label className="text-xs font-medium uppercase text-muted-foreground">
                Busca
              </label>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />

                <Input
                  placeholder="Protocolo, escola, atleta, modalidade, município..."
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Protocolo</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Município</TableHead>
                <TableHead>Escola</TableHead>
                <TableHead>Modalidade</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Sai</TableHead>
                <TableHead>Entra</TableHead>
                <TableHead>Docs</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={11}>
                      <Skeleton className="h-10 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={11}
                    className="text-center py-12 text-muted-foreground"
                  >
                    Nenhuma substituição encontrada.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((r) => {
                  const status = STATUS_LABEL[r.status] ?? {
                    label: r.status,
                    tone: "outline" as const,
                  };

                  const docsCount = r.substitution_documents?.length ?? 0;

                  return (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs font-medium whitespace-nowrap">
                        {r.protocol_number ?? "—"}
                      </TableCell>

                      <TableCell className="text-xs whitespace-nowrap">
                        {r.requested_at
                          ? format(new Date(r.requested_at), "dd/MM/yyyy HH:mm")
                          : "—"}
                      </TableCell>

                      <TableCell className="text-xs">
                        {r.municipio_text ?? "—"}
                      </TableCell>

                      <TableCell className="text-xs">
                        {r.school_name_text ?? "—"}
                      </TableCell>

                      <TableCell className="text-xs">
                        <div className="font-medium">
                          {r.modality_name_text ?? "—"}
                        </div>

                        <div className="text-[10px] text-muted-foreground">
                          {r.modality_type_text ?? "—"}
                        </div>

                        {r.proof_name_text && (
                          <div className="text-[10px] text-amber-600">
                            {r.proof_name_text}
                          </div>
                        )}
                      </TableCell>

                      <TableCell className="text-xs">
                        <div>{r.category_text ?? "—"}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {r.gender_text ?? "—"}
                        </div>
                      </TableCell>

                      <TableCell className="text-xs font-medium text-amber-700 dark:text-amber-300">
                        {r.athlete_out_name_text ?? "—"}
                      </TableCell>

                      <TableCell className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                        {r.athlete_in_name_text ?? "—"}
                      </TableCell>

                      <TableCell>
                        <Badge variant={docsCount > 0 ? "default" : "outline"}>
                          {docsCount}
                        </Badge>
                      </TableCell>

                      <TableCell>
                        <Badge variant={status.tone}>{status.label}</Badge>
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1 flex-wrap">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs"
                            onClick={() => setSelected(r)}
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            Ver
                          </Button>

                          {r.status === "requested" && canDecide && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-xs"
                                onClick={() => approveMut.mutate(r.id)}
                                disabled={approveMut.isPending}
                              >
                                <Check className="h-3 w-3 mr-1" />
                                Aprovar
                              </Button>

                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-xs text-destructive border-destructive/40"
                                onClick={() => {
                                  setRejectionNotes("");
                                  setPendingDecision({
                                    id: r.id,
                                    action: "reject",
                                  });
                                }}
                              >
                                <X className="h-3 w-3 mr-1" />
                                Rejeitar
                              </Button>
                            </>
                          )}

                          {r.status === "approved" && canDecide && (
                            <Button
                              size="sm"
                              variant="default"
                              className="h-7 px-2 text-xs"
                              onClick={() => executeMut.mutate(r.id)}
                              disabled={executeMut.isPending}
                            >
                              <PlayCircle className="h-3 w-3 mr-1" />
                              Executar
                            </Button>
                          )}

                          {(r.status === "requested" ||
                            r.status === "approved") &&
                            canDecide && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs text-muted-foreground"
                                onClick={() =>
                                  setPendingDecision({
                                    id: r.id,
                                    action: "cancel",
                                  })
                                }
                              >
                                Cancelar
                              </Button>
                            )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog
        open={!!selected}
        onOpenChange={(open) => !open && setSelected(null)}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Solicitação {selected?.protocol_number ?? ""}
            </DialogTitle>
          </DialogHeader>

          {selected && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">Município</p>
                  <p className="font-medium">{selected.municipio_text ?? "—"}</p>
                </div>

                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">Escola</p>
                  <p className="font-medium">{selected.school_name_text ?? "—"}</p>
                </div>

                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">Responsável</p>
                  <p className="font-medium">{selected.requester_name ?? "—"}</p>
                </div>

                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">Contato</p>
                  <p className="font-medium">{selected.requester_phone ?? "—"}</p>
                  <p className="text-xs">{selected.contact_email ?? "—"}</p>
                </div>

                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">Modalidade</p>
                  <p className="font-medium">{selected.modality_name_text ?? "—"}</p>
                  <p className="text-xs">{selected.modality_type_text ?? "—"}</p>

                  {selected.proof_name_text && (
                    <p className="text-xs text-amber-600">
                      Prova: {selected.proof_name_text}
                    </p>
                  )}
                </div>

                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">Categoria / Naipe</p>
                  <p className="font-medium">
                    {selected.category_text ?? "—"} · {selected.gender_text ?? "—"}
                  </p>
                </div>

                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">Atleta que sai</p>
                  <p className="font-medium text-amber-700 dark:text-amber-300">
                    {selected.athlete_out_name_text ?? "—"}
                  </p>
                </div>

                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">Atleta que entra</p>
                  <p className="font-medium text-emerald-700 dark:text-emerald-300">
                    {selected.athlete_in_name_text ?? "—"}
                  </p>
                </div>
              </div>

              <div className="rounded-md border p-3 text-sm">
                <p className="text-xs text-muted-foreground">Motivo</p>
                <p className="font-medium">
                  {selected.reason_code
                    ? REASON_LABEL[selected.reason_code] ?? selected.reason_code
                    : "—"}
                </p>

                {selected.reason && (
                  <p className="text-sm text-muted-foreground mt-2">
                    {selected.reason}
                  </p>
                )}
              </div>

              <div className="rounded-md border p-3">
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="h-4 w-4" />
                  <p className="font-medium text-sm">Documentos anexados</p>
                </div>

                {selected.substitution_documents?.length > 0 ? (
                  <div className="space-y-2">
                    {selected.substitution_documents.map((doc: any) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2 text-sm"
                      >
                        <div>
                          <p className="font-medium">
                            {DOC_LABEL[doc.document_type] ?? doc.document_type}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {doc.status ?? "pending"}
                          </p>
                        </div>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedDoc(doc)}
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          Ver
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Nenhum documento encontrado.
                  </p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!selectedDoc}
        onOpenChange={(open) => !open && setSelectedDoc(null)}
      >
        <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedDoc
                ? DOC_LABEL[selectedDoc.document_type] ??
                  selectedDoc.document_type
                : "Documento"}
            </DialogTitle>
          </DialogHeader>

          {selectedDoc?.file_url ? (
            (() => {
              const fileUrl = selectedDoc.file_url;
              const fileName = fileUrl.split("/").pop() || "documento";
              const isImage = /\.(png|jpg|jpeg|webp)$/i.test(fileUrl);
              const isPdf = /\.pdf$/i.test(fileUrl);

              return (
                <div className="space-y-4">
                  <div className="rounded-lg border bg-muted/20 p-2">
                    {isImage ? (
                      <img
                        src={fileUrl}
                        alt="Documento anexado"
                        className="max-h-[70vh] w-full object-contain rounded-md bg-white"
                      />
                    ) : isPdf ? (
                      <iframe
                        src={fileUrl}
                        className="w-full h-[75vh] rounded-md border bg-white"
                        title="Documento PDF"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center py-16 text-center">
                        <FileText className="h-16 w-16 text-muted-foreground mb-4" />
                        <p className="font-medium">Pré-visualização indisponível</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Esse tipo de arquivo não pode ser visualizado aqui.
                        </p>
                      </div>
                    )}
                  </div>

                  <Button variant="outline" className="w-full" asChild>
                    <a href={fileUrl} download={fileName}>
                      <Download className="h-4 w-4 mr-2" />
                      Baixar documento
                    </a>
                  </Button>
                </div>
              );
            })()
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <FileText className="h-12 w-12 text-muted-foreground mb-3" />
              <p className="font-medium">Documento sem arquivo disponível</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!pendingDecision}
        onOpenChange={(open) => {
          if (!open) setPendingDecision(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingDecision?.action === "reject" && "Rejeitar substituição"}
              {pendingDecision?.action === "cancel" && "Cancelar substituição"}
            </AlertDialogTitle>

            <AlertDialogDescription>
              {pendingDecision?.action === "reject" &&
                "A substituição será marcada como rejeitada. Você pode adicionar uma observação."}
              {pendingDecision?.action === "cancel" &&
                "A substituição será marcada como cancelada."}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {pendingDecision?.action === "reject" && (
            <div className="space-y-1 py-2">
              <label className="text-xs font-medium">Observação opcional</label>

              <Input
                value={rejectionNotes}
                onChange={(e) => setRejectionNotes(e.target.value)}
                placeholder="Ex.: documentação incompleta"
              />
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>

            <AlertDialogAction
              onClick={() => {
                if (!pendingDecision) return;

                if (pendingDecision.action === "reject") {
                  rejectMut.mutate({
                    id: pendingDecision.id,
                    notes: rejectionNotes,
                  });
                }

                if (pendingDecision.action === "cancel") {
                  cancelMut.mutate(pendingDecision.id);
                }

                setPendingDecision(null);
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
