import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const APP_URL = "https://adm.jers.com.br";

const EVOLUTION_API_URL = "http://92.112.176.108:8081";

const EVOLUTION_API_KEY =
  "c435ab87-d3aa-47ee-8608-11e33a09322e";

const EVOLUTION_INSTANCE = "jer-cde";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function normalizePhone(phone: string) {
  const onlyNumbers = String(phone || "").replace(/\D/g, "");

  if (!onlyNumbers) return "";

  if (onlyNumbers.startsWith("55")) return onlyNumbers;

  return `55${onlyNumbers}`;
}

async function sendWhatsApp(number: string, text: string) {
  const cleanNumber = normalizePhone(number);

  if (!cleanNumber) {
    console.warn("Número vazio.");
    return null;
  }

  const res = await fetch(`${EVOLUTION_API_URL}/send/text`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${EVOLUTION_API_KEY}`,
    },
    body: JSON.stringify({
      instance: EVOLUTION_INSTANCE,
      number: cleanNumber,
      text,
      delay: 1200,
    }),
  });

  const responseText = await res.text();

  if (!res.ok) {
    console.error("Erro Evolution:", res.status, responseText);
    throw new Error(responseText);
  }

  console.log("WhatsApp decisão enviado:", cleanNumber);

  return responseText;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();

    const {
      protocol,
      public_token,
      professor_nome,
      professor_telefone,
      status,
      parecer,
    } = body;

    if (!protocol || !public_token) {
      return new Response(
        JSON.stringify({
          error: "Dados obrigatórios ausentes",
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    if (!professor_telefone) {
      return new Response(
        JSON.stringify({
          ok: false,
          warning: "Professor sem telefone",
        }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    const consultaUrl = `${APP_URL}/cde/consulta/${public_token}`;

    let statusLabel = "Em análise";

    if (status === "deferido") {
      statusLabel = "DEFERIDO ✅";
    }

    if (status === "indeferido") {
      statusLabel = "INDEFERIDO ❌";
    }

    await sendWhatsApp(
      professor_telefone,
      `📢 *Atualização do recurso CDE*

Olá, ${professor_nome || "professor(a)"}.

Seu recurso recebeu uma atualização.

📌 *Protocolo:*
${protocol}

📄 *Status:*
${statusLabel}

📝 *Parecer da comissão:*
${parecer || "-"}

🔎 *Acompanhar recurso:*
${consultaUrl}

Comissão Disciplinar Especial — JER`,
    );

    return new Response(
      JSON.stringify({
        ok: true,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  } catch (err) {
    console.error(err);

    return new Response(
      JSON.stringify({
        error:
          err instanceof Error
            ? err.message
            : "Erro desconhecido",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }
});
