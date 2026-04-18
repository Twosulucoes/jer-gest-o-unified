import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  try {
    const now = new Date();
    // Bucket de 1 minuto (truncado)
    const bucketAt = new Date(Math.floor(now.getTime() / 60000) * 60000);
    const since = new Date(bucketAt.getTime() - 60000);

    // Coleta paralela
    const [errorsRes, inscriptionsRes, matchesRes, resultsRes, usersRes] = await Promise.all([
      supabase.from("monitoring_errors").select("id", { count: "exact", head: true })
        .gte("created_at", since.toISOString()).lt("created_at", bucketAt.toISOString()),
      supabase.from("participant_sport_events").select("id", { count: "exact", head: true })
        .gte("created_at", since.toISOString()).lt("created_at", bucketAt.toISOString()),
      supabase.from("competition_matches").select("id", { count: "exact", head: true })
        .gte("created_at", since.toISOString()).lt("created_at", bucketAt.toISOString()),
      supabase.from("competition_match_results").select("id", { count: "exact", head: true })
        .eq("result_status", "publicado")
        .gte("published_at", since.toISOString()).lt("published_at", bucketAt.toISOString()),
      supabase.from("audit_events").select("created_by", { count: "exact", head: true })
        .gte("created_at", new Date(now.getTime() - 5 * 60000).toISOString()),
    ]);

    const errorsCount = errorsRes.count ?? 0;
    const newInscriptions = inscriptionsRes.count ?? 0;
    const newMatches = matchesRes.count ?? 0;
    const newResults = resultsRes.count ?? 0;
    const activeUsers = usersRes.count ?? 0;
    const requestsCount = activeUsers * 2; // estimativa proxy

    // Upsert métrica do bucket
    await supabase.from("monitoring_metrics").upsert({
      bucket_at: bucketAt.toISOString(),
      bucket_size: "1min",
      requests_count: requestsCount,
      active_users: activeUsers,
      errors_count: errorsCount,
      new_inscriptions: newInscriptions,
      new_matches: newMatches,
      new_results: newResults,
    }, { onConflict: "bucket_at,bucket_size" });

    // Disparo de alertas
    const alerts: Array<{ key: string; title: string; body: string }> = [];

    if (errorsCount > 0) {
      alerts.push({
        key: `errors-${bucketAt.toISOString()}`,
        title: `⚠️ ${errorsCount} erro(s) detectado(s)`,
        body: `Novos erros no último minuto. Toque para investigar.`,
      });
    }
    if (requestsCount > 100) {
      alerts.push({
        key: `load-${bucketAt.toISOString()}`,
        title: `🔥 Carga alta: ${requestsCount} req/min`,
        body: `Sistema com pico de uso (${activeUsers} usuários ativos).`,
      });
    }
    if (newInscriptions + newMatches + newResults > 0) {
      const parts = [];
      if (newInscriptions) parts.push(`${newInscriptions} inscrições`);
      if (newMatches) parts.push(`${newMatches} confrontos`);
      if (newResults) parts.push(`${newResults} resultados`);
      alerts.push({
        key: `data-${bucketAt.toISOString()}`,
        title: `📊 Novos dados lançados`,
        body: parts.join(" • "),
      });
    }

    // Dispara push para alertas novos
    for (const alert of alerts) {
      const { data: existing } = await supabase
        .from("monitoring_alert_state")
        .select("alert_key")
        .eq("alert_key", alert.key)
        .maybeSingle();

      if (!existing) {
        await supabase.from("monitoring_alert_state").insert({
          alert_key: alert.key,
          payload: { title: alert.title, body: alert.body },
        });

        // Chama dispatcher
        await fetch(`${SUPABASE_URL}/functions/v1/monitoring-push`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${SERVICE_ROLE}`,
          },
          body: JSON.stringify({ title: alert.title, body: alert.body, url: "/super/monitor" }),
        }).catch((e) => console.error("Push dispatch failed", e));
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      bucket: bucketAt.toISOString(),
      metrics: { errorsCount, requestsCount, activeUsers, newInscriptions, newMatches, newResults },
      alerts: alerts.length,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("monitoring-collect error", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
