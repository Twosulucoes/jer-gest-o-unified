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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form, FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription,
} from "@/components/ui/form";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { Tables } from "@/integrations/supabase/types";

const VENUE_TYPE_OPTIONS = [
  { value: "arena", label: "Arena" },
  { value: "gymnasium", label: "Ginásio" },
  { value: "field", label: "Campo" },
  { value: "pool", label: "Piscina" },
  { value: "court", label: "Quadra" },
  { value: "track", label: "Pista" },
  { value: "other", label: "Outro" },
];

const venueSchema = z.object({
  event_id: z.string().min(1, "Selecione um evento"),
  event_stage_id: z.string().min(1, "Selecione a etapa"),
  name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres"),
  venue_type: z.string().min(1, "Selecione o tipo"),
  city: z.string().optional().or(z.literal("")),
  address: z.string().optional().or(z.literal("")),
  is_active: z.boolean(),
});

export type VenueFormValues = z.infer<typeof venueSchema>;

interface VenueFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  venue?: (Tables<"venues"> & { event_stage_id?: string | null }) | null;
  events: Tables<"events">[];
  onSubmit: (values: VenueFormValues) => void;
  isPending: boolean;
}

export default function VenueFormDialog({
  open, onOpenChange, venue, events, onSubmit, isPending,
}: VenueFormDialogProps) {
  const isEditing = !!venue;

  const form = useForm<VenueFormValues>({
    resolver: zodResolver(venueSchema),
    defaultValues: {
      event_id: "",
      event_stage_id: "",
      name: "",
      venue_type: "arena",
      city: "",
      address: "",
      is_active: true,
    },
  });

  const selectedEventId = form.watch("event_id");

  const { data: stages = [] } = useQuery({
    queryKey: ["event_stages", selectedEventId],
    enabled: !!selectedEventId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_stages")
        .select("id, name, status, sort_order")
        .eq("event_id", selectedEventId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (venue) {
      form.reset({
        event_id: venue.event_id,
        event_stage_id: venue.event_stage_id ?? "",
        name: venue.name,
        venue_type: venue.venue_type,
        city: venue.city ?? "",
        address: venue.address ?? "",
        is_active: venue.is_active,
      });
    } else {
      form.reset({
        event_id: events.length === 1 ? events[0].id : "",
        event_stage_id: "",
        name: "",
        venue_type: "arena",
        city: "",
        address: "",
        is_active: true,
      });
    }
  }, [venue, events, form]);

  // Pré-seleciona a etapa ativa ao criar (não sobrescreve edição nem escolha manual)
  useEffect(() => {
    if (isEditing) return;
    if (!stages.length) return;
    if (form.getValues("event_stage_id")) return;
    const active = stages.find((s) => s.status === "active");
    if (active) form.setValue("event_stage_id", active.id, { shouldValidate: true });
  }, [stages, isEditing, form]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Local" : "Novo Local"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Atualize os dados do local." : "Preencha os dados para criar um novo local."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="event_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Evento</FormLabel>
                  <Select
                    onValueChange={(v) => {
                      field.onChange(v);
                      form.setValue("event_stage_id", "");
                    }}
                    value={field.value}
                    disabled={isEditing}
                  >
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Selecione o evento" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {events.map((ev) => (
                        <SelectItem key={ev.id} value={ev.id}>{ev.name} ({ev.year})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="event_stage_id"
              render={({ field }) => {
                const activeStage = stages.find((s) => s.status === "active");
                return (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1">
                      Etapa do evento
                      <span className="text-destructive" aria-label="obrigatório">*</span>
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={!selectedEventId || !stages.length}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={!selectedEventId ? "Selecione um evento primeiro" : !stages.length ? "Nenhuma etapa cadastrada" : "Selecione a etapa"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {stages.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}{s.status === "active" ? " (ativa)" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Campo obrigatório — cada local pertence a uma única etapa.
                      {!isEditing && activeStage && field.value === activeStage.id && (
                        <span className="block text-primary mt-1">
                          ✓ Etapa ativa "{activeStage.name}" pré-selecionada.
                        </span>
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                );
              }}
            />

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome</FormLabel>
                  <FormControl><Input placeholder="Ginásio Municipal" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="venue_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {VENUE_TYPE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cidade</FormLabel>
                    <FormControl><Input placeholder="São Paulo" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Endereço</FormLabel>
                    <FormControl><Input placeholder="Rua..." {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Ativo</FormLabel>
                    <FormDescription>Local disponível para uso no evento</FormDescription>
                  </div>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Salvando..." : isEditing ? "Salvar" : "Criar"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
