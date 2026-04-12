import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify caller is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "NOT_AUTHENTICATED" }, 401);
    }

    // Admin client with service role
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verify caller using admin client
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller }, error: userErr } = await adminClient.auth.getUser(token);
    if (userErr || !caller) {
      return jsonResponse({ error: "NOT_AUTHENTICATED" }, 401);
    }

    // Check admin/secretaria role using admin client (bypasses JWT verification issues)
    const { data: callerRoles } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id);
    
    const roles = (callerRoles || []).map((r: any) => r.role);
    if (!roles.includes("admin") && !roles.includes("secretaria")) {
      return jsonResponse({ error: "NOT_AUTHORIZED" }, 403);
    }


    const body = await req.json();
    const { action } = body;

    switch (action) {
      case "list_users": {
        // List all users from auth + profiles
        const { data: { users }, error } = await adminClient.auth.admin.listUsers({ perPage: 500 });
        if (error) return jsonResponse({ error: error.message }, 500);

        const { data: profiles } = await adminClient
          .from("profiles")
          .select("id, full_name, active");

        const { data: allRoles } = await adminClient
          .from("user_roles")
          .select("user_id, role");

        const profilesMap = new Map((profiles || []).map((p: any) => [p.id, p]));
        const rolesMap = new Map<string, string[]>();
        for (const r of allRoles || []) {
          const arr = rolesMap.get(r.user_id) || [];
          arr.push(r.role);
          rolesMap.set(r.user_id, arr);
        }

        const result = users.map((u: any) => {
          const profile = profilesMap.get(u.id);
          return {
            user_id: u.id,
            email: u.email,
            full_name: profile?.full_name || null,
            active: profile?.active ?? true,
            roles: rolesMap.get(u.id) || [],
            last_sign_in_at: u.last_sign_in_at,
            created_at: u.created_at,
          };
        });

        return jsonResponse({ users: result });
      }

      case "invite_user": {
        const { email, full_name, role } = body;
        if (!email || !role) {
          return jsonResponse({ error: "email and role are required" }, 400);
        }

        const validRoles = ["admin", "secretaria", "transporte", "alimentacao", "coordenacao_tecnica", "delegacao"];
        if (!validRoles.includes(role)) {
          return jsonResponse({ error: "Invalid role" }, 400);
        }

        const redirectTo = `${req.headers.get("origin") || supabaseUrl}/pwa/set-password`;

        const { data: inviteData, error: inviteErr } = await adminClient.auth.admin.inviteUserByEmail(email, {
          redirectTo,
        });
        if (inviteErr) return jsonResponse({ error: inviteErr.message }, 500);

        const userId = inviteData.user.id;

        // Upsert profile
        await adminClient.from("profiles").upsert({
          id: userId,
          full_name: full_name || null,
          active: true,
        }, { onConflict: "id" });

        // Insert role (ignore if exists)
        await adminClient.from("user_roles").upsert({
          user_id: userId,
          role,
        }, { onConflict: "user_id,role" });

        return jsonResponse({ success: true, user_id: userId });
      }

      case "set_role": {
        const { user_id, role } = body;
        if (!user_id || !role) {
          return jsonResponse({ error: "user_id and role are required" }, 400);
        }

        // Remove existing roles and set new one
        await adminClient.from("user_roles").delete().eq("user_id", user_id);
        const { error } = await adminClient.from("user_roles").insert({ user_id, role });
        if (error) return jsonResponse({ error: error.message }, 500);

        return jsonResponse({ success: true });
      }

      case "set_active": {
        const { user_id, active } = body;
        if (!user_id || typeof active !== "boolean") {
          return jsonResponse({ error: "user_id and active are required" }, 400);
        }

        const { error } = await adminClient
          .from("profiles")
          .update({ active })
          .eq("id", user_id);
        if (error) return jsonResponse({ error: error.message }, 500);

        // If deactivating, sign out user
        if (!active) {
          await adminClient.auth.admin.signOut(user_id);
        }

        return jsonResponse({ success: true });
      }

      case "revoke_sessions": {
        const { user_id } = body;
        if (!user_id) return jsonResponse({ error: "user_id is required" }, 400);

        const { error } = await adminClient.auth.admin.signOut(user_id);
        if (error) return jsonResponse({ error: error.message }, 500);

        return jsonResponse({ success: true });
      }

      case "generate_reset_link": {
        const { email } = body;
        if (!email) return jsonResponse({ error: "email is required" }, 400);

        const redirectTo = `${req.headers.get("origin") || supabaseUrl}/pwa/set-password`;

        const { data, error } = await adminClient.auth.admin.generateLink({
          type: "recovery",
          email,
          options: { redirectTo },
        });
        if (error) return jsonResponse({ error: error.message }, 500);

        return jsonResponse({
          action_link: data.properties?.action_link || null,
        });
      }

      default:
        return jsonResponse({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
});
