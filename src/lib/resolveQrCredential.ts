import { supabase } from "@/integrations/supabase/client";

export interface ResolvedCredential {
  participant_id: string;
  full_name: string | null;
  source: "participant_credentials" | "external_credentials";
}

/**
 * Parses a scanned QR value and extracts lookup tokens.
 * Canonical format: jer:{event_id}:{participant_id}:{credential_code}
 * Legacy prefixes: JER:, JER-ALJ:
 */
function extractTokens(raw: string): {
  fullValue: string;
  credentialCode: string | null;
  strippedToken: string;
} {
  const trimmed = raw.trim();

  // Canonical format: jer:eventId:participantId:credentialCode
  const canonicalMatch = trimmed.match(/^jer:([^:]+):([^:]+):(.+)$/i);
  if (canonicalMatch) {
    return {
      fullValue: trimmed,
      credentialCode: canonicalMatch[3],
      strippedToken: canonicalMatch[3],
    };
  }

  // Legacy JER-ALJ: prefix
  if (trimmed.startsWith("JER-ALJ:")) {
    const token = trimmed.slice(8);
    return { fullValue: trimmed, credentialCode: token, strippedToken: token };
  }

  // Legacy JER: prefix
  if (trimmed.startsWith("JER:")) {
    const token = trimmed.slice(4);
    return { fullValue: trimmed, credentialCode: token, strippedToken: token };
  }

  // Plain code
  return { fullValue: trimmed, credentialCode: trimmed, strippedToken: trimmed };
}

/**
 * Centralized QR credential resolver. Tries:
 * 1. participant_credentials by qr_code_value (full match)
 * 2. participant_credentials by credential_code
 * 3. external_credentials by credential_code
 */
export async function resolveQrCredential(
  rawValue: string,
): Promise<ResolvedCredential | null> {
  const { fullValue, credentialCode } = extractTokens(rawValue);

  // 1. Try participant_credentials by qr_code_value (full raw match)
  const { data: byQr } = await supabase
    .from("participant_credentials")
    .select("participant_id, participant:participants(person:people(full_name))")
    .eq("qr_code_value", fullValue)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (byQr) {
    return {
      participant_id: (byQr as any).participant_id,
      full_name: (byQr as any).participant?.person?.full_name ?? null,
      source: "participant_credentials",
    };
  }

  // 2. Try participant_credentials by credential_code
  if (credentialCode) {
    const { data: byCode } = await supabase
      .from("participant_credentials")
      .select("participant_id, participant:participants(person:people(full_name))")
      .eq("credential_code", credentialCode)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    if (byCode) {
      return {
        participant_id: (byCode as any).participant_id,
        full_name: (byCode as any).participant?.person?.full_name ?? null,
        source: "participant_credentials",
      };
    }
  }

  // 3. Try external_credentials
  const tokenToTry = credentialCode || fullValue;
  const { data: ext } = await supabase
    .from("external_credentials")
    .select("participant_id, participant:participants(person:people(full_name))")
    .eq("credential_code", tokenToTry)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (ext) {
    return {
      participant_id: (ext as any).participant_id,
      full_name: (ext as any).participant?.person?.full_name ?? null,
      source: "external_credentials",
    };
  }

  return null;
}

/**
 * Extract the plain token from a raw QR value (for RPC-based modules like Alojamento).
 */
export function extractQrToken(raw: string): string | null {
  const trimmed = raw.trim();

  // Canonical format: extract credential_code
  const canonicalMatch = trimmed.match(/^jer:([^:]+):([^:]+):(.+)$/i);
  if (canonicalMatch) return canonicalMatch[3];

  if (trimmed.startsWith("JER-ALJ:")) return trimmed.slice(8);
  if (trimmed.startsWith("JER:")) return trimmed.slice(4);
  if (trimmed.length >= 8 && trimmed.length <= 64) return trimmed;
  return null;
}
