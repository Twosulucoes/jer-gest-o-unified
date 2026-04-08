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

const schema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  sort_order: z.coerce.number().int().min(0),
});

export type GroupFormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group?: any | null;
  onSubmit: (values: GroupFormValues) => void;
  isPending: boolean;
}

export default function CompetitionGroupFormDialog({ open, onOpenChange, group, onSubmit, isPending }: Props) {
  const isEditing = !!group;

  const form = useForm<GroupFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", sort_order: 0 },
  });

  useEffect(() => {
    if (group) {
      form.reset({ name: group.name, sort_order: group.sort_order });
    } else {
      form.reset({ name: "", sort_order: 0 });
    }
  }, [group, form]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Grupo" : "Novo Grupo"}</DialogTitle>
          <DialogDescription>{isEditing ? "Atualize os dados do grupo/chave." : "Cadastre um novo grupo/chave para esta fase."}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>Nome</FormLabel>
                <FormControl><Input placeholder="Ex: Grupo A" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="sort_order" render={({ field }) => (
              <FormItem>
                <FormLabel>Ordem de exibição</FormLabel>
                <FormControl><Input type="number" min={0} {...field} /></FormControl>
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
