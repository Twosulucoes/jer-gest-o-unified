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
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { event_id, prompt_type = "full_report" } = await req.json();

    if (!event_id) {
      throw new Error("event_id is required");
    }

    // 1. Fetch Core Data
    const [
      { data: registers }, 
      { data: evidences }, 
      { data: event },
      { count: totalParticipants }
    ] = await Promise.all([
      supabaseClient.from("osc_registros").select("*").eq("event_id", event_id),
      supabaseClient.from("operational_evidence").select("*").eq("event_id", event_id).eq("status", "approved"),
      supabaseClient.from("events").select("*").eq("id", event_id).single(),
      supabaseClient.from("participants").select("*", { count: 'exact', head: true }).eq("event_id", event_id)
    ]);

    // 2. Fetch match summary separately to avoid large joins
    const { data: matches } = await supabaseClient
      .from("competition_matches")
      .select("status")
      .eq("event_id", event_id);

    const matchStats = {
      total: matches?.length || 0,
      completed: matches?.filter((m: any) => m.status === 'completed' || m.status === 'finished' || m.status === 'publicado').length || 0
    };

    // 3. Prepare AI Prompt
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
      
      ESTRUTURA DO RELATÓRIO:
      1. INTRODUÇÃO: Contextualize o evento e a importância social.
      2. METAS ATINGIDAS: Relacione os números (participantes e partidas) com o sucesso do convênio.
      3. EXECUÇÃO OPERACIONAL: Descreva como os recursos foram aplicados (refeições extras, doações, logística) baseando-se nos registros fornecidos.
      4. EVIDÊNCIAS FÍSICAS: Comente sobre a conformidade das fotos em categorias como infraestrutura e atendimento.
      5. CONCLUSÃO: Parecer sobre a plena execução do objeto pactuado.
      
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
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.7,
      }),
    });

    const aiData = await response.json();
    if (aiData.error) {
      throw new Error(`AI Gateway Error: ${aiData.error.message}`);
    }
    const result = aiData.choices?.[0]?.message?.content || "Não foi possível gerar o relatório.";

    return new Response(JSON.stringify({ result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Function error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
