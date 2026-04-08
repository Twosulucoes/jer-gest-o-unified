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

const schema = z.object({
  location_id: z.string().min(1, "Selecione um local"),
  name: z.string().min(1, "Nome obrigatório"),
  capacity: z.coerce.number().int().min(1, "Mínimo 1"),
  gender_restriction: z.string(),
  notes: z.string().optional().or(z.literal("")),
  is_active: z.boolean(),
});

export type LodgingUnitFormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unit?: any | null;
  locations: any[];
  onSubmit: (values: LodgingUnitFormValues) => void;
  isPending: boolean;
}

export default function LodgingUnitFormDialog({ open, onOpenChange, unit, locations, onSubmit, isPending }: Props) {
  const isEditing = !!unit;

  const form = useForm<LodgingUnitFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { location_id: "", name: "", capacity: 1, gender_restriction: "mixed", notes: "", is_active: true },
  });

  useEffect(() => {
    if (unit) {
      form.reset({
        location_id: unit.location_id,
        name: unit.name,
        capacity: unit.capacity,
        gender_restriction: unit.gender_restriction,
        notes: unit.notes ?? "",
        is_active: unit.is_active,
      });
    } else {
      form.reset({ location_id: "", name: "", capacity: 1, gender_restriction: "mixed", notes: "", is_active: true });
    }
  }, [unit, form]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Unidade" : "Nova Unidade"}</DialogTitle>
          <DialogDescription>{isEditing ? "Atualize os dados." : "Cadastre uma nova unidade de alojamento."}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="location_id" render={({ field }) => (
              <FormItem>
                <FormLabel>Local</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                  <SelectContent>
                    {locations.filter((l) => l.is_active).map((l) => (
                      <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome</FormLabel>
                  <FormControl><Input placeholder="Quarto 101" {...field} /></FormControl>
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
            <FormField control={form.control} name="gender_restriction" render={({ field }) => (
              <FormItem>
                <FormLabel>Restrição de gênero</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="mixed">Misto</SelectItem>
                    <SelectItem value="male">Masculino</SelectItem>
                    <SelectItem value="female">Feminino</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="is_active" render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel>Ativa</FormLabel>
                  <FormDescription>Unidade disponível para alocação</FormDescription>
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
