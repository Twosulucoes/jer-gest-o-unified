import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEventId } from "@/contexts/EventContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowRight, Copy, Building, UtensilsCrossed, Bus, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function ClonarLogisticaPage() {
  const eventId = useActiveEventId();
  const [sourceId, setSourceId] = useState<string>("");
  const [targetId, setTargetId] = useState<string>("");
  const [includeLodging, setIncludeLodging] = useState(true);
  const [includeMeals, setIncludeMeals] = useState(true);
  const [includeTransport, setIncludeTransport] = useState(true);

  const { data: stages = [] } = useQuery({
    queryKey: ["event_stages_for_clone", eventId],
    queryFn: async () => {
      if (!eventId) return [];
      const { data, error } = await supabase
        .from("event_stages")
        .select("id, name, kind, status")
        .eq("event_id", eventId)
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!eventId,
  });

  const sourceStage = useMemo(() => stages.find((s) => s.id === sourceId), [stages, sourceId]);
  const targetStage = useMemo(() => stages.find((s) => s.id === targetId), [stages, targetId]);

  const cloneMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("clone_logistics_between_stages" as any, {
        p_source_stage_id: sourceId,
        p_target_stage_id: targetId,
        p_include_lodging: includeLodging,
        p_include_meals: includeMeals,
        p_include_transport: includeTransport,
      });
      if (error) throw error;
      return data as any;
    },
    onSuccess: (r) => {
      toast.success("Clonagem concluída", {
        description: `${r.lodging_locations} locais, ${r.lodging_units} quartos, ${r.meal_types} tipos, ${r.meal_windows} janelas, ${r.vehicles} veículos, ${r.routes} rotas.`,
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canRun =
    sourceId &&
    targetId &&
    sourceId !== targetId &&
    (includeLodging || includeMeals || includeTransport);

  return (
    <div className="animate-fade-in space-y-6 max-w-3xl">
      <div>
        <h1 className="font-heading text-2xl font-bold">Clonar logística entre etapas</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Copia a estrutura cadastral de logística (alojamento, alimentação, transporte) de uma etapa para outra.
          Os dados são <strong>adicionados</strong> à etapa destino, sem apagar o que já existe. Não copia ocupações, consumos ou viagens.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. Etapas</CardTitle>
          <CardDescription>Origem e destino devem pertencer ao mesmo evento.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
          <div className="space-y-2">
            <Label>Etapa origem</Label>
            <Select value={sourceId} onValueChange={setSourceId}>
              <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
              <SelectContent>
                {stages.map((s) => (
                  <SelectItem key={s.id} value={s.id} disabled={s.id === targetId}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <ArrowRight className="hidden sm:block h-5 w-5 text-muted-foreground mb-3" />
          <div className="space-y-2">
            <Label>Etapa destino</Label>
            <Select value={targetId} onValueChange={setTargetId}>
              <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
              <SelectContent>
                {stages.map((s) => (
                  <SelectItem key={s.id} value={s.id} disabled={s.id === sourceId}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">2. O que clonar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-accent/40">
            <Checkbox checked={includeLodging} onCheckedChange={(v) => setIncludeLodging(!!v)} />
            <div className="flex-1">
              <div className="flex items-center gap-2 font-medium text-sm">
                <Building className="h-4 w-4 text-primary" /> Alojamento
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">Locais e quartos (sem ocupações).</p>
            </div>
          </label>
          <label className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-accent/40">
            <Checkbox checked={includeMeals} onCheckedChange={(v) => setIncludeMeals(!!v)} />
            <div className="flex-1">
              <div className="flex items-center gap-2 font-medium text-sm">
                <UtensilsCrossed className="h-4 w-4 text-primary" /> Alimentação
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">Tipos de refeição e janelas de serviço (sem consumos).</p>
            </div>
          </label>
          <label className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-accent/40">
            <Checkbox checked={includeTransport} onCheckedChange={(v) => setIncludeTransport(!!v)} />
            <div className="flex-1">
              <div className="flex items-center gap-2 font-medium text-sm">
                <Bus className="h-4 w-4 text-primary" /> Transporte
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">Veículos e rotas (sem viagens nem passageiros).</p>
            </div>
          </label>
        </CardContent>
      </Card>

      {sourceStage && targetStage && (
        <Alert>
          <AlertDescription>
            Vou clonar de <strong>{sourceStage.name}</strong> para <strong>{targetStage.name}</strong>.
            Os registros existentes na etapa destino serão preservados.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex justify-end">
        <Button
          size="lg"
          disabled={!canRun || cloneMutation.isPending}
          onClick={() => cloneMutation.mutate()}
        >
          {cloneMutation.isPending ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Clonando…</>
          ) : (
            <><Copy className="h-4 w-4 mr-2" /> Clonar logística</>
          )}
        </Button>
      </div>
    </div>
  );
}
