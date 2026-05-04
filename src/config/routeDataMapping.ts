
export interface RouteDataRequirement {
  route: string;
  label: string;
  tables: {
    name: string;
    columns: string[];
    joins?: string[];
  }[];
}

export const ROUTE_DATA_MAPPING: RouteDataRequirement[] = [
  {
    route: "/admin",
    label: "Dashboard",
    tables: [
      { name: "events", columns: ["id", "name", "year", "status"] },
      { name: "participants", columns: ["id", "credentialed_at", "delegation_id", "event_id"] },
      { name: "participant_credentials", columns: ["id", "status", "issued_at", "created_at", "participant_id", "event_id"] },
      { name: "delegations", columns: ["id", "institution_id", "event_id"] },
      { name: "meal_windows", columns: ["id", "service_date", "meal_type_id", "label", "event_id"] },
      { name: "meal_types", columns: ["id", "name", "event_id"] },
      { name: "lodging_units", columns: ["id", "capacity", "is_active", "event_id"] },
      { name: "lodging_occupancies", columns: ["id", "status", "event_id"] },
      { name: "transport_trips", columns: ["id", "event_id"] },
      { name: "transport_vehicles", columns: ["id", "event_id"] },
      { name: "sport_events", columns: ["id", "name", "event_id"], joins: ["sports"] },
      { name: "competition_matches", columns: ["id", "status", "sport_event_id", "match_date", "start_time", "event_id"] },
      { name: "meal_consumptions", columns: ["id", "meal_window_id", "consumed_at", "participant_id"] },
      { name: "transport_passengers", columns: ["id", "trip_id", "status"] },
      { name: "competition_match_results", columns: ["match_id", "result_status"] }
    ]
  },
  {
    route: "/admin/eventos",
    label: "Gestão de Eventos",
    tables: [
      { name: "events", columns: ["id", "name", "slug", "year", "status", "start_date", "end_date"] }
    ]
  },
  {
    route: "/admin/participantes",
    label: "Lista de Participantes",
    tables: [
      // participants é tabela de PARTICIPAÇÃO (event-scoped). Dados cadastrais
      // (nome, CPF, nascimento, gênero, etc.) ficam em `people`, JOIN via person_id.
      { name: "participants", columns: ["id", "person_id", "status", "delegation_id", "event_id", "participant_type", "enrollment_class"], joins: ["delegations", "people"] },
      { name: "delegations", columns: ["id", "institution_id"] },
      { name: "people", columns: ["id", "full_name", "cpf", "birth_date", "gender"] }
    ]
  },
  {
    route: "/admin/credenciamento",
    label: "Credenciamento",
    tables: [
      { name: "participants", columns: ["id", "person_id", "status", "delegation_id", "event_id", "credentialed_at"] },
      { name: "participant_credentials", columns: ["id", "participant_id", "status", "issued_at"] },
      { name: "delegations", columns: ["id", "institution_id"] },
      { name: "people", columns: ["id", "full_name", "cpf"] }
    ]
  },
  {
    route: "/admin/transporte/viagens",
    label: "Viagens de Transporte",
    tables: [
      // Schema real: transport_trips.scheduled_at (não scheduled_start);
      // assigned_driver_id (não vehicle_id — vehicles vêm por join indireto).
      { name: "transport_trips", columns: ["id", "route_id", "assigned_driver_id", "driver_name", "status", "trip_status", "scheduled_at", "event_id", "event_stage_id"], joins: ["transport_routes"] },
      { name: "transport_routes", columns: ["id", "name", "origin", "destination"] }
    ]
  },
  {
    route: "/admin/alimentacao/consumo",
    label: "Consumo de Alimentação",
    tables: [
      { name: "meal_consumptions", columns: ["id", "participant_id", "meal_window_id", "consumed_at"], joins: ["participants", "meal_windows", "people"] },
      { name: "participants", columns: ["id", "person_id", "delegation_id", "event_id"] },
      { name: "people", columns: ["id", "full_name", "cpf"] },
      { name: "meal_windows", columns: ["id", "label", "service_date", "meal_type_id"] }
    ]
  },
  {
    route: "/admin/alojamento/ocupacao",
    label: "Ocupação de Alojamento",
    tables: [
      // Schema real: lodging_occupancies.checked_in_at (não check_in_at).
      { name: "lodging_occupancies", columns: ["id", "participant_id", "unit_id", "status", "checked_in_at", "checked_out_at", "event_id", "event_stage_id"], joins: ["participants", "lodging_units", "people"] },
      { name: "participants", columns: ["id", "person_id", "delegation_id"] },
      { name: "people", columns: ["id", "full_name", "cpf", "gender"] },
      { name: "lodging_units", columns: ["id", "name", "capacity", "gender_restriction", "is_accessible"] }
    ]
  },
  {
    route: "/admin/competicao/partidas-agenda",
    label: "Agenda de Partidas",
    tables: [
      // Schema real: competition_matches.venue_id (não location_id), tabela `venues`.
      { name: "competition_matches", columns: ["id", "sport_event_id", "match_date", "start_time", "status", "venue_id", "event_id", "event_stage_id"], joins: ["sport_events", "venues"] },
      { name: "sport_events", columns: ["id", "name"] },
      { name: "venues", columns: ["id", "name"] }
    ]
  }
];
