import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2 } from "lucide-react";
import LodgingWingFormDialog, { type LodgingWingFormValues } from "./LodgingWingFormDialog";

interface Wing {
  id: string;
  location_id: string;
  name: string;
  gender_default: string | null;
  sort_order: number;
}

const GENDER_LABEL: Record<string, string> = {
  male: "Masculino",
  female: "Feminino",
  mixed: "Misto",
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locationId: string;
  locationName: string;
}

export default function LodgingWingsManageDialog({ open, onOpenChange, locationId, locationName }: Props) {
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Wing | null>(null);

  const { data: wings = [], isLoading } = useQuery({
    queryKey: ["lodging_wings_for_location", locationId],
    enabled: open && !!locationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lodging_wings" as any)
        .select("*")
        .eq("location_id", locationId)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as unknown as Wing[];
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["lodging_wings_for_location", locationId] });
    qc.invalidateQueries({ queryKey: ["lodging_wings"] });
  };

  const createMut = useMutation({
    mutationFn: async (v: LodgingWingFormValues) => {
      const { error } = await (supabase.from("lodging_wings" as any) as any).insert({
        location_id: locationId,
        name: v.name,
        gender_default: v.gender_default || null,
        sort_order: v.sort_order ?? 0,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Ala criada"); invalidate(); setFormOpen(false); },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, ...v }: LodgingWingFormValues & { id: string }) => {
      const { error } = await (supabase.from("lodging_wings" as any) as any).update({
        name: v.name,
        gender_default: v.gender_default || null,
        sort_order: v.sort_order ?? 0,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Ala atualizada"); invalidate(); setFormOpen(false); setEditing(null); },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("lodging_wings" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Ala removida"); invalidate(); },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Alas — {locationName}</DialogTitle>
            <DialogDescription>
              Alas opcionais agrupam quartos por critério (sexo, andar, bloco). Quando definidas, podem ditar o sexo padrão dos quartos.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            {isLoading ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Carregando…</p>
            ) : wings.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma ala cadastrada.</p>
            ) : (
              wings.map((w) => (
                <div key={w.id} className="flex items-center justify-between gap-2 p-2.5 rounded-md border bg-card">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm">{w.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {w.gender_default && (
                        <Badge variant="outline" className="text-[10px]">{GENDER_LABEL[w.gender_default] ?? w.gender_default}</Badge>
                      )}
                      <span className="text-[10px] text-muted-foreground">ordem {w.sort_order}</span>
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => { setEditing(w); setFormOpen(true); }}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="text-destructive"
                    onClick={() => { if (confirm(`Remover ala "${w.name}"? Quartos vinculados ficam sem ala.`)) deleteMut.mutate(w.id); }}
                    disabled={deleteMut.isPending}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))
            )}
          </div>

          <Button size="sm" variant="outline" className="w-full mt-3" onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Adicionar ala
          </Button>
        </DialogContent>
      </Dialog>

      <LodgingWingFormDialog
        open={formOpen}
        onOpenChange={(o) => { setFormOpen(o); if (!o) setEditing(null); }}
        wing={editing}
        locationName={locationName}
        onSubmit={(v) => editing ? updateMut.mutate({ id: editing.id, ...v }) : createMut.mutate(v)}
        isPending={createMut.isPending || updateMut.isPending}
      />
    </>
  );
}
