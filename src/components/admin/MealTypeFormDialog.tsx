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
import type { StageContext } from "@/components/admin/VehicleFormDialog";

const mealTypeSchema = z.object({
  event_id: z.string().min(1, "Selecione um evento"),
  name: z.string().min(2, "Nome obrigatório"),
  slug: z.string().min(2, "Slug obrigatório"),
  sort_order: z.coerce.number().int().min(0),
  is_active: z.boolean(),
});

export type MealTypeFormValues = z.infer<typeof mealTypeSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mealType?: any | null;
  events: Tables<"events">[];
  stageContext?: StageContext;
  onSubmit: (values: MealTypeFormValues) => void;
  isPending: boolean;
}

export default function MealTypeFormDialog({ open, onOpenChange, mealType, stageContext, onSubmit, isPending }: Props) {
  const isEditing = !!mealType;

  const form = useForm<MealTypeFormValues>({
    resolver: zodResolver(mealTypeSchema),
    defaultValues: { event_id: "", name: "", slug: "", sort_order: 0, is_active: true },
  });

  useEffect(() => {
    const defaultEventId = stageContext?.event_id ?? (events.length === 1 ? events[0].id : "");
    if (mealType) {
      form.reset({
        event_id: mealType.event_id,
        name: mealType.name,
        slug: mealType.slug,
        sort_order: mealType.sort_order,
        is_active: mealType.is_active,
      });
    } else {
      form.reset({
        event_id: defaultEventId,
        name: "", slug: "", sort_order: 0, is_active: true,
      });
    }
  }, [mealType, events, stageContext, form]);

  // Auto-generate slug from name
  const watchName = form.watch("name");
  useEffect(() => {
    if (!isEditing && watchName) {
      const slug = watchName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      form.setValue("slug", slug);
    }
  }, [watchName, isEditing, form]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Tipo de Refeição" : "Novo Tipo de Refeição"}</DialogTitle>
          <DialogDescription>{isEditing ? "Atualize os dados." : "Cadastre um novo tipo de refeição."}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {stageContext ? (
              <div className="rounded-md bg-muted px-3 py-2 text-sm flex items-center gap-2">
                <span className="text-muted-foreground">Etapa:</span>
                <span className="font-medium">{stageContext.name}</span>
              </div>
            ) : (
              <FormField control={form.control} name="event_id" render={({ field }) => (
                <FormItem>
                  <FormLabel>Evento</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={isEditing}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                    <SelectContent>{events.map((e) => <SelectItem key={e.id} value={e.id}>{e.name} ({e.year})</SelectItem>)}</SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            )}
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome</FormLabel>
                  <FormControl><Input placeholder="Almoço" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="slug" render={({ field }) => (
                <FormItem>
                  <FormLabel>Slug</FormLabel>
                  <FormControl><Input placeholder="almoco" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <FormField control={form.control} name="sort_order" render={({ field }) => (
              <FormItem>
                <FormLabel>Ordem</FormLabel>
                <FormControl><Input type="number" min={0} {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="is_active" render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel>Ativo</FormLabel>
                  <FormDescription>Tipo de refeição disponível</FormDescription>
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
