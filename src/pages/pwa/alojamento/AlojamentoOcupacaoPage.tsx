import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { getSelectedFacility } from "@/hooks/useAlojamento";
import { useEventContext } from "@/contexts/EventContext";
import { AlojamentoNavHeader } from "@/components/pwa/alojamento/AlojamentoNavHeader";
import {
  PwaSectionLabel,
  PwaStatTriplet,
  occupancyBarClass,
  occupancyTone,
} from "@/components/pwa/PwaDashboardPrimitives";
import { Building, FileBarChart, ScanLine, Search, X, Users } from "lucide-react";

interface RoomInfo {
  id: string;
  code: string;
  capacity: number;
  occupied: number;
}

interface BlockInfo {
  id: string;
  name: string;
  gender_policy: string;
  rooms: RoomInfo[];
}

interface PersonResult {
  participant_id: string;
  full_name: string;
  participant_type: string;
  bed_code: string | null;
  room_code: string | null;
  block_name: string | null;
  delegation_name: string | null;
}

export default function AlojamentoOcupacaoPage() {
  const navigate = useNavigate();
  const { activeEvent } = useEventContext();
  const [blocks, setBlocks] = useState<BlockInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<PersonResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [kpiLoading, setKpiLoading] = useState(true);
  const [kpis, setKpis] = useState({ assigned: 0, total: 0, hospedados: 0 });
  const facilityId = getSelectedFacility();

  useEffect(() => {
    if (!facilityId) return;
    (async () => {
      const [{ data: occ }, { data: kpi }] = await Promise.all([
        supabase.rpc("get_alojamento_ocupacao" as any, { p_facility_id: facilityId }),
        supabase.rpc("get_alojamento_kpis" as any, { p_facility_id: facilityId }),
      ]);
      setBlocks((Array.isArray(occ) ? occ : []) as BlockInfo[]);
      setLoading(false);
      const k = (kpi || {}) as Record<string, number>;
      setKpis({
        assigned: k.assigned_beds ?? 0,
        total: Math.max(1, k.total_beds ?? 1),
        hospedados: k.hospedados ?? 0,
      });
      setKpiLoading(false);
    })();
  }, [facilityId]);

  useEffect(() => {
    if (!search.trim() || search.length < 3) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      const { data } = await supabase.rpc("pwa_search_person" as any, {
        p_query: search.trim(),
        p_facility_id: facilityId,
        p_limit: 10
      });
      setSearchResults((data as any)?.results || []);
      setSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [search, facilityId]);

  const livres = Math.max(0, kpis.total - kpis.assigned);

  const filteredBlocks = useMemo(() => {
    if (!search.trim()) return blocks;
    const q = search.toLowerCase();
    return blocks.filter(b => 
      b.name.toLowerCase().includes(q) || 
      b.rooms.some(r => r.code.toLowerCase().includes(q))
    );
  }, [blocks, search]);

  const blockSummaries = useMemo(() => {
    return filteredBlocks.map((block) => {
      const cap = block.rooms.reduce((s, r) => s + r.capacity, 0);
      const occ = block.rooms.reduce((s, r) => s + r.occupied, 0);
      const pct = cap > 0 ? Math.round((occ / cap) * 100) : 0;
      return { block, cap, occ, pct };
    });
  }, [filteredBlocks]);

  const genderLabel: Record<string, string> = {
    misto: "Misto",
    masculino: "Masculino",
    feminino: "Feminino",
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-25" />
      
      <AlojamentoNavHeader currentPathLabel="Ocupação" />

      <main className="relative max-w-md mx-auto space-y-4 px-4 pb-28 pt-4">
        {/* Search Bar */}
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
          <Input
            placeholder="Buscar bloco ou quarto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-9 h-11 rounded-xl bg-card/90 backdrop-blur-sm border-border/80 focus:ring-primary/20"
          />
          {search && (
            <button 
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 flex items-center justify-center rounded-full bg-muted/80 text-muted-foreground hover:bg-muted"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        <PwaStatTriplet
          loading={kpiLoading}
          items={[
            { label: "Ocupados", value: kpis.assigned, tone: "purple" },
            { label: "Livres", value: livres, tone: "green" },
            { label: "Hospedados", value: kpis.hospedados, tone: "amber" },
          ]}
        />

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <PwaSectionLabel>Blocos e Quartos</PwaSectionLabel>
            <span className="text-[10px] font-bold text-muted-foreground uppercase bg-muted/50 px-2 py-0.5 rounded-full">
              {filteredBlocks.length} resultados
            </span>
          </div>
          
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-28 w-full rounded-2xl" />
              ))}
            </div>
          ) : filteredBlocks.length === 0 ? (
            <Card className="border-dashed bg-muted/20">
              <CardContent className="p-10 text-center space-y-2">
                <Search className="h-10 w-10 mx-auto text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">Nenhum bloco encontrado</p>
                <Button variant="link" size="sm" onClick={() => setSearch("")}>Limpar busca</Button>
              </CardContent>
            </Card>
          ) : (
            blockSummaries.map(({ block, cap, occ, pct }) => (
              <Card
                key={block.id}
                className="overflow-hidden border-border/60 bg-card/80 backdrop-blur-sm shadow-sm hover:shadow-md transition-all active:scale-[0.99]"
              >
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-bold text-foreground">{block.name}</p>
                      <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-tight">
                        {genderLabel[block.gender_policy] || block.gender_policy}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={`shrink-0 rounded-full border-0 px-2 py-0.5 text-[10px] font-bold ${
                        pct >= 90
                          ? "bg-red-500/15 text-red-600 dark:text-red-400"
                          : pct >= 70
                            ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                            : "bg-green-500/15 text-green-700 dark:text-green-400"
                      }`}
                    >
                      {pct}% Ocupado
                    </Badge>
                  </div>
                  <Progress value={pct} indicatorClassName={occupancyBarClass(pct)} className="h-2 bg-muted/40" />
                  <div className="flex justify-between text-[11px] text-muted-foreground font-medium">
                    <span>
                      <span className={occupancyTone(pct) === "red" ? "text-red-600 font-bold" : "text-foreground font-bold"}>
                        {occ}
                      </span>{" "}
                      alocados
                    </span>
                    <span>
                      <span className="text-foreground font-bold">{Math.max(0, cap - occ)}</span> livres de{" "}
                      <span className="text-foreground font-bold">{cap}</span>
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </main>

      {/* Floating Actions */}
      <div className="fixed bottom-0 left-0 right-0 z-10 border-t border-border/60 bg-background/80 p-4 backdrop-blur-lg">
        <div className="mx-auto flex max-w-md gap-3">
          <Button 
            variant="module" 
            className="h-12 flex-1 rounded-2xl font-bold shadow-lg shadow-primary/10" 
            onClick={() => navigate("/pwa/alojamento/scan")}
          >
            <ScanLine className="mr-2 h-5 w-5" />
            Scanner
          </Button>
          <Button 
            variant="outline" 
            className="h-12 w-12 rounded-2xl border-border/80 bg-card flex items-center justify-center p-0" 
            onClick={() => navigate("/pwa/alojamento/lista-completa")}
          >
            <Users className="h-5 w-5 text-purple-500" />
          </Button>
        </div>
      </div>
    </div>
  );
}
