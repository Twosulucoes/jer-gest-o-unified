import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Tabelas críticas exportadas no backup diário
const TABELAS_CRITICAS = [
  "meal_consumptions",
  "meal_audit_logs",
  "meal_windows",
  "service_vouchers",
  "service_voucher_uses",
  "sync_logs",
] as const;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  const today = new Date().toISOString().split("T")[0];

  try {
    const snapshot: Record<string, unknown[]> = {};
    const erros: string[] = [];

    for (const tabela of TABELAS_CRITICAS) {
      try {
        const { data, error } = await supabase
          .from(tabela)
          .select("*")
          .gte("created_at", `${today}T00:00:00.000Z`);

        if (error) {
          // Tabela pode não existir (sync_logs é opcional)
          erros.push(`${tabela}: ${error.message}`);
          snapshot[tabela] = [];
        } else {
          snapshot[tabela] = data ?? [];
        }
      } catch (e) {
        erros.push(`${tabela}: ${e instanceof Error ? e.message : String(e)}`);
        snapshot[tabela] = [];
      }
    }

    const payload = JSON.stringify({
      gerado_em: new Date().toISOString(),
      data_referencia: today,
      totais: Object.fromEntries(
        Object.entries(snapshot).map(([k, v]) => [k, (v as unknown[]).length]),
      ),
      erros: erros.length > 0 ? erros : undefined,
      dados: snapshot,
    });

    const filename = `backup-${today}.json`;
    const { error: uploadError } = await supabase.storage
      .from("backups")
      .upload(filename, payload, {
        contentType: "application/json",
        upsert: true,
      });

    if (uploadError) {
      console.error("[backup-diario] Erro no upload:", uploadError.message);
      return new Response(
        JSON.stringify({ ok: false, error: uploadError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const totalRegistros = Object.values(snapshot).reduce(
      (acc, arr) => acc + (arr as unknown[]).length,
      0,
    );

    console.log(
      `[backup-diario] ${filename} salvo — ${totalRegistros} registros em ${TABELAS_CRITICAS.length} tabelas`,
    );

    return new Response(
      JSON.stringify({
        ok: true,
        filename,
        data_referencia: today,
        totais: Object.fromEntries(
          Object.entries(snapshot).map(([k, v]) => [k, (v as unknown[]).length]),
        ),
        erros: erros.length > 0 ? erros : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[backup-diario] Erro inesperado:", msg);
    return new Response(
      JSON.stringify({ ok: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
