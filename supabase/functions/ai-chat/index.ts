import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STRICT_RULES = `Você é o assistente oficial de suporte do JER's Gestão — sistema de gerenciamento dos Jogos Escolares de Roraima.

REGRAS ABSOLUTAS (não negociáveis):
1. Responda APENAS com base no MANUAL OFICIAL fornecido abaixo.
2. Se a resposta NÃO estiver claramente coberta pelo manual, responda exatamente:
   "Não encontrei essa informação no manual oficial. Por favor, abra um chamado com o time de TI."
3. NUNCA invente caminhos de menu, RPCs, regras ou comportamentos que não constam no manual.
4. Cite a SEÇÃO do manual ao responder (ex.: "Conforme a seção 3.5 — Credenciamento...").
5. Responda em português, de forma direta, prática e amigável.
6. Se a pergunta for fora do escopo do sistema, oriente que você responde apenas dúvidas sobre o JER's Gestão.

=== MANUAL OFICIAL ===
`;

const FALLBACK_MANUAL = `Manual ainda não cadastrado. Oriente o usuário a procurar o super administrador para preencher as seções do manual em /super/manual.`;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// ─── Build system prompt from DB manual ──────────────────────────────

async function buildSystemPrompt(client: any): Promise<string> {
  try {
    const { data, error } = await client
      .from("help_manual_sections")
      .select("category,title,content_md,sort_order")
      .eq("is_published", true)
      .order("category", { ascending: true })
      .order("sort_order", { ascending: true });

    if (error || !data || data.length === 0) {
      return STRICT_RULES + FALLBACK_MANUAL;
    }

    const grouped: Record<string, typeof data> = {};
    for (const row of data) {
      const cat = row.category ?? "Geral";
      (grouped[cat] ||= []).push(row);
    }

    let manual = "";
    for (const [cat, rows] of Object.entries(grouped)) {
      manual += `\n## ${cat}\n`;
      for (const r of rows) {
        manual += `\n### ${r.title}\n${r.content_md}\n`;
      }
    }
    return STRICT_RULES + manual + "\n=== FIM DO MANUAL ===";
  } catch {
    return STRICT_RULES + FALLBACK_MANUAL;
  }
}

// ─── Providers ────────────────────────────────────────────────────────

async function callClaude(messages: ChatMessage[], system: string, apiKey: string): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "prompt-caching-2024-07-31",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1024,
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Claude ${res.status}: ${data?.error?.message ?? JSON.stringify(data)}`);
  return data.content[0].text as string;
}

async function callGrok(messages: ChatMessage[], system: string, apiKey: string): Promise<string> {
  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: "grok-3",
      max_tokens: 1024,
      messages: [{ role: "system", content: system }, ...messages],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Grok ${res.status}: ${data?.error?.message ?? JSON.stringify(data)}`);
  return data.choices[0].message.content as string;
}

async function callDeepSeek(messages: ChatMessage[], system: string, apiKey: string): Promise<string> {
  const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: "deepseek-chat",
      max_tokens: 1024,
      messages: [{ role: "system", content: system }, ...messages],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`DeepSeek ${res.status}: ${data?.error?.message ?? JSON.stringify(data)}`);
  return data.choices[0].message.content as string;
}

// ─── Handler ──────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const client = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { error: authErr } = await client.auth.getUser();
    if (authErr) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json() as { messages: ChatMessage[]; test_provider?: string };

    const systemPrompt = await buildSystemPrompt(client);

    // ── Test mode ──
    if (body.test_provider) {
      const provider = body.test_provider;
      const testMessages: ChatMessage[] = [{ role: "user", content: 'Responda apenas: "OK"' }];
      const key = provider === "claude"
        ? Deno.env.get("ANTHROPIC_API_KEY")
        : provider === "grok"
        ? Deno.env.get("XAI_API_KEY")
        : Deno.env.get("DEEPSEEK_API_KEY");

      if (!key) {
        return new Response(JSON.stringify({ ok: false, provider, error: "Chave não configurada" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      try {
        const fn = provider === "claude" ? callClaude : provider === "grok" ? callGrok : callDeepSeek;
        const response = await fn(testMessages, systemPrompt, key);
        return new Response(JSON.stringify({ ok: true, provider, response }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (e: any) {
        return new Response(JSON.stringify({ ok: false, provider, error: e?.message ?? String(e) }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ── Normal chat ──
    const { messages } = body;
    if (!messages?.length) {
      return new Response(JSON.stringify({ error: "messages obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    const xaiKey = Deno.env.get("XAI_API_KEY");
    const deepseekKey = Deno.env.get("DEEPSEEK_API_KEY");

    if (!anthropicKey && !xaiKey && !deepseekKey) {
      return new Response(JSON.stringify({ error: "Nenhuma chave de IA configurada" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let response: string | null = null;
    let provider = "none";
    const errors: string[] = [];

    if (anthropicKey) {
      try { response = await callClaude(messages, systemPrompt, anthropicKey); provider = "claude"; }
      catch (e: any) { errors.push(`Claude: ${e?.message}`); }
    }
    if (!response && xaiKey) {
      try { response = await callGrok(messages, systemPrompt, xaiKey); provider = "grok"; }
      catch (e: any) { errors.push(`Grok: ${e?.message}`); }
    }
    if (!response && deepseekKey) {
      try { response = await callDeepSeek(messages, systemPrompt, deepseekKey); provider = "deepseek"; }
      catch (e: any) { errors.push(`DeepSeek: ${e?.message}`); }
    }

    if (!response) {
      return new Response(JSON.stringify({ error: "Todos os provedores falharam", details: errors }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ response, provider }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message ?? String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
