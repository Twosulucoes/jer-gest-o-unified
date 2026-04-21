import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { ChevronLeft, ChevronRight, Database, Search } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ColDef {
  key: string;
  label: string;
  type?: "date" | "badge" | "bool" | "text";
}

interface ColGroup {
  label: string;
  hex: string;
  cols: ColDef[];
}

interface TableConfig {
  name: string;
  label: string;
  menuGroup: string;
  orderBy: string;
  select: string;
  colGroups: ColGroup[];
}

type CellStatus = "ok" | "empty" | "orphan" | "empty_nested";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getCellInfo(row: Record<string, unknown>, colKey: string): { value: unknown; status: CellStatus } {
  const parts = colKey.split(".");

  if (parts.length === 1) {
    return { value: row[colKey] ?? null, status: "ok" };
  }

  const parentAlias = parts[0];
  const fkColumn = `${parentAlias}_id`;
  const fkValue = row[fkColumn];
  const parentObj = row[parentAlias];

  if (fkValue === null || fkValue === undefined) {
    return { value: null, status: "empty" };
  }
  if (!parentObj) {
    return { value: null, status: "orphan" };
  }

  const value = parts.reduce((acc: unknown, key) => {
    if (acc === null || acc === undefined) return null;
    return (acc as Record<string, unknown>)[key] ?? null;
  }, row);

  return { value, status: value !== null ? "ok" : "empty_nested" };
}

function getRowHasOrphan(row: Record<string, unknown>, config: TableConfig): boolean {
  return config.colGroups.some((g) =>
    g.cols.some((c) => getCellInfo(row, c.key).status === "orphan")
  );
}

function rowMatchesSearch(row: Record<string, unknown>, config: TableConfig, term: string): boolean {
  if (!term.trim()) return true;
  const lower = term.toLowerCase();
  return config.colGroups.some((g) =>
    g.cols.some((c) => {
      const { value } = getCellInfo(row, c.key);
      return String(value ?? "").toLowerCase().includes(lower);
    })
  );
}

function renderValue(value: unknown, type?: string): string {
  if (value === null || value === undefined || value === "") return "";
  if (type === "date" && typeof value === "string") {
    try { return format(new Date(value), "dd/MM/yyyy", { locale: ptBR }); } catch { return String(value); }
  }
  if (type === "bool") return value ? "Sim" : "Não";
  return String(value);
}

const PAGE_SIZE = 100;

// ─── Table configs ────────────────────────────────────────────────────────────

const TABLE_CONFIGS: TableConfig[] = [
  {
    name: "participants",
    label: "Participantes",
    menuGroup: "Pessoas",
    orderBy: "created_at",
    select: [
      "id", "participant_type", "needs_transport", "needs_meals", "needs_lodging", "created_at",
      "person_id", "person:people(full_name,cpf,email,phone,birth_date,gender)",
      "event_id", "event:events(name,status,year)",
      "delegation_id", "delegation:delegations(school_name,status)",
    ].join(","),
    colGroups: [
      {
        label: "Participante", hex: "#475569",
        cols: [
          { key: "participant_type", label: "Tipo", type: "badge" },
          { key: "needs_transport", label: "Transporte", type: "bool" },
          { key: "needs_meals", label: "Refeição", type: "bool" },
          { key: "needs_lodging", label: "Hospedagem", type: "bool" },
          { key: "created_at", label: "Criado em", type: "date" },
        ],
      },
      {
        label: "Pessoa", hex: "#2563eb",
        cols: [
          { key: "person.full_name", label: "Nome" },
          { key: "person.cpf", label: "CPF" },
          { key: "person.email", label: "E-mail" },
          { key: "person.phone", label: "Telefone" },
          { key: "person.birth_date", label: "Nascimento", type: "date" },
          { key: "person.gender", label: "Gênero", type: "badge" },
        ],
      },
      {
        label: "Evento", hex: "#7c3aed",
        cols: [
          { key: "event.name", label: "Nome" },
          { key: "event.status", label: "Status", type: "badge" },
          { key: "event.year", label: "Ano" },
        ],
      },
      {
        label: "Delegação", hex: "#059669",
        cols: [
          { key: "delegation.school_name", label: "Escola" },
          { key: "delegation.status", label: "Status", type: "badge" },
        ],
      },
    ],
  },
  {
    name: "people",
    label: "Pessoas",
    menuGroup: "Pessoas",
    orderBy: "full_name",
    select: [
      "id", "full_name", "cpf", "email", "phone", "birth_date", "gender", "created_at",
      "institution_id", "institution:institutions(name,city,state,network_type)",
    ].join(","),
    colGroups: [
      {
        label: "Pessoa", hex: "#2563eb",
        cols: [
          { key: "full_name", label: "Nome" },
          { key: "cpf", label: "CPF" },
          { key: "email", label: "E-mail" },
          { key: "phone", label: "Telefone" },
          { key: "birth_date", label: "Nascimento", type: "date" },
          { key: "gender", label: "Gênero", type: "badge" },
          { key: "created_at", label: "Criado em", type: "date" },
        ],
      },
      {
        label: "Instituição", hex: "#d97706",
        cols: [
          { key: "institution.name", label: "Nome" },
          { key: "institution.city", label: "Cidade" },
          { key: "institution.state", label: "UF" },
          { key: "institution.network_type", label: "Rede", type: "badge" },
        ],
      },
    ],
  },
  {
    name: "delegations",
    label: "Delegações",
    menuGroup: "Delegações",
    orderBy: "school_name",
    select: [
      "id", "school_name", "school_official_name", "status", "school_city", "school_state", "created_at",
      "institution_id", "institution:institutions(name,city,state)",
      "event_id", "event:events(name,year)",
    ].join(","),
    colGroups: [
      {
        label: "Delegação", hex: "#059669",
        cols: [
          { key: "school_name", label: "Escola" },
          { key: "school_official_name", label: "Nome oficial" },
          { key: "status", label: "Status", type: "badge" },
          { key: "school_city", label: "Cidade" },
          { key: "school_state", label: "UF" },
          { key: "created_at", label: "Criado em", type: "date" },
        ],
      },
      {
        label: "Instituição", hex: "#d97706",
        cols: [
          { key: "institution.name", label: "Nome" },
          { key: "institution.city", label: "Cidade" },
          { key: "institution.state", label: "UF" },
        ],
      },
      {
        label: "Evento", hex: "#7c3aed",
        cols: [
          { key: "event.name", label: "Evento" },
          { key: "event.year", label: "Ano" },
        ],
      },
    ],
  },
  {
    name: "teams",
    label: "Times",
    menuGroup: "Competição",
    orderBy: "name",
    select: [
      "id", "name", "created_at",
      "delegation_id", "delegation:delegations(school_name,status)",
      "event_id", "event:events(name,year)",
      "sport_event_id", "sport_event:sport_events(gender,sport:sports(name),category:categories(name))",
    ].join(","),
    colGroups: [
      {
        label: "Time", hex: "#0d9488",
        cols: [
          { key: "name", label: "Nome" },
          { key: "created_at", label: "Criado em", type: "date" },
        ],
      },
      {
        label: "Delegação", hex: "#059669",
        cols: [
          { key: "delegation.school_name", label: "Escola" },
          { key: "delegation.status", label: "Status", type: "badge" },
        ],
      },
      {
        label: "Modalidade", hex: "#ea580c",
        cols: [
          { key: "sport_event.sport.name", label: "Esporte" },
          { key: "sport_event.category.name", label: "Categoria" },
          { key: "sport_event.gender", label: "Gênero", type: "badge" },
        ],
      },
      {
        label: "Evento", hex: "#7c3aed",
        cols: [
          { key: "event.name", label: "Evento" },
          { key: "event.year", label: "Ano" },
        ],
      },
    ],
  },
  {
    name: "team_members",
    label: "Membros de Time",
    menuGroup: "Competição",
    orderBy: "created_at",
    select: [
      "id", "created_at",
      "participant_id", "participant:participants(participant_type,person:people(full_name,cpf))",
      "team_id", "team:teams(name,delegation:delegations(school_name),sport_event:sport_events(sport:sports(name),category:categories(name)))",
    ].join(","),
    colGroups: [
      {
        label: "Membro", hex: "#0d9488",
        cols: [
          { key: "created_at", label: "Adicionado em", type: "date" },
        ],
      },
      {
        label: "Participante", hex: "#475569",
        cols: [
          { key: "participant.person.full_name", label: "Nome" },
          { key: "participant.person.cpf", label: "CPF" },
          { key: "participant.participant_type", label: "Tipo", type: "badge" },
        ],
      },
      {
        label: "Time", hex: "#0f766e",
        cols: [
          { key: "team.name", label: "Time" },
          { key: "team.delegation.school_name", label: "Escola" },
          { key: "team.sport_event.sport.name", label: "Esporte" },
          { key: "team.sport_event.category.name", label: "Categoria" },
        ],
      },
    ],
  },
  {
    name: "sport_events",
    label: "Modalidades",
    menuGroup: "Esportes",
    orderBy: "created_at",
    select: [
      "id", "gender", "created_at",
      "sport_id", "sport:sports(name)",
      "category_id", "category:categories(name,min_age,max_age)",
      "event_id", "event:events(name,year)",
    ].join(","),
    colGroups: [
      {
        label: "Modalidade", hex: "#ea580c",
        cols: [
          { key: "gender", label: "Gênero", type: "badge" },
          { key: "created_at", label: "Criado em", type: "date" },
        ],
      },
      {
        label: "Esporte", hex: "#dc2626",
        cols: [{ key: "sport.name", label: "Esporte" }],
      },
      {
        label: "Categoria", hex: "#db2777",
        cols: [
          { key: "category.name", label: "Categoria" },
          { key: "category.min_age", label: "Idade mín." },
          { key: "category.max_age", label: "Idade máx." },
        ],
      },
      {
        label: "Evento", hex: "#7c3aed",
        cols: [
          { key: "event.name", label: "Evento" },
          { key: "event.year", label: "Ano" },
        ],
      },
    ],
  },
  {
    name: "participant_sport_events",
    label: "Inscrições em Modalidades",
    menuGroup: "Competição",
    orderBy: "created_at",
    select: [
      "id", "created_at",
      "participant_id", "participant:participants(participant_type,person:people(full_name,cpf))",
      "sport_event_id", "sport_event:sport_events(gender,sport:sports(name),category:categories(name))",
    ].join(","),
    colGroups: [
      {
        label: "Inscrição", hex: "#475569",
        cols: [{ key: "created_at", label: "Inscrito em", type: "date" }],
      },
      {
        label: "Participante", hex: "#334155",
        cols: [
          { key: "participant.person.full_name", label: "Nome" },
          { key: "participant.person.cpf", label: "CPF" },
          { key: "participant.participant_type", label: "Tipo", type: "badge" },
        ],
      },
      {
        label: "Modalidade", hex: "#ea580c",
        cols: [
          { key: "sport_event.sport.name", label: "Esporte" },
          { key: "sport_event.category.name", label: "Categoria" },
          { key: "sport_event.gender", label: "Gênero", type: "badge" },
        ],
      },
    ],
  },
  {
    name: "participant_event_roles",
    label: "Funções de Participantes",
    menuGroup: "Pessoas",
    orderBy: "created_at",
    select: [
      "id", "role", "created_at",
      "participant_id", "participant:participants(participant_type,person:people(full_name,cpf))",
      "event_id", "event:events(name,year)",
      "delegation_id", "delegation:delegations(school_name)",
    ].join(","),
    colGroups: [
      {
        label: "Função", hex: "#475569",
        cols: [
          { key: "role", label: "Função", type: "badge" },
          { key: "created_at", label: "Atribuída em", type: "date" },
        ],
      },
      {
        label: "Participante", hex: "#334155",
        cols: [
          { key: "participant.person.full_name", label: "Nome" },
          { key: "participant.person.cpf", label: "CPF" },
        ],
      },
      {
        label: "Evento", hex: "#7c3aed",
        cols: [{ key: "event.name", label: "Evento" }],
      },
      {
        label: "Delegação", hex: "#059669",
        cols: [{ key: "delegation.school_name", label: "Escola" }],
      },
    ],
  },
  {
    name: "competition_matches",
    label: "Partidas",
    menuGroup: "Competição",
    orderBy: "scheduled_at",
    select: [
      "id", "status", "scheduled_at", "created_at",
      "event_id", "event:events(name,year)",
      "sport_event_id", "sport_event:sport_events(gender,sport:sports(name),category:categories(name))",
      "venue_id", "venue:venues(name)",
    ].join(","),
    colGroups: [
      {
        label: "Partida", hex: "#475569",
        cols: [
          { key: "status", label: "Status", type: "badge" },
          { key: "scheduled_at", label: "Agendada", type: "date" },
          { key: "created_at", label: "Criada em", type: "date" },
        ],
      },
      {
        label: "Modalidade", hex: "#ea580c",
        cols: [
          { key: "sport_event.sport.name", label: "Esporte" },
          { key: "sport_event.category.name", label: "Categoria" },
          { key: "sport_event.gender", label: "Gênero", type: "badge" },
        ],
      },
      {
        label: "Local", hex: "#0891b2",
        cols: [{ key: "venue.name", label: "Local" }],
      },
      {
        label: "Evento", hex: "#7c3aed",
        cols: [{ key: "event.name", label: "Evento" }],
      },
    ],
  },
  {
    name: "participant_credentials",
    label: "Credenciais",
    menuGroup: "Credenciais",
    orderBy: "created_at",
    select: [
      "id", "credential_code", "status", "created_at",
      "participant_id", "participant:participants(participant_type,person:people(full_name,cpf))",
      "event_id", "event:events(name,year)",
    ].join(","),
    colGroups: [
      {
        label: "Credencial", hex: "#475569",
        cols: [
          { key: "credential_code", label: "Código" },
          { key: "status", label: "Status", type: "badge" },
          { key: "created_at", label: "Gerada em", type: "date" },
        ],
      },
      {
        label: "Participante", hex: "#334155",
        cols: [
          { key: "participant.person.full_name", label: "Nome" },
          { key: "participant.person.cpf", label: "CPF" },
          { key: "participant.participant_type", label: "Tipo", type: "badge" },
        ],
      },
      {
        label: "Evento", hex: "#7c3aed",
        cols: [{ key: "event.name", label: "Evento" }],
      },
    ],
  },
];

const MENU_GROUPS = Array.from(new Set(TABLE_CONFIGS.map((t) => t.menuGroup)));

// ─── Cell component ───────────────────────────────────────────────────────────

function DataCell({ row, col }: { row: Record<string, unknown>; col: ColDef }) {
  const { value, status } = getCellInfo(row, col.key);

  if (status === "orphan") {
    return (
      <td className="px-3 py-2 whitespace-nowrap bg-red-950/40 border-r border-zinc-800">
        <span className="text-red-400 text-xs font-medium">🔴 ID sem registro</span>
      </td>
    );
  }

  if (value === null || value === undefined || value === "") {
    return (
      <td className="px-3 py-2 whitespace-nowrap border-r border-zinc-800">
        <span className="text-zinc-600 text-xs">—</span>
      </td>
    );
  }

  const display = renderValue(value, col.type);

  if (col.type === "badge") {
    return (
      <td className="px-3 py-2 whitespace-nowrap border-r border-zinc-800">
        <Badge variant="outline" className="text-xs font-normal border-zinc-600 text-zinc-300">
          {display}
        </Badge>
      </td>
    );
  }

  if (col.type === "bool") {
    return (
      <td className="px-3 py-2 whitespace-nowrap border-r border-zinc-800">
        <Badge variant="outline" className={`text-xs font-normal ${value ? "text-emerald-400 border-emerald-700" : "text-zinc-500 border-zinc-700"}`}>
          {display}
        </Badge>
      </td>
    );
  }

  return (
    <td className="px-3 py-2 whitespace-nowrap border-r border-zinc-800 max-w-[200px]">
      <span className="text-zinc-200 text-xs truncate block" title={display}>
        {display}
      </span>
    </td>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SuperInspectorPage() {
  const [selectedTable, setSelectedTable] = useState(TABLE_CONFIGS[0].name);
  const [onlyProblems, setOnlyProblems] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const config = TABLE_CONFIGS.find((t) => t.name === selectedTable)!;

  const { data: rows = [], isLoading, isFetching } = useQuery({
    queryKey: ["inspector", selectedTable, page],
    queryFn: async () => {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, error } = await (supabase as any)
        .from(selectedTable)
        .select(config.select)
        .order(config.orderBy, { ascending: false })
        .range(from, to);
      if (error) throw error;
      return (data ?? []) as Record<string, unknown>[];
    },
  });

  const { data: totalCount = 0 } = useQuery({
    queryKey: ["inspector-count", selectedTable],
    queryFn: async () => {
      const { count, error } = await (supabase as any)
        .from(selectedTable)
        .select("id", { count: "exact", head: true });
      if (error) throw error;
      return count ?? 0;
    },
  });

  const filtered = useMemo(() => {
    let result = rows;
    if (onlyProblems) result = result.filter((r) => getRowHasOrphan(r, config));
    if (search.trim()) result = result.filter((r) => rowMatchesSearch(r, config, search));
    return result;
  }, [rows, onlyProblems, search, config]);

  const orphanCount = useMemo(() => rows.filter((r) => getRowHasOrphan(r, config)).length, [rows, config]);

  const allCols = config.colGroups.flatMap((g) => g.cols);
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  function handleTableChange(name: string) {
    setSelectedTable(name);
    setPage(0);
    setSearch("");
    setOnlyProblems(false);
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
          <Database className="h-5 w-5 text-amber-400" />
          Inspetor de Dados
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          Visualize qualquer tabela com todos os dados das relações resolvidos em uma única linha.
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-zinc-400">Tabela</Label>
          <Select value={selectedTable} onValueChange={handleTableChange}>
            <SelectTrigger className="w-64 bg-zinc-900 border-zinc-700 text-zinc-200">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-700">
              {MENU_GROUPS.map((group) => (
                <SelectGroup key={group}>
                  <SelectLabel className="text-zinc-500 text-xs">{group}</SelectLabel>
                  {TABLE_CONFIGS.filter((t) => t.menuGroup === group).map((t) => (
                    <SelectItem key={t.name} value={t.name} className="text-zinc-200">
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-500" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar nas colunas visíveis..."
            className="pl-8 w-56 bg-zinc-900 border-zinc-700 text-zinc-200 placeholder:text-zinc-600 text-sm"
          />
        </div>

        <div className="flex items-center gap-2 pb-0.5">
          <Switch
            id="only-problems"
            checked={onlyProblems}
            onCheckedChange={setOnlyProblems}
            className="data-[state=checked]:bg-red-600"
          />
          <Label htmlFor="only-problems" className="text-sm text-zinc-300 cursor-pointer">
            Só com problemas
            {orphanCount > 0 && (
              <span className="ml-1.5 text-red-400 font-semibold">({orphanCount})</span>
            )}
          </Label>
        </div>

        <div className="ml-auto text-xs text-zinc-500">
          {isFetching ? "Carregando..." : `${totalCount.toLocaleString("pt-BR")} registros no total`}
        </div>
      </div>

      {/* Legenda */}
      <div className="flex items-center gap-4 text-xs text-zinc-500">
        <span>🔴 ID existe mas o registro pai não foi encontrado (órfão)</span>
        <span className="text-zinc-600">— campo vazio (opcional ou não preenchido)</span>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-zinc-800 overflow-hidden">
        <ScrollArea className="w-full" style={{ maxHeight: "calc(100vh - 280px)" }}>
          <div style={{ overflowX: "auto" }}>
            <table className="w-full border-collapse text-sm" style={{ minWidth: "max-content" }}>
              <thead className="sticky top-0 z-10">
                {/* Group headers */}
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-zinc-400 bg-zinc-900 border-r border-b border-zinc-800 whitespace-nowrap">
                    #
                  </th>
                  {config.colGroups.map((group) => (
                    <th
                      key={group.label}
                      colSpan={group.cols.length}
                      className="px-3 py-2 text-left text-xs font-semibold text-white border-r border-b border-zinc-800 whitespace-nowrap"
                      style={{ backgroundColor: group.hex }}
                    >
                      {group.label}
                    </th>
                  ))}
                </tr>
                {/* Column headers */}
                <tr className="bg-zinc-900 border-b border-zinc-800">
                  <th className="px-3 py-2 text-left text-[10px] font-medium text-zinc-500 border-r border-zinc-800 whitespace-nowrap">
                    STATUS
                  </th>
                  {allCols.map((col, i) => (
                    <th
                      key={i}
                      className="px-3 py-2 text-left text-[10px] font-medium text-zinc-400 border-r border-zinc-800 whitespace-nowrap"
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-zinc-800/50">
                {isLoading
                  ? Array.from({ length: 10 }).map((_, i) => (
                      <tr key={i}>
                        {Array.from({ length: allCols.length + 1 }).map((__, j) => (
                          <td key={j} className="px-3 py-2 border-r border-zinc-800">
                            <Skeleton className="h-3 w-full bg-zinc-800" />
                          </td>
                        ))}
                      </tr>
                    ))
                  : filtered.length === 0
                  ? (
                      <tr>
                        <td
                          colSpan={allCols.length + 1}
                          className="px-6 py-16 text-center text-zinc-500 text-sm"
                        >
                          {onlyProblems
                            ? "Nenhum registro com problemas encontrado nesta página."
                            : "Nenhum registro encontrado."}
                        </td>
                      </tr>
                    )
                  : filtered.map((row, idx) => {
                      const hasOrphan = getRowHasOrphan(row, config);
                      return (
                        <tr
                          key={String(row.id ?? idx)}
                          className={`transition-colors hover:bg-zinc-800/30 ${hasOrphan ? "bg-red-950/10" : ""}`}
                        >
                          <td className="px-3 py-2 border-r border-zinc-800 whitespace-nowrap">
                            {hasOrphan ? (
                              <span className="text-red-500 text-xs font-bold">🔴</span>
                            ) : (
                              <span className="text-zinc-600 text-xs">✓</span>
                            )}
                          </td>
                          {allCols.map((col, i) => (
                            <DataCell key={i} row={row} col={col} />
                          ))}
                        </tr>
                      );
                    })}
              </tbody>
            </table>
          </div>
        </ScrollArea>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-xs text-zinc-500">
        <span>
          Página {page + 1} de {Math.max(totalPages, 1)} — mostrando {filtered.length} de {rows.length} registros carregados
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0 || isLoading}
            className="h-7 px-2 bg-zinc-900 border-zinc-700 text-zinc-300"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <span className="px-2">{page + 1}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= totalPages - 1 || isLoading}
            className="h-7 px-2 bg-zinc-900 border-zinc-700 text-zinc-300"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
