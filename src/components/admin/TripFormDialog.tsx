import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form, FormField, FormItem, FormLabel, FormControl, FormMessage,
} from "@/components/ui/form";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const tripSchema = z.object({
  route_id: z.string().min(1, "Selecione uma rota"),
  vehicle_id: z.string().optional().or(z.literal("")),
  driver_name: z.string().optional().or(z.literal("")),
  driver_phone: z.string().optional().or(z.literal("")),
  scheduled_at: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
});

export type TripFormValues = z.infer<typeof tripSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trip?: any | null;
  routes: any[];
  vehicles: any[];
  onSubmit: (values: TripFormValues) => void;
  isPending: boolean;
}

export default function TripFormDialog({ open, onOpenChange, trip, routes, vehicles, onSubmit, isPending }: Props) {
  const isEditing = !!trip;

  const form = useForm<TripFormValues>({
    resolver: zodResolver(tripSchema),
    defaultValues: { route_id: "", vehicle_id: "", driver_name: "", driver_phone: "", scheduled_at: "", notes: "" },
  });

  useEffect(() => {
    if (trip) {
      form.reset({
        route_id: trip.route_id,
        vehicle_id: trip.vehicle_id ?? "",
        driver_name: trip.driver_name ?? "",
        driver_phone: trip.driver_phone ?? "",
        scheduled_at: trip.scheduled_at ? trip.scheduled_at.slice(0, 16) : "",
        notes: trip.notes ?? "",
      });
    } else {
      form.reset({ route_id: "", vehicle_id: "", driver_name: "", driver_phone: "", scheduled_at: "", notes: "" });
    }
  }, [trip, form]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Viagem" : "Nova Viagem"}</DialogTitle>
          <DialogDescription>{isEditing ? "Atualize os dados da viagem." : "Crie uma nova viagem."}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="route_id" render={({ field }) => (
              <FormItem>
                <FormLabel>Rota</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Selecione a rota" /></SelectTrigger></FormControl>
                  <SelectContent>
                    {routes.filter((r) => r.is_active).map((r) => (
                      <SelectItem key={r.id} value={r.id}>{r.name}{r.origin ? ` (${r.origin} → ${r.destination})` : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="vehicle_id" render={({ field }) => (
              <FormItem>
                <FormLabel>Veículo (opcional)</FormLabel>
                <Select onValueChange={(v) => field.onChange(v === "__none__" ? "" : v)} value={field.value || "__none__"}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="__none__">Nenhum</SelectItem>
                    {vehicles.filter((v) => v.is_active).map((v) => (
                      <SelectItem key={v.id} value={v.id}>{v.label || v.plate} ({v.capacity} lugares)</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="driver_name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Motorista</FormLabel>
                  <FormControl><Input placeholder="Nome" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="driver_phone" render={({ field }) => (
                <FormItem>
                  <FormLabel>Telefone</FormLabel>
                  <FormControl><Input placeholder="(99) 99999-9999" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <FormField control={form.control} name="scheduled_at" render={({ field }) => (
              <FormItem>
                <FormLabel>Data/Hora prevista</FormLabel>
                <FormControl><Input type="datetime-local" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem>
                <FormLabel>Observações</FormLabel>
                <FormControl><Textarea placeholder="Detalhes opcionais..." {...field} /></FormControl>
                <FormMessage />
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
