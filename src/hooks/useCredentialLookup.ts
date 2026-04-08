import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface CredentialLookupResult {
  participant_id: string;
  person_name: string;
  person_cpf: string | null;
  participant_type: string;
  credential_status: string;
  credential_code: string;
  food_restrictions?: string | null;
  gender?: string;
}

interface LookupError {
  code: "not_found" | "wrong_event" | "inactive_credential" | "inactive_participant" | "error";
  message: string;
}

export function useCredentialLookup() {
  const [loading, setLoading] = useState(false);

  const lookupByQrCode = useCallback(async (
    qrCodeValue: string,
    eventId: string
  ): Promise<{ data: CredentialLookupResult | null; error: LookupError | null }> => {
    setLoading(true);
    try {
      // 1. Find credential by QR code value
      const { data: credential, error: credErr } = await supabase
        .from("participant_credentials")
        .select("id, participant_id, status, credential_code, event_id")
        .eq("qr_code_value", qrCodeValue)
        .maybeSingle();

      if (credErr) {
        return { data: null, error: { code: "error", message: "Erro ao buscar credencial." } };
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

      // 2. Load participant
      const { data: participant, error: partErr } = await supabase
        .from("participants")
        .select("id, person_id, participant_type, is_active, status")
        .eq("id", credential.participant_id)
        .single();

      if (partErr || !participant) {
        return { data: null, error: { code: "error", message: "Participante vinculado não encontrado." } };
      }

      if (!participant.is_active) {
        return { data: null, error: { code: "inactive_participant", message: "Participante inativo no evento." } };
      }

      // 3. Load person
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
