import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { jsPDF } from "https://esm.sh/jspdf@2.5.1";
import "https://esm.sh/jspdf-autotable@3.8.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { eventId, stageId, referenceDate, bulletinType, trigger, bulletinTitle } = await req.json();

    if (!eventId) {
      return new Response(JSON.stringify({ 
        code: "MISSING_EVENT_ID",
        field: "eventId",
        error: "Evento não informado", 
        details: "O ID do evento é obrigatório para gerar o boletim." 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!bulletinType || !['daily', 'final'].includes(bulletinType)) {
      return new Response(JSON.stringify({ 
        code: "INVALID_BULLETIN_TYPE",
        field: "bulletinType",
        error: "Tipo de boletim inválido", 
        details: "O tipo de boletim deve ser 'daily' ou 'final'." 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Fetch Event and Branding
    const { data: event } = await adminClient.from("events").select("name").eq("id", eventId).single();
    const { data: branding } = await adminClient.from("event_branding").select("*").eq("event_id", eventId).maybeSingle();
    const { data: stage } = stageId ? await adminClient.from("event_stages").select("name, stage_code").eq("id", stageId).single() : { data: null };

    // 2. Homologation Check
    // Verificamos se há partidas pendentes de homologação no escopo
    let checkQuery = adminClient
      .from("competition_matches")
      .select(`
        id, 
        match_number,
        competition_match_results(result_status)
      `)
      .eq("event_id", eventId);

    if (bulletinType === 'daily') {
      if (stageId) checkQuery.eq("event_stage_id", stageId);
      if (referenceDate) checkQuery.eq("match_date", referenceDate);
    } else {
      if (stageId) checkQuery.eq("event_stage_id", stageId);
    }

    const { data: scopeMatches } = await checkQuery;
    const pendingMatches = (scopeMatches || []).filter(m => {
      const results = m.competition_match_results || [];
      if (results.length === 0) return true; // Sem resultados = pendente
      return results.some(r => r.result_status !== 'publicado' && r.result_status !== 'resultado_validado');
    });

    // Se houver partidas não homologadas nem publicadas, barramos a publicação
    // Mas se o trigger for 'manual' e for apenas pré-visualização, permitimos?
    // O requisito diz que publicação é travada.
    const isOfficial = trigger === 'publish' || trigger === 'manual'; 

    if (isOfficial && pendingMatches.length > 0) {
      return new Response(JSON.stringify({ 
        code: "PENDING_HOMOLOGATION",
        error: "Partidas pendentes de homologação", 
        details: `Existem ${pendingMatches.length} partidas no escopo deste boletim que ainda não foram homologadas pela coordenação técnica.`,
        pending_match_ids: pendingMatches.map(m => m.id)
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Generate Automatic Code
    const { data: nextCode } = await adminClient.rpc('get_next_bulletin_number', {
      p_event_id: eventId,
      p_stage_id: stageId || null,
      p_type: bulletinType
    });

    // 4. Fetch Results for PDF
    let query = adminClient
      .from("competition_matches")
      .select(`
        id, match_number, match_date, start_time, status, sport_event_id,
        sport_events(
          name, 
          sport_id, 
          category_id, 
          sports(name), 
          categories(name, gender_scope),
          sport_event_rules(rules)
        ),
        competition_match_results(score, position, result_status, result_text, match_entry_id, outcome),
        competition_match_entries(id, side, team_id, teams(name, delegations(school_name)), participant_sport_events(participants(full_name, delegations(school_name))))
      `)
      .eq("event_id", eventId);

    if (bulletinType === 'daily') {
      if (stageId) query.eq("event_stage_id", stageId);
      if (referenceDate) query.eq("match_date", referenceDate);
    } else {
      if (stageId) query.eq("event_stage_id", stageId);
    }
    
    const { data: matchesRaw, error: queryErr } = await query;
    if (queryErr) throw queryErr;
    const matches = matchesRaw || [];

    // 5. Generate Professional PDF
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let y = 20;

    // Header Institutional
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text("JOGOS ESCOLARES DE RORAIMA - JER", 20, y);
    doc.text(new Date().toLocaleString('pt-BR'), pageWidth - 60, y);
    y += 10;

    doc.setFontSize(22);
    doc.setTextColor(0);
    doc.setFont("helvetica", "bold");
    doc.text(nextCode, 20, y);
    y += 10;

    doc.setFontSize(16);
    const title = bulletinTitle || branding?.nome_oficial || event?.name || "Boletim Oficial";
    doc.text(title, 20, y);
    y += 8;

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    const subTitle = bulletinType === 'daily' 
      ? `Boletim Diário - Etapa: ${stage?.name || 'Geral'} - Referência: ${referenceDate ? new Date(referenceDate + 'T12:00:00').toLocaleDateString('pt-BR') : 'Geral'}` 
      : `Boletim Final Consolidado - Etapa: ${stage?.name || 'Geral'}`;
    doc.text(subTitle, 20, y);
    y += 15;

    // Executive Summary
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("RESUMO EXECUTIVO", 20, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    const summaryText = bulletinType === 'daily'
      ? `Este boletim apresenta os resultados oficiais das competições realizadas em ${referenceDate}. Total de partidas cobertas: ${matches.length}.`
      : `Este boletim consolida os resultados finais e o quadro de medalhas oficial da etapa ${stage?.name || event?.name}.`;
    const splitSummary = doc.splitTextToSize(summaryText, pageWidth - 40);
    doc.text(splitSummary, 20, y);
    y += (splitSummary.length * 5) + 10;

    // Results by Modality
    const matchesBySport = matches.reduce((acc, m) => {
      const sportName = m.sport_events?.sports?.name || "Outras Modalidades";
      if (!acc[sportName]) acc[sportName] = [];
      acc[sportName].push(m);
      return acc;
    }, {});

    for (const [sportName, sportMatches] of Object.entries(matchesBySport)) {
      if (y > 240) { doc.addPage(); y = 20; }
      
      doc.setFillColor(240, 240, 240);
      doc.rect(20, y, pageWidth - 40, 8, 'F');
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(40, 40, 40);
      doc.text(sportName.toUpperCase(), 25, y + 6);
      y += 12;

      const tableData = (sportMatches as any[]).map(m => {
        const entries = m.competition_match_entries || [];
        const results = m.competition_match_results || [];
        const sideA = entries.find(e => e.side === 'side_a') || entries[0];
        const sideB = entries.find(e => e.side === 'side_b') || entries[1];
        
        const nameA = sideA?.teams?.name || sideA?.participant_sport_events?.participants?.full_name || "—";
        const nameB = sideB?.teams?.name || sideB?.participant_sport_events?.participants?.full_name || "—";
        
        const resA = results.find(r => r.match_entry_id === sideA?.id);
        const resB = results.find(r => r.match_entry_id === sideB?.id);
        
        let score = "—";
        if (resA || resB) {
          score = `${resA?.score || '0'} x ${resB?.score || '0'}`;
          if (resA?.outcome === 'win' || resB?.outcome === 'win') {
             score += (resA?.outcome === 'win' ? ` (Vence ${nameA})` : ` (Vence ${nameB})`);
          }
        }
        
        return [
          m.start_time ? m.start_time.substring(0, 5) : "—",
          m.sport_events?.categories?.name || "—",
          nameA,
          score,
          nameB,
          m.status === 'completed' ? 'Finalizado' : 'Agendado'
        ];
      });

      (doc as any).autoTable({
        startY: y,
        head: [['Hora', 'Categoria', 'Lado A', 'Placar/Resultado', 'Lado B', 'Status']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [50, 50, 50], textColor: [255, 255, 255] },
        styles: { fontSize: 8 },
        margin: { left: 20, right: 20 }
      });

      y = (doc as any).lastAutoTable.finalY + 15;
    }

    // Medal Table (Final)
    if (bulletinType === 'final') {
      if (y > 200) { doc.addPage(); y = 20; }
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("QUADRO DE MEDALHAS OFICIAL DA ETAPA", 20, y);
      y += 8;

      const medals = matches.reduce((acc, m) => {
        m.competition_match_results?.forEach(r => {
          if (r.position && r.position <= 3) {
            const entry = m.competition_match_entries?.find(e => e.id === r.match_entry_id);
            const deleg = entry?.teams?.delegations?.school_name || entry?.participant_sport_events?.participants?.delegations?.school_name || "Outros";
            if (!acc[deleg]) acc[deleg] = { gold: 0, silver: 0, bronze: 0 };
            if (r.position === 1) acc[deleg].gold++;
            if (r.position === 2) acc[deleg].silver++;
            if (r.position === 3) acc[deleg].bronze++;
          }
        });
        return acc;
      }, {});

      const sortedMedals = Object.entries(medals)
        .map(([name, m]: any) => ({ name, ...m, total: m.gold + m.silver + m.bronze }))
        .sort((a, b) => b.gold - a.gold || b.silver - a.silver || b.bronze - a.bronze || a.name.localeCompare(b.name));

      (doc as any).autoTable({
        startY: y,
        head: [['Pos', 'Delegação', 'Ouro', 'Prata', 'Bronze', 'Total']],
        body: sortedMedals.map((m, i) => [i + 1, m.name, m.gold, m.silver, m.bronze, m.total]),
        theme: 'grid',
        headStyles: { fillColor: [218, 165, 32] },
        styles: { fontSize: 9 },
        margin: { left: 20, right: 20 }
      });
      y = (doc as any).lastAutoTable.finalY + 20;
    }

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(150);
    const footerText = "Este é um documento oficial do sistema JER Gestão. A validade deste boletim pode ser verificada em jers.com.br.";
    doc.text(footerText, pageWidth / 2, pageHeight - 15, { align: "center" });

    const pdfBuffer = doc.output('arraybuffer');
    
    // 6. Save and Register
    const fileName = `${nextCode}_v${Date.now()}.pdf`;
    const filePath = `${eventId}/official_bulletins/${fileName}`;

    const { error: uploadError } = await adminClient.storage
      .from("bulletins")
      .upload(filePath, pdfBuffer, {
        contentType: "application/pdf",
        upsert: true
      });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = adminClient.storage.from("bulletins").getPublicUrl(filePath);

    // Create the official bulletin record
    const { data: bulletinObj, error: insErr } = await adminClient
      .from("official_bulletins")
      .insert({
        event_id: eventId,
        stage_id: stageId || null,
        bulletin_code: nextCode,
        type: bulletinType,
        title: bulletinTitle || (bulletinType === 'daily' ? `Boletim Diário ${referenceDate}` : `Boletim Final ${stage?.name || ''}`),
        published_at: new Date().toISOString(),
        pdf_url: publicUrl,
        status: 'publicado'
      })
      .select()
      .single();

    if (insErr) throw insErr;

    // Update all results in scope to 'publicado' and link to this bulletin
    const updateResultIds = matches.flatMap(m => m.competition_match_results?.map(r => r.id) || []);
    if (updateResultIds.length > 0) {
      await adminClient
        .from("competition_match_results")
        .update({ 
          result_status: 'publicado',
          published_bulletin_id: bulletinObj.id 
        })
        .in("id", updateResultIds);
    }

    // Legacy support for bulletin_documents (non-regressão)
    await adminClient
      .from("bulletin_documents")
      .insert({
        event_id: eventId,
        stage_id: stageId || null,
        bulletin_type: bulletinType,
        reference_date: referenceDate || null,
        file_url: publicUrl,
        file_name: fileName,
        generation_trigger: trigger || 'manual',
        is_current: true,
        summary: { match_count: matches.length, bulletin_code: nextCode }
      });

    return new Response(JSON.stringify({ 
      success: true, 
      bulletin_code: nextCode,
      bulletin_id: bulletinObj.id,
      pdf_url: publicUrl 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("Error generating bulletin:", err);
    return new Response(JSON.stringify({ 
      code: err.code || "INTERNAL_ERROR",
      error: err.message || "Erro interno ao gerar boletim",
      details: err.details || ""
    }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
