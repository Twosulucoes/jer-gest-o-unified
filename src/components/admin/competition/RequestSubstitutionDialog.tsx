import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";

const REASON_OPTIONS = [
  { value: "lesao", label: "Lesão" },
  { value: "desistencia", label: "Desistência" },
  { value: "disciplinar", label: "Medida disciplinar" },
  { value: "convocacao", label: "Convocação externa" },
  { value: "outro", label: "Outro" },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string | null;
  stageId: string | null;
  onSuccess?: () => void;
}

export default function RequestSubstitutionDialog({ open, onOpenChange, eventId, stageId, onSuccess }: Props) {
  const qc = useQueryClient();
  const { hasRole, user } = useAuth();
  const isDelegacao = hasRole("delegacao") && !hasRole("admin") && !hasRole("secretaria") && !hasRole("coordenacao_tecnica");

  const [delegationId, setDelegationId] = useState<string>("");
  const [sportEventId, setSportEventId] = useState<string>("");
  const [participantOutId, setParticipantOutId] = useState<string>("");
  const [participantInId, setParticipantInId] = useState<string>("");
  const [reasonCode, setReasonCode] = useState<string>("lesao");
  const [reason, setReason] = useState<string>("");

  // Para delegacao, força a própria delegação.
  const { data: ownDelegationId } = useQuery({
    queryKey: ["own_delegation_id"],
    enabled: open && isDelegacao,
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;
      const { data } = await supabase
        .from("user_delegations")
        .select("delegation_id")
        .eq("user_id", session.user.id)
        .maybeSingle();
      return data?.delegation_id ?? null;
    },
  });

  useEffect(() => {
    if (isDelegacao && ownDelegationId) setDelegationId(ownDelegationId);
  }, [isDelegacao, ownDelegationId]);

  // Lista de delegações do evento (para admin/secretaria)
  const { data: delegations = [] } = useQuery({
    queryKey: ["substitutions_delegations", eventId],
    enabled: open && !isDelegacao && !!eventId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("delegations")
        .select("id, institutions(name)")
        .eq("event_id", eventId);
      if (error) throw error;
      return ((data ?? []) as any[]).map((d) => ({
        id: d.id as string,
        name: (d.institutions?.name ?? d.id) as string,
      }));
    },
  });

  // Provas do evento (para selecionar)
  const { data: sportEvents = [] } = useQuery({
    queryKey: ["substitutions_sport_events", eventId],
    enabled: open && !!eventId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("sport_events")
        .select("id, name, sports(name), categories(name)")
        .eq("event_id", eventId)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Atletas elegíveis para SAIR: PSE ativa em (sport_event, event_stage) na delegação escolhida.
  const { data: outCandidates = [] } = useQuery({
    queryKey: ["substitutions_out_candidates", sportEventId, stageId, delegationId],
    enabled: open && !!sportEventId && !!stageId && !!delegationId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("participant_sport_events")
        .select("participant_id, participants!inner(id, delegation_id, people(full_name))")
        .eq("sport_event_id", sportEventId)
        .eq("event_stage_id", stageId)
        .in("status", ["pending", "confirmed"])
        .eq("participants.delegation_id", delegationId);
      if (error) throw error;
      return ((data ?? []) as any[]).map((r) => ({
        participant_id: r.participant_id as string,
        full_name: (r.participants?.people?.full_name ?? r.participant_id) as string,
      }));
    },
  });

  // Atletas elegíveis para ENTRAR: participantes ATIVOS da delegação que NÃO têm
  // PSE ativa naquela (sport_event, event_stage).
  const { data: inCandidates = [] } = useQuery({
    queryKey: ["substitutions_in_candidates", sportEventId, stageId, delegationId, eventId],
    enabled: open && !!sportEventId && !!stageId && !!delegationId && !!eventId,
    queryFn: async () => {
      // 1) Todos os participantes ativos atletas da delegação no evento
      const { data: parts, error: pErr } = await (supabase as any)
        .from("participants")
        .select("id, people(full_name), participant_type")
        .eq("event_id", eventId)
        .eq("delegation_id", delegationId)
        .eq("is_active", true)
        .in("participant_type", ["athlete"]);
      if (pErr) throw pErr;
      const allIds = ((parts ?? []) as any[]).map((p) => p.id as string);
      if (allIds.length === 0) return [];

      // 2) Quais já têm PSE ativa nessa prova/etapa
      const { data: pses, error: psErr } = await (supabase as any)
        .from("participant_sport_events")
        .select("participant_id")
        .in("participant_id", allIds)
        .eq("sport_event_id", sportEventId)
        .eq("event_stage_id", stageId)
        .in("status", ["pending", "confirmed"]);
      if (psErr) throw psErr;
      const taken = new Set(((pses ?? []) as any[]).map((r) => r.participant_id as string));

      return ((parts ?? []) as any[])
        .filter((p) => !taken.has(p.id as string))
        .map((p) => ({
          participant_id: p.id as string,
          full_name: (p.people?.full_name ?? p.id) as string,
        }))
        .sort((a, b) => a.full_name.localeCompare(b.full_name, "pt-BR"));
    },
  });

  const selectedSE = useMemo(
    () => (sportEvents as any[]).find((s) => s.id === sportEventId),
    [sportEvents, sportEventId],
  );

  const reset = () => {
    setSportEventId("");
    setParticipantOutId("");
    setParticipantInId("");
    setReasonCode("lesao");
    setReason("");
    if (!isDelegacao) setDelegationId("");
  };

  useEffect(() => { setParticipantOutId(""); setParticipantInId(""); }, [sportEventId, delegationId]);

  const requestMut = useMutation({
    mutationFn: async () => {
      if (!eventId || !stageId || !delegationId || !sportEventId || !participantOutId || !participantInId) {
        throw new Error("Preencha todos os campos obrigatórios.");
      }
      if (participantOutId === participantInId) {
        throw new Error("O atleta de entrada deve ser diferente do de saída.");
      }
      const { error } = await (supabase as any)
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
          status: "requested",
          requested_by: user?.id,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Solicitação de substituição registrada");
      qc.invalidateQueries({ queryKey: ["substitutions"] });
      onSuccess?.();
      onOpenChange(false);
      reset();
    },
    onError: (e: Error) => toast.error(`Erro: ${e.message}`),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}
    >
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Nova solicitação de substituição</DialogTitle>
          <DialogDescription>
            Substituição regulamentar de atleta em uma prova nesta etapa. Lineups
            e consumos anteriores permanecem com o atleta antigo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
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

          <div className="space-y-1">
            <Label>Prova</Label>
            <Select value={sportEventId} onValueChange={setSportEventId} disabled={!delegationId}>
              <SelectTrigger><SelectValue placeholder="Selecione a prova" /></SelectTrigger>
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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Atleta que sai</Label>
              <Select
                value={participantOutId}
                onValueChange={setParticipantOutId}
                disabled={!sportEventId || (outCandidates as any[]).length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder={
                    !sportEventId ? "—" :
                    (outCandidates as any[]).length === 0 ? "Nenhum atleta inscrito" : "Selecione"
                  } />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {(outCandidates as any[]).map((p) => (
                    <SelectItem key={p.participant_id} value={p.participant_id}>{p.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Atleta que entra</Label>
              <Select
                value={participantInId}
                onValueChange={setParticipantInId}
                disabled={!sportEventId || (inCandidates as any[]).length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder={
                    !sportEventId ? "—" :
                    (inCandidates as any[]).length === 0 ? "Nenhum atleta disponível" : "Selecione"
                  } />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {(inCandidates as any[]).map((p) => (
                    <SelectItem key={p.participant_id} value={p.participant_id}>{p.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {selectedSE && (outCandidates as any[]).length === 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Esta delegação não tem atletas inscritos nesta prova nesta etapa.
            </p>
          )}

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
              placeholder="Ex.: lesão confirmada por atestado médico anexado em arquivo separado."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={() => requestMut.mutate()}
            disabled={requestMut.isPending}
          >
            {requestMut.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
            Solicitar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
