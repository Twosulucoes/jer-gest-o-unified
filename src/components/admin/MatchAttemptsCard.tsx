import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { IndividualConfig } from "./IndividualConfigEditor";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Target, Trophy } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface MatchAttemptsCardProps {
  matchId: string;
  entries: { id: string; label: string; participantId?: string }[];
  individualConfig: IndividualConfig;
  canWrite: boolean;
}

type AttemptRow = {
  id: string;
  match_entry_id: string;
  participant_id: string;
  attempt_number: number;
  value_cm: number | null;
  value_ms: number | null;
  value_points: number | null;
  is_valid: boolean;
  notes: string | null;
};

const formatTimeMs = (ms: number): string => {
  const totalSecs = Math.floor(ms / 1000);
  const millis = ms % 1000;
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  if (mins > 0) return `${mins}:${secs.toString().padStart(2, "0")}.${millis.toString().padStart(3, "0")}`;
  return `${secs}.${millis.toString().padStart(3, "0")}s`;
};

const formatDistanceCm = (cm: number): string => {
  if (cm >= 100) return `${(cm / 100).toFixed(2)}m`;
  return `${cm}cm`;
};

export default function MatchAttemptsCard({ matchId, entries, individualConfig, canWrite }: MatchAttemptsCardProps) {
  const qc = useQueryClient();
  const maxAttempts = individualConfig.max_attempts ?? 6;
  const rf = individualConfig.result_fields ?? {};
  const showCm = !!rf.distance;
  const showMs = !!rf.time;
  const showPts = !!rf.points;

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const { data: attempts = [], isLoading } = useQuery({
    queryKey: ["match_attempts", matchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("match_attempts" as any)
        .select("*")
        .eq("match_id", matchId)
        .order("attempt_number");
      if (error) throw error;
      return data as unknown as AttemptRow[];
    },
  });

  const addAttemptMut = useMutation({
    mutationFn: async ({ entryId, participantId }: { entryId: string; participantId: string }) => {
      const entryAttempts = attempts.filter((a) => a.match_entry_id === entryId);
      const nextNum = entryAttempts.length > 0 ? Math.max(...entryAttempts.map((a) => a.attempt_number)) + 1 : 1;
      if (nextNum > maxAttempts) throw new Error(`Limite de ${maxAttempts} tentativas atingido`);
      const { error } = await supabase.from("match_attempts" as any).insert({
        match_id: matchId,
        match_entry_id: entryId,
        participant_id: participantId,
        attempt_number: nextNum,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["match_attempts", matchId] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateAttemptMut = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: string; value: any }) => {
      const { error } = await supabase.from("match_attempts" as any).update({ [field]: value }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["match_attempts", matchId] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteAttemptMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("match_attempts" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["match_attempts", matchId] }); setConfirmDeleteId(null); toast.success("Tentativa removida"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const getBestValue = (entryId: string): string | null => {
    const valid = attempts.filter((a) => a.match_entry_id === entryId && a.is_valid);
    if (valid.length === 0) return null;

    if (showCm) {
      const values = valid.filter((a) => a.value_cm != null).map((a) => a.value_cm!);
      if (values.length > 0) return formatDistanceCm(Math.max(...values));
    }
    if (showMs) {
      const values = valid.filter((a) => a.value_ms != null).map((a) => a.value_ms!);
      if (values.length > 0) return formatTimeMs(Math.min(...values));
    }
    if (showPts) {
      const values = valid.filter((a) => a.value_points != null).map((a) => a.value_points!);
      if (values.length > 0) return `${Math.max(...values)} pts`;
    }
    return null;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-1.5">
          <Target className="h-4 w-4" />Tentativas
          <Badge variant="secondary" className="text-[10px] ml-1">máx. {maxAttempts}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {entries.map((entry) => {
          const entryAttempts = attempts.filter((a) => a.match_entry_id === entry.id);
          const best = getBestValue(entry.id);
          const canAddMore = entryAttempts.length < maxAttempts;

          return (
            <div key={entry.id} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{entry.label}</span>
                  {best && (
                    <Badge variant="outline" className="text-[10px] gap-1">
                      <Trophy className="h-3 w-3" />Melhor: {best}
                    </Badge>
                  )}
                </div>
                {canWrite && canAddMore && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => entry.participantId && addAttemptMut.mutate({ entryId: entry.id, participantId: entry.participantId })}
                    disabled={addAttemptMut.isPending || !entry.participantId}
                  >
                    <Plus className="mr-1 h-3 w-3" />Tentativa
                  </Button>
                )}
              </div>

              {entryAttempts.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">Nenhuma tentativa registrada.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      {showCm && <TableHead>Distância (cm)</TableHead>}
                      {showMs && <TableHead>Tempo (ms)</TableHead>}
                      {showPts && <TableHead>Pontos</TableHead>}
                      <TableHead className="w-16">Válida</TableHead>
                      <TableHead>Obs.</TableHead>
                      {canWrite && <TableHead className="w-10" />}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entryAttempts.map((att) => (
                      <TableRow key={att.id} className={!att.is_valid ? "opacity-50" : ""}>
                        <TableCell className="font-mono font-bold">{att.attempt_number}</TableCell>
                        {showCm && (
                          <TableCell>
                            {canWrite ? (
                              <Input
                                type="number"
                                className="h-7 w-24 text-xs"
                                defaultValue={att.value_cm ?? ""}
                                onBlur={(e) => {
                                  const v = e.target.value ? parseInt(e.target.value) : null;
                                  if (v !== att.value_cm) updateAttemptMut.mutate({ id: att.id, field: "value_cm", value: v });
                                }}
                              />
                            ) : (
                              <span className="font-mono">{att.value_cm != null ? formatDistanceCm(att.value_cm) : "—"}</span>
                            )}
                          </TableCell>
                        )}
                        {showMs && (
                          <TableCell>
                            {canWrite ? (
                              <Input
                                type="number"
                                className="h-7 w-24 text-xs"
                                defaultValue={att.value_ms ?? ""}
                                onBlur={(e) => {
                                  const v = e.target.value ? parseInt(e.target.value) : null;
                                  if (v !== att.value_ms) updateAttemptMut.mutate({ id: att.id, field: "value_ms", value: v });
                                }}
                              />
                            ) : (
                              <span className="font-mono">{att.value_ms != null ? formatTimeMs(att.value_ms) : "—"}</span>
                            )}
                          </TableCell>
                        )}
                        {showPts && (
                          <TableCell>
                            {canWrite ? (
                              <Input
                                type="number"
                                step="0.01"
                                className="h-7 w-24 text-xs"
                                defaultValue={att.value_points ?? ""}
                                onBlur={(e) => {
                                  const v = e.target.value ? parseFloat(e.target.value) : null;
                                  if (v !== att.value_points) updateAttemptMut.mutate({ id: att.id, field: "value_points", value: v });
                                }}
                              />
                            ) : (
                              <span className="font-mono">{att.value_points ?? "—"}</span>
                            )}
                          </TableCell>
                        )}
                        <TableCell>
                          <Checkbox
                            checked={att.is_valid}
                            disabled={!canWrite}
                            onCheckedChange={(checked) =>
                              updateAttemptMut.mutate({ id: att.id, field: "is_valid", value: !!checked })
                            }
                          />
                        </TableCell>
                        <TableCell>
                          {canWrite ? (
                            <Input
                              className="h-7 text-xs"
                              defaultValue={att.notes ?? ""}
                              placeholder="—"
                              onBlur={(e) => {
                                const v = e.target.value || null;
                                if (v !== att.notes) updateAttemptMut.mutate({ id: att.id, field: "notes", value: v });
                              }}
                            />
                          ) : (
                            <span className="text-xs text-muted-foreground">{att.notes ?? "—"}</span>
                          )}
                        </TableCell>
                        {canWrite && (
                          <TableCell>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setConfirmDeleteId(att.id)}>
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          );
        })}

        <AlertDialog open={!!confirmDeleteId} onOpenChange={(open) => { if (!open) setConfirmDeleteId(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remover tentativa</AlertDialogTitle>
              <AlertDialogDescription>Tem certeza que deseja remover esta tentativa? Esta ação não pode ser desfeita.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => confirmDeleteId && deleteAttemptMut.mutate(confirmDeleteId)}>Remover</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
