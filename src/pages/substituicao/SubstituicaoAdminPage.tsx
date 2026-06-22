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

      if (ids.length === 0) {
        return [];
      }

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
      if (r.municipio_text) {
        set.add(r.municipio_text);
      }
    });

    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();

    return rows.filter((r) => {
      if (
        municipioFilter !== "all" &&
        r.municipio_text !== municipioFilter
      ) {
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

      qc.invalidateQueries({
        queryKey: ["substitutions-admin"],
      });
    },

    onError: (e: Error) => {
      toast.error(`Erro: ${e.message}`);
    },
  });

  const rejectMut = useMutation({
    mutationFn: async ({
      id,
      notes,
    }: {
      id: string;
      notes: string;
    }) => {
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

      qc.invalidateQueries({
        queryKey: ["substitutions-admin"],
      });
    },

    onError: (e: Error) => {
      toast.error(`Erro: ${e.message}`);
    },
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

      qc.invalidateQueries({
        queryKey: ["substitutions-admin"],
      });
    },

    onError: (e: Error) => {
      toast.error(`Erro: ${e.message}`);
    },
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

      qc.invalidateQueries({
        queryKey: ["substitutions-admin"],
      });
    },

    onError: (e: Error) => {
      toast.error(`Erro ao executar: ${e.message}`);
    },
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

              <Select
                value={municipioFilter}
                onValueChange={setMunicipioFilter}
              >
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
                  placeholder="Protocolo, escola, atleta..."
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* resto da tabela continua igual */}

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

              const fileName =
                fileUrl.split("/").pop() || "documento";

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

                        <p className="font-medium">
                          Pré-visualização indisponível
                        </p>

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

              <p className="font-medium">
                Documento sem arquivo disponível
              </p>
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
              {pendingDecision?.action === "reject" &&
                "Rejeitar substituição"}

              {pendingDecision?.action === "cancel" &&
                "Cancelar substituição"}
            </AlertDialogTitle>

            <AlertDialogDescription>
              {pendingDecision?.action === "reject" &&
                "A substituição será marcada como rejeitada."}

              {pendingDecision?.action === "cancel" &&
                "A substituição será marcada como cancelada."}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>
              Voltar
            </AlertDialogCancel>

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
