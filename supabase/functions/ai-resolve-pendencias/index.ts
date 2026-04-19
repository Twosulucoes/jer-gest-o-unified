import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Compact static catalog embedded in the system prompt (cache candidate)
const CATALOG_CONTEXT = `
MODALIDADES JER 2026:
Coletivos: basquete (Basquetebol), futsal (Futsal), futebol (Futebol de campo), volei (Voleibol), handebol (Handebol), volei-de-praia (Vôlei de Praia)
Combate: judo (Judô), karate (Karatê), taekwondo (Taekwondo), wrestling (Wrestling)
Tempo/Marca: atletismo (Atletismo), natacao (Natação), ciclismo (Ciclismo)
Técnicas: ginastica-ritmica (Ginástica Rítmica), xadrez (Xadrez), tenis-de-mesa (Tênis de Mesa), badminton (Badminton)
Paralímpicas: atletismo-paralimpico, natacao-paralimpica, bocha-paralimpica, tenis-de-mesa-paralimpico, parabadminton

CATEGORIAS JER 2026 (slug → nome → faixa de nascimento):
- jers-12-14: "12 a 14 anos" → nascidos 2012–2014 (maioria das modalidades)
- jers-15-17: "15 a 17 anos" → nascidos 2009–2011 (maioria das modalidades)
- nat-12-14: "Natação 12–14" → nascidos 2012–2014 (exclusivo Natação)
- nat-14-16: "Natação 14–16" → nascidos 2010–2012 (exclusivo Natação)
- nat-17: "Natação 17" → nascidos 2009 (exclusivo Natação)
- tm-12-14: "Tênis de Mesa 12–14" → nascidos 2012–2014
- tm-14-15: "Tênis de Mesa 14–15" → nascidos 2011–2012
- tm-16-17: "Tênis de Mesa 16–17" → nascidos 2009–2010
- judo-12-14: "Judô 12–14" → nascidos 2012–2014
- judo-15-16: "Judô 15–16" → nascidos 2010–2012
- wrestling-12-14: "Wrestling Infantil 12–14" → nascidos 2012–2014
- wrestling-14-16: "Wrestling Juvenil 14–16" → nascidos 2010–2012
- gr-12-13: "GR 12–13" → nascidos 2013–2014 (GR Feminino)
- gr-14-15: "GR 14–15" → nascidos 2011–2012 (GR Feminino)
- jerpa-11-14: "JERPA 11–14" → nascidos 2012–2015 (paralímpicas)
- jerpa-15-17: "JERPA 15–17" → nascidos 2009–2011 (paralímpicas)

CÓDIGOS DE PENDÊNCIA:
- SPORT_EVENT_NOT_FOUND: prova/modalidade não encontrada no catálogo
- SPORT_PARSE_FAILED: não foi possível identificar a modalidade no texto
- CATEGORY_PARSE_FAILED: categoria não identificada
- BIRTH_DATE_MISSING: data de nascimento ausente (necessária para resolver categoria)
- BIRTH_DATE_INVALID: data de nascimento com formato ou valor inválido
- CPF_INVALID: CPF com dígito verificador inválido
- CPF_MISSING: CPF ausente (pessoa pode não ser identificada univocamente)
- INSTITUTION_NOT_FOUND: escola/instituição não cadastrada
- PERSON_MATCH_AMBIGUOUS: mais de uma pessoa com mesmo nome+nascimento
- TM_2012_MANUAL_CATEGORY_SELECTION: Tênis de Mesa com nascidos em 2012 (ambíguo entre tm-12-14 e tm-14-15)
- MANUAL_REVIEW_REQUIRED: revisão manual genérica
`;

const SYSTEM_PROMPT = `Você é assistente especializado em resolver pendências de importação de dados esportivos para o JER (Jogos Escolares de Roraima) 2026.

${CATALOG_CONTEXT}

Sua tarefa: analisar cada pendência e retornar a melhor sugestão de resolução.

REGRAS IMPORTANTES:
1. Para TM_2012_MANUAL_CATEGORY_SELECTION: se o mês de nascimento for jan–jun 2012, prefira tm-14-15; jul–dez 2012, prefira tm-12-14. Se não houver mês disponível, use "low" confidence e sugira tm-12-14 como padrão.
2. Para CATEGORY_PARSE_FAILED com data de nascimento disponível: calcule o ano de nascimento e resolva pela faixa.
3. Para INSTITUTION_NOT_FOUND: sugira a instituição mais próxima da lista fornecida (fuzzy match).
4. Para SPORT_EVENT_NOT_FOUND: sugira o sport_event_id correto da lista fornecida, ou null se não houver compatível.
5. Para CPF_INVALID ou CPF_MISSING: sempre "fix_spreadsheet" — não há resolução automática.
6. Para BIRTH_DATE_MISSING: indique que é preciso adicionar a data na planilha.

Retorne APENAS um array JSON válido, sem texto extra, sem markdown. Um objeto por pendência:
[
  {
    "id": "uuid da pendência",
    "action": "set_category_slug" | "set_sport_event_id" | "tm_category" | "institution_match" | "fix_spreadsheet" | "dismiss",
    "value": "slug ou id (omitir quando não aplicável)",
    "hint": "instrução objetiva do que fazer — sempre presente",
    "confidence": "high" | "medium" | "low",
    "reasoning": "explicação curta em português"
  }
]`;

export interface AiSuggestion {
  id: string;
  action: "set_category_slug" | "set_sport_event_id" | "tm_category" | "institution_match" | "fix_spreadsheet" | "dismiss";
  value?: string;
  hint: string;
  confidence: "high" | "medium" | "low";
  reasoning: string;
}

// ─── Provider calls ───────────────────────────────────────────────────

async function callClaude(
  systemPrompt: string,
  dynamicContext: string,
  userMessage: string,
  apiKey: string,
): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "prompt-caching-2024-07-31",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: [
        { type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } },
        { type: "text", text: dynamicContext },
      ],
      messages: [{ role: "user", content: userMessage }],
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    const msg = data?.error?.message ?? JSON.stringify(data);
    throw new Error(`Claude ${res.status}: ${msg}`);
  }
  return data.content[0].text as string;
}

async function callGrok(
  systemPrompt: string,
  dynamicContext: string,
  userMessage: string,
  apiKey: string,
): Promise<string> {
  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "grok-3",
      max_tokens: 4096,
      messages: [
        { role: "system", content: `${systemPrompt}\n\n${dynamicContext}` },
        { role: "user", content: userMessage },
      ],
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    const msg = data?.error?.message ?? JSON.stringify(data);
    throw new Error(`Grok ${res.status}: ${msg}`);
  }
  return data.choices[0].message.content as string;
}

async function callDeepSeek(
  systemPrompt: string,
  dynamicContext: string,
  userMessage: string,
  apiKey: string,
): Promise<string> {
  const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      max_tokens: 4096,
      messages: [
        { role: "system", content: `${systemPrompt}\n\n${dynamicContext}` },
        { role: "user", content: userMessage },
      ],
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    const msg = data?.error?.message ?? JSON.stringify(data);
    throw new Error(`DeepSeek ${res.status}: ${msg}`);
  }
  return data.choices[0].message.content as string;
}

function parseAiJson(raw: string): AiSuggestion[] {
  const clean = raw.trim()
    .replace(/^```json?\s*/i, "")
    .replace(/\s*```$/, "");
  return JSON.parse(clean);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

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

    const { event_id, pending_ids } = await req.json() as {
      event_id: string;
      pending_ids?: string[];
    };

    if (!event_id) {
      return new Response(JSON.stringify({ error: "event_id obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch pending items (up to 50 at a time to stay within token limits)
    let q = client
      .from("import_pendencias")
      .select("id, source_row_number, normalized_name, raw_cpf, raw_birth_date, modality_raw, prova_raw, institution_raw, pending_reason_code, pending_reason_detail, resolution_status")
      .eq("event_id", event_id)
      .eq("resolution_status", "pending")
      .limit(50);
    if (pending_ids && pending_ids.length > 0) q = q.in("id", pending_ids);
    const { data: pendencies, error: pendErr } = await q;
    if (pendErr) throw pendErr;
    if (!pendencies || pendencies.length === 0) {
      return new Response(JSON.stringify({ suggestions: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch sport_events as dynamic context
    const { data: sportEvents } = await client
      .from("sport_events")
      .select("id, name, sport:sports(name), category:categories(name)")
      .eq("event_id", event_id)
      .eq("is_active", true)
      .limit(200);

    // Fetch known institutions
    const { data: delegations } = await client
      .from("delegations")
      .select("school_name")
      .eq("event_id", event_id)
      .limit(500);

    const sportEventsContext = (sportEvents ?? []).length > 0
      ? "Sport events cadastrados:\n" + (sportEvents ?? [])
          .map((se: any) => `  ${se.id} | "${se.name}" | ${se.sport?.name} | ${se.category?.name}`)
          .join("\n")
      : "Sport events: nenhum cadastrado ainda.";

    const institutionsContext = (delegations ?? []).length > 0
      ? "Escolas cadastradas: " + (delegations ?? []).map((d: any) => d.school_name).filter(Boolean).join(", ")
      : "Escolas: nenhuma cadastrada ainda.";

    // Compact pending items for prompt
    const pendingContext = (pendencies as any[]).map((p) => ({
      id: p.id,
      linha: p.source_row_number,
      nome: p.normalized_name,
      nascimento: p.raw_birth_date,
      modalidade_raw: p.modality_raw,
      prova_raw: p.prova_raw,
      escola_raw: p.institution_raw,
      cpf: p.raw_cpf,
      codigo: p.pending_reason_code,
      detalhe: p.pending_reason_detail,
    }));

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    const xaiKey = Deno.env.get("XAI_API_KEY");
    const deepseekKey = Deno.env.get("DEEPSEEK_API_KEY");

    if (!anthropicKey && !xaiKey && !deepseekKey) {
      return new Response(JSON.stringify({ error: "Nenhuma chave de IA configurada (ANTHROPIC_API_KEY, XAI_API_KEY ou DEEPSEEK_API_KEY)" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const dynamicContext = `${sportEventsContext}\n\n${institutionsContext}`;
    const userMessage = `Analise as seguintes pendências e retorne o array JSON de sugestões:\n${JSON.stringify(pendingContext, null, 2)}`;

    let rawText: string | null = null;
    let providerUsed: string = "none";
    const errors: string[] = [];

    // Tenta Claude primeiro (prompt caching ativo)
    if (anthropicKey) {
      try {
        rawText = await callClaude(SYSTEM_PROMPT, dynamicContext, userMessage, anthropicKey);
        providerUsed = "claude";
      } catch (e: any) {
        const msg = e?.message ?? String(e);
        errors.push(`Claude: ${msg}`);
        console.warn("Claude falhou, tentando Grok:", msg);
      }
    }

    // Fallback 2: Grok (xAI)
    if (rawText === null && xaiKey) {
      try {
        rawText = await callGrok(SYSTEM_PROMPT, dynamicContext, userMessage, xaiKey);
        providerUsed = "grok";
      } catch (e: any) {
        const msg = e?.message ?? String(e);
        errors.push(`Grok: ${msg}`);
        console.warn("Grok falhou, tentando DeepSeek:", msg);
      }
    }

    // Fallback 3: DeepSeek
    if (rawText === null && deepseekKey) {
      try {
        rawText = await callDeepSeek(SYSTEM_PROMPT, dynamicContext, userMessage, deepseekKey);
        providerUsed = "deepseek";
      } catch (e: any) {
        const msg = e?.message ?? String(e);
        errors.push(`DeepSeek: ${msg}`);
        console.error("DeepSeek também falhou:", msg);
      }
    }

    if (rawText === null) {
      return new Response(
        JSON.stringify({ error: "Todos os provedores de IA falharam", details: errors }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let suggestions: AiSuggestion[];
    try {
      suggestions = parseAiJson(rawText);
    } catch {
      throw new Error(`${providerUsed} retornou JSON inválido: ${rawText.substring(0, 300)}`);
    }

    return new Response(
      JSON.stringify({ suggestions, provider: providerUsed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("ai-resolve-pendencias error:", err);
    return new Response(
      JSON.stringify({ error: err?.message ?? String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
