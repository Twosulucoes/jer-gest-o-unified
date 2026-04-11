import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-site-token",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

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

  const url = new URL(req.url);
  const eventId = url.searchParams.get("event_id");

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

  const sportId = url.searchParams.get("sport_id");
  const sportEventId = url.searchParams.get("sport_event_id");
  const bulletinNumberStr = url.searchParams.get("bulletin_number");

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

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

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

  const { data, error } = await query;

  if (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  return new Response(
    JSON.stringify({
      event_id: eventId,
      generated_at: new Date().toISOString(),
      items: data || [],
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
