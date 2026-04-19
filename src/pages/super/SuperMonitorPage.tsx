import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Bell, BellOff, Activity, Users, TrendingUp, RefreshCw, CheckCircle2 } from "lucide-react";
import { isPushSupported, getPushPermission, subscribeToPush, unsubscribeFromPush } from "@/lib/monitoring/pushClient";
import { toast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface MetricRow {
  bucket_at: string;
  requests_count: number;
  active_users: number;
  errors_count: number;
  new_inscriptions: number;
  new_matches: number;
  new_results: number;
}

interface ErrorRow {
  id: string;
  source: string;
  severity: string;
  message: string;
  url: string | null;
  user_email: string | null;
  acknowledged: boolean;
  created_at: string;
}

export default function SuperMonitorPage() {
  const [metrics, setMetrics] = useState<MetricRow[]>([]);
  const [errors, setErrors] = useState<ErrorRow[]>([]);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    setRefreshing(true);
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const [m, e] = await Promise.all([
      supabase.from("monitoring_metrics").select("*").gte("bucket_at", since).order("bucket_at", { ascending: false }).limit(60),
      supabase.from("monitoring_errors").select("*").order("created_at", { ascending: false }).limit(50),
    ]);

    if (m.data) setMetrics(m.data as MetricRow[]);
    if (e.data) setErrors(e.data as ErrorRow[]);
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);

    if (isPushSupported()) {
      getPushPermission().then((p) => setPushEnabled(p === "granted"));
    }

    // Realtime
    const ch = supabase
      .channel("monitor-feed")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "monitoring_errors" }, () => load())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "monitoring_metrics" }, () => load())
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(ch);
    };
  }, []);

  const handleEnablePush = async () => {
    try {
      await subscribeToPush();
      setPushEnabled(true);
      toast({ title: "Notificações ativadas", description: "Você receberá alertas no celular." });
    } catch (e: any) {
      toast({ title: "Falha ao ativar", description: e.message, variant: "destructive" });
    }
  };

  const handleDisablePush = async () => {
    await unsubscribeFromPush();
    setPushEnabled(false);
    toast({ title: "Notificações desativadas" });
  };

  const handleTestPush = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("monitoring-push", {
        body: {
          title: "🧪 Teste de notificação",
          body: "Se você recebeu isto, o push está funcionando!",
          url: "/super/monitor",
        },
      });
      if (error) throw error;
      toast({
        title: "Push enviado",
        description: `Enviadas: ${data?.sent ?? 0} • Falhas: ${data?.failed ?? 0}`,
      });
    } catch (e: any) {
      toast({ title: "Falha no teste", description: e.message, variant: "destructive" });
    }
  };

  const ackError = async (id: string) => {
    await supabase.from("monitoring_errors").update({ acknowledged: true, acknowledged_at: new Date().toISOString() }).eq("id", id);
    load();
  };

  // KPIs do último bucket
  const latest = metrics[0];
  const totals = metrics.reduce(
    (acc, m) => ({
      errors: acc.errors + m.errors_count,
      requests: acc.requests + m.requests_count,
      data: acc.data + m.new_inscriptions + m.new_matches + m.new_results,
    }),
    { errors: 0, requests: 0, data: 0 }
  );

  const unacked = errors.filter((e) => !e.acknowledged).length;

  return (
    <div className="space-y-4 max-w-3xl mx-auto pb-20">
      <div className="flex items-center justify-between sticky top-0 bg-zinc-950 py-2 z-10 -mx-4 px-4 lg:mx-0 lg:px-0 border-b border-zinc-800">
        <div>
          <h1 className="text-xl font-bold text-zinc-100">Monitor</h1>
          <p className="text-xs text-zinc-500">Atualizado {refreshing ? "agora..." : "há instantes"}</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={load} disabled={refreshing} className="text-zinc-400">
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
          {pushEnabled ? (
            <>
              <Button size="sm" variant="ghost" onClick={handleTestPush} className="text-zinc-400">
                Testar
              </Button>
              <Button size="sm" variant="ghost" onClick={handleDisablePush} className="text-amber-400">
                <Bell className="h-4 w-4 mr-1" /> Ativo
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={handleEnablePush} className="bg-amber-500 text-zinc-900 hover:bg-amber-400">
              <BellOff className="h-4 w-4 mr-1" /> Ativar Push
            </Button>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-3 bg-zinc-900 border-zinc-800">
          <div className="flex items-center gap-2 text-zinc-400 text-xs mb-1">
            <Users className="h-3.5 w-3.5" /> Usuários ativos
          </div>
          <div className="text-2xl font-bold text-zinc-100">{latest?.active_users ?? 0}</div>
        </Card>
        <Card className="p-3 bg-zinc-900 border-zinc-800">
          <div className="flex items-center gap-2 text-zinc-400 text-xs mb-1">
            <Activity className="h-3.5 w-3.5" /> Carga (req/min)
          </div>
          <div className={`text-2xl font-bold ${(latest?.requests_count ?? 0) > 100 ? "text-amber-400" : "text-zinc-100"}`}>
            {latest?.requests_count ?? 0}
          </div>
        </Card>
        <Card className="p-3 bg-zinc-900 border-zinc-800">
          <div className="flex items-center gap-2 text-zinc-400 text-xs mb-1">
            <AlertCircle className="h-3.5 w-3.5" /> Erros (1h)
          </div>
          <div className={`text-2xl font-bold ${totals.errors > 0 ? "text-red-400" : "text-zinc-100"}`}>{totals.errors}</div>
          {unacked > 0 && <div className="text-[10px] text-red-400 mt-0.5">{unacked} não vistos</div>}
        </Card>
        <Card className="p-3 bg-zinc-900 border-zinc-800">
          <div className="flex items-center gap-2 text-zinc-400 text-xs mb-1">
            <TrendingUp className="h-3.5 w-3.5" /> Novos dados (1h)
          </div>
          <div className="text-2xl font-bold text-zinc-100">{totals.data}</div>
        </Card>
      </div>

      {/* Sparkline simples */}
      {metrics.length > 0 && (
        <Card className="p-3 bg-zinc-900 border-zinc-800">
          <div className="text-xs text-zinc-400 mb-2">Atividade (últimos 60 min)</div>
          <div className="flex items-end gap-0.5 h-16">
            {[...metrics].reverse().map((m, i) => {
              const max = Math.max(...metrics.map((x) => x.requests_count), 1);
              const h = Math.max(2, (m.requests_count / max) * 100);
              return (
                <div
                  key={i}
                  className={`flex-1 rounded-sm ${m.errors_count > 0 ? "bg-red-500/60" : "bg-amber-500/40"}`}
                  style={{ height: `${h}%` }}
                  title={`${new Date(m.bucket_at).toLocaleTimeString()}: ${m.requests_count} req, ${m.errors_count} erros`}
                />
              );
            })}
          </div>
        </Card>
      )}

      {/* Erros recentes */}
      <div>
        <h2 className="text-sm font-semibold text-zinc-300 mb-2 flex items-center gap-2">
          <AlertCircle className="h-4 w-4" /> Erros recentes
        </h2>
        {loading && <p className="text-xs text-zinc-500">Carregando...</p>}
        {!loading && errors.length === 0 && (
          <Card className="p-4 bg-zinc-900 border-zinc-800 text-center text-zinc-500 text-sm">
            <CheckCircle2 className="h-6 w-6 mx-auto mb-2 text-emerald-400" />
            Nenhum erro registrado
          </Card>
        )}
        <div className="space-y-2">
          {errors.map((e) => (
            <Card key={e.id} className={`p-3 bg-zinc-900 border-zinc-800 ${!e.acknowledged ? "border-l-4 border-l-red-500" : "opacity-60"}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-[10px] border-zinc-700 text-zinc-400">{e.source}</Badge>
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${
                        e.severity === "critical" ? "border-red-500 text-red-400" :
                        e.severity === "error" ? "border-orange-500 text-orange-400" :
                        e.severity === "warning" ? "border-amber-500 text-amber-400" :
                        "border-zinc-700 text-zinc-500"
                      }`}
                    >
                      {e.severity}
                    </Badge>
                    <span className="text-[10px] text-zinc-500">
                      {formatDistanceToNow(new Date(e.created_at), { addSuffix: true, locale: ptBR })}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-200 break-words">{e.message}</p>
                  {e.user_email && <p className="text-[10px] text-zinc-500 mt-1">{e.user_email}</p>}
                  {e.url && <p className="text-[10px] text-zinc-600 truncate">{e.url}</p>}
                </div>
                {!e.acknowledged && (
                  <Button size="sm" variant="ghost" onClick={() => ackError(e.id)} className="text-zinc-400 shrink-0">
                    <CheckCircle2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
