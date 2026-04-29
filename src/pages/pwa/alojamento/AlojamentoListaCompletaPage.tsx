import { useEffect, useState, useMemo } from "react";
import { usePersistedState } from "@/hooks/usePersistedState";

import { supabase } from "@/integrations/supabase/client";
import PwaLayout from "@/components/pwa/PwaLayout";
import { useActiveEventId } from "@/contexts/EventContext";
import { useActiveStageId } from "@/contexts/StageContext";
// AlojamentoNavHeader removed for consistency
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Users, Building, Search, Phone, Clock, Download, X, DoorOpen, User, PhoneCall, AlertTriangle, Filter, LayoutDashboard,
} from "lucide-react";
import { formatPhone, phoneMask } from "@/lib/phoneUtils";
import { downloadCsv } from "@/lib/reportExport";
import type { Guest } from "@/types/alojamento";

export default function AlojamentoListaCompletaPage() {
  const eventId = useActiveEventId();
  const stageId = useActiveStageId();
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = usePersistedState("alojamento_lista_search", "");
  const [unitFilter, setUnitFilter] = usePersistedState("alojamento_lista_unit", "all");
  const [delegationFilter, setDelegationFilter] = usePersistedState("alojamento_lista_delegation", "all");
  const [statusFilter, setStatusFilter] = usePersistedState("alojamento_lista_status", "all");

  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null);
  const [contactModal, setContactModal] = useState<Guest | null>(null);
  const [contactType, setContactType] = useState<"guardian" | "coach">("guardian");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (eventId) loadGuests();
  }, [eventId, stageId]);

  async function loadGuests() {
    setLoading(true);
    let query = supabase
      .from("lodging_occupancies")
      .select(`
        id,
        participant_id,
        status,
        checked_in_at,
        checked_out_at,
        unit_id,
        lodging_units!unit_id!inner(name, location_id, lodging_locations!inner(name, event_id, event_stage_id)),
        participants!inner(
          id, delegation_id, guardian_name, guardian_phone, coach_name, coach_phone,
          person_id, people!inner(full_name, cpf, birth_date, photo_url, gender),
          delegations!inner(institution_id, institutions!inner(name))
        )
      `)
      .eq("lodging_units.lodging_locations.event_id", eventId);

    if (stageId) {
      query = query.eq("lodging_units.lodging_locations.event_stage_id", stageId);
    }

    const { data, error } = await query as any;

    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }

    const mapped: Guest[] = (data || []).map((r: any) => ({
      occupancy_id: r.id,
      participant_id: r.participant_id,
      status: r.status,
      checked_in_at: r.checked_in_at,
      checked_out_at: r.checked_out_at,
      unit_name: r.lodging_units?.name || "",
      unit_id: r.unit_id,
      location_name: r.lodging_units?.lodging_locations?.name || "",
      full_name: r.participants?.people?.full_name || "",
      cpf: r.participants?.people?.cpf,
      birth_date: r.participants?.people?.birth_date,
      photo_url: r.participants?.people?.photo_url,
      gender: r.participants?.people?.gender || "",
      guardian_name: r.participants?.guardian_name,
      guardian_phone: r.participants?.guardian_phone,
      coach_name: r.participants?.coach_name,
      coach_phone: r.participants?.coach_phone,
      delegation_name: r.participants?.delegations?.institutions?.name || null,
      delegation_id: r.participants?.delegation_id,
    }));

    setGuests(mapped);
    setLoading(false);
  }

  const units = useMemo(() => {
    const m = new Map<string, string>();
    guests.forEach(g => m.set(g.unit_id, `${g.unit_name} - ${g.location_name}`));
    return Array.from(m.entries());
  }, [guests]);

  const delegations = useMemo(() => {
    const m = new Map<string, string>();
    guests.forEach(g => { if (g.delegation_id && g.delegation_name) m.set(g.delegation_id, g.delegation_name); });
    return Array.from(m.entries());
  }, [guests]);

  const filtered = useMemo(() => {
    return guests.filter(g => {
      if (search) {
        const q = search.toLowerCase();
        const matchesName = g.full_name.toLowerCase().includes(q);
        const matchesCpf = (g.cpf || "").includes(q);
        const matchesDelegation = (g.delegation_name || "").toLowerCase().includes(q);
        const matchesUnit = (g.unit_name || "").toLowerCase().includes(q);
        if (!matchesName && !matchesCpf && !matchesDelegation && !matchesUnit) return false;
      }
      if (unitFilter !== "all" && g.unit_id !== unitFilter) return false;
      if (delegationFilter !== "all" && g.delegation_id !== delegationFilter) return false;
      if (statusFilter === "checkin" && !g.checked_in_at) return false;
      if (statusFilter === "checkout" && !g.checked_out_at) return false;
      if (statusFilter === "hospedado" && (g.checked_out_at || !g.checked_in_at)) return false;
      return true;
    });
  }, [guests, search, unitFilter, delegationFilter, statusFilter]);

  const occupiedUnits = useMemo(() => new Set(filtered.map(g => g.unit_id)).size, [filtered]);

  function clearFilters() {
    setSearch("");
    setUnitFilter("all");
    setDelegationFilter("all");
    setStatusFilter("all");
  }

  function exportCSV() {
    const header = "Nome,CPF,Delegação,Quarto,Unidade,Check-in,Check-out,Responsável,Tel Responsável,Professor,Tel Professor";
    const rows = filtered.map(g =>
      [g.full_name, g.cpf || "", g.delegation_name || "", g.unit_name, g.location_name,
        g.checked_in_at ? new Date(g.checked_in_at).toLocaleString("pt-BR") : "",
        g.checked_out_at ? new Date(g.checked_out_at).toLocaleString("pt-BR") : "",
        g.guardian_name || "", g.guardian_phone || "", g.coach_name || "", g.coach_phone || ""
      ].map(v => `"${v}"`).join(",")
    );
    downloadCsv([header, ...rows], `alojamento-hospedes-${new Date().toISOString().slice(0, 10)}.csv`);
  }

  async function saveContact() {
    if (!contactModal) return;
    if (contactName.trim().length < 2) { toast.error("Nome obrigatório"); return; }
    const digits = contactPhone.replace(/\D/g, "");
    if (digits.length < 10) { toast.error("Telefone inválido"); return; }

    setSaving(true);
    const updateData = contactType === "guardian"
      ? { guardian_name: contactName.trim(), guardian_phone: digits }
      : { coach_name: contactName.trim(), coach_phone: digits };

    const { error } = await supabase
      .from("participants")
      .update(updateData as any)
      .eq("id", contactModal.participant_id);

    if (error) { toast.error("Erro ao salvar contato"); setSaving(false); return; }

    toast.success("Contato cadastrado!");
    setGuests(prev => prev.map(g =>
      g.participant_id === contactModal.participant_id
        ? { ...g, ...updateData }
        : g
    ));
    if (selectedGuest?.participant_id === contactModal.participant_id) {
      setSelectedGuest(prev => prev ? { ...prev, ...updateData } : prev);
    }
    setContactModal(null);
    setContactName("");
    setContactPhone("");
    setSaving(false);
  }

  function getInitials(name: string) {
    return name.split(" ").filter(Boolean).slice(0, 2).map(n => n[0]).join("").toUpperCase();
  }

  return (
    <PwaLayout backTo="/pwa/alojamento" moduleTitle="Lista de Hóspedes">
      <div className="p-4 max-w-4xl mx-auto space-y-4">
        {/* Counter + Export */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{filtered.length}</span> hóspedes | <span className="font-semibold text-foreground">{occupiedUnits}</span> quartos ocupados
          </p>
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="h-4 w-4 mr-1" /> Exportar
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou CPF..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Filters */}
        <div className="grid grid-cols-2 gap-2">
          <Select value={unitFilter} onValueChange={setUnitFilter}>
            <SelectTrigger className="text-xs h-9"><SelectValue placeholder="Unidade" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas Unidades</SelectItem>
              {units.map(([id, label]) => <SelectItem key={id} value={id}>{label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={delegationFilter} onValueChange={setDelegationFilter}>
            <SelectTrigger className="text-xs h-9"><SelectValue placeholder="Delegação" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas Delegações</SelectItem>
              {delegations.map(([id, label]) => <SelectItem key={id} value={id}>{label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="text-xs h-9"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Status</SelectItem>
              <SelectItem value="hospedado">Hospedado atualmente</SelectItem>
              <SelectItem value="checkin">Check-in feito</SelectItem>
              <SelectItem value="checkout">Check-out feito</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="ghost" size="sm" className="h-9 text-xs" onClick={clearFilters}>
            <X className="h-3 w-3 mr-1" /> Limpar
          </Button>
        </div>

        {/* Loading / Empty / List */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-40 w-full rounded-xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p>Nenhum hóspede encontrado com os filtros aplicados.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map(g => (
              <Card key={g.occupancy_id} className="overflow-hidden">
                <CardContent className="p-3 space-y-2">
                  {/* Header */}
                  <div className="flex items-center gap-2">
                    <Avatar className="h-9 w-9">
                      {g.photo_url && <AvatarImage src={g.photo_url} />}
                      <AvatarFallback className="text-xs bg-[hsl(var(--module-accent)/0.15)] text-[hsl(var(--module-accent))]">{getInitials(g.full_name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{g.full_name}</p>
                      {g.delegation_name && <p className="text-xs text-muted-foreground truncate">{g.delegation_name}</p>}
                    </div>
                  </div>

                  {/* Body */}
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <DoorOpen className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{g.unit_name} - {g.location_name}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 shrink-0" />
                      <span>Check-in: {g.checked_in_at ? new Date(g.checked_in_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "Pendente"}</span>
                    </div>
                    {g.checked_out_at && (
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 shrink-0" />
                        <span>Check-out: {new Date(g.checked_out_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                      </div>
                    )}
                  </div>

                  {/* Phone badges */}
                  <div className="pt-1 border-t border-border">
                    {g.guardian_phone ? (
                      <a href={`tel:${g.guardian_phone}`} className="flex items-center gap-1.5 text-xs">
                        <Badge variant="success" className="text-[10px] px-1.5">Responsável</Badge>
                        <Phone className="h-3 w-3 text-success" />
                        <span className="text-foreground">{formatPhone(g.guardian_phone)}</span>
                      </a>
                    ) : g.coach_phone ? (
                      <a href={`tel:${g.coach_phone}`} className="flex items-center gap-1.5 text-xs">
                        <Badge variant="warning" className="text-[10px] px-1.5">Professor</Badge>
                        <Phone className="h-3 w-3 text-warning" />
                        <span className="text-foreground">{formatPhone(g.coach_phone)}</span>
                      </a>
                    ) : (
                      <button onClick={() => { setContactModal(g); setContactType("guardian"); }} className="flex items-center gap-1.5 text-xs text-destructive">
                        <Badge variant="destructive" className="text-[10px] px-1.5">⚠️ Sem contato</Badge>
                        <span className="underline">Cadastrar</span>
                      </button>
                    )}
                  </div>

                  <Button variant="ghost" size="sm" className="w-full text-xs h-8" onClick={() => setSelectedGuest(g)}>
                    Ver Detalhes
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Detail Drawer */}
      <Drawer open={!!selectedGuest} onOpenChange={open => { if (!open) setSelectedGuest(null); }}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader>
            <DrawerTitle>{selectedGuest?.full_name}</DrawerTitle>
            <DrawerDescription>{selectedGuest?.delegation_name || "Sem delegação"}</DrawerDescription>
          </DrawerHeader>
          {selectedGuest && (
            <div className="px-4 pb-6 space-y-4 overflow-y-auto">
              {/* Dados Pessoais */}
              <section className="space-y-1">
                <h4 className="text-sm font-semibold flex items-center gap-1.5"><User className="h-4 w-4" /> Dados Pessoais</h4>
                <div className="flex items-center gap-3">
                  <Avatar className="h-14 w-14">
                    {selectedGuest.photo_url && <AvatarImage src={selectedGuest.photo_url} />}
                    <AvatarFallback className="bg-[hsl(var(--module-accent)/0.15)] text-[hsl(var(--module-accent))]">{getInitials(selectedGuest.full_name)}</AvatarFallback>
                  </Avatar>
                  <div className="text-sm space-y-0.5">
                    <p className="font-medium">{selectedGuest.full_name}</p>
                    {selectedGuest.cpf && <p className="text-muted-foreground">CPF: {selectedGuest.cpf}</p>}
                    {selectedGuest.birth_date && <p className="text-muted-foreground">Nasc: {new Date(selectedGuest.birth_date + "T12:00:00").toLocaleDateString("pt-BR")}</p>}
                  </div>
                </div>
              </section>

              {/* Alojamento */}
              <section className="space-y-1">
                <h4 className="text-sm font-semibold flex items-center gap-1.5"><Building className="h-4 w-4" /> Alojamento</h4>
                <div className="text-sm text-muted-foreground space-y-0.5">
                  <p>{selectedGuest.unit_name} — {selectedGuest.location_name}</p>
                  <p>Check-in: {selectedGuest.checked_in_at ? new Date(selectedGuest.checked_in_at).toLocaleString("pt-BR") : "Pendente"}</p>
                  <p>Check-out: {selectedGuest.checked_out_at ? new Date(selectedGuest.checked_out_at).toLocaleString("pt-BR") : "Ainda hospedado"}</p>
                </div>
              </section>

              {/* Contatos */}
              <section className="space-y-2">
                <h4 className="text-sm font-semibold flex items-center gap-1.5"><PhoneCall className="h-4 w-4" /> Contatos</h4>
                {selectedGuest.guardian_phone ? (
                  <div className="flex items-center justify-between bg-success/10 rounded-lg p-2">
                    <div className="text-sm">
                      <Badge variant="success" className="mb-1">Responsável</Badge>
                      <p className="font-medium">{selectedGuest.guardian_name || "—"}</p>
                    </div>
                    <a href={`tel:${selectedGuest.guardian_phone}`} className="inline-flex items-center gap-1 bg-success text-white rounded-lg px-3 py-2 text-sm font-medium">
                      <Phone className="h-4 w-4" /> {formatPhone(selectedGuest.guardian_phone)}
                    </a>
                  </div>
                ) : null}
                {selectedGuest.coach_phone ? (
                  <div className="flex items-center justify-between bg-warning/10 rounded-lg p-2">
                    <div className="text-sm">
                      <Badge variant="warning" className="mb-1">Professor</Badge>
                      <p className="font-medium">{selectedGuest.coach_name || "—"}</p>
                    </div>
                    <a href={`tel:${selectedGuest.coach_phone}`} className="inline-flex items-center gap-1 bg-warning text-white rounded-lg px-3 py-2 text-sm font-medium">
                      <Phone className="h-4 w-4" /> {formatPhone(selectedGuest.coach_phone)}
                    </a>
                  </div>
                ) : null}
                {!selectedGuest.guardian_phone && !selectedGuest.coach_phone && (
                  <div className="bg-destructive/10 rounded-lg p-3 text-center">
                    <AlertTriangle className="h-5 w-5 mx-auto text-destructive mb-1" />
                    <p className="text-sm text-destructive font-medium mb-2">Nenhum contato cadastrado</p>
                    <Button size="sm" variant="module" onClick={() => { setContactModal(selectedGuest); setContactType("guardian"); }}>
                      Cadastrar Contato
                    </Button>
                  </div>
                )}
              </section>
            </div>
          )}
        </DrawerContent>
      </Drawer>

      {/* Contact Modal */}
      <Dialog open={!!contactModal} onOpenChange={open => { if (!open) setContactModal(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Cadastrar Contato</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <RadioGroup value={contactType} onValueChange={v => setContactType(v as any)} className="flex gap-4">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="guardian" id="rg" />
                <Label htmlFor="rg">Responsável Legal</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="coach" id="rc" />
                <Label htmlFor="rc">Professor/Técnico</Label>
              </div>
            </RadioGroup>
            <div>
              <Label>Nome *</Label>
              <Input value={contactName} onChange={e => setContactName(e.target.value)} placeholder="Nome completo" />
            </div>
            <div>
              <Label>Telefone *</Label>
              <Input value={contactPhone} onChange={e => setContactPhone(phoneMask(e.target.value))} placeholder="(99) 99999-9999" />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setContactModal(null)}>Cancelar</Button>
            <Button variant="module" onClick={saveContact} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PwaLayout>
  );
}
