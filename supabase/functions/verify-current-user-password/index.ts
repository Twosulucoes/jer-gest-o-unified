import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Get current user from token
    const { data: { user }, error: userError } = await authClient.auth.getUser();
    
    if (userError || !user || !user.email) {
      console.error("User error:", userError);
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const body = await req.json();
    const { password } = body;

    if (!password) {
      return jsonResponse({ error: "Password is required" }, 400);
    }

    // 2. Verify password by attempting a sign in
    // Note: We use a fresh client for this to avoid polluting the current session
    const verifyClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false
        }
    });

    const { error: signInError } = await verifyClient.auth.signInWithPassword({
      email: user.email,
      password: password,
    });

    if (signInError) {
      // Log failed attempt for audit
      await serviceClient.from("audit_logs").insert({
        user_id: user.id,
        action: "password_verification_failed",
        payload: { email: user.email, error: signInError.message },
        severity: "warning"
      }).select().single();

      return jsonResponse({ valid: false, message: "Senha incorreta" }, 200);
    }

    // Success
    return jsonResponse({ valid: true }, 200);

  } catch (err) {
    console.error("verify-current-user-password error:", err);
    return jsonResponse(
      { error: "Internal Server Error" },
      500
    );
  }
});
