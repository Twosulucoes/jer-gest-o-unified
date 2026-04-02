import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Tables } from "@/integrations/supabase/types";

const GENDER_OPTIONS = [
  { value: "mixed", label: "Misto" },
  { value: "male", label: "Masculino" },
  { value: "female", label: "Feminino" },
];

const categorySchema = z
  .object({
    event_id: z.string().min(1, "Selecione um evento"),
    name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres"),
    slug: z
      .string()
      .min(2, "Slug deve ter no mínimo 2 caracteres")
      .regex(/^[a-z0-9-]+$/, "Apenas letras minúsculas, números e hífens"),
    gender_scope: z.string().min(1, "Selecione o gênero"),
    min_birth_year: z.coerce.number().int().min(1900).max(2100).optional().or(z.literal("")),
    max_birth_year: z.coerce.number().int().min(1900).max(2100).optional().or(z.literal("")),
  })
  .refine(
    (data) => {
      const min = typeof data.min_birth_year === "number" ? data.min_birth_year : null;
      const max = typeof data.max_birth_year === "number" ? data.max_birth_year : null;
      if (min !== null && max !== null) return min <= max;
      return true;
    },
    {
      message: "Ano mínimo deve ser menor ou igual ao ano máximo",
      path: ["min_birth_year"],
    }
  );

export type CategoryFormValues = z.infer<typeof categorySchema>;

interface CategoryFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category?: Tables<"categories"> | null;
  events: Tables<"events">[];
  onSubmit: (values: CategoryFormValues) => void;
  isPending: boolean;
}

export default function CategoryFormDialog({
  open,
  onOpenChange,
  category,
  events,
  onSubmit,
  isPending,
}: CategoryFormDialogProps) {
  const isEditing = !!category;

  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      event_id: "",
      name: "",
      slug: "",
      gender_scope: "mixed",
      min_birth_year: "",
      max_birth_year: "",
    },
  });

  useEffect(() => {
    if (category) {
      form.reset({
        event_id: category.event_id,
        name: category.name,
        slug: category.slug,
        gender_scope: category.gender_scope,
        min_birth_year: category.min_birth_year ?? "",
        max_birth_year: category.max_birth_year ?? "",
      });
    } else {
      form.reset({
        event_id: events.length === 1 ? events[0].id : "",
        name: "",
        slug: "",
        gender_scope: "mixed",
        min_birth_year: "",
        max_birth_year: "",
      });
    }
  }, [category, events, form]);

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
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Categoria" : "Nova Categoria"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Atualize os dados da categoria."
              : "Preencha os dados para criar uma nova categoria."}
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
                  <Select onValueChange={field.onChange} value={field.value} disabled={isEditing}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o evento" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {events.map((ev) => (
                        <SelectItem key={ev.id} value={ev.id}>
                          {ev.name} ({ev.year})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Sub-14"
                      {...field}
                      onChange={(e) => handleNameChange(e.target.value)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="slug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Slug</FormLabel>
                  <FormControl>
                    <Input placeholder="sub-14" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="gender_scope"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Gênero</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {GENDER_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
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
                name="min_birth_year"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ano nasc. mínimo</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="2010" {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="max_birth_year"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ano nasc. máximo</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="2012" {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
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
