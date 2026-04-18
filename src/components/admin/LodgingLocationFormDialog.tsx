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
import type { Tables } from "@/integrations/supabase/types";
import type { StageContext } from "@/components/admin/VehicleFormDialog";

const schema = z.object({
  event_id: z.string().min(1, "Selecione um evento"),
  name: z.string().min(2, "Nome obrigatório"),
  address: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
  is_active: z.boolean(),
});

export type LodgingLocationFormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  location?: any | null;
  events: Tables<"events">[];
  stageContext?: StageContext;
  onSubmit: (values: LodgingLocationFormValues) => void;
  isPending: boolean;
}

export default function LodgingLocationFormDialog({ open, onOpenChange, location, events, stageContext, onSubmit, isPending }: Props) {
  const isEditing = !!location;

  const form = useForm<LodgingLocationFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { event_id: "", name: "", address: "", notes: "", is_active: true },
  });

  useEffect(() => {
    const defaultEventId = stageContext?.event_id ?? (events.length === 1 ? events[0].id : "");
    if (location) {
      form.reset({
        event_id: location.event_id,
        name: location.name,
        address: location.address ?? "",
        notes: location.notes ?? "",
        is_active: location.is_active,
      });
    } else {
      form.reset({
        event_id: defaultEventId,
        name: "", address: "", notes: "", is_active: true,
      });
    }
  }, [location, events, stageContext, form]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Local" : "Novo Local de Alojamento"}</DialogTitle>
          <DialogDescription>{isEditing ? "Atualize os dados." : "Cadastre um novo local."}</DialogDescription>
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
                <FormLabel>Nome</FormLabel>
                <FormControl><Input placeholder="Escola Municipal XYZ" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="address" render={({ field }) => (
              <FormItem>
                <FormLabel>Endereço (opcional)</FormLabel>
                <FormControl><Input placeholder="Rua..." {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem>
                <FormLabel>Observações (opcional)</FormLabel>
                <FormControl><Input placeholder="Obs..." {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="is_active" render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel>Ativo</FormLabel>
                  <FormDescription>Local disponível para operação</FormDescription>
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
