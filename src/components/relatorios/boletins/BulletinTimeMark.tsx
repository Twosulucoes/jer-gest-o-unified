import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { BulletinDataset } from "./useBulletinData";
import { statusBadgeLabel } from "./useBulletinData";

function fmtTime(ms: number | null) {
  if (ms == null) return "—";
  const totalSec = ms / 1000;
  const m = Math.floor(totalSec / 60);
  const s = (totalSec - m * 60).toFixed(2);
  return m > 0 ? `${m}:${s.padStart(5, "0")}` : `${s}s`;
}

export default function BulletinTimeMark({ data }: { data: BulletinDataset }) {
  const isMark = data.family === "mark";

  const { rankingByPhase, entryById } = useMemo(() => {
    const eById = new Map<string, typeof data.entries[number]>();
    for (const e of data.entries) eById.set(e.id, e);

    // resultados agrupados por fase via match→phase
    const matchPhase = new Map<string, string>();
    for (const m of data.matches) matchPhase.set(m.id, m.phase_id);

    const byPhase = new Map<string, Array<{ entry: typeof data.entries[number]; result: typeof data.results[number] }>>();
    for (const r of data.results) {
      if (r.result_status !== "publicado" && r.result_status !== "resultado_validado" && r.result_status !== "resultado_lancado") continue;
      const e = eById.get(r.match_entry_id);
      if (!e) continue;
      const phaseId = matchPhase.get(r.match_id) ?? "__";
      if (!byPhase.has(phaseId)) byPhase.set(phaseId, []);
      byPhase.get(phaseId)!.push({ entry: e, result: r });
    }
    for (const list of byPhase.values()) {
      list.sort((a, b) => {
        if (isMark) {
          const av = a.result.distance_cm ?? a.result.points ?? -Infinity;
          const bv = b.result.distance_cm ?? b.result.points ?? -Infinity;
          return Number(bv) - Number(av);
        }
        const av = a.result.time_ms ?? Infinity;
        const bv = b.result.time_ms ?? Infinity;
        return Number(av) - Number(bv);
      });
    }
    return { rankingByPhase: byPhase, entryById: eById };
  }, [data, isMark]);

  const phaseName = (pid: string) => data.phases.find((p) => p.id === pid)?.name ?? "Resultado";

  return (
    <div className="space-y-6">
      {[...rankingByPhase.entries()].map(([pid, list]) => (
        <Card key={pid}>
          <CardHeader><CardTitle className="text-base">{phaseName(pid)}</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">Pos</TableHead>
                  <TableHead>Atleta</TableHead>
                  <TableHead>Delegação</TableHead>
                  <TableHead className="text-right">{isMark ? "Marca" : "Tempo"}</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((row, idx) => {
                  const sb = statusBadgeLabel(row.result.result_status);
                  const value = isMark
                    ? (row.result.distance_cm != null
                        ? `${(row.result.distance_cm / 100).toFixed(2)} m`
                        : row.result.points != null ? `${row.result.points} pts` : "—")
                    : fmtTime(row.result.time_ms);
                  return (
                    <TableRow key={row.entry.id}>
                      <TableCell className="font-mono">{row.result.position ?? idx + 1}º</TableCell>
                      <TableCell className="font-medium">{row.entry.display_name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{row.entry.delegation_name ?? "—"}</TableCell>
                      <TableCell className="text-right font-mono">{value}</TableCell>
                      <TableCell className="text-center"><Badge variant={sb.tone}>{sb.label}</Badge></TableCell>
                    </TableRow>
                  );
                })}
                {list.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Sem resultados.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
