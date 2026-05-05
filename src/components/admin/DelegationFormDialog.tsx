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

// Os dados da escola vivem em `institutions` (canônico). O form coleta
// esses campos com o nome canônico (sem prefixo "school_") e a página
// pai decide criar/atualizar a institution e ligar à delegation pelo
// institution_id.
const delegationSchema = z.object({
  event_id: z.string().min(1, "Selecione um evento"),
  status: z.string().min(1, "Selecione o status"),
  // institution_id é preenchido automaticamente quando se está editando
  // ou quando o caller resolve o vínculo após salvar uma institution nova.
  institution_id: z.string().optional().or(z.literal("")),
  // Dados da escola (institution)
  name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres"),
  official_name: z.string().optional().or(z.literal("")),
  slug: z.string().min(2, "Slug deve ter no mínimo 2 caracteres")
    .regex(/^[a-z0-9-]+$/, "Slug: apenas letras minúsculas, números e hífens"),
  network_type: z.string().min(1, "Selecione o tipo de rede"),
  city: z.string().optional().or(z.literal("")),
  state: z.string().optional().or(z.literal(""))
    .refine((val) => !val || /^[A-Z]{2}$/.test(val), "UF deve ter 2 letras maiúsculas"),
  district: z.string().optional().or(z.literal("")),
  contact_name: z.string().optional().or(z.literal("")),
  contact_phone: z.string().optional().or(z.literal("")),
  contact_email: z.string().optional().or(z.literal(""))
    .refine((val) => !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), "E-mail inválido"),
  is_active: z.boolean(),
  // Chefia (vivem em delegations)
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
  // Aceita uma delegation com os campos JOINados de institutions (da query
  // padrão da página). O form se vira para extrair os valores certos.
  delegation?: (Tables<"delegations"> & {
    institutions?: Partial<Tables<"institutions">> | null;
  } & Record<string, any>) | null;
  events: Tables<"events">[];
  onSubmit: (values: DelegationFormValues) => void;
  isPending: boolean;
}

const EMPTY_VALUES: DelegationFormValues = {
  event_id: "", status: "pending", institution_id: "",
  name: "", official_name: "", slug: "",
  network_type: "municipal",
  city: "", state: "", district: "",
  contact_name: "", contact_phone: "", contact_email: "",
  is_active: true,
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
      const inst = d.institutions ?? {};
      form.reset({
        event_id: d.event_id,
        status: d.status,
        institution_id: d.institution_id ?? "",
        // Dados da escola vêm de institutions (fonte canônica).
        name: inst.name ?? "",
        official_name: inst.official_name ?? "",
        slug: inst.slug ?? "",
        network_type: inst.network_type ?? "municipal",
        city: inst.city ?? "",
        state: inst.state ?? "",
        district: inst.district ?? "",
        contact_name: inst.contact_name ?? "",
        contact_phone: inst.contact_phone ?? "",
        contact_email: inst.contact_email ?? "",
        is_active: inst.is_active ?? true,
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
    form.setValue("name", value);
    if (!isEditing || form.getValues("slug") === "") {
      const slug = value
        .toLowerCase().normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      form.setValue("slug", slug);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Delegação (Escola)" : "Nova Delegação (Escola)"}</DialogTitle>
          <DialogDescription>
            Cada delegação representa uma escola participante do evento. Os dados
            cadastrais da escola vivem em <code>institutions</code> e atravessam
            edições; os campos de chefia e status são desta delegação.
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

            {/* Bloco escola (institutions) */}
            <div className="space-y-4 rounded-lg border bg-muted/20 p-4">
              <h3 className="font-heading text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Dados da Escola (Instituição)
              </h3>

              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome</FormLabel>
                  <FormControl><Input placeholder="Escola Municipal João da Silva" {...field}
                    onChange={(e) => handleNameChange(e.target.value)} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="official_name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome oficial</FormLabel>
                  <FormControl><Input placeholder="Opcional" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="slug" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Slug</FormLabel>
                    <FormControl><Input placeholder="escola-joao-silva" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="network_type" render={({ field }) => (
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
                <FormField control={form.control} name="city" render={({ field }) => (
                  <FormItem><FormLabel>Cidade</FormLabel><FormControl><Input placeholder="Boa Vista" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="state" render={({ field }) => (
                  <FormItem>
                    <FormLabel>UF</FormLabel>
                    <FormControl><Input placeholder="RR" maxLength={2} {...field}
                      onChange={(e) => field.onChange(e.target.value.toUpperCase())} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="district" render={({ field }) => (
                  <FormItem><FormLabel>Bairro</FormLabel><FormControl><Input placeholder="Centro" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <FormField control={form.control} name="contact_name" render={({ field }) => (
                  <FormItem><FormLabel>Contato (escola)</FormLabel><FormControl><Input placeholder="Diretor(a)" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="contact_phone" render={({ field }) => (
                  <FormItem><FormLabel>Telefone</FormLabel><FormControl><Input placeholder="(95) 99999-0000" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="contact_email" render={({ field }) => (
                  <FormItem><FormLabel>E-mail</FormLabel><FormControl><Input placeholder="contato@escola.com" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>

              <FormField control={form.control} name="is_active" render={({ field }) => (
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
