import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Save, FolderOpen, Trash2 } from "lucide-react";
import type { ReportPreset } from "../core/types";

interface Props {
  reportId: string;
  eventId: string | null;
  currentFilters: Record<string, unknown>;
  currentColumns: string[];
  onApply: (filters: Record<string, unknown>, columns: string[] | null) => void;
}

export function ReportPresets({ reportId, eventId, currentFilters, currentColumns, onApply }: Props) {
  const [presets, setPresets] = useState<ReportPreset[]>([]);
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchPresets = async () => {
    const { data } = await supabase
      .from('report_presets')
      .select('*')
      .eq('report_id', reportId)
      .order('created_at', { ascending: false });
    setPresets((data as unknown as ReportPreset[]) || []);
  };

  useEffect(() => { fetchPresets(); }, [reportId]);

  const handleSave = async () => {
    if (!newName.trim()) return;
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { error } = await supabase.from('report_presets').insert({
      report_id: reportId,
      event_id: eventId,
      name: newName.trim(),
      filters: currentFilters as any,
      columns: currentColumns as any,
      created_by: user.id,
    } as any);

    setLoading(false);
    if (error) {
      toast({ title: 'Erro ao salvar preset', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Preset salvo' });
      setNewName("");
      fetchPresets();
    }
  };

  const handleDelete = async (id: string) => {
    await supabase.from('report_presets').delete().eq('id', id);
    fetchPresets();
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          className="h-8 text-sm"
          placeholder="Nome do preset"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <Button size="sm" variant="outline" onClick={handleSave} disabled={loading || !newName.trim()} className="gap-1 h-8">
          <Save className="h-3.5 w-3.5" /> Salvar
        </Button>
      </div>
      {presets.length > 0 && (
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {presets.map((p) => (
            <div key={p.id} className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-muted/50 text-sm">
              <button
                onClick={() => onApply(p.filters, p.columns)}
                className="flex items-center gap-1.5 text-left flex-1 truncate"
              >
                <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
                {p.name}
              </button>
              <Button variant="ghost" size="sm" onClick={() => handleDelete(p.id)} className="h-6 w-6 p-0">
                <Trash2 className="h-3 w-3 text-muted-foreground" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
