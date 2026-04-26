
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ROUTE_DATA_MAPPING } from "@/config/routeDataMapping";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2, XCircle, AlertTriangle, Loader2 } from "lucide-react";

interface SchemaColumn {
  table_name: string;
  column_name: string;
}

export function RouteValidator() {
  const { data: schemaColumns, isLoading } = useQuery({
    queryKey: ["schema_columns_validator"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rpc_get_schema_columns");
      if (error) throw error;
      return (data as unknown as SchemaColumn[]) ?? [];
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const dbColumnsMap = new Map<string, Set<string>>();
  schemaColumns?.forEach((col) => {
    if (!dbColumnsMap.has(col.table_name)) {
      dbColumnsMap.set(col.table_name, new Set());
    }
    dbColumnsMap.get(col.table_name)?.add(col.column_name);
  });

  const validationResults = ROUTE_DATA_MAPPING.map((route) => {
    const tableResults = route.tables.map((table) => {
      const dbCols = dbColumnsMap.get(table.name);
      if (!dbCols) {
        return { name: table.name, status: "missing_table", missingColumns: table.columns };
      }
      const missingColumns = table.columns.filter((col) => !dbCols.has(col));
      return {
        name: table.name,
        status: missingColumns.length === 0 ? "ok" : "missing_columns",
        missingColumns,
      };
    });

    const isOk = tableResults.every((t) => t.status === "ok");
    const hasMissingTable = tableResults.some((t) => t.status === "missing_table");

    return {
      ...route,
      isOk,
      hasMissingTable,
      tableResults,
    };
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Validação de Rotas vs Database</CardTitle>
          <CardDescription>
            Verifica se as tabelas e colunas necessárias para cada tela existem no banco de dados.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rota / Tela</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Tabelas Necessárias</TableHead>
                <TableHead>Detalhes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {validationResults.map((result) => (
                <TableRow key={result.route}>
                  <TableCell className="font-medium">
                    <div>{result.label}</div>
                    <div className="text-[10px] text-muted-foreground font-mono">{result.route}</div>
                  </TableCell>
                  <TableCell>
                    {result.isOk ? (
                      <Badge variant="success" className="gap-1">
                        <CheckCircle2 className="h-3 w-3" /> OK
                      </Badge>
                    ) : result.hasMissingTable ? (
                      <Badge variant="destructive" className="gap-1">
                        <XCircle className="h-3 w-3" /> Erro
                      </Badge>
                    ) : (
                      <Badge variant="warning" className="gap-1">
                        <AlertTriangle className="h-3 w-3" /> Alerta
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {result.tables.map((t) => (
                        <Badge key={t.name} variant="outline" className="text-[10px]">
                          {t.name}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-xs space-y-1">
                      {result.tableResults.map((t) => (
                        <div key={t.name} className="flex items-center gap-2">
                          {t.status === "ok" ? (
                            <CheckCircle2 className="h-3 w-3 text-success" />
                          ) : (
                            <XCircle className="h-3 w-3 text-destructive" />
                          )}
                          <span className={t.status === "ok" ? "" : "font-bold text-destructive"}>
                            {t.name}
                            {t.missingColumns.length > 0 && (
                              <span className="ml-1 text-[10px] text-muted-foreground">
                                (faltando: {t.missingColumns.join(", ")})
                              </span>
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
