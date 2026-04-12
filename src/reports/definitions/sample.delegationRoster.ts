import type { ReportDefinition } from '../core/types';

interface RosterRow {
  full_name: string;
  birth_date: string | null;
  gender: string | null;
  participant_type: string;
  status: string;
  institution_name: string;
}

export const delegationRosterReport: ReportDefinition<RosterRow> = {
  id: 'delegation-roster',
  name: 'Elenco da Delegação',
  description: 'Lista de participantes de uma delegação com dados pessoais e função.',
  scope: 'delegation',
  formats: ['pdf', 'excel'],
  filters: [
    { key: 'event_id', label: 'Evento', type: 'uuid', required: true },
    { key: 'delegation_id', label: 'Delegação', type: 'select' },
    { key: 'participant_type', label: 'Tipo', type: 'select', options: [
      { value: 'atleta', label: 'Atleta' },
      { value: 'tecnico', label: 'Técnico' },
      { value: 'dirigente', label: 'Dirigente' },
      { value: 'staff', label: 'Staff' },
    ]},
  ],
  columns: [
    { key: 'full_name', label: 'Nome Completo', width: 25, visibleByDefault: true },
    { key: 'birth_date', label: 'Nascimento', width: 12, align: 'center', visibleByDefault: true,
      format: (row) => row.birth_date ? new Date(row.birth_date).toLocaleDateString('pt-BR') : '—' },
    { key: 'gender', label: 'Gênero', width: 10, align: 'center', visibleByDefault: true },
    { key: 'participant_type', label: 'Função', width: 12, visibleByDefault: true },
    { key: 'status', label: 'Status', width: 12, align: 'center', visibleByDefault: true },
    { key: 'institution_name', label: 'Instituição', width: 20, visibleByDefault: true },
  ],
  datasource: {
    type: 'custom',
    customLoader: async (filters, ctx, supabase) => {
      let query = supabase.from('participants').select(`
        id, participant_type, status,
        people!inner(full_name, birth_date, gender),
        delegations!inner(id, institutions!inner(name))
      `).eq('event_id', filters.event_id as string);

      if (filters.delegation_id) query = query.eq('delegation_id', filters.delegation_id as string);
      if (filters.participant_type) query = query.eq('participant_type', filters.participant_type as string);

      const { data, error } = await query.order('people(full_name)');
      if (error) throw error;

      return (data || []).map((p: any) => ({
        full_name: p.people?.full_name || '—',
        birth_date: p.people?.birth_date || null,
        gender: p.people?.gender || null,
        participant_type: p.participant_type,
        status: p.status,
        institution_name: p.delegations?.institutions?.name || '—',
      }));
    },
  },
  layout: { orientation: 'portrait', showLogo: true, showPageNumbers: true },
  permissions: { roles: ['admin', 'secretaria', 'coordenacao_tecnica'] },
};
