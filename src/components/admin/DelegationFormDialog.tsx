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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form, FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription,
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

const NETWORK_TYPE_OPTIONS = [
  { value: "municipal", label: "Municipal" },
  { value: "estadual", label: "Estadual" },
  { value: "federal", label: "Federal" },
  { value: "privada", label: "Privada" },
];

const delegationSchema = z.object({
  event_id: z.string().min(1, "Selecione um evento"),
  status: z.string().min(1, "Selecione o status"),
  // Dados da escola (embutidos na delegação)
  school_name: z.string().min(2, "Nome da escola deve ter no mínimo 2 caracteres"),
  school_official_name: z.string().optional().or(z.literal("")),
  school_slug: z.string().min(2, "Slug deve ter no mínimo 2 caracteres")
    .regex(/^[a-z0-9-]+$/, "Slug: apenas letras minúsculas, números e hífens"),
  school_network_type: z.string().min(1, "Selecione o tipo de rede"),
  school_city: z.string().optional().or(z.literal("")),
  school_state: z.string().optional().or(z.literal(""))
    .refine((val) => !val || /^[A-Z]{2}$/.test(val), "UF deve ter 2 letras maiúsculas"),
  school_district: z.string().optional().or(z.literal("")),
  school_contact_name: z.string().optional().or(z.literal("")),
  school_contact_phone: z.string().optional().or(z.literal("")),
  school_contact_email: z.string().optional().or(z.literal(""))
    .refine((val) => !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), "E-mail inválido"),
  school_is_active: z.boolean(),
  // Chefia
  chief_name: z.string().trim().max(200).optional().or(z.literal("")),
  chief_phone: z.string().trim().max(30).optional().or(z.literal("")),
  chief_email: z.string().trim().optional().or(z.literal(""))
    .refine((val) => !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), "E-mail inválido"),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
});

export type DelegationFormValues = z.infer<typeof delegationSchema>;

interface DelegationFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  delegation?: (Tables<"delegations"> & Record<string, any>) | null;
  events: Tables<"events">[];
  onSubmit: (values: DelegationFormValues) => void;
  isPending: boolean;
}

const EMPTY_VALUES: DelegationFormValues = {
  event_id: "", status: "pending",
  school_name: "", school_official_name: "", school_slug: "",
  school_network_type: "municipal",
  school_city: "", school_state: "", school_district: "",
  school_contact_name: "", school_contact_phone: "", school_contact_email: "",
  school_is_active: true,
  chief_name: "", chief_phone: "", chief_email: "", notes: "",
};

export default function DelegationFormDialog({
  open, onOpenChange, delegation, events, onSubmit, isPending,
}: DelegationFormDialogProps) {
  const isEditing = !!delegation;

  const form = useForm<DelegationFormValues>({
    resolver: zodResolver(delegationSchema),
    defaultValues: EMPTY_VALUES,
  });

  useEffect(() => {
    if (delegation) {
      const d = delegation as any;
      form.reset({
        event_id: d.event_id,
        status: d.status,
        school_name: d.school_name ?? "",
        school_official_name: d.school_official_name ?? "",
        school_slug: d.school_slug ?? "",
        school_network_type: d.school_network_type ?? "municipal",
        school_city: d.school_city ?? "",
        school_state: d.school_state ?? "",
        school_district: d.school_district ?? "",
        school_contact_name: d.school_contact_name ?? "",
        school_contact_phone: d.school_contact_phone ?? "",
        school_contact_email: d.school_contact_email ?? "",
        school_is_active: d.school_is_active ?? true,
        chief_name: d.chief_name ?? "",
        chief_phone: d.chief_phone ?? "",
        chief_email: d.chief_email ?? "",
        notes: d.notes ?? "",
      });
    } else {
      form.reset({
        ...EMPTY_VALUES,
        event_id: events.length === 1 ? events[0].id : "",
      });
    }
  }, [delegation, events, form]);

  const handleNameChange = (value: string) => {
    form.setValue("school_name", value);
    if (!isEditing || form.getValues("school_slug") === "") {
      const slug = value
        .toLowerCase().normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      form.setValue("school_slug", slug);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Delegação (Escola)" : "Nova Delegação (Escola)"}</DialogTitle>
          <DialogDescription>
            Cada delegação representa uma escola participante do evento.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Bloco evento + status */}
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="event_id" render={({ field }) => (
                <FormItem>
                  <FormLabel>Evento</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={isEditing}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {events.map((ev) => (
                        <SelectItem key={ev.id} value={ev.id}>{ev.name} ({ev.year})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {STATUS_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            {/* Bloco escola */}
            <div className="space-y-4 rounded-lg border bg-muted/20 p-4">
              <h3 className="font-heading text-sm font-semibold uppercase tracking-wide text-muted-foreground">Dados da Escola</h3>

              <FormField control={form.control} name="school_name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome</FormLabel>
                  <FormControl><Input placeholder="Escola Municipal João da Silva" {...field}
                    onChange={(e) => handleNameChange(e.target.value)} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="school_official_name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome oficial</FormLabel>
                  <FormControl><Input placeholder="Opcional" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="school_slug" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Slug</FormLabel>
                    <FormControl><Input placeholder="escola-joao-silva" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="school_network_type" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de rede</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {NETWORK_TYPE_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <FormField control={form.control} name="school_city" render={({ field }) => (
                  <FormItem><FormLabel>Cidade</FormLabel><FormControl><Input placeholder="Boa Vista" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="school_state" render={({ field }) => (
                  <FormItem>
                    <FormLabel>UF</FormLabel>
                    <FormControl><Input placeholder="RR" maxLength={2} {...field}
                      onChange={(e) => field.onChange(e.target.value.toUpperCase())} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="school_district" render={({ field }) => (
                  <FormItem><FormLabel>Bairro</FormLabel><FormControl><Input placeholder="Centro" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <FormField control={form.control} name="school_contact_name" render={({ field }) => (
                  <FormItem><FormLabel>Contato (escola)</FormLabel><FormControl><Input placeholder="Diretor(a)" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="school_contact_phone" render={({ field }) => (
                  <FormItem><FormLabel>Telefone</FormLabel><FormControl><Input placeholder="(95) 99999-0000" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="school_contact_email" render={({ field }) => (
                  <FormItem><FormLabel>E-mail</FormLabel><FormControl><Input placeholder="contato@escola.com" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>

              <FormField control={form.control} name="school_is_active" render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border bg-card p-3">
                  <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Ativa</FormLabel>
                    <FormDescription>Escola disponível para participação.</FormDescription>
                  </div>
                </FormItem>
              )} />
            </div>

            {/* Bloco chefia */}
            <div className="space-y-4 rounded-lg border bg-muted/20 p-4">
              <h3 className="font-heading text-sm font-semibold uppercase tracking-wide text-muted-foreground">Chefia da Delegação</h3>
              <div className="grid grid-cols-3 gap-4">
                <FormField control={form.control} name="chief_name" render={({ field }) => (
                  <FormItem><FormLabel>Chefe</FormLabel><FormControl><Input placeholder="Nome completo" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="chief_phone" render={({ field }) => (
                  <FormItem><FormLabel>Telefone</FormLabel><FormControl><Input placeholder="(95) 99999-0000" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="chief_email" render={({ field }) => (
                  <FormItem><FormLabel>E-mail</FormLabel><FormControl><Input placeholder="chefe@escola.com" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem><FormLabel>Observações</FormLabel><FormControl><Textarea rows={3} placeholder="Opcional" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>

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
