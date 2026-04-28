import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEventId } from "@/contexts/EventContext";
import { useRegistros } from "@/hooks/useRegistros";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";

const schema = z.object({
  sport_event_id: z.string().min(1, "Selecione a modalidade/prova"),
  venue_id: z.string().min(1, "Selecione o local"),
  match_date: z.string().min(1, "Informe a data"),
  start_time: z.string().min(1, "Informe a hora"),
  team_a_id: z.string().min(1, "Selecione a equipe A"),
  team_b_id: z.string().min(1, "Selecione a equipe B"),
  score_a: z.coerce.number().min(0).optional(),
  score_b: z.coerce.number().min(0).optional(),
  outcome_a: z.string().optional(),
  outcome_b: z.string().optional(),
  status: z.string().default("scheduled"),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function RegistroFormDialog({ open, onOpenChange }: Props) {
  const eventId = useActiveEventId();
  const { createMatch } = useRegistros();
  const [activeStep, setActiveStep] = useState("info");

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      status: "scheduled",
      score_a: 0,
      score_b: 0,
      outcome_a: "draw",
      outcome_b: "draw"
    }
  });

  const selectedSportEventId = form.watch("sport_event_id");

  // Queries
  const { data: sportEvents = [] } = useQuery({
    queryKey: ["registros-sport-events", eventId],
    queryFn: async () => {
      const { data, error } = await supabase.from("sport_events").select("*").eq("event_id", eventId).eq("is_active", true).order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!eventId && open
  });

  const { data: venues = [] } = useQuery({
    queryKey: ["registros-venues", eventId],
    queryFn: async () => {
      const { data, error } = await supabase.from("venues").select("*").eq("event_id", eventId).is("deleted_at", null).order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!eventId && open
  });

  const { data: teams = [] } = useQuery({
    queryKey: ["registros-teams", eventId, selectedSportEventId],
    queryFn: async () => {
      if (!selectedSportEventId) return [];
      const { data, error } = await supabase
        .from("teams")
        .select("*, delegation:delegations(school_name)")
        .eq("event_id", eventId)
        .eq("sport_event_id", selectedSportEventId)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!eventId && !!selectedSportEventId && open
  });

  const onSubmit = (values: FormValues) => {
    // Determine outcomes based on scores if not manually set
    const val = { ...values };
    if (val.score_a !== undefined && val.score_b !== undefined) {
      if (val.score_a > val.score_b) {
        val.outcome_a = "vitoria";
        val.outcome_b = "derrota";
      } else if (val.score_b > val.score_a) {
        val.outcome_a = "derrota";
        val.outcome_b = "vitoria";
      } else {
        val.outcome_a = "empate";
        val.outcome_b = "empate";
      }
      val.status = "finished";
    }

    createMatch.mutate(val, {
      onSuccess: () => {
        onOpenChange(false);
        form.reset();
        setActiveStep("info");
      }
    });
  };

  useEffect(() => {
    if (!open) {
      form.reset();
      setActiveStep("info");
    }
  }, [open, form]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Novo Registro Simplificado</DialogTitle>
          <DialogDescription>
            Cadastre uma partida e seu resultado de forma rápida.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <Tabs value={activeStep} onValueChange={setActiveStep} className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="info">Informações</TabsTrigger>
                <TabsTrigger value="teams" disabled={!selectedSportEventId}>Equipes</TabsTrigger>
                <TabsTrigger value="result" disabled={!selectedSportEventId}>Resultado</TabsTrigger>
              </TabsList>

              <TabsContent value="info" className="space-y-4 py-4">
                <FormField control={form.control} name="sport_event_id" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Modalidade / Prova</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger></FormControl>
                      <SelectContent>{sportEvents.map(se => <SelectItem key={se.id} value={se.id}>{se.name}</SelectItem>)}</SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="venue_id" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Local</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger></FormControl>
                      <SelectContent>{venues.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="match_date" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data</FormLabel>
                      <FormControl><Input type="date" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="start_time" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Hora</FormLabel>
                      <FormControl><Input type="time" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <div className="flex justify-end pt-2">
                  <Button type="button" onClick={() => setActiveStep("teams")} disabled={!selectedSportEventId}>Próximo: Equipes</Button>
                </div>
              </TabsContent>

              <TabsContent value="teams" className="space-y-4 py-4">
                <FormField control={form.control} name="team_a_id" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Equipe A (Casa)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger></FormControl>
                      <SelectContent>
                        {teams.map(t => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name} ({(t.delegation as any)?.school_name || "Sem delegação"})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                <div className="text-center font-bold text-muted-foreground">VERSUS</div>

                <FormField control={form.control} name="team_b_id" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Equipe B (Visitante)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger></FormControl>
                      <SelectContent>
                        {teams.map(t => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name} ({(t.delegation as any)?.school_name || "Sem delegação"})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="flex justify-between pt-2">
                  <Button type="button" variant="ghost" onClick={() => setActiveStep("info")}>Voltar</Button>
                  <Button type="button" onClick={() => setActiveStep("result")}>Próximo: Resultado</Button>
                </div>
              </TabsContent>

              <TabsContent value="result" className="space-y-4 py-4">
                <div className="bg-muted p-4 rounded-lg space-y-4">
                  <div className="grid grid-cols-2 gap-8 items-center">
                    <div className="space-y-2">
                      <p className="font-bold text-center truncate">
                        {teams.find(t => t.id === form.watch("team_a_id"))?.name || "Equipe A"}
                      </p>
                      <FormField control={form.control} name="score_a" render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input type="number" className="text-center text-2xl font-black h-16" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                    <div className="space-y-2">
                      <p className="font-bold text-center truncate">
                        {teams.find(t => t.id === form.watch("team_b_id"))?.name || "Equipe B"}
                      </p>
                      <FormField control={form.control} name="score_b" render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input type="number" className="text-center text-2xl font-black h-16" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                  </div>
                  <p className="text-xs text-center text-muted-foreground italic">
                    O status da partida será alterado para "Finalizada" automaticamente.
                  </p>
                </div>
                <div className="flex justify-between pt-2">
                  <Button type="button" variant="ghost" onClick={() => setActiveStep("teams")}>Voltar</Button>
                  <Button type="submit" disabled={createMatch.isPending}>
                    {createMatch.isPending ? "Gravando..." : "Confirmar e Gravar"}
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
