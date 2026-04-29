import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { BulletinDataset } from "./useBulletinData";
import { getGroupPoints, statusBadgeLabel } from "./useBulletinData";

/** Tenta extrair sets do sets_score_json, combat_detail ou do score textual ("3x1 (25-20, 22-25, 25-18, 25-21)"). */
function extractSets(matchResult: any): { sets: Array<[number, number]>; setsWon: number; setsLost: number; pp: number; pc: number } {
  let sets: Array<[number, number]> = [];
  const { sets_score_json, combat_detail, score } = matchResult || {};

  if (sets_score_json && Array.isArray(sets_score_json.sets_a)) {
    // Novo formato JSONB estruturado
    sets = sets_score_json.sets_a.map((ptsA: number, i: number) => [
      Number(ptsA), 
      Number(sets_score_json.sets_b?.[i] || 0)
    ] as [number, number]);
  } else if (combat_detail && Array.isArray(combat_detail.sets)) {
    // Formato legado em combat_detail
    sets = combat_detail.sets.map((s: any) => [Number(s.home ?? s.a ?? 0), Number(s.away ?? s.b ?? 0)] as [number, number]);
  } else if (score && score.includes("(")) {
    // Fallback para parse de texto
    const inner = score.match(/\(([^)]+)\)/)?.[1] ?? "";
    sets = inner.split(",").map((s: string) => {
      const [a, b] = s.trim().split(/[-x×]/).map((n) => parseInt(n, 10));
      return [a, b] as [number, number];
    }).filter(([a, b]: [number, number]) => !Number.isNaN(a) && !Number.isNaN(b));
  }
  
  let setsWon = 0, setsLost = 0, pp = 0, pc = 0;
  for (const [a, b] of sets) {
    if (a > b) setsWon++; else if (b > a) setsLost++;
    pp += a; pc += b;
  }
  return { sets, setsWon, setsLost, pp, pc };
}

interface Standing { team: string; delegation: string | null; P: number; J: number; V: number; D: number; SP: number; SC: number; PP: number; PC: number; }

export default function BulletinSets({ data }: { data: BulletinDataset }) {
  const pts = getGroupPoints(data.rules);

  const { standingsByGroup, matchesByPhase, entriesByMatch, resultByEntry } = useMemo(() => {
    const eByM = new Map<string, typeof data.entries>();
    for (const e of data.entries) { if (!eByM.has(e.match_id)) eByM.set(e.match_id, []); eByM.get(e.match_id)!.push(e); }
    const rByE = new Map<string, typeof data.results[number]>();
    for (const r of data.results) rByE.set(r.match_entry_id, r);

    const sg = new Map<string, Standing[]>();
    for (const m of data.matches) {
      if (m.status !== "completed" && m.status !== "publicado") continue;
      const ents = eByM.get(m.id) || [];
      if (ents.length < 2) continue;
      const gid = m.group_id ?? "__no_group__";
      if (!sg.has(gid)) sg.set(gid, []);
      const arr = sg.get(gid)!;
      for (const e of ents) {
        let s = arr.find((x) => x.team === e.display_name);
        if (!s) { s = { team: e.display_name, delegation: e.delegation_name, P: 0, J: 0, V: 0, D: 0, SP: 0, SC: 0, PP: 0, PC: 0 }; arr.push(s); }
        const r = rByE.get(e.id);
        if (!r) continue;
        const otherEnt = ents.find((x) => x.id !== e.id);
        const otherR = otherEnt ? rByE.get(otherEnt.id) : undefined;
        const my = extractSets(r);
        s.J += 1;
        s.SP += my.setsWon; s.SC += my.setsLost;
        s.PP += my.pp; s.PC += my.pc;
        if (my.setsWon > my.setsLost || (my.setsWon === my.setsLost && my.pp > my.pc)) { s.V += 1; s.P += pts.win; }
        else { s.D += 1; s.P += pts.loss; }
      }
    }
    for (const list of sg.values()) list.sort((a, b) => b.P - a.P || (b.SP - b.SC) - (a.SP - a.SC) || b.PP - b.PC - (a.PP - a.PC));

    const mByP = new Map<string, typeof data.matches>();
    for (const m of data.matches) { if (!mByP.has(m.phase_id)) mByP.set(m.phase_id, []); mByP.get(m.phase_id)!.push(m); }
    return { standingsByGroup: sg, matchesByPhase: mByP, entriesByMatch: eByM, resultByEntry: rByE };
  }, [data, pts]);

  const groupName = (gid: string) => data.groups.find((g) => g.id === gid)?.name ?? (gid === "__no_group__" ? "Geral" : "—");
  const phaseName = (pid: string) => data.phases.find((p) => p.id === pid)?.name ?? "—";

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
                  <TableHead className="text-center">D</TableHead>
                  <TableHead className="text-center">SP</TableHead>
                  <TableHead className="text-center">SC</TableHead>
                  <TableHead className="text-center">PP</TableHead>
                  <TableHead className="text-center">PC</TableHead>
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
                    <TableCell className="text-center">{s.D}</TableCell>
                    <TableCell className="text-center">{s.SP}</TableCell>
                    <TableCell className="text-center">{s.SC}</TableCell>
                    <TableCell className="text-center">{s.PP}</TableCell>
                    <TableCell className="text-center">{s.PC}</TableCell>
                  </TableRow>
                ))}
                {list.length === 0 && <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground">Sem partidas concluídas.</TableCell></TableRow>}
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
                  <TableHead>Equipe A</TableHead>
                  <TableHead className="text-center">Sets</TableHead>
                  <TableHead>Equipe B</TableHead>
                  <TableHead>Detalhes</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ms.map((m) => {
                  const ents = entriesByMatch.get(m.id) || [];
                  const a = ents.find((e) => e.side === "home") || ents[0];
                  const b = ents.find((e) => e.side === "away") || ents[1];
                  const ar = a ? resultByEntry.get(a.id) : undefined;
                  const br = b ? resultByEntry.get(b.id) : undefined;
                  const aSets = extractSets(ar);
                  const bSets = extractSets(br);
                  const setDetails = aSets.sets.map(([x, y], i) => `${x}-${bSets.sets[i]?.[0] ?? y}`).join(", ");
                  const sb = statusBadgeLabel(ar?.result_status || m.status);
                  return (
                    <TableRow key={m.id}>
                      <TableCell className="font-mono text-xs">{m.match_number ?? "—"}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        {m.match_date ?? "—"}{m.start_time ? ` ${m.start_time.slice(0, 5)}` : ""}
                      </TableCell>
                      <TableCell>{a?.display_name ?? "—"}</TableCell>
                      <TableCell className="text-center font-bold">{aSets.setsWon} × {bSets.setsWon}</TableCell>
                      <TableCell>{b?.display_name ?? "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{setDetails || "—"}</TableCell>
                      <TableCell><Badge variant={sb.tone}>{sb.label}</Badge></TableCell>
                    </TableRow>
                  );
                })}
                {ms.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Sem partidas.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
