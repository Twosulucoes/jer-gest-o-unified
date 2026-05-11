import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const ADMIN_EMAIL = Deno.env.get("ADMIN_EMAIL") ?? "admin@jer.roraima.gov.br";

// Arquivo no Storage que rastreia falhas consecutivas
const FAILURES_FILE = "health-failures.json";
const MAX_FAILURES_BEFORE_ALERT = 2;

interface FailureState {
  count: number;
  first_failure_at: string;
  last_failure_at: string;
  alerted: boolean;
}

async function getFailureState(supabase: ReturnType<typeof createClient>): Promise<FailureState | null> {
  const { data, error } = await supabase.storage
    .from("backups")
    .download(FAILURES_FILE);

  if (error || !data) return null;

  try {
    const text = await data.text();
    return JSON.parse(text) as FailureState;
  } catch {
    return null;
  }
}

async function saveFailureState(
  supabase: ReturnType<typeof createClient>,
  state: FailureState | null,
): Promise<void> {
  if (state === null) {
    await supabase.storage.from("backups").remove([FAILURES_FILE]);
    return;
  }
  const payload = JSON.stringify(state);
  await supabase.storage
    .from("backups")
    .upload(FAILURES_FILE, payload, {
      contentType: "application/json",
      upsert: true,
    });
}

async function sendAlertEmail(state: FailureState): Promise<void> {
  if (!RESEND_API_KEY) {
    console.warn("[monitor-health] RESEND_API_KEY não configurado — alerta apenas no log.");
    console.error(
      `[monitor-health] ALERTA: ${state.count} falhas consecutivas desde ${state.first_failure_at}`,
    );
    return;
  }

  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "JER Gestão <sistema@jer.roraima.gov.br>",
        to: [ADMIN_EMAIL],
        subject: "⚠️ JER Gestão — Banco de dados indisponível",
        html: `
          <h2>Alerta de disponibilidade — JER Gestão</h2>
          <p>O banco de dados Supabase não respondeu por <strong>${state.count} verificações consecutivas</strong>.</p>
          <ul>
            <li><strong>Primeira falha:</strong> ${new Date(state.first_failure_at).toLocaleString("pt-BR")}</li>
            <li><strong>Última falha:</strong> ${new Date(state.last_failure_at).toLocaleString("pt-BR")}</li>
            <li><strong>Falhas consecutivas:</strong> ${state.count}</li>
          </ul>
          <p>Os operadores com PWA aberta continuarão registrando consumos localmente (fila offline).
             Os dados serão sincronizados automaticamente quando a conexão for restabelecida.</p>
          <hr/>
          <p><em>JER Gestão — Sistema de Gestão Operacional</em></p>
        `,
      }),
    });

    if (!resp.ok) {
      const body = await resp.text();
      console.error("[monitor-health] Falha ao enviar email via Resend:", body);
    } else {
      console.log("[monitor-health] Email de alerta enviado para", ADMIN_EMAIL);
    }
  } catch (e) {
    console.error("[monitor-health] Erro ao enviar email:", e);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  const checkedAt = new Date().toISOString();

  // Teste de conectividade: query leve no banco
  const { error: dbError } = await supabase
    .from("meal_consumptions")
    .select("id")
    .limit(1);

  const healthy = !dbError;

  if (healthy) {
    // Banco OK — limpa estado de falhas se existia
    const prev = await getFailureState(supabase);
    if (prev && prev.count > 0) {
      console.log(`[monitor-health] Banco recuperado após ${prev.count} falha(s). Limpando estado.`);
      await saveFailureState(supabase, null);
    }

    return new Response(
      JSON.stringify({ ok: true, healthy: true, checked_at: checkedAt }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // Banco com erro — incrementa contador de falhas
  console.warn("[monitor-health] Banco indisponível:", dbError?.message);

  const prev = await getFailureState(supabase);
  const newState: FailureState = {
    count: (prev?.count ?? 0) + 1,
    first_failure_at: prev?.first_failure_at ?? checkedAt,
    last_failure_at: checkedAt,
    alerted: prev?.alerted ?? false,
  };

  await saveFailureState(supabase, newState);

  // Envia alerta se atingiu o threshold e ainda não alertou
  if (newState.count >= MAX_FAILURES_BEFORE_ALERT && !newState.alerted) {
    await sendAlertEmail(newState);
    newState.alerted = true;
    await saveFailureState(supabase, newState);
  }

  return new Response(
    JSON.stringify({
      ok: false,
      healthy: false,
      checked_at: checkedAt,
      consecutive_failures: newState.count,
      error: dbError?.message,
    }),
    {
      status: 503,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
