import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useActiveEventId } from "@/contexts/EventContext";
import { toast } from "sonner";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Upload, CheckCircle2 } from "lucide-react";

const REASON_OPTIONS = [
  { value: "lesao", label: "Lesão" },
  { value: "desistencia", label: "Desistência" },
  { value: "disciplinar", label: "Medida disciplinar" },
  { value: "convocacao", label: "Convocação externa" },
  { value: "outro", label: "Outro" },
];

const DOCUMENT_SLOTS = [
  { key: "foto_atleta",       label: "Foto do atleta entrante" },
  { key: "rg_frente",        label: "RG — frente" },
  { key: "rg_verso",         label: "RG — verso" },
  { key: "termo_inscricao",  label: "Termo de inscrição" },
  { key: "aptidao_fisica",   label: "Aptidão física" },
  { key: "oficio_substituicao", label: "Ofício de substituição da escola" },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export default function SubstituicaoFormSheet({ open, onOpenChange, onSuccess }: Props) {
  const qc = useQueryClient();
  const { hasRole, user } = useAuth();
  const eventId = useActiveEventId();

  const isDelegacao = hasRole("delegacao") && !hasRole("admin") && !hasRole("secretaria") && !hasRole("coordenacao_tecnica");

  const [stageId, setStageId] = useState("");
  const [delegationId, setDelegationId] = useState("");
  const [sportEventId, setSportEventId] = useState("");
  const [participantOutId, setParticipantOutId] = useState("");
  const [participantInId, setParticipantInId] = useState("");
  const [reasonCode, setReasonCode] = useState("lesao");
  const [reason, setReason] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [docs, setDocs] = useState<Record<string, File>>({});
  const [protocol, setProtocol] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Para role delegacao: força a própria delegação
  const { data: ownDelegationId } = useQuery({
    queryKey: ["own_delegation_id", user?.id],
    enabled: open && isDelegacao && !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_delegations")
        .select("delegation_id")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data?.delegation_id ?? null;
    },
  });

  useEffect(() => {
    if (isDelegacao && ownDelegationId) setDelegationId(ownDelegationId);
  }, [isDelegacao, ownDelegationId]);

  // Etapas disponíveis
  const { data: stages = [] } = useQuery({
    queryKey: ["sub_stages", eventId],
    enabled: open && !!eventId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("event_stages")
        .select("id, name, status")
        .eq("event_id", eventId)
        .order("name");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  // Delegações (para admins)
  const { data: delegations = [] } = useQuery({
    queryKey: ["sub_delegations", eventId],
    enabled: open && !isDelegacao && !!eventId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("delegations")
        .select("id, institutions(name, city)")
        .eq("event_id", eventId)
        .order("institutions(name)");
      if (error) throw error;
      return ((data ?? []) as any[]).map((d: any) => ({
        id: d.id as string,
        name: (d.institutions?.name ?? d.id) as string,
        city: (d.institutions?.city ?? "") as string,
      }));
    },
  });

  // Info da delegação selecionada (escola + município)
  const { data: delegationInfo } = useQuery({
    queryKey: ["sub_delegation_info", delegationId],
    enabled: !!delegationId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("delegations")
        .select("id, institutions(name, city)")
        .eq("id", delegationId)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  // Provas do evento
  const { data: sportEvents = [] } = useQuery({
    queryKey: ["sub_sport_events", eventId],
    enabled: open && !!eventId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("sport_events")
        .select("id, name, sports(name), categories(name)")
        .eq("event_id", eventId)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const selectedSE = useMemo(
    () => (sportEvents as any[]).find((s) => s.id === sportEventId),
    [sportEvents, sportEventId],
  );

  // Atletas que podem SAIR
  const { data: outCandidates = [] } = useQuery({
    queryKey: ["sub_out", sportEventId, stageId, delegationId],
    enabled: !!sportEventId && !!stageId && !!delegationId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("participant_sport_events")
        .select("participant_id, participants!inner(id, delegation_id, people(full_name))")
        .eq("sport_event_id", sportEventId)
        .eq("event_stage_id", stageId)
        .in("status", ["pending", "confirmed"])
        .eq("participants.delegation_id", delegationId);
      if (error) throw error;
      return ((data ?? []) as any[]).map((r: any) => ({
        participant_id: r.participant_id as string,
        full_name: (r.participants?.people?.full_name ?? r.participant_id) as string,
      }));
    },
  });

  // Atletas que podem ENTRAR
  const { data: inCandidates = [] } = useQuery({
    queryKey: ["sub_in", sportEventId, stageId, delegationId, eventId],
    enabled: !!sportEventId && !!stageId && !!delegationId && !!eventId,
    queryFn: async () => {
      const { data: parts, error: pErr } = await (supabase as any)
        .from("participants")
        .select("id, people(full_name)")
        .eq("event_id", eventId)
        .eq("delegation_id", delegationId)
        .eq("is_active", true)
        .eq("participant_type", "athlete");
      if (pErr) throw pErr;
      const allIds = ((parts ?? []) as any[]).map((p: any) => p.id as string);
      if (allIds.length === 0) return [];

      const { data: pses, error: psErr } = await (supabase as any)
        .from("participant_sport_events")
        .select("participant_id")
        .in("participant_id", allIds)
        .eq("sport_event_id", sportEventId)
        .eq("event_stage_id", stageId)
        .in("status", ["pending", "confirmed"]);
      if (psErr) throw psErr;
      const taken = new Set(((pses ?? []) as any[]).map((r: any) => r.participant_id as string));

      return ((parts ?? []) as any[])
        .filter((p: any) => !taken.has(p.id as string))
        .map((p: any) => ({
          participant_id: p.id as string,
          full_name: (p.people?.full_name ?? p.id) as string,
        }))
        .sort((a: any, b: any) => a.full_name.localeCompare(b.full_name, "pt-BR"));
    },
  });

  const reset = () => {
    setStageId("");
    setSportEventId("");
    setParticipantOutId("");
    setParticipantInId("");
    setReasonCode("lesao");
    setReason("");
    setContactEmail("");
    setDocs({});
    setProtocol(null);
    if (!isDelegacao) setDelegationId("");
  };

  useEffect(() => {
    setParticipantOutId("");
    setParticipantInId("");
  }, [sportEventId, delegationId, stageId]);

  const handleFileChange = (key: string, file: File | undefined) => {
    if (!file) return;
    setDocs((prev) => ({ ...prev, [key]: file }));
  };

  const submitMut = useMutation({
    mutationFn: async () => {
      if (!eventId || !stageId || !delegationId || !sportEventId || !participantOutId || !participantInId) {
        throw new Error("Preencha todos os campos obrigatórios.");
      }
      if (!contactEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
        throw new Error("Informe um e-mail válido para receber o protocolo.");
      }
      if (participantOutId === participantInId) {
        throw new Error("O atleta de entrada deve ser diferente do de saída.");
      }

      // 1. Inserir substituição
      const { data: inserted, error: insErr } = await (supabase as any)
        .from("substitutions")
        .insert({
          event_id: eventId,
          event_stage_id: stageId,
          delegation_id: delegationId,
          sport_event_id: sportEventId,
          participant_out_id: participantOutId,
          participant_in_id: participantInId,
          reason_code: reasonCode,
          reason: reason.trim() || null,
          contact_email: contactEmail,
          status: "requested",
          requested_by: user?.id,
        })
        .select("id, protocol_number")
        .single();

      if (insErr) throw insErr;

      const substitutionId = inserted.id as string;
      const protocolNumber = inserted.protocol_number as string;

      // 2. Upload de documentos
      setUploading(true);
      const docEntries = Object.entries(docs);
      for (const [docKey, file] of docEntries) {
        const ext = file.name.split(".").pop() ?? "bin";
        const path = `${substitutionId}/${docKey}.${ext}`;

        const { error: upErr } = await supabase.storage
          .from("substitution-docs")
          .upload(path, file, { upsert: true });

        if (upErr) {
          console.error(`Erro no upload de ${docKey}:`, upErr);
          continue;
        }

        const { data: urlData } = supabase.storage
          .from("substitution-docs")
          .getPublicUrl(path);

        await (supabase as any).from("participant_documents").insert({
          participant_id: participantInId,
          event_id: eventId,
          document_type: docKey,
          storage_path: path,
          file_url: urlData?.publicUrl ?? null,
          mime_type: file.type,
          status: "pending",
        });
      }
      setUploading(false);

      // 3. Enviar e-mail de protocolo (não bloqueia em caso de falha)
      try {
        await supabase.functions.invoke("send-substitution-email", {
          body: { to: contactEmail, protocol_number: protocolNumber },
        });
      } catch (emailErr) {
        console.error("Falha ao enviar e-mail de protocolo:", emailErr);
      }

      return protocolNumber;
    },
    onSuccess: (protocolNumber) => {
      setProtocol(protocolNumber);
      qc.invalidateQueries({ queryKey: ["substituicoes"] });
      onSuccess?.();
    },
    onError: (e: Error) => {
      setUploading(false);
      toast.error(`Erro: ${e.message}`);
    },
  });

  const isPending = submitMut.isPending || uploading;

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader className="pb-4">
            <SheetTitle>Nova solicitação de substituição</SheetTitle>
            <SheetDescription>
              Substituição regulamentar de atleta. Preencha todos os campos e anexe os documentos obrigatórios.
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-5 pb-24">
            {/* Etapa */}
            <div className="space-y-1">
              <Label>Etapa</Label>
              <Select value={stageId} onValueChange={setStageId}>
                <SelectTrigger><SelectValue placeholder="Selecione a etapa" /></SelectTrigger>
                <SelectContent>
                  {(stages as any[]).map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Delegação (só para admin) */}
            {!isDelegacao && (
              <div className="space-y-1">
                <Label>Delegação</Label>
                <Select value={delegationId} onValueChange={setDelegationId}>
                  <SelectTrigger><SelectValue placeholder="Selecione a delegação" /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    {(delegations as any[]).map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Escola e Município (read-only) */}
            {delegationInfo && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Escola</Label>
                  <p className="text-sm font-medium">{delegationInfo.institutions?.name ?? "—"}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Município</Label>
                  <p className="text-sm font-medium">{delegationInfo.institutions?.city ?? "—"}</p>
                </div>
              </div>
            )}

            {/* Modalidade */}
            <div className="space-y-1">
              <Label>Modalidade</Label>
              <Select value={sportEventId} onValueChange={setSportEventId} disabled={!delegationId || !stageId}>
                <SelectTrigger><SelectValue placeholder="Selecione a modalidade" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {(sportEvents as any[]).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                      <span className="text-muted-foreground text-xs ml-2">
                        · {s.sports?.name} · {s.categories?.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Categoria (read-only) */}
            {selectedSE && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Categoria</Label>
                <p className="text-sm font-medium">{selectedSE.categories?.name ?? "—"}</p>
              </div>
            )}

            {/* Atletas */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Atleta que sai</Label>
                <Select
                  value={participantOutId}
                  onValueChange={setParticipantOutId}
                  disabled={!sportEventId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={
                      !sportEventId ? "—" :
                      (outCandidates as any[]).length === 0 ? "Nenhum inscrito" : "Selecione"
                    } />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {(outCandidates as any[]).map((p) => (
                      <SelectItem key={p.participant_id} value={p.participant_id}>
                        {p.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Atleta que entra</Label>
                <Select
                  value={participantInId}
                  onValueChange={setParticipantInId}
                  disabled={!sportEventId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={
                      !sportEventId ? "—" :
                      (inCandidates as any[]).length === 0 ? "Nenhum disponível" : "Selecione"
                    } />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {(inCandidates as any[]).map((p) => (
                      <SelectItem key={p.participant_id} value={p.participant_id}>
                        {p.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {selectedSE && (outCandidates as any[]).length === 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Esta delegação não tem atletas inscritos nesta modalidade nesta etapa.
              </p>
            )}

            {/* Motivo */}
            <div className="space-y-1">
              <Label>Motivo</Label>
              <Select value={reasonCode} onValueChange={setReasonCode}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {REASON_OPTIONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Observações (opcional)</Label>
              <Textarea
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ex.: lesão confirmada por atestado médico."
              />
            </div>

            {/* E-mail para protocolo */}
            <div className="space-y-1">
              <Label>E-mail para receber o protocolo</Label>
              <Input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="email@escola.edu.br"
              />
            </div>

            {/* Documentos */}
            <div className="space-y-3">
              <Label>Documentos</Label>
              <p className="text-xs text-muted-foreground -mt-2">
                Anexe os arquivos do atleta entrante (imagens ou PDF, máx. 10 MB cada).
              </p>
              <div className="space-y-2">
                {DOCUMENT_SLOTS.map((slot) => (
                  <div key={slot.key} className="flex items-center gap-3 rounded-md border border-border/60 px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{slot.label}</p>
                      {docs[slot.key] ? (
                        <p className="text-[10px] text-emerald-600 truncate">{docs[slot.key].name}</p>
                      ) : (
                        <p className="text-[10px] text-muted-foreground">Nenhum arquivo selecionado</p>
                      )}
                    </div>
                    <button
                      type="button"
                      className="shrink-0 flex items-center gap-1 text-xs text-primary hover:underline"
                      onClick={() => fileRefs.current[slot.key]?.click()}
                    >
                      {docs[slot.key]
                        ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        : <Upload className="h-4 w-4" />}
                      {docs[slot.key] ? "Alterar" : "Selecionar"}
                    </button>
                    <input
                      ref={(el) => { fileRefs.current[slot.key] = el; }}
                      type="file"
                      className="hidden"
                      accept="image/jpeg,image/png,image/webp,application/pdf"
                      onChange={(e) => handleFileChange(slot.key, e.target.files?.[0])}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Footer fixo */}
          <div className="fixed bottom-0 right-0 w-full sm:max-w-xl bg-background border-t border-border p-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isPending}>
              Cancelar
            </Button>
            <Button onClick={() => submitMut.mutate()} disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              {uploading ? "Enviando documentos…" : "Solicitar"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Modal de confirmação com protocolo */}
      <Dialog open={!!protocol} onOpenChange={(o) => { if (!o) { setProtocol(null); onOpenChange(false); reset(); } }}>
        <DialogContent className="sm:max-w-sm text-center">
          <DialogHeader>
            <DialogTitle className="flex flex-col items-center gap-2">
              <CheckCircle2 className="h-10 w-10 text-emerald-500" />
              Solicitação registrada
            </DialogTitle>
            <DialogDescription className="space-y-2 pt-2">
              <span className="block text-sm">Número de protocolo:</span>
              <span className="block text-2xl font-bold tracking-widest text-foreground">{protocol}</span>
              <span className="block text-xs text-muted-foreground">
                Um e-mail com o protocolo foi enviado para {contactEmail}.
                Sua solicitação será analisada pela comissão técnica.
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="justify-center">
            <Button onClick={() => { setProtocol(null); onOpenChange(false); reset(); }}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
