import { supabase } from "@/integrations/supabase/client";

/**
 * Tries to resolve a scanned QR code via external_credentials.
 * Returns participant_id if found and active, null otherwise.
 * eventId is required to avoid resolving credentials from other events.
 */
export async function resolveExternalCredential(
  code: string,
  eventId: string,
): Promise<{ participant_id: string; full_name: string | null } | null> {
  const { data } = await supabase
    .from("external_credentials")
    .select("participant_id, participant:participants(person:people(full_name))")
    .eq("credential_code", code)
    .eq("event_id", eventId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  return {
    participant_id: (data as any).participant_id,
    full_name: (data as any).participant?.person?.full_name ?? null,
  };
}
