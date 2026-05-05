import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useStageScope } from "@/hooks/useStageScope";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Building, ChevronDown, ChevronRight, Users, Search, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface OccupancyRow {
  id: string;
  status: string;
  unit_id: string | null;
  checked_in_unit_id: string | null;
  participant_id: string;
  participants: {
    id: string;
    delegation_id: string;
    participant_type: string;
    delegations: {
      id: string;
      institution_id: string | null;
      institutions: { name: string | null } | null;
    } | null;
    people: { full_name: string | null; gender: string | null } | null;
  } | null;
  unit: {
    id: string;
    name: string;
    location_id: string;
    gender_restriction: string | null;
    capacity: number | null;
    lodging_locations: { name: string } | null;
  } | null;
  checked_in_unit: {
    id: string;
    name: string;
    lodging_locations: { name: string } | null;
  } | null;
}

interface UnitGroup {
  unitId: string;
  unitName: string;
  locationName: string;
  occupancies: { full_name: string; gender: string | null; status: string; participant_type: string }[];
}

interface DelegationGroup {
  delegationId: string;
  schoolName: string;
  totalAllocated: number;
  totalCheckedIn: number;
  totalMale: number;
  totalFemale: number;
  units: Map<string, UnitGroup>;
}

const STATUS_BADGE: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  checked_in: "default",
  allocated: "secondary",
  planned: "outline",
};

const STATUS_LABEL: Record<string, string> = {
  checked_in: "alojado",
  allocated: "alocado",
  planned: "planejado",
  checked_out: "saiu",
  cancelled: "cancelado",
};

export default function AlojamentoEscolasPage() {
  const { stageId, isStageScoped } = useStageScope();
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { data: occupancies = [], isLoading } = useQuery({
    queryKey: ["alojamento_escolas", stageId],
    enabled: !!stageId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("lodging_occupancies") as any)
        .select(`
          id, status, unit_id, checked_in_unit_id, participant_id,
          participants(
            id, delegation_id, participant_type,
            delegations(id, institution_id, institutions(name)),
            people(full_name, gender)
          ),
          unit:lodging_units!unit_id(
            id, name, location_id, gender_restriction, capacity,
            lodging_locations(name)
          ),
          checked_in_unit:lodging_units!checked_in_unit_id(
            id, name, lodging_locations(name)
          )
        `)
        .eq("event_stage_id", stageId)
        .in("status", ["planned", "allocated", "checked_in"]);
      if (error) throw error;
      return (data ?? []) as unknown as OccupancyRow[];
    },
  });

  const groups = useMemo<DelegationGroup[]>(() => {
    const map = new Map<string, DelegationGroup>();
    for (const o of occupancies) {
      const p = o.participants;
      if (!p) continue;
      const delId = p.delegation_id;
      const schoolName = p.delegations?.institutions?.name ?? "Sem instituição";
      const gender = p.people?.gender;
      const fullName = p.people?.full_name ?? "(sem nome)";
      // Quarto exibido: prioriza checked_in_unit (real) → cai para unit (planejado).
      const unit = o.checked_in_unit ?? o.unit;
      if (!unit) continue;

      let g = map.get(delId);
      if (!g) {
        g = {
          delegationId: delId,
          schoolName,
          totalAllocated: 0,
          totalCheckedIn: 0,
          totalMale: 0,
          totalFemale: 0,
          units: new Map(),
        };
        map.set(delId, g);
      }
      if (o.status === "checked_in") g.totalCheckedIn += 1;
      else g.totalAllocated += 1;
      if (gender === "male") g.totalMale += 1;
      else if (gender === "female") g.totalFemale += 1;

      let u = g.units.get(unit.id);
      if (!u) {
        u = {
          unitId: unit.id,
          unitName: unit.name,
          locationName: (unit as any).lodging_locations?.name ?? "—",
          occupancies: [],
        };
        g.units.set(unit.id, u);
      }
      u.occupancies.push({
        full_name: fullName,
        gender: gender ?? null,
        status: o.status,
        participant_type: p.participant_type,
      });
    }
    return Array.from(map.values()).sort((a, b) => a.schoolName.localeCompare(b.schoolName));
  }, [occupancies]);

  const filteredGroups = useMemo(() => {
    if (!search.trim()) return groups;
    const q = search.toLowerCase();
    return groups.filter((g) => g.schoolName.toLowerCase().includes(q));
  }, [groups, search]);

  const totals = useMemo(() => {
    return groups.reduce((acc, g) => {
      acc.schools += 1;
      acc.allocated += g.totalAllocated;
      acc.checked_in += g.totalCheckedIn;
      acc.male += g.totalMale;
      acc.female += g.totalFemale;
      return acc;
    }, { schools: 0, allocated: 0, checked_in: 0, male: 0, female: 0 });
  }, [groups]);

  const toggleExpanded = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  if (!isStageScoped || !stageId) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 py-16 text-center">
        <Building className="h-10 w-10 text-muted-foreground mb-3" />
        <p className="text-muted-foreground font-medium">Acesse pelo menu de uma etapa</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-4">
      <div>
        <h1 className="font-heading text-2xl font-bold text-foreground flex items-center gap-2">
          <Users className="h-6 w-6" /> Escolas alojadas
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Visão por delegação com totais por sexo. Clique numa escola para ver os quartos onde ela está alocada e a lista nominal.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {[
          { label: "Escolas", value: totals.schools },
          { label: "Alojados", value: totals.checked_in, tone: "emerald" },
          { label: "Alocados (aguardando)", value: totals.allocated, tone: "amber" },
          { label: "M", value: totals.male, tone: "blue" },
          { label: "F", value: totals.female, tone: "pink" },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-lg border bg-card px-3 py-2">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{kpi.label}</div>
            <div className={`text-xl font-bold ${
              kpi.tone === "emerald" ? "text-emerald-600 dark:text-emerald-400" :
              kpi.tone === "amber" ? "text-amber-600 dark:text-amber-400" :
              kpi.tone === "blue" ? "text-blue-600 dark:text-blue-400" :
              kpi.tone === "pink" ? "text-pink-600 dark:text-pink-400" : ""
            }`}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar escola..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-md" />)}</div>
      ) : filteredGroups.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            {groups.length === 0 ? "Nenhuma escola alojada nesta etapa." : "Nenhum resultado para a busca."}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredGroups.map((g) => {
            const isOpen = expanded.has(g.delegationId);
            const total = g.totalCheckedIn + g.totalAllocated;
            return (
              <Card key={g.delegationId} className="overflow-hidden">
                <CardHeader className="py-3 px-4 cursor-pointer hover:bg-muted/30 transition" onClick={() => toggleExpanded(g.delegationId)}>
                  <div className="flex items-center gap-3">
                    {isOpen ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm truncate">{g.schoolName}</p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        <Badge variant="secondary" className="text-[10px]">{total} pessoas</Badge>
                        {g.totalCheckedIn > 0 && (
                          <Badge className="text-[10px] bg-emerald-600 hover:bg-emerald-700">{g.totalCheckedIn} alojados</Badge>
                        )}
                        {g.totalAllocated > 0 && (
                          <Badge variant="outline" className="text-[10px] border-amber-500 text-amber-700 dark:text-amber-300">
                            {g.totalAllocated} pré-alocados
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-[10px]">{g.totalMale}M · {g.totalFemale}F</Badge>
                        <Badge variant="outline" className="text-[10px]">{g.units.size} quarto{g.units.size !== 1 ? "s" : ""}</Badge>
                      </div>
                    </div>
                  </div>
                </CardHeader>

                {isOpen && (
                  <CardContent className="pt-0 pb-3 space-y-3">
                    {Array.from(g.units.values())
                      .sort((a, b) => a.locationName.localeCompare(b.locationName) || a.unitName.localeCompare(b.unitName))
                      .map((u) => (
                        <div key={u.unitId} className="rounded-md border bg-muted/20 p-3">
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold truncate">{u.unitName}</p>
                              <p className="text-[11px] text-muted-foreground truncate">{u.locationName}</p>
                            </div>
                            <Badge variant="outline" className="text-[10px]">{u.occupancies.length}</Badge>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {u.occupancies
                              .sort((a, b) => a.full_name.localeCompare(b.full_name))
                              .map((p, i) => (
                                <div key={i} className="flex items-center gap-1.5 px-2 py-1 rounded bg-background border text-xs">
                                  <Badge variant={STATUS_BADGE[p.status] ?? "outline"} className="text-[9px] px-1 h-4">
                                    {STATUS_LABEL[p.status] ?? p.status}
                                  </Badge>
                                  <span className="truncate max-w-[180px]">{p.full_name}</span>
                                  {p.gender === "male" && <span className="text-[10px] text-blue-600">M</span>}
                                  {p.gender === "female" && <span className="text-[10px] text-pink-600">F</span>}
                                  {p.participant_type !== "athlete" && (
                                    <span className="text-[9px] uppercase tracking-wider text-muted-foreground">
                                      {p.participant_type === "coach" ? "tec" : p.participant_type === "head_of_delegation" ? "chefe" : "staff"}
                                    </span>
                                  )}
                                </div>
                              ))}
                          </div>
                        </div>
                      ))}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {filteredGroups.length === 0 && groups.length > 0 && search && (
        <p className="text-xs text-muted-foreground text-center mt-2 flex items-center justify-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          {groups.length} escola{groups.length !== 1 ? "s" : ""} ocultas pelo filtro.
        </p>
      )}
    </div>
  );
}
