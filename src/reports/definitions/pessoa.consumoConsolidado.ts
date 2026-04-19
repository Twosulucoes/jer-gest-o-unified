import type { ReportDefinition } from '../core/types';

interface ConsolidatedRow {
  full_name: string;
  cpf: string | null;
  delegation_name: string | null;
  participant_type: string;
  needs_transport: boolean;
  needs_meals: boolean;
  needs_lodging: boolean;
  transport_boardings: number;
  meals_consumed: number;
  lodging_nights: number;
  voucher_uses_total: number;
  total_consumption: number;
}

export const consolidatedPersonReport: ReportDefinition<ConsolidatedRow> = {
  id: 'pessoa-consumo-consolidado',
  name: 'Consumo Consolidado por Pessoa',
  description:
    'Soma de embarques, refeições, diárias e usos de voucher por pessoa, sem duplicar consumo entre múltiplas funções.',
  scope: 'event',
  formats: ['pdf', 'excel'],
  filters: [
    { key: 'event_id', label: 'Evento', type: 'uuid', required: true },
    { key: 'delegation_id', label: 'Delegação', type: 'select' },
    {
      key: 'participant_type',
      label: 'Função',
      type: 'select',
      options: [
        { value: 'atleta', label: 'Atleta' },
        { value: 'tecnico', label: 'Técnico' },
        { value: 'dirigente', label: 'Dirigente' },
        { value: 'arbitro', label: 'Árbitro' },
        { value: 'mesario', label: 'Mesário' },
        { value: 'motorista', label: 'Motorista' },
        { value: 'cozinheira', label: 'Cozinheira' },
        { value: 'colaborador', label: 'Colaborador' },
        { value: 'terceiro', label: 'Terceiro' },
        { value: 'staff', label: 'Staff' },
      ],
    },
    {
      key: 'service_filter',
      label: 'Filtrar por serviço',
      type: 'select',
      options: [
        { value: 'all', label: 'Todos' },
        { value: 'transport', label: 'Apenas transporte' },
        { value: 'meals', label: 'Apenas alimentação' },
        { value: 'lodging', label: 'Apenas alojamento' },
      ],
      defaultValue: 'all',
    },
  ],
  columns: [
    { key: 'full_name', label: 'Nome', width: 22, visibleByDefault: true },
    { key: 'cpf', label: 'CPF', width: 12, align: 'center', visibleByDefault: true,
      format: (r) => r.cpf || '—' },
    { key: 'delegation_name', label: 'Delegação', width: 18, visibleByDefault: true,
      format: (r) => r.delegation_name || '—' },
    { key: 'participant_type', label: 'Função', width: 10, align: 'center', visibleByDefault: true },
    { key: 'transport_boardings', label: 'Transp.', width: 8, align: 'center', visibleByDefault: true },
    { key: 'meals_consumed', label: 'Refeições', width: 9, align: 'center', visibleByDefault: true },
    { key: 'lodging_nights', label: 'Diárias', width: 8, align: 'center', visibleByDefault: true },
    { key: 'voucher_uses_total', label: 'Vouchers', width: 8, align: 'center', visibleByDefault: false },
    { key: 'total_consumption', label: 'Total', width: 8, align: 'center', visibleByDefault: true,
      excel: { bold: true } },
  ],
  datasource: {
    type: 'custom',
    customLoader: async (filters, _ctx, supabase) => {
      let query = supabase
        .from('vw_person_logistics_consumption' as any)
        .select('*')
        .eq('event_id', filters.event_id as string);

      if (filters.delegation_id) query = query.eq('delegation_id', filters.delegation_id as string);
      if (filters.participant_type) query = query.eq('participant_type', filters.participant_type as string);

      const { data, error } = await query;
      if (error) throw error;

      const svc = (filters.service_filter as string) || 'all';

      // Consolida por pessoa (soma todas as funções da mesma pessoa no evento)
      const byPerson = new Map<string, ConsolidatedRow>();
      for (const r of (data || []) as any[]) {
        const key = r.person_id;
        const existing = byPerson.get(key);
        const transport = Number(r.transport_boardings || 0);
        const meals = Number(r.meals_consumed || 0);
        const lodging = Number(r.lodging_nights || 0);
        const voucher = Number(r.voucher_uses_total || 0);

        if (existing) {
          existing.transport_boardings += transport;
          existing.meals_consumed += meals;
          existing.lodging_nights += lodging;
          existing.voucher_uses_total += voucher;
          existing.total_consumption =
            existing.transport_boardings + existing.meals_consumed + existing.lodging_nights;
          // Mantém função "principal" — concatena se forem diferentes
          if (!existing.participant_type.includes(r.participant_type)) {
            existing.participant_type += `, ${r.participant_type}`;
          }
        } else {
          byPerson.set(key, {
            full_name: r.full_name || '—',
            cpf: r.cpf || null,
            delegation_name: r.delegation_name || null,
            participant_type: r.participant_type || '—',
            needs_transport: !!r.needs_transport,
            needs_meals: !!r.needs_meals,
            needs_lodging: !!r.needs_lodging,
            transport_boardings: transport,
            meals_consumed: meals,
            lodging_nights: lodging,
            voucher_uses_total: voucher,
            total_consumption: transport + meals + lodging,
          });
        }
      }

      let rows = Array.from(byPerson.values());

      // Filtro por serviço
      if (svc === 'transport') rows = rows.filter((r) => r.transport_boardings > 0);
      if (svc === 'meals') rows = rows.filter((r) => r.meals_consumed > 0);
      if (svc === 'lodging') rows = rows.filter((r) => r.lodging_nights > 0);

      rows.sort((a, b) => a.full_name.localeCompare(b.full_name, 'pt-BR'));
      return rows;
    },
  },
  summary: {
    enabled: true,
    reducers: [
      { key: 'pessoas', label: 'Pessoas', fn: (rows) => rows.length },
      {
        key: 'transp',
        label: 'Embarques',
        fn: (rows) => rows.reduce((s, r: any) => s + (r.transport_boardings || 0), 0),
      },
      {
        key: 'refeicoes',
        label: 'Refeições',
        fn: (rows) => rows.reduce((s, r: any) => s + (r.meals_consumed || 0), 0),
      },
      {
        key: 'diarias',
        label: 'Diárias',
        fn: (rows) => rows.reduce((s, r: any) => s + (r.lodging_nights || 0), 0),
      },
    ],
  },
  layout: { orientation: 'landscape', showLogo: true, showPageNumbers: true },
  permissions: {
    roles: ['admin', 'secretaria', 'coordenacao_tecnica', 'super_admin'],
  },
};
