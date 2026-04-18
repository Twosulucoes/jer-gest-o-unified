import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ScopeFilter = "all" | "jer" | "jerpa";
export type TypeFilter = "all" | "collective" | "individual";

export interface MedalTableFilters {
  scope: ScopeFilter;
  type: TypeFilter;
  sportId?: string | null;
}

export interface SchoolMedalRow {
  schoolId: string; // delegation_id
  schoolName: string;
  ouro: number;
  prata: number;
  bronze: number;
  total: number;
  pos: number;
}

export interface RankingGeralRow {
  schoolId: string;
  schoolName: string;
  ptsColetivas: number;
  ptsIndividuais: number;
  totalGeral: number;
  ouros: number;
  pratas: number;
  bronzes: number;
  ouroColetivas: number;
  pratasColetivas: number;
  bronzesColetivas: number;
  pos: number;
}

export interface MedalTableData {
  medalsBySchool: SchoolMedalRow[];
  rankingGeral: RankingGeralRow[];
  partial: { hasPartial: boolean; pendingSports: number };
  sportsList: { id: string; name: string; isJerpa: boolean }[];
}

// Tabela de pontos do Art. 108
const POINTS_TABLE: Record<number, number> = {
  1: 10, 2: 8, 3: 6, 4: 5, 5: 4, 6: 3, 7: 2, 8: 1,
};

// Famílias coletivas
const COLLECTIVE_FAMILIES = new Set(["score", "sets"]);

function isJerpaSport(sportName: string, categoryName?: string | null): boolean {
  const haystack = `${sportName} ${categoryName ?? ""}`.toLowerCase();
  return /paralímpic|paralimpic|\bpara\b|jerpa|parabadminton/.test(haystack);
}

function olympicCompare(
  a: { ouro: number; prata: number; bronze: number },
  b: { ouro: number; prata: number; bronze: number },
) {
  if (b.ouro !== a.ouro) return b.ouro - a.ouro;
  if (b.prata !== a.prata) return b.prata - a.prata;
  return b.bronze - a.bronze;
}

/** Atribui posição com empate (mesma medal-line ⇒ mesma pos). */
function assignPositionsByOlympic<T extends { ouro: number; prata: number; bronze: number; pos: number }>(
  rows: T[],
): T[] {
  rows.sort(olympicCompare);
  let lastPos = 0;
  let lastKey = "";
  rows.forEach((r, i) => {
    const key = `${r.ouro}-${r.prata}-${r.bronze}`;
    if (key === lastKey) {
      r.pos = lastPos;
    } else {
      r.pos = i + 1;
      lastPos = r.pos;
      lastKey = key;
    }
  });
  return rows;
}

export function useMedalTableData(eventId: string | null | undefined, filters: MedalTableFilters) {
  return useQuery<MedalTableData>({
    queryKey: ["medal-table", eventId, filters],
    enabled: !!eventId,
    staleTime: 60_000,
    queryFn: async () => {
      if (!eventId) {
        return { medalsBySchool: [], rankingGeral: [], partial: { hasPartial: false, pendingSports: 0 }, sportsList: [] };
      }

      // 1) sport_events do evento + sport + category
      const { data: sportEvents = [] } = await supabase
        .from("sport_events")
        .select("id, sport_id, category_id, sports(id, name), categories(id, name, gender_scope)")
        .eq("event_id", eventId);

      // 2) regras por prova (família)
      const seIds = (sportEvents ?? []).map((s: any) => s.id);
      const { data: rulesRows = [] } = seIds.length
        ? await supabase.from("sport_event_rules").select("sport_event_id, rules").in("sport_event_id", seIds)
        : { data: [] as any[] };

      const familyBySE = new Map<string, string>();
      for (const r of rulesRows as any[]) {
        const fam = (r.rules as any)?.family ?? "unknown";
        familyBySE.set(r.sport_event_id, fam);
      }

      type SEMeta = { id: string; sportId: string; sportName: string; categoryName: string; isJerpa: boolean; isCollective: boolean };
      const seMeta = new Map<string, SEMeta>();
      const sportsListMap = new Map<string, { id: string; name: string; isJerpa: boolean }>();
      for (const se of sportEvents as any[]) {
        const sportName = se.sports?.name ?? "—";
        const categoryName = se.categories?.name ?? "";
        const isJerpa = isJerpaSport(sportName, categoryName);
        const fam = familyBySE.get(se.id) ?? "unknown";
        const isCollective = COLLECTIVE_FAMILIES.has(fam);
        seMeta.set(se.id, { id: se.id, sportId: se.sport_id, sportName, categoryName, isJerpa, isCollective });
        if (!sportsListMap.has(se.sport_id)) {
          sportsListMap.set(se.sport_id, { id: se.sport_id, name: sportName, isJerpa });
        }
      }

      // 3) matches do evento (para vincular sport_event_id ao result)
      const { data: matches = [] } = await supabase
        .from("competition_matches")
        .select("id, sport_event_id, status")
        .eq("event_id", eventId);

      const matchToSE = new Map<string, string>();
      for (const m of matches as any[]) {
        if (m.sport_event_id) matchToSE.set(m.id, m.sport_event_id);
      }

      // 4) results publicados (top 8 para classificação)
      const matchIds = (matches ?? []).map((m: any) => m.id);
      const { data: results = [] } = matchIds.length
        ? await supabase
            .from("competition_match_results")
            .select("id, match_id, match_entry_id, position, result_status")
            .eq("result_status", "publicado")
            .in("match_id", matchIds)
            .not("position", "is", null)
        : { data: [] as any[] };

      // 5) entries para resolver team/participant
      const entryIds = Array.from(new Set((results as any[]).map((r) => r.match_entry_id).filter(Boolean)));
      const { data: entries = [] } = entryIds.length
        ? await supabase
            .from("competition_match_entries")
            .select("id, team_id, participant_sport_event_id")
            .in("id", entryIds)
        : { data: [] as any[] };

      const entryById = new Map<string, any>();
      for (const e of entries as any[]) entryById.set(e.id, e);

      // 6) teams → delegation
      const teamIds = Array.from(new Set((entries as any[]).map((e) => e.team_id).filter(Boolean)));
      const { data: teams = [] } = teamIds.length
        ? await supabase.from("teams").select("id, delegation_id").in("id", teamIds)
        : { data: [] as any[] };
      const teamToDeleg = new Map<string, string>();
      for (const t of teams as any[]) if (t.delegation_id) teamToDeleg.set(t.id, t.delegation_id);

      // 7) participant_sport_events → participant → delegation
      const pseIds = Array.from(new Set((entries as any[]).map((e) => e.participant_sport_event_id).filter(Boolean)));
      const { data: pses = [] } = pseIds.length
        ? await supabase.from("participant_sport_events").select("id, participant_id").in("id", pseIds)
        : { data: [] as any[] };
      const partIds = Array.from(new Set((pses as any[]).map((p) => p.participant_id).filter(Boolean)));
      const { data: parts = [] } = partIds.length
        ? await supabase.from("participants").select("id, delegation_id").in("id", partIds)
        : { data: [] as any[] };
      const pseToDeleg = new Map<string, string>();
      const partToDeleg = new Map<string, string>();
      for (const p of parts as any[]) if (p.delegation_id) partToDeleg.set(p.id, p.delegation_id);
      for (const p of pses as any[]) {
        const d = partToDeleg.get(p.participant_id);
        if (d) pseToDeleg.set(p.id, d);
      }

      // 8) delegations → school_name
      const delegIdsAll = new Set<string>();
      teamToDeleg.forEach((d) => delegIdsAll.add(d));
      pseToDeleg.forEach((d) => delegIdsAll.add(d));
      const delegIds = Array.from(delegIdsAll);
      const { data: delegs = [] } = delegIds.length
        ? await supabase.from("delegations").select("id, school_name").in("id", delegIds).eq("event_id", eventId)
        : { data: [] as any[] };
      const delegToSchool = new Map<string, string>();
      for (const d of delegs as any[]) delegToSchool.set(d.id, d.school_name || "—");

      // ─── Aplicar filtros de escopo/tipo/modalidade ───
      const passesFilter = (se: SEMeta) => {
        if (filters.sportId && se.sportId !== filters.sportId) return false;
        if (filters.scope === "jer" && se.isJerpa) return false;
        if (filters.scope === "jerpa" && !se.isJerpa) return false;
        if (filters.type === "collective" && !se.isCollective) return false;
        if (filters.type === "individual" && se.isCollective) return false;
        return true;
      };

      // ─── Resolver cada result em (schoolId, position, seId) ───
      type Awarded = { schoolId: string; position: number; seId: string };
      const awarded: Awarded[] = [];
      for (const r of results as any[]) {
        const seId = matchToSE.get(r.match_id);
        if (!seId) continue;
        const se = seMeta.get(seId);
        if (!se || !passesFilter(se)) continue;
        const entry = entryById.get(r.match_entry_id);
        if (!entry) continue;
        const delegId = entry.team_id ? teamToDeleg.get(entry.team_id) : pseToDeleg.get(entry.participant_sport_event_id);
        if (!delegId) continue;
        awarded.push({ schoolId: delegId, position: r.position, seId });
      }

      // ─── QUADRO DE MEDALHAS (top 3) ───
      const medalsMap = new Map<string, SchoolMedalRow>();
      const ensure = (id: string): SchoolMedalRow => {
        let row = medalsMap.get(id);
        if (!row) {
          row = { schoolId: id, schoolName: delegToSchool.get(id) ?? "—", ouro: 0, prata: 0, bronze: 0, total: 0, pos: 0 };
          medalsMap.set(id, row);
        }
        return row;
      };
      for (const a of awarded) {
        if (a.position === 1) ensure(a.schoolId).ouro++;
        else if (a.position === 2) ensure(a.schoolId).prata++;
        else if (a.position === 3) ensure(a.schoolId).bronze++;
      }
      const medalsBySchool = Array.from(medalsMap.values());
      medalsBySchool.forEach((r) => (r.total = r.ouro + r.prata + r.bronze));
      assignPositionsByOlympic(medalsBySchool);

      // ─── CLASSIFICAÇÃO GERAL (Art. 108) ───
      // Coletivas: posição da equipe (1..8) → pontos diretos
      // Individuais: ranking interno por modalidade (medal table) → pos vira pontos
      const ptsBySchool = new Map<string, RankingGeralRow>();
      const ensureRk = (id: string): RankingGeralRow => {
        let row = ptsBySchool.get(id);
        if (!row) {
          row = {
            schoolId: id, schoolName: delegToSchool.get(id) ?? "—",
            ptsColetivas: 0, ptsIndividuais: 0, totalGeral: 0,
            ouros: 0, pratas: 0, bronzes: 0,
            ouroColetivas: 0, pratasColetivas: 0, bronzesColetivas: 0, pos: 0,
          };
          ptsBySchool.set(id, row);
        }
        return row;
      };

      // Group awarded by SE
      const bySE = new Map<string, Awarded[]>();
      for (const a of awarded) {
        if (!bySE.has(a.seId)) bySE.set(a.seId, []);
        bySE.get(a.seId)!.push(a);
      }

      for (const [seId, list] of bySE) {
        const se = seMeta.get(seId);
        if (!se) continue;
        if (se.isCollective) {
          // pos da equipe → pontos
          for (const a of list) {
            const pts = POINTS_TABLE[a.position] ?? 0;
            const row = ensureRk(a.schoolId);
            row.ptsColetivas += pts;
            if (a.position === 1) row.ouroColetivas++;
            else if (a.position === 2) row.pratasColetivas++;
            else if (a.position === 3) row.bronzesColetivas++;
          }
        } else {
          // Individual: agrupar por escola → medal table interno
          const localMap = new Map<string, { ouro: number; prata: number; bronze: number; pos: number }>();
          for (const a of list) {
            let m = localMap.get(a.schoolId);
            if (!m) { m = { ouro: 0, prata: 0, bronze: 0, pos: 0 }; localMap.set(a.schoolId, m); }
            if (a.position === 1) m.ouro++;
            else if (a.position === 2) m.prata++;
            else if (a.position === 3) m.bronze++;
          }
          const arr = Array.from(localMap.entries()).map(([sid, m]) => ({ sid, ...m }));
          arr.sort(olympicCompare);
          // Atribuir posições com empate
          let lastPos = 0, lastKey = "";
          arr.forEach((r, i) => {
            const key = `${r.ouro}-${r.prata}-${r.bronze}`;
            if (key === lastKey) r.pos = lastPos;
            else { r.pos = i + 1; lastPos = r.pos; lastKey = key; }
          });
          for (const r of arr) {
            const pts = POINTS_TABLE[r.pos] ?? 0;
            const row = ensureRk(r.sid);
            row.ptsIndividuais += pts;
          }
        }
      }

      // Total ouros/pratas/bronzes (todas as modalidades) para desempate Art. 111
      for (const [sid, row] of ptsBySchool) {
        const m = medalsMap.get(sid);
        if (m) { row.ouros = m.ouro; row.pratas = m.prata; row.bronzes = m.bronze; }
        row.totalGeral = row.ptsColetivas + row.ptsIndividuais;
      }

      // Garantir que escolas só com medalhas mas sem pontos apareçam (e vice-versa)
      for (const [sid, m] of medalsMap) {
        if (!ptsBySchool.has(sid)) {
          const row = ensureRk(sid);
          row.ouros = m.ouro; row.pratas = m.prata; row.bronzes = m.bronze;
        }
      }

      const rankingGeral = Array.from(ptsBySchool.values());
      rankingGeral.sort((a, b) => {
        if (b.totalGeral !== a.totalGeral) return b.totalGeral - a.totalGeral;
        if (b.ouros !== a.ouros) return b.ouros - a.ouros;
        if (b.pratas !== a.pratas) return b.pratas - a.pratas;
        if (b.bronzes !== a.bronzes) return b.bronzes - a.bronzes;
        return b.ptsColetivas - a.ptsColetivas;
      });
      // posições com empate total
      let lp = 0, lk = "";
      rankingGeral.forEach((r, i) => {
        const k = `${r.totalGeral}-${r.ouros}-${r.pratas}-${r.bronzes}-${r.ptsColetivas}`;
        if (k === lk) r.pos = lp;
        else { r.pos = i + 1; lp = r.pos; lk = k; }
      });

      // ─── Dados parciais: SE com partidas concluídas mas sem result publicado ───
      const completedSE = new Set<string>();
      const publishedSE = new Set<string>();
      for (const m of matches as any[]) {
        if ((m.status === "completed" || m.status === "finished") && m.sport_event_id) {
          completedSE.add(m.sport_event_id);
        }
      }
      for (const r of results as any[]) {
        const seId = matchToSE.get(r.match_id);
        if (seId) publishedSE.add(seId);
      }
      let pendingSports = 0;
      completedSE.forEach((s) => { if (!publishedSE.has(s)) pendingSports++; });

      const sportsList = Array.from(sportsListMap.values()).sort((a, b) => a.name.localeCompare(b.name));

      return {
        medalsBySchool,
        rankingGeral,
        partial: { hasPartial: pendingSports > 0, pendingSports },
        sportsList,
      };
    },
  });
}
