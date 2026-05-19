import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const db = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const {
      phone_suffix,
      event_id,
      stage_id,
      sport_event_id,
      participant_out_id,
      participant_in_id,
      reason_code,
      reason,
      contact_email,
      doc_paths = {},
    } = body;

    // ── Validação básica ──────────────────────────────────────────────────
    if (!phone_suffix || !event_id || !stage_id || !sport_event_id ||
        !participant_out_id || !participant_in_id || !contact_email) {
      return json({ error: "Campos obrigatórios faltando." }, 400);
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact_email)) {
      return json({ error: "E-mail inválido." }, 400);
    }
    if (participant_out_id === participant_in_id) {
      return json({ error: "Atleta de entrada deve ser diferente do de saída." }, 400);
    }

    // ── Validar telefone e obter delegation_id ────────────────────────────
    const { data: delegRows, error: delErr } = await db.rpc(
      "substituicao_buscar_delegacao",
      { p_phone_suffix: phone_suffix, p_event_id: event_id },
    );
    if (delErr) return json({ error: delErr.message }, 500);
    if (!delegRows || delegRows.length === 0) {
      return json({ error: "Delegação não encontrada para este telefone e evento." }, 404);
    }
    const delegationId: string = delegRows[0].delegation_id;

    // ── Verificar que os participantes pertencem à delegação ──────────────
    const { data: parts, error: partsErr } = await db
      .from("participants")
      .select("id, delegation_id")
      .in("id", [participant_out_id, participant_in_id]);
    if (partsErr) return json({ error: partsErr.message }, 500);
    const allBelong = (parts ?? []).every((p: any) => p.delegation_id === delegationId);
    if (!allBelong) {
      return json({ error: "Um dos atletas não pertence a esta delegação." }, 403);
    }

    // ── Inserir substituição (trigger gera protocol_number) ───────────────
    const { data: inserted, error: insErr } = await db
      .from("substitutions")
      .insert({
        event_id,
        event_stage_id: stage_id,
        delegation_id: delegationId,
        sport_event_id,
        participant_out_id,
        participant_in_id,
        reason_code: reason_code ?? "outro",
        reason: reason?.trim() || null,
        contact_email,
        status: "requested",
        requested_by: null, // público, sem usuário autenticado
      })
      .select("id, protocol_number")
      .single();
    if (insErr) return json({ error: insErr.message }, 500);

    const substitutionId: string = inserted.id;
    const protocolNumber: string = inserted.protocol_number;

    // ── Mover arquivos de /temp/ para /{substitution_id}/ ─────────────────
    const docEntries = Object.entries(doc_paths as Record<string, string>);
    for (const [docKey, tempPath] of docEntries) {
      if (!tempPath) continue;
      const ext = tempPath.split(".").pop() ?? "bin";
      const finalPath = `${substitutionId}/${docKey}.${ext}`;

      // Copiar (move): download + upload com service_role
      const { data: fileData, error: dlErr } = await db.storage
        .from("substitution-docs")
        .download(tempPath);
      if (dlErr) { console.error("download err", docKey, dlErr); continue; }

      const { error: upErr } = await db.storage
        .from("substitution-docs")
        .upload(finalPath, fileData, { upsert: true });
      if (upErr) { console.error("upload err", docKey, upErr); continue; }

      // Registrar em participant_documents
      const { data: urlData } = db.storage
        .from("substitution-docs")
        .getPublicUrl(finalPath);

      await db.from("participant_documents").insert({
        participant_id: participant_in_id,
        event_id,
        document_type: docKey,
        storage_path: finalPath,
        file_url: urlData?.publicUrl ?? null,
        status: "pending",
      });

      // Remover arquivo temporário
      await db.storage.from("substitution-docs").remove([tempPath]);
    }

    // ── Enviar e-mail de protocolo ────────────────────────────────────────
    try {
      await db.functions.invoke("send-substitution-email", {
        body: { to: contact_email, protocol_number: protocolNumber },
      });
    } catch (emailErr) {
      console.error("Falha ao enviar e-mail de protocolo:", emailErr);
    }

    return json({ ok: true, protocol_number: protocolNumber });
  } catch (err) {
    console.error("Unexpected error:", err);
    return json({ error: String(err) }, 500);
  }
});
