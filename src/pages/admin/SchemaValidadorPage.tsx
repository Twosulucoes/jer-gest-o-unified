import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Upload, Download, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

// ─── Types ───
interface ProposedColumn {
  name: string;
  type: string;
  nullable: boolean;
  pk: boolean;
  fk_table: string;
  fk_column: string;
  unique: boolean;
  default_val: string;
  notes: string;
}

interface ProposedTable {
  table_name: string;
  columns: ProposedColumn[];
}

interface SchemaTable {
  table_name: string;
  rls_enabled: boolean;
}

interface SchemaColumn {
  table_name: string;
  column_name: string;
  data_type: string;
  is_nullable: boolean;
  column_default: string | null;
}

interface SchemaConstraint {
  table_name: string;
  constraint_name: string;
  constraint_type: string;
  column_name: string;
  foreign_table_name: string | null;
  foreign_column_name: string | null;
}

interface SchemaPolicy {
  table_name: string;
  policy_name: string;
  cmd: string;
  roles: string[];
  qual: string | null;
  with_check: string | null;
}

interface DiffResult {
  newTables: string[];
  extraTables: string[];
  matchedTables: MatchedTableDiff[];
}

interface MatchedTableDiff {
  table_name: string;
  missingColumnsInDb: string[];
  extraColumnsInDb: string[];
  typeDivergences: { column: string; proposed: string; actual: string }[];
  missingEventId: boolean;
  missingAuditFields: string[];
  rlsEnabled: boolean;
  policyCount: number;
}

interface GapItem {
  priority: "P0" | "P1" | "P2";
  domain: string;
  table: string;
  status: "ok" | "missing" | "partial";
  message: string;
}

// ─── Constants ───
const HEURISTIC_HEADERS = ["tabela", "table", "coluna", "column", "campo", "field", "tipo", "type", "pk", "fk", "descricao", "description", "nullable"];

const P0_TABLES = [
  { domain: "Eventos", tables: ["events"] },
  { domain: "Instituições", tables: ["institutions"] },
  { domain: "Delegações", tables: ["delegations"] },
  { domain: "Pessoas", tables: ["people"] },
  { domain: "Participantes", tables: ["participants"] },
  { domain: "Credenciais", tables: ["participant_credentials"] },
  { domain: "Importação", tables: ["import_logs", "import_row_errors"] },
  { domain: "Provas", tables: ["sport_events", "sports", "categories"] },
  { domain: "Competição", tables: ["competition_matches", "competition_match_entries", "competition_match_results", "competition_phases"] },
  { domain: "Irregularidades", tables: ["participation_irregularities", "event_participation_rules"] },
];

const P1_TABLES = [
  { domain: "Alimentação", tables: ["meal_types", "meal_windows", "meal_consumptions"] },
  { domain: "Transporte", tables: ["transport_vehicles", "transport_routes", "transport_trips"] },
  { domain: "Alojamento", tables: ["lodging_locations", "lodging_units", "lodging_occupancies"] },
];

const P2_TABLES = [
  { domain: "Evidências/OSC", tables: ["evidences", "evidence_documents"] },
  { domain: "Portal Público", tables: ["public_publications"] },
];

const AUDIT_FIELDS = ["created_at", "updated_at"];

// ─── Helpers ───
function normalizeTableName(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
}

function detectSchemaSheet(workbook: XLSX.WorkBook): string | null {
  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name];
    const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { header: 1 });
    if (data.length < 2) continue;
    const headerRow = (data[0] as unknown as unknown[]).map((h) => String(h ?? "").toLowerCase().trim());
    const matchCount = headerRow.filter((h) => HEURISTIC_HEADERS.some((hh) => h.includes(hh))).length;
    if (matchCount >= 2) return name;
  }
  return null;
}

function parseProposedTables(workbook: XLSX.WorkBook, sheetName: string): ProposedTable[] {
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  if (rows.length === 0) return [];

  const headers = Object.keys(rows[0]).map((h) => h.toLowerCase().trim());

  const findHeader = (keywords: string[]) => {
    const original = Object.keys(rows[0]);
    const idx = headers.findIndex((h) => keywords.some((k) => h.includes(k)));
    return idx >= 0 ? original[idx] : null;
  };

  const tableCol = findHeader(["tabela", "table", "entidade", "entity"]);
  const columnCol = findHeader(["coluna", "column", "campo", "field", "atributo"]);
  const typeCol = findHeader(["tipo", "type", "data_type"]);
  const pkCol = findHeader(["pk", "primary", "chave_primaria"]);
  const fkCol = findHeader(["fk", "foreign", "referencia", "ref"]);
  const nullableCol = findHeader(["nullable", "nulo", "null", "obrigatorio", "obrigatório", "required"]);
  const uniqueCol = findHeader(["unique", "unico", "único"]);
  const defaultCol = findHeader(["default", "padrao", "padrão"]);
  const notesCol = findHeader(["descricao", "descrição", "description", "notes", "obs"]);

  if (!tableCol && !columnCol) return [];

  const tablesMap = new Map<string, ProposedColumn[]>();

  for (const row of rows) {
    const rawTable = String(row[tableCol ?? ""] ?? "").trim();
    const rawCol = String(row[columnCol ?? ""] ?? "").trim();
    if (!rawTable && !rawCol) continue;

    const tName = normalizeTableName(rawTable || "unknown");
    if (!tablesMap.has(tName)) tablesMap.set(tName, []);

    if (rawCol) {
      const isNullable = nullableCol
        ? /sim|yes|true|s|y|1/i.test(String(row[nullableCol] ?? ""))
          ? true
          : /nao|não|no|false|n|0|obrigat/i.test(String(row[nullableCol] ?? ""))
            ? false
            : true
        : true;

      tablesMap.get(tName)!.push({
        name: rawCol.toLowerCase().replace(/\s+/g, "_"),
        type: String(row[typeCol ?? ""] ?? "").toLowerCase(),
        nullable: isNullable,
        pk: /sim|yes|true|x|1|pk/i.test(String(row[pkCol ?? ""] ?? "")),
        fk_table: fkCol ? String(row[fkCol] ?? "").split(".")[0]?.trim() || "" : "",
        fk_column: fkCol ? String(row[fkCol] ?? "").split(".")[1]?.trim() || "" : "",
        unique: /sim|yes|true|x|1/i.test(String(row[uniqueCol ?? ""] ?? "")),
        default_val: String(row[defaultCol ?? ""] ?? ""),
        notes: String(row[notesCol ?? ""] ?? ""),
      });
    }
  }

  return Array.from(tablesMap.entries()).map(([table_name, columns]) => ({ table_name, columns }));
}

function computeDiff(
  proposed: ProposedTable[],
  schemaTables: SchemaTable[],
  schemaColumns: SchemaColumn[],
  schemaPolicies: SchemaPolicy[],
  tableMapping: Record<string, string>
): DiffResult {
  const dbTableNames = new Set(schemaTables.map((t) => t.table_name));
  const proposedMapped = proposed.map((p) => ({
    ...p,
    mapped_name: tableMapping[p.table_name] || p.table_name,
  }));

  const mappedNames = new Set(proposedMapped.map((p) => p.mapped_name));

  const newTables = proposedMapped.filter((p) => !dbTableNames.has(p.mapped_name)).map((p) => p.table_name);
  const extraTables = schemaTables
    .filter((t) => !mappedNames.has(t.table_name))
    .filter((t) => !["profiles", "user_roles", "user_delegations"].includes(t.table_name))
    .map((t) => t.table_name);

  const matchedTables: MatchedTableDiff[] = [];

  for (const p of proposedMapped) {
    if (!dbTableNames.has(p.mapped_name)) continue;

    const dbCols = schemaColumns.filter((c) => c.table_name === p.mapped_name);
    const dbColNames = new Set(dbCols.map((c) => c.column_name));
    const proposedColNames = new Set(p.columns.map((c) => c.name));

    const missingColumnsInDb = p.columns.filter((c) => !dbColNames.has(c.name)).map((c) => c.name);
    const extraColumnsInDb = dbCols.filter((c) => !proposedColNames.has(c.column_name)).map((c) => c.column_name);

    const typeDivergences: { column: string; proposed: string; actual: string }[] = [];
    for (const pc of p.columns) {
      const dc = dbCols.find((c) => c.column_name === pc.name);
      if (dc && pc.type && !dc.data_type.includes(pc.type.replace("uuid", "uuid").replace("text", "text"))) {
        const pType = pc.type.toLowerCase();
        const dType = dc.data_type.toLowerCase();
        if (pType && !dType.includes(pType) && pType !== dType) {
          typeDivergences.push({ column: pc.name, proposed: pc.type, actual: dc.data_type });
        }
      }
    }

    const tableInfo = schemaTables.find((t) => t.table_name === p.mapped_name);
    const policies = schemaPolicies.filter((pol) => pol.table_name === p.mapped_name);

    const missingEventId = !dbColNames.has("event_id") && !["people", "institutions", "profiles", "user_roles", "user_delegations", "sports"].includes(p.mapped_name);
    const missingAuditFields = AUDIT_FIELDS.filter((f) => !dbColNames.has(f));

    matchedTables.push({
      table_name: p.mapped_name,
      missingColumnsInDb,
      extraColumnsInDb,
      typeDivergences,
      missingEventId,
      missingAuditFields,
      rlsEnabled: tableInfo?.rls_enabled ?? false,
      policyCount: policies.length,
    });
  }

  return { newTables, extraTables, matchedTables };
}

function computeGaps(proposed: ProposedTable[], dbTableNames: Set<string>, tableMapping: Record<string, string>): GapItem[] {
  const allNames = new Set([
    ...proposed.map((p) => tableMapping[p.table_name] || p.table_name),
    ...dbTableNames,
  ]);

  const gaps: GapItem[] = [];

  const check = (priority: "P0" | "P1" | "P2", items: { domain: string; tables: string[] }[]) => {
    for (const { domain, tables } of items) {
      for (const t of tables) {
        if (allNames.has(t)) {
          gaps.push({ priority, domain, table: t, status: "ok", message: `Tabela '${t}' presente.` });
        } else {
          gaps.push({ priority, domain, table: t, status: "missing", message: `Tabela '${t}' NÃO encontrada na proposta nem no banco.` });
        }
      }
    }
  };

  check("P0", P0_TABLES);
  check("P1", P1_TABLES);
  check("P2", P2_TABLES);

  return gaps;
}

function exportReport(diff: DiffResult, gaps: GapItem[]) {
  const report = {
    summary: {
      new_tables: diff.newTables.length,
      extra_tables: diff.extraTables.length,
      matched_tables: diff.matchedTables.length,
      tables_without_rls: diff.matchedTables.filter((t) => !t.rlsEnabled).length,
    },
    new_tables: diff.newTables,
    extra_tables: diff.extraTables,
    matched_details: diff.matchedTables,
    gaps,
  };
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "schema-validation-report.json";
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Component ───
export default function SchemaValidadorPage() {
  const [proposed, setProposed] = useState<ProposedTable[]>([]);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>("");
  const [workbookRef, setWorkbookRef] = useState<XLSX.WorkBook | null>(null);
  const [tableMapping, setTableMapping] = useState<Record<string, string>>({});
  const [fileName, setFileName] = useState("");

  // Fetch schema
  const { data: schemaTables, isLoading: loadingTables } = useQuery({
    queryKey: ["schema_tables"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rpc_get_schema_tables");
      if (error) throw error;
      return (data as unknown as SchemaTable[]) ?? [];
    },
  });

  const { data: schemaColumns, isLoading: loadingColumns } = useQuery({
    queryKey: ["schema_columns"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rpc_get_schema_columns");
      if (error) throw error;
      return (data as unknown as SchemaColumn[]) ?? [];
    },
  });

  const { data: _schemaConstraints } = useQuery({
    queryKey: ["schema_constraints"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rpc_get_schema_constraints");
      if (error) throw error;
      return (data as unknown as SchemaConstraint[]) ?? [];
    },
  });

  const { data: schemaPolicies } = useQuery({
    queryKey: ["schema_policies"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rpc_get_rls_policies");
      if (error) throw error;
      return (data as unknown as SchemaPolicy[]) ?? [];
    },
  });

  const isLoading = loadingTables || loadingColumns;

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        setWorkbookRef(wb);
        setSheetNames(wb.SheetNames);

        const autoSheet = detectSchemaSheet(wb);
        const sheet = autoSheet || wb.SheetNames[0];
        setSelectedSheet(sheet);

        const tables = parseProposedTables(wb, sheet);
        setProposed(tables);
        setTableMapping({});
        toast.success(`${tables.length} tabela(s) detectada(s) na aba "${sheet}"`);
      } catch (err) {
        toast.error("Erro ao ler XLSX: " + (err as Error).message);
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const handleSheetChange = useCallback(
    (sheet: string) => {
      setSelectedSheet(sheet);
      if (workbookRef) {
        const tables = parseProposedTables(workbookRef, sheet);
        setProposed(tables);
        setTableMapping({});
      }
    },
    [workbookRef]
  );

  const dbTableNames = useMemo(() => new Set(schemaTables?.map((t) => t.table_name) ?? []), [schemaTables]);

  const diff = useMemo(() => {
    if (!schemaTables || !schemaColumns || !schemaPolicies || proposed.length === 0) return null;
    return computeDiff(proposed, schemaTables, schemaColumns, schemaPolicies, tableMapping);
  }, [proposed, schemaTables, schemaColumns, schemaPolicies, tableMapping]);

  const gaps = useMemo(() => {
    if (!schemaTables) return [];
    return computeGaps(proposed, dbTableNames, tableMapping);
  }, [proposed, dbTableNames, tableMapping, schemaTables]);

  const gapsByPriority = useMemo(() => {
    const p0 = gaps.filter((g) => g.priority === "P0");
    const p1 = gaps.filter((g) => g.priority === "P1");
    const p2 = gaps.filter((g) => g.priority === "P2");
    return { p0, p1, p2 };
  }, [gaps]);

  const isSufficient = useMemo(() => {
    return gapsByPriority.p0.every((g) => g.status === "ok");
  }, [gapsByPriority]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground">Validador de Estrutura (XLSX)</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Compare a estrutura proposta (planilha) com o schema real do Supabase.
        </p>
      </div>

      {/* Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Upload className="h-4 w-4" /> Upload da Planilha
          </CardTitle>
          <CardDescription>Envie um arquivo .xlsx com a definição das tabelas propostas.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} />
          {fileName && <p className="text-sm text-muted-foreground">Arquivo: {fileName}</p>}
          {sheetNames.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-sm">Aba:</span>
              <Select value={selectedSheet} onValueChange={handleSheetChange}>
                <SelectTrigger className="w-60">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sheetNames.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      {isLoading && (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {proposed.length > 0 && !isLoading && (
        <Tabs defaultValue="proposed">
          <TabsList>
            <TabsTrigger value="proposed">Tabelas Propostas ({proposed.length})</TabsTrigger>
            <TabsTrigger value="diff">Diff {diff ? `(${diff.newTables.length}N / ${diff.extraTables.length}E / ${diff.matchedTables.length}M)` : ""}</TabsTrigger>
            <TabsTrigger value="gaps">Suficiência</TabsTrigger>
          </TabsList>

          {/* Tab: Proposed Tables */}
          <TabsContent value="proposed" className="space-y-4">
            {proposed.map((t) => (
              <Card key={t.table_name}>
                <CardHeader className="py-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-mono">{t.table_name}</CardTitle>
                    <div className="flex items-center gap-2">
                      {dbTableNames.has(tableMapping[t.table_name] || t.table_name) ? (
                        <Badge variant="default" className="text-xs">Match</Badge>
                      ) : (
                        <Badge variant="destructive" className="text-xs">Nova</Badge>
                      )}
                      <Select
                        value={tableMapping[t.table_name] || ""}
                        onValueChange={(v) =>
                          setTableMapping((prev) => ({ ...prev, [t.table_name]: v === "__none__" ? "" : v }))
                        }
                      >
                        <SelectTrigger className="w-48 h-7 text-xs">
                          <SelectValue placeholder="Mapear para…" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">— Sem mapeamento —</SelectItem>
                          {schemaTables?.map((st) => (
                            <SelectItem key={st.table_name} value={st.table_name}>
                              {st.table_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="py-0 pb-3">
                  <div className="rounded border max-h-48 overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Coluna</TableHead>
                          <TableHead className="text-xs">Tipo</TableHead>
                          <TableHead className="text-xs">PK</TableHead>
                          <TableHead className="text-xs">FK</TableHead>
                          <TableHead className="text-xs">Notas</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {t.columns.map((c, i) => (
                          <TableRow key={i}>
                            <TableCell className="text-xs font-mono">{c.name}</TableCell>
                            <TableCell className="text-xs">{c.type || "—"}</TableCell>
                            <TableCell className="text-xs">{c.pk ? "✓" : ""}</TableCell>
                            <TableCell className="text-xs">{c.fk_table ? `${c.fk_table}.${c.fk_column}` : ""}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{c.notes}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* Tab: Diff */}
          <TabsContent value="diff" className="space-y-4">
            {diff && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="pt-4 text-center">
                      <p className="text-3xl font-bold text-blue-600">{diff.newTables.length}</p>
                      <p className="text-sm text-muted-foreground">Novas (não existem no DB)</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 text-center">
                      <p className="text-3xl font-bold text-amber-600">{diff.extraTables.length}</p>
                      <p className="text-sm text-muted-foreground">Extras (só no DB)</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 text-center">
                      <p className="text-3xl font-bold text-green-600">{diff.matchedTables.length}</p>
                      <p className="text-sm text-muted-foreground">Correspondentes</p>
                    </CardContent>
                  </Card>
                </div>

                {diff.newTables.length > 0 && (
                  <Card>
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm">Tabelas Novas (proposta → DB)</CardTitle>
                    </CardHeader>
                    <CardContent className="py-0 pb-3">
                      <div className="flex flex-wrap gap-2">
                        {diff.newTables.map((t) => (
                          <Badge key={t} variant="outline" className="font-mono text-xs">{t}</Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {diff.extraTables.length > 0 && (
                  <Card>
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm">Tabelas Extras (só no DB, não na proposta)</CardTitle>
                    </CardHeader>
                    <CardContent className="py-0 pb-3">
                      <div className="flex flex-wrap gap-2">
                        {diff.extraTables.map((t) => (
                          <Badge key={t} variant="secondary" className="font-mono text-xs">{t}</Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {diff.matchedTables.length > 0 && (
                  <Card>
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm">Detalhes das Tabelas Correspondentes</CardTitle>
                    </CardHeader>
                    <CardContent className="py-0 pb-3">
                      <div className="rounded border overflow-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-xs">Tabela</TableHead>
                              <TableHead className="text-xs">Colunas faltando no DB</TableHead>
                              <TableHead className="text-xs">Extras no DB</TableHead>
                              <TableHead className="text-xs">Tipos divergentes</TableHead>
                              <TableHead className="text-xs">event_id</TableHead>
                              <TableHead className="text-xs">Audit</TableHead>
                              <TableHead className="text-xs">RLS</TableHead>
                              <TableHead className="text-xs">Policies</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {diff.matchedTables.map((m) => (
                              <TableRow key={m.table_name}>
                                <TableCell className="text-xs font-mono">{m.table_name}</TableCell>
                                <TableCell className="text-xs">
                                  {m.missingColumnsInDb.length > 0 ? (
                                    <span className="text-destructive">{m.missingColumnsInDb.join(", ")}</span>
                                  ) : (
                                    <span className="text-green-600">—</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">
                                  {m.extraColumnsInDb.length > 0 ? m.extraColumnsInDb.join(", ") : "—"}
                                </TableCell>
                                <TableCell className="text-xs">
                                  {m.typeDivergences.length > 0 ? (
                                    <span className="text-amber-600">
                                      {m.typeDivergences.map((d) => `${d.column}: ${d.proposed}≠${d.actual}`).join("; ")}
                                    </span>
                                  ) : "—"}
                                </TableCell>
                                <TableCell className="text-xs">
                                  {m.missingEventId ? <XCircle className="h-4 w-4 text-destructive" /> : <CheckCircle2 className="h-4 w-4 text-green-600" />}
                                </TableCell>
                                <TableCell className="text-xs">
                                  {m.missingAuditFields.length > 0 ? (
                                    <span className="text-amber-600">{m.missingAuditFields.join(", ")}</span>
                                  ) : <CheckCircle2 className="h-4 w-4 text-green-600" />}
                                </TableCell>
                                <TableCell className="text-xs">
                                  {m.rlsEnabled ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <XCircle className="h-4 w-4 text-destructive" />}
                                </TableCell>
                                <TableCell className="text-xs text-center">{m.policyCount}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Button variant="outline" onClick={() => exportReport(diff, gaps)}>
                  <Download className="h-4 w-4 mr-2" /> Exportar Relatório (JSON)
                </Button>
              </>
            )}
          </TabsContent>

          {/* Tab: Gaps / Sufficiency */}
          <TabsContent value="gaps" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  {isSufficient ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                  )}
                  {isSufficient ? "Estrutura SUFICIENTE (P0 coberto)" : "Estrutura INSUFICIENTE — gaps P0 encontrados"}
                </CardTitle>
              </CardHeader>
            </Card>

            {[
              { label: "P0 — Obrigatório", items: gapsByPriority.p0, color: "text-destructive" },
              { label: "P1 — Importante", items: gapsByPriority.p1, color: "text-amber-600" },
              { label: "P2 — Futuro", items: gapsByPriority.p2, color: "text-blue-600" },
            ].map(({ label, items, color }) => (
              <Card key={label}>
                <CardHeader className="py-3">
                  <CardTitle className={`text-sm ${color}`}>{label}</CardTitle>
                </CardHeader>
                <CardContent className="py-0 pb-3">
                  <div className="space-y-1">
                    {items.map((g, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        {g.status === "ok" ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                        )}
                        <span className="font-mono">{g.table}</span>
                        <span className="text-muted-foreground">({g.domain})</span>
                        {g.status === "missing" && <span className="text-destructive font-medium">FALTANDO</span>}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}

            <Button variant="outline" onClick={() => diff && exportReport(diff, gaps)}>
              <Download className="h-4 w-4 mr-2" /> Exportar Relatório (JSON)
            </Button>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
