
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
      { name: "delegations", columns: ["id", "school_name", "event_id"] },
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
      { name: "participants", columns: ["id", "name", "badge_name", "document", "birth_date", "gender", "status", "delegation_id", "event_id"], joins: ["delegations", "people"] },
      { name: "delegations", columns: ["id", "school_name"] },
      { name: "people", columns: ["id", "full_name"] }
    ]
  },
  {
    route: "/admin/credenciamento",
    label: "Credenciamento",
    tables: [
      { name: "participants", columns: ["id", "name", "badge_name", "status", "delegation_id", "event_id"] },
      { name: "participant_credentials", columns: ["id", "participant_id", "status", "issued_at"] },
      { name: "delegations", columns: ["id", "school_name"] }
    ]
  },
  {
    route: "/admin/transporte/viagens",
    label: "Viagens de Transporte",
    tables: [
      { name: "transport_trips", columns: ["id", "route_id", "vehicle_id", "driver_name", "status", "scheduled_start", "event_id"], joins: ["transport_routes", "transport_vehicles"] },
      { name: "transport_routes", columns: ["id", "name"] },
      { name: "transport_vehicles", columns: ["id", "plate", "model"] }
    ]
  },
  {
    route: "/admin/alimentacao/consumo",
    label: "Consumo de Alimentação",
    tables: [
      { name: "meal_consumptions", columns: ["id", "participant_id", "meal_window_id", "consumed_at"], joins: ["participants", "meal_windows"] },
      { name: "participants", columns: ["id", "name"] },
      { name: "meal_windows", columns: ["id", "label"] }
    ]
  },
  {
    route: "/admin/alojamento/ocupacao",
    label: "Ocupação de Alojamento",
    tables: [
      { name: "lodging_occupancies", columns: ["id", "participant_id", "unit_id", "status", "check_in_at"], joins: ["participants", "lodging_units"] },
      { name: "participants", columns: ["id", "name"] },
      { name: "lodging_units", columns: ["id", "name", "capacity"] }
    ]
  },
  {
    route: "/admin/competicao/partidas-agenda",
    label: "Agenda de Partidas",
    tables: [
      { name: "competition_matches", columns: ["id", "sport_event_id", "match_date", "start_time", "status", "location_id", "event_id"], joins: ["sport_events", "locations"] },
      { name: "sport_events", columns: ["id", "name"] },
      { name: "locations", columns: ["id", "name"] }
    ]
  }
];
