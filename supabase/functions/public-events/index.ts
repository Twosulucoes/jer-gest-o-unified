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

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data, error } = await supabase
    .from("public_results_view")
    .select("event_id, event_name, event_year")
    .order("event_year", { ascending: false });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const seen = new Set<string>();
  const events = (data || []).filter((row) => {
    if (seen.has(row.event_id)) return false;
    seen.add(row.event_id);
    return true;
  });

  return new Response(
    JSON.stringify({
      items: events,
      meta: {
        total: events.length,
        generated_at: new Date().toISOString()
      }
    }),
    {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=300",
      },
    }
  );
});
