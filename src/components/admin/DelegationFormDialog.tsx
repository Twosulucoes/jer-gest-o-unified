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
import type { Tables } from "@/integrations/supabase/types";

const STATUS_OPTIONS = [
  { value: "pending", label: "Pendente" },
  { value: "confirmed", label: "Confirmada" },
  { value: "rejected", label: "Rejeitada" },
  { value: "cancelled", label: "Cancelada" },
];

const delegationSchema = z.object({
  event_id: z.string().min(1, "Selecione um evento"),
  institution_id: z.string().min(1, "Selecione uma instituição"),
  status: z.string().min(1, "Selecione o status"),
  chief_name: z.string().trim().max(200, "Máximo 200 caracteres").optional().or(z.literal("")),
  chief_phone: z.string().trim().max(30, "Máximo 30 caracteres").optional().or(z.literal("")),
  chief_email: z.string().trim().optional().or(z.literal(""))
    .refine((val) => !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), "E-mail inválido"),
  notes: z.string().trim().max(1000, "Máximo 1000 caracteres").optional().or(z.literal("")),
});

export type DelegationFormValues = z.infer<typeof delegationSchema>;

interface DelegationFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  delegation?: Tables<"delegations"> | null;
  events: Tables<"events">[];
  institutions: Tables<"institutions">[];
  onSubmit: (values: DelegationFormValues) => void;
  isPending: boolean;
}

export default function DelegationFormDialog({
  open, onOpenChange, delegation, events, institutions, onSubmit, isPending,
}: DelegationFormDialogProps) {
  const isEditing = !!delegation;

  const form = useForm<DelegationFormValues>({
    resolver: zodResolver(delegationSchema),
    defaultValues: {
      event_id: "", institution_id: "", status: "pending",
      chief_name: "", chief_phone: "", chief_email: "", notes: "",
    },
  });

  useEffect(() => {
    if (delegation) {
      form.reset({
        event_id: delegation.event_id,
        institution_id: delegation.institution_id,
        status: delegation.status,
        chief_name: delegation.chief_name ?? "",
        chief_phone: delegation.chief_phone ?? "",
        chief_email: delegation.chief_email ?? "",
        notes: delegation.notes ?? "",
      });
    } else {
      form.reset({
        event_id: events.length === 1 ? events[0].id : "",
        institution_id: "",
        status: "pending",
        chief_name: "", chief_phone: "", chief_email: "", notes: "",
      });
    }
  }, [delegation, events, form]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Delegação" : "Nova Delegação"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Atualize os dados da delegação." : "Preencha os dados para registrar uma nova delegação."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="event_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Evento</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={isEditing}>
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
                name="institution_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Instituição</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={isEditing}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Selecione a instituição" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {institutions.map((inst) => (
                          <SelectItem key={inst.id} value={inst.id}>{inst.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {STATUS_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="chief_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Chefe da Delegação</FormLabel>
                    <FormControl><Input placeholder="Nome completo" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="chief_phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefone</FormLabel>
                    <FormControl><Input placeholder="(95) 99999-0000" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="chief_email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>E-mail</FormLabel>
                    <FormControl><Input placeholder="chefe@escola.com" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações</FormLabel>
                  <FormControl><Textarea placeholder="Observações sobre a delegação (opcional)" rows={3} {...field} /></FormControl>
                  <FormMessage />
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
