import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Form, FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription,
} from "@/components/ui/form";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Accessibility, AlertTriangle } from "lucide-react";

// ------------------------------------------------------------
// Acessibilidade (Etapa 5 da auditoria de Alojamento)
// ------------------------------------------------------------
// Lista canônica de recursos de acessibilidade que o operador
// pode marcar. Persistido em accessible_features_json como
// { items: string[] }. Manter sincronizado com a UI da listagem.
// ------------------------------------------------------------
export const ACCESSIBLE_FEATURE_OPTIONS = [
  { key: "rampa",                label: "Rampa de acesso" },
  { key: "banheiro_adaptado",    label: "Banheiro adaptado" },
  { key: "barras_apoio",         label: "Barras de apoio" },
  { key: "sinalizacao_tatil",    label: "Sinalização tátil" },
  { key: "piso_antiderrapante",  label: "Piso antiderrapante" },
  { key: "elevador",             label: "Acesso por elevador" },
] as const;

export type AccessibleFeatureKey = (typeof ACCESSIBLE_FEATURE_OPTIONS)[number]["key"];

export const MIN_AGE_POLICY_OPTIONS = [
  { value: "none",        label: "Sem restrição etária" },
  { value: "adulto_only", label: "Apenas adultos" },
  { value: "menor_only",  label: "Apenas menores (acompanhados)" },
] as const;

const schema = z.object({
  location_id: z.string().min(1, "Selecione um local"),
  wing_id: z.string().optional().or(z.literal("")),
  name: z.string().min(1, "Nome obrigatório"),
  capacity: z.coerce.number().int().min(1, "Mínimo 1"),
  gender_restriction: z.string(),
  notes: z.string().optional().or(z.literal("")),
  is_active: z.boolean(),
  // Etapa 5 — acessibilidade e PCD
  floor: z.string().optional().or(z.literal("")),
  is_accessible: z.boolean(),
  accessible_features: z.array(z.string()).default([]),
  gender_zone: z.string().optional().or(z.literal("")),
  min_age_policy: z.string(), // "none" | "adulto_only" | "menor_only"
});

export type LodgingUnitFormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unit?: any | null;
  locations: any[];
  /** Alas cadastradas (`lodging_wings`). Quando o usuário escolher uma ala
   * cujo `gender_default` está definido, o form pré-seleciona aquele sexo. */
  wings?: any[];
  onSubmit: (values: LodgingUnitFormValues) => void;
  isPending: boolean;
  /** Ocupações correntes (allocated + checked_in) deste quarto. Quando >0 e o
   * usuário desmarca "Ativa", o form mostra um aviso de risco operacional.
   * Etapa 7 da auditoria de Alojamento. */
  activeOccupancies?: number;
}

const DEFAULTS: LodgingUnitFormValues = {
  location_id: "",
  wing_id: "",
  name: "",
  capacity: 1,
  gender_restriction: "mixed",
  notes: "",
  is_active: true,
  floor: "",
  is_accessible: false,
  accessible_features: [],
  gender_zone: "",
  min_age_policy: "none",
};

/** Extrai o array de features do JSON do banco (compat com formatos legados). */
function readFeatures(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter((x) => typeof x === "string");
  if (typeof raw === "object" && raw !== null) {
    const items = (raw as any).items;
    if (Array.isArray(items)) return items.filter((x) => typeof x === "string");
  }
  return [];
}

export default function LodgingUnitFormDialog({ open, onOpenChange, unit, locations, wings = [], onSubmit, isPending, activeOccupancies = 0 }: Props) {
  const isEditing = !!unit;

  const form = useForm<LodgingUnitFormValues>({
    resolver: zodResolver(schema),
    defaultValues: DEFAULTS,
  });

  useEffect(() => {
    if (unit) {
      form.reset({
        location_id: unit.location_id,
        wing_id: unit.wing_id ?? "",
        name: unit.name,
        capacity: unit.capacity,
        gender_restriction: unit.gender_restriction,
        notes: unit.notes ?? "",
        is_active: unit.is_active,
        floor: unit.floor ?? "",
        is_accessible: !!unit.is_accessible,
        accessible_features: readFeatures(unit.accessible_features_json),
        gender_zone: unit.gender_zone ?? "",
        min_age_policy: unit.min_age_policy ?? "none",
      });
    } else {
      form.reset(DEFAULTS);
    }
  }, [unit, form]);

  const watchedLocationId = form.watch("location_id");
  const watchedWingId = form.watch("wing_id");
  const wingsForLocation = useMemo(
    () => wings.filter((w) => w.location_id === watchedLocationId),
    [wings, watchedLocationId],
  );

  // Quando troca para uma ala com gender_default definido, herda o sexo no
  // gender_restriction (sem sobrescrever escolha explícita do usuário ao editar).
  useEffect(() => {
    if (!watchedWingId) return;
    const wing = wings.find((w) => w.id === watchedWingId);
    if (wing?.gender_default && form.getValues("gender_restriction") === "mixed") {
      form.setValue("gender_restriction", wing.gender_default);
    }
  }, [watchedWingId, wings, form]);

  const isAccessible = form.watch("is_accessible");
  const formIsActive = form.watch("is_active");
  const showDeactivateWarning = isEditing && !formIsActive && activeOccupancies > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Unidade" : "Nova Unidade"}</DialogTitle>
          <DialogDescription>{isEditing ? "Atualize os dados." : "Cadastre uma nova unidade de alojamento."}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="location_id" render={({ field }) => (
              <FormItem>
                <FormLabel>Local</FormLabel>
                <Select onValueChange={(v) => { field.onChange(v); form.setValue("wing_id", ""); }} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                  <SelectContent>
                    {locations.filter((l) => l.is_active).map((l) => (
                      <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            {wingsForLocation.length > 0 && (
              <FormField control={form.control} name="wing_id" render={({ field }) => (
                <FormItem>
                  <FormLabel>Ala</FormLabel>
                  <Select onValueChange={(v) => field.onChange(v === "__none__" ? "" : v)} value={field.value || "__none__"}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="__none__">Sem ala</SelectItem>
                      {wingsForLocation.map((w) => (
                        <SelectItem key={w.id} value={w.id}>
                          {w.name}{w.gender_default ? ` (${w.gender_default === 'male' ? 'M' : w.gender_default === 'female' ? 'F' : 'misto'})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription className="text-xs">Opcional. Se a ala tiver sexo padrão, será herdado abaixo.</FormDescription>
                </FormItem>
              )} />
            )}

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome</FormLabel>
                  <FormControl><Input placeholder="Quarto 101" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="capacity" render={({ field }) => (
                <FormItem>
                  <FormLabel>Capacidade</FormLabel>
                  <FormControl><Input type="number" min={1} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="floor" render={({ field }) => (
                <FormItem>
                  <FormLabel>Andar</FormLabel>
                  <FormControl><Input placeholder="Ex: 1, Térreo, 2A" {...field} /></FormControl>
                  <FormDescription className="text-xs">Opcional</FormDescription>
                </FormItem>
              )} />
              <FormField control={form.control} name="gender_zone" render={({ field }) => (
                <FormItem>
                  <FormLabel>Ala / zona</FormLabel>
                  <FormControl><Input placeholder="Ex: Ala feminina" {...field} /></FormControl>
                  <FormDescription className="text-xs">Opcional</FormDescription>
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="gender_restriction" render={({ field }) => (
              <FormItem>
                <FormLabel>Restrição de gênero</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="mixed">Misto</SelectItem>
                    <SelectItem value="male">Masculino</SelectItem>
                    <SelectItem value="female">Feminino</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="min_age_policy" render={({ field }) => (
              <FormItem>
                <FormLabel>Restrição etária</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    {MIN_AGE_POLICY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            {/* Acessibilidade (PCD) */}
            <FormField control={form.control} name="is_accessible" render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 bg-blue-50/40 dark:bg-blue-950/20">
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
                <div className="space-y-1 leading-none flex-1">
                  <FormLabel className="flex items-center gap-2">
                    <Accessibility className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    Acessível para PCD
                  </FormLabel>
                  <FormDescription className="text-xs">
                    Unidade adaptada a pessoas com deficiência
                  </FormDescription>
                </div>
              </FormItem>
            )} />

            {isAccessible && (
              <FormField control={form.control} name="accessible_features" render={({ field }) => (
                <FormItem className="rounded-md border p-4 space-y-3">
                  <FormLabel className="text-sm">Recursos de acessibilidade</FormLabel>
                  <div className="grid grid-cols-2 gap-2">
                    {ACCESSIBLE_FEATURE_OPTIONS.map((opt) => {
                      const checked = field.value.includes(opt.key);
                      return (
                        <label key={opt.key} className="flex items-center gap-2 text-sm cursor-pointer">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(c) => {
                              if (c) {
                                field.onChange([...field.value, opt.key]);
                              } else {
                                field.onChange(field.value.filter((k) => k !== opt.key));
                              }
                            }}
                          />
                          <span>{opt.label}</span>
                        </label>
                      );
                    })}
                  </div>
                  <FormDescription className="text-xs">
                    Marque o que se aplica. Disponível como filtro na listagem.
                  </FormDescription>
                </FormItem>
              )} />
            )}

            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem>
                <FormLabel>Notas</FormLabel>
                <FormControl><Input placeholder="Observações operacionais" {...field} /></FormControl>
              </FormItem>
            )} />

            <FormField control={form.control} name="is_active" render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel>Ativa</FormLabel>
                  <FormDescription>Unidade disponível para alocação</FormDescription>
                </div>
              </FormItem>
            )} />

            {showDeactivateWarning && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 flex items-start gap-2 text-xs text-destructive">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-bold">
                    Atenção: este quarto tem {activeOccupancies} hospedagem{activeOccupancies > 1 ? "s" : ""} ativa{activeOccupancies > 1 ? "s" : ""}.
                  </p>
                  <p className="opacity-90">
                    Desativar não fará checkout automático nem cancelará alocações. Faça check-out / remanejamento antes para evitar inconsistências operacionais.
                  </p>
                </div>
              </div>
            )}

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
