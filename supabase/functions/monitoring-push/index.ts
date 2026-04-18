import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import webpush from "https://esm.sh/web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@example.com";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { title, body, url, userIds } = await req.json();
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Busca assinaturas ativas dos super_admin
    let query = supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth, user_id")
      .eq("active", true);

    if (userIds && Array.isArray(userIds)) {
      query = query.in("user_id", userIds);
    } else {
      // Filtra apenas super_admins
      const { data: sa } = await supabase.from("user_roles").select("user_id").eq("role", "super_admin");
      const ids = (sa ?? []).map((r) => r.user_id);
      if (ids.length === 0) {
        return new Response(JSON.stringify({ ok: true, sent: 0, reason: "no super_admin" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      query = query.in("user_id", ids);
    }

    const { data: subs, error } = await query;
    if (error) throw error;

    let sent = 0;
    let failed = 0;

    await Promise.all((subs ?? []).map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({ title, body, url: url ?? "/super/monitor" })
        );
        sent++;
        await supabase.from("push_subscriptions").update({ last_used_at: new Date().toISOString() }).eq("id", sub.id);
      } catch (err: any) {
        failed++;
        // 410 Gone => assinatura expirada
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          await supabase.from("push_subscriptions").update({ active: false }).eq("id", sub.id);
        }
        console.error("Push fail", sub.endpoint, err?.statusCode, err?.body);
      }
    }));

    return new Response(JSON.stringify({ ok: true, sent, failed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("monitoring-push error", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
