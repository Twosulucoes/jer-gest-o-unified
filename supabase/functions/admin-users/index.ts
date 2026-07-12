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

const VALID_ROLES = ["super_admin", "admin", "secretaria", "transporte", "alimentacao", "material", "alojamento", "coordenacao_tecnica", "coordenador_modalidade", "delegacao", "mesario", "arbitragem", "cde"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing environment variables SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    }

    // Verify caller is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "NOT_AUTHENTICATED" }, 401);
    }

    // Admin client with service role
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verify caller: try getClaims first (signing-keys), fallback to getUser via user-scoped client
    const token = authHeader.replace("Bearer ", "");
    
    // Check if it's a valid token
    const { data: { user: callerUser }, error: callerErr } = await adminClient.auth.getUser(token);
    if (callerErr || !callerUser) {
      console.error("Auth verification failed:", callerErr);
      return jsonResponse({ error: "NOT_AUTHENTICATED", details: callerErr?.message }, 401);
    }
    
    const callerId = callerUser.id;
    const callerEmail = callerUser.email;
    const caller = { id: callerId, email: callerEmail };

    // Check permissions using admin client
    const { data: callerRoles } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId);
    
    const roles = (callerRoles || []).map((r: any) => r.role);
    const callerIsSuper = roles.includes("super_admin");
    const callerIsAdmin = roles.includes("admin");
    const callerIsSecretaria = roles.includes("secretaria");
    const callerIsCoordenacao = roles.includes("coordenacao_tecnica");

    const callerIsCoordModalidade = roles.includes("coordenador_modalidade");

    if (!callerIsAdmin && !callerIsSecretaria && !callerIsSuper && !callerIsCoordenacao && !callerIsCoordModalidade) {
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

    // Simetria com a restrição de atribuição: quem NÃO pode conceder admin/secretaria/
    // super_admin também não pode removê-los nem desativar quem os possui. Sem isto, um
    // coordenador (que passa no gate) conseguiria rebaixar/desativar um admin, pois
    // set_role/set_roles apagam TODOS os papéis antes de inserir e isProtectedTarget só
    // cobre super_admin.
    async function callerMayModifyTarget(targetUserId: string): Promise<boolean> {
      if (callerIsAdmin || callerIsSuper) return true;
      const { data } = await adminClient
        .from("user_roles")
        .select("role")
        .eq("user_id", targetUserId)
        .in("role", ["admin", "secretaria", "super_admin"]);
      return (data ?? []).length === 0;
    }


    // Envia email de recuperação de senha pelo endpoint público do GoTrue,
    // que passa pelo SMTP customizado configurado em Auth → SMTP Settings.
    // Funciona tanto para novos usuários quanto para usuários já existentes,
    // ao contrário de inviteUserByEmail (que só aceita emails nunca cadastrados).
    async function sendRecoveryViaSmtp(email: string, redirectTo: string): Promise<boolean> {
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
      if (!anonKey) {
        console.warn("sendRecoveryViaSmtp: SUPABASE_ANON_KEY not set");
        return false;
      }
      const url = new URL(`${supabaseUrl}/auth/v1/recover`);
      url.searchParams.set("redirect_to", redirectTo);
      const resp = await fetch(url.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": anonKey },
        body: JSON.stringify({ email, gotrue_meta_security: {} }),
      });
      if (!resp.ok) {
        const text = await resp.text().catch(() => "");
        console.warn(`sendRecoveryViaSmtp failed (${resp.status}):`, text);
      }
      return resp.ok;
    }

    const body = await req.json();
    const { action } = body;

    switch (action) {
      case "list_users": {
        // List all users from auth + profiles
        // Note: listUsers is paginated. For large datasets, this might need handling.
        const { data: { users }, error } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
        if (error) {
          console.error("Error listing users from Auth:", error);
          return jsonResponse({ error: error.message }, 500);
        }

        const { data: profiles, error: profilesErr } = await adminClient
          .from("profiles")
          .select("id, full_name, active");
        
        if (profilesErr) {
          console.error("Error listing profiles:", profilesErr);
          // Don't fail completely if profiles fail, but log it
        }

        const { data: allRoles, error: rolesErr } = await adminClient
          .from("user_roles")
          .select("user_id, role");
        
        if (rolesErr) {
          console.error("Error listing roles:", rolesErr);
        }

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
        const { email, full_name, role: singleRole, roles: multiRoles, phone, send_email } = body;
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

        // Only super_admin can create super_admin
        if (!callerIsSuper && targetRoles.includes("super_admin")) {
          return jsonResponse({ error: "Somente Super Admin pode atribuir este perfil" }, 403);
        }

        // Secretaria cannot create admin or secretaria
        if (!roles.includes("admin") && !callerIsSuper && targetRoles.some(r => r === "admin" || r === "secretaria")) {
          return jsonResponse({ error: "Secretaria não pode criar usuários admin ou secretaria" }, 403);
        }

        const redirectTo = `${req.headers.get("origin") || supabaseUrl}/pwa/set-password`;
        const wantsEmail = send_email !== false; // default true; explicit false skips SMTP

        let userId: string;
        let manualLink: string | null = null;

        // Helper: cria usuário sem email + gera invite link manual (sem SMTP).
        // Usado tanto quando o admin pede explicitamente (send_email=false) quanto
        // como fallback se inviteUserByEmail falhar por qualquer motivo (rate limit,
        // SMTP fora, email inválido pro provider, etc).
        async function createWithoutEmail(): Promise<{ id: string; link: string | null } | { error: string }> {
          const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
            email,
            email_confirm: false,
          });
          if (createErr || !created?.user) {
            // Pode ser que o user já exista — tenta recuperar
            const m = (createErr?.message || "").toLowerCase();
            if (m.includes("already") || m.includes("registered") || m.includes("existe")) {
              const { data: { users: existingUsers } } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
              const found = existingUsers?.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());
              if (found) {
                const { data: linkData } = await adminClient.auth.admin.generateLink({
                  type: "recovery",
                  email,
                  options: { redirectTo },
                });
                return { id: found.id, link: linkData?.properties?.action_link ?? null };
              }
            }
            return { error: `Falha ao criar usuário sem email: ${createErr?.message ?? "unknown"}` };
          }
          const { data: linkData, error: linkErr } = await adminClient.auth.admin.generateLink({
            type: "invite",
            email,
            options: { redirectTo },
          });
          if (linkErr) console.warn("generateLink failed:", linkErr.message);
          return { id: created.user.id, link: linkData?.properties?.action_link ?? null };
        }

        if (!wantsEmail) {
          // Caminho explícito sem email — não tenta SMTP nem uma vez
          const r = await createWithoutEmail();
          if ("error" in r) return jsonResponse({ error: r.error }, 500);
          userId = r.id;
          manualLink = r.link;
        } else {
          const { data: inviteData, error: inviteErr } = await adminClient.auth.admin.inviteUserByEmail(email, {
            redirectTo,
          });

          if (inviteErr) {
            const msg = inviteErr.message.toLowerCase();
            if (msg.includes("already") || msg.includes("existe") || msg.includes("registered")) {
              // Usuário já em auth — recupera id e segue para upsert de profile/roles.
              // Também tenta notificá-lo: envia email de recuperação (SMTP) ou,
              // se o SMTP falhar, gera um link manual para o admin copiar.
              const { data: { users: existingUsers }, error: listErr } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
              if (listErr || !existingUsers) {
                return jsonResponse({ error: `Usuário já existe mas não pôde ser recuperado: ${inviteErr.message}` }, 500);
              }
              const existingUser = existingUsers.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());
              if (!existingUser) {
                return jsonResponse({ error: `Usuário já existe no Auth mas não foi encontrado na listagem.` }, 404);
              }
              userId = existingUser.id;
              if (wantsEmail) {
                const sent = await sendRecoveryViaSmtp(email, redirectTo);
                if (!sent) {
                  const { data: linkData } = await adminClient.auth.admin.generateLink({
                    type: "recovery", email, options: { redirectTo },
                  });
                  manualLink = linkData?.properties?.action_link ?? null;
                }
              } else {
                const { data: linkData } = await adminClient.auth.admin.generateLink({
                  type: "recovery", email, options: { redirectTo },
                });
                manualLink = linkData?.properties?.action_link ?? null;
              }
            } else {
              // Fallback agressivo: qualquer outra falha (rate limit, SMTP fora, email
              // inválido pro provider, network blip) → cria sem email e devolve link manual.
              // Mantém demos funcionando 100% mesmo com SMTP indisponível.
              console.warn("inviteUserByEmail failed, falling back to createUser:", inviteErr.message);
              const r = await createWithoutEmail();
              if ("error" in r) return jsonResponse({ error: `${inviteErr.message} | ${r.error}` }, 500);
              userId = r.id;
              manualLink = r.link;
            }
          } else {
            userId = inviteData.user.id;
          }
        }

        // Upsert profile
        const { error: profileErr } = await adminClient.from("profiles").upsert({
          id: userId,
          full_name: full_name || null,
          active: true,
        }, { onConflict: "id" });

        if (profileErr) {
          console.error("Error upserting profile:", profileErr);
          return jsonResponse({ error: `Erro ao criar perfil: ${profileErr.message}` }, 500);
        }

        // Insert all roles
        for (const r of targetRoles) {
          const { error: roleErr } = await adminClient.from("user_roles").upsert({
            user_id: userId,
            role: r,
          }, { onConflict: "user_id,role" });
          
          if (roleErr) {
            console.error(`Error assigning role ${r}:`, roleErr);
            return jsonResponse({ error: `Erro ao atribuir perfil ${r}: ${roleErr.message}` }, 500);
          }
        }
        
        // If one of the roles is 'arbitragem', tenta semear um referee_profiles vazio.
        // Não-bloqueante: existe a CHECK constraint `cpf IS NOT NULL OR rne IS NOT NULL`,
        // e nesse momento ainda não temos esses dados. O usuário completa depois
        // em /pwa/arbitragem/perfil — a home detecta `incomplete`/`missing-doc`
        // e força a edição antes de qualquer designação.
        if (targetRoles.includes("arbitragem")) {
          const { error: refereeErr } = await adminClient.from("referee_profiles").upsert({
            user_id: userId,
            full_name: full_name || email.split('@')[0],
            email: email,
            phone: phone || null,
          }, { onConflict: "user_id" });

          if (refereeErr) {
            console.warn("referee_profiles seed skipped:", refereeErr.message);
          }
        }

        // Log audit
        await logAudit(adminClient, "user_created", userId, caller.id, { email, roles: targetRoles, full_name, manual_link: !!manualLink });

        return jsonResponse({
          success: true,
          user_id: userId,
          manual_link: manualLink,
          email_sent: !manualLink,
        });
      }

      case "set_role": {
        const { user_id, role } = body;
        if (!user_id || !role) {
          return jsonResponse({ error: "user_id and role are required" }, 400);
        }
        if (await isProtectedTarget(user_id)) {
          return jsonResponse({ error: "Operação não permitida sobre este usuário." }, 403);
        }
        if (!(await callerMayModifyTarget(user_id))) {
          return jsonResponse({ error: "Sem permissão para alterar este usuário." }, 403);
        }

        // Only super_admin can assign super_admin
        if (!callerIsSuper && role === "super_admin") {
          return jsonResponse({ error: "Somente Super Admin pode atribuir este perfil" }, 403);
        }

        // Secretaria cannot assign admin/secretaria
        if (!roles.includes("admin") && !callerIsSuper && (role === "admin" || role === "secretaria")) {
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
        if (!(await callerMayModifyTarget(user_id))) {
          return jsonResponse({ error: "Sem permissão para alterar este usuário." }, 403);
        }

        for (const r of newRoles) {
          if (!VALID_ROLES.includes(r)) {
            return jsonResponse({ error: `Invalid role: ${r}` }, 400);
          }
        }

        // Only super_admin can assign super_admin
        if (!callerIsSuper && newRoles.some((r: string) => r === "super_admin")) {
          return jsonResponse({ error: "Somente Super Admin pode atribuir o perfil super_admin" }, 403);
        }

        // Secretaria cannot assign admin/secretaria
        if (!roles.includes("admin") && !callerIsSuper && newRoles.some((r: string) => r === "admin" || r === "secretaria")) {
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
        if (!(await callerMayModifyTarget(user_id))) {
          return jsonResponse({ error: "Sem permissão para alterar este usuário." }, 403);
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

        await logAudit(adminClient, "sessions_revoked", user_id, caller.id);

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
        const { user_id, send_email } = body;
        if (!user_id) return jsonResponse({ error: "user_id is required" }, 400);
        if (await isProtectedTarget(user_id)) {
          return jsonResponse({ error: "Operação não permitida sobre este usuário." }, 403);
        }

        const { data: { user: targetUser }, error: getUserErr } = await adminClient.auth.admin.getUserById(user_id);
        if (getUserErr || !targetUser) return jsonResponse({ error: "Usuário não encontrado" }, 404);

        const redirectTo = `${req.headers.get("origin") || supabaseUrl}/pwa/set-password`;
        const wantsEmail = send_email !== false;

        let manualLink: string | null = null;

        async function genResendLink() {
          // Recovery serve pra usuário que já tem conta; invite serve só pra
          // quem ainda não definiu senha. Tenta recovery (mais robusto).
          const { data: linkData, error: linkErr } = await adminClient.auth.admin.generateLink({
            type: "recovery",
            email: targetUser.email!,
            options: { redirectTo },
          });
          if (linkErr) console.warn("recovery generateLink failed:", linkErr.message);
          return linkData?.properties?.action_link ?? null;
        }

        if (!wantsEmail) {
          manualLink = await genResendLink();
        } else {
          // inviteUserByEmail sempre falha para usuários já existentes.
          // /recover funciona para qualquer usuário e usa o SMTP configurado.
          const sent = await sendRecoveryViaSmtp(targetUser.email!, redirectTo);
          if (!sent) {
            console.warn("resend_invite SMTP failed, generating manual link");
            manualLink = await genResendLink();
            if (!manualLink) return jsonResponse({ error: "Falha ao reenviar convite e ao gerar link de acesso." }, 500);
          }
        }

        await logAudit(adminClient, "invite_resent", user_id, caller.id, { email: targetUser.email, manual_link: !!manualLink });

        return jsonResponse({ success: true, manual_link: manualLink, email_sent: !manualLink });
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
    console.error("Fatal error in admin-users edge function:", err);
    return jsonResponse({ 
      error: (err as Error).message,
      stack: (err as Error).stack 
    }, 500);
  }
});
