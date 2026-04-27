
import { useMedalTable } from "@/hooks/useMedalTable";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trophy, Medal, Loader2 } from "lucide-react";

export default function MedalTableTab({ eventId }: { eventId: string }) {
  const { data: medalTable = [], isLoading } = useMedalTable(eventId);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quadro de Medalhas em Tempo Real</CardTitle>
        <CardDescription>Consolidação de medalhas baseada em todos os resultados publicados até o momento.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : medalTable.length === 0 ? (
          <div className="text-center p-8 text-muted-foreground">
            Nenhuma medalha contabilizada até o momento.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px]">Pos</TableHead>
                <TableHead>Delegação (Escola)</TableHead>
                <TableHead className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Medal className="h-4 w-4 text-yellow-500" />
                    <span>Ouro</span>
                  </div>
                </TableHead>
                <TableHead className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Medal className="h-4 w-4 text-slate-400" />
                    <span>Prata</span>
                  </div>
                </TableHead>
                <TableHead className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Medal className="h-4 w-4 text-amber-700" />
                    <span>Bronze</span>
                  </div>
                </TableHead>
                <TableHead className="text-center font-bold">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {medalTable.map((row, idx) => (
                <TableRow key={row.delegation_id}>
                  <TableCell className="font-bold">{idx + 1}º</TableCell>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell className="text-center bg-yellow-50/50">{row.gold}</TableCell>
                  <TableCell className="text-center bg-slate-50/50">{row.silver}</TableCell>
                  <TableCell className="text-center bg-amber-50/50">{row.bronze}</TableCell>
                  <TableCell className="text-center font-bold bg-muted/30">{row.total}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
