import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Plus, Pencil, Copy, Key, LayoutDashboard, ClipboardList, Users } from 'lucide-react';
import { toast } from 'sonner';

interface Researcher {
  id: string;
  name: string;
  event_id: string;
  event_stage_id?: string | null;
  active: boolean;
  last_login_at: string | null;
  assigned_location?: string | null;
  pesquisa_events?: { name: string; event_stage_id?: string | null } | null;
}

export default function PesquisaPesquisadoresPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { stageId } = useParams<{ stageId: string }>();
  const base = stageId ? `/admin/etapa/${stageId}/pesquisa` : '/admin/pesquisa';
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Researcher | null>(null);
  const [form, setForm] = useState({ name: '', event_id: '', active: true, assigned_location: '' });
  const [pinTarget, setPinTarget] = useState<Researcher | null>(null);
  const [newPin, setNewPin] = useState('');
  const [generatedPin, setGeneratedPin] = useState('');

  const { data: events } = useQuery({
    queryKey: ['pesquisa-events-list'],
    queryFn: async () => {
      const { data } = await supabase.from('pesquisa_events').select('id, name, event_stage_id').order('name');
      return (data || []) as { id: string; name: string; event_stage_id: string | null }[];
    },
  });

  const { data: researchers, isLoading } = useQuery({
    queryKey: ['pesquisa-researchers-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pesquisa_researchers')
        .select('id, name, event_id, active, last_login_at, assigned_location, pesquisa_events(name)')
        .order('name');
      if (error) throw error;
      return data as unknown as Researcher[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editing) {
        const { error } = await supabase.from('pesquisa_researchers')
          .update({
            name: form.name.trim(),
            event_id: form.event_id,
            active: form.active,
            assigned_location: form.assigned_location.trim() || null,
          })
          .eq('id', editing.id);
        if (error) throw error;
      } else {
        // Generate random PIN
        const pin = String(Math.floor(1000 + Math.random() * 9000));
        const { data: hash, error: hashErr } = await supabase.rpc('pesquisa_hash_pin', { pin });
        if (hashErr) throw hashErr;
        const { error } = await supabase.from('pesquisa_researchers').insert({
          name: form.name.trim(),
          event_id: form.event_id,
          active: form.active,
          pin_hash: hash as string,
          assigned_location: form.assigned_location.trim() || null,
        });
        if (error) throw error;
        setGeneratedPin(pin);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pesquisa-researchers-admin'] });
      if (!editing && generatedPin) {
        // Keep dialog to show PIN
      } else {
        setDialogOpen(false);
      }
      toast.success(editing ? 'Pesquisador atualizado' : 'Pesquisador criado');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const pinMutation = useMutation({
    mutationFn: async () => {
      if (!pinTarget || !newPin || newPin.length !== 4) throw new Error('PIN de 4 dígitos obrigatório');
      const { data: hash, error: hashErr } = await supabase.rpc('pesquisa_hash_pin', { pin: newPin });
      if (hashErr) throw hashErr;
      const { error } = await supabase.from('pesquisa_researchers')
        .update({ pin_hash: hash as string })
        .eq('id', pinTarget.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pesquisa-researchers-admin'] });
      setPinDialogOpen(false);
      toast.success('PIN atualizado');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const openNew = () => {
    setEditing(null);
    setGeneratedPin('');
    setForm({ name: '', event_id: events?.[0]?.id || '', active: true, assigned_location: '' });
    setDialogOpen(true);
  };

  const openEdit = (r: Researcher) => {
    setEditing(r);
    setGeneratedPin('');
    setForm({ name: r.name, event_id: r.event_id, active: r.active, assigned_location: r.assigned_location || '' });
    setDialogOpen(true);
  };

  const openPin = (r: Researcher) => {
    setPinTarget(r);
    setNewPin('');
    setPinDialogOpen(true);
  };

  const pwaUrl = `${window.location.origin}/pwa/pesquisa/login`;

  const copyMessage = (r: Researcher, pin?: string) => {
    const location = r.assigned_location ? `\nLocal padrão: ${r.assigned_location}` : '';
    const msg = `Pesquisa de Satisfação JER\nLink: ${pwaUrl}\nPIN: ${pin || '****'}\nPesquisador: ${r.name}${location}`;
    navigator.clipboard.writeText(msg);
    toast.success('Mensagem copiada!');
  };

  return (
    <div className="space-y-6">
      {/* Header + Tabs */}
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pesquisa de Satisfação</h1>
          <p className="text-sm text-muted-foreground">Gestão e resultados das pesquisas OSC</p>
        </div>
        <div className="flex gap-1 border-b border-border">
          <button
            onClick={() => navigate(base)}
            className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 border-transparent text-muted-foreground hover:text-foreground hover:border-border -mb-px transition-colors"
          >
            <LayoutDashboard className="h-4 w-4" /> Dashboard
          </button>
          <button
            onClick={() => navigate(`${base}/eventos`)}
            className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 border-transparent text-muted-foreground hover:text-foreground hover:border-border -mb-px transition-colors"
          >
            <ClipboardList className="h-4 w-4" /> Pesquisas
          </button>
          <button
            onClick={() => navigate(`${base}/pesquisadores`)}
            className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 border-primary text-primary -mb-px transition-colors"
          >
            <Users className="h-4 w-4" /> Pesquisadores
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Pesquisadores</h1>
          <p className="text-sm text-muted-foreground">Gerencie pesquisadores e PINs de acesso</p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" /> Novo Pesquisador</Button>
      </div>

      {isLoading ? <p className="text-muted-foreground">Carregando...</p> : (
        <div className="space-y-3">
          {researchers?.map(r => (
            <Card key={r.id} className="p-4 flex items-center justify-between">
              <div>
                <p className="font-medium">{r.name}</p>
                <p className="text-sm text-muted-foreground">
                  {(r as any).pesquisa_events?.name || '?'}
                  {r.event_stage_id && <span className="ml-1 text-xs">· etapa vinculada</span>}
                  {' · '}{r.active ? '✅ Ativo' : '⏸ Inativo'}
                  {r.last_login_at && ` · Login: ${new Date(r.last_login_at).toLocaleDateString('pt-BR')}`}
                </p>
                {r.assigned_location && (
                  <p className="text-xs text-muted-foreground">Local padrão: {r.assigned_location}</p>
                )}
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => openPin(r)} title="Definir PIN"><Key className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => copyMessage(r)} title="Copiar mensagem"><Copy className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => openEdit(r)} title="Editar"><Pencil className="h-4 w-4" /></Button>
              </div>
            </Card>
          ))}
          {researchers?.length === 0 && <p className="text-muted-foreground text-center py-8">Nenhum pesquisador cadastrado</p>}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setGeneratedPin(''); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Pesquisador' : 'Novo Pesquisador'}</DialogTitle>
          </DialogHeader>

          {generatedPin ? (
            <div className="text-center space-y-4 py-4">
              <p className="text-lg font-bold">PIN gerado: <span className="text-primary text-2xl">{generatedPin}</span></p>
              <p className="text-sm text-muted-foreground">Anote o PIN — ele não poderá ser visualizado depois.</p>
              <Button onClick={() => { copyMessage({ name: form.name, id: '', event_id: form.event_id, event_stage_id: null, active: true, last_login_at: null, assigned_location: form.assigned_location || null }, generatedPin); }}>
                <Copy className="h-4 w-4 mr-2" /> Copiar mensagem com PIN
              </Button>
              <Button variant="outline" onClick={() => { setDialogOpen(false); setGeneratedPin(''); }}>Fechar</Button>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome *</Label>
                  <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} maxLength={200} />
                </div>
                <div className="space-y-2">
                  <Label>Evento *</Label>
                  <Select value={form.event_id} onValueChange={v => setForm(f => ({ ...f, event_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecionar evento" /></SelectTrigger>
                    <SelectContent>
                      {events?.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Local padrão de aplicação</Label>
                  <Input
                    value={form.assigned_location}
                    onChange={e => setForm(f => ({ ...f, assigned_location: e.target.value }))}
                    placeholder="Ex.: Ginásio 2 / Alojamento escola X"
                    maxLength={200}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={form.active} onCheckedChange={a => setForm(f => ({ ...f, active: a }))} />
                  <Label>Ativo</Label>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                <Button onClick={() => saveMutation.mutate()} disabled={!form.name.trim() || !form.event_id || saveMutation.isPending}>
                  {saveMutation.isPending ? 'Salvando...' : 'Salvar'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* PIN Dialog */}
      <Dialog open={pinDialogOpen} onOpenChange={setPinDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Definir PIN — {pinTarget?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Novo PIN (4 dígitos)</Label>
              <Input
                type="text"
                inputMode="numeric"
                maxLength={4}
                value={newPin}
                onChange={e => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                className="text-center text-2xl tracking-[0.5em] font-mono"
              />
            </div>
            <Button variant="outline" className="w-full" onClick={() => setNewPin(String(Math.floor(1000 + Math.random() * 9000)))}>
              Gerar PIN aleatório
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPinDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => pinMutation.mutate()} disabled={newPin.length !== 4 || pinMutation.isPending}>
              {pinMutation.isPending ? 'Salvando...' : 'Salvar PIN'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
