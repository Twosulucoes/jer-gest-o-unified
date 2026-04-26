import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle,
  SheetDescription,
  SheetFooter
} from "@/components/ui/sheet";
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from "@/components/ui/form";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useModalityReferees } from "@/hooks/useScoreMatches";
import { X, Info, Calendar, Clock, MapPin, UserCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const schema = z.object({
  match_date: z.string().min(1, "Defina a data"),
  start_time: z.string().min(1, "Defina o horário"),
  venue_id: z.string().min(1, "Selecione o local"),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  match?: any;
  sportId: string | undefined;
}

export function MatchCombatFormDrawer({ 
  open, 
  onOpenChange, 
  match, 
  sportId 
}: Props) {
  const qc = useQueryClient();
  const isEditing = !!match;
  
  const { data: referees = [] } = useModalityReferees(sportId);
  
  const { data: venues = [] } = useQuery({
    queryKey: ["venues-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("venues").select("*").eq("is_active", true).order("name");
      if (error) throw error;
      return data;
    }
  });

  const [assignments, setAssignments] = useState<any[]>([]);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      match_date: "",
      start_time: "",
      venue_id: "",
    }
  });

  useEffect(() => {
    if (match) {
      form.reset({
        match_date: match.match_date || "",
        start_time: match.start_time?.slice(0, 5) || "",
        venue_id: match.venue_id || "",
      });

      // Load assignments
      const loadAssignments = async () => {
        const { data } = await supabase
          .from("match_user_assignments" as any)
          .select("*")
          .eq("match_id", match.id);
        if (data) setAssignments(data);
      };
      loadAssignments();
    } else {
      form.reset({
        match_date: "",
        start_time: "",
        venue_id: "",
      });
      setAssignments([]);
    }
  }, [match, form, open]);

  const upsertMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      if (!match?.id) return;

      const matchData = {
        match_date: values.match_date,
        start_time: values.start_time,
        venue_id: values.venue_id,
      };

      const { error } = await supabase
        .from("competition_matches")
        .update(matchData)
        .eq("id", match.id);
      
      if (error) throw error;

      // Upsert Assignments
      await supabase.from("match_user_assignments" as any).delete().eq("match_id", match.id);
      if (assignments.length > 0) {
        await supabase.from("match_user_assignments" as any).insert(
          assignments.map(a => ({
            match_id: match.id,
            user_id: a.user_id,
            role: a.role,
            event_id: match.event_id
          }))
        );
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["combat-matches"] });
      qc.invalidateQueries({ queryKey: ["bracket-phases"] });
      toast.success("Dados da luta atualizados");
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast.error("Erro ao salvar: " + err.message);
    }
  });

  const addReferee = (userId: string) => {
    if (assignments.some(a => a.user_id === userId)) return;
    setAssignments([...assignments, { user_id: userId, role: "arbitro_central" }]);
  };

  const removeReferee = (userId: string) => {
    setAssignments(assignments.filter(a => a.user_id !== userId));
  };

  const updateRefereeRole = (userId: string, role: string) => {
    setAssignments(assignments.map(a => a.user_id === userId ? { ...a, role } : a));
  };

  const ROLES = [
    { value: "arbitro_central", label: "Árbitro Central" },
    { value: "juiz_lateral", label: "Juiz Lateral" },
    { value: "mesario", label: "Mesário" },
    { value: "fiscal", label: "Fiscal" },
  ];

  const athleteA = match?.entries?.find((e: any) => e.side === "A")?.participant?.participant;
  const athleteB = match?.entries?.find((e: any) => e.side === "B")?.participant?.participant;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl flex flex-col h-full p-0">
        <SheetHeader className="p-6 pb-2">
          <SheetTitle>Gerenciar Luta #{match?.match_number}</SheetTitle>
          <SheetDescription>
            Configure a agenda e a equipe de arbitragem para este confronto.
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(v => upsertMutation.mutate(v))} className="flex-1 flex flex-col min-h-0">
            <ScrollArea className="flex-1 px-6">
              <div className="space-y-6 py-4">
                {/* Bloco 1 — Luta (Read Only) */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">1</span>
                    Dados da Luta
                  </h3>
                  
                  <div className="bg-muted/30 p-4 rounded-lg border space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground uppercase font-semibold">Categoria</span>
                      <span className="font-bold">{match?.phase?.name || "Eliminatória"}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 text-center">
                        <div className="text-sm font-bold">{athleteA?.persons?.name || "BYE"}</div>
                        <div className="text-[10px] text-muted-foreground">{athleteA?.delegations?.institutions?.name || "-"}</div>
                      </div>
                      <div className="text-muted-foreground font-bold italic">VS</div>
                      <div className="flex-1 text-center">
                        <div className="text-sm font-bold">{athleteB?.persons?.name || "BYE"}</div>
                        <div className="text-[10px] text-muted-foreground">{athleteB?.delegations?.institutions?.name || "-"}</div>
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Bloco 2 — Agenda */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">2</span>
                    Agenda
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="match_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Data</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="start_time"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Hora de Início</FormLabel>
                          <FormControl>
                            <Input type="time" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="venue_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Local de Competição</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o local" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {venues.map(v => (
                              <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Separator />

                {/* Bloco 3 — Arbitragem */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">3</span>
                    Equipe de Arbitragem
                  </h3>
                  
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <Select onValueChange={addReferee}>
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Adicionar Árbitro..." />
                        </SelectTrigger>
                        <SelectContent>
                          {referees.length === 0 ? (
                            <SelectItem value="none" disabled>Nenhum árbitro vinculado</SelectItem>
                          ) : (
                            referees.filter(r => !assignments.some(a => a.user_id === r.id)).map(r => (
                              <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      {assignments.map(a => {
                        const ref = referees.find(r => r.id === a.user_id);
                        return (
                          <div key={a.user_id} className="flex items-center gap-2 p-2 rounded-lg border bg-background group">
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate">{ref?.name}</div>
                            </div>
                            <Select 
                              value={a.role} 
                              onValueChange={(val) => updateRefereeRole(a.user_id, val)}
                            >
                              <SelectTrigger className="w-[140px] h-8 text-[10px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {ROLES.map(r => (
                                  <SelectItem key={r.value} value={r.value} className="text-[10px]">
                                    {r.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                              onClick={() => removeReferee(a.user_id)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        );
                      })}
                      
                      {assignments.length === 0 && (
                        <p className="text-xs text-center text-muted-foreground py-4 border-2 border-dashed rounded-lg">
                          Nenhum árbitro selecionado para esta luta.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </ScrollArea>

            <SheetFooter className="p-6 border-t bg-muted/20">
              <Button type="submit" className="w-full" disabled={upsertMutation.isPending}>
                {upsertMutation.isPending ? "Salvando..." : "Salvar Alterações"}
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
