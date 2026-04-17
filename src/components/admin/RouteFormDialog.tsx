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
import { Textarea } from "@/components/ui/textarea";
import {
  Form, FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription,
} from "@/components/ui/form";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { Tables } from "@/integrations/supabase/types";

const routeSchema = z.object({
  event_id: z.string().min(1, "Selecione um evento"),
  name: z.string().min(2, "Nome obrigatório"),
  origin: z.string().optional().or(z.literal("")),
  destination: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
  is_active: z.boolean(),
});

export type RouteFormValues = z.infer<typeof routeSchema>;

import type { StageContext } from "@/components/admin/VehicleFormDialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  route?: any | null;
  events: Tables<"events">[];
  stageContext?: StageContext;
  onSubmit: (values: RouteFormValues) => void;
  isPending: boolean;
}

export default function RouteFormDialog({ open, onOpenChange, route, events, stageContext, onSubmit, isPending }: Props) {
  const isEditing = !!route;

  const form = useForm<RouteFormValues>({
    resolver: zodResolver(routeSchema),
    defaultValues: { event_id: "", name: "", origin: "", destination: "", notes: "", is_active: true },
  });

  useEffect(() => {
    const defaultEventId = stageContext?.event_id ?? (events.length === 1 ? events[0].id : "");
    if (route) {
      form.reset({
        event_id: route.event_id,
        name: route.name,
        origin: route.origin ?? "",
        destination: route.destination ?? "",
        notes: route.notes ?? "",
        is_active: route.is_active,
      });
    } else {
      form.reset({
        event_id: defaultEventId,
        name: "", origin: "", destination: "", notes: "", is_active: true,
      });
    }
  }, [route, events, stageContext, form]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Rota" : "Nova Rota"}</DialogTitle>
          <DialogDescription>{isEditing ? "Atualize os dados da rota." : "Cadastre uma nova rota."}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {stageContext ? (
              <div className="rounded-md bg-muted px-3 py-2 text-sm flex items-center gap-2">
                <span className="text-muted-foreground">Etapa:</span>
                <span className="font-medium">{stageContext.name}</span>
              </div>
            ) : (
              <FormField control={form.control} name="event_id" render={({ field }) => (
                <FormItem>
                  <FormLabel>Evento</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={isEditing}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                    <SelectContent>{events.map((e) => <SelectItem key={e.id} value={e.id}>{e.name} ({e.year})</SelectItem>)}</SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            )}
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>Nome da Rota</FormLabel>
                <FormControl><Input placeholder="Hotel → Ginásio" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="origin" render={({ field }) => (
                <FormItem>
                  <FormLabel>Origem</FormLabel>
                  <FormControl><Input placeholder="Hotel X" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="destination" render={({ field }) => (
                <FormItem>
                  <FormLabel>Destino</FormLabel>
                  <FormControl><Input placeholder="Ginásio Y" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem>
                <FormLabel>Observações</FormLabel>
                <FormControl><Textarea placeholder="Detalhes opcionais..." {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="is_active" render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel>Ativa</FormLabel>
                  <FormDescription>Rota disponível para viagens</FormDescription>
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
