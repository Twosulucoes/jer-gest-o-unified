import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

const gerarProtocolo = () => {
  const ano = new Date().getFullYear();
  const numero = Math.floor(Math.random() * 900000 + 100000);
  return `SUB-${ano}-${numero}`;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const db = createClient(supabaseUrl, serviceKey);

    const body = await req.json();

    const {
      event_id,
      stage_id,

      escola_nome_digitada,
      tipo_modalidade,
      modalidade_nome_digitada,
      prova_nome_digitada,
      categoria,
      naipe,

      atleta_sai_nome,
      atleta_entra_nome,

      reason_code,
      reason,

      responsavel_nome,
      responsavel_telefone,
      contact_email,

      doc_paths = {},
    } = body;

    if (
      !event_id ||
      !stage_id ||
      !escola_nome_digitada ||
      !tipo_modalidade ||
      !modalidade_nome_digitada ||
      !categoria ||
      !naipe ||
      !atleta_sai_nome ||
      !atleta_entra_nome ||
      !responsavel_nome ||
      !responsavel_telefone ||
      !contact_email
    ) {
      return json({ ok: false, error: "TESTE NOVO FUNCIONANDO" }, 400);
    }

    if (tipo_modalidade === "Individual" && !prova_nome_digitada) {
      return json({
        ok: false,
        error: "Informe o nome da prova para modalidade individual.",
      }, 400);
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact_email)) {
      return json({ ok: false, error: "E-mail inválido." }, 400);
    }

    if (
      atleta_sai_nome.trim().toLowerCase() ===
      atleta_entra_nome.trim().toLowerCase()
    ) {
      return json({
        ok: false,
        error: "O atleta que entra deve ser diferente do atleta que sai.",
      }, 400);
    }

    const protocolNumber = gerarProtocolo();

    const { data: inserted, error: insErr } = await db
      .from("substitutions")
      .insert({
        event_id,
        event_stage_id: stage_id,

        delegation_id: null,
        sport_event_id: null,
        participant_out_id: null,
        participant_in_id: null,

        reason_code: reason_code ?? "outro",
        reason: reason?.trim() || null,
        contact_email,

        status: "requested",
        requested_by: null,
        protocol_number: protocolNumber,

        school_name_text: escola_nome_digitada.trim(),
        modality_type_text: tipo_modalidade,
        modality_name_text: modalidade_nome_digitada.trim(),
        proof_name_text:
          tipo_modalidade === "Individual"
            ? prova_nome_digitada.trim()
            : null,
        category_text: categoria,
        gender_text: naipe,
        athlete_out_name_text: atleta_sai_nome.trim(),
        athlete_in_name_text: atleta_entra_nome.trim(),
        requester_name: responsavel_nome.trim(),
        requester_phone: responsavel_telefone.trim(),
      })
      .select("id, protocol_number")
      .single();

    if (insErr) {
      return json({
        ok: false,
        error: insErr.message,
        detalhe:
          "Provavelmente faltam colunas novas na tabela substitutions.",
      }, 500);
    }

    const substitutionId: string = inserted.id;
    const finalProtocol: string = inserted.protocol_number ?? protocolNumber;

    const docEntries = Object.entries(doc_paths as Record<string, string>);

    for (const [docKey, tempPath] of docEntries) {
      if (!tempPath) continue;

      const ext = tempPath.split(".").pop() ?? "bin";
      const finalPath = `${substitutionId}/${docKey}.${ext}`;

      const { data: fileData, error: dlErr } = await db.storage
        .from("substitution-docs")
        .download(tempPath);

      if (dlErr) {
        console.error("download err", docKey, dlErr);
        continue;
      }

      const { error: upErr } = await db.storage
        .from("substitution-docs")
        .upload(finalPath, fileData, { upsert: true });

      if (upErr) {
        console.error("upload err", docKey, upErr);
        continue;
      }

      const { data: urlData } = db.storage
        .from("substitution-docs")
        .getPublicUrl(finalPath);

      await db.from("substitution_documents").insert({
        substitution_id: substitutionId,
        document_type: docKey,
        storage_path: finalPath,
        file_url: urlData?.publicUrl ?? null,
        status: "pending",
      });

      await db.storage.from("substitution-docs").remove([tempPath]);
    }

    try {
      await db.functions.invoke("send-substitution-email", {
        body: {
          to: contact_email,
          protocol_number: finalProtocol,
        },
      });
    } catch (emailErr) {
      console.error("Falha ao enviar e-mail de protocolo:", emailErr);
    }

    return json({
      ok: true,
      protocol_number: finalProtocol,
    });
  } catch (err) {
    console.error("Unexpected error:", err);

    return json({
      ok: false,
      error: String(err),
    }, 500);
  }
});
