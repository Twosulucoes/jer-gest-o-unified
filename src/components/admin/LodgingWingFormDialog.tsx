import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const schema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  gender_default: z.string(), // "" | "male" | "female" | "mixed"
  sort_order: z.coerce.number().int().min(0).default(0),
});

export type LodgingWingFormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  wing?: any | null;
  locationName: string;
  onSubmit: (values: LodgingWingFormValues) => void;
  isPending: boolean;
}

const DEFAULTS: LodgingWingFormValues = {
  name: "",
  gender_default: "",
  sort_order: 0,
};

export default function LodgingWingFormDialog({ open, onOpenChange, wing, locationName, onSubmit, isPending }: Props) {
  const isEditing = !!wing;
  const form = useForm<LodgingWingFormValues>({
    resolver: zodResolver(schema),
    defaultValues: DEFAULTS,
  });

  useEffect(() => {
    if (wing) {
      form.reset({
        name: wing.name,
        gender_default: wing.gender_default ?? "",
        sort_order: wing.sort_order ?? 0,
      });
    } else {
      form.reset(DEFAULTS);
    }
  }, [wing, form]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Ala" : "Nova Ala"}</DialogTitle>
          <DialogDescription>{locationName}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>Nome</FormLabel>
                <FormControl><Input placeholder="Ex: Ala A, Ala feminina, Bloco 2" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="gender_default" render={({ field }) => (
              <FormItem>
                <FormLabel>Sexo padrão</FormLabel>
                <Select onValueChange={(v) => field.onChange(v === "__none__" ? "" : v)} value={field.value || "__none__"}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="__none__">Sem padrão (decide no quarto)</SelectItem>
                    <SelectItem value="male">Masculino</SelectItem>
                    <SelectItem value="female">Feminino</SelectItem>
                    <SelectItem value="mixed">Misto</SelectItem>
                  </SelectContent>
                </Select>
                <FormDescription className="text-xs">
                  Quando preenchido, todo quarto novo associado a esta ala herda este sexo se vier marcado como "misto".
                </FormDescription>
              </FormItem>
            )} />

            <FormField control={form.control} name="sort_order" render={({ field }) => (
              <FormItem>
                <FormLabel>Ordem</FormLabel>
                <FormControl><Input type="number" min={0} {...field} /></FormControl>
                <FormDescription className="text-xs">Ordem de exibição (menor primeiro).</FormDescription>
              </FormItem>
            )} />

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isPending}>Cancelar</Button>
              <Button type="submit" disabled={isPending}>{isPending ? "Salvando..." : "Salvar"}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
