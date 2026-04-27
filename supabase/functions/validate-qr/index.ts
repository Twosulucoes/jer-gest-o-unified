import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";

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

/**
 * Valida a assinatura HMAC de um QR v2
 */
async function validateHMAC(payload: string, hmacShort: string): Promise<boolean> {
  const secret = Deno.env.get("HMAC_SECRET");
  if (!secret) {
    console.error("HMAC_SECRET not configured");
    return false;
  }

  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(payload);

  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", key, messageData);
  const hashArray = Array.from(new Uint8Array(signature));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return hashHex.substring(0, 16) === hmacShort;
}

/**
 * Normaliza o conteúdo escaneado do QR.
 * Aceita:
 *  - JSON ({ qr, code, credential_code, cpf })
 *  - URLs com query (?qr=... | ?code=... | ?cpf=...)
 *  - Texto puro
 */
function extractCandidates(raw: string): { values: string[]; cpfDigits: string | null } {
  const set = new Set<string>();
  const value = raw.trim();
  set.add(value);

  // JSON?
  if (value.startsWith("{")) {
    try {
      const obj = JSON.parse(value);
      for (const k of ["qr", "qr_code", "qr_code_value", "code", "credential_code", "cpf", "id"]) {
        if (obj?.[k]) set.add(String(obj[k]).trim());
      }
    } catch (_) { /* ignore */ }
  }

  // URL?
  if (/^https?:\/\//i.test(value)) {
    try {
      const u = new URL(value);
      for (const k of ["qr", "code", "credential_code", "cpf", "id"]) {
        const v = u.searchParams.get(k);
        if (v) set.add(v.trim());
      }
      // último segmento do path
      const seg = u.pathname.split("/").filter(Boolean).pop();
      if (seg) set.add(seg);
    } catch (_) { /* ignore */ }
  }

  // Versão só com dígitos (útil para CPF)
  const digits = value.replace(/\D/g, "");
  if (digits) set.add(digits);

  const cpfDigits = digits.length === 11 ? digits : null;

  return { values: Array.from(set).filter(Boolean), cpfDigits };
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

    // Input validation: limit length and reject control/escape chars that
    // could break PostgREST filter parsing.
    const qrStr = String(qr_code_value);
    if (qrStr.length > 500) {
      return jsonResponse({ error: "qr_code_value too long" }, 400);
    }
    if (/[\\\x00-\x1F\x7F]/.test(qrStr)) {
      return jsonResponse({ error: "qr_code_value contains invalid characters" }, 400);
    }

    // Logica de assinatura HMAC
    let isLegacy = false;
    let qrPayload = qrStr;
    
    if (qrStr.startsWith("jer:v2:")) {
      const parts = qrStr.split(":");
      if (parts.length === 6) {
        // jer:v2:event_id:participant_id:credential_code:hmac_short
        const [,, eid, pid, ccode, hmac] = parts;
        const payload = eid + pid + ccode;
        const isValid = await validateHMAC(payload, hmac);
        if (!isValid) {
          return jsonResponse({ error: "Assinatura do QR Code inválida (Possível fraude)" }, 403);
        }
        // Se válido, o qr_code_value para busca no banco é o formato v1 ou apenas o code
        qrPayload = `jer:${eid}:${pid}:${ccode}`;
      } else {
        return jsonResponse({ error: "Formato de QR Code v2 inválido" }, 400);
      }
    } else if (qrStr.startsWith("jer:")) {
      isLegacy = true;
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Server-side role check: only operational roles may validate QR codes.
    const { data: roleRows } = await serviceClient
      .from("user_roles")
      .select("role")
      .eq("user_id", operatorId);
    const roles = (roleRows ?? []).map((r: any) => r.role);
    const ALLOWED_ROLES = [
      "admin",
      "secretaria",
      "coordenacao_tecnica",
      "transporte",
      "alimentacao",
      "alojamento",
      "super_admin",
    ];
    if (!roles.some((r: string) => ALLOWED_ROLES.includes(r))) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }

    const { values: candidates, cpfDigits } = extractCandidates(qrPayload);

    // Drop any candidate that still contains unsafe characters.
    const safeCandidates = candidates.filter(
      (v) => v.length > 0 && v.length <= 500 && !/[\\"\x00-\x1F\x7F]/.test(v)
    );

    // ── 1. Busca em participant_credentials por qr_code_value OU credential_code ──
    let credential: any = null;
    let matchedSource: "qr_code_value" | "credential_code" | "external_credential" | "cpf" | null = null;

    for (const candidate of safeCandidates) {
      const { data: byQr } = await serviceClient
        .from("participant_credentials")
        .select("id, status, credential_code, qr_code_value, event_id, participant_id, activated_at, revoked_at")
        .eq("event_id", event_id)
        .eq("qr_code_value", candidate)
        .limit(1)
        .maybeSingle();
      if (byQr) {
        credential = byQr;
        matchedSource = "qr_code_value";
        break;
      }
      const { data: byCode } = await serviceClient
        .from("participant_credentials")
        .select("id, status, credential_code, qr_code_value, event_id, participant_id, activated_at, revoked_at")
        .eq("event_id", event_id)
        .eq("credential_code", candidate)
        .limit(1)
        .maybeSingle();
      if (byCode) {
        credential = byCode;
        matchedSource = "credential_code";
        break;
      }
    }

    // ── 2. Fallback: external_credentials.credential_code ──
    if (!credential) {
      const { data: ext, error: extErr } = await serviceClient
        .from("external_credentials")
        .select("id, credential_code, event_id, participant_id, status")
        .eq("event_id", event_id)
        .in("credential_code", safeCandidates)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();
      if (extErr) console.error("external_credentials lookup error:", extErr);

      if (ext) {
        // Tenta achar a credencial "real" do participante
        const { data: pc } = await serviceClient
          .from("participant_credentials")
          .select("id, status, credential_code, qr_code_value, event_id, participant_id, activated_at, revoked_at")
          .eq("participant_id", ext.participant_id)
          .eq("event_id", event_id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (pc) {
          credential = pc;
        } else {
          // Sem participant_credentials: monta um "virtual" para validar pelo participante
          credential = {
            id: ext.id,
            status: "active",
            credential_code: ext.credential_code,
            qr_code_value: null,
            event_id: ext.event_id,
            participant_id: ext.participant_id,
            activated_at: null,
            revoked_at: null,
            __virtual_external: true,
          };
        }
        matchedSource = "external_credential";
      }
    }

    // ── 3. Fallback: CPF (11 dígitos) → people → participants → credenciais ──
    if (!credential && cpfDigits) {
      const { data: person } = await serviceClient
        .from("people")
        .select("id")
        .or(`cpf.eq.${cpfDigits},cpf.eq.${cpfDigits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")}`)
        .limit(1)
        .maybeSingle();

      if (person) {
        const { data: part } = await serviceClient
          .from("participants")
          .select("id")
          .eq("person_id", person.id)
          .eq("event_id", event_id)
          .limit(1)
          .maybeSingle();

        if (part) {
          const { data: pc } = await serviceClient
            .from("participant_credentials")
            .select("id, status, credential_code, qr_code_value, event_id, participant_id, activated_at, revoked_at")
            .eq("participant_id", part.id)
            .eq("event_id", event_id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (pc) {
            credential = pc;
            matchedSource = "cpf";
          } else {
            // Tem participante mas sem credencial: também bloqueia, mas com mensagem mais clara
            credential = {
              id: part.id,
              status: "no_credential",
              credential_code: null,
              qr_code_value: null,
              event_id,
              participant_id: part.id,
              activated_at: null,
              revoked_at: null,
              __virtual_external: true,
            };
            matchedSource = "cpf";
          }
        }
      }
    }

    let scanResult: string;
    let scanNotes: string | null = null;
    let participantInfo: Record<string, unknown> | null = null;

    if (!credential) {
      scanResult = "not_found";
      scanNotes = "QR Code não encontrado no sistema";
    } else {
      // Basic info checking
      if (credential.event_id !== event_id) {
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
      } else if (credential.status === "no_credential") {
        scanResult = "no_credential";
        scanNotes = "Este participante ainda não foi credenciado";
      } else if (credential.status === "active") {
        scanResult = "valid";
      } else {
        scanResult = "unknown_status";
        scanNotes = `Status desconhecido: ${credential.status}`;
      }

      // Fetch participant + person info for ANY found credential (to show who it is)
      const { data: participant } = await serviceClient
        .from("participants")
        .select("id, participant_type, status, delegation_id, person_id")
        .eq("id", credential.participant_id)
        .maybeSingle();

      if (participant) {
        const { data: person } = await serviceClient
          .from("people")
          .select("full_name, birth_date, gender, photo_url, cpf")
          .eq("id", participant.person_id)
          .maybeSingle();

        const { data: delegation } = await serviceClient
          .from("delegations")
          .select("id, institution_id")
          .eq("id", participant.delegation_id)
          .maybeSingle();

        let institutionName: string | null = null;
        if (delegation) {
          const { data: inst } = await serviceClient
            .from("institutions")
            .select("name")
            .eq("id", delegation.institution_id)
            .maybeSingle();
          institutionName = inst?.name ?? null;
        }

        participantInfo = {
          participant_id: participant.id,
          participant_type: participant.participant_type,
          full_name: person?.full_name ?? "Nome não encontrado",
          birth_date: person?.birth_date,
          gender: person?.gender,
          photo_url: person?.photo_url,
          institution: institutionName,
          credential_code: credential.credential_code,
          matched_by: matchedSource,
        };
      }

      // Update last_validated_at apenas se for credencial real (não virtual) e válida
      if (scanResult === "valid" && !credential.__virtual_external) {
        await serviceClient
          .from("participant_credentials")
          .update({ last_validated_at: new Date().toISOString() })
          .eq("id", credential.id);
      }
    }

    // 2. Register scan in credential_scans (apenas se for credencial real do participant_credentials)
    if (credential && !credential.__virtual_external) {
      // Check for duplicates (same credential, same scan_point, last 30 seconds)
      const { data: recentScan } = await serviceClient
        .from("credential_scans")
        .select("id")
        .eq("credential_id", credential.id)
        .eq("scan_point", scan_point || "general")
        .gt("scanned_at", new Date(Date.now() - 30 * 1000).toISOString())
        .limit(1)
        .maybeSingle();

      if (!recentScan) {
        await serviceClient.from("credential_scans").insert({
          credential_id: credential.id,
          event_id: event_id,
          scanned_by: operatorId,
          scan_point: scan_point || "general",
          scan_result: scanResult,
          notes: scanNotes,
          legacy_format: isLegacy
        });
      }
    }

    return jsonResponse({
      result: scanResult,
      message: scanNotes,
      participant: participantInfo,
      matched_by: matchedSource,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("validate-qr error:", err);
    return jsonResponse(
      { error: "Erro interno" },
      500
    );
  }
});
