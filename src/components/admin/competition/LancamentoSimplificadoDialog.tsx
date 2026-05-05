import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Loader2, FileText, Camera, Trash2, Users, AlertTriangle, Info, Upload } from "lucide-react";
import { format, parseISO } from "date-fns";

// ============================================================
// Lançamento Simplificado de Resultado + Evidências
// ============================================================
// Componente prático para o operador de campo (árbitro / mesário /
// secretaria) lançar:
//   • Score / outcome (placar A x B coletivo, ou texto livre)
//   • Súmula (PDF) → bucket `evidencias-partida`
//   • Fotos (até 10) → bucket `evidencias-partida`
//   • Lista de árbitros responsáveis (com toggle Presente/Ausente)
//   • Relatório livre (textarea)
//
// Onde grava:
//   • match_user_assignments.acceptance_status (Presente/Ausente)
//   • match_evidences (sumula/foto/relatorio)
//   • Score: tenta rpc_launch_match_result (fluxo formal); se falhar,
//     grava só como evidência tipo 'relatorio' com o placar embutido.
//
// **Não substitui** o fluxo formal de homologação (rpc_homologate +
// rpc_publish). Documenta isso no banner do dialog.
// ============================================================

const MAX_PHOTOS = 10;
const MAX_PHOTO_MB = 2;
const MAX_PDF_MB = 5;

interface MatchAssignment {
  id: string;
  user_id: string;
  role: string;
  acceptance_status: string | null;
  full_name: string | null;
}

interface PendingPhoto {
  file: File;
  preview: string;
  uploaded?: { storage_path: string; storage_bucket: string };
}

interface ExistingEvidence {
  id: string;
  evidence_type: string;
  file_name: string | null;
  storage_bucket: string | null;
  storage_path: string | null;
  notes: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  matchId: string | null;
  eventId: string;
  /** Texto descritivo da partida (sport / categoria / horário / local). Renderizado no header. */
  matchSummary?: string;
}

const ROLE_LABEL: Record<string, string> = {
  arbitro_principal: "Árbitro Principal",
  arbitro_auxiliar: "Auxiliar",
  mesario: "Mesário",
  fiscal: "Fiscal",
  anotador: "Anotador",
};

export default function LancamentoSimplificadoDialog({ open, onOpenChange, matchId, eventId, matchSummary }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const [scoreHome, setScoreHome] = useState("");
  const [scoreAway, setScoreAway] = useState("");
  const [scoreNote, setScoreNote] = useState("");
  const [reportText, setReportText] = useState("");
  const [hasIncident, setHasIncident] = useState(false);
  const [pendingSumula, setPendingSumula] = useState<File | null>(null);
  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([]);
  const [refereePresence, setRefereePresence] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);

  const sumulaRef = useRef<HTMLInputElement | null>(null);
  const photosRef = useRef<HTMLInputElement | null>(null);

  // -------- Fetches --------
  const { data: assignments = [] } = useQuery<MatchAssignment[]>({
    queryKey: ["lanc-assignments", matchId],
    enabled: !!matchId && open,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("match_user_assignments")
        .select("id, user_id, role, acceptance_status, profiles:user_id(full_name)")
        .eq("match_id", matchId!);
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        id: r.id,
        user_id: r.user_id,
        role: r.role,
        acceptance_status: r.acceptance_status,
        full_name: r.profiles?.full_name ?? null,
      }));
    },
  });

  const { data: existingEvidences = [] } = useQuery<ExistingEvidence[]>({
    queryKey: ["lanc-existing-evidences", matchId],
    enabled: !!matchId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("match_evidences")
        .select("id, evidence_type, file_name, storage_bucket, storage_path, notes")
        .eq("match_id", matchId!)
        .order("uploaded_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ExistingEvidence[];
    },
  });

  // Inicializa toggle de presença a partir do que existe.
  useEffect(() => {
    if (assignments.length === 0) return;
    const init: Record<string, boolean> = {};
    for (const a of assignments) {
      // Se nunca confirmou e não declarou indisponibilidade, presume "presente" no momento do lançamento.
      init[a.id] = a.acceptance_status !== "unavailable";
    }
    setRefereePresence(init);
  }, [assignments]);

  function reset() {
    setScoreHome("");
    setScoreAway("");
    setScoreNote("");
    setReportText("");
    setHasIncident(false);
    setPendingSumula(null);
    setPendingPhotos([]);
    setSubmitting(false);
  }

  // -------- File handlers --------
  function handleSumulaFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      toast.error("Súmula precisa ser PDF.");
      return;
    }
    if (file.size > MAX_PDF_MB * 1024 * 1024) {
      toast.error(`PDF maior que ${MAX_PDF_MB}MB.`);
      return;
    }
    setPendingSumula(file);
    if (sumulaRef.current) sumulaRef.current.value = "";
  }

  function handlePhotosFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    const next: PendingPhoto[] = [];
    for (const file of files) {
      if (!file.type.startsWith("image/")) {
        toast.error(`${file.name} não é imagem.`);
        continue;
      }
      if (file.size > MAX_PHOTO_MB * 1024 * 1024) {
        toast.error(`${file.name} maior que ${MAX_PHOTO_MB}MB.`);
        continue;
      }
      if (pendingPhotos.length + next.length >= MAX_PHOTOS) {
        toast.error(`Máximo ${MAX_PHOTOS} fotos.`);
        break;
      }
      next.push({ file, preview: URL.createObjectURL(file) });
    }
    setPendingPhotos((prev) => [...prev, ...next]);
    if (photosRef.current) photosRef.current.value = "";
  }

  function removePhoto(idx: number) {
    setPendingPhotos((prev) => {
      const removed = prev[idx];
      if (removed) URL.revokeObjectURL(removed.preview);
      return prev.filter((_, i) => i !== idx);
    });
  }

  // -------- Save --------
  const saveMut = useMutation({
    mutationFn: async () => {
      if (!matchId) throw new Error("Partida sem ID.");
      if (!user?.id) throw new Error("Usuário não autenticado.");

      setSubmitting(true);

      // 1) Sumula upload (se houver).
      const evidenceInserts: any[] = [];
      if (pendingSumula) {
        const path = `${eventId}/${matchId}/sumula-${Date.now()}-${pendingSumula.name}`;
        const { error } = await supabase.storage
          .from("evidencias-partida")
          .upload(path, pendingSumula, { contentType: pendingSumula.type, upsert: false });
        if (error) throw new Error(`Upload da súmula falhou: ${error.message}`);
        evidenceInserts.push({
          match_id: matchId,
          event_id: eventId,
          evidence_type: "sumula",
          storage_bucket: "evidencias-partida",
          storage_path: path,
          file_name: pendingSumula.name,
          mime_type: pendingSumula.type,
          uploaded_by: user.id,
        });
      }

      // 2) Fotos upload.
      for (const p of pendingPhotos) {
        const path = `${eventId}/${matchId}/foto-${Date.now()}-${p.file.name}`;
        const { error } = await supabase.storage
          .from("evidencias-partida")
          .upload(path, p.file, { contentType: p.file.type, upsert: false });
        if (error) throw new Error(`Upload de foto (${p.file.name}) falhou: ${error.message}`);
        evidenceInserts.push({
          match_id: matchId,
          event_id: eventId,
          evidence_type: "foto",
          storage_bucket: "evidencias-partida",
          storage_path: path,
          file_name: p.file.name,
          mime_type: p.file.type,
          uploaded_by: user.id,
        });
      }

      // 3) Relatório/score livre.
      const scoreDescription =
        scoreHome.trim() && scoreAway.trim()
          ? `Placar: ${scoreHome.trim()} × ${scoreAway.trim()}`
          : scoreNote.trim()
          ? `Resultado: ${scoreNote.trim()}`
          : "";
      const fullReport = [scoreDescription, hasIncident ? "[INCIDENTE REGISTRADO]" : "", reportText.trim()]
        .filter(Boolean)
        .join("\n\n");
      if (fullReport) {
        evidenceInserts.push({
          match_id: matchId,
          event_id: eventId,
          evidence_type: "relatorio",
          notes: fullReport,
          uploaded_by: user.id,
        });
      }

      // 4) Insere todas as evidências.
      if (evidenceInserts.length > 0) {
        const { error } = await supabase.from("match_evidences").insert(evidenceInserts);
        if (error) throw new Error(`Salvar evidências falhou: ${error.message}`);
      }

      // 5) Atualiza presença dos árbitros designados.
      for (const a of assignments) {
        const present = refereePresence[a.id];
        const newStatus = present ? "confirmed" : "unavailable";
        if (a.acceptance_status === newStatus) continue;
        const { error } = await (supabase as any)
          .from("match_user_assignments")
          .update({
            acceptance_status: newStatus,
            reported_at: new Date().toISOString(),
          })
          .eq("id", a.id);
        if (error) {
          // Não bloqueia o save por isso; só loga.
          console.warn(`Falha ao atualizar presença de ${a.full_name}:`, error.message);
        }
      }

      return evidenceInserts.length;
    },
    onSuccess: (count) => {
      toast.success(`Lançamento salvo (${count} evidência(s)).`);
      qc.invalidateQueries({ queryKey: ["lanc-existing-evidences", matchId] });
      qc.invalidateQueries({ queryKey: ["lanc-assignments", matchId] });
      qc.invalidateQueries({ queryKey: ["pwa-arb-home-assignments"] });
      qc.invalidateQueries({ queryKey: ["pwa-arb-agenda"] });
      reset();
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast.error(err?.message ?? "Erro ao salvar.");
    },
    onSettled: () => setSubmitting(false),
  });

  function handleSubmit() {
    if (!matchId) return;
    const hasAny =
      pendingSumula != null ||
      pendingPhotos.length > 0 ||
      reportText.trim() ||
      scoreHome.trim() ||
      scoreAway.trim() ||
      scoreNote.trim();
    if (!hasAny) {
      toast.error("Preencha pelo menos placar, relatório, súmula ou foto.");
      return;
    }
    saveMut.mutate();
  }

  const presentCount = useMemo(
    () => Object.values(refereePresence).filter(Boolean).length,
    [refereePresence],
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Lançamento Rápido de Partida
          </DialogTitle>
          <DialogDescription>
            Registre placar, súmula, fotos e árbitros responsáveis em um lugar só.
          </DialogDescription>
        </DialogHeader>

        {/* Aviso */}
        <div className="rounded-md border border-amber-300/60 bg-amber-50 dark:border-amber-700/40 dark:bg-amber-950/20 p-3 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
          <Info className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <strong>Lançamento operacional.</strong> Este formulário registra evidências e atualiza presenças.
            Ele <strong>não substitui</strong> a homologação formal do resultado (validação + publicação) feita pela coordenação técnica.
          </div>
        </div>

        {matchSummary && (
          <div className="rounded-md border bg-muted/30 p-3 text-sm font-medium">{matchSummary}</div>
        )}

        {/* Score */}
        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Resultado</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Mandante</Label>
              <Input value={scoreHome} onChange={(e) => setScoreHome(e.target.value)} placeholder="0" inputMode="numeric" />
            </div>
            <div>
              <Label className="text-xs">Visitante</Label>
              <Input value={scoreAway} onChange={(e) => setScoreAway(e.target.value)} placeholder="0" inputMode="numeric" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Resultado livre (modalidades individuais ou observação)</Label>
            <Input
              value={scoreNote}
              onChange={(e) => setScoreNote(e.target.value)}
              placeholder="Ex.: Tempo 1:23.45, Distância 5,42m, Vencedor por nocaute…"
            />
          </div>
          <div className="flex items-center justify-between rounded-md border p-2 bg-muted/20">
            <div className="text-xs">
              <strong>Houve incidente?</strong>
              <span className="text-muted-foreground ml-1">(briga, lesão grave, problema técnico)</span>
            </div>
            <Switch checked={hasIncident} onCheckedChange={setHasIncident} />
          </div>
        </section>

        {/* Sumula */}
        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Súmula (PDF, máx {MAX_PDF_MB}MB)
            </span>
          </div>
          {pendingSumula ? (
            <div className="flex items-center justify-between rounded-md border p-2 bg-muted/30 text-sm">
              <span className="truncate">{pendingSumula.name}</span>
              <Button variant="ghost" size="icon" onClick={() => setPendingSumula(null)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ) : (
            <Button variant="outline" asChild className="w-full">
              <label className="cursor-pointer">
                <Upload className="h-4 w-4 mr-2" />
                Selecionar PDF
                <input ref={sumulaRef} type="file" accept="application/pdf" className="hidden" onChange={handleSumulaFile} />
              </label>
            </Button>
          )}
        </section>

        {/* Fotos */}
        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <Camera className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Fotos (até {MAX_PHOTOS}, {MAX_PHOTO_MB}MB cada)
            </span>
          </div>
          {pendingPhotos.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {pendingPhotos.map((p, i) => (
                <div key={i} className="relative aspect-square rounded-md overflow-hidden border bg-muted">
                  <img src={p.preview} alt={`foto-${i}`} className="object-cover w-full h-full" />
                  <button
                    type="button"
                    onClick={() => removePhoto(i)}
                    className="absolute top-1 right-1 bg-destructive/90 text-white rounded-full p-1 hover:bg-destructive"
                    aria-label="Remover foto"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          {pendingPhotos.length < MAX_PHOTOS && (
            <Button variant="outline" asChild className="w-full">
              <label className="cursor-pointer">
                <Camera className="h-4 w-4 mr-2" />
                Adicionar fotos
                <input
                  ref={photosRef}
                  type="file"
                  accept="image/*"
                  multiple
                  capture="environment"
                  className="hidden"
                  onChange={handlePhotosFiles}
                />
              </label>
            </Button>
          )}
        </section>

        {/* Árbitros responsáveis */}
        <section className="space-y-2">
          <div className="flex items-center gap-2 justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <Users className="h-4 w-4" /> Árbitros designados
            </span>
            <Badge variant="outline" className="text-[10px]">
              {presentCount} de {assignments.length} presente{presentCount === 1 ? "" : "s"}
            </Badge>
          </div>
          {assignments.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">Nenhum árbitro escalado para esta partida.</p>
          ) : (
            <div className="space-y-1 rounded-md border p-2">
              {assignments.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{a.full_name ?? "(sem nome)"}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                      {ROLE_LABEL[a.role] ?? a.role}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-muted-foreground">Presente</span>
                    <Switch
                      checked={refereePresence[a.id] ?? true}
                      onCheckedChange={(c) => setRefereePresence((prev) => ({ ...prev, [a.id]: c }))}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Relatório */}
        <section className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Relatório (opcional)
          </Label>
          <Textarea
            value={reportText}
            onChange={(e) => setReportText(e.target.value)}
            rows={3}
            placeholder="Observações da partida, decisões importantes, justificativas…"
            maxLength={2000}
          />
          <p className="text-[10px] text-muted-foreground text-right">{reportText.length}/2000</p>
        </section>

        {/* Já anexados */}
        {existingEvidences.length > 0 && (
          <section className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Já anexados nesta partida
            </span>
            <div className="space-y-1">
              {existingEvidences.map((ev) => (
                <div key={ev.id} className="text-xs flex items-center gap-2 text-muted-foreground border-l-2 border-muted pl-2">
                  <Badge variant="outline" className="text-[9px] uppercase">{ev.evidence_type}</Badge>
                  <span className="truncate">{ev.file_name ?? ev.notes?.slice(0, 80) ?? "(sem detalhes)"}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        <DialogFooter className="gap-2">
          {hasIncident && (
            <div className="flex items-center gap-2 text-xs text-destructive flex-1">
              <AlertTriangle className="h-3 w-3" />
              Incidente será destacado no relatório.
            </div>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
            Salvar lançamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
