import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trophy, Medal } from "lucide-react";
import type { BulletinDataset } from "./useBulletinData";
import { statusBadgeLabel } from "./useBulletinData";

const ROUND_LABELS: Record<string, string> = {
  R32: "32-avos", R16: "Oitavas", QF: "Quartas", SF: "Semifinal", BRONZE: "Bronze",
  F: "Final", FINAL: "Final", REPESCAGEM: "Repescagem",
};

export default function BulletinCombat({ data }: { data: BulletinDataset }) {
  const { byPhase, podio, entriesByMatch, resultByEntry } = useMemo(() => {
    const eByM = new Map<string, typeof data.entries>();
    for (const e of data.entries) { if (!eByM.has(e.match_id)) eByM.set(e.match_id, []); eByM.get(e.match_id)!.push(e); }
    const rByE = new Map<string, typeof data.results[number]>();
    for (const r of data.results) rByE.set(r.match_entry_id, r);

    const phaseMap = new Map<string, typeof data.matches>();
    for (const m of data.matches) {
      if (!phaseMap.has(m.phase_id)) phaseMap.set(m.phase_id, []);
      phaseMap.get(m.phase_id)!.push(m);
    }

    // pódio: posição 1, 2, 3 (em qualquer fase final) lendo position do result
    const podio: Array<{ pos: number; name: string; delegation: string | null }> = [];
    for (const r of data.results) {
      if (r.position && r.position >= 1 && r.position <= 3 && (r.result_status === "publicado" || r.result_status === "resultado_validado")) {
        const ent = data.entries.find((e) => e.id === r.match_entry_id);
        if (ent) podio.push({ pos: r.position, name: ent.display_name, delegation: ent.delegation_name });
      }
    }
    podio.sort((a, b) => a.pos - b.pos);
    return { byPhase: phaseMap, podio, entriesByMatch: eByM, resultByEntry: rByE };
  }, [data]);

  const phaseName = (pid: string) => {
    const p = data.phases.find((x) => x.id === pid);
    if (!p) return "—";
    return ROUND_LABELS[p.phase_type] || p.name;
  };

  return (
    <div className="space-y-6">
      {[...byPhase.entries()].map(([pid, ms]) => (
        <Card key={pid}>
          <CardHeader><CardTitle className="text-base">{phaseName(pid)}</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Atleta A</TableHead>
                  <TableHead className="text-center">Resultado</TableHead>
                  <TableHead>Atleta B</TableHead>
                  <TableHead>Vencedor</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ms.map((m) => {
                  const ents = entriesByMatch.get(m.id) || [];
                  const a = ents[0]; const b = ents[1];
                  const ar = a ? resultByEntry.get(a.id) : undefined;
                  const br = b ? resultByEntry.get(b.id) : undefined;
                  const winner =
                    ar?.outcome === "win" ? a?.display_name :
                    br?.outcome === "win" ? b?.display_name : "—";
                  const detail = ar?.combat_detail?.method || br?.combat_detail?.method || ar?.result_text || br?.result_text || `${ar?.score ?? "—"} - ${br?.score ?? "—"}`;
                  const sb = statusBadgeLabel(ar?.result_status || m.status);
                  return (
                    <TableRow key={m.id}>
                      <TableCell className="font-mono text-xs">{m.match_number ?? "—"}</TableCell>
                      <TableCell>
                        <div>{a?.display_name ?? "—"}</div>
                        {a?.delegation_name && <div className="text-xs text-muted-foreground">{a.delegation_name}</div>}
                      </TableCell>
                      <TableCell className="text-center text-xs">{detail}</TableCell>
                      <TableCell>
                        <div>{b?.display_name ?? "—"}</div>
                        {b?.delegation_name && <div className="text-xs text-muted-foreground">{b.delegation_name}</div>}
                      </TableCell>
                      <TableCell className="font-medium">{winner}</TableCell>
                      <TableCell><Badge variant={sb.tone}>{sb.label}</Badge></TableCell>
                    </TableRow>
                  );
                })}
                {ms.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Sem confrontos.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}

      {podio.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Trophy className="h-4 w-4 text-yellow-500" /> Pódio</CardTitle></CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {podio.map((p, i) => (
                <div key={`${p.pos}-${p.name}-${i}`} className="flex items-center gap-3 p-3 border border-border rounded-md">
                  <Medal className={`h-5 w-5 ${p.pos === 1 ? "text-yellow-500" : p.pos === 2 ? "text-muted-foreground" : "text-amber-700"}`} />
                  <div className="font-mono w-10">{p.pos}º</div>
                  <div className="flex-1">
                    <div className="font-medium">{p.name}</div>
                    {p.delegation && <div className="text-xs text-muted-foreground">{p.delegation}</div>}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
