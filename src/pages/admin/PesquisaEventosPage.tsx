import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import ModuleHeader from '@/components/admin/ModuleHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Plus, Pencil } from 'lucide-react';
import { toast } from 'sonner';

interface PesquisaEvent {
  id: string;
  name: string;
  location: string | null;
  event_date: string | null;
  active: boolean;
}

export default function PesquisaEventosPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PesquisaEvent | null>(null);
  const [form, setForm] = useState({ name: '', location: '', event_date: '', active: true });

  const { data: events, isLoading } = useQuery({
    queryKey: ['pesquisa-events-admin'],
    queryFn: async () => {
      const { data, error } = await supabase.from('pesquisa_events').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data as PesquisaEvent[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        location: form.location.trim() || null,
        event_date: form.event_date || null,
        active: form.active,
      };
      if (editing) {
        const { error } = await supabase.from('pesquisa_events').update(payload).eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('pesquisa_events').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pesquisa-events-admin'] });
      setDialogOpen(false);
      toast.success(editing ? 'Evento atualizado' : 'Evento criado');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const openNew = () => {
    setEditing(null);
    setForm({ name: '', location: '', event_date: '', active: true });
    setDialogOpen(true);
  };

  const openEdit = (e: PesquisaEvent) => {
    setEditing(e);
    setForm({ name: e.name, location: e.location || '', event_date: e.event_date || '', active: e.active });
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Eventos da Pesquisa</h1>
          <p className="text-sm text-muted-foreground">Gerencie os eventos vinculados à pesquisa de satisfação</p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" /> Novo Evento</Button>
      </div>

      {isLoading ? <p className="text-muted-foreground">Carregando...</p> : (
        <div className="space-y-3">
          {events?.map(e => (
            <Card key={e.id} className="p-4 flex items-center justify-between">
              <div>
                <p className="font-medium">{e.name}</p>
                <p className="text-sm text-muted-foreground">
                  {e.location || 'Sem local'} · {e.event_date || 'Sem data'} · {e.active ? '✅ Ativo' : '⏸ Inativo'}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => openEdit(e)}><Pencil className="h-4 w-4" /></Button>
            </Card>
          ))}
          {events?.length === 0 && <p className="text-muted-foreground text-center py-8">Nenhum evento cadastrado</p>}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Evento' : 'Novo Evento'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} maxLength={200} />
            </div>
            <div className="space-y-2">
              <Label>Local</Label>
              <Input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} maxLength={200} />
            </div>
            <div className="space-y-2">
              <Label>Data</Label>
              <Input type="date" value={form.event_date} onChange={e => setForm(f => ({ ...f, event_date: e.target.value }))} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.active} onCheckedChange={a => setForm(f => ({ ...f, active: a }))} />
              <Label>Ativo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!form.name.trim() || saveMutation.isPending}>
              {saveMutation.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
