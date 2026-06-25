import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const CDE_PRESIDENT_EMAIL = Deno.env.get("CDE_PRESIDENT_EMAIL") || "jogosescolaresrr2025@gmail.com";
const APP_URL = Deno.env.get("APP_URL") || "https://adm.jers.com.br";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "CDE JER <onboarding@resend.dev>",
      to,
      subject,
      html,
    }),
  });

  if (!res.ok) {
    throw new Error(await res.text());
  }

  return await res.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();

    const {
      id,
      protocol,
      public_token,
      professor_email,
      professor_nome,
      escola,
      modalidade,
      categoria,
      naipe,
      tipo_recurso,
    } = body;

    if (!protocol || !public_token || !professor_email) {
      return new Response(JSON.stringify({ error: "Dados obrigatórios ausentes" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const consultaUrl = `${APP_URL}/cde/consulta/${public_token}`;
    const adminUrl = `${APP_URL}/admin/cde/${id}`;

    await sendEmail(
      professor_email,
      `Recurso CDE recebido — ${protocol}`,
      `
        <h2>Recurso CDE recebido</h2>
        <p>Olá, ${professor_nome || "professor(a)"}.</p>
        <p>Seu recurso foi recebido com sucesso.</p>
        <p><strong>Protocolo:</strong> ${protocol}</p>
        <p><strong>Status:</strong> Pendente de análise</p>
        <p><strong>Escola:</strong> ${escola || "-"}</p>
        <p><strong>Modalidade:</strong> ${modalidade || "-"}</p>
        <p>Acompanhe pelo link:</p>
        <p><a href="${consultaUrl}">${consultaUrl}</a></p>
        <br/>
        <p>Comissão Disciplinar Especial — JER</p>
      `,
    );

    await sendEmail(
      CDE_PRESIDENT_EMAIL,
      `Novo recurso CDE — ${protocol}`,
      `
        <h2>Novo recurso CDE recebido</h2>
        <p><strong>Protocolo:</strong> ${protocol}</p>
        <p><strong>Professor:</strong> ${professor_nome || "-"}</p>
        <p><strong>Escola:</strong> ${escola || "-"}</p>
        <p><strong>Modalidade:</strong> ${modalidade || "-"}</p>
        <p><strong>Categoria:</strong> ${categoria || "-"}</p>
        <p><strong>Naipe:</strong> ${naipe || "-"}</p>
        <p><strong>Tipo:</strong> ${tipo_recurso || "-"}</p>
        <p>Abrir processo:</p>
        <p><a href="${adminUrl}">${adminUrl}</a></p>
      `,
    );

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro desconhecido" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
