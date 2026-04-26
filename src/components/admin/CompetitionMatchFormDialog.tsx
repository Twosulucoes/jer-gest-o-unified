import { useEffect, useState } from "react";
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
import { Plus } from "lucide-react";
import VenueFormDialog, { type VenueFormValues } from "./VenueFormDialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const schema = z.object({
  phase_id: z.string().min(1, "Selecione a fase"),
  group_id: z.string().optional().or(z.literal("")),
  match_number: z.coerce.number().int().optional(),
  match_date: z.string().optional().or(z.literal("")),
  start_time: z.string().optional().or(z.literal("")),
  venue_id: z.string().optional().or(z.literal("")),
  status: z.string(),
  notes: z.string().optional().or(z.literal("")),
});

export type MatchFormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  match?: any | null;
  phases: any[];
  groups: any[];
  venues: any[];
  events: any[];
  onSubmit: (values: MatchFormValues) => void;
  isPending: boolean;
}

export default function CompetitionMatchFormDialog({ open, onOpenChange, match, phases, groups, venues, events, onSubmit, isPending }: Props) {
  const isEditing = !!match;
  const qc = useQueryClient();
  const [venueDialogOpen, setVenueDialogOpen] = useState(false);

  const form = useForm<MatchFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { phase_id: "", group_id: "", match_number: undefined, match_date: "", start_time: "", venue_id: "", status: "scheduled", notes: "" },
  });

  useEffect(() => {
    if (match) {
      form.reset({
        phase_id: match.phase_id,
        group_id: match.group_id ?? "",
        match_number: match.match_number ?? undefined,
        match_date: match.match_date ?? "",
        start_time: match.start_time?.slice(0, 5) ?? "",
        venue_id: match.venue_id ?? "",
        status: match.status,
        notes: match.notes ?? "",
      });
    } else {
      form.reset({ phase_id: "", group_id: "", match_number: undefined, match_date: "", start_time: "", venue_id: "", status: "scheduled", notes: "" });
    }
  }, [match, form]);

  const watchPhaseId = form.watch("phase_id");
  const phaseGroups = groups.filter((g) => g.phase_id === watchPhaseId);

  const createVenueMut = useMutation({
    mutationFn: async (values: VenueFormValues) => {
      const payload = {
        event_id: values.event_id,
        name: values.name,
        venue_type: values.venue_type,
        city: values.city || null,
        address: values.address || null,
        is_active: values.is_active,
        event_stage_id: values.event_stage_ids[0] ?? null,
      };

      const { data, error } = await supabase
        .from("venues")
        .insert(payload as any)
        .select("id")
        .single();
      
      if (error) throw error;

      if (values.event_stage_ids.length > 0) {
        const rows = values.event_stage_ids.map((sid) => ({ 
          venue_id: data.id, 
          event_stage_id: sid 
        }));
        const { error: insErr } = await (supabase as any)
          .from("venue_event_stages")
          .insert(rows);
        if (insErr) throw insErr;
      }
      return data.id;
    },
    onSuccess: (newVenueId) => {
      qc.invalidateQueries({ queryKey: ["venues-by-stage"] });
      qc.invalidateQueries({ queryKey: ["venues"] });
      form.setValue("venue_id", newVenueId);
      toast.success("Local criado com sucesso");
      setVenueDialogOpen(false);
    },
    onError: (err: Error) => toast.error("Erro ao criar local: " + err.message),
  });

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{isEditing ? "Editar Partida" : "Nova Partida"}</DialogTitle>
            <DialogDescription>{isEditing ? "Atualize os dados." : "Agende uma nova partida/prova."}</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="phase_id" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fase</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                      <SelectContent>{phases.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="group_id" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Grupo (opcional)</FormLabel>
                    <Select onValueChange={(v) => field.onChange(v === "__none__" ? "" : v)} value={field.value || "__none__"}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">Nenhum</SelectItem>
                        {phaseGroups.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <FormField control={form.control} name="match_number" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nº</FormLabel>
                    <FormControl><Input type="number" placeholder="1" {...field} value={field.value ?? ""} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="match_date" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="start_time" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Horário</FormLabel>
                    <FormControl><Input type="time" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="venue_id" render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex justify-between items-center">
                    Local
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="sm" 
                      className="h-7 px-2 text-xs text-primary"
                      onClick={() => setVenueDialogOpen(true)}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Incluir local
                    </Button>
                  </FormLabel>
                  <Select onValueChange={(v) => field.onChange(v === "__none__" ? "" : v)} value={field.value || "__none__"}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="__none__">Nenhum</SelectItem>
                      {venues.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="scheduled">Agendada</SelectItem>
                      <SelectItem value="in_progress">Em andamento</SelectItem>
                      <SelectItem value="finished">Finalizada</SelectItem>
                      <SelectItem value="cancelled">Cancelada</SelectItem>
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

      <VenueFormDialog 
        open={venueDialogOpen}
        onOpenChange={setVenueDialogOpen}
        events={events}
        onSubmit={(v) => createVenueMut.mutate(v)}
        isPending={createVenueMut.isPending}
      />
    </>
  );
}
