import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  UserCheck,
  Search,
  Loader2,
  CreditCard,
  XCircle,
  RefreshCw,
  Eye,
  CheckCircle2,
  Clock,
  ShieldCheck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
import CredentialPreviewDialog from "@/components/admin/CredentialPreviewDialog";

const TYPE_LABELS: Record<string, string> = {
  athlete: "Atleta",
  coach: "Técnico",
  head_of_delegation: "Chefe Deleg.",
  staff: "Staff",
  commission: "Comissão",
};

const DEFAULT_FIELD_CONFIG = {
  photo: { x: 240, y: 280, width: 120, height: 150, visible: true },
  full_name: { x: 300, y: 470, fontSize: 20, fontColor: "#1a1a1a", fontWeight: "bold", align: "center", maxWidth: 480, visible: true },
  participant_type: { x: 300, y: 500, fontSize: 13, fontColor: "#555555", align: "center", maxWidth: 400, visible: true },
  sport_event: { x: 300, y: 530, fontSize: 14, fontColor: "#333333", align: "center", maxWidth: 400, visible: true },
  institution: { x: 300, y: 560, fontSize: 12, fontColor: "#444444", align: "center", maxWidth: 440, visible: true },
  credential_code: { x: 300, y: 610, fontSize: 14, fontColor: "#1a1a1a", fontWeight: "bold", align: "center", maxWidth: 300, visible: true },
  qr_code: { x: 245, y: 650, width: 110, height: 110, visible: true },
};

export default function CredenciamentoPage() {
  const queryClient = useQueryClient();
  const { hasRole, user } = useAuth();
  const [selectedEventId, setSelectedEventId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [previewParticipantId, setPreviewParticipantId] = useState<string | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<any>(null);

  const canCredential = hasRole("admin") || hasRole("secretaria") || hasRole("coordenacao_tecnica");

  // --- Events ---
  const { data: events = [] } = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*").order("year", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // --- Template for the event ---
  const { data: eventTemplate, isFetched: templateFetched } = useQuery({
    queryKey: ["event-default-template", selectedEventId],
    queryFn: async () => {
      if (!selectedEventId) return null;
      const { data, error } = await supabase
        .from("credential_templates")
        .select("*")
        .eq("event_id", selectedEventId)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!selectedEventId,
  });

  // Auto-create default template only after query has fetched and returned null
  const createDefaultTemplateMutation = useMutation({
    mutationFn: async () => {
      const event = events.find((e) => e.id === selectedEventId);
      const { data, error } = await supabase
        .from("credential_templates")
        .insert({
          event_id: selectedEventId,
          name: `Modelo Padrão — ${event?.name ?? "Evento"}`,
          width: 600,
          height: 800,
          is_active: true,
          background_url: null,
          field_config: JSON.parse(JSON.stringify(DEFAULT_FIELD_CONFIG)),
          notes: "Modelo padrão gerado automaticamente pelo sistema.",
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-default-template", selectedEventId] });
    },
  });

  useEffect(() => {
    if (selectedEventId && templateFetched && eventTemplate === null && !createDefaultTemplateMutation.isPending) {
      createDefaultTemplateMutation.mutate();
    }
  }, [selectedEventId, templateFetched, eventTemplate]);

  // --- Participants ---
  const { data: participants, isLoading } = useQuery({
    queryKey: ["credenciamento-participants", selectedEventId],
    queryFn: async () => {
      if (!selectedEventId) return [];
      const { data, error } = await supabase
        .from("participants")
        .select("id, status, participant_type, credentialed_at, credentialed_by, person_id, delegation_id")
        .eq("event_id", selectedEventId)
        .eq("is_active", true)
        .in("status", ["confirmed", "credentialed"])
        .order("status", { ascending: true })
        .limit(2000);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedEventId,
  });

  // --- Active credentials ---
  const { data: activeCredentials = [] } = useQuery({
    queryKey: ["credenciamento-credentials", selectedEventId],
    queryFn: async () => {
      if (!selectedEventId) return [];
      const { data, error } = await supabase
        .from("participant_credentials")
        .select("id, participant_id, credential_code, status")
        .eq("event_id", selectedEventId)
        .eq("status", "active")
        .limit(2000);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedEventId,
  });

  const activeCredMap = new Map(activeCredentials.map((c) => [c.participant_id, c]));

  // --- People ---
  const personIds = participants?.map((p) => p.person_id) ?? [];
  const { data: people = [] } = useQuery({
    queryKey: ["credenciamento-people", personIds],
    queryFn: async () => {
      if (personIds.length === 0) return [];
      const { data, error } = await supabase
        .from("people")
        .select("id, full_name, birth_date, gender, cpf")
        .in("id", personIds);
      if (error) throw error;
      return data;
    },
    enabled: personIds.length > 0,
  });

  // --- Delegations & Institutions ---
  const delegationIds = [...new Set(participants?.map((p) => p.delegation_id) ?? [])];
  const { data: delegations = [] } = useQuery({
    queryKey: ["credenciamento-delegations", delegationIds],
    queryFn: async () => {
      if (delegationIds.length === 0) return [];
      const { data, error } = await supabase.from("delegations").select("id, institution_id").in("id", delegationIds);
      if (error) throw error;
      return data;
    },
    enabled: delegationIds.length > 0,
  });

  const instIds = [...new Set(delegations.map((d) => d.institution_id))];
  const { data: institutions = [] } = useQuery({
    queryKey: ["credenciamento-institutions", instIds],
    queryFn: async () => {
      if (instIds.length === 0) return [];
      const { data, error } = await supabase.from("institutions").select("id, name").in("id", instIds);
      if (error) throw error;
      return data;
    },
    enabled: instIds.length > 0,
  });

  // --- Lookup maps ---
  const peopleMap = new Map(people.map((p) => [p.id, p]));
  const delegationMap = new Map(delegations.map((d) => [d.id, d]));
  const institutionMap = new Map(institutions.map((i) => [i.id, i]));

  const getInstitutionName = (delegationId: string) => {
    const del = delegationMap.get(delegationId);
    if (!del) return "—";
    return institutionMap.get(del.institution_id)?.name ?? "—";
  };

  // --- Filter ---
  const filtered = (participants ?? []).filter((p) => {
    if (!searchTerm) return true;
    const person = peopleMap.get(p.person_id);
    if (!person) return false;
    const term = searchTerm.toLowerCase();
    return person.full_name.toLowerCase().includes(term) || (person.cpf && person.cpf.includes(term));
  });

  // --- Mutations ---
  const credentialMutation = useMutation({
    mutationFn: async (participantId: string) => {
      const { error } = await supabase
        .from("participants")
        .update({
          status: "credentialed",
          credentialed_at: new Date().toISOString(),
          credentialed_by: user?.id,
        })
        .eq("id", participantId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["credenciamento-participants"] });
      toast.success("Participante credenciado com sucesso!");
    },
    onError: (err: Error) => toast.error(`Erro ao credenciar: ${err.message}`),
  });

  const emitCredentialMutation = useMutation({
    mutationFn: async (participantId: string) => {
      const credentialCode = `JER-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      const qrCodeValue = crypto.randomUUID();

      const { error } = await supabase.from("participant_credentials").insert({
        participant_id: participantId,
        event_id: selectedEventId,
        credential_code: credentialCode,
        qr_code_value: qrCodeValue,
        status: "active",
        binding_source: "manual",
        issued_at: new Date().toISOString(),
        activated_at: new Date().toISOString(),
        issued_by: user?.id,
        activated_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["credenciamento-credentials"] });
      toast.success("Credencial emitida e ativada com sucesso!");
    },
    onError: (err: Error) => {
      if (err.message?.includes("uq_participant_event_active")) {
        toast.error("Este participante já possui credencial ativa para este evento.");
      } else {
        toast.error(`Erro ao emitir credencial: ${err.message}`);
      }
    },
  });

  const reissueMutation = useMutation({
    mutationFn: async (participantId: string) => {
      const existing = activeCredMap.get(participantId);
      if (existing) {
        const { error: revokeErr } = await supabase
          .from("participant_credentials")
          .update({ status: "reissued", revoked_at: new Date().toISOString() })
          .eq("id", existing.id);
        if (revokeErr) throw revokeErr;
      }

      const credentialCode = `JER-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      const qrCodeValue = crypto.randomUUID();

      const { error } = await supabase.from("participant_credentials").insert({
        participant_id: participantId,
        event_id: selectedEventId,
        credential_code: credentialCode,
        qr_code_value: qrCodeValue,
        status: "active",
        binding_source: "manual",
        issued_at: new Date().toISOString(),
        activated_at: new Date().toISOString(),
        issued_by: user?.id,
        activated_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["credenciamento-credentials"] });
      toast.success("Credencial reemitida! A anterior foi invalidada.");
    },
    onError: (err: Error) => toast.error(`Erro na reemissão: ${err.message}`),
  });

  // --- Stats ---
  const confirmedCount = (participants ?? []).filter((p) => p.status === "confirmed").length;
  const credentialedCount = (participants ?? []).filter((p) => p.status === "credentialed").length;
  const credentialsEmittedCount = activeCredentials.length;

  const handleOpenPreview = (participantId: string) => {
    const tmpl = eventTemplate ?? createDefaultTemplateMutation.data;
    if (!tmpl) {
      toast.error("Nenhum modelo de credencial disponível para este evento.");
      return;
    }
    setPreviewTemplate(tmpl);
    setPreviewParticipantId(participantId);
  };

  // --- Determine participant state ---
  const getParticipantState = (p: { status: string; id: string }) => {
    const isCredentialed = p.status === "credentialed";
    const hasActiveCred = activeCredMap.has(p.id);

    if (!isCredentialed) return "awaiting"; // needs credentialing
    if (isCredentialed && !hasActiveCred) return "ready_to_emit"; // credentialed, no credential yet
    return "complete"; // has active credential
  };

  const getStateInfo = (state: string) => {
    switch (state) {
      case "awaiting":
        return { label: "Aguardando", icon: <Clock className="h-3.5 w-3.5" />, color: "text-yellow-600", bgColor: "bg-yellow-50 border-yellow-200" };
      case "ready_to_emit":
        return { label: "Pronto p/ emissão", icon: <CreditCard className="h-3.5 w-3.5" />, color: "text-blue-600", bgColor: "bg-blue-50 border-blue-200" };
      case "complete":
        return { label: "Credencial ativa", icon: <ShieldCheck className="h-3.5 w-3.5" />, color: "text-green-600", bgColor: "bg-green-50 border-green-200" };
      default:
        return { label: "—", icon: null, color: "", bgColor: "" };
    }
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-foreground">Credenciamento</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Credenciar participantes e emitir credenciais
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Evento</label>
              <Select value={selectedEventId} onValueChange={setSelectedEventId}>
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
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium text-foreground">Buscar participante</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Nome ou CPF..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  disabled={!selectedEventId}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      {selectedEventId && participants && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card><CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-2xl font-bold text-foreground">{participants.length}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Aguardando</p>
            <p className="text-2xl font-bold text-yellow-600">{confirmedCount}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Credenciados</p>
            <p className="text-2xl font-bold text-green-600">{credentialedCount}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Credenciais emitidas</p>
            <p className="text-2xl font-bold text-blue-600">{credentialsEmittedCount}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Progresso</p>
            <p className="text-2xl font-bold text-primary">
              {participants.length > 0 ? `${Math.round((credentialedCount / participants.length) * 100)}%` : "—"}
            </p>
          </CardContent></Card>
        </div>
      )}

      {/* Empty state */}
      {!selectedEventId ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 py-16 text-center">
          <UserCheck className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground font-medium">Selecione um evento</p>
          <p className="text-sm text-muted-foreground mt-1">Escolha o evento para iniciar o credenciamento.</p>
        </div>
      ) : isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-md" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 py-16 text-center">
          <XCircle className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground font-medium">Nenhum participante encontrado</p>
          <p className="text-sm text-muted-foreground mt-1">
            {searchTerm ? "Tente outro termo de busca." : "Importe participantes primeiro."}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead className="hidden md:table-cell">CPF</TableHead>
                <TableHead className="hidden lg:table-cell">Instituição</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Situação</TableHead>
                {canCredential && <TableHead>Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => {
                const person = peopleMap.get(p.person_id);
                const state = getParticipantState(p);
                const stateInfo = getStateInfo(state);
                const activeCred = activeCredMap.get(p.id);

                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{person?.full_name ?? "—"}</TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground font-mono text-xs">
                      {person?.cpf ?? "—"}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">
                      {getInstitutionName(p.delegation_id)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {TYPE_LABELS[p.participant_type] ?? p.participant_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium ${stateInfo.color}`}>
                          {stateInfo.icon}
                          {stateInfo.label}
                        </span>
                        {activeCred && (
                          <span className="text-[11px] font-mono text-muted-foreground">
                            {activeCred.credential_code}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    {canCredential && (
                      <TableCell>
                        <div className="flex gap-1.5 flex-wrap">
                          {/* State 1: Credenciar */}
                          {state === "awaiting" && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" disabled={credentialMutation.isPending}>
                                  <UserCheck className="mr-1 h-3 w-3" />
                                  Credenciar
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Confirmar credenciamento</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Credenciar <strong>{person?.full_name}</strong>? Essa ação registra a conferência presencial do participante.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => credentialMutation.mutate(p.id)}>
                                    Confirmar
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}

                          {/* State 2: Emitir */}
                          {state === "ready_to_emit" && (
                            <Button
                              size="sm"
                              onClick={() => emitCredentialMutation.mutate(p.id)}
                              disabled={emitCredentialMutation.isPending}
                            >
                              {emitCredentialMutation.isPending ? (
                                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                              ) : (
                                <CreditCard className="mr-1 h-3 w-3" />
                              )}
                              Emitir Credencial
                            </Button>
                          )}

                          {/* State 3: Ver + Reemitir */}
                          {state === "complete" && (
                            <>
                              <Button size="sm" variant="outline" onClick={() => handleOpenPreview(p.id)}>
                                <Eye className="mr-1 h-3 w-3" />
                                Ver
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button size="sm" variant="ghost" disabled={reissueMutation.isPending}>
                                    <RefreshCw className="mr-1 h-3 w-3" />
                                    Reemitir
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Reemitir credencial (2ª via)</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Reemitir credencial de <strong>{person?.full_name}</strong>?
                                      A credencial atual (<code className="text-xs">{activeCred?.credential_code}</code>) será invalidada
                                      e uma nova será gerada com novo código e QR Code.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => reissueMutation.mutate(p.id)}>
                                      Confirmar reemissão
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Preview dialog */}
      {previewTemplate && (
        <CredentialPreviewDialog
          open={!!previewParticipantId}
          onOpenChange={(open) => {
            if (!open) {
              setPreviewParticipantId(null);
              setPreviewTemplate(null);
            }
          }}
          template={previewTemplate}
          participantId={previewParticipantId ?? undefined}
        />
      )}
    </div>
  );
}
