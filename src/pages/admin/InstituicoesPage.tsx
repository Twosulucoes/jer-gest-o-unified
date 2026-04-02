import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { Plus, Pencil, Building2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import InstitutionFormDialog, { type InstitutionFormValues } from "@/components/admin/InstitutionFormDialog";

const NETWORK_TYPE_MAP: Record<string, string> = {
  municipal: "Municipal", estadual: "Estadual", federal: "Federal", privada: "Privada",
};

export default function InstituicoesPage() {
  const queryClient = useQueryClient();
  const { hasRole } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingInstitution, setEditingInstitution] = useState<Tables<"institutions"> | null>(null);

  const canWrite = hasRole("admin") || hasRole("secretaria");

  const { data: institutions, isLoading } = useQuery({
    queryKey: ["institutions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("institutions").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const toPayload = (values: InstitutionFormValues) => ({
    name: values.name,
    official_name: values.official_name || null,
    slug: values.slug,
    network_type: values.network_type,
    city: values.city || null,
    state: values.state || null,
    district: values.district || null,
    contact_name: values.contact_name || null,
    contact_phone: values.contact_phone || null,
    contact_email: values.contact_email || null,
    is_active: values.is_active,
  });

  const handleError = (err: Error, action: string) => {
    if (err.message?.includes("institutions_slug_key")) {
      toast.error("Já existe uma instituição com este slug. Escolha outro.");
    } else {
      toast.error(`Erro ao ${action} instituição: ${err.message}`);
    }
  };

  const createMutation = useMutation({
    mutationFn: async (values: InstitutionFormValues) => {
      const { error } = await supabase.from("institutions").insert(toPayload(values));
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["institutions"] });
      toast.success("Instituição criada com sucesso");
      setDialogOpen(false);
    },
    onError: (err: Error) => handleError(err, "criar"),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...values }: InstitutionFormValues & { id: string }) => {
      const { error } = await supabase.from("institutions").update(toPayload(values)).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["institutions"] });
      toast.success("Instituição atualizada com sucesso");
      setDialogOpen(false);
      setEditingInstitution(null);
    },
    onError: (err: Error) => handleError(err, "atualizar"),
  });

  const handleSubmit = (values: InstitutionFormValues) => {
    if (editingInstitution) {
      updateMutation.mutate({ id: editingInstitution.id, ...values });
    } else {
      createMutation.mutate(values);
    }
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Instituições</h1>
          <p className="text-sm text-muted-foreground mt-1">Gestão de escolas e entidades participantes dos Jogos Escolares</p>
        </div>
        {canWrite && (
          <Button onClick={() => { setEditingInstitution(null); setDialogOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" />
            Nova instituição
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-md" />
          ))}
        </div>
      ) : !institutions?.length ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 py-16 text-center">
          <Building2 className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground font-medium">Nenhuma instituição cadastrada</p>
          <p className="text-sm text-muted-foreground mt-1">Cadastre a primeira instituição para começar.</p>
        </div>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Rede</TableHead>
                <TableHead>Cidade</TableHead>
                <TableHead>UF</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Status</TableHead>
                {canWrite && <TableHead className="w-[60px]" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {institutions.map((inst) => (
                <TableRow key={inst.id}>
                  <TableCell className="font-medium">{inst.name}</TableCell>
                  <TableCell>{NETWORK_TYPE_MAP[inst.network_type] ?? inst.network_type}</TableCell>
                  <TableCell>{inst.city || "—"}</TableCell>
                  <TableCell>{inst.state || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{inst.contact_name || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={inst.is_active ? "default" : "secondary"}>
                      {inst.is_active ? "Ativa" : "Inativa"}
                    </Badge>
                  </TableCell>
                  {canWrite && (
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => { setEditingInstitution(inst); setDialogOpen(true); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <InstitutionFormDialog
        open={dialogOpen}
        onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditingInstitution(null); }}
        institution={editingInstitution}
        onSubmit={handleSubmit}
        isPending={createMutation.isPending || updateMutation.isPending}
      />
    </div>
  );
}
