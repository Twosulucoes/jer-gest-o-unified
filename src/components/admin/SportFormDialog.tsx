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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Tables } from "@/integrations/supabase/types";
import MatchConfigEditor, { type MatchConfig } from "./MatchConfigEditor";
import IndividualConfigEditor, { type IndividualConfig } from "./IndividualConfigEditor";

const sportSchema = z.object({
  event_id: z.string().min(1, "Selecione um evento"),
  name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres"),
  slug: z
    .string()
    .min(2, "Slug deve ter no mínimo 2 caracteres")
    .regex(/^[a-z0-9-]+$/, "Apenas letras minúsculas, números e hífens"),
  is_collective: z.boolean(),
  is_paralympic: z.boolean(),
  match_config: z.any().optional(),
});

export type SportFormValues = z.infer<typeof sportSchema>;

interface SportFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sport?: Tables<"sports"> | null;
  events: Tables<"events">[];
  onSubmit: (values: SportFormValues) => void;
  isPending: boolean;
}

export default function SportFormDialog({
  open,
  onOpenChange,
  sport,
  events,
  onSubmit,
  isPending,
}: SportFormDialogProps) {
  const isEditing = !!sport;

  const form = useForm<SportFormValues>({
    resolver: zodResolver(sportSchema),
    defaultValues: {
      event_id: "",
      name: "",
      slug: "",
      is_collective: false,
      is_paralympic: false,
      match_config: {},
    },
  });

  const isCollective = form.watch("is_collective");

  useEffect(() => {
    if (sport) {
      form.reset({
        event_id: sport.event_id,
        name: sport.name,
        slug: sport.slug,
        is_collective: sport.is_collective,
        is_paralympic: sport.is_paralympic,
        match_config: (sport as any).match_config ?? {},
      });
    } else {
      form.reset({
        event_id: events.length === 1 ? events[0].id : "",
        name: "",
        slug: "",
        is_collective: false,
        is_paralympic: false,
        match_config: {},
      });
    }
  }, [sport, events, form]);

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
      <DialogContent className="sm:max-w-[540px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar Modalidade" : "Nova Modalidade"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Atualize os dados da modalidade."
              : "Preencha os dados para criar uma nova modalidade."}
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
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={isEditing}
                  >
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
                      placeholder="Futsal"
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
                    <Input placeholder="futsal" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="is_collective"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Coletiva</FormLabel>
                      <FormDescription>Modalidade por equipes</FormDescription>
                    </div>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="is_paralympic"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Paralímpica</FormLabel>
                      <FormDescription>Modalidade adaptada</FormDescription>
                    </div>
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="match_config"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    {isCollective ? (
                      <MatchConfigEditor
                        value={(field.value as MatchConfig) ?? {}}
                        onChange={field.onChange}
                      />
                    ) : (
                      <IndividualConfigEditor
                        value={((field.value as any)?.individual_config as IndividualConfig) ?? {}}
                        onChange={(ic) => field.onChange({ ...((field.value as any) ?? {}), individual_config: ic })}
                      />
                    )}
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
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
