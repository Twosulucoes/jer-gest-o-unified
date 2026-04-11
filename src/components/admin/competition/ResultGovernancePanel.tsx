import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEventId } from "@/contexts/EventContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { CheckCircle, Send, Loader2, FileText } from "lucide-react";

interface Props {
  sportEventId: string | null;
}

export default function ResultGovernancePanel({ sportEventId }: Props) {
  const eventId = useActiveEventId();
  const queryClient = useQueryClient();
  const [selectedBulletinId, setSelectedBulletinId] = useState<string>("");

  // Counts of results by status for this sport_event
  const { data: counts } = useQuery({
    queryKey: ["governance-counts", eventId, sportEventId],
    enabled: !!sportEventId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("competition_match_results")
        .select("id, result_status, match_id, competition_matches!inner(event_id, sport_event_id)")
        .eq("competition_matches.event_id", eventId)
        .eq("competition_matches.sport_event_id", sportEventId!);
      if (error) throw error;
      const launched = (data || []).filter(r => r.result_status === "resultado_lancado").length;
      const validated = (data || []).filter(r => r.result_status === "validated").length;
      const published = (data || []).filter(r => r.result_status === "publicado").length;
      return { launched, validated, published, total: (data || []).length };
    },
  });

  // Published bulletins for dropdown
  const { data: bulletins = [] } = useQuery({
    queryKey: ["published-bulletins", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("official_bulletins")
        .select("id, number, title, status")
        .eq("event_id", eventId)
        .eq("status", "published")
        .order("number", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const validateResults = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("rpc_validate_results_for_sport_event", {
        p_event_id: eventId,
        p_sport_event_id: sportEventId!,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      toast.success(`${data.validated_count} resultado(s) validado(s).`);
      queryClient.invalidateQueries({ queryKey: ["governance-counts"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const publishResults = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("rpc_publish_results_for_sport_event", {
        p_event_id: eventId,
        p_sport_event_id: sportEventId!,
        p_bulletin_id: selectedBulletinId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      toast.success(`${data.published_count} resultado(s) publicado(s).`);
      setSelectedBulletinId("");
      queryClient.invalidateQueries({ queryKey: ["governance-counts"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!sportEventId) {
    return <p className="text-sm text-muted-foreground">Selecione uma prova para gerenciar governança.</p>;
  }

  return (
    <div className="space-y-4">
      {/* Counters */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold">{counts?.launched ?? "—"}</p>
            <p className="text-xs text-muted-foreground">Lançados</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{counts?.validated ?? "—"}</p>
            <p className="text-xs text-muted-foreground">Validados</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-green-600">{counts?.published ?? "—"}</p>
            <p className="text-xs text-muted-foreground">Publicados</p>
          </CardContent>
        </Card>
      </div>

      {/* Validate */}
      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><CheckCircle className="h-4 w-4" /> Validar Resultados</CardTitle></CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">
            Marca todos os resultados "lançados" desta prova como "validados". {counts?.launched || 0} pendente(s).
          </p>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" disabled={!counts?.launched || validateResults.isPending}>
                {validateResults.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle className="h-4 w-4 mr-1" />}
                Validar {counts?.launched || 0} resultado(s)
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Validar resultados?</AlertDialogTitle>
                <AlertDialogDescription>{counts?.launched} resultado(s) lançado(s) serão marcados como validados.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => validateResults.mutate()}>Validar</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>

      {/* Publish */}
      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Send className="h-4 w-4" /> Publicar Resultados</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Publica resultados validados vinculando a um Boletim Oficial. {counts?.validated || 0} pendente(s).
          </p>
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="text-xs font-medium mb-1 block">Boletim publicado</label>
              <Select value={selectedBulletinId} onValueChange={setSelectedBulletinId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um boletim..." />
                </SelectTrigger>
                <SelectContent>
                  {bulletins.map((b: any) => (
                    <SelectItem key={b.id} value={b.id}>
                      <span className="flex items-center gap-1"><FileText className="h-3 w-3" /> #{b.number} — {b.title}</span>
                    </SelectItem>
                  ))}
                  {bulletins.length === 0 && (
                    <div className="p-2 text-xs text-muted-foreground">Nenhum boletim publicado.</div>
                  )}
                </SelectContent>
              </Select>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" disabled={!counts?.validated || !selectedBulletinId || publishResults.isPending}>
                  {publishResults.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
                  Publicar {counts?.validated || 0}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Publicar resultados?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {counts?.validated} resultado(s) validado(s) serão publicados e vinculados ao boletim selecionado. Esta ação é definitiva.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => publishResults.mutate()}>Publicar</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
