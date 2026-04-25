import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Search, Download, Calendar as CalendarIcon, User as UserIcon, Monitor } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

export default function AcessosPwaAuditPage() {
  const [search, setSearch] = useState("");
  const [userId, setUserId] = useState("all");
  const [startDate, setStartDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));

  // Fetch users for filter
  const { data: users = [] } = useQuery({
    queryKey: ["admin-profiles-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .order("full_name");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["pwa-access-logs", startDate, endDate, userId],
    queryFn: async () => {
      let query = supabase
        .from("audit_events")
        .select(`
          id,
          record_id,
          payload,
          created_at,
          created_by,
          profiles:created_by (full_name, email)
        `)
        .eq("table_name", "pwa_access")
        .gte("created_at", startOfDay(new Date(startDate)).toISOString())
        .lte("created_at", endOfDay(new Date(endDate)).toISOString())
        .order("created_at", { ascending: false });

      if (userId !== "all") {
        query = query.eq("created_by", userId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const filteredLogs = useMemo(() => {
    if (!search) return logs;
    const q = search.toLowerCase();
    return logs.filter((log: any) => {
      const module = (log.record_id || "").toLowerCase();
      const userName = (log.profiles?.full_name || "").toLowerCase();
      const userEmail = (log.profiles?.email || "").toLowerCase();
      return module.includes(q) || userName.includes(q) || userEmail.includes(q);
    });
  }, [logs, search]);

  const handleExportCSV = () => {
    if (filteredLogs.length === 0) {
      toast.error("Nenhum dado para exportar");
      return;
    }

    const headers = ["Data/Hora", "Módulo/Tela", "Usuário", "Email", "Navegador"];
    const csvContent = [
      headers.join(","),
      ...filteredLogs.map((log: any) => [
        format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss"),
        `"${log.record_id}"`,
        `"${log.profiles?.full_name || "—"}"`,
        `"${log.profiles?.email || "—"}"`,
        `"${log.payload?.userAgent || "—"}"`,
      ].join(",")),
    ].join("\n");

    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `relatorio_acessos_pwa_${format(new Date(), "yyyyMMdd_HHmmss")}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Relatório de Auditoria PWA</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Histórico de acessos por módulo e tela no aplicativo
          </p>
        </div>
        <Button onClick={handleExportCSV} variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Exportar CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-card p-4 rounded-lg border">
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Buscar</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Módulo ou usuário..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Usuário</label>
          <Select value={userId} onValueChange={setUserId}>
            <SelectTrigger>
              <SelectValue placeholder="Todos os usuários" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os usuários</SelectItem>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.full_name || u.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Data Início</label>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Data Fim</label>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-md" />
          ))}
        </div>
      ) : !filteredLogs.length ? (
        <div className="flex flex-col items-center py-12 text-center border rounded-lg bg-card">
          <Monitor className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground">
            Nenhum registro de acesso encontrado para o período selecionado.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">Data/Hora</TableHead>
                  <TableHead>Módulo/Tela</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Detalhes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.map((log: any) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <CalendarIcon className="h-3 w-3 text-muted-foreground" />
                        {format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss")}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-mono">
                        {log.record_id}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <UserIcon className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="font-medium text-sm">{log.profiles?.full_name || "—"}</div>
                          <div className="text-xs text-muted-foreground">{log.profiles?.email}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground truncate max-w-[200px] block">
                        {log.payload?.userAgent || "—"}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
