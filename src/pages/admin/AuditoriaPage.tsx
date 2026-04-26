import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfDay, endOfDay } from "date-fns";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Search, Download, Calendar as CalendarIcon, User as UserIcon, Shield, Activity, Target } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

const ACTIONS_LABELS: Record<string, string> = {
  user_created: "Criação de Usuário",
  roles_changed: "Alteração de Perfis",
  user_activated: "Ativação de Usuário",
  user_deactivated: "Desativação de Usuário",
  invite_resent: "Reenvio de Convite",
  password_reset: "Reset de Senha",
  sessions_revoked: "Revogação de Sessões",
  // Generic actions
  insert: "Inserção",
  update: "Atualização",
  delete: "Exclusão",
};

const TABLE_OPTIONS = [
  { value: "users", label: "Usuários / Perfis" },
  { value: "public_content", label: "Links / Páginas Públicas" },
  { value: "pwa_access", label: "Acessos PWA" },
];

export default function AuditoriaPage() {
  const [search, setSearch] = useState("");
  const [userId, setUserId] = useState("all");
  const [tableName, setTableName] = useState("users");
  const [actionFilter, setActionFilter] = useState("all");
  const [startDate, setStartDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));

  // Fetch users for filter
  const { data: users = [] } = useQuery({
    queryKey: ["admin-profiles-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .order("full_name");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["audit-events-logs", startDate, endDate, userId, actionFilter, tableName],
    queryFn: async () => {
      let query = supabase
        .from("audit_events")
        .select(`
          id,
          action,
          record_id,
          payload,
          created_at,
          created_by,
          profiles:created_by (full_name)
        `)
        .eq("table_name", tableName)
        .gte("created_at", startOfDay(new Date(startDate)).toISOString())
        .lte("created_at", endOfDay(new Date(endDate)).toISOString())
        .order("created_at", { ascending: false });

      if (userId !== "all") {
        query = query.eq("created_by", userId);
      }

      if (actionFilter !== "all") {
        query = query.eq("action", actionFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  // To show target name, we'd need to fetch profiles for record_ids as well
  const targetIds = useMemo(() => {
    return Array.from(new Set(logs.map(log => log.record_id)));
  }, [logs]);

  const { data: targetProfiles = {} } = useQuery({
    queryKey: ["audit-target-profiles", targetIds],
    queryFn: async () => {
      if (targetIds.length === 0) return {};
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", targetIds);
      if (error) throw error;
      return (data || []).reduce((acc: any, p: any) => {
        acc[p.id] = p.full_name;
        return acc;
      }, {});
    },
    enabled: targetIds.length > 0,
  });

  const filteredLogs = useMemo(() => {
    if (!search) return logs;
    const q = search.toLowerCase();
    return logs.filter((log: any) => {
      const userName = (log.profiles?.full_name || "").toLowerCase();
      const targetName = (targetProfiles[log.record_id] || "").toLowerCase();
      const actionName = (ACTIONS_LABELS[log.action] || log.action).toLowerCase();
      return userName.includes(q) || targetName.includes(q) || actionName.includes(q);
    });
  }, [logs, search, targetProfiles]);

  const handleExportCSV = () => {
    if (filteredLogs.length === 0) {
      toast.error("Nenhum dado para exportar");
      return;
    }

    const headers = ["Data/Hora", "Ação", "Usuário (Quem fez)", "Alvo (Quem recebeu)", "Detalhes"];
    const csvContent = [
      headers.join(","),
      ...filteredLogs.map((log: any) => [
        format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss"),
        `"${ACTIONS_LABELS[log.action] || log.action}"`,
        `"${log.profiles?.full_name || "—"}"`,
        `"${targetProfiles[log.record_id] || log.record_id || "—"}"`,
        `"${JSON.stringify(log.payload || {}).replace(/"/g, '""')}"`,
      ].join(",")),
    ].join("\n");

    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `auditoria_sistema_${format(new Date(), "yyyyMMdd_HHmmss")}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Auditoria do Sistema</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Registro de ações administrativas (perfis, ativações e revogações)
          </p>
        </div>
        <Button onClick={handleExportCSV} variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Exportar CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 bg-card p-4 rounded-lg border">
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Buscar</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Ação, usuário ou alvo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Usuário (Quem fez)</label>
          <Select value={userId} onValueChange={setUserId}>
            <SelectTrigger>
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os usuários</SelectItem>
              {users.map((u: any) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.full_name || "Sem nome"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Ação</label>
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as ações</SelectItem>
              {Object.entries(ACTIONS_LABELS).map(([val, label]) => (
                <SelectItem key={val} value={val}>{label}</SelectItem>
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
          <Shield className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground">
            Nenhum registro de auditoria encontrado para o período e filtros selecionados.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">Data/Hora</TableHead>
                  <TableHead>Ação</TableHead>
                  <TableHead>Quem fez</TableHead>
                  <TableHead>Alvo</TableHead>
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
                      <div className="flex items-center gap-2">
                        <Activity className="h-4 w-4 text-primary/60" />
                        <span className="font-medium text-sm">
                          {ACTIONS_LABELS[log.action] || log.action}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <UserIcon className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{log.profiles?.full_name || "Sistema"}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Target className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-mono text-xs">
                          {targetProfiles[log.record_id] || log.record_id || "—"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {log.payload ? (
                        <div className="text-[10px] text-muted-foreground max-w-[300px] break-words">
                          {Object.entries(log.payload).map(([k, v]) => (
                            <div key={k}>
                              <span className="font-semibold">{k}:</span> {JSON.stringify(v)}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
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
