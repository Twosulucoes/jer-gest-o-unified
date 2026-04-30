import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verify user identity and get profile for logging/validation
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      console.error("User verification failed:", userError);
      return new Response(JSON.stringify({ error: "Invalid user token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { event_id, prompt_type = "full_report", stream = false, template_id } = await req.json();

    if (!event_id) {
      throw new Error("event_id is required");
    }

    // 1. Fetch Core Data, Template and User Roles
    const [
      { data: registers }, 
      { data: evidences }, 
      { data: event, error: eventError },
      { count: totalParticipants },
      { data: template },
      { data: userRoles }
    ] = await Promise.all([
      supabaseClient.from("osc_registros").select("*").eq("event_id", event_id),
      supabaseClient.from("operational_evidence").select("*").eq("event_id", event_id).eq("status", "approved"),
      supabaseClient.from("events").select("*").eq("id", event_id).single(),
      supabaseClient.from("participants").select("*", { count: 'exact', head: true }).eq("event_id", event_id),
      template_id 
        ? supabaseClient.from("osc_accountability_templates").select("*").eq("id", template_id).single()
        : supabaseClient.from("osc_accountability_templates").select("*").eq("is_default", true).maybeSingle(),
      supabaseClient.from("user_roles").select("role").eq("user_id", user.id)
    ]);

    if (eventError || !event) {
      console.error(`Access denied or event not found for user ${user.id} and event ${event_id}:`, eventError);
      return new Response(JSON.stringify({ error: "Acesso negado: você não tem permissão para visualizar este evento ou ele não existe." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Optional: Strict role check if needed
    const roles = userRoles?.map(r => r.role) || [];
    const isAdmin = roles.includes('admin') || roles.includes('super_admin');
    
    // If we want to restrict this specifically to admins or certain roles
    // if (!isAdmin) { ... }

    // 2. Fetch match summary separately
    const { data: matches } = await supabaseClient
      .from("competition_matches")
      .select("status")
      .eq("event_id", event_id);

    const matchStats = {
      total: matches?.length || 0,
      completed: matches?.filter((m: any) => m.status === 'completed' || m.status === 'finished' || m.status === 'publicado').length || 0
    };

    // 3. Prepare AI Prompt with mandatory summary section
    const context = {
      event_name: event?.name,
      total_participants: totalParticipants || 0,
      registers: registers?.map(r => ({ type: r.type, value: `${r.value_numeric} ${r.unit}`, desc: r.description })),
      evidence_summary: evidences?.reduce((acc: any, e: any) => {
        acc[e.osc_category] = (acc[e.osc_category] || 0) + 1;
        return acc;
      }, {}),
      matches: matchStats
    };

    const systemPrompt = "Você é um assistente especializado em gestão de projetos sociais e prestação de contas de OSCs (Organizações da Sociedade Civil) no Brasil. Seu objetivo é redigir relatórios técnicos, formais e persuasivos sobre a execução física de convênios esportivos.";
    
    let userPrompt = "";
    if (prompt_type === "full_report") {
      userPrompt = `Gere um rascunho detalhado de relatório de prestação de contas para o evento "${context.event_name}".
      
      CONTEXTO DA EXECUÇÃO:
      - Público Atendido: ${context.total_participants} participantes inscritos.
      - Execução Esportiva: ${context.matches.completed} partidas realizadas de um total de ${context.matches.total}.
      - Registros Operacionais (Lançamentos): ${JSON.stringify(context.registers)}
      - Evidências Fotográficas (Curadoria): ${JSON.stringify(context.evidence_summary)}
      
      REGRAS OBRIGATÓRIAS DE FORMATAÇÃO:
      1. Use Markdown.
      2. Comece com uma seção chamada "## TABELA RESUMO DE INDICADORES" contendo uma tabela Markdown com os principais números (Participantes, Partidas, Fotos por Categoria, Registros Operacionais).
      3. Adicione uma seção "## DESTAQUES DA EXECUÇÃO" com bullet points das métricas mais relevantes.
      4. Depois, siga com a estrutura narrativa.

      ${template?.prompt_structure || `ESTRUTURA NARRATIVA DO RELATÓRIO:
      1. INTRODUÇÃO: Contextualize o evento e a importância social.
      2. METAS ATINGIDAS: Relacione os números (participantes e partidas) com o sucesso do convênio.
      3. EXECUÇÃO OPERACIONAL: Descreva como os recursos foram aplicados (refeições extras, doações, logística) baseando-se nos registros fornecidos.
      4. EVIDÊNCIAS FÍSICAS: Comente sobre a conformidade das fotos em categorias como infraestrutura e atendimento.
      5. CONCLUSÃO: Parecer sobre a plena execução do objeto pactuado.`}
      
      Use uma linguagem extremamente profissional, adequada para órgãos governamentais.`;
    }

    // 4. Call Lovable AI Gateway
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.0-flash-exp",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.7,
        stream: stream,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`AI Gateway Error: ${errorData.error?.message || response.statusText}`);
    }

    if (stream) {
      return new Response(response.body, {
        headers: { 
          ...corsHeaders, 
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
    } else {
      const aiData = await response.json();
      const result = aiData.choices?.[0]?.message?.content || "Não foi possível gerar o relatório.";
      return new Response(JSON.stringify({ result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

  } catch (error) {
    console.error("Function error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
