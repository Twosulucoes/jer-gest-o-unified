import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Plus, Pencil, Settings2, ClipboardList, CalendarDays, Trash2,
  MapPin, CheckCircle2, PauseCircle, Layers, ChevronRight,
  FileText,
} from 'lucide-react';
import { toast } from 'sonner';
import { PESQUISA_PRESETS } from '@/lib/pesquisa/config';

interface PesquisaEvent {
  id: string;
  name: string;
  location: string | null;
  event_date: string | null;
  active: boolean;
  event_stage_id: string | null;
}

interface EventStageOption {
  id: string;
  name: string;
  kind: string;
  event_name: string;
}

const KIND_LABELS: Record<string, string> = {
  classificatoria: 'Classificatória',
  semifinal: 'Semifinal',
  final: 'Final',
  legado: 'Legado',
  outro: 'Outro',
};

export default function PesquisaEventosPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { stageId } = useParams<{ stageId: string }>();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PesquisaEvent | null>(null);
  const [form, setForm] = useState({
    name: '',
    location: '',
    event_date: '',
    active: true,
    event_stage_id: '',
    presetId: PESQUISA_PRESETS[0].id,
  });

  // ── Queries ──────────────────────────────────────────────────
  const { data: events, isLoading } = useQuery({
    queryKey: ['pesquisa-events-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pesquisa_events')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as PesquisaEvent[];
    },
  });

  const { data: stageOptions = [] } = useQuery({
    queryKey: ['event-stages-for-pesquisa'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('event_stages')
        .select('id, name, kind, event_id, events(name)')
        .eq('status', 'active')
        .order('sort_order');
      if (error) throw error;
      return (data ?? []).map((s: any) => ({
        id: s.id,
        name: s.name,
        kind: s.kind,
        event_name: s.events?.name ?? '',
      })) as EventStageOption[];
    },
  });

  // ── Mutations ─────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async () => {
      const selectedPreset = PESQUISA_PRESETS.find(p => p.id === form.presetId);
      const payload: any = {
        name: form.name.trim(),
        location: form.location.trim() || null,
        event_date: form.event_date || null,
        active: form.active,
        event_stage_id: form.event_stage_id || null,
      };

      if (editing) {
        const { error } = await supabase.from('pesquisa_events').update(payload).eq('id', editing.id);
        if (error) throw error;
      } else {
        // Aplica o config v2 do preset na criação.
        payload.questions_config = selectedPreset?.config ?? null;
        const { error } = await supabase.from('pesquisa_events').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pesquisa-events-admin'] });
      setDialogOpen(false);
      toast.success(editing ? 'Pesquisa atualizada' : 'Pesquisa criada com sucesso');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await (supabase.rpc as any)('pesquisa_delete_event', { p_id: id });
      if (error) throw error;
      const res = data as any;
      if (res?.error === 'HAS_SURVEYS') {
        throw new Error(`Não é possível excluir: ${res.count} resposta(s) vinculada(s). Desative a pesquisa em vez de excluir.`);
      }
      if (res?.error) throw new Error('Você não tem permissão para excluir.');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pesquisa-events-admin'] });
      toast.success('Pesquisa excluída');
    },
    onError: (err: any) => toast.error(err.message),
  });

  // ── Handlers ──────────────────────────────────────────────────
  const openNew = () => {
    setEditing(null);
    setForm({
      name: '',
      location: '',
      event_date: '',
      active: true,
      event_stage_id: stageId ?? '',
      presetId: PESQUISA_PRESETS[0].id,
    });
    setDialogOpen(true);
  };

  const openEdit = (e: PesquisaEvent) => {
    setEditing(e);
    setForm({
      name: e.name,
      location: e.location ?? '',
      event_date: e.event_date ?? '',
      active: e.active,
      event_stage_id: e.event_stage_id ?? '',
      presetId: PESQUISA_PRESETS[0].id,
    });
    setDialogOpen(true);
  };

  const goToFormEditor = (eventId: string) => {
    if (stageId) {
      navigate(`/admin/etapa/${stageId}/pesquisa/eventos/${eventId}/form`);
    } else {
      navigate(`/admin/pesquisa/eventos/${eventId}/form`);
    }
  };

  const stageName = (stageId: string | null) => {
    if (!stageId) return null;
    const s = stageOptions.find(o => o.id === stageId);
    if (!s) return null;
    return `${s.event_name} · ${s.name} (${KIND_LABELS[s.kind] ?? s.kind})`;
  };

  const selectedPreset = PESQUISA_PRESETS.find(p => p.id === form.presetId);

  const base = stageId ? `/admin/etapa/${stageId}/pesquisa` : '/admin/pesquisa';

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Header + Tabs */}
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Pesquisa de Satisfação</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Gerencie as pesquisas vinculadas às etapas — coleta OSC para prestação de contas
            </p>
          </div>
          <Button onClick={openNew} className="shrink-0 gap-2">
            <Plus className="h-4 w-4" />
            Nova Pesquisa
          </Button>
        </div>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 rounded-xl border bg-muted/30 animate-pulse" />
          ))}
        </div>
      ) : events?.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
          <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
            <ClipboardList className="h-7 w-7 text-muted-foreground" />
          </div>
          <div>
            <p className="font-semibold text-foreground">Nenhuma pesquisa cadastrada</p>
            <p className="text-sm text-muted-foreground">Crie a primeira pesquisa usando o botão acima</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {events?.map(ev => {
            const linkedStage = stageName(ev.event_stage_id);
            return (
              <Card key={ev.id} className="transition-all duration-200 hover:shadow-app-md">
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">

                    {/* Status dot */}
                    <div className="mt-1 shrink-0">
                      {ev.active
                        ? <CheckCircle2 className="h-5 w-5 text-success" />
                        : <PauseCircle className="h-5 w-5 text-muted-foreground" />}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-foreground leading-tight">{ev.name}</p>
                        <Badge variant={ev.active ? 'success' : 'muted'} className="text-[10px] py-0">
                          {ev.active ? 'Ativa' : 'Inativa'}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        {ev.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> {ev.location}
                          </span>
                        )}
                        {ev.event_date && (
                          <span className="flex items-center gap-1">
                            <CalendarDays className="h-3 w-3" />
                            {new Date(ev.event_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                          </span>
                        )}
                        {linkedStage && (
                          <span className="flex items-center gap-1 text-primary font-medium">
                            <Layers className="h-3 w-3" /> {linkedStage}
                          </span>
                        )}
                        {!linkedStage && (
                          <span className="flex items-center gap-1 text-warning">
                            <Layers className="h-3 w-3" /> Sem etapa vinculada
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Ações */}
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-xs"
                        onClick={() => openEdit(ev)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Editar
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        className="gap-1.5 text-xs"
                        onClick={() => goToFormEditor(ev.id)}
                      >
                        <Settings2 className="h-3.5 w-3.5" />
                        Configurar
                        <ChevronRight className="h-3 w-3 opacity-60" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm" className="gap-1.5 text-xs text-destructive hover:text-destructive" title="Excluir">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir pesquisa?</AlertDialogTitle>
                            <AlertDialogDescription>
                              <strong>{ev.name}</strong> será removida permanentemente, junto com seus pesquisadores e sessões. Respostas já coletadas bloqueiam a exclusão.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteMutation.mutate(ev.id)}>
                              Excluir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialog: criar / editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              {editing ? 'Editar Pesquisa' : 'Nova Pesquisa'}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? 'Atualize as informações básicas. Para alterar perguntas, use "Configurar".'
                : 'Preencha as informações e escolha um modelo de formulário.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1">

            {/* Modelo — só na criação */}
            {!editing && (
              <div className="space-y-2">
                <Label className="font-semibold">Modelo de formulário</Label>
                <div className="grid grid-cols-1 gap-2">
                  {PESQUISA_PRESETS.map(preset => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, presetId: preset.id }))}
                      className={[
                        'w-full text-left rounded-lg border p-3 transition-all duration-150',
                        form.presetId === preset.id
                          ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                          : 'border-border hover:border-primary/30 hover:bg-muted/40',
                      ].join(' ')}
                    >
                      <span className="font-semibold text-sm">{preset.name}</span>
                      <p className="text-xs text-muted-foreground leading-snug mt-0.5">{preset.description}</p>
                    </button>
                  ))}
                </div>
                {selectedPreset && (
                  <p className="text-xs text-muted-foreground pl-1">
                    {selectedPreset.config.questions.length} perguntas · {selectedPreset.config.sections.length} seções · personalize depois em “Configurar”
                  </p>
                )}
                <Separator />
              </div>
            )}

            {/* Nome */}
            <div className="space-y-1.5">
              <Label htmlFor="p-name">Nome da pesquisa *</Label>
              <Input
                id="p-name"
                placeholder="Ex: Pesquisa JER 2026 — Etapa Final"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                maxLength={200}
              />
            </div>

            {/* Vinculação de etapa */}
            {!stageId && (
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-primary" />
                  Etapa da competição
                </Label>
                <Select
                  value={form.event_stage_id || 'none'}
                  onValueChange={v => setForm(f => ({ ...f, event_stage_id: v === 'none' ? '' : v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma etapa" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Sem etapa vinculada —</SelectItem>
                    {stageOptions.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.event_name} · {s.name} ({KIND_LABELS[s.kind] ?? s.kind})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Necessário para rastrear respostas por fase e gerar relatórios de prestação de contas.
                </p>
              </div>
            )}

            {/* Local + Data */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="p-location" className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" /> Local
                </Label>
                <Input
                  id="p-location"
                  placeholder="Ex: Ginásio Central"
                  value={form.location}
                  onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                  maxLength={200}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-date" className="flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5" /> Data
                </Label>
                <Input
                  id="p-date"
                  type="date"
                  value={form.event_date}
                  onChange={e => setForm(f => ({ ...f, event_date: e.target.value }))}
                />
              </div>
            </div>

            {/* Ativo */}
            <div className="flex items-center gap-3 pt-1">
              <Switch
                id="p-active"
                checked={form.active}
                onCheckedChange={a => setForm(f => ({ ...f, active: a }))}
              />
              <Label htmlFor="p-active" className="cursor-pointer">
                Pesquisa ativa — pesquisadores podem fazer login e coletar respostas
              </Label>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!form.name.trim() || saveMutation.isPending}
              className="gap-2"
            >
              {saveMutation.isPending ? 'Salvando...' : editing ? 'Salvar alterações' : 'Criar pesquisa'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
