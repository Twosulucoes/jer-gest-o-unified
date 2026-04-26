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
import { 
  useModalitySchools, 
  useModalityReferees 
} from "@/hooks/useScoreMatches";
import { X, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

const schema = z.object({
  phase_id: z.string().min(1, "Selecione a fase"),
  group_id: z.string().optional().or(z.literal("")),
  school_a_id: z.string().min(1, "Selecione a Escola A"),
  school_b_id: z.string().min(1, "Selecione a Escola B"),
  match_date: z.string().min(1, "Defina a data"),
  start_time: z.string().min(1, "Defina o horário"),
  venue_id: z.string().min(1, "Selecione o local"),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  match?: any;
  sportEventId: string | undefined;
  sportId: string | undefined;
  phases: any[];
  groups: any[];
}

export function MatchScoreFormDrawer({ 
  open, 
  onOpenChange, 
  match, 
  sportEventId, 
  sportId,
  phases,
  groups 
}: Props) {
  const qc = useQueryClient();
  const isEditing = !!match;
  
  const { data: schools = [] } = useModalitySchools(sportEventId);
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
      phase_id: "",
      group_id: "",
      school_a_id: "",
      school_b_id: "",
      match_date: "",
      start_time: "",
      venue_id: "",
    }
  });

  useEffect(() => {
    if (match) {
      const schoolA = match.match_entries?.[0]?.teams?.delegation_id || "";
      const schoolB = match.match_entries?.[1]?.teams?.delegation_id || "";
      
      form.reset({
        phase_id: match.phase_id,
        group_id: match.group_id || "",
        school_a_id: schoolA,
        school_b_id: schoolB,
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
        phase_id: "",
        group_id: "",
        school_a_id: "",
        school_b_id: "",
        match_date: "",
        start_time: "",
        venue_id: "",
      });
      setAssignments([]);
    }
  }, [match, form, open]);

  const upsertMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      // 1. Upsert Match
      const matchData = {
        sport_event_id: sportEventId,
        event_id: (await supabase.from("sport_events").select("event_id").eq("id", sportEventId!).single()).data?.event_id,
        phase_id: values.phase_id,
        group_id: values.group_id || null,
        match_date: values.match_date,
        start_time: values.start_time,
        venue_id: values.venue_id,
        status: match?.status || "scheduled",
      };

      let mId = match?.id;
      if (isEditing) {
        const { error } = await supabase
          .from("competition_matches")
          .update(matchData)
          .eq("id", mId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("competition_matches")
          .insert(matchData)
          .select("id")
          .single();
        if (error) throw error;
        mId = data.id;
      }

      // 2. Upsert Entries (if not already having results)
      const hasResults = (match?.match_results?.length || 0) > 0;
      if (!hasResults) {
        // Find team IDs for selected schools
        const teamA = schools.find(s => s.school_id === values.school_a_id)?.team_id;
        const teamB = schools.find(s => s.school_id === values.school_b_id)?.team_id;

        if (!teamA || !teamB) throw new Error("Equipes não encontradas para as escolas selecionadas.");

        // Clear old entries and insert new ones
        await supabase.from("competition_match_entries").delete().eq("match_id", mId);
        await supabase.from("competition_match_entries").insert([
          { match_id: mId, team_id: teamA, side: "A" },
          { match_id: mId, team_id: teamB, side: "B" }
        ]);
      }

      // 3. Upsert Assignments
      await supabase.from("match_user_assignments" as any).delete().eq("match_id", mId);
      if (assignments.length > 0) {
        await supabase.from("match_user_assignments" as any).insert(
          assignments.map(a => ({
            match_id: mId,
            user_id: a.user_id,
            role: a.role,
            event_id: matchData.event_id
          }))
        );
      }

      return mId;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["score-matches", sportEventId] });
      toast.success(isEditing ? "Confronto atualizado" : "Confronto criado");
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast.error("Erro ao salvar: " + err.message);
    }
  });

  const schoolA = form.watch("school_a_id");
  const filteredSchoolsB = schools.filter(s => s.school_id !== schoolA);

  const addReferee = (userId: string) => {
    if (assignments.some(a => a.user_id === userId)) return;
    setAssignments([...assignments, { user_id: userId, role: "arbitro_principal" }]);
  };

  const removeReferee = (userId: string) => {
    setAssignments(assignments.filter(a => a.user_id !== userId));
  };

  const updateRefereeRole = (userId: string, role: string) => {
    setAssignments(assignments.map(a => a.user_id === userId ? { ...a, role } : a));
  };

  const ROLES = [
    { value: "arbitro_principal", label: "Árbitro Principal" },
    { value: "arbitro_auxiliar", label: "Árbitro Auxiliar" },
    { value: "mesario", label: "Mesário" },
    { value: "anotador", label: "Anotador" },
    { value: "fiscal", label: "Fiscal" },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl flex flex-col h-full p-0">
        <SheetHeader className="p-6 pb-2">
          <SheetTitle>{isEditing ? "Editar Confronto" : "Novo Confronto"}</SheetTitle>
          <SheetDescription>
            Preencha os detalhes do confronto e arbitragem.
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(v => upsertMutation.mutate(v))} className="flex-1 flex flex-col min-h-0">
            <ScrollArea className="flex-1 px-6">
              <div className="space-y-6 py-4">
                {/* Bloco 1 — Confronto */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">1</span>
                    Confronto
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="phase_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Fase</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {phases.map(p => (
                                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="group_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Grupo (opcional)</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="none">Nenhum</SelectItem>
                              {groups.filter(g => g.phase_id === form.watch("phase_id")).map(g => (
                                <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="space-y-4 pt-2">
                    <FormField
                      control={form.control}
                      name="school_a_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Escola A</FormLabel>
                          <Select 
                            onValueChange={field.onChange} 
                            value={field.value}
                            disabled={isEditing && (match?.match_results?.length || 0) > 0}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione a Escola A" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {schools.map(s => (
                                <SelectItem key={s.school_id} value={s.school_id}>{s.school_name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="school_b_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Escola B</FormLabel>
                          <Select 
                            onValueChange={field.onChange} 
                            value={field.value}
                            disabled={isEditing && (match?.match_results?.length || 0) > 0}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione a Escola B" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {filteredSchoolsB.map(s => (
                                <SelectItem key={s.school_id} value={s.school_id}>{s.school_name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {schools.length === 0 && (
                    <Alert variant="destructive" className="py-2">
                      <Info className="h-4 w-4" />
                      <AlertDescription className="text-[10px]">
                        Nenhuma escola com atletas inscritos encontrada para esta modalidade.
                      </AlertDescription>
                    </Alert>
                  )}
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
                    Arbitragem
                  </h3>
                  
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <Select onValueChange={addReferee} value="">
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Adicionar Árbitro..." />
                        </SelectTrigger>
                        <SelectContent>
                          {referees.filter(r => !assignments.some(a => a.user_id === r.id)).map(r => (
                            <SelectItem key={r.id} value={r.id}>{r.full_name || r.email}</SelectItem>
                          ))}
                          {referees.length === 0 && (
                            <div className="p-2 text-xs text-muted-foreground text-center">Nenhum árbitro vinculado a esta modalidade</div>
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      {assignments.map(a => {
                        const ref = referees.find(r => r.id === a.user_id);
                        return (
                          <div key={a.user_id} className="flex items-center gap-2 bg-muted/50 p-2 rounded-md border text-sm">
                            <div className="flex-1 font-medium truncate">
                              {ref?.full_name || ref?.email || "Usuário"}
                            </div>
                            <Select value={a.role} onValueChange={(r) => updateRefereeRole(a.user_id, r)}>
                              <SelectTrigger className="w-[140px] h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {ROLES.map(role => (
                                  <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button 
                              type="button" 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-destructive"
                              onClick={() => removeReferee(a.user_id)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </ScrollArea>

            <SheetFooter className="p-6 pt-2 border-t bg-muted/20">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={upsertMutation.isPending}>
                {upsertMutation.isPending ? "Salvando..." : isEditing ? "Salvar Alterações" : "Criar Confronto"}
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
