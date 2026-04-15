import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Bug, User, Calendar, Database, Shield, Loader2 } from "lucide-react";

interface QueryResult {
  table: string;
  count: number | null;
  error: string | null;
  loading: boolean;
}

interface RoleCheck {
  role: string;
  result: boolean | null;
  error: string | null;
}

export default function PwaDebugPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [legacyRole, setLegacyRole] = useState<string | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [migrating, setMigrating] = useState(false);

  const [eventId, setEventId] = useState<string | null>(null);
  const [eventName, setEventName] = useState<string | null>(null);

  const [queries, setQueries] = useState<Record<string, QueryResult>>({});
  const [roleChecks, setRoleChecks] = useState<RoleCheck[]>([]);
  const [checkingRoles, setCheckingRoles] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoadingUser(false); return; }
      const u = session.user;
      setUserId(u.id);
      setEmail(u.email ?? null);

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", u.id);
      const r = roles?.map((x: any) => x.role) ?? [];
      setUserRoles(r);
      console.log("[DEBUG] user_roles:", r);

      const { data: prof } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", u.id)
        .maybeSingle();
      const lr = (prof as any)?.role ?? null;
      setLegacyRole(lr);
      console.log("[DEBUG] profiles.role (legacy):", lr);

      // Event
      const stored = localStorage.getItem("jer_active_event");
      let eid: string | null = null;
      if (stored) {
        try { eid = JSON.parse(stored); } catch { eid = stored; }
      }
      setEventId(eid);
      if (eid) {
        const { data: ev } = await supabase.from("events").select("name").eq("id", eid).maybeSingle();
        setEventName(ev?.name ?? null);
      }
      console.log("[DEBUG] active event:", eid);

      setLoadingUser(false);
    })();
  }, []);

  const handleMigrate = async () => {
    if (!userId || !legacyRole) return;
    setMigrating(true);
    try {
      const { error } = await supabase
        .from("user_roles")
        .insert({ user_id: userId, role: legacyRole as any });
      if (error) throw error;
      setUserRoles((prev) => [...prev, legacyRole]);
      toast.success(`Role "${legacyRole}" migrada para user_roles`);
      console.log("[DEBUG] migrated role:", legacyRole);
    } catch (e: any) {
      toast.error(e.message);
      console.error("[DEBUG] migration error:", e);
    } finally {
      setMigrating(false);
    }
  };

  const testQuery = async (table: string) => {
    setQueries((prev) => ({ ...prev, [table]: { table, count: null, error: null, loading: true } }));
    const { data, error } = await supabase.from(table as any).select("id").limit(3);
    const result: QueryResult = {
      table,
      count: data?.length ?? null,
      error: error?.message ?? null,
      loading: false,
    };
    console.log(`[DEBUG] query ${table}:`, { count: result.count, error: result.error, data });
    setQueries((prev) => ({ ...prev, [table]: result }));
  };

  const testRoles = async () => {
    setCheckingRoles(true);
    const roles = ["transporte", "alimentacao", "alojamento"];
    const results: RoleCheck[] = [];
    for (const role of roles) {
      try {
        const { data, error } = await supabase.rpc("has_role" as any, {
          _user_id: userId,
          _role: role,
        });
        const r = { role, result: error ? null : !!data, error: error?.message ?? null };
        results.push(r);
        console.log(`[DEBUG] has_role(${role}):`, r);
      } catch (e: any) {
        results.push({ role, result: null, error: e.message });
      }
    }
    setRoleChecks(results);
    setCheckingRoles(false);
  };

  const queryTables = [
    { key: "transport_trips", label: "Transporte (trips)" },
    { key: "meal_windows", label: "Alimentação (windows)" },
    { key: "lodging_occupancies", label: "Alojamento (occupancies)" },
  ];

  return (
    <div className="min-h-screen bg-background p-4 max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-2 text-lg font-bold">
        <Bug className="h-5 w-5" /> Diagnóstico PWA
      </div>

      {/* SEÇÃO 1 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><User className="h-4 w-4" /> Meu Usuário</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {loadingUser ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : !userId ? (
            <p className="text-destructive font-medium">Não autenticado</p>
          ) : (
            <>
              <p><span className="text-muted-foreground">Email:</span> {email}</p>
              <p><span className="text-muted-foreground">User ID:</span> <code className="text-xs bg-muted px-1 rounded">{userId}</code></p>
              <div>
                <span className="text-muted-foreground">Roles (user_roles):</span>{" "}
                {userRoles.length === 0 ? (
                  <Badge variant="destructive">Nenhuma</Badge>
                ) : (
                  userRoles.map((r) => <Badge key={r} className="mr-1">{r}</Badge>)
                )}
              </div>
              <div>
                <span className="text-muted-foreground">profiles.role (legado):</span>{" "}
                {legacyRole ? <Badge variant="secondary">{legacyRole}</Badge> : <span>—</span>}
              </div>
              {userRoles.length === 0 && legacyRole && (
                <Button size="sm" onClick={handleMigrate} disabled={migrating}>
                  {migrating ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                  Migrar Role "{legacyRole}" → user_roles
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* SEÇÃO 2 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Calendar className="h-4 w-4" /> Evento Ativo</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-1">
          <p><span className="text-muted-foreground">Event ID:</span> <code className="text-xs bg-muted px-1 rounded">{eventId ?? "NÃO DEFINIDO"}</code></p>
          <p><span className="text-muted-foreground">Nome:</span> {eventName ?? "—"}</p>
          {!eventId && <p className="text-destructive text-xs">⚠️ Nenhum evento ativo no localStorage (jer_active_event)</p>}
        </CardContent>
      </Card>

      {/* SEÇÃO 3 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Database className="h-4 w-4" /> Testar Queries</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {queryTables.map(({ key, label }) => (
            <div key={key} className="flex items-center gap-2 flex-wrap">
              <Button size="sm" variant="outline" onClick={() => testQuery(key)} disabled={queries[key]?.loading}>
                {queries[key]?.loading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                {label}
              </Button>
              {queries[key] && !queries[key].loading && (
                queries[key].error ? (
                  <Badge variant="destructive" className="text-xs">❌ {queries[key].error}</Badge>
                ) : (
                  <Badge variant={queries[key].count! > 0 ? "default" : "secondary"} className="text-xs">
                    {queries[key].count} registro(s)
                  </Badge>
                )
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* SEÇÃO 4 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Shield className="h-4 w-4" /> Testar has_role()</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button size="sm" variant="outline" onClick={testRoles} disabled={checkingRoles || !userId}>
            {checkingRoles ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
            Testar Perfis
          </Button>
          {roleChecks.length > 0 && (
            <div className="space-y-1 text-sm">
              {roleChecks.map((rc) => (
                <div key={rc.role} className="flex items-center gap-2">
                  <span className="w-28">{rc.role}:</span>
                  {rc.error ? (
                    <Badge variant="destructive" className="text-xs">❌ {rc.error}</Badge>
                  ) : (
                    <Badge variant={rc.result ? "default" : "secondary"} className="text-xs">
                      {rc.result ? "✅ true" : "❌ false"}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
