import { useState, useEffect, useCallback, useMemo } from "react";
import { usePersistedState } from "@/hooks/usePersistedState";

import { useParams, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { TripInfoCard } from "@/components/pwa/transporte/TripInfoCard";
import { DelegationAlertBanner } from "@/components/pwa/transporte/DelegationAlertBanner";
import { ArrowLeft, Download, Search, Phone, X, ShieldAlert, Loader2, ScanLine } from "lucide-react";
import { toast } from "sonner";
import { PwaRefreshButton } from "@/components/pwa/PwaRefreshButton";

interface PassengerRow {
  id: string;
  status: string;
  boarded_at: string | null;
  is_manual: boolean;
  manual_name: string | null;
  manual_cpf: string | null;
  no_show: boolean;
  participant_id: string | null;
  full_name: string;
  cpf: string | null;
  photo_url: string | null;
  delegation_name: string | null;
  guardian_name: string | null;
  guardian_phone: string | null;
  coach_name: string | null;
  coach_phone: string | null;
}

interface TripInfo {
  routeName?: string;
  origin?: string | null;
  destination?: string | null;
  scheduledAt?: string | null;
  vehicleLabel?: string;
  vehiclePlate?: string;
}

export default function TransportePassageirosPage() {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();

  const [passengers, setPassengers] = useState<PassengerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [tripInfo, setTripInfo] = useState<TripInfo>({});

  const [search, setSearch] = usePersistedState("transporte_passageiros_search", "");
  const [statusFilter, setStatusFilter] = usePersistedState("transporte_passageiros_status", "all");
  const [delegationFilter, setDelegationFilter] = usePersistedState("transporte_passageiros_delegation", "all");


  const [confirmNoShow, setConfirmNoShow] = useState<PassengerRow | null>(null);
  const [contactModal, setContactModal] = useState<PassengerRow | null>(null);
  const [contactType, setContactType] = useState<"guardian" | "coach">("guardian");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [saving, setSaving] = useState(false);

  // Auth + trip info
  useEffect(() => {
    (async () => {
      if (!tripId) { setAuthorized(false); setLoading(false); return; }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/login", { replace: true }); return; }

      const { data: trip } = await supabase
        .from("transport_trips")
        .select("assigned_driver_id, scheduled_at, transport_routes(name, origin, destination), transport_vehicles(label, plate)")
        .eq("id", tripId)
        .single();

      if (!trip || (trip as any).assigned_driver_id !== session.user.id) {
        setAuthorized(false); setLoading(false); return;
      }
      setTripInfo({
        routeName: (trip as any).transport_routes?.name,
        origin: (trip as any).transport_routes?.origin,
        destination: (trip as any).transport_routes?.destination,
        scheduledAt: (trip as any).scheduled_at,
        vehicleLabel: (trip as any).transport_vehicles?.label,
        vehiclePlate: (trip as any).transport_vehicles?.plate,
      });
      setAuthorized(true);
    })();
  }, [tripId, navigate]);

  const fetchPassengers = useCallback(async () => {
    if (!tripId || authorized !== true) { setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("transport_passengers")
      .select("id, status, boarded_at, is_manual, manual_name, manual_cpf, no_show, participant_id, participant:participants(guardian_name, guardian_phone, coach_name, coach_phone, person:people(full_name, cpf, photo_url), delegation:delegations(school_name))")
      .eq("trip_id", tripId)
      .order("created_at");

    if (error) { console.error(error); toast.error("Erro ao carregar passageiros"); setLoading(false); return; }

    const list: PassengerRow[] = ((data as any) || []).map((p: any) => ({
      id: p.id,
      status: p.no_show ? "no_show" : p.status,
      boarded_at: p.boarded_at,
      is_manual: p.is_manual,
      manual_name: p.manual_name,
      manual_cpf: p.manual_cpf,
      no_show: p.no_show,
      participant_id: p.participant_id,
      full_name: p.is_manual ? (p.manual_name || "Manual") : (p.participant?.person?.full_name || "—"),
      cpf: p.is_manual ? p.manual_cpf : (p.participant?.person?.cpf || null),
      photo_url: p.participant?.person?.photo_url || null,
      delegation_name: p.participant?.delegation?.school_name || null,
      guardian_name: p.participant?.guardian_name || null,
      guardian_phone: p.participant?.guardian_phone || null,
      coach_name: p.participant?.coach_name || null,
      coach_phone: p.participant?.coach_phone || null,
    }));

    // Sort: boarded first, then pending, then no_show
    list.sort((a, b) => {
      const order = { boarded: 0, pending: 1, no_show: 2 };
      return (order[a.status as keyof typeof order] ?? 1) - (order[b.status as keyof typeof order] ?? 1);
    });

    setPassengers(list);
    setLoading(false);
  }, [tripId, authorized]);

  useEffect(() => {
    if (authorized === true) void fetchPassengers();
  }, [fetchPassengers, authorized]);

  // Derived
  const delegations = useMemo(() => {
    const set = new Set<string>();
    passengers.forEach(p => { if (p.delegation_name) set.add(p.delegation_name); });
    return Array.from(set).sort();
  }, [passengers]);

  const filtered = useMemo(() => {
    return passengers.filter(p => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (delegationFilter !== "all" && p.delegation_name !== delegationFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!p.full_name.toLowerCase().includes(q) && !(p.cpf || "").includes(q)) return false;
      }
      return true;
    });
  }, [passengers, search, statusFilter, delegationFilter]);

  const boardedCount = passengers.filter(p => p.status === "boarded").length;
  const pendingCount = passengers.filter(p => p.status !== "boarded" && p.status !== "no_show").length;

  const delegationCounts = useMemo(() => {
    const map = new Map<string, number>();
    passengers.forEach(p => {
      if (p.delegation_name) map.set(p.delegation_name, (map.get(p.delegation_name) || 0) + 1);
    });
    return Array.from(map.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  }, [passengers]);

  // Actions
  const handleNoShow = async (p: PassengerRow) => {
    setConfirmNoShow(null);
    const { error } = await supabase.from("transport_passengers").update({ no_show: true, status: "no_show" } as any).eq("id", p.id);
    if (error) { toast.error("Erro ao marcar não compareceu"); return; }
    toast.success(`${p.full_name} marcado como não compareceu`);
    await fetchPassengers();
  };

  const handleUndoNoShow = async (p: PassengerRow) => {
    const { error } = await supabase.from("transport_passengers").update({ no_show: false, status: "pending" } as any).eq("id", p.id);
    if (error) { toast.error("Erro ao desfazer"); return; }
    toast.success("Desfeito");
    await fetchPassengers();
  };

  const handleSaveContact = async () => {
    if (!contactModal?.participant_id || !contactName.trim() || !contactPhone.trim()) { toast.error("Preencha nome e telefone"); return; }
    setSaving(true);
    const update = contactType === "guardian"
      ? { guardian_name: contactName.trim(), guardian_phone: contactPhone.trim() }
      : { coach_name: contactName.trim(), coach_phone: contactPhone.trim() };
    const { error } = await supabase.from("participants").update(update).eq("id", contactModal.participant_id);
    setSaving(false);
    if (error) { toast.error("Erro ao salvar contato"); return; }
    toast.success("Contato salvo");
    setContactModal(null);
    setContactName(""); setContactPhone("");
    await fetchPassengers();
  };

  const exportCsv = () => {
    const header = "Nome,CPF,Delegação,Status,Horário Embarque,Responsável,Tel Responsável,Professor,Tel Professor";
    const rows = filtered.map(p => {
      const st = p.status === "boarded" ? "Embarcado" : p.status === "no_show" ? "Não Compareceu" : "Pendente";
      const hour = p.boarded_at ? format(new Date(p.boarded_at), "HH:mm") : "";
      return [p.full_name, p.cpf || "", p.delegation_name || "", st, hour, p.guardian_name || "", p.guardian_phone || "", p.coach_name || "", p.coach_phone || ""].map(v => `"${v}"`).join(",");
    });
    const csv = [header, ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const routeSlug = (tripInfo.routeName || "viagem").replace(/\s+/g, "-").toLowerCase();
    a.href = url;
    a.download = `transporte-passageiros-${routeSlug}-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado");
  };

  if (authorized === false) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <ShieldAlert className="h-16 w-16 text-destructive mb-4" />
        <h2 className="text-lg font-bold mb-2">Acesso Bloqueado</h2>
        <p className="text-muted-foreground text-sm mb-6">Apenas o motorista responsável pode acessar esta viagem.</p>
        <Button variant="outline" onClick={() => navigate("/pwa/transporte", { replace: true })}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
        </Button>
      </div>
    );
  }

  const initials = (name: string) => name.split(" ").slice(0, 2).map(w => w[0]?.toUpperCase()).join("");

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-surface text-text px-3 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <span className="font-heading font-semibold tracking-tight text-sm">Passageiros da Viagem</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <PwaRefreshButton />
            <span className="bg-[hsl(var(--module-accent)/0.16)] rounded-full px-2 py-1">
              <span className="font-bold text-green-300">{boardedCount}</span>
              <span className="opacity-70"> emb</span>
              <span className="mx-1 opacity-40">|</span>
              <span className="font-bold">{passengers.length}</span>
              <span className="opacity-70"> total</span>
              <span className="mx-1 opacity-40">|</span>
              <span className="font-bold text-yellow-300">{pendingCount}</span>
              <span className="opacity-70"> falta</span>
              {delegationCounts.length > 1 && (
                <>
                  <span className="mx-1 opacity-40">|</span>
                  <span className="font-bold text-orange-300">{delegationCounts.length}</span>
                  <span className="opacity-70"> deleg</span>
                </>
              )}
            </span>
          </div>
        </div>
        <div className="mt-2 flex gap-2">
          <Button size="sm" variant="module" className="h-8 text-xs flex-1" onClick={() => navigate(`/pwa/transporte/scan?tripId=${tripId}`)}>
            <ScanLine className="h-3.5 w-3.5 mr-1" /> Reabrir Scanner
          </Button>
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={exportCsv}>
            <Download className="h-3.5 w-3.5 mr-1" /> Exportar CSV
          </Button>
        </div>
      </header>

      <main className="p-3 max-w-4xl mx-auto space-y-3">
        {/* Delegation alert */}
        {!loading && <DelegationAlertBanner delegationCounts={delegationCounts} />}

        {/* Trip info */}
        {tripId && !loading && (
          <TripInfoCard routeName={tripInfo.routeName} origin={tripInfo.origin} destination={tripInfo.destination} scheduledAt={tripInfo.scheduledAt} vehicleLabel={tripInfo.vehicleLabel} vehiclePlate={tripInfo.vehiclePlate} />
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[140px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Nome ou CPF" value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-9 text-sm" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[130px] h-9 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="boarded">Embarcados</SelectItem>
              <SelectItem value="pending">Pendentes</SelectItem>
              <SelectItem value="no_show">Não Compareceu</SelectItem>
            </SelectContent>
          </Select>
          <Select value={delegationFilter} onValueChange={setDelegationFilter}>
            <SelectTrigger className="w-[150px] h-9 text-xs"><SelectValue placeholder="Delegação" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {delegations.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
          {(search || statusFilter !== "all" || delegationFilter !== "all") && (
            <Button variant="ghost" size="sm" className="h-9 text-xs" onClick={() => { setSearch(""); setStatusFilter("all"); setDelegationFilter("all"); }}>
              <X className="h-3.5 w-3.5 mr-1" /> Limpar
            </Button>
          )}
        </div>

        {/* Loading */}
        {loading && <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">{[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-36 w-full" />)}</div>}

        {/* Empty */}
        {!loading && filtered.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            {passengers.length === 0 ? "Nenhum passageiro cadastrado nesta viagem" : "Nenhum passageiro encontrado com os filtros atuais"}
          </div>
        )}

        {/* Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {filtered.map(p => {
            const statusColor = p.status === "boarded" ? "success" : p.status === "no_show" ? "destructive" : "warning";
            const statusLabel = p.status === "boarded" ? `✓ Embarcado ${p.boarded_at ? format(new Date(p.boarded_at), "HH:mm") : ""}` : p.status === "no_show" ? "✗ Não Compareceu" : "⏳ Pendente";

            return (
              <Card key={p.id} className={p.status === "boarded" ? "border-[hsl(var(--module-accent)/0.45)] bg-[hsl(var(--module-accent)/0.09)]" : p.status === "no_show" ? "border-destructive/30 bg-destructive/5" : ""}>
                <CardContent className="p-3 space-y-2">
                  {/* Header */}
                  <div className="flex items-center gap-2">
                    {p.photo_url ? (
                      <img src={p.photo_url} alt="" className="h-9 w-9 rounded-full object-cover" />
                    ) : (
                      <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">{initials(p.full_name)}</div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{p.full_name}</p>
                      {p.delegation_name && <p className="text-[10px] text-muted-foreground truncate">{p.delegation_name}</p>}
                    </div>
                  </div>

                  {/* Badges */}
                  <div className="flex flex-wrap gap-1">
                    <Badge variant={statusColor} className="text-[10px]">{statusLabel}</Badge>
                    {p.is_manual && <Badge variant="module" className="text-[10px]">Manual</Badge>}
                  </div>

                  {/* Phones */}
                  <div className="space-y-1">
                    {p.guardian_phone ? (
                      <a href={`tel:${p.guardian_phone}`} className="flex items-center gap-1 text-[11px] text-green-600 hover:underline">
                        <Phone className="h-3 w-3" /> Responsável: {p.guardian_phone}
                      </a>
                    ) : p.coach_phone ? (
                      <a href={`tel:${p.coach_phone}`} className="flex items-center gap-1 text-[11px] text-yellow-600 hover:underline">
                        <Phone className="h-3 w-3" /> Professor: {p.coach_phone}
                      </a>
                    ) : (
                      <button onClick={() => { setContactModal(p); setContactType("guardian"); setContactName(""); setContactPhone(""); }} className="flex items-center gap-1 text-[11px] text-destructive hover:underline">
                        <Phone className="h-3 w-3" /> ⚠️ Sem contato — Cadastrar
                      </button>
                    )}
                  </div>

                  {/* Actions */}
                  {p.status !== "boarded" && p.status !== "no_show" && (
                    <Button variant="outline" size="sm" className="w-full h-7 text-[10px]" onClick={() => setConfirmNoShow(p)}>
                      Marcar Não Compareceu
                    </Button>
                  )}
                  {p.status === "no_show" && (
                    <Button variant="ghost" size="sm" className="w-full h-7 text-[10px]" onClick={() => handleUndoNoShow(p)}>
                      Desfazer
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </main>

      {/* Confirm no-show dialog */}
      <Dialog open={!!confirmNoShow} onOpenChange={() => setConfirmNoShow(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="text-base">Confirmar Não Compareceu</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Confirmar que <strong>{confirmNoShow?.full_name}</strong> não compareceu ao embarque?</p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmNoShow(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => confirmNoShow && handleNoShow(confirmNoShow)}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Contact modal */}
      <Dialog open={!!contactModal} onOpenChange={() => setContactModal(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="text-base">Cadastrar Contato</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground mb-2">{contactModal?.full_name}</p>
          <div className="space-y-3">
            <RadioGroup value={contactType} onValueChange={(v) => setContactType(v as "guardian" | "coach")} className="flex gap-4">
              <div className="flex items-center gap-1.5"><RadioGroupItem value="guardian" id="rg" /><Label htmlFor="rg" className="text-xs">Responsável Legal</Label></div>
              <div className="flex items-center gap-1.5"><RadioGroupItem value="coach" id="rc" /><Label htmlFor="rc" className="text-xs">Professor/Técnico</Label></div>
            </RadioGroup>
            <Input placeholder="Nome" value={contactName} onChange={e => setContactName(e.target.value)} className="h-9 text-sm" />
            <Input placeholder="Telefone" value={contactPhone} onChange={e => setContactPhone(e.target.value)} className="h-9 text-sm" type="tel" />
          </div>
          <DialogFooter>
            <Button onClick={handleSaveContact} disabled={saving} className="w-full">
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
