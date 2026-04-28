import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
});

export type MealWindowFormValues = z.infer<typeof windowSchema> & { eligibility_rules?: any[] };

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  window?: any | null;
  mealTypes: any[];
  onSubmit: (values: MealWindowFormValues) => void;
  isPending: boolean;
}

export default function MealWindowFormDialog({ open, onOpenChange, window: mealWindow, mealTypes, onSubmit, isPending }: Props) {
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
      service_date: "", 
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

  // Fetch current rules if editing
  const { data: existingRules } = useQuery({
    queryKey: ["meal_window_eligibility", (mealWindow as any)?.id],
    queryFn: async () => {
      if (!mealWindow?.id) return [];
      const { data, error } = await (supabase as any).from("meal_window_eligibility")
        .select(`
          *,
          delegations(school_name),
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

  useEffect(() => {
    if (mealWindow) {
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
      form.reset({ 
        meal_type_id: "", 
        label: "", 
        service_date: "", 
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

  // Fetch locations
  const { data: mealLocations = [] } = useQuery({
    queryKey: ["meal_locations_simple", mealWindow?.event_id],
    queryFn: async () => {
      const { data } = await (supabase as any).from("meal_locations").select("id, name").eq("is_active", true).order("name");
      return data || [];
    },
    enabled: open,
  });

  // Fetch delegations for rules
  const { data: delegations = [] } = useQuery({
    queryKey: ["delegations_simple"],
    queryFn: async () => {
      const { data } = await supabase.from("delegations").select("id, school_name").order("school_name");
      return data || [];
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
                  <FormLabel>Rótulo (opcional)</FormLabel>
                  <FormControl><Input placeholder="Ex: Almoço - Dia 1" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="service_date" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="meal_window_location_id" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Local de Refeição</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um local" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {mealLocations.map((l: any) => (
                          <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
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
