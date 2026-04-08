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

const VEHICLE_TYPE_OPTIONS = [
  { value: "bus", label: "Ônibus" },
  { value: "van", label: "Van" },
  { value: "micro", label: "Micro-ônibus" },
  { value: "car", label: "Carro" },
  { value: "outro", label: "Outro" },
];

const vehicleSchema = z.object({
  event_id: z.string().min(1, "Selecione um evento"),
  plate: z.string().min(2, "Placa obrigatória"),
  label: z.string().optional().or(z.literal("")),
  capacity: z.coerce.number().int().min(1, "Mínimo 1"),
  vehicle_type: z.string().min(1, "Selecione o tipo"),
  is_active: z.boolean(),
});

export type VehicleFormValues = z.infer<typeof vehicleSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicle?: any | null;
  events: Tables<"events">[];
  onSubmit: (values: VehicleFormValues) => void;
  isPending: boolean;
}

export default function VehicleFormDialog({ open, onOpenChange, vehicle, events, onSubmit, isPending }: Props) {
  const isEditing = !!vehicle;

  const form = useForm<VehicleFormValues>({
    resolver: zodResolver(vehicleSchema),
    defaultValues: { event_id: "", plate: "", label: "", capacity: 40, vehicle_type: "bus", is_active: true },
  });

  useEffect(() => {
    if (vehicle) {
      form.reset({
        event_id: vehicle.event_id,
        plate: vehicle.plate,
        label: vehicle.label ?? "",
        capacity: vehicle.capacity,
        vehicle_type: vehicle.vehicle_type,
        is_active: vehicle.is_active,
      });
    } else {
      form.reset({
        event_id: events.length === 1 ? events[0].id : "",
        plate: "", label: "", capacity: 40, vehicle_type: "bus", is_active: true,
      });
    }
  }, [vehicle, events, form]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Veículo" : "Novo Veículo"}</DialogTitle>
          <DialogDescription>{isEditing ? "Atualize os dados do veículo." : "Cadastre um novo veículo."}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="plate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Placa</FormLabel>
                  <FormControl><Input placeholder="ABC-1234" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="vehicle_type" render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>{VEHICLE_TYPE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="label" render={({ field }) => (
                <FormItem>
                  <FormLabel>Rótulo</FormLabel>
                  <FormControl><Input placeholder="Ônibus 01" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="capacity" render={({ field }) => (
                <FormItem>
                  <FormLabel>Capacidade</FormLabel>
                  <FormControl><Input type="number" min={1} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <FormField control={form.control} name="is_active" render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel>Ativo</FormLabel>
                  <FormDescription>Veículo disponível para uso</FormDescription>
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
