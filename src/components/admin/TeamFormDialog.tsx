import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const schema = z.object({
  sport_event_id: z.string().min(1, "Selecione a prova"),
  delegation_id: z.string().min(1, "Selecione a delegação"),
  name: z.string().min(1, "Nome obrigatório"),
  status: z.string(),
  notes: z.string().optional().or(z.literal("")),
});

export type TeamFormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  team?: any | null;
  sportEvents: any[];
  delegations: any[];
  onSubmit: (values: TeamFormValues) => void;
  isPending: boolean;
}

export default function TeamFormDialog({ open, onOpenChange, team, sportEvents, delegations, onSubmit, isPending }: Props) {
  const isEditing = !!team;

  const form = useForm<TeamFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { sport_event_id: "", delegation_id: "", name: "", status: "active", notes: "" },
  });

  useEffect(() => {
    if (team) {
      form.reset({
        sport_event_id: team.sport_event_id,
        delegation_id: team.delegation_id,
        name: team.name,
        status: team.status,
        notes: team.notes ?? "",
      });
    } else {
      form.reset({ sport_event_id: "", delegation_id: "", name: "", status: "active", notes: "" });
    }
  }, [team, form]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Equipe" : "Nova Equipe"}</DialogTitle>
          <DialogDescription>{isEditing ? "Atualize os dados da equipe." : "Cadastre uma nova equipe."}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="sport_event_id" render={({ field }) => (
              <FormItem>
                <FormLabel>Prova / Modalidade</FormLabel>
                <Select onValueChange={field.onChange} value={field.value} disabled={isEditing}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                  <SelectContent>{sportEvents.map((se: any) => <SelectItem key={se.id} value={se.id}>{se.name}</SelectItem>)}</SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="delegation_id" render={({ field }) => (
              <FormItem>
                <FormLabel>Delegação</FormLabel>
                <Select onValueChange={field.onChange} value={field.value} disabled={isEditing}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                  <SelectContent>{delegations.map((d: any) => <SelectItem key={d.id} value={d.id}>{(d as any).institutions?.name ?? d.id}</SelectItem>)}</SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>Nome da equipe</FormLabel>
                <FormControl><Input placeholder="Ex: Escola X — Futsal Masc." {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="status" render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="active">Ativa</SelectItem>
                    <SelectItem value="inactive">Inativa</SelectItem>
                  </SelectContent>
                </Select>
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
