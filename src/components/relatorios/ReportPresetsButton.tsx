import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Bookmark, Save, Trash2, FolderOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface PresetRow {
  id: string;
  name: string;
  filters: Record<string, unknown>;
  columns: string[] | null;
}

interface Props {
  reportId: string;
  eventId: string | null | undefined;
  currentFilters: Record<string, unknown>;
  currentColumns?: string[];
  onApply: (filters: Record<string, unknown>, columns: string[] | null) => void;
}

/**
 * Botão compacto de presets persistentes (Popover) para usar no header das páginas de relatório.
 * Usa a tabela report_presets (RLS: cada usuário vê os próprios).
 */
export function ReportPresetsButton({ reportId, eventId, currentFilters, currentColumns = [], onApply }: Props) {
  const { toast } = useToast();
  const [presets, setPresets] = useState<PresetRow[]>([]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  const load = async () => {
    let q = supabase.from("report_presets").select("id,name,filters,columns").eq("report_id", reportId);
    if (eventId) q = q.or(`event_id.eq.${eventId},event_id.is.null`);
    const { data } = await q.order("created_at", { ascending: false });
    setPresets(((data as unknown as PresetRow[]) || []));
  };

  useEffect(() => { if (open) load(); }, [open, reportId, eventId]);

  const save = async () => {
    if (!name.trim()) return;
    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setBusy(false); return; }
    const { error } = await supabase.from("report_presets").insert({
      report_id: reportId,
      event_id: eventId ?? null,
      name: name.trim(),
      filters: currentFilters as never,
      columns: currentColumns as never,
      created_by: user.id,
    } as never);
    setBusy(false);
    if (error) toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    else { toast({ title: "Preset salvo" }); setName(""); load(); }
  };

  const remove = async (id: string) => {
    await supabase.from("report_presets").delete().eq("id", id);
    load();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <Bookmark className="h-4 w-4 mr-1.5" /> Presets
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-3">
          <div>
            <p className="text-xs font-semibold mb-1.5">Salvar filtros atuais</p>
            <div className="flex gap-2">
              <Input className="h-8 text-sm" placeholder="Nome do preset" value={name} onChange={(e) => setName(e.target.value)} />
              <Button size="sm" onClick={save} disabled={busy || !name.trim()} className="h-8">
                <Save className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          <div className="border-t pt-2">
            <p className="text-xs font-semibold mb-1.5">Meus presets</p>
            {presets.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">Nenhum preset salvo.</p>
            ) : (
              <div className="space-y-1 max-h-56 overflow-y-auto">
                {presets.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-2 px-2 py-1.5 rounded hover:bg-muted/50 text-sm">
                    <button
                      onClick={() => { onApply(p.filters || {}, p.columns); setOpen(false); }}
                      className="flex items-center gap-1.5 text-left flex-1 truncate"
                    >
                      <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="truncate">{p.name}</span>
                    </button>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => remove(p.id)}>
                      <Trash2 className="h-3 w-3 text-muted-foreground" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
