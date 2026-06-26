import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const APP_URL = "https://adm.jers.com.br";

const EVOLUTION_API_URL = "http://92.112.176.108:8081";

const EVOLUTION_API_KEY =
  "c435ab87-d3aa-47ee-8608-11e33a09322e";

const EVOLUTION_INSTANCE = "jer-cde";

const PRESIDENT_PHONE = "5595984135248";

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
    console.warn("Número vazio. Mensagem não enviada.");
    return null;
  }

  const res = await fetch(`${EVOLUTION_API_URL}/send/text`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: EVOLUTION_API_KEY,
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

  console.log("WhatsApp enviado:", cleanNumber);
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
      escola,
      municipio,
      modalidade,
      categoria,
      naipe,
      tipo_recurso,
    } = body;

    if (!protocol || !public_token) {
      return new Response(
        JSON.stringify({ error: "Dados obrigatórios ausentes" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const consultaUrl = `${APP_URL}/cde/consulta/${public_token}`;
    const adminUrl = `${APP_URL}/admin/cde`;

    const erros: string[] = [];

    if (professor_telefone) {
      try {
        await sendWhatsApp(
          professor_telefone,
          `📄 *Recurso protocolado - CDE*

Olá, ${professor_nome || "professor(a)"}.

Seu recurso foi registrado com sucesso.

📌 *Protocolo:*
${protocol}

🏫 *Escola:*
${escola || "-"}

🏆 *Modalidade:*
${modalidade || "-"}

📂 *Categoria:*
${categoria || "-"}

👤 *Naipe:*
${naipe || "-"}

🔎 *Acompanhe pelo link:*
${consultaUrl}

Comissão Disciplinar Especial — JER`,
        );
      } catch (e) {
        erros.push(
          `Professor: ${e instanceof Error ? e.message : "erro desconhecido"}`,
        );
      }
    }

    try {
      await sendWhatsApp(
        PRESIDENT_PHONE,
        `🚨 *Novo recurso CDE recebido*

📌 *Protocolo:*
${protocol}

👨‍🏫 *Professor:*
${professor_nome || "-"}

🏫 *Escola:*
${escola || "-"}

📍 *Município:*
${municipio || "-"}

🏆 *Modalidade:*
${modalidade || "-"}

📂 *Categoria:*
${categoria || "-"}

👤 *Naipe:*
${naipe || "-"}

⚠️ *Tipo:*
${tipo_recurso || "-"}

🔗 *Abrir painel:*
${adminUrl}`,
      );
    } catch (e) {
      erros.push(
        `Presidente: ${e instanceof Error ? e.message : "erro desconhecido"}`,
      );
    }

    return new Response(
      JSON.stringify({
        ok: erros.length === 0,
        warnings: erros,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error(err);

    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Erro desconhecido",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
