import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface CredentialLookupResult {
  participant_id: string;
  person_name: string;
  person_cpf: string | null;
  participant_type: string;
  credential_status: string;
  credential_code: string | null;
  food_restrictions?: string | null;
  gender?: string;
  birth_date?: string | null;
  photo_url?: string | null;
  institution?: string | null;
  matched_by?: "qr_code_value" | "credential_code" | "external_credential" | "cpf";
}

interface LookupError {
  code:
    | "not_found"
    | "wrong_event"
    | "inactive_credential"
    | "inactive_participant"
    | "no_credential"
    | "error";
  message: string;
}

/** Extrai possíveis identificadores de uma string escaneada (texto, JSON, URL). */
function extractCandidates(raw: string): { values: string[]; cpfDigits: string | null } {
  const set = new Set<string>();
  const value = raw.trim();
  set.add(value);

  if (value.startsWith("{")) {
    try {
      const obj = JSON.parse(value);
      for (const k of ["qr", "qr_code", "qr_code_value", "code", "credential_code", "cpf", "id"]) {
        if (obj?.[k]) set.add(String(obj[k]).trim());
      }
    } catch (_) { /* ignore */ }
  }

  if (/^https?:\/\//i.test(value)) {
    try {
      const u = new URL(value);
      for (const k of ["qr", "code", "credential_code", "cpf", "id"]) {
        const v = u.searchParams.get(k);
        if (v) set.add(v.trim());
      }
      const seg = u.pathname.split("/").filter(Boolean).pop();
      if (seg) set.add(seg);
    } catch (_) { /* ignore */ }
  }

  const digits = value.replace(/\D/g, "");
  if (digits) set.add(digits);

  return { values: Array.from(set).filter(Boolean), cpfDigits: digits.length === 11 ? digits : null };
}

export function useCredentialLookup() {
  const [loading, setLoading] = useState(false);

  const lookupByQrCode = useCallback(async (
    qrCodeValue: string,
    eventId: string
  ): Promise<{ data: CredentialLookupResult | null; error: LookupError | null }> => {
    setLoading(true);
    try {
      const { values: candidates, cpfDigits } = extractCandidates(qrCodeValue);

      let credential: any = null;
      let matchedSource: CredentialLookupResult["matched_by"] | null = null;

      // 1) participant_credentials por qr_code_value OU credential_code
      const { data: pcRows } = await supabase
        .from("participant_credentials")
        .select("id, participant_id, status, credential_code, qr_code_value, event_id")
        .eq("event_id", eventId)
        .or([
          `qr_code_value.in.(${candidates.map((v) => `"${v.replace(/"/g, '\\"')}"`).join(",")})`,
          `credential_code.in.(${candidates.map((v) => `"${v.replace(/"/g, '\\"')}"`).join(",")})`,
        ].join(","))
        .limit(1);

      if (pcRows && pcRows.length > 0) {
        credential = pcRows[0];
        matchedSource = candidates.includes(credential.qr_code_value)
          ? "qr_code_value"
          : "credential_code";
      }

      // 2) external_credentials
      if (!credential) {
        const { data: extRows } = await supabase
          .from("external_credentials")
          .select("id, credential_code, event_id, participant_id, status")
          .eq("event_id", eventId)
          .in("credential_code", candidates)
          .eq("status", "active")
          .limit(1);

        if (extRows && extRows.length > 0) {
          const ext = extRows[0];
          // tenta achar credencial real
          const { data: pc } = await supabase
            .from("participant_credentials")
            .select("id, participant_id, status, credential_code, qr_code_value, event_id")
            .eq("participant_id", ext.participant_id)
            .eq("event_id", eventId)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          credential = pc ?? {
            id: ext.id,
            participant_id: ext.participant_id,
            status: "active",
            credential_code: ext.credential_code,
            qr_code_value: null,
            event_id: ext.event_id,
            __virtual_external: true,
          };
          matchedSource = "external_credential";
        }
      }

      // 3) Fallback CPF
      if (!credential && cpfDigits) {
        const cpfFmt = cpfDigits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
        const { data: people } = await supabase
          .from("people")
          .select("id")
          .or(`cpf.eq.${cpfDigits},cpf.eq.${cpfFmt}`)
          .limit(1);

        if (people && people.length > 0) {
          const { data: parts } = await supabase
            .from("participants")
            .select("id")
            .eq("person_id", people[0].id)
            .eq("event_id", eventId)
            .limit(1);

          if (parts && parts.length > 0) {
            const { data: pc } = await supabase
              .from("participant_credentials")
              .select("id, participant_id, status, credential_code, qr_code_value, event_id")
              .eq("participant_id", parts[0].id)
              .eq("event_id", eventId)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();

            if (pc) {
              credential = pc;
              matchedSource = "cpf";
            } else {
              return {
                data: null,
                error: { code: "no_credential", message: "Participante encontrado por CPF, mas sem credencial emitida." },
              };
            }
          }
        }
      }

      if (!credential) {
        return { data: null, error: { code: "not_found", message: "QR Code não encontrado no sistema." } };
      }

      if (credential.event_id !== eventId) {
        return { data: null, error: { code: "wrong_event", message: "Credencial pertence a outro evento." } };
      }

      if (credential.status !== "active") {
        const statusLabels: Record<string, string> = {
          pending: "Credencial ainda não ativada.",
          revoked: "Credencial revogada.",
          suspended: "Credencial suspensa.",
        };
        return {
          data: null,
          error: {
            code: "inactive_credential",
            message: statusLabels[credential.status] || `Status da credencial: ${credential.status}`,
          },
        };
      }

      // Carrega participante + pessoa
      const { data: participant, error: partErr } = await supabase
        .from("participants")
        .select("id, person_id, participant_type, is_active, status, institution:event_institutions(name)")
        .eq("id", credential.participant_id)
        .single();

      if (partErr || !participant) {
        return { data: null, error: { code: "error", message: "Participante vinculado não encontrado." } };
      }

      if (!participant.is_active) {
        return { data: null, error: { code: "inactive_participant", message: "Participante inativo no evento." } };
      }

      const { data: person, error: personErr } = await supabase
        .from("people")
        .select("full_name, cpf, food_restrictions, gender")
        .eq("id", participant.person_id)
        .single();

      if (personErr || !person) {
        return { data: null, error: { code: "error", message: "Dados da pessoa não encontrados." } };
      }

      return {
        data: {
          participant_id: participant.id,
          person_name: person.full_name,
          person_cpf: person.cpf,
          participant_type: participant.participant_type,
          credential_status: credential.status,
          credential_code: credential.credential_code,
          food_restrictions: person.food_restrictions,
          gender: person.gender,
          matched_by: matchedSource ?? undefined,
        },
        error: null,
      };
    } catch (err) {
      return { data: null, error: { code: "error", message: String(err) } };
    } finally {
      setLoading(false);
    }
  }, []);

  return { lookupByQrCode, loading };
}
