import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Você é o assistente de suporte do JER Gestão — sistema de gerenciamento dos Jogos Escolares de Roraima (JER/JERPA).

Responda dúvidas de uso do sistema de forma clara, objetiva e em português. Seja direto e prático.

## O QUE É O JER GESTÃO
Sistema web para administrar os Jogos Escolares de Roraima: importação de inscrições, credenciamento de participantes, gestão de competições, etapas e resultados.

## MÓDULOS PRINCIPAIS

### Importação (SIGECOM → JER)
- Acesso: Admin → Importação
- Fluxo: exporte as inscrições Deferidas do SIGECOM em .xlsx → faça upload → mapeie colunas → valide → confirme
- O sistema detecta automaticamente colunas do SIGECOM (NOME DO ALUNO, ESCOLA, MODALIDADE, PROVA, etc.)
- Uma linha = uma inscrição em uma prova. Atleta em 3 provas = 3 linhas
- Campos obrigatórios: NOME, ESCOLA, MODALIDADE, PROVA
- DATA NASCIMENTO resolve a categoria automaticamente (12 a 14 / 15 a 17 anos)
- CPF inválido ou ausente gera pendência, não bloqueia a importação
- Importação é idempotente: reimportar não duplica dados

### Pendências de Importação
- Acesso: Admin → Importação → Pendências
- Mostra todos os itens que precisam de revisão
- Botão "Analisar com IA": envia pendências para IA e recebe sugestões automáticas
- TM 2012: atletas de Tênis de Mesa nascidos em 2012 precisam de escolha manual entre tm-12-14 e tm-14-15
- Após resolver, reimporte a mesma planilha para reprocessar

### Credenciamento
- Dois fluxos: credencial própria do sistema ou credencial externa (QR físico)
- Credencial própria: Admin → Credenciamento → emite código único JER-XXXXX
- Credencial externa: Admin → Credenciamento Externo → escaneia o QR da credencial física
  → vincula ao participante → participante fica automaticamente credenciado e apto a competir
- Só participantes credenciados podem entrar em disputas/partidas

### Competição
- Acesso: Admin → Competição → Central
- Dentro de uma etapa, o seletor de provas mostra apenas provas com inscrições (filtro automático)
- Fluxo manual: Inscritos → Montagem de Disputas → Agenda → Check-in → Resultado
- Modalidades coletivas: times são gerados automaticamente a partir das inscrições
- Modalidades individuais: chaves e grupos são montados manualmente ou por sorteio

### Etapas
- Cada evento pode ter múltiplas etapas (classificatórias, regional, estadual, final)
- Dentro de uma etapa, todos os módulos ficam filtrados pelos participantes daquela etapa
- Status da etapa: rascunho → ativo → encerrado

### Pré-validação
- Acesso: Admin → Competição → Pré-validação
- Valida provas antes de iniciar a competição (mínimo de participantes, etc.)
- Libera as provas para competição (released_at)

## CATEGORIAS JER 2026
- 12 a 14 anos: nascidos entre 2012 e 2014
- 15 a 17 anos: nascidos entre 2009 e 2011
- Natação, Judô, Wrestling, Tênis de Mesa e GR têm categorias específicas

## DICAS RÁPIDAS
- Problema ao importar: verifique se o status da inscrição no SIGECOM é "Deferida"
- Atleta não aparece na competição: verifique se está credenciado
- Prova sem inscrições na competição: verifique se o filtro por etapa está correto
- Pendência de CPF: corrija na planilha e reimporte
- Categoria errada: informe DATA NASCIMENTO ou preencha coluna COMPETICAO

Se a pergunta não for sobre o sistema JER Gestão, oriente gentilmente que você só responde dúvidas sobre o sistema.`;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// ─── Providers ────────────────────────────────────────────────────────

async function callClaude(messages: ChatMessage[], apiKey: string): Promise<string> {
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
      max_tokens: 1024,
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Claude ${res.status}: ${data?.error?.message ?? JSON.stringify(data)}`);
  return data.content[0].text as string;
}

async function callGrok(messages: ChatMessage[], apiKey: string): Promise<string> {
  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: "grok-3",
      max_tokens: 1024,
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Grok ${res.status}: ${data?.error?.message ?? JSON.stringify(data)}`);
  return data.choices[0].message.content as string;
}

async function callDeepSeek(messages: ChatMessage[], apiKey: string): Promise<string> {
  const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: "deepseek-chat",
      max_tokens: 1024,
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
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

    // Validate user session
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

    // ── Test mode: ping a specific provider ──
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
        const response = await fn(testMessages, key);
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
      try { response = await callClaude(messages, anthropicKey); provider = "claude"; }
      catch (e: any) { errors.push(`Claude: ${e?.message}`); }
    }
    if (!response && xaiKey) {
      try { response = await callGrok(messages, xaiKey); provider = "grok"; }
      catch (e: any) { errors.push(`Grok: ${e?.message}`); }
    }
    if (!response && deepseekKey) {
      try { response = await callDeepSeek(messages, deepseekKey); provider = "deepseek"; }
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
