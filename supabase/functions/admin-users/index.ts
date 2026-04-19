import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function logAudit(adminClient: any, action: string, recordId: string, createdBy: string, payload?: any) {
  await adminClient.from("audit_events").insert({
    action,
    table_name: "users",
    record_id: recordId,
    created_by: createdBy,
    payload: payload || null,
  });
}

const VALID_ROLES = ["admin", "secretaria", "transporte", "alimentacao", "alojamento", "coordenacao_tecnica", "coordenador_modalidade", "delegacao", "mesario", "arbitragem", "cde"];

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
    const callerIsSuper = roles.includes("super_admin");
    if (!roles.includes("admin") && !roles.includes("secretaria") && !callerIsSuper) {
      return jsonResponse({ error: "NOT_AUTHORIZED" }, 403);
    }

    // Helper: bloqueia operações sobre super_admins por callers não-super
    async function isProtectedTarget(targetUserId: string): Promise<boolean> {
      if (callerIsSuper) return false;
      const { data } = await adminClient
        .from("user_roles")
        .select("role")
        .eq("user_id", targetUserId)
        .eq("role", "super_admin")
        .maybeSingle();
      return !!data;
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

        const result = users
          .filter((u: any) => {
            // Esconde super_admins de callers não-super
            if (callerIsSuper) return true;
            const userRoles = rolesMap.get(u.id) || [];
            return !userRoles.includes("super_admin");
          })
          .map((u: any) => {
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
        const { email, full_name, role: singleRole, roles: multiRoles } = body;
        // Support both single role (legacy) and multiple roles
        const targetRoles: string[] = multiRoles && Array.isArray(multiRoles) && multiRoles.length > 0
          ? multiRoles
          : singleRole ? [singleRole] : [];

        if (!email || targetRoles.length === 0) {
          return jsonResponse({ error: "email and at least one role are required" }, 400);
        }

        for (const r of targetRoles) {
          if (!VALID_ROLES.includes(r)) {
            return jsonResponse({ error: `Invalid role: ${r}` }, 400);
          }
        }

        // Secretaria cannot create admin or secretaria
        if (!roles.includes("admin") && targetRoles.some(r => r === "admin" || r === "secretaria")) {
          return jsonResponse({ error: "Secretaria não pode criar usuários admin ou secretaria" }, 403);
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

        // Insert all roles
        for (const r of targetRoles) {
          await adminClient.from("user_roles").upsert({
            user_id: userId,
            role: r,
          }, { onConflict: "user_id,role" });
        }

        // Log audit
        await logAudit(adminClient, "user_created", userId, caller.id, { email, roles: targetRoles, full_name });

        return jsonResponse({ success: true, user_id: userId });
      }

      case "set_role": {
        const { user_id, role } = body;
        if (!user_id || !role) {
          return jsonResponse({ error: "user_id and role are required" }, 400);
        }
        if (await isProtectedTarget(user_id)) {
          return jsonResponse({ error: "Operação não permitida sobre este usuário." }, 403);
        }

        // Secretaria cannot assign admin/secretaria
        if (!roles.includes("admin") && (role === "admin" || role === "secretaria")) {
          return jsonResponse({ error: "Sem permissão para atribuir este perfil" }, 403);
        }

        // Remove existing roles and set new one
        await adminClient.from("user_roles").delete().eq("user_id", user_id);
        const { error } = await adminClient.from("user_roles").insert({ user_id, role });
        if (error) return jsonResponse({ error: error.message }, 500);

        await logAudit(adminClient, "profile_changed", user_id, caller.id, { new_role: role });

        return jsonResponse({ success: true });
      }

      case "set_roles": {
        const { user_id, roles: newRoles } = body;
        if (!user_id || !Array.isArray(newRoles) || newRoles.length === 0) {
          return jsonResponse({ error: "user_id and at least one role are required" }, 400);
        }
        if (await isProtectedTarget(user_id)) {
          return jsonResponse({ error: "Operação não permitida sobre este usuário." }, 403);
        }

        for (const r of newRoles) {
          if (!VALID_ROLES.includes(r)) {
            return jsonResponse({ error: `Invalid role: ${r}` }, 400);
          }
        }

        // Secretaria cannot assign admin/secretaria
        if (!roles.includes("admin") && newRoles.some((r: string) => r === "admin" || r === "secretaria")) {
          return jsonResponse({ error: "Sem permissão para atribuir perfis admin ou secretaria" }, 403);
        }

        // Remove existing roles and insert all new ones
        await adminClient.from("user_roles").delete().eq("user_id", user_id);
        const inserts = newRoles.map((r: string) => ({ user_id, role: r }));
        const { error } = await adminClient.from("user_roles").insert(inserts);
        if (error) return jsonResponse({ error: error.message }, 500);

        await logAudit(adminClient, "roles_changed", user_id, caller.id, { new_roles: newRoles });

        return jsonResponse({ success: true });
      }

      case "set_active": {
        const { user_id, active } = body;
        if (!user_id || typeof active !== "boolean") {
          return jsonResponse({ error: "user_id and active are required" }, 400);
        }
        if (await isProtectedTarget(user_id)) {
          return jsonResponse({ error: "Operação não permitida sobre este usuário." }, 403);
        }

        // Prevent deactivating self
        if (user_id === caller.id && !active) {
          return jsonResponse({ error: "Não é possível desativar seu próprio usuário" }, 400);
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

        await logAudit(adminClient, active ? "user_activated" : "user_deactivated", user_id, caller.id);

        return jsonResponse({ success: true });
      }

      case "revoke_sessions": {
        const { user_id } = body;
        if (!user_id) return jsonResponse({ error: "user_id is required" }, 400);
        if (await isProtectedTarget(user_id)) {
          return jsonResponse({ error: "Operação não permitida sobre este usuário." }, 403);
        }

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

      case "resend_invite": {
        const { user_id } = body;
        if (!user_id) return jsonResponse({ error: "user_id is required" }, 400);
        if (await isProtectedTarget(user_id)) {
          return jsonResponse({ error: "Operação não permitida sobre este usuário." }, 403);
        }

        // Get user email
        const { data: { user: targetUser }, error: getUserErr } = await adminClient.auth.admin.getUserById(user_id);
        if (getUserErr || !targetUser) return jsonResponse({ error: "Usuário não encontrado" }, 404);

        const redirectTo = `${req.headers.get("origin") || supabaseUrl}/pwa/set-password`;
        const { error: inviteErr } = await adminClient.auth.admin.inviteUserByEmail(targetUser.email!, { redirectTo });
        if (inviteErr) return jsonResponse({ error: inviteErr.message }, 500);

        await logAudit(adminClient, "invite_resent", user_id, caller.id, { email: targetUser.email });

        return jsonResponse({ success: true });
      }

      case "reset_password": {
        const { user_id } = body;
        if (!user_id) return jsonResponse({ error: "user_id is required" }, 400);
        if (await isProtectedTarget(user_id)) {
          return jsonResponse({ error: "Operação não permitida sobre este usuário." }, 403);
        }

        const { data: { user: targetUser }, error: getUserErr } = await adminClient.auth.admin.getUserById(user_id);
        if (getUserErr || !targetUser) return jsonResponse({ error: "Usuário não encontrado" }, 404);

        const redirectTo = `${req.headers.get("origin") || supabaseUrl}/pwa/set-password`;
        const { data, error: linkErr } = await adminClient.auth.admin.generateLink({
          type: "recovery",
          email: targetUser.email!,
          options: { redirectTo },
        });
        if (linkErr) return jsonResponse({ error: linkErr.message }, 500);

        await logAudit(adminClient, "password_reset", user_id, caller.id);

        return jsonResponse({ action_link: data.properties?.action_link || null });
      }

      case "get_user_audit": {
        const { user_id } = body;
        if (!user_id) return jsonResponse({ error: "user_id is required" }, 400);

        const { data: events } = await adminClient
          .from("audit_events")
          .select("action, payload, created_at, created_by")
          .eq("record_id", user_id)
          .eq("table_name", "users")
          .order("created_at", { ascending: false })
          .limit(20);

        return jsonResponse({ events: events || [] });
      }

      default:
        return jsonResponse({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});
