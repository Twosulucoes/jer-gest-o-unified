import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  try {
    const { to, protocol_number } = await req.json();

    if (!to || !protocol_number) {
      return new Response(
        JSON.stringify({ error: "Parâmetros obrigatórios: to, protocol_number" }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY não configurada — e-mail não enviado");
      return new Response(
        JSON.stringify({ ok: false, reason: "RESEND_API_KEY not configured" }),
        { status: 200, headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "JER Gestão <noreply@jer.rr.gov.br>",
        to: [to],
        subject: `JER 2026 — Substituição Solicitada — Protocolo ${protocol_number}`,
        html: `
          <p>Prezado(a),</p>
          <p>
            JER 2026 — Substituição solicitada.<br/>
            <strong>Protocolo: ${protocol_number}</strong>
          </p>
          <p>Sua solicitação foi recebida e será analisada pela comissão técnica.</p>
          <p style="color:#888;font-size:12px;">
            Este é um e-mail automático. Não responda a esta mensagem.
          </p>
        `,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("Resend error:", data);
      return new Response(
        JSON.stringify({ ok: false, error: data }),
        { status: 200, headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ ok: true, id: data.id }),
      { status: 200, headers: { ...CORS, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } },
    );
  }
});
