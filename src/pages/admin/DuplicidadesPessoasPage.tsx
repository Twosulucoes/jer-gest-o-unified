import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { Users, Merge, ShieldAlert, Inbox, RefreshCw } from "lucide-react";

interface DupRow {
  group_key: string;
  match_kind: string;
  person_id: string;
  full_name: string | null;
  cpf: string | null;
  birth_date: string | null;
  participants_count: number;
  created_at: string;
}

interface MergeChoice {
  groupKey: string;
  keepId: string;
  dropId: string;
  keepName: string;
  dropName: string;
}

export default function DuplicidadesPessoasPage() {
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState<MergeChoice | null>(null);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["find_duplicate_people"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("find_duplicate_people" as any);
      if (error) throw error;
      return (data ?? []) as DupRow[];
    },
  });

  const mergeMut = useMutation({
    mutationFn: async ({ keepId, dropId }: MergeChoice) => {
      const { data, error } = await supabase.rpc("merge_people" as any, {
        p_keep_id: keepId, p_drop_id: dropId,
      });
      if (error) throw error;
      return data as any;
    },
    onSuccess: (res) => {
      toast({
        title: "Pessoas mescladas",
        description: `${res?.moved_participants ?? 0} participações e ${res?.moved_vouchers ?? 0} vouchers movidos.`,
      });
      setConfirm(null);
      qc.invalidateQueries({ queryKey: ["find_duplicate_people"] });
    },
    onError: (e: any) => toast({ title: "Erro ao mesclar", description: e.message, variant: "destructive" }),
  });

  const groups = (data ?? []).reduce<Record<string, DupRow[]>>((acc, row) => {
    const k = `${row.match_kind}::${row.group_key}`;
    (acc[k] ??= []).push(row);
    return acc;
  }, {});

  const groupKeys = Object.keys(groups);

  if (error) {
    return (
      <div className="text-center py-12 text-muted-foreground flex flex-col items-center gap-2">
        <ShieldAlert className="h-10 w-10 text-destructive" />
        <p>Sem permissão ou erro ao consultar duplicidades.</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            Duplicidades de pessoas
          </h1>
          <p className="text-sm text-muted-foreground">
            Pessoas com mesmo CPF ou mesmo nome+nascimento. Mesclar move participações, vouchers e usos para a pessoa principal.
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 mr-1 ${isFetching ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : groupKeys.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground flex flex-col items-center gap-2">
            <Inbox className="h-10 w-10" />
            <p>Nenhuma duplicidade detectada.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {groupKeys.map((gk) => {
            const rows = groups[gk];
            const kind = rows[0].match_kind;
            const sorted = [...rows].sort(
              (a, b) =>
                (b.participants_count - a.participants_count) ||
                a.created_at.localeCompare(b.created_at)
            );
            const suggestedKeep = sorted[0];

            return (
              <Card key={gk}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Badge variant="outline">{kind === "cpf" ? "CPF idêntico" : "Nome + nascimento"}</Badge>
                    <span className="text-sm text-muted-foreground font-normal">{rows.length} registros</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>CPF</TableHead>
                        <TableHead>Nascimento</TableHead>
                        <TableHead className="text-center">Participações</TableHead>
                        <TableHead className="text-center">Criado em</TableHead>
                        <TableHead className="text-right">Ação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((r) => {
                        const isSuggested = r.person_id === suggestedKeep.person_id;
                        return (
                          <TableRow key={r.person_id} className={isSuggested ? "bg-primary/5" : ""}>
                            <TableCell className="font-medium text-foreground">
                              {r.full_name ?? "—"}
                              {isSuggested && (
                                <Badge variant="default" className="ml-2 text-xs">Sugerida (manter)</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{r.cpf ?? "—"}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {r.birth_date ? new Date(r.birth_date + "T00:00:00").toLocaleDateString("pt-BR") : "—"}
                            </TableCell>
                            <TableCell className="text-center">{r.participants_count}</TableCell>
                            <TableCell className="text-center text-xs text-muted-foreground">
                              {new Date(r.created_at).toLocaleDateString("pt-BR")}
                            </TableCell>
                            <TableCell className="text-right">
                              {!isSuggested && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    setConfirm({
                                      groupKey: gk,
                                      keepId: suggestedKeep.person_id,
                                      dropId: r.person_id,
                                      keepName: suggestedKeep.full_name ?? "—",
                                      dropName: r.full_name ?? "—",
                                    })
                                  }
                                >
                                  <Merge className="h-3.5 w-3.5 mr-1" />
                                  Mesclar nesta sugerida
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar merge de pessoas</AlertDialogTitle>
            <AlertDialogDescription>
              Todas as participações e vouchers de <strong>{confirm?.dropName}</strong> serão movidos para{" "}
              <strong>{confirm?.keepName}</strong>. O registro duplicado será removido. Esta ação é auditada e
              não pode ser desfeita automaticamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirm && mergeMut.mutate(confirm)}
              disabled={mergeMut.isPending}
            >
              {mergeMut.isPending ? "Mesclando..." : "Confirmar merge"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
