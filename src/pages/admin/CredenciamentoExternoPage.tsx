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
import { SearchableSelect } from "@/components/admin/SearchableSelect";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  AlertTriangle, CheckCircle, ScanLine, Search, User, XCircle,
  Users, ShieldCheck, Clock, ArrowLeft, Link2, Check, IdCard, Edit,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import QrCodeScanner from "@/components/pwa/QrCodeScanner";
import { useProgressiveParticipants } from "@/hooks/useProgressiveParticipants";
import { BackgroundLoadingIndicator } from "@/components/credenciamento/BackgroundLoadingIndicator";
import { useStageModuleKpis } from "@/contexts/StageModuleKpisContext";
import PessoaFormDialog from "@/components/admin/people/PessoaFormDialog";

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

interface ParticipantsQueryRow {
  id: string;
  participant_type: string;
  delegation_id: string;
  person: {
    full_name: string | null;
    cpf: string | null;
    photo_url: string | null;
  } | null;
  delegation: {
    institution: {
      name: string | null;
    } | null;
  } | null;
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
const normalizeCredentialCode = (value: string) => value.trim().replace(/\s+/g, "").toUpperCase();

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
  const [isInternalMode, setIsInternalMode] = useState(false); // Novo estado para escolher o tipo
  const [scannerOpen, setScannerOpen] = useState(false);
  const [replaceDialogOpen, setReplaceDialogOpen] = useState(false);
  const [pendingCode, setPendingCode] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [manualCode, setManualCode] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

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

  // ====== Carregamento progressivo dos participantes ======
  // 1ª página renderiza imediatamente; demais entram em segundo plano.
  const PARTICIPANT_SELECT =
    "id, participant_type, delegation_id, person:people!participants_person_id_fkey(full_name, cpf, photo_url), delegation:delegations!participants_delegation_id_fkey(institution:institutions(name))";

  const stageScopeIds = useMemo(
    () => (isStageScoped ? (stageParticipantIds ? Array.from(stageParticipantIds) : []) : null),
    [isStageScoped, stageParticipantIds],
  );

  const {
    data: rawParts,
    firstPageReady,
    isBackgroundLoading: partsBgLoading,
  } = useProgressiveParticipants<ParticipantsQueryRow>({
    eventId,
    select: PARTICIPANT_SELECT,
    onlyActive: true,
    orderBy: "person_id",
    participantIdsScope: stageScopeIds,
    cacheKey: `ext-cred-${stageId ?? "all"}`,
    enabled: !!eventId && (!isStageScoped || !!stageParticipantIds),
  });

  // Credenciais ativas — query rápida em paralelo.
  const { data: activeCreds = [], isLoading: credsLoading } = useQuery({
    queryKey: ["ext-cred-active", eventId],
    queryFn: async () => {
      const { data } = await supabase
        .from("external_credentials")
        .select("id, participant_id, credential_code, status")
        .eq("event_id", eventId!)
        .eq("status", "active");
      return data ?? [];
    },
    enabled: !!eventId,
    staleTime: 30_000,
  });

  const credMap = useMemo(() => {
    const m = new Map<string, { id: string; code: string; status: string }>();
    (activeCreds as any[]).forEach((c) => {
      m.set(c.participant_id, { id: c.id, code: c.credential_code, status: c.status });
    });
    return m;
  }, [activeCreds]);

  const allParticipants: ParticipantRow[] = useMemo(() => {
    return (rawParts as ParticipantsQueryRow[]).map((p) => {
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
  }, [rawParts, credMap]);

  // Loading inicial: aguarda 1ª página de participantes + creds para evitar flash de "vazio".
  const searchLoading = (!firstPageReady || credsLoading);
  const isBackgroundLoading = partsBgLoading && firstPageReady;

  // Apply filters client-side
  const filtered = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    let result = allParticipants;

    if (normalizedSearch.length >= 2) {
      result = result.filter(
        (p) => p.full_name.toLowerCase().includes(normalizedSearch) || (p.cpf && p.cpf.includes(normalizedSearch))
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

    return [...result].sort((a, b) => a.full_name.localeCompare(b.full_name));
  }, [allParticipants, search, filterDelegation, filterType, filterStatus]);

  const paged = filtered.slice(0, (page + 1) * PAGE_SIZE);
  const hasMore = paged.length < filtered.length;

  const totalCount = filtered.length;
  const linkedCount = useMemo(() => filtered.reduce((acc, p) => acc + (p.ext_cred_id ? 1 : 0), 0), [filtered]);
  const pendingCount = totalCount - linkedCount;

  const existingCred = selectedParticipant
    ? { id: selectedParticipant.ext_cred_id, credential_code: selectedParticipant.ext_cred_code, status: selectedParticipant.ext_cred_status }
    : null;
  const hasActiveCred = existingCred?.id != null;

  // Link credential mutation — all writes happen inside a single DB transaction via RPC
  const linkMutation = useMutation({
    mutationFn: async ({ code, replaceId }: { code: string; replaceId?: string }) => {
      if (!eventId || !selectedParticipant || !user) throw new Error("Dados insuficientes");

      const { error } = await (supabase as any).rpc("link_external_credential", {
        p_event_id: eventId,
        p_participant_id: selectedParticipant.id,
        p_credential_code: code,
        p_user_id: user.id,
        p_replace_id: replaceId ?? null,
        p_is_internal_mode: isInternalMode,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Credencial vinculada! Participante credenciado e apto a competir.");
      if (navigator.vibrate) navigator.vibrate(200);
      qc.invalidateQueries({ queryKey: ["ext-cred-participants", eventId, stageId] });
      closeSheet();
    },
    onError: (err: any) => toast.error(err.message || "Erro ao vincular credencial"),
  });

  // Cancel credential mutation — all writes happen inside a single DB transaction via RPC
  const cancelMutation = useMutation({
    mutationFn: async (credId: string) => {
      if (!eventId || !selectedParticipant) throw new Error("Participante não selecionado");

      const { error } = await (supabase as any).rpc("cancel_external_credential", {
        p_event_id: eventId,
        p_participant_id: selectedParticipant.id,
        p_cred_id: credId,
      });
      if (error) throw error;
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
    const code = normalizeCredentialCode(rawValue);
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
    const code = normalizeCredentialCode(manualCode);
    if (!code) return;
    setManualCode("");
    if (hasActiveCred) { setPendingCode(code); setReplaceDialogOpen(true); }
    else { linkMutation.mutate({ code }); }
  };

  const participantTypes = useMemo(() => {
    const types = new Set(allParticipants.map((p) => p.participant_type));
    return Array.from(types).sort();
  }, [allParticipants]);

  // Registra KPIs do módulo no scaffold pai (única régua exibida no topo).
  // Usa rótulos consistentes com a régua global: Total / Credenciados / Pendentes.
  useStageModuleKpis(
    [
      { label: "Total", value: totalCount, icon: <Users className="h-3.5 w-3.5" />, tone: "default" },
      { label: "Credenciados", value: linkedCount, icon: <ShieldCheck className="h-3.5 w-3.5" />, tone: "success" },
      { label: "Falta credenciar", value: pendingCount, icon: <Clock className="h-3.5 w-3.5" />, tone: pendingCount > 0 ? "warning" : "default" },
    ],
    true, // esconde a régua global para não duplicar
  );

  return (
    <div className="space-y-4">
      {/* Header com troca de modo */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background">
        <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              <IdCard className="h-5 w-5 text-primary" />
              Credenciamento Externo
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Vincule uma credencial física ao participante. O código será replicado para todos os módulos.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Tipo de Credencial</span>
            <div className="flex items-center gap-1 rounded-lg border bg-muted/50 p-1">
              <Button 
                variant="ghost" 
                size="sm" 
                className={cn("h-7 px-2 text-xs gap-1.5", !isInternalMode && "bg-background shadow-sm text-primary")}
                onClick={() => setIsInternalMode(false)}
              >
                <Link2 className="h-3.5 w-3.5" />
                Externa
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className={cn("h-7 px-2 text-xs gap-1.5", isInternalMode && "bg-background shadow-sm text-primary")}
                onClick={() => setIsInternalMode(true)}
              >
                <IdCard className="h-3.5 w-3.5" />
                Interna
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-primary">
              <ShieldCheck className="h-3.5 w-3.5" />
              {isInternalMode ? "Modo Interno: Vinculação de credenciais pré-impressas" : "Modo Externo: Vinculação de pulseiras ou tags externas"}
            </div>
            {isInternalMode && (
              <Badge variant="outline" className="text-[10px] uppercase border-amber-500/50 text-amber-600 bg-amber-500/5 animate-pulse">
                Atenção: Use apenas para códigos do sistema
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stats cards removed since they are now in the top mini-dash for consistency */}

      <Card>
        <CardContent className="space-y-3 p-3 sm:p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou CPF..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              className="pl-10"
            />
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <SearchableSelect
              value={filterDelegation}
              onChange={(v) => { setFilterDelegation(v); setPage(0); }}
              options={delegations.map((d) => ({ value: d.id, label: d.name }))}
              placeholder="Delegação"
              searchPlaceholder="Pesquisar escola..."
              allLabel="Todas delegações"
              emptyText="Nenhuma escola encontrada."
            />

            <Select value={filterType} onValueChange={(v) => { setFilterType(v); setPage(0); }}>
              <SelectTrigger className="w-full min-w-0 text-sm">
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
              <SelectTrigger className="w-full min-w-0 text-sm">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="vinculada">✓ Vinculada</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Indicador de carregamento em segundo plano */}
      <BackgroundLoadingIndicator
        loaded={allParticipants.length}
        isLoading={isBackgroundLoading}
        label="participantes"
      />

      {/* Loading inicial */}
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
                <img src={p.photo_url} alt="" className="h-12 w-12 rounded-full object-cover shrink-0" />
              ) : (
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <User className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{p.full_name}</p>
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {p.delegation_name || "Sem delegação"}
                  {p.cpf ? ` • ${p.cpf}` : ""}
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">
                    {TYPE_LABELS[p.participant_type] ?? p.participant_type}
                  </Badge>
                  {p.ext_cred_code && (
                    <p className="text-[10px] font-mono text-muted-foreground truncate">{p.ext_cred_code}</p>
                  )}
                </div>
              </div>
              <div className="shrink-0 flex flex-col items-end gap-2">
                {p.ext_cred_id ? (
                  <Badge variant="default" className="text-[10px]">✓ Vinculada</Badge>
                ) : (
                  <Badge variant="secondary" className="text-[10px]">Pendente</Badge>
                )}
                <Button variant={p.ext_cred_id ? "outline" : "default"} size="sm" className="h-9 px-3 text-xs">
                  {p.ext_cred_id ? "Gerenciar" : "Vincular"}
                </Button>
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
        <SheetContent side="bottom" className="h-[88vh] overflow-y-auto rounded-t-xl px-4 pb-[calc(2rem+env(safe-area-inset-bottom))] sm:max-w-xl sm:mx-auto">
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
                  <div className="flex-1">
                    <p className="font-semibold text-base leading-tight">{selectedParticipant.full_name}</p>
                    <p className="text-sm text-muted-foreground">{selectedParticipant.delegation_name || "Sem delegação"}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-xs text-muted-foreground">{TYPE_LABELS[selectedParticipant.participant_type] ?? selectedParticipant.participant_type}</p>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-6 px-1.5 text-[10px] gap-1 text-primary hover:text-primary hover:bg-primary/5"
                        onClick={() => setEditDialogOpen(true)}
                      >
                        <Edit className="h-3 w-3" /> Editar
                      </Button>
                    </div>
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
                    <div className="rounded-md border border-border/70 bg-background px-3 py-2 text-xs text-muted-foreground">
                      Este código é o mesmo usado nos demais módulos externos.
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
                        onChange={(e) => setManualCode(normalizeCredentialCode(e.target.value))}
                        onKeyDown={(e) => e.key === "Enter" && handleManualSubmit()}
                        className="font-mono flex-1"
                        autoCapitalize="characters"
                      />
                      <Button
                        onClick={handleManualSubmit}
                        disabled={!manualCode.trim() || linkMutation.isPending}
                      >
                        <Check className="h-4 w-4 mr-1.5" />
                        Vincular
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">Dica: remova espaços e confira o código antes de confirmar.</p>
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

      <PessoaFormDialog 
        open={editDialogOpen} 
        onOpenChange={setEditDialogOpen} 
        participantId={selectedParticipant?.id} 
        defaultStageId={stageId}
      />
    </div>
  );
}
