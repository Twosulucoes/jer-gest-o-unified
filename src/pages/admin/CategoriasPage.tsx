import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { Plus, Pencil, Layers, ExternalLink } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import CategoryFormDialog, {
  type CategoryFormValues,
} from "@/components/admin/CategoryFormDialog";

const GENDER_MAP: Record<string, string> = {
  mixed: "Misto",
  male: "Masculino",
  female: "Feminino",
};

export default function CategoriasPage() {
  const queryClient = useQueryClient();
  const { hasRole } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Tables<"categories"> | null>(null);

  const canWrite = hasRole("admin") || hasRole("secretaria");

  const { data: events = [] } = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .order("year", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: categories, isLoading } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Buscar provas (sport_events) com modalidade para agregar por categoria
  const { data: sportEvents = [] } = useQuery({
    queryKey: ["sport-events-by-category"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sport_events")
        .select("id, category_id, sports(id, name)")
        .not("category_id", "is", null);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Mapa: category_id -> { sports: Set<name>, provasCount: number }
  const sportsByCategory = useMemo(() => {
    const map = new Map<string, { sports: Set<string>; provasCount: number }>();
    for (const se of sportEvents as any[]) {
      if (!se.category_id) continue;
      const entry = map.get(se.category_id) ?? { sports: new Set<string>(), provasCount: 0 };
      if (se.sports?.name) entry.sports.add(se.sports.name);
      entry.provasCount += 1;
      map.set(se.category_id, entry);
    }
    return map;
  }, [sportEvents]);

  const eventsMap = new Map(events.map((e) => [e.id, e]));

  const toPayload = (values: CategoryFormValues) => ({
    event_id: values.event_id,
    name: values.name,
    slug: values.slug,
    gender_scope: values.gender_scope,
    min_birth_year: typeof values.min_birth_year === "number" ? values.min_birth_year : null,
    max_birth_year: typeof values.max_birth_year === "number" ? values.max_birth_year : null,
  });

  const handleSlugError = (err: Error) => {
    if (err.message?.includes("categories_event_id_slug_key")) {
      toast.error("Já existe uma categoria com esse slug neste evento.");
    } else {
      toast.error("Erro: " + err.message);
    }
  };

  const createMutation = useMutation({
    mutationFn: async (values: CategoryFormValues) => {
      const { error } = await supabase.from("categories").insert(toPayload(values));
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success("Categoria criada com sucesso");
      setDialogOpen(false);
    },
    onError: handleSlugError,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...values }: CategoryFormValues & { id: string }) => {
      const { event_id: _, ...payload } = toPayload(values);
      const { error } = await supabase.from("categories").update(payload).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success("Categoria atualizada com sucesso");
      setDialogOpen(false);
      setEditingCategory(null);
    },
    onError: handleSlugError,
  });

  const handleSubmit = (values: CategoryFormValues) => {
    if (editingCategory) {
      updateMutation.mutate({ id: editingCategory.id, ...values });
    } else {
      createMutation.mutate(values);
    }
  };

  const birthRange = (cat: Tables<"categories">) => {
    if (cat.min_birth_year && cat.max_birth_year) return `${cat.min_birth_year}–${cat.max_birth_year}`;
    if (cat.min_birth_year) return `≥ ${cat.min_birth_year}`;
    if (cat.max_birth_year) return `≤ ${cat.max_birth_year}`;
    return "—";
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Categorias</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gestão de categorias por evento dos Jogos Escolares
          </p>
        </div>
        {canWrite && (
          <Button onClick={() => { setEditingCategory(null); setDialogOpen(true); }} disabled={!events.length}>
            <Plus className="mr-2 h-4 w-4" />
            Nova categoria
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-md" />
          ))}
        </div>
      ) : !categories?.length ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 py-16 text-center">
          <Layers className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground font-medium">Nenhuma categoria cadastrada</p>
          <p className="text-sm text-muted-foreground mt-1">Crie a primeira categoria para começar.</p>
        </div>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Evento</TableHead>
                <TableHead>Gênero</TableHead>
                <TableHead>Faixa etária</TableHead>
                {canWrite && <TableHead className="w-[60px]" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((cat) => {
                const event = eventsMap.get(cat.event_id);
                return (
                  <TableRow key={cat.id}>
                    <TableCell className="font-medium">{cat.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {event ? `${event.name} (${event.year})` : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{GENDER_MAP[cat.gender_scope] ?? cat.gender_scope}</Badge>
                    </TableCell>
                    <TableCell>{birthRange(cat)}</TableCell>
                    {canWrite && (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => { setEditingCategory(cat); setDialogOpen(true); }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <CategoryFormDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingCategory(null);
        }}
        category={editingCategory}
        events={events}
        onSubmit={handleSubmit}
        isPending={createMutation.isPending || updateMutation.isPending}
      />
    </div>
  );
}
