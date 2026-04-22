import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PwaHeader } from "@/components/pwa/PwaHeader";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import {
  UtensilsCrossed, Search, Phone, Clock, Download, X, AlertTriangle, List,
} from "lucide-react";

interface MealWindow {
  id: string;
  label: string | null;
  start_time: string;
  end_time: string;
  service_date: string;
  meal_type_name: string;
}

interface Consumption {
  id: string;
  consumed_at: string;
  participant_id: string;
  meal_window_id: string;
  full_name: string;
  cpf: string | null;
  photo_url: string | null;
  guardian_name: string | null;
  guardian_phone: string | null;
  coach_name: string | null;
  coach_phone: string | null;
  delegation_name: string | null;
  delegation_id: string | null;
  participant_type: string | null;
  window_label: string;
  meal_type_name: string;
}

export default function AlimentacaoListaConsumosPage() {
  const [consumptions, setConsumptions] = useState<Consumption[]>([]);
  const [windows, setWindows] = useState<MealWindow[]>([]);
  const [loading, setLoading] = useState(true);
  const [windowFilter, setWindowFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [delegationFilter, setDelegationFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [contactModal, setContactModal] = useState<Consumption | null>(null);
  const [contactType, setContactType] = useState<"guardian" | "coach">("guardian");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [saving, setSaving] = useState(false);

  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);

    const [windowsRes, consumptionsRes] = await Promise.all([
      supabase
        .from("meal_windows")
        .select("id, label, start_time, end_time, service_date, meal_type_id, meal_types!inner(name)")
        .eq("service_date", today)
        .order("start_time"),
      supabase
        .from("meal_consumptions")
        .select(`
          id, consumed_at, participant_id, meal_window_id,
          participants!inner(
            id, delegation_id, guardian_name, guardian_phone, coach_name, coach_phone, role,
            people!inner(full_name, cpf, photo_url),
            delegations(institution_id, institutions(name))
          ),
          meal_windows!inner(label, start_time, end_time, service_date, meal_types!inner(name))
        `)
        .gte("consumed_at", today + "T00:00:00")
        .lte("consumed_at", today + "T23:59:59")
        .order("consumed_at", { ascending: false }),
    ]);

    if (windowsRes.data) {
      setWindows(windowsRes.data.map((w: any) => ({
        id: w.id,
        label: w.label,
        start_time: w.start_time,
        end_time: w.end_time,
        service_date: w.service_date,
        meal_type_name: w.meal_types?.name || "",
      })));
    }

    if (consumptionsRes.data) {
      setConsumptions((consumptionsRes.data as any[]).map((c: any) => ({
        id: c.id,
        consumed_at: c.consumed_at,
        participant_id: c.participant_id,
        meal_window_id: c.meal_window_id,
        full_name: c.participants?.people?.full_name || "",
        cpf: c.participants?.people?.cpf || null,
        photo_url: c.participants?.people?.photo_url || null,
        guardian_name: c.participants?.guardian_name,
        guardian_phone: c.participants?.guardian_phone,
        coach_name: c.participants?.coach_name,
        coach_phone: c.participants?.coach_phone,
        delegation_name: c.participants?.delegations?.institutions?.name || null,
        delegation_id: c.participants?.delegation_id,
        participant_type: c.participants?.role || null,
        window_label: c.meal_windows?.label || `${fmtTime(c.meal_windows?.start_time)}-${fmtTime(c.meal_windows?.end_time)}`,
        meal_type_name: c.meal_windows?.meal_types?.name || "",
      })));
    }

    setLoading(false);
  }

  function fmtTime(t: string | null) {
    if (!t) return "";
    return t.slice(0, 5);
  }

  const now = new Date().toISOString();
  const activeWindowId = windows.find(w => w.start_time <= now && w.end_time >= now)?.id;

  const delegations = useMemo(() => {
    const m = new Map<string, string>();
    consumptions.forEach(c => { if (c.delegation_id && c.delegation_name) m.set(c.delegation_id, c.delegation_name); });
    return Array.from(m.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [consumptions]);

  // Detect duplicates: participants appearing >1 time in selected window (or all windows)
  const duplicateParticipantIds = useMemo(() => {
    const source = windowFilter !== "all"
      ? consumptions.filter(c => c.meal_window_id === windowFilter)
      : consumptions;
    const countMap = new Map<string, number>();
    source.forEach(c => countMap.set(c.participant_id, (countMap.get(c.participant_id) || 0) + 1));
    const dups = new Set<string>();
    countMap.forEach((count, pid) => { if (count > 1) dups.add(pid); });
    return dups;
  }, [consumptions, windowFilter]);

  const filtered = useMemo(() => {
    return consumptions.filter(c => {
      if (windowFilter !== "all" && c.meal_window_id !== windowFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!c.full_name.toLowerCase().includes(q) && !(c.cpf || "").includes(q)) return false;
      }
      if (delegationFilter !== "all" && c.delegation_id !== delegationFilter) return false;
      if (typeFilter !== "all" && c.participant_type !== typeFilter) return false;
      return true;
    });
  }, [consumptions, windowFilter, search, delegationFilter, typeFilter]);

  function clearFilters() {
    setSearch("");
    setWindowFilter("all");
    setDelegationFilter("all");
    setTypeFilter("all");
  }

  function getInitials(name: string) {
    return name.split(" ").filter(Boolean).slice(0, 2).map(n => n[0]).join("").toUpperCase();
  }

  function formatPhone(p: string) {
    const d = p.replace(/\D/g, "");
    if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
    if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return p;
  }

  function phoneMask(val: string) {
    const d = val.replace(/\D/g, "").slice(0, 11);
    if (d.length <= 2) return d;
    if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  }

  function exportCSV() {
    const header = "Nome,CPF,Delegação,Tipo,Janela,Horário Consumo,Responsável,Tel Responsável,Professor,Tel Professor";
    const rows = filtered.map(c =>
      [c.full_name, c.cpf || "", c.delegation_name || "", c.participant_type || "",
        `${c.meal_type_name} ${c.window_label}`,
        new Date(c.consumed_at).toLocaleString("pt-BR"),
        c.guardian_name || "", c.guardian_phone || "", c.coach_name || "", c.coach_phone || ""
      ].map(v => `"${v}"`).join(",")
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const windowName = windowFilter !== "all" ? windows.find(w => w.id === windowFilter)?.meal_type_name || "janela" : "todas";
    a.download = `alimentacao-consumos-${windowName}-${today}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function saveContact() {
    if (!contactModal) return;
    if (contactName.trim().length < 2) { toast.error("Nome obrigatório (mín. 2 caracteres)"); return; }
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
    setConsumptions(prev => prev.map(c =>
      c.participant_id === contactModal.participant_id ? { ...c, ...updateData } : c
    ));
    setContactModal(null);
    setContactName("");
    setContactPhone("");
    setSaving(false);
  }

  return (
    <div className="min-h-screen bg-background">
      <PwaHeader title="Consumos Registrados" icon={List} backTo="/pwa/alimentacao" />

      <main className="p-4 max-w-4xl mx-auto space-y-4">
        {/* Window selector + counter + export */}
        <div className="flex items-center gap-2">
          <Select value={windowFilter} onValueChange={setWindowFilter}>
            <SelectTrigger className="flex-1 text-xs h-9">
              <SelectValue placeholder="Janela" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Janelas</SelectItem>
              {windows.map(w => (
                <SelectItem key={w.id} value={w.id}>
                  {w.meal_type_name} {fmtTime(w.start_time)}-{fmtTime(w.end_time)}
                  {w.id === activeWindowId ? " 🟢" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="shrink-0" onClick={exportCSV}>
            <Download className="h-4 w-4 mr-1" /> CSV
          </Button>
        </div>

        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{filtered.length}</span> consumos registrados
        </p>

        {duplicateParticipantIds.size > 0 && (
          <div className="rounded-lg border border-yellow-500/40 bg-yellow-50 dark:bg-yellow-950/30 px-3 py-2.5 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 shrink-0" />
            <span className="text-xs text-yellow-800 dark:text-yellow-200">
              ℹ️ <span className="font-semibold">{duplicateParticipantIds.size} participante{duplicateParticipantIds.size > 1 ? "s" : ""}</span>{" "}
              consumiu mais de uma vez {windowFilter !== "all" ? "nesta janela" : "hoje"}
            </span>
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome ou CPF..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>

        {/* Filters */}
        <div className="grid grid-cols-3 gap-2">
          <Select value={delegationFilter} onValueChange={setDelegationFilter}>
            <SelectTrigger className="text-xs h-9"><SelectValue placeholder="Delegação" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas Delegações</SelectItem>
              {delegations.map(([id, label]) => <SelectItem key={id} value={id}>{label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="text-xs h-9"><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="atleta">Atleta</SelectItem>
              <SelectItem value="tecnico">Técnico</SelectItem>
              <SelectItem value="arbitro">Árbitro</SelectItem>
              <SelectItem value="outro">Outro</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="ghost" size="sm" className="h-9 text-xs" onClick={clearFilters}>
            <X className="h-3 w-3 mr-1" /> Limpar
          </Button>
        </div>

        {/* Loading / Empty / List */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-36 w-full rounded-xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <UtensilsCrossed className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p>Nenhum consumo registrado nesta janela.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map(c => (
              <Card key={c.id} className="overflow-hidden">
                <CardContent className="p-3 space-y-2">
                  {/* Header */}
                  <div className="flex items-center gap-2">
                    <Avatar className="h-9 w-9">
                      {c.photo_url && <AvatarImage src={c.photo_url} />}
                      <AvatarFallback className="text-xs bg-[hsl(var(--module-accent)/0.15)] text-[hsl(var(--module-accent))]">{getInitials(c.full_name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{c.full_name}</p>
                      <div className="flex items-center gap-1">
                        {c.delegation_name && <p className="text-xs text-muted-foreground truncate">{c.delegation_name}</p>}
                        {duplicateParticipantIds.has(c.participant_id) && (
                          <Badge variant="warning" className="text-[10px] px-1 shrink-0">⚠️ Duplicado</Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Body */}
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 shrink-0" />
                      <span>Consumido às {new Date(c.consumed_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <UtensilsCrossed className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{c.meal_type_name} — {c.window_label}</span>
                    </div>
                  </div>

                  {/* Phone badges */}
                  <div className="pt-1 border-t border-border">
                    {c.guardian_phone ? (
                      <a href={`tel:${c.guardian_phone}`} className="flex items-center gap-1.5 text-xs">
                        <Badge variant="success" className="text-[10px] px-1.5">Responsável</Badge>
                        <Phone className="h-3 w-3 text-success" />
                        <span className="text-foreground">{formatPhone(c.guardian_phone)}</span>
                      </a>
                    ) : c.coach_phone ? (
                      <a href={`tel:${c.coach_phone}`} className="flex items-center gap-1.5 text-xs">
                        <Badge variant="warning" className="text-[10px] px-1.5">Professor</Badge>
                        <Phone className="h-3 w-3 text-warning" />
                        <span className="text-foreground">{formatPhone(c.coach_phone)}</span>
                      </a>
                    ) : (
                      <button onClick={() => { setContactModal(c); setContactType("guardian"); setContactName(""); setContactPhone(""); }} className="flex items-center gap-1.5 text-xs text-destructive">
                        <Badge variant="destructive" className="text-[10px] px-1.5">⚠️ Sem contato</Badge>
                        <span className="underline">Cadastrar</span>
                      </button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Contact Modal */}
      <Dialog open={!!contactModal} onOpenChange={open => { if (!open) setContactModal(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Cadastrar Contato</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Participante: <strong>{contactModal?.full_name}</strong></p>
            <RadioGroup value={contactType} onValueChange={(v: any) => setContactType(v)} className="flex gap-4">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="guardian" id="ct-guardian" />
                <Label htmlFor="ct-guardian">Responsável Legal</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="coach" id="ct-coach" />
                <Label htmlFor="ct-coach">Professor/Técnico</Label>
              </div>
            </RadioGroup>
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={contactName} onChange={e => setContactName(e.target.value)} placeholder="Nome completo" />
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input value={contactPhone} onChange={e => setContactPhone(phoneMask(e.target.value))} placeholder="(00) 00000-0000" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setContactModal(null)}>Cancelar</Button>
            <Button variant="module" onClick={saveContact} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
