import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-site-token",
};

Deno.serve(async (req) => {
  const t0 = performance.now();
  const requestId = crypto.randomUUID();
  
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const eventId = url.searchParams.get("event_id");
  const sportId = url.searchParams.get("sport_id");
  const sportEventId = url.searchParams.get("sport_event_id");
  const eventStageId = url.searchParams.get("event_stage_id");
  const bulletinNumberStr = url.searchParams.get("bulletin_number");

  // Optional site token validation
  const siteTokenSecret = Deno.env.get("SITE_TOKEN");
  if (siteTokenSecret) {
    const provided = req.headers.get("x-site-token");
    if (provided !== siteTokenSecret) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  if (!eventId) {
    return new Response(JSON.stringify({ error: "event_id is required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  let query = supabase
    .from("public_results_view")
    .select("*")
    .eq("event_id", eventId)
    .eq("result_status", "publicado")
    .order("sport_name", { ascending: true })
    .order("sport_event_name", { ascending: true })
    .order("position", { ascending: true, nullsFirst: false })
    .order("display_name", { ascending: true });

  if (sportId) query = query.eq("sport_id", sportId);
  if (sportEventId) query = query.eq("sport_event_id", sportEventId);
  if (eventStageId) query = query.eq("event_stage_id", eventStageId);
  
  // bulletin_number agora pode ser string (alfanumérico)
  if (bulletinNumberStr) {
    query = query.eq("bulletin_number", bulletinNumberStr);
  }

  const { data, error } = await query;

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const items = data || [];
  const totalDuration = performance.now() - t0;

  return new Response(
    JSON.stringify({
      items,
      meta: {
        total: items.length,
        event_id: eventId,
        generated_at: new Date().toISOString(),
        duration_ms: totalDuration
      }
    }),
    {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=60",
      },
    }
  );
});
