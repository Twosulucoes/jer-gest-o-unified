/**
 * Competition Feature Catalog — maps frontend features to Supabase resources.
 * Used by DiagnosticoCompeticaoPage for auditing and diagnostics.
 */
export interface CompetitionFeature {
  key: string;
  label: string;
  description: string;
  route: string;
  entities: string[];
  supabaseUsage: {
    tables: string[];
    rpcs: string[];
    storageBuckets: string[];
  };
}

export const competitionFeatureCatalog: CompetitionFeature[] = [
  {
    key: "central",
    label: "Central da Competição",
    description: "Painel único: seleção de prova, estrutura, geração de partidas, resultados e pendências de elegibilidade.",
    route: "/admin/competicao/central",
    entities: ["sport", "sport_event", "team", "match", "result", "enrollment"],
    supabaseUsage: {
      tables: ["sports", "sport_events", "competition_phases", "competition_groups", "competition_matches", "competition_match_entries", "competition_match_results", "teams", "participant_sport_events"],
      rpcs: ["rpc_get_competition_summary", "rpc_generate_matches_collective", "rpc_generate_matches_individual", "rpc_can_regenerate_matches", "rpc_launch_match_result", "rpc_list_eligibility_pending", "rpc_detect_schedule_conflicts"],
      storageBuckets: [],
    },
  },
  {
    key: "modalidades",
    label: "Modalidades",
    description: "CRUD de modalidades esportivas e provas vinculadas.",
    route: "/admin/modalidades",
    entities: ["sport", "sport_event"],
    supabaseUsage: {
      tables: ["sports", "sport_events"],
      rpcs: [],
      storageBuckets: [],
    },
  },
  {
    key: "categorias",
    label: "Categorias",
    description: "CRUD de categorias por faixa etária e gênero.",
    route: "/admin/categorias",
    entities: ["category"],
    supabaseUsage: {
      tables: ["categories"],
      rpcs: [],
      storageBuckets: [],
    },
  },
  {
    key: "participantes",
    label: "Participantes / Inscritos",
    description: "Lista participantes e inscrições em provas.",
    route: "/admin/participantes",
    entities: ["athlete", "enrollment"],
    supabaseUsage: {
      tables: ["participants", "people", "delegations", "participant_sport_events"],
      rpcs: [],
      storageBuckets: [],
    },
  },
  {
    key: "equipes",
    label: "Equipes",
    description: "Gerencia equipes e membros por modalidade coletiva.",
    route: "/admin/competicao/equipes",
    entities: ["team", "athlete"],
    supabaseUsage: {
      tables: ["teams", "team_members", "participants"],
      rpcs: ["rpc_sync_collective_teams"],
      storageBuckets: [],
    },
  },
  {
    key: "fases",
    label: "Fases",
    description: "Fases de competição (classificatória, eliminatória, final).",
    route: "/admin/competicao/fases",
    entities: ["phase"],
    supabaseUsage: {
      tables: ["competition_phases", "sport_events"],
      rpcs: [],
      storageBuckets: [],
    },
  },
  {
    key: "grupos",
    label: "Grupos",
    description: "Grupos dentro de cada fase para chaveamento.",
    route: "/admin/competicao/grupos",
    entities: ["group"],
    supabaseUsage: {
      tables: ["competition_groups", "competition_phases"],
      rpcs: ["rpc_generate_groups"],
      storageBuckets: [],
    },
  },
  {
    key: "partidas",
    label: "Partidas / Confrontos",
    description: "Lista e gerencia partidas com entries (lados A/B).",
    route: "/admin/competicao/partidas",
    entities: ["match"],
    supabaseUsage: {
      tables: ["competition_matches", "competition_match_entries", "venues"],
      rpcs: [],
      storageBuckets: [],
    },
  },
  {
    key: "agenda",
    label: "Agenda",
    description: "Visão em calendário/timeline das partidas.",
    route: "/admin/competicao/agenda",
    entities: ["match"],
    supabaseUsage: {
      tables: ["competition_matches", "venues"],
      rpcs: ["rpc_detect_schedule_conflicts"],
      storageBuckets: [],
    },
  },
  {
    key: "resultados",
    label: "Resultados",
    description: "Registra e publica resultados de partidas.",
    route: "/admin/competicao/resultados",
    entities: ["result", "match"],
    supabaseUsage: {
      tables: ["competition_match_results", "competition_match_entries", "match_scores"],
      rpcs: ["rpc_launch_match_result"],
      storageBuckets: [],
    },
  },
  {
    key: "boletins",
    label: "Boletins Oficiais",
    description: "Criação, edição e publicação de boletins oficiais.",
    route: "/admin/boletins",
    entities: ["bulletin", "result"],
    supabaseUsage: {
      tables: ["official_bulletins", "competition_match_results"],
      rpcs: [],
      storageBuckets: [],
    },
  },
  {
    key: "irregularidades",
    label: "Irregularidades",
    description: "Detecção e resolução de irregularidades de participação.",
    route: "/admin/irregularidades",
    entities: ["athlete", "enrollment"],
    supabaseUsage: {
      tables: ["participation_irregularities", "participants", "people"],
      rpcs: ["recompute_participation_irregularities", "get_blocking_irregularities"],
      storageBuckets: [],
    },
  },
  {
    key: "mapa",
    label: "Mapa do Sistema",
    description: "Visão geral de módulos com status, gaps e KPIs.",
    route: "/admin/sistema/diagnostico",
    entities: [],
    supabaseUsage: {
      tables: [],
      rpcs: ["rpc_kpi_provas_sem_partidas", "rpc_kpi_partidas_sem_resultado"],
      storageBuckets: [],
    },
  },
];

/** Flatten all unique Supabase table names from the catalog */
export function getAllCatalogTables(): string[] {
  const set = new Set<string>();
  competitionFeatureCatalog.forEach((f) => f.supabaseUsage.tables.forEach((t) => set.add(t)));
  return Array.from(set).sort();
}

/** Flatten all unique RPC names from the catalog */
export function getAllCatalogRpcs(): string[] {
  const set = new Set<string>();
  competitionFeatureCatalog.forEach((f) => f.supabaseUsage.rpcs.forEach((r) => set.add(r)));
  return Array.from(set).sort();
}
