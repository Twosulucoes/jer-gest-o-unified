import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } =
      await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }
    const operatorId = claimsData.claims.sub as string;

    const body = await req.json();
    const { qr_code_value, event_id, scan_point } = body;

    if (!qr_code_value || !event_id) {
      return jsonResponse(
        { error: "Missing required fields: qr_code_value, event_id" },
        400
      );
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Find credential by QR code
    const { data: credential, error: credError } = await serviceClient
      .from("participant_credentials")
      .select(
        "id, status, credential_code, event_id, participant_id, activated_at, revoked_at"
      )
      .eq("qr_code_value", qr_code_value)
      .maybeSingle();

    if (credError) {
      return jsonResponse({ error: "Erro ao buscar credencial" }, 500);
    }

    let scanResult: string;
    let scanNotes: string | null = null;
    let participantInfo: Record<string, unknown> | null = null;

    if (!credential) {
      scanResult = "not_found";
      scanNotes = "QR Code não encontrado no sistema";
    } else if (credential.event_id !== event_id) {
      scanResult = "wrong_event";
      scanNotes = "Credencial pertence a outro evento";
    } else if (credential.status === "revoked") {
      scanResult = "revoked";
      scanNotes = "Credencial revogada";
    } else if (credential.status === "suspended") {
      scanResult = "suspended";
      scanNotes = "Credencial suspensa";
    } else if (credential.status === "pending") {
      scanResult = "not_activated";
      scanNotes = "Credencial ainda não ativada";
    } else if (credential.status === "active") {
      scanResult = "valid";

      // Fetch participant + person info
      const { data: participant } = await serviceClient
        .from("participants")
        .select(
          "id, participant_type, status, delegation_id, person_id"
        )
        .eq("id", credential.participant_id)
        .single();

      if (participant) {
        const { data: person } = await serviceClient
          .from("people")
          .select("full_name, birth_date, gender, photo_url, cpf")
          .eq("id", participant.person_id)
          .single();

        const { data: delegation } = await serviceClient
          .from("delegations")
          .select("id, institution_id")
          .eq("id", participant.delegation_id)
          .single();

        let institutionName: string | null = null;
        if (delegation) {
          const { data: inst } = await serviceClient
            .from("institutions")
            .select("name")
            .eq("id", delegation.institution_id)
            .single();
          institutionName = inst?.name ?? null;
        }

        participantInfo = {
          participant_id: participant.id,
          participant_type: participant.participant_type,
          full_name: person?.full_name,
          birth_date: person?.birth_date,
          gender: person?.gender,
          photo_url: person?.photo_url,
          institution: institutionName,
          credential_code: credential.credential_code,
        };
      }

      // Update last_validated_at
      await serviceClient
        .from("participant_credentials")
        .update({ last_validated_at: new Date().toISOString() })
        .eq("id", credential.id);
    } else {
      scanResult = "unknown_status";
      scanNotes = `Status desconhecido: ${credential.status}`;
    }

    // 2. Register scan in credential_scans
    if (credential) {
      await serviceClient.from("credential_scans").insert({
        credential_id: credential.id,
        event_id: event_id,
        scanned_by: operatorId,
        scan_point: scan_point || "general",
        scan_result: scanResult,
        notes: scanNotes,
      });
    }

    return jsonResponse({
      result: scanResult,
      message: scanNotes,
      participant: participantInfo,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("validate-qr error:", err);
    return jsonResponse(
      { error: "Erro interno", details: String(err) },
      500
    );
  }
});
