import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form, FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription,
} from "@/components/ui/form";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Trash2, Plus, Users, School, UserCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const windowSchema = z.object({
  meal_type_id: z.string().min(1, "Selecione o tipo"),
  label: z.string().optional().or(z.literal("")),
  service_date: z.string().min(1, "Data obrigatória"),
  start_time: z.string().min(1, "Hora início obrigatória"),
  end_time: z.string().min(1, "Hora fim obrigatória"),
  location: z.string().optional().or(z.literal("")),
  meal_window_location_id: z.string().optional().nullable(),
  capacity: z.coerce.number().min(0).optional().nullable(),
  is_active: z.boolean(),
  restrict_eligibility: z.boolean(),
}).refine((data) => !data.start_time || !data.end_time || data.end_time > data.start_time, {
  // mealWindowStatus.ts (src/lib/mealWindowStatus.ts) assume start_time/
  // end_time no mesmo service_date, sem suporte a janela atravessando a
  // meia-noite — se end_time <= start_time, o cálculo de "encerrada" trata
  // o fim como um instante ANTERIOR ao início no mesmo dia, então a janela
  // aparece "Encerrada" assim que deveria abrir. Uma refeição noturna que
  // cruza a meia-noite precisa ser cadastrada como duas janelas separadas.
  message: "Hora de fim deve ser depois da hora de início (janelas não podem atravessar a meia-noite — cadastre como duas janelas separadas se necessário)",
  path: ["end_time"],
});

export type MealWindowFormValues = z.infer<typeof windowSchema> & { eligibility_rules?: any[] };

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  window?: any | null;
  mealTypes: any[];
  onSubmit: (values: MealWindowFormValues) => void;
  isPending: boolean;
  eventId?: string | null;
  stageId?: string | null;
}

function todayRoraima(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Boa_Vista" });
}

export default function MealWindowFormDialog({ open, onOpenChange, window: mealWindow, mealTypes, onSubmit, isPending, eventId, stageId }: Props) {
  const isEditing = !!mealWindow;
  // No query client needed here as we are just setting state
  const [rules, setRules] = useState<any[]>([]);
  const [ruleType, setRuleType] = useState<string>("participant_type");
  const [ruleValue, setRuleValue] = useState<string>("");
  const [ruleRefId, setRuleRefId] = useState<string>("");

  const form = useForm<MealWindowFormValues>({
    resolver: zodResolver(windowSchema),
    defaultValues: {
      meal_type_id: "",
      label: "",
      service_date: todayRoraima(),
      start_time: "",
      end_time: "",
      location: "",
      meal_window_location_id: null,
      capacity: null,
      is_active: true,
      restrict_eligibility: false
    },
  });

  const restrictEligibility = form.watch("restrict_eligibility");
  const watchedMealTypeId = form.watch("meal_type_id");

  // Fetch current rules if editing
  const { data: existingRules } = useQuery({
    queryKey: ["meal_window_eligibility", (mealWindow as any)?.id],
    queryFn: async () => {
      if (!mealWindow?.id) return [];
      const { data, error } = await (supabase as any).from("meal_window_eligibility")
        .select(`
          *,
          delegations(institutions(name)),
          institutions(name)
        `)
        .eq("meal_window_id", mealWindow.id);
      if (error) throw error;
      return data;
    },
    enabled: !!mealWindow?.id && open,
  });

  useEffect(() => {
    if (existingRules) {
      setRules(existingRules);
      if (existingRules.length > 0) {
        form.setValue("restrict_eligibility", true);
      }
    }
  }, [existingRules, form]);

  const labelUserEdited = useRef(false);

  useEffect(() => {
    if (mealWindow) {
      labelUserEdited.current = true;
      form.reset({
        meal_type_id: mealWindow.meal_type_id,
        label: mealWindow.label ?? "",
        service_date: mealWindow.service_date,
        start_time: mealWindow.start_time?.slice(0, 5) ?? "",
        end_time: mealWindow.end_time?.slice(0, 5) ?? "",
        location: mealWindow.location ?? "",
        meal_window_location_id: mealWindow.meal_window_location_id ?? null,
        capacity: mealWindow.capacity ?? null,
        is_active: mealWindow.is_active,
        restrict_eligibility: false,
      });
    } else {
      labelUserEdited.current = false;
      form.reset({
        meal_type_id: "",
        label: "",
        service_date: todayRoraima(),
        start_time: "",
        end_time: "",
        location: "",
        meal_window_location_id: null,
        capacity: null,
        is_active: true,
        restrict_eligibility: false
      });
      setRules([]);
    }
  }, [mealWindow, form]);

  // Auto-sugere rótulo a partir do tipo de refeição quando ainda não editado
  useEffect(() => {
    if (!watchedMealTypeId || labelUserEdited.current) return;
    const mt = mealTypes.find((m) => m.id === watchedMealTypeId);
    if (mt) form.setValue("label", mt.name);
  }, [watchedMealTypeId, mealTypes, form]);

  // Fetch locations scoped to the current event and stage
  const resolvedEventId = eventId ?? mealWindow?.event_id ?? null;
  const resolvedStageId = stageId ?? mealWindow?.event_stage_id ?? null;
  const { data: mealLocations = [], isFetching: isLocationsFetching } = useQuery({
    queryKey: ["meal_locations_simple", resolvedEventId, resolvedStageId],
    queryFn: async () => {
      if (!resolvedEventId) return [];
      let q = (supabase as any).from("meal_locations")
        .select("id, name")
        .eq("is_active", true)
        .eq("event_id", resolvedEventId);
      if (resolvedStageId) q = q.eq("event_stage_id", resolvedStageId);
      const { data, error } = await q.order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!resolvedEventId,
  });

  // Fetch delegations for rules — nome vem de institutions (canônico)
  const { data: delegations = [] } = useQuery({
    queryKey: ["delegations_simple"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("delegations")
        .select("id, institutions(name)");
      return ((data || []) as any[])
        .map((d) => ({ id: d.id as string, school_name: (d.institutions?.name ?? "") as string }))
        .sort((a, b) => a.school_name.localeCompare(b.school_name));
    },
    enabled: open && ruleType === "delegation",
  });

  // Fetch institutions for rules
  const { data: institutions = [] } = useQuery({
    queryKey: ["institutions_simple"],
    queryFn: async () => {
      const { data } = await supabase.from("institutions").select("id, name").order("name");
      return data || [];
    },
    enabled: open && ruleType === "institution",
  });

  const addRule = () => {
    if (ruleType === "participant_type" && !ruleValue) return;
    if ((ruleType === "delegation" || ruleType === "institution") && !ruleRefId) return;

    const newRule: any = {
      id: `temp-${Date.now()}`,
      eligibility_type: ruleType,
      participant_type_value: ruleType === "participant_type" ? ruleValue : null,
      reference_id: (ruleType === "delegation" || ruleType === "institution") ? ruleRefId : null,
    };

    // Add display names
    if (ruleType === "delegation") {
      newRule.delegations = { school_name: delegations.find(d => d.id === ruleRefId)?.school_name };
    } else if (ruleType === "institution") {
      newRule.institutions = { name: institutions.find(i => i.id === ruleRefId)?.name };
    }

    setRules([...rules, newRule]);
    setRuleValue("");
    setRuleRefId("");
  };

  const removeRule = (id: string) => {
    setRules(rules.filter(r => r.id !== id));
  };

  const handleFormSubmit = (values: MealWindowFormValues) => {
    onSubmit({ ...values, eligibility_rules: restrictEligibility ? rules : [] });
  };

  const participantTypes = [
    { value: "athlete", label: "Atleta" },
    { value: "coach", label: "Técnico" },
    { value: "head_of_delegation", label: "Dirigente" },
    { value: "staff", label: "Staff" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Janela" : "Nova Janela de Refeição"}</DialogTitle>
          <DialogDescription>{isEditing ? "Atualize os dados da janela." : "Crie uma nova janela de serviço."}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
            <div className="space-y-4">
              <FormField control={form.control} name="meal_type_id" render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Refeição</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {mealTypes.filter((m) => m.is_active).map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="label" render={({ field }) => (
                <FormItem>
                  <FormLabel>Rótulo</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ex: Almoço - Dia 1"
                      {...field}
                      onChange={(e) => {
                        labelUserEdited.current = true;
                        field.onChange(e);
                      }}
                    />
                  </FormControl>
                  <FormDescription>Sugerido automaticamente pelo tipo; edite se precisar diferenciar</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="service_date" render={({ field }) => (
                <FormItem>
                  <FormLabel>Data</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="start_time" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Início</FormLabel>
                    <FormControl><Input type="time" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="end_time" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fim</FormLabel>
                    <FormControl><Input type="time" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="meal_window_location_id" render={({ field }) => (
                <FormItem>
                  <FormLabel>Local de Refeição</FormLabel>
                  {isLocationsFetching ? (
                    <Skeleton className="h-10 w-full" />
                  ) : mealLocations.length > 0 ? (
                    <Select
                      onValueChange={(v) => field.onChange(v === "__none__" ? null : v)}
                      value={field.value || "__none__"}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um local" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">Sem local definido</SelectItem>
                        {mealLocations.map((l: any) => (
                          <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <FormControl>
                      <Input
                        placeholder="Ex: Refeitório Central (nenhum local cadastrado no sistema)"
                        value={form.watch("location") ?? ""}
                        onChange={(e) => form.setValue("location", e.target.value)}
                      />
                    </FormControl>
                  )}
                  <FormDescription>
                    {isLocationsFetching
                      ? "Carregando locais..."
                      : mealLocations.length === 0
                      ? "Nenhum local cadastrado. Cadastre locais em Configurações → Locais de Refeição para usar a lista."
                      : "Local onde a refeição será servida"}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="capacity" render={({ field }) => (
                <FormItem>
                  <FormLabel>Capacidade da Janela (opcional)</FormLabel>
                  <FormControl><Input type="number" placeholder="Limite de refeições" {...field} value={field.value || ""} /></FormControl>
                  <FormDescription>Limite informativo para o operador no PWA</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="is_active" render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-md border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>Ativa</FormLabel>
                    <FormDescription>Janela disponível para operação</FormDescription>
                  </div>
                  <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                </FormItem>
              )} />
            </div>

            <div className="space-y-4 pt-4 border-t">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h3 className="text-sm font-bold">Direitos de Consumo</h3>
                  <p className="text-xs text-muted-foreground">Restringir quem pode consumir nesta janela</p>
                </div>
                <FormField control={form.control} name="restrict_eligibility" render={({ field }) => (
                  <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                )} />
              </div>

              {restrictEligibility && (
                <div className="space-y-4 bg-muted/30 p-4 rounded-lg">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <Select value={ruleType} onValueChange={setRuleType}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="participant_type">Por Perfil</SelectItem>
                        <SelectItem value="delegation">Por Delegação</SelectItem>
                        <SelectItem value="institution">Por Instituição</SelectItem>
                      </SelectContent>
                    </Select>

                    {ruleType === "participant_type" ? (
                      <Select value={ruleValue} onValueChange={setRuleValue}>
                        <SelectTrigger><SelectValue placeholder="Selecione tipo" /></SelectTrigger>
                        <SelectContent>
                          {participantTypes.map(pt => (
                            <SelectItem key={pt.value} value={pt.value}>{pt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : ruleType === "delegation" ? (
                      <Select value={ruleRefId} onValueChange={setRuleRefId}>
                        <SelectTrigger><SelectValue placeholder="Selecione delegação" /></SelectTrigger>
                        <SelectContent>
                          {delegations.map(d => (
                            <SelectItem key={d.id} value={d.id}>{d.school_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Select value={ruleRefId} onValueChange={setRuleRefId}>
                        <SelectTrigger><SelectValue placeholder="Selecione inst." /></SelectTrigger>
                        <SelectContent>
                          {institutions.map(i => (
                            <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}

                    <Button type="button" onClick={addRule} variant="outline" className="w-full">
                      <Plus className="h-4 w-4 mr-1" /> Adicionar
                    </Button>
                  </div>

                  <div className="space-y-2">
                    {rules.length === 0 ? (
                      <p className="text-xs text-center text-muted-foreground italic py-2">Nenhuma regra adicionada. A janela será restrita mas ninguém poderá consumir.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {rules.map((rule) => (
                          <Badge key={rule.id} variant="secondary" className="py-1 px-2 gap-2">
                            {rule.eligibility_type === "participant_type" && (
                              <span className="flex items-center gap-1">
                                <UserCircle className="h-3 w-3" /> {participantTypes.find(p => p.value === rule.participant_type_value)?.label}
                              </span>
                            )}
                            {rule.eligibility_type === "delegation" && (
                              <span className="flex items-center gap-1">
                                <Users className="h-3 w-3" /> {rule.delegations?.school_name}
                              </span>
                            )}
                            {rule.eligibility_type === "institution" && (
                              <span className="flex items-center gap-1">
                                <School className="h-3 w-3" /> {rule.institutions?.name}
                              </span>
                            )}
                            <button type="button" onClick={() => removeRule(rule.id)} className="hover:text-destructive">
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={isPending}>{isPending ? "Salvando..." : isEditing ? "Salvar" : "Criar"}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
