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

  console.log(`[${requestId}] Request start: event_id=${eventId}, stage_id=${eventStageId}, sport_id=${sportId}`);

  // Optional site token validation
  const siteTokenSecret = Deno.env.get("SITE_TOKEN");
  if (siteTokenSecret) {
    const provided = req.headers.get("x-site-token");
    if (provided !== siteTokenSecret) {
      console.warn(`[${requestId}] Invalid site token provided`);
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  if (!eventId) {
    return new Response(
      JSON.stringify({ error: "event_id is required" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(eventId)) {
    return new Response(
      JSON.stringify({ error: "Invalid event_id format" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  // Validate bulletin_number if provided
  if (bulletinNumberStr) {
    const n = Number(bulletinNumberStr);
    if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) {
      return new Response(
        JSON.stringify({ error: "bulletin_number inválido" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
  }

  if (eventStageId && !uuidRegex.test(eventStageId)) {
    return new Response(
      JSON.stringify({ error: "Invalid event_stage_id format" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Measure stage validation duration
  const tStagesStart = performance.now();
  const { data: stagesList, error: stagesErr } = await supabase
    .from("event_stages")
    .select("id")
    .eq("event_id", eventId)
    .neq("status", "archived");
  const tStagesEnd = performance.now();

  if (stagesErr) {
    console.error(`[${requestId}] Error fetching stages: ${stagesErr.message}`);
    return new Response(
      JSON.stringify({ error: stagesErr.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const stageCount = (stagesList ?? []).length;
  console.log(`[${requestId}] Stages check: count=${stageCount}, duration=${(tStagesEnd - tStagesStart).toFixed(2)}ms`);

  if (stageCount > 1 && !eventStageId) {
    return new Response(
      JSON.stringify({
        error: "event_stage_id é obrigatório quando o evento possui mais de uma etapa.",
        available_stage_count: stageCount,
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Prepare main query
  let query = supabase
    .from("public_results_view")
    .select("*")
    .eq("event_id", eventId)
    .order("sport_name", { ascending: true })
    .order("sport_event_name", { ascending: true })
    .order("position", { ascending: true, nullsFirst: false })
    .order("display_name", { ascending: true });

  if (sportId && uuidRegex.test(sportId)) {
    query = query.eq("sport_id", sportId);
  }
  if (sportEventId && uuidRegex.test(sportEventId)) {
    query = query.eq("sport_event_id", sportEventId);
  }
  if (eventStageId && uuidRegex.test(eventStageId)) {
    query = query.eq("event_stage_id", eventStageId);
  }
  if (bulletinNumberStr) {
    query = query.eq("bulletin_number", Number(bulletinNumberStr));
  }

  // Measure main query duration
  const tQueryStart = performance.now();
  const { data, error } = await query;
  const tQueryEnd = performance.now();

  if (error) {
    console.error(`[${requestId}] Error fetching results: ${error.message}`);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const items = data || [];
  const queryDuration = tQueryEnd - tQueryStart;
  console.log(`[${requestId}] Results query: count=${items.length}, duration=${queryDuration.toFixed(2)}ms`);

  // Consistency checks
  if (stageCount > 0 && items.length === 0) {
    console.warn(`[${requestId}] Consistency warning: Found ${stageCount} stages but 0 results for event ${eventId}`);
  }

  // Check for suspicious entries (e.g. missing crucial fields)
  const suspiciousCount = items.filter(i => !i.sport_name || !i.display_name).length;
  if (suspiciousCount > 0) {
    console.error(`[${requestId}] Consistency error: ${suspiciousCount} items missing sport_name or display_name`);
  }

  // Check if all items belong to the requested event (sanity check)
  const inconsistentEvents = items.filter(i => i.event_id !== eventId);
  if (inconsistentEvents.length > 0) {
    console.error(`[${requestId}] Consistency error: ${inconsistentEvents.length} items belong to different events! Expected ${eventId}`);
  }

  const cacheMaxAge = bulletinNumberStr ? 300 : 60;
  const totalDuration = performance.now() - t0;
  
  console.log(`[${requestId}] Request completed in ${totalDuration.toFixed(2)}ms. IP: ${req.headers.get("x-real-ip") || "unknown"}`);

  return new Response(
    JSON.stringify({
      event_id: eventId,
      event_stage_id: eventStageId ?? null,
      generated_at: new Date().toISOString(),
      items,
      metrics: {
        stages_check_ms: (tStagesEnd - tStagesStart),
        query_duration_ms: queryDuration,
        total_duration_ms: totalDuration,
        result_count: items.length,
        consistent: inconsistentEvents.length === 0 && suspiciousCount === 0
      }
    }),
    {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Cache-Control": `public, max-age=${cacheMaxAge}`,
      },
    }
  );
});
