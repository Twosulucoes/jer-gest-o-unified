import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form, FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription,
} from "@/components/ui/form";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const windowSchema = z.object({
  meal_type_id: z.string().min(1, "Selecione o tipo"),
  label: z.string().optional().or(z.literal("")),
  service_date: z.string().min(1, "Data obrigatória"),
  start_time: z.string().min(1, "Hora início obrigatória"),
  end_time: z.string().min(1, "Hora fim obrigatória"),
  location: z.string().optional().or(z.literal("")),
  is_active: z.boolean(),
});

export type MealWindowFormValues = z.infer<typeof windowSchema>;

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

  const form = useForm<MealWindowFormValues>({
    resolver: zodResolver(windowSchema),
    defaultValues: { meal_type_id: "", label: "", service_date: "", start_time: "", end_time: "", location: "", is_active: true },
  });

  useEffect(() => {
    if (mealWindow) {
      form.reset({
        meal_type_id: mealWindow.meal_type_id,
        label: mealWindow.label ?? "",
        service_date: mealWindow.service_date,
        start_time: mealWindow.start_time?.slice(0, 5) ?? "",
        end_time: mealWindow.end_time?.slice(0, 5) ?? "",
        location: mealWindow.location ?? "",
        is_active: mealWindow.is_active,
      });
    } else {
      form.reset({ meal_type_id: "", label: "", service_date: "", start_time: "", end_time: "", location: "", is_active: true });
    }
  }, [mealWindow, form]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Janela" : "Nova Janela de Refeição"}</DialogTitle>
          <DialogDescription>{isEditing ? "Atualize os dados da janela." : "Crie uma nova janela de serviço."}</DialogDescription>
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
                <FormLabel>Rótulo (opcional)</FormLabel>
                <FormControl><Input placeholder="Ex: Almoço - Dia 1" {...field} /></FormControl>
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
            <FormField control={form.control} name="location" render={({ field }) => (
              <FormItem>
                <FormLabel>Local / Refeitório</FormLabel>
                <FormControl><Input placeholder="Refeitório principal" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="is_active" render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel>Ativa</FormLabel>
                  <FormDescription>Janela disponível para operação</FormDescription>
                </div>
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
