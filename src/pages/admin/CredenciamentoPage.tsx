import { useState } from "react";
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

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pendente", variant: "outline" },
  confirmed: { label: "Confirmado", variant: "secondary" },
  credentialed: { label: "Credenciado", variant: "default" },
};

export default function CredenciamentoPage() {
  const queryClient = useQueryClient();
  const { hasRole, user } = useAuth();
  const [selectedEventId, setSelectedEventId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const canCredential = hasRole("admin") || hasRole("secretaria") || hasRole("coordenacao_tecnica");

  const { data: events = [] } = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*").order("year", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

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
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedEventId,
  });

  // Load active credentials for participants
  const { data: activeCredentials = [] } = useQuery({
    queryKey: ["credenciamento-credentials", selectedEventId],
    queryFn: async () => {
      if (!selectedEventId) return [];
      const { data, error } = await supabase
        .from("participant_credentials")
        .select("id, participant_id, credential_code, status")
        .eq("event_id", selectedEventId)
        .eq("status", "active");
      if (error) throw error;
      return data;
    },
    enabled: !!selectedEventId,
  });

  const activeCredMap = new Map(activeCredentials.map((c) => [c.participant_id, c]));

  // Load people and delegations for display
  const personIds = participants?.map((p) => p.person_id) ?? [];
  const delegationIds = [...new Set(participants?.map((p) => p.delegation_id) ?? [])];

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

  const { data: delegations = [] } = useQuery({
    queryKey: ["credenciamento-delegations", delegationIds],
    queryFn: async () => {
      if (delegationIds.length === 0) return [];
      const { data, error } = await supabase
        .from("delegations")
        .select("id, institution_id")
        .in("id", delegationIds);
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

  const peopleMap = new Map(people.map((p) => [p.id, p]));
  const delegationMap = new Map(delegations.map((d) => [d.id, d]));
  const institutionMap = new Map(institutions.map((i) => [i.id, i]));

  const getInstitutionName = (delegationId: string) => {
    const del = delegationMap.get(delegationId);
    if (!del) return "—";
    return institutionMap.get(del.institution_id)?.name ?? "—";
  };

  // Filter participants
  const filtered = (participants ?? []).filter((p) => {
    if (!searchTerm) return true;
    const person = peopleMap.get(p.person_id);
    if (!person) return false;
    const term = searchTerm.toLowerCase();
    return (
      person.full_name.toLowerCase().includes(term) ||
      (person.cpf && person.cpf.includes(term))
    );
  });

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
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
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
      queryClient.invalidateQueries({ queryKey: ["credenciamento-participants"] });
      queryClient.invalidateQueries({ queryKey: ["credenciamento-credentials"] });
      queryClient.invalidateQueries({ queryKey: ["participant-credentials"] });
      toast.success("Credencial emitida e ativada!");
    },
    onError: (err: Error) => {
      if (err.message?.includes("uq_participant_event_active")) {
        toast.error("Este participante já possui credencial ativa para este evento.");
      } else {
        toast.error(`Erro: ${err.message}`);
      }
    },
  });

  const reissueMutation = useMutation({
    mutationFn: async (participantId: string) => {
      // 1. Mark existing active credential as 'reissued'
      const existing = activeCredMap.get(participantId);
      if (existing) {
        const { error: revokeErr } = await supabase
          .from("participant_credentials")
          .update({ status: "reissued", revoked_at: new Date().toISOString() })
          .eq("id", existing.id);
        if (revokeErr) throw revokeErr;
      }

      // 2. Create new credential
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
      queryClient.invalidateQueries({ queryKey: ["credenciamento-participants"] });
      queryClient.invalidateQueries({ queryKey: ["credenciamento-credentials"] });
      queryClient.invalidateQueries({ queryKey: ["participant-credentials"] });
      toast.success("Credencial reemitida com sucesso! A anterior foi marcada como substituída.");
    },
    onError: (err: Error) => toast.error(`Erro na reemissão: ${err.message}`),
  });

  const confirmedCount = (participants ?? []).filter((p) => p.status === "confirmed").length;
  const credentialedCount = (participants ?? []).filter((p) => p.status === "credentialed").length;

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-foreground">Credenciamento</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Credenciar participantes importados e emitir credenciais oficiais
        </p>
      </div>

      {/* Controls */}
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
              <label className="text-sm font-medium text-foreground">Buscar</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Nome ou CPF do participante..."
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

      {/* Summary */}
      {selectedEventId && participants && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-2xl font-bold text-foreground">{participants.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground">Aguardando</p>
              <p className="text-2xl font-bold text-yellow-600">{confirmedCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground">Credenciados</p>
              <p className="text-2xl font-bold text-green-600">{credentialedCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground">Progresso</p>
              <p className="text-2xl font-bold text-primary">
                {participants.length > 0
                  ? `${Math.round((credentialedCount / participants.length) * 100)}%`
                  : "—"}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Table */}
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
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>CPF</TableHead>
                <TableHead>Instituição</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Status</TableHead>
                {canCredential && <TableHead className="w-[200px]">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => {
                const person = peopleMap.get(p.person_id);
                const statusInfo = STATUS_LABELS[p.status] ?? { label: p.status, variant: "outline" as const };
                const isCredentialed = p.status === "credentialed";
                const hasActiveCred = activeCredMap.has(p.id);
                const activeCred = activeCredMap.get(p.id);

                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{person?.full_name ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground font-mono text-xs">
                      {person?.cpf ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {getInstitutionName(p.delegation_id)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{p.participant_type === "athlete" ? "Atleta" : p.participant_type}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                      {hasActiveCred && (
                        <Badge variant="default" className="ml-1 text-xs">
                          {activeCred?.credential_code}
                        </Badge>
                      )}
                    </TableCell>
                    {canCredential && (
                      <TableCell>
                        <div className="flex gap-2">
                          {!isCredentialed && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="outline" disabled={credentialMutation.isPending}>
                                  <UserCheck className="mr-1 h-3 w-3" />
                                  Credenciar
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Confirmar credenciamento</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Credenciar <strong>{person?.full_name}</strong>?
                                    Essa ação registra quem e quando realizou o credenciamento.
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
                          {isCredentialed && !hasActiveCred && (
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
                          {isCredentialed && hasActiveCred && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="outline" disabled={reissueMutation.isPending}>
                                  <RefreshCw className="mr-1 h-3 w-3" />
                                  Reemitir
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Reemitir credencial</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Reemitir credencial de <strong>{person?.full_name}</strong>?
                                    A credencial atual ({activeCred?.credential_code}) será marcada como substituída
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
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
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
    </div>
  );
}
