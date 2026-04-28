
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

    const { eventId, stageId, referenceDate, bulletinType, trigger } = await req.json();

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

    if (bulletinType === 'daily' && !stageId) {
      return new Response(JSON.stringify({ 
        code: "MISSING_STAGE_ID",
        field: "stageId",
        error: "Etapa não informada", 
        details: "Para boletins diários, a seleção da etapa é obrigatória." 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Fetch Event and Branding
    const { data: event } = await adminClient.from("events").select("name").eq("id", eventId).single();
    const { data: branding } = await adminClient.from("event_branding").select("*").eq("event_id", eventId).maybeSingle();
    const { data: stage } = stageId ? await adminClient.from("event_stages").select("name").eq("id", stageId).single() : { data: null };

    // 2. Fetch Results
    let matches = [];
    const query = adminClient
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
        competition_match_results(score, position, result_status, result_text, match_entry_id),
        competition_match_entries(id, side, team_id, teams(name, delegations(school_name)), participant_sport_events(participants(full_name, delegations(school_name))))
      `)
      .eq("event_id", eventId)
      .eq("competition_match_results.result_status", "publicado");

    if (bulletinType === 'daily') {
      if (stageId) query.eq("stage_id", stageId);
      if (referenceDate) query.eq("match_date", referenceDate);
    }
    
    const { data: matchesRaw, error: queryErr } = await query;
    if (queryErr) throw queryErr;
    matches = matchesRaw || [];
    
    if (matches.length === 0) {
      return new Response(JSON.stringify({ 
        code: "NO_RESULTS_FOUND",
        field: "matches",
        error: "Nenhum resultado publicado foi encontrado para os filtros selecionados.",
        details: "O boletim só pode ser gerado para resultados com status 'publicado'. Certifique-se de validar e publicar os resultados na Central de Resultados antes de tentar novamente."
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Generate PDF with jsPDF
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 20;

    // Header
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    const title = branding?.nome_oficial || event?.name || "Boletim Oficial";
    doc.text(title, pageWidth / 2, y, { align: "center" });
    y += 10;

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    const subTitle = bulletinType === 'daily' 
      ? `Boletim do Dia - Etapa: ${stage?.name || 'Geral'} - Data: ${referenceDate}` 
      : "Boletim Final Oficial";
    doc.text(subTitle, pageWidth / 2, y, { align: "center" });
    y += 15;

    // Summary
    doc.setFontSize(10);
    doc.text(`Total de resultados publicados: ${matches.length}`, 20, y);
    y += 10;

    // Modalidades
    const matchesBySport = matches.reduce((acc, m) => {
      const sportName = m.sport_events?.sports?.name || "Outros";
      if (!acc[sportName]) acc[sportName] = [];
      acc[sportName].push(m);
      return acc;
    }, {});

    for (const [sportName, sportMatches] of Object.entries(matchesBySport)) {
      if (y > 250) { doc.addPage(); y = 20; }
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(sportName, 20, y);
      y += 5;

      const tableData = sportMatches.map(m => {
        const entries = m.competition_match_entries || [];
        const results = m.competition_match_results || [];
        const sideA = entries.find(e => e.side === 'side_a') || entries[0];
        const sideB = entries.find(e => e.side === 'side_b') || entries[1];
        
        const nameA = sideA?.teams?.name || sideA?.participant_sport_events?.participants?.full_name || "—";
        const nameB = sideB?.teams?.name || sideB?.participant_sport_events?.participants?.full_name || "—";
        
        const resA = results.find(r => r.match_entry_id === sideA?.id);
        const resB = results.find(r => r.match_entry_id === sideB?.id);
        
        const score = `${resA?.score || '—'} x ${resB?.score || '—'}`;
        
        return [
          m.match_number || "—",
          m.sport_events?.categories?.name || "—",
          nameA,
          score,
          nameB,
          m.match_date || "—"
        ];
      });

      (doc as any).autoTable({
        startY: y,
        head: [['#', 'Categoria', 'Lado A', 'Placar', 'Lado B', 'Data']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [41, 128, 185] },
        styles: { fontSize: 8 }
      });

      y = (doc as any).lastAutoTable.finalY + 10;
    }

    // Medal Table for Final Bulletin
    if (bulletinType === 'final') {
      doc.addPage();
      y = 20;
      doc.setFontSize(14);
      doc.text("Quadro de Medalhas", 20, y);
      y += 10;

      // Simple medal calc (can be improved)
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
        headStyles: { fillColor: [243, 156, 18] },
        styles: { fontSize: 9 }
      });
    }

    const pdfBase64 = doc.output('arraybuffer');
    
    // 4. Storage & DB
    const fileName = `${bulletinType}_${eventId}_${stageId || 'global'}_v${Date.now()}.pdf`;
    const filePath = `${eventId}/${stageId || 'global'}/${bulletinType}/${fileName}`;

    const { error: uploadError } = await adminClient.storage
      .from("bulletins")
      .upload(filePath, pdfBase64, {
        contentType: "application/pdf",
        upsert: true
      });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = adminClient.storage.from("bulletins").getPublicUrl(filePath);

    // Update versions
    await adminClient
      .from("bulletin_documents")
      .update({ is_current: false })
      .eq("event_id", eventId)
      .eq("bulletin_type", bulletinType)
      .eq("stage_id", stageId || null)
      .eq("reference_date", referenceDate || null);

    const { data: bulletinDoc } = await adminClient
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
        summary: { match_count: matches.length }
      })
      .select()
      .single();

    // Register as Evidence OSC (PASSO 7)
    await adminClient.from("operational_evidence").insert({
      event_id: eventId,
      module: 'competicao',
      evidence_type: 'bulletin',
      reference_table: 'bulletin_documents',
      reference_id: bulletinDoc.id,
      status: 'approved',
      file_url: publicUrl,
      file_name: fileName
    });

    return new Response(JSON.stringify({ success: true, bulletin: bulletinDoc }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("Error generating bulletin:", err);
    return new Response(JSON.stringify({ 
      code: "INTERNAL_ERROR",
      error: err.message || "Erro interno ao gerar boletim",
      details: "Se o problema persistir, verifique as permissões de storage ou entre em contato com o suporte."
    }), {
      status: err.status || 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
