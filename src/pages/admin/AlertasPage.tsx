import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Bell, Clock, Users, RefreshCcw, Settings, History, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";

type AlertRule = {
  id: string;
  type: string;
  enabled: boolean;
  threshold_minutes: number | null;
  threshold_count: number | null;
  notify_roles: string[];
  description: string | null;
  updated_at: string;
};

type AppNotification = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  push_sent: boolean;
  created_at: string;
};

const TYPE_META: Record<string, { label: string; icon: string; color: string }> = {
  janela_abrindo:   { label: "Janela abrindo",    icon: "⏰", color: "blue" },
  janela_encerrada: { label: "Janela encerrada",   icon: "✅", color: "green" },
  operador_inativo: { label: "Operador inativo",   icon: "⚠️", color: "yellow" },
  sync_errors:      { label: "Erros de sync",      icon: "🔴", color: "red" },
  sistema_offline:  { label: "Sistema offline",    icon: "📡", color: "orange" },
};

const BADGE_COLORS: Record<string, string> = {
  blue:   "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  green:  "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  yellow: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  red:    "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  orange: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
};

function AlertRuleCard({ rule, canEdit }: { rule: AlertRule; canEdit: boolean }) {
  const qc = useQueryClient();
  const [localMinutes, setLocalMinutes] = useState(rule.threshold_minutes?.toString() ?? "");
  const [localCount, setLocalCount] = useState(rule.threshold_count?.toString() ?? "");
  const [expanded, setExpanded] = useState(false);
  const meta = TYPE_META[rule.type] ?? { label: rule.type, icon: "🔔", color: "blue" };

  const toggleMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const { error } = await supabase
        .from("alert_rules")
        .update({ enabled, updated_at: new Date().toISOString() })
        .eq("id", rule.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alert_rules"] }),
    onError: (e: Error) => toast.error("Erro ao atualizar regra: " + e.message),
  });

  const updateThreshold = useMutation({
    mutationFn: async (updates: { threshold_minutes?: number | null; threshold_count?: number | null }) => {
      const { error } = await supabase
        .from("alert_rules")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", rule.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["alert_rules"] });
      toast.success("Threshold atualizado");
    },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  const handleSaveThreshold = () => {
    const updates: { threshold_minutes?: number | null; threshold_count?: number | null } = {};
    if (rule.threshold_minutes !== null)
      updates.threshold_minutes = localMinutes ? parseInt(localMinutes) : null;
    if (rule.threshold_count !== null)
      updates.threshold_count = localCount ? parseInt(localCount) : null;
    updateThreshold.mutate(updates);
  };

  const colorClass = BADGE_COLORS[meta.color] ?? BADGE_COLORS.blue;
  const hasThreshold = rule.threshold_minutes !== null || rule.threshold_count !== null;

  return (
    <Card className={rule.enabled ? "" : "opacity-60"}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <span className="text-2xl leading-none mt-0.5">{meta.icon}</span>
            <div className="min-w-0">
              <CardTitle className="text-base">{meta.label}</CardTitle>
              {rule.description && (
                <CardDescription className="mt-0.5 text-xs">{rule.description}</CardDescription>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className={`rounded px-2 py-0.5 text-xs font-medium ${colorClass}`}>
              {rule.type}
            </span>
            <Switch
              checked={rule.enabled}
              onCheckedChange={(v) => canEdit && toggleMutation.mutate(v)}
              disabled={!canEdit || toggleMutation.isPending}
            />
          </div>
        </div>
      </CardHeader>

      {hasThreshold && (
        <CardContent className="pt-0">
          <button
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setExpanded((v) => !v)}
          >
            <Settings className="h-3.5 w-3.5" />
            Configurar threshold
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>

          {expanded && (
            <div className="mt-3 flex flex-wrap items-end gap-3">
              {rule.threshold_minutes !== null && (
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">Minutos</Label>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      min={1}
                      className="h-8 w-20 text-sm"
                      value={localMinutes}
                      onChange={(e) => setLocalMinutes(e.target.value)}
                      disabled={!canEdit}
                    />
                    <span className="text-xs text-muted-foreground">min</span>
                  </div>
                </div>
              )}
              {rule.threshold_count !== null && (
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">Quantidade</Label>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      min={1}
                      className="h-8 w-20 text-sm"
                      value={localCount}
                      onChange={(e) => setLocalCount(e.target.value)}
                      disabled={!canEdit}
                    />
                    <span className="text-xs text-muted-foreground">itens</span>
                  </div>
                </div>
              )}
              {canEdit && (
                <Button
                  size="sm"
                  className="h-8"
                  onClick={handleSaveThreshold}
                  disabled={updateThreshold.isPending}
                >
                  Salvar
                </Button>
              )}
            </div>
          )}

          <div className="mt-2 flex flex-wrap gap-1">
            {rule.notify_roles.map((role) => (
              <Badge key={role} variant="secondary" className="text-xs py-0">
                <Users className="mr-1 h-2.5 w-2.5" />
                {role}
              </Badge>
            ))}
          </div>
        </CardContent>
      )}

      {!hasThreshold && rule.notify_roles.length > 0 && (
        <CardContent className="pt-0">
          <div className="flex flex-wrap gap-1">
            {rule.notify_roles.map((role) => (
              <Badge key={role} variant="secondary" className="text-xs py-0">
                <Users className="mr-1 h-2.5 w-2.5" />
                {role}
              </Badge>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

export default function AlertasPage() {
  const { hasRole } = useAuth();
  const canEdit = hasRole("admin") || hasRole("super_admin");

  const { data: rules = [], isLoading: rulesLoading } = useQuery<AlertRule[]>({
    queryKey: ["alert_rules"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("alert_rules")
        .select("*")
        .order("type");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: history = [], isLoading: histLoading } = useQuery<AppNotification[]>({
    queryKey: ["notifications_history"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("notifications")
        .select("id, user_id, type, title, body, read, push_sent, created_at")
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data ?? [];
    },
  });

  const qc = useQueryClient();
  const [triggering, setTriggering] = useState(false);

  const triggerAlerts = async () => {
    setTriggering(true);
    try {
      const { error } = await supabase.functions.invoke("process-alerts");
      if (error) throw error;
      toast.success("Verificação de alertas disparada com sucesso");
      qc.invalidateQueries({ queryKey: ["notifications_history"] });
    } catch (e: any) {
      toast.error("Erro ao disparar alertas: " + (e?.message ?? "desconhecido"));
    } finally {
      setTriggering(false);
    }
  };

  return (
    <div className="space-y-8 p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Bell className="h-6 w-6 text-primary" />
            Alertas Automáticos
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure quando e para quem os alertas são enviados. Alertas in-app chegam em tempo real via Realtime;
            push notifications requerem o service worker instalado.
          </p>
        </div>
        {canEdit && (
          <Button
            variant="outline"
            size="sm"
            onClick={triggerAlerts}
            disabled={triggering}
            className="shrink-0"
          >
            <RefreshCcw className={`mr-2 h-4 w-4 ${triggering ? "animate-spin" : ""}`} />
            Disparar agora
          </Button>
        )}
      </div>

      {/* Regras */}
      <section>
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          <Settings className="h-4 w-4" />
          Regras de Alerta
        </h2>
        {rulesLoading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {rules.map((rule) => (
              <AlertRuleCard key={rule.id} rule={rule} canEdit={canEdit} />
            ))}
          </div>
        )}
      </section>

      <Separator />

      {/* Histórico */}
      <section>
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          <History className="h-4 w-4" />
          Histórico Recente
        </h2>
        {histLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
        ) : history.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma notificação registrada ainda.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border">
            {history.map((n, idx) => {
              const meta = TYPE_META[n.type] ?? { icon: "🔔", color: "blue" };
              const colorClass = BADGE_COLORS[meta.color] ?? BADGE_COLORS.blue;
              return (
                <div
                  key={n.id}
                  className={`flex items-start gap-3 px-4 py-3 ${idx < history.length - 1 ? "border-b border-border/50" : ""}`}
                >
                  <span className="text-base leading-none mt-0.5">{meta.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium">{n.title}</p>
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${colorClass}`}>
                        {n.type}
                      </span>
                      {n.push_sent && (
                        <Badge variant="outline" className="h-4 text-[10px] py-0">push ✓</Badge>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground/70">
                      {format(new Date(n.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      {" · "}
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ptBR })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Nota sobre alertas client-side */}
      <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-amber-800 dark:text-amber-300">
            Alertas gerados pelo cliente (Tipo 4 e 5)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-amber-700 dark:text-amber-400">
            <strong>Erros de sync</strong> e <strong>Sistema offline</strong> são disparados diretamente pelo
            dispositivo do operador (não pelo servidor). Use{" "}
            <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/40">useOfflineAlert()</code> nos
            componentes de operação para acionar esses tipos de alerta.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
