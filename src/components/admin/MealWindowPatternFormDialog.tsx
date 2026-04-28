import { useEffect } from "react";
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

const patternSchema = z.object({
  meal_type_id: z.string().min(1, "Selecione o tipo"),
  label: z.string().optional().or(z.literal("")),
  start_time: z.string().min(1, "Hora início obrigatória"),
  end_time: z.string().min(1, "Hora fim obrigatória"),
  meal_window_location_id: z.string().optional().nullable(),
  is_active: z.boolean(),
});

export type MealWindowPatternFormValues = z.infer<typeof patternSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pattern?: any | null;
  mealTypes: any[];
  onSubmit: (values: MealWindowPatternFormValues) => void;
  isPending: boolean;
  eventId: string;
}

export default function MealWindowPatternFormDialog({ open, onOpenChange, pattern, mealTypes, onSubmit, isPending, eventId }: Props) {
  const isEditing = !!pattern;

  const form = useForm<MealWindowPatternFormValues>({
    resolver: zodResolver(patternSchema),
    defaultValues: { 
      meal_type_id: "", 
      label: "", 
      start_time: "", 
      end_time: "", 
      meal_window_location_id: null,
      is_active: true,
    },
  });

  useEffect(() => {
    if (pattern) {
      form.reset({
        meal_type_id: pattern.meal_type_id,
        label: pattern.label ?? "",
        start_time: pattern.start_time?.slice(0, 5) ?? "",
        end_time: pattern.end_time?.slice(0, 5) ?? "",
        meal_window_location_id: pattern.meal_window_location_id ?? null,
        is_active: pattern.is_active ?? true,
      });
    } else {
      form.reset({ 
        meal_type_id: "", 
        label: "", 
        start_time: "", 
        end_time: "", 
        meal_window_location_id: null,
        is_active: true,
      });
    }
  }, [pattern, form, open]);

  // Fetch locations
  const { data: mealLocations = [] } = useQuery({
    queryKey: ["meal_locations_simple", eventId],
    queryFn: async () => {
      const { data } = await supabase.from("meal_locations").select("id, name").eq("event_id", eventId).eq("is_active", true).order("name");
      return data || [];
    },
    enabled: open && !!eventId,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Padrão" : "Novo Padrão de Janela"}</DialogTitle>
          <DialogDescription>
            Defina o horário e local padrão para este tipo de refeição.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                <FormLabel>Rótulo padrão (opcional)</FormLabel>
                <FormControl><Input placeholder="Ex: Café da Manhã" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="meal_window_location_id" render={({ field }) => (
              <FormItem>
                <FormLabel>Local Padrão</FormLabel>
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
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="start_time" render={({ field }) => (
                <FormItem>
                  <FormLabel>Horário Início</FormLabel>
                  <FormControl><Input type="time" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="end_time" render={({ field }) => (
                <FormItem>
                  <FormLabel>Horário Fim</FormLabel>
                  <FormControl><Input type="time" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <FormField control={form.control} name="is_active" render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-md border p-3">
                <div className="space-y-0.5">
                  <FormLabel>Ativo</FormLabel>
                  <FormDescription>Usar este padrão na geração automática</FormDescription>
                </div>
                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
              </FormItem>
            )} />

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
