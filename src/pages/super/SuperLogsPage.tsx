import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ScrollText, Download, ChevronLeft, ChevronRight } from "lucide-react";

const PAGE_SIZE = 50;

export default function SuperLogsPage() {
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [page, setPage] = useState(0);

  const { data, isLoading } = useQuery({
    queryKey: ["super-logs", page, actionFilter],
    queryFn: async () => {
      let query = supabase
        .from("audit_events")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (actionFilter !== "all") {
        query = query.eq("action", actionFilter);
      }

      const { data, error, count } = await query;
      if (error) throw error;
      return { logs: data, total: count ?? 0 };
    },
  });

  const { data: actions } = useQuery({
    queryKey: ["super-log-actions"],
    queryFn: async () => {
      const { data } = await supabase
        .from("audit_events")
        .select("action")
        .limit(1000);
      const unique = [...new Set((data ?? []).map((d) => d.action))].sort();
      return unique;
    },
  });

  const logs = data?.logs ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const filtered = search
    ? logs.filter((l) =>
        l.action.toLowerCase().includes(search.toLowerCase()) ||
        l.table_name.toLowerCase().includes(search.toLowerCase()) ||
        l.record_id.toLowerCase().includes(search.toLowerCase())
      )
    : logs;

  const exportCsv = () => {
    const header = "Data,Ação,Tabela,Record ID,Usuário\n";
    const rows = filtered.map((l) =>
      `"${new Date(l.created_at).toLocaleString("pt-BR")}","${l.action}","${l.table_name}","${l.record_id}","${l.created_by ?? ""}"`
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "audit-logs.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Logs do Sistema</h1>
          <p className="text-sm text-zinc-400 mt-1">Auditoria global de ações — {total} registros.</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={exportCsv}
          className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
        >
          <Download className="mr-2 h-4 w-4" />
          CSV
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Input
          placeholder="Buscar ação, tabela, record..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-zinc-900 border-zinc-800 text-zinc-100 placeholder:text-zinc-500"
        />
        <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setPage(0); }}>
          <SelectTrigger className="w-48 bg-zinc-900 border-zinc-800 text-zinc-100">
            <SelectValue placeholder="Filtrar ação" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as ações</SelectItem>
            {(actions ?? []).map((a) => (
              <SelectItem key={a} value={a}>{a}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border border-zinc-800 bg-zinc-900">
        <Table>
          <TableHeader>
            <TableRow className="border-zinc-800 hover:bg-zinc-800/50">
              <TableHead className="text-zinc-400">Data</TableHead>
              <TableHead className="text-zinc-400">Ação</TableHead>
              <TableHead className="text-zinc-400">Tabela</TableHead>
              <TableHead className="text-zinc-400">Record ID</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 10 }).map((_, i) => (
                <TableRow key={i} className="border-zinc-800">
                  <TableCell><Skeleton className="h-4 w-28 bg-zinc-800" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24 bg-zinc-800" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20 bg-zinc-800" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32 bg-zinc-800" /></TableCell>
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow className="border-zinc-800">
                <TableCell colSpan={4} className="text-center py-12 text-zinc-500">
                  <ScrollText className="mx-auto h-10 w-10 mb-2 text-zinc-600" />
                  <p>Nenhum log encontrado.</p>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((log) => (
                <TableRow key={log.id} className="border-zinc-800 hover:bg-zinc-800/50 text-zinc-300 text-sm">
                  <TableCell className="text-zinc-400 text-xs whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString("pt-BR")}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{log.action}</TableCell>
                  <TableCell className="font-mono text-xs">{log.table_name}</TableCell>
                  <TableCell className="font-mono text-xs truncate max-w-[200px]">{log.record_id}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-zinc-400">
          <span>Página {page + 1} de {totalPages}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)} className="border-zinc-700 text-zinc-300">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)} className="border-zinc-700 text-zinc-300">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
