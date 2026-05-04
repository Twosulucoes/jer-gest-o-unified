// ============================================================
// Edge function: import-referees
// Etapa 2.3 da auditoria de Arbitragem
// (docs/modulos/arbitros-auditoria.md)
//
// Recebe payload completo (20 campos por linha) já validado pelo
// front (src/components/admin/arbitragem/refereeImport.ts) e:
//   1. Localiza/cria pessoa em `people` (idempotente por CPF).
//   2. Convida o usuário no Auth (ou recupera o existente).
//   3. Garante perfil + role 'arbitragem'.
//   4. Faz upsert em `referee_profiles` com todos os campos +
//      person_id apontando para a pessoa unificada.
//   5. Log em audit_events por linha (com flag bank_data sem
//      despejar valores).
//
// Auth requerido: caller deve ser admin ou secretaria.
// Resposta: { ok, results: [{ index, status, ... }] }.
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface ImportRow {
  full_name?: string;
  email?: string;
  cpf?: string | null;
  rne?: string | null;
  rg?: string | null;
  phone?: string | null;
  birth_date?: string | null;
  gender?: string | null;
  nationality?: string | null;
  zip_code?: string | null;
  street_address?: string | null;
  address_complement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  bank_name?: string | null;
  bank_branch?: string | null;
  bank_account?: string | null;
  modalities?: string | null;
  categories?: string | null;
}

type RowStatus = "created" | "updated" | "linked_existing" | "duplicate" | "error";

interface RowResult {
  index: number;
  email: string;
  status: RowStatus;
  reason?: string;
  user_id?: string;
  person_id?: string | null;
  had_bank_data: boolean;
}

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

const onlyDigits = (s: string | null | undefined): string =>
  (s ?? "").replace(/\D+/g, "");

function isValidCpf(rawCpf: string | null | undefined): boolean {
  const cpf = onlyDigits(rawCpf ?? "");
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;
  const calc = (slice: string, factor: number): number => {
    let sum = 0;
    for (let i = 0; i < slice.length; i++) sum += parseInt(slice[i], 10) * (factor - i);
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };
  return (
    calc(cpf.slice(0, 9), 10) === parseInt(cpf[9], 10) &&
    calc(cpf.slice(0, 10), 11) === parseInt(cpf[10], 10)
  );
}

function pickNonNull<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const k of Object.keys(obj) as Array<keyof T>) {
    if (obj[k] !== null && obj[k] !== undefined && obj[k] !== "") out[k] = obj[k];
  }
  return out;
}

async function findUserByEmail(adminClient: any, email: string): Promise<string | null> {
  // listUsers é paginado. Para a base atual (algumas centenas de árbitros)
  // 1 página de 1000 cobre. Para escala maior, evoluir com índice ou cache.
  const target = email.toLowerCase();
  let page = 1;
  while (page <= 5) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`listUsers falhou: ${error.message}`);
    const users = data?.users ?? [];
    const found = users.find((u: any) => u.email?.toLowerCase() === target);
    if (found) return found.id;
    if (users.length < 1000) return null; // última página
    page++;
  }
  return null;
}

// ------------------------------------------------------------
// Processamento por linha
// ------------------------------------------------------------

async function processRow(
  adminClient: any,
  row: ImportRow,
  index: number,
  callerId: string,
): Promise<RowResult> {
  const had_bank_data = !!(row.bank_name || row.bank_branch || row.bank_account);
  const email = (row.email ?? "").trim().toLowerCase();
  const baseFail = (reason: string, status: RowStatus = "error"): RowResult => ({
    index,
    email,
    status,
    reason,
    had_bank_data,
  });

  if (!email) return baseFail("E-mail ausente.");
  if (!row.full_name || row.full_name.trim().length < 2)
    return baseFail("Nome ausente ou muito curto.");
  if (!row.cpf && !row.rne) return baseFail("CPF ou RNE obrigatório.");
  if (row.cpf && !isValidCpf(row.cpf)) return baseFail("CPF inválido.");

  // --------------------------------------------------------
  // 1. Pessoa unificada (people) — opcional para CPF-less
  // --------------------------------------------------------
  let person_id: string | null = null;
  if (row.cpf) {
    const cpfDigits = onlyDigits(row.cpf);
    const { data: existing, error: lookupErr } = await adminClient
      .from("people")
      .select("id")
      .eq("cpf", cpfDigits)
      .maybeSingle();
    if (lookupErr) return baseFail(`Lookup people falhou: ${lookupErr.message}`);

    if (existing) {
      person_id = existing.id;
      // Atualiza apenas campos não-nulos para não sobrescrever dados existentes
      // com valores vazios da planilha de árbitros.
      const updates = pickNonNull({
        full_name: row.full_name,
        email: row.email,
        phone: row.phone,
        rg: row.rg,
        gender: row.gender,
      });
      if (Object.keys(updates).length > 0) {
        const { error: updErr } = await adminClient
          .from("people")
          .update(updates)
          .eq("id", existing.id);
        if (updErr) return baseFail(`Update people falhou: ${updErr.message}`);
      }
    } else {
      // Cria novo. people.birth_date é NOT NULL — exige preenchimento.
      if (!row.birth_date)
        return baseFail("Pessoa nova precisa de data de nascimento (people.birth_date NOT NULL).");
      const insertPayload: Record<string, unknown> = {
        cpf: cpfDigits,
        full_name: row.full_name,
        birth_date: row.birth_date,
        kind: "referee",
      };
      if (row.email) insertPayload.email = row.email;
      if (row.phone) insertPayload.phone = row.phone;
      if (row.rg) insertPayload.rg = row.rg;
      if (row.gender) insertPayload.gender = row.gender;

      const { data: newPerson, error: insErr } = await adminClient
        .from("people")
        .insert(insertPayload)
        .select("id")
        .single();
      if (insErr) return baseFail(`Insert people falhou: ${insErr.message}`);
      person_id = newPerson.id;
    }
  }
  // Se sem CPF, person_id fica null. Foreigners com RNE não são vinculados
  // ao quadrante Pessoas até que `people` ganhe coluna RNE (Etapa futura).

  // --------------------------------------------------------
  // 2. Auth user — invite ou recupera existente
  // --------------------------------------------------------
  let userId: string;
  let isNewUser = false;
  const redirectTo = `${Deno.env.get("SUPABASE_URL")}/pwa/set-password`;
  const { data: inviteData, error: inviteErr } = await adminClient.auth.admin.inviteUserByEmail(
    email,
    { redirectTo },
  );

  if (inviteErr) {
    const m = inviteErr.message.toLowerCase();
    const isExisting =
      m.includes("already") || m.includes("existe") || m.includes("duplicate");
    if (!isExisting) return baseFail(`Auth invite falhou: ${inviteErr.message}`);

    const found = await findUserByEmail(adminClient, email);
    if (!found)
      return baseFail("E-mail já existe no Auth mas não foi encontrado na listagem.");
    userId = found;
  } else {
    userId = inviteData.user.id;
    isNewUser = true;
  }

  // --------------------------------------------------------
  // 3. profiles
  // --------------------------------------------------------
  const { error: profErr } = await adminClient
    .from("profiles")
    .upsert({ id: userId, full_name: row.full_name, active: true }, { onConflict: "id" });
  if (profErr) return baseFail(`Upsert profiles falhou: ${profErr.message}`);

  // --------------------------------------------------------
  // 4. user_roles
  // --------------------------------------------------------
  const { error: roleErr } = await adminClient
    .from("user_roles")
    .upsert({ user_id: userId, role: "arbitragem" }, { onConflict: "user_id,role" });
  if (roleErr) return baseFail(`Upsert user_roles falhou: ${roleErr.message}`);

  // --------------------------------------------------------
  // 5. referee_profiles — payload completo
  // --------------------------------------------------------
  const refereePayload: Record<string, unknown> = {
    user_id: userId,
    person_id,
    full_name: row.full_name,
    email,
    phone: row.phone ?? null,
    cpf: row.cpf ? onlyDigits(row.cpf) : null,
    rne: row.rne ?? null,
    rg: row.rg ?? null,
    birth_date: row.birth_date ?? null,
    gender: row.gender ?? null,
    nationality: row.nationality ?? null,
    zip_code: row.zip_code ?? null,
    street_address: row.street_address ?? null,
    address_complement: row.address_complement ?? null,
    neighborhood: row.neighborhood ?? null,
    city: row.city ?? null,
    state: row.state ?? null,
    bank_name: row.bank_name ?? null,
    bank_branch: row.bank_branch ?? null,
    bank_account: row.bank_account ?? null,
    modalities: row.modalities ?? null,
    categories: row.categories ?? null,
    status: "Ativo",
    updated_at: new Date().toISOString(),
  };

  const { error: refErr } = await adminClient
    .from("referee_profiles")
    .upsert(refereePayload, { onConflict: "user_id" });
  if (refErr) return baseFail(`Upsert referee_profiles falhou: ${refErr.message}`);

  // --------------------------------------------------------
  // 6. Audit log — sem despejar valores bancários
  // --------------------------------------------------------
  await adminClient.from("audit_events").insert({
    action: "referee_imported",
    table_name: "referee_profiles",
    record_id: userId,
    created_by: callerId,
    payload: {
      email,
      full_name: row.full_name,
      person_id,
      had_cpf: !!row.cpf,
      had_rne: !!row.rne,
      had_bank_data,
      is_new_user: isNewUser,
    },
  });

  return {
    index,
    email,
    status: isNewUser ? "created" : "linked_existing",
    user_id: userId,
    person_id,
    had_bank_data,
  };
}

// ------------------------------------------------------------
// Handler principal
// ------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!supabaseUrl || !serviceRoleKey)
      throw new Error("SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausente.");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "NOT_AUTHENTICATED" }, 401);
    const token = authHeader.replace("Bearer ", "");

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: { user: callerUser }, error: callerErr } =
      await adminClient.auth.getUser(token);
    if (callerErr || !callerUser)
      return jsonResponse({ error: "NOT_AUTHENTICATED", details: callerErr?.message }, 401);

    const callerId = callerUser.id;

    const { data: callerRoles } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId);
    const roles = (callerRoles ?? []).map((r: any) => r.role);

    const isAuthorized =
      roles.includes("admin") ||
      roles.includes("secretaria") ||
      roles.includes("super_admin");
    if (!isAuthorized) return jsonResponse({ error: "NOT_AUTHORIZED" }, 403);

    const body = await req.json();
    const rows: ImportRow[] = Array.isArray(body?.rows) ? body.rows : [];
    if (rows.length === 0)
      return jsonResponse({ error: "EMPTY_PAYLOAD", details: "rows[] vazio." }, 400);
    if (rows.length > 1000)
      return jsonResponse({ error: "TOO_MANY_ROWS", details: "Limite 1000 por chamada." }, 400);

    const results: RowResult[] = [];
    for (let i = 0; i < rows.length; i++) {
      try {
        const r = await processRow(adminClient, rows[i], i, callerId);
        results.push(r);
      } catch (err) {
        const e = err as Error;
        results.push({
          index: i,
          email: (rows[i].email ?? "").toLowerCase(),
          status: "error",
          reason: e.message ?? "Erro desconhecido.",
          had_bank_data: !!(
            rows[i].bank_name || rows[i].bank_branch || rows[i].bank_account
          ),
        });
      }
    }

    // Resumo agregado para o caller
    const summary = {
      total: results.length,
      created: results.filter((r) => r.status === "created").length,
      linked_existing: results.filter((r) => r.status === "linked_existing").length,
      updated: results.filter((r) => r.status === "updated").length,
      duplicate: results.filter((r) => r.status === "duplicate").length,
      error: results.filter((r) => r.status === "error").length,
      with_bank_data: results.filter((r) => r.had_bank_data).length,
    };

    // Audit agregado
    await adminClient.from("audit_events").insert({
      action: "referee_import_batch",
      table_name: "referee_profiles",
      record_id: callerId,
      created_by: callerId,
      payload: { summary },
    });

    return jsonResponse({ ok: true, summary, results });
  } catch (err) {
    const e = err as Error;
    console.error("import-referees fatal:", e.message);
    return jsonResponse({ error: "INTERNAL_ERROR", details: e.message }, 500);
  }
});
