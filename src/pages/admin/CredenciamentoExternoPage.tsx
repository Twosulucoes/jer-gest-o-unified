import { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEventId } from "@/contexts/EventContext";
import { useAuth } from "@/hooks/useAuth";
import { useStageScope } from "@/hooks/useStageScope";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  AlertTriangle, CheckCircle, ScanLine, Search, User, XCircle,
  Users, ShieldCheck, Clock, ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import QrCodeScanner from "@/components/pwa/QrCodeScanner";
import { generateQrCodeValue } from "@/lib/credentialUtils";

interface ParticipantRow {
  id: string;
  full_name: string;
  cpf: string | null;
  photo_url: string | null;
  delegation_id: string;
  delegation_name: string | null;
  participant_type: string;
  ext_cred_id: string | null;
  ext_cred_code: string | null;
  ext_cred_status: string | null;
}

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  active: { label: "Ativa", variant: "default" },
  cancelled: { label: "Cancelada", variant: "destructive" },
  lost: { label: "Perdida", variant: "destructive" },
  replaced: { label: "Substituída", variant: "secondary" },
};

const TYPE_LABELS: Record<string, string> = {
  athlete: "Atleta",
  coach: "Técnico",
  head_of_delegation: "Chefe de delegação",
  staff: "Staff",
  referee: "Árbitro",
  guest: "Convidado",
};

const PAGE_SIZE = 50;

export default function CredenciamentoExternoPage() {
  const eventId = useActiveEventId();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { stageId, isStageScoped, participantIds: stageParticipantIds } = useStageScope();

  const [search, setSearch] = useState("");
  const [filterDelegation, setFilterDelegation] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [selectedParticipant, setSelectedParticipant] = useState<ParticipantRow | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [replaceDialogOpen, setReplaceDialogOpen] = useState(false);
  const [pendingCode, setPendingCode] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [manualCode, setManualCode] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);

  const selectParticipant = (p: ParticipantRow) => {
    setSelectedParticipant(p);
    setSheetOpen(true);
  };

  const closeSheet = () => {
    setSheetOpen(false);
    setSelectedParticipant(null);
  };

  // Fetch delegations for filter
  const { data: delegations = [] } = useQuery({
    queryKey: ["ext-cred-delegations", eventId],
    queryFn: async () => {
      const { data } = await supabase
        .from("delegations")
        .select("id, institution:institutions(name)")
        .eq("event_id", eventId)
        .order("institution_id");
      return (data ?? []).map((d: any) => ({
        id: d.id,
        name: d.institution?.name ?? "Sem nome",
      }));
    },
    enabled: !!eventId,
  });

  // Main query: participants filtered by stage when in stage context
  const { data: allParticipants = [], isLoading: searchLoading } = useQuery({
    queryKey: ["ext-cred-participants", eventId, stageId],
    queryFn: async () => {
      if (!eventId) return [];

      let query = supabase
        .from("participants")
        .select("id, delegation_id, participant_type, person:people(full_name, cpf, photo_url), delegation:delegations(institution:institutions(name))")
        .eq("event_id", eventId)
        .eq("is_active", true)
        .order("person_id");

      // When inside a stage, only show participants enrolled in that stage
      if (isStageScoped && stageParticipantIds && stageParticipantIds.size > 0) {
        query = query.in("id", Array.from(stageParticipantIds));
      }

      const { data: parts } = await query;
      if (!parts) return [];

      // Get active external credentials for this event
      const { data: creds } = await supabase
        .from("external_credentials")
        .select("id, participant_id, credential_code, status")
        .eq("event_id", eventId)
        .eq("status", "active");

      const credMap = new Map<string, { id: string; code: string; status: string }>();
      (creds ?? []).forEach((c: any) => {
        credMap.set(c.participant_id, { id: c.id, code: c.credential_code, status: c.status });
      });

      return parts.map((p: any) => {
        const cred = credMap.get(p.id);
        return {
          id: p.id,
          full_name: p.person?.full_name ?? "—",
          cpf: p.person?.cpf ?? null,
          photo_url: p.person?.photo_url ?? null,
          delegation_id: p.delegation_id,
          delegation_name: p.delegation?.institution?.name ?? null,
          participant_type: p.participant_type,
          ext_cred_id: cred?.id ?? null,
          ext_cred_code: cred?.code ?? null,
          ext_cred_status: cred?.status ?? null,
        } as ParticipantRow;
      });
    },
    enabled: !!eventId && (!isStageScoped || !!stageParticipantIds),
  });

  // Apply filters client-side
  const filtered = useMemo(() => {
    let result = allParticipants;

    if (search.length >= 2) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) => p.full_name.toLowerCase().includes(q) || (p.cpf && p.cpf.includes(q))
      );
    }

    if (filterDelegation !== "all") {
      result = result.filter((p) => p.delegation_id === filterDelegation);
    }

    if (filterType !== "all") {
      result = result.filter((p) => p.participant_type === filterType);
    }

    if (filterStatus === "vinculada") {
      result = result.filter((p) => p.ext_cred_id !== null);
    } else if (filterStatus === "pendente") {
      result = result.filter((p) => p.ext_cred_id === null);
    }

    result.sort((a, b) => a.full_name.localeCompare(b.full_name));
    return result;
  }, [allParticipants, search, filterDelegation, filterType, filterStatus]);

  const paged = filtered.slice(0, (page + 1) * PAGE_SIZE);
  const hasMore = paged.length < filtered.length;

  const totalCount = filtered.length;
  const linkedCount = filtered.filter((p) => p.ext_cred_id !== null).length;
  const pendingCount = totalCount - linkedCount;

  const existingCred = selectedParticipant
    ? { id: selectedParticipant.ext_cred_id, credential_code: selectedParticipant.ext_cred_code, status: selectedParticipant.ext_cred_status }
    : null;
  const hasActiveCred = existingCred?.id != null;

  // Link credential mutation
  const linkMutation = useMutation({
    mutationFn: async ({ code, replaceId }: { code: string; replaceId?: string }) => {
      if (!eventId || !selectedParticipant || !user) throw new Error("Dados insuficientes");
      const nowIso = new Date().toISOString();

      const { data: existing } = await supabase
        .from("external_credentials")
        .select("id, participant_id")
        .eq("event_id", eventId)
        .eq("credential_code", code)
        .eq("status", "active")
        .maybeSingle();

      if (existing) {
        const other = allParticipants.find(p => p.id === (existing as any).participant_id);
        throw new Error(`Credencial já vinculada a ${other?.full_name || "outro participante"}`);
      }

      if (replaceId) {
        await supabase.from("external_credentials").update({ status: "replaced" }).eq("id", replaceId);
        await supabase
          .from("participant_credentials")
          .update({ status: "reissued", is_active: false, revoked_at: nowIso })
          .eq("participant_id", selectedParticipant.id)
          .eq("event_id", eventId)
          .eq("binding_source", "external")
          .eq("status", "active");
      }

      const { error } = await supabase.from("external_credentials").insert({
        event_id: eventId,
        participant_id: selectedParticipant.id,
        credential_code: code,
        linked_by_user_id: user.id,
      });
      if (error) throw error;

      const { data: activeCred } = await supabase
        .from("participant_credentials")
        .select("id")
        .eq("participant_id", selectedParticipant.id)
        .eq("event_id", eventId)
        .eq("status", "active")
        .maybeSingle();

      if (!activeCred) {
        const qrCodeValue = generateQrCodeValue(eventId, selectedParticipant.id, code);
        const { error: credErr } = await supabase.from("participant_credentials").insert({
          participant_id: selectedParticipant.id,
          event_id: eventId,
          credential_code: code,
          qr_code_value: qrCodeValue,
          status: "active",
          is_active: true,
          binding_source: "external",
          issued_at: nowIso,
          activated_at: nowIso,
          issued_by: user.id,
          activated_by: user.id,
        });
        if (credErr) throw credErr;
      }

      const { data: part } = await supabase.from("participants").select("status").eq("id", selectedParticipant.id).maybeSingle();
      if (part && part.status !== "credentialed") {
        await supabase.from("participants").update({ status: "credentialed", credentialed_at: nowIso, credentialed_by: user.id }).eq("id", selectedParticipant.id);
      }
    },
    onSuccess: () => {
      toast.success("Credencial vinculada! Participante credenciado e apto a competir.");
      if (navigator.vibrate) navigator.vibrate(200);
      qc.invalidateQueries({ queryKey: ["ext-cred-participants", eventId, stageId] });
      closeSheet();
    },
    onError: (err: any) => toast.error(err.message || "Erro ao vincular credencial"),
  });

  // Cancel credential mutation
  const cancelMutation = useMutation({
    mutationFn: async (credId: string) => {
      if (!selectedParticipant) throw new Error("Participante não selecionado");
      const nowIso = new Date().toISOString();

      const { error } = await supabase.from("external_credentials").update({ status: "cancelled" }).eq("id", credId);
      if (error) throw error;

      await supabase
        .from("participant_credentials")
        .update({ status: "revoked", is_active: false, revoked_at: nowIso })
        .eq("participant_id", selectedParticipant.id)
        .eq("event_id", eventId)
        .eq("binding_source", "external")
        .eq("status", "active");

      const { count } = await supabase
        .from("participant_credentials")
        .select("id", { count: "exact", head: true })
        .eq("participant_id", selectedParticipant.id)
        .eq("event_id", eventId)
        .eq("status", "active");

      if ((count ?? 0) === 0) {
        await supabase.from("participants").update({ status: "confirmed" }).eq("id", selectedParticipant.id);
      }
    },
    onSuccess: () => {
      toast.success("Credencial cancelada");
      qc.invalidateQueries({ queryKey: ["ext-cred-participants", eventId, stageId] });
      closeSheet();
    },
    onError: () => toast.error("Erro ao cancelar credencial"),
  });

  const handleScan = useCallback((rawValue: string) => {
    setScannerOpen(false);
    const code = rawValue.trim();
    if (!code) return;
    if (hasActiveCred) { setPendingCode(code); setReplaceDialogOpen(true); }
    else { linkMutation.mutate({ code }); }
  }, [hasActiveCred, linkMutation]);

  const confirmReplace = () => {
    if (pendingCode && existingCred?.id) linkMutation.mutate({ code: pendingCode, replaceId: existingCred.id });
    setReplaceDialogOpen(false);
    setPendingCode(null);
  };

  const handleManualSubmit = () => {
    const code = manualCode.trim();
    if (!code) return;
    setManualCode("");
    if (hasActiveCred) { setPendingCode(code); setReplaceDialogOpen(true); }
    else { linkMutation.mutate({ code }); }
  };

  const participantTypes = useMemo(() => {
    const types = new Set(allParticipants.map((p) => p.participant_type));
    return Array.from(types).sort();
  }, [allParticipants]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Credenciamento Externo</h1>
        <p className="text-sm text-muted-foreground">Vincular credenciais físicas pré-impressas aos participantes</p>
      </div>

      {/* Stats */}
      <div className="flex flex-wrap gap-4">
        <div className="flex items-center gap-2 text-sm">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{totalCount}</span>
          <span className="text-muted-foreground">participantes{isStageScoped ? " na etapa" : ""}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <ShieldCheck className="h-4 w-4 text-green-500" />
          <span className="font-medium">{linkedCount}</span>
          <span className="text-muted-foreground">credenciados</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Clock className="h-4 w-4 text-yellow-500" />
          <span className="font-medium">{pendingCount}</span>
          <span className="text-muted-foreground">pendentes</span>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome ou CPF..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          className="pl-10"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Select value={filterDelegation} onValueChange={(v) => { setFilterDelegation(v); setPage(0); }}>
          <SelectTrigger className="flex-1 min-w-[140px] h-9 text-xs">
            <SelectValue placeholder="Delegação" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas delegações</SelectItem>
            {delegations.map((d) => (
              <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterType} onValueChange={(v) => { setFilterType(v); setPage(0); }}>
          <SelectTrigger className="flex-1 min-w-[120px] h-9 text-xs">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {participantTypes.map((t) => (
              <SelectItem key={t} value={t}>{TYPE_LABELS[t] ?? t}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); setPage(0); }}>
          <SelectTrigger className="flex-1 min-w-[110px] h-9 text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="vinculada">✓ Vinculada</SelectItem>
            <SelectItem value="pendente">Pendente</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Loading */}
      {searchLoading && (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      )}

      {/* Empty */}
      {!searchLoading && filtered.length === 0 && (
        <div className="text-center py-8 text-muted-foreground text-sm">
          Nenhum participante encontrado
        </div>
      )}

      {/* Participant list */}
      <div className="space-y-2">
        {paged.map((p) => (
          <Card
            key={p.id}
            className="cursor-pointer transition-colors hover:border-primary/50 active:bg-muted/50"
            onClick={() => selectParticipant(p)}
          >
            <CardContent className="p-3 flex items-center gap-3">
              {p.photo_url ? (
                <img src={p.photo_url} alt="" className="h-10 w-10 rounded-full object-cover shrink-0" />
              ) : (
                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <User className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{p.full_name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {p.delegation_name || "Sem delegação"}
                  {p.cpf ? ` • ${p.cpf}` : ""}
                </p>
                {p.ext_cred_code && (
                  <p className="text-[10px] font-mono text-muted-foreground">{p.ext_cred_code}</p>
                )}
              </div>
              <div className="shrink-0">
                {p.ext_cred_id ? (
                  <Badge variant="default" className="text-[10px]">✓ Vinculada</Badge>
                ) : (
                  <Badge variant="secondary" className="text-[10px]">Pendente</Badge>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {hasMore && (
        <Button variant="outline" className="w-full" onClick={() => setPage((p) => p + 1)}>
          Carregar mais ({filtered.length - paged.length} restantes)
        </Button>
      )}

      {/* Participant detail — Sheet (modal) for both mobile and desktop */}
      <Sheet open={sheetOpen} onOpenChange={(o) => { if (!o) closeSheet(); }}>
        <SheetContent side="bottom" className="h-[85vh] overflow-y-auto rounded-t-xl px-4 pb-8">
          {selectedParticipant && (
            <>
              <SheetHeader className="text-left pb-4">
                <div className="flex items-center gap-2 mb-2">
                  <Button variant="ghost" size="icon" className="h-8 w-8 -ml-1" onClick={closeSheet}>
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <SheetTitle className="text-base">Vincular Credencial</SheetTitle>
                </div>
                <div className="flex items-center gap-3">
                  {selectedParticipant.photo_url ? (
                    <img src={selectedParticipant.photo_url} alt="" className="h-14 w-14 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <User className="h-7 w-7 text-muted-foreground" />
                    </div>
                  )}
                  <div>
                    <p className="font-semibold text-base leading-tight">{selectedParticipant.full_name}</p>
                    <p className="text-sm text-muted-foreground">{selectedParticipant.delegation_name || "Sem delegação"}</p>
                    <p className="text-xs text-muted-foreground">{TYPE_LABELS[selectedParticipant.participant_type] ?? selectedParticipant.participant_type}</p>
                  </div>
                </div>
              </SheetHeader>

              <div className="space-y-4">
                {hasActiveCred ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />
                      <span className="font-medium text-sm">Credencial Vinculada</span>
                      <Badge variant={STATUS_LABELS[existingCred!.status!]?.variant || "outline"} className="text-xs">
                        {STATUS_LABELS[existingCred!.status!]?.label || existingCred!.status}
                      </Badge>
                    </div>
                    <div className="bg-muted rounded-lg p-4 text-center">
                      <p className="text-xs text-muted-foreground mb-1">Código da credencial</p>
                      <p className="font-mono text-2xl font-bold tracking-wider">{existingCred!.credential_code}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="destructive"
                        className="flex-1"
                        onClick={() => cancelMutation.mutate(existingCred!.id!)}
                        disabled={cancelMutation.isPending}
                      >
                        <XCircle className="h-4 w-4 mr-2" /> Cancelar
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => setScannerOpen(true)}
                        disabled={linkMutation.isPending}
                      >
                        <ScanLine className="h-4 w-4 mr-2" /> Substituir
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <AlertTriangle className="h-5 w-5 shrink-0" />
                      <span className="text-sm">Nenhuma credencial externa vinculada</span>
                    </div>
                    <Button
                      className="w-full h-14 text-base"
                      onClick={() => setScannerOpen(true)}
                      disabled={linkMutation.isPending}
                    >
                      <ScanLine className="h-5 w-5 mr-2" />
                      Escanear Credencial
                    </Button>
                    <div className="flex items-center gap-2">
                      <div className="h-px flex-1 bg-border" />
                      <span className="text-xs text-muted-foreground">ou digite o código</span>
                      <div className="h-px flex-1 bg-border" />
                    </div>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Código da credencial"
                        value={manualCode}
                        onChange={(e) => setManualCode(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleManualSubmit()}
                        className="font-mono flex-1"
                        autoCapitalize="characters"
                      />
                      <Button
                        onClick={handleManualSubmit}
                        disabled={!manualCode.trim() || linkMutation.isPending}
                      >
                        Vincular
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <QrCodeScanner
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleScan}
        title="Escanear Credencial Externa"
      />

      <AlertDialog open={replaceDialogOpen} onOpenChange={setReplaceDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Substituir credencial?</AlertDialogTitle>
            <AlertDialogDescription>
              Este participante já possui a credencial <strong className="font-mono">{existingCred?.credential_code}</strong>.
              Deseja cancelar a atual e vincular a nova?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmReplace}>Substituir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
