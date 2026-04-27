
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

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

    if (!eventId || !bulletinType) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Generating ${bulletinType} bulletin for event ${eventId}...`);

    // 1. Fetch Event and Branding
    const { data: event } = await adminClient.from("events").select("*").eq("id", eventId).single();
    
    // 2. Fetch Results
    let matches = [];
    if (bulletinType === 'daily') {
      const { data } = await adminClient
        .from("competition_matches")
        .select(`
          id, match_number, match_date, start_time, status, sport_event_id,
          sport_events(name, sport_id, category_id, sports(name), categories(name, gender_scope)),
          competition_match_results(score, position, result_status, result_text, match_entry_id),
          competition_match_entries(id, side, display_name:teams(name))
        `)
        .eq("event_id", eventId)
        .eq("stage_id", stageId)
        .eq("match_date", referenceDate)
        .eq("competition_match_results.result_status", "publicado");
      matches = data || [];
    } else {
      // Final bulletin logic
      const { data } = await adminClient
        .from("competition_matches")
        .select(`
          id, match_number, match_date, start_time, status, sport_event_id,
          sport_events(name, sport_id, category_id, sports(name), categories(name, gender_scope)),
          competition_match_results(score, position, result_status, result_text, match_entry_id),
          competition_match_entries(id, side, display_name:teams(name))
        `)
        .eq("event_id", eventId)
        .eq("competition_match_results.result_status", "publicado");
      matches = data || [];
    }

    // 3. Generate "PDF" (For now, we just record the generation and save a placeholder)
    // Real PDF generation with jspdf in Deno can be added here.
    // Given the complexity of institutional layout, I'll focus on the data structure first.
    
    const fileName = `${bulletinType}_${eventId}_${stageId || 'global'}_${referenceDate || 'final'}_v${Date.now()}.pdf`;
    const filePath = `${eventId}/${stageId || 'global'}/${bulletinType}/${fileName}`;
    
    // Placeholder content
    const pdfContent = new TextEncoder().encode("PDF Placeholder - Implement real generation with jspdf");

    const { error: uploadError } = await adminClient.storage
      .from("bulletins")
      .upload(filePath, pdfContent, {
        contentType: "application/pdf",
        upsert: true
      });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = adminClient.storage.from("bulletins").getPublicUrl(filePath);

    // 4. Update bulletin_documents
    // First, set is_current = false for existing ones of same type/scope
    await adminClient
      .from("bulletin_documents")
      .update({ is_current: false })
      .eq("event_id", eventId)
      .eq("bulletin_type", bulletinType)
      .eq("stage_id", stageId || null)
      .eq("reference_date", referenceDate || null);

    const { data: bulletinDoc, error: insertError } = await adminClient
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

    if (insertError) throw insertError;

    // 5. Log success
    await adminClient.from("bulletin_generation_logs").insert({
      event_id: eventId,
      stage_id: stageId || null,
      bulletin_type: bulletinType,
      status: "success",
      metadata: { bulletin_id: bulletinDoc.id }
    });

    return new Response(JSON.stringify({ success: true, bulletin: bulletinDoc }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
