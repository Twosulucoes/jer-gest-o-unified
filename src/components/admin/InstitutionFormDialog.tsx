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

const NETWORK_TYPE_OPTIONS = [
  { value: "municipal", label: "Municipal" },
  { value: "estadual", label: "Estadual" },
  { value: "federal", label: "Federal" },
  { value: "privada", label: "Privada" },
];

const institutionSchema = z.object({
  name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres"),
  official_name: z.string().optional().or(z.literal("")),
  slug: z.string().min(2, "Slug deve ter no mínimo 2 caracteres")
    .regex(/^[a-z0-9-]+$/, "Slug deve conter apenas letras minúsculas, números e hífens"),
  network_type: z.string().min(1, "Selecione o tipo de rede"),
  city: z.string().optional().or(z.literal("")),
  state: z.string().optional().or(z.literal(""))
    .refine((val) => !val || /^[A-Z]{2}$/.test(val), "UF deve ter exatamente 2 letras maiúsculas"),
  district: z.string().optional().or(z.literal("")),
  contact_name: z.string().optional().or(z.literal("")),
  contact_phone: z.string().optional().or(z.literal("")),
  contact_email: z.string().optional().or(z.literal(""))
    .refine((val) => !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), "E-mail inválido"),
  is_active: z.boolean(),
});

export type InstitutionFormValues = z.infer<typeof institutionSchema>;

interface InstitutionFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  institution?: Tables<"institutions"> | null;
  onSubmit: (values: InstitutionFormValues) => void;
  isPending: boolean;
}

export default function InstitutionFormDialog({
  open, onOpenChange, institution, onSubmit, isPending,
}: InstitutionFormDialogProps) {
  const isEditing = !!institution;

  const form = useForm<InstitutionFormValues>({
    resolver: zodResolver(institutionSchema),
    defaultValues: {
      name: "", official_name: "", slug: "", network_type: "municipal",
      city: "", state: "", district: "",
      contact_name: "", contact_phone: "", contact_email: "",
      is_active: true,
    },
  });

  useEffect(() => {
    if (institution) {
      form.reset({
        name: institution.name,
        official_name: institution.official_name ?? "",
        slug: institution.slug,
        network_type: institution.network_type,
        city: institution.city ?? "",
        state: institution.state ?? "",
        district: institution.district ?? "",
        contact_name: institution.contact_name ?? "",
        contact_phone: institution.contact_phone ?? "",
        contact_email: institution.contact_email ?? "",
        is_active: institution.is_active,
      });
    } else {
      form.reset({
        name: "", official_name: "", slug: "", network_type: "municipal",
        city: "", state: "", district: "",
        contact_name: "", contact_phone: "", contact_email: "",
        is_active: true,
      });
    }
  }, [institution, form]);

  const handleNameChange = (value: string) => {
    form.setValue("name", value);
    if (!isEditing || form.getValues("slug") === "") {
      const slug = value
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      form.setValue("slug", slug);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Instituição" : "Nova Instituição"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Atualize os dados da instituição." : "Preencha os dados para cadastrar uma nova instituição."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome</FormLabel>
                  <FormControl><Input placeholder="Escola Municipal João da Silva" {...field} onChange={(e) => handleNameChange(e.target.value)} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="official_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome Oficial</FormLabel>
                  <FormControl><Input placeholder="Nome completo oficial (opcional)" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="slug"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Slug</FormLabel>
                    <FormControl><Input placeholder="escola-joao-silva" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="network_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Rede</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {NETWORK_TYPE_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cidade</FormLabel>
                    <FormControl><Input placeholder="Boa Vista" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="state"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>UF</FormLabel>
                    <FormControl>
                      <Input placeholder="RR" maxLength={2} {...field}
                        onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="district"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bairro</FormLabel>
                    <FormControl><Input placeholder="Centro" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="contact_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contato</FormLabel>
                    <FormControl><Input placeholder="Nome do responsável" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contact_phone"
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
                name="contact_email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>E-mail</FormLabel>
                    <FormControl><Input placeholder="contato@escola.com" {...field} /></FormControl>
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
                    <FormLabel>Ativa</FormLabel>
                    <FormDescription>Instituição disponível para participação em eventos</FormDescription>
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
