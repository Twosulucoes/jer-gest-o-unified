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

    // 1. Fetch data
    const [
      { data: registers }, 
      { data: evidences }, 
      { data: event },
      { data: matchSummary },
      { count: totalParticipants },
      { count: totalMeals }
    ] = await Promise.all([
      supabaseClient.from("osc_registros").select("*").eq("event_id", event_id),
      supabaseClient.from("operational_evidence").select("*").eq("event_id", event_id).eq("status", "approved"),
      supabaseClient.from("events").select("*").eq("id", event_id).single(),
      supabaseClient.from("competition_matches").select("status").eq("event_id", event_id),
      supabaseClient.from("participants").select("*", { count: 'exact', head: true }).eq("event_id", event_id),
      supabaseClient.from("meal_consumptions").select("id", { count: 'exact', head: true }).eq("event_id", event_id) // This might not work if meal_consumptions doesn't have event_id, but usually it does or is linked. 
    ]);

    // Prepare match stats
    const totalMatches = matchSummary?.length || 0;
    const completedMatches = matchSummary?.filter((m: any) => m.status === 'completed' || m.status === 'finished').length || 0;

    // 3. Prepare AI Prompt
    const context = {
      event_name: event?.name,
      total_participants: totalParticipants || 0,
      total_meals: totalMeals || 0,
      registers: registers?.map(r => ({ type: r.type, value: `${r.value_numeric} ${r.unit}`, desc: r.description })),
      evidence_summary: evidences?.reduce((acc: any, e: any) => {
        acc[e.osc_category] = (acc[e.osc_category] || 0) + 1;
        return acc;
      }, {}),
      matches: { total: totalMatches, completed: completedMatches }
    };

    const systemPrompt = "Você é um assistente especializado em gestão de projetos sociais e prestação de contas (OSC). Seu objetivo é transformar dados brutos de execução em relatórios narrativos profissionais, destacando o impacto social e a conformidade técnica.";
    
    let userPrompt = "";
    if (prompt_type === "full_report") {
      userPrompt = `Gere um rascunho de relatório de prestação de contas para o evento "${context.event_name}".
      Dados disponíveis:
      - Registros Operacionais: ${JSON.stringify(context.registers)}
      - Evidências Fotográficas por Categoria: ${JSON.stringify(context.evidence_summary)}
      - Estatísticas de Partidas: ${JSON.stringify(context.match_stats)}
      
      O relatório deve ter:
      1. Resumo Executivo.
      2. Descrição das Atividades Realizadas.
      3. Análise Quantitativa (impacto dos números).
      4. Conclusão sobre a conformidade do convênio.
      Use uma linguagem formal e técnica.`;
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
    const result = aiData.choices?.[0]?.message?.content || "Não foi possível gerar o relatório.";

    return new Response(JSON.stringify({ result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
