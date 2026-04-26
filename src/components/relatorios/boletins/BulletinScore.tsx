import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { BulletinDataset } from "./useBulletinData";
import { getGroupPoints, statusBadgeLabel } from "./useBulletinData";

interface Standing {
  team: string;
  delegation: string | null;
  P: number; J: number; V: number; E: number; D: number; GP: number; GC: number; SG: number;
}

export function computeScoreStandings(data: BulletinDataset): Map<string, Standing[]> {
  const pts = getGroupPoints(data.rules);
  const byGroup = new Map<string, Standing[]>();

  // index entries por match
  const entriesByMatch = new Map<string, typeof data.entries>();
  for (const e of data.entries) {
    if (!entriesByMatch.has(e.match_id)) entriesByMatch.set(e.match_id, []);
    entriesByMatch.get(e.match_id)!.push(e);
  }
  const resultByEntry = new Map<string, typeof data.results[number]>();
  for (const r of data.results) resultByEntry.set(r.match_entry_id, r);

  for (const m of data.matches) {
    if (m.status !== "completed" && m.status !== "publicado") continue;
    const ents = entriesByMatch.get(m.id) || [];
    if (ents.length < 2) continue;
    const groupKey = m.group_id ?? "__no_group__";
    if (!byGroup.has(groupKey)) byGroup.set(groupKey, []);
    const standings = byGroup.get(groupKey)!;

    for (const e of ents) {
      const key = e.display_name;
      let s = standings.find((x) => x.team === key);
      if (!s) {
        s = { team: key, delegation: e.delegation_name, P: 0, J: 0, V: 0, E: 0, D: 0, GP: 0, GC: 0, SG: 0 };
        standings.push(s);
      }
      const r = resultByEntry.get(e.id);
      if (!r) continue;
      const myScore = parseInt(r.score ?? "", 10);
      const otherEnt = ents.find((x) => x.id !== e.id);
      const otherR = otherEnt ? resultByEntry.get(otherEnt.id) : undefined;
      const oppScore = otherR ? parseInt(otherR.score ?? "", 10) : NaN;
      if (Number.isNaN(myScore) || Number.isNaN(oppScore)) continue;
      s.J += 1;
      s.GP += myScore;
      s.GC += oppScore;
      s.SG = s.GP - s.GC;
      const isWO = r.outcome === "wo" || r.result_type === "wo";
      if (myScore > oppScore) { s.V += 1; s.P += isWO ? pts.wo_win : pts.win; }
      else if (myScore < oppScore) { s.D += 1; s.P += isWO ? pts.wo_loss : pts.loss; }
      else { s.E += 1; s.P += pts.draw; }
    }
  }

  for (const list of byGroup.values()) {
    list.sort((a, b) => b.P - a.P || b.SG - a.SG || b.GP - a.GP || a.team.localeCompare(b.team));
  }
  return byGroup;
}

export default function BulletinScore({ data }: { data: BulletinDataset }) {
  const standingsByGroup = useMemo(() => computeScoreStandings(data), [data]);
  const groupName = (gid: string) => data.groups.find((g) => g.id === gid)?.name ?? (gid === "__no_group__" ? "Geral" : "—");
  const phaseName = (pid: string) => data.phases.find((p) => p.id === pid)?.name ?? "—";

  // partidas agrupadas por fase + rodada
  const matchesByPhase = useMemo(() => {
    const map = new Map<string, typeof data.matches>();
    for (const m of data.matches) {
      if (!map.has(m.phase_id)) map.set(m.phase_id, []);
      map.get(m.phase_id)!.push(m);
    }
    return map;
  }, [data.matches]);

  const entriesByMatch = useMemo(() => {
    const m = new Map<string, typeof data.entries>();
    for (const e of data.entries) {
      if (!m.has(e.match_id)) m.set(e.match_id, []);
      m.get(e.match_id)!.push(e);
    }
    return m;
  }, [data.entries]);
  const resultByEntry = useMemo(() => {
    const m = new Map<string, typeof data.results[number]>();
    for (const r of data.results) m.set(r.match_entry_id, r);
    return m;
  }, [data.results]);

  return (
    <div className="space-y-6">
      {[...standingsByGroup.entries()].map(([gid, list]) => (
        <Card key={gid}>
          <CardHeader><CardTitle className="text-base">Classificação — {groupName(gid)}</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">Pos</TableHead>
                  <TableHead>Equipe</TableHead>
                  <TableHead className="text-center">P</TableHead>
                  <TableHead className="text-center">J</TableHead>
                  <TableHead className="text-center">V</TableHead>
                  <TableHead className="text-center">E</TableHead>
                  <TableHead className="text-center">D</TableHead>
                  <TableHead className="text-center">GP</TableHead>
                  <TableHead className="text-center">GC</TableHead>
                  <TableHead className="text-center">SG</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((s, idx) => (
                  <TableRow key={s.team}>
                    <TableCell className="font-mono">{idx + 1}º</TableCell>
                    <TableCell>
                      <div className="font-medium">{s.team}</div>
                      {s.delegation && <div className="text-xs text-muted-foreground">{s.delegation}</div>}
                    </TableCell>
                    <TableCell className="text-center font-bold">{s.P}</TableCell>
                    <TableCell className="text-center">{s.J}</TableCell>
                    <TableCell className="text-center">{s.V}</TableCell>
                    <TableCell className="text-center">{s.E}</TableCell>
                    <TableCell className="text-center">{s.D}</TableCell>
                    <TableCell className="text-center">{s.GP}</TableCell>
                    <TableCell className="text-center">{s.GC}</TableCell>
                    <TableCell className="text-center">{s.SG}</TableCell>
                  </TableRow>
                ))}
                {list.length === 0 && (
                  <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground">Sem partidas concluídas.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}

      {[...matchesByPhase.entries()].map(([pid, ms]) => (
        <Card key={pid}>
          <CardHeader><CardTitle className="text-base">Partidas — {phaseName(pid)}</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Mandante</TableHead>
                  <TableHead className="text-center">Placar</TableHead>
                  <TableHead>Visitante</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ms.map((m) => {
                  const ents = entriesByMatch.get(m.id) || [];
                  const home = ents.find((e) => e.side === "home") || ents[0];
                  const away = ents.find((e) => e.side === "away") || ents[1];
                  const homeR = home ? resultByEntry.get(home.id) : undefined;
                  const awayR = away ? resultByEntry.get(away.id) : undefined;
                  const status = homeR?.result_status || m.status;
                  const sb = statusBadgeLabel(status);
                  return (
                    <TableRow key={m.id}>
                      <TableCell className="font-mono text-xs">{m.match_number ?? "—"}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        {m.match_date ?? "—"}{m.start_time ? ` ${m.start_time.slice(0, 5)}` : ""}
                      </TableCell>
                      <TableCell>{home?.display_name ?? "—"}</TableCell>
                      <TableCell className="text-center font-bold">
                        {homeR?.score ?? "—"} × {awayR?.score ?? "—"}
                        {(homeR?.combat_detail?.shootout || awayR?.combat_detail?.shootout) && (
                          <div className="text-[10px] text-muted-foreground font-normal">
                            ({homeR?.combat_detail?.shootout ?? "0"} × {awayR?.combat_detail?.shootout ?? "0"} Pênaltis)
                          </div>
                        )}
                      </TableCell>
                      <TableCell>{away?.display_name ?? "—"}</TableCell>
                      <TableCell><Badge variant={sb.tone}>{sb.label}</Badge></TableCell>
                    </TableRow>
                  );
                })}
                {ms.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Sem partidas.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
