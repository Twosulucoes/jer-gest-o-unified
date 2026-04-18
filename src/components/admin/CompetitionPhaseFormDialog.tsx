import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form, FormField, FormItem, FormLabel, FormControl, FormMessage,
} from "@/components/ui/form";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const schema = z.object({
  sport_event_id: z.string().min(1, "Selecione a prova"),
  name: z.string().min(2, "Nome obrigatório"),
  phase_type: z.string().min(1),
  sort_order: z.coerce.number().int().min(0),
  status: z.string(),
});

export type PhaseFormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phase?: any | null;
  sportEvents: any[];
  onSubmit: (values: PhaseFormValues) => void;
  isPending: boolean;
}

export default function CompetitionPhaseFormDialog({ open, onOpenChange, phase, sportEvents, onSubmit, isPending }: Props) {
  const isEditing = !!phase;

  const form = useForm<PhaseFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { sport_event_id: "", name: "", phase_type: "group", sort_order: 0, status: "pending" },
  });

  useEffect(() => {
    if (phase) {
      form.reset({
        sport_event_id: phase.sport_event_id,
        name: phase.name,
        phase_type: phase.phase_type,
        sort_order: phase.sort_order,
        status: phase.status,
      });
    } else {
      form.reset({ sport_event_id: "", name: "", phase_type: "group", sort_order: 0, status: "pending" });
    }
  }, [phase, form]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Fase" : "Nova Fase"}</DialogTitle>
          <DialogDescription>{isEditing ? "Atualize os dados da fase." : "Cadastre uma nova fase da competição."}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="sport_event_id" render={({ field }) => (
              <FormItem>
                <FormLabel>Prova</FormLabel>
                <Select onValueChange={field.onChange} value={field.value} disabled={isEditing}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                  <SelectContent>{sportEvents.map((se) => <SelectItem key={se.id} value={se.id}>{se.name}</SelectItem>)}</SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome</FormLabel>
                  <FormControl><Input placeholder="Fase de Grupos" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="phase_type" render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="group">Grupos</SelectItem>
                      <SelectItem value="knockout">Eliminatória</SelectItem>
                      <SelectItem value="final">Final</SelectItem>
                      <SelectItem value="single">Prova única</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="sort_order" render={({ field }) => (
                <FormItem>
                  <FormLabel>Ordem</FormLabel>
                  <FormControl><Input type="number" min={0} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="pending">Pendente</SelectItem>
                      <SelectItem value="in_progress">Em andamento</SelectItem>
                      <SelectItem value="finished">Finalizada</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
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
