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
import { Switch } from "@/components/ui/switch";

const locationSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  address: z.string().optional().or(z.literal("")),
  capacity: z.coerce.number().optional().or(z.literal(0)),
  is_active: z.boolean(),
});

export type MealLocationFormValues = z.infer<typeof locationSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  location?: any | null;
  onSubmit: (values: MealLocationFormValues) => void;
  isPending: boolean;
}

export default function MealLocationFormDialog({ open, onOpenChange, location, onSubmit, isPending }: Props) {
  const isEditing = !!location;

  const form = useForm<MealLocationFormValues>({
    resolver: zodResolver(locationSchema),
    defaultValues: {
      name: "",
      address: "",
      capacity: 0,
      is_active: true,
    },
  });

  useEffect(() => {
    if (location) {
      form.reset({
        name: location.name,
        address: location.address ?? "",
        capacity: location.capacity ?? 0,
        is_active: location.is_active,
      });
    } else {
      form.reset({
        name: "",
        address: "",
        capacity: 0,
        is_active: true,
      });
    }
  }, [location, form, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Local" : "Novo Local de Refeição"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Atualize os dados do local." : "Cadastre um novo refeitório ou ponto de distribuição."}
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
                  <FormControl>
                    <Input placeholder="Ex: Refeitório Central" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Endereço / Referência (opcional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Bloco A, Térreo" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="capacity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Capacidade (opcional)</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-md border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>Ativo</FormLabel>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
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
