import { supabase } from "@/integrations/supabase/client";

/**
 * Centralized credential code and QR code generation utilities.
 * All credential issuance/reissuance points MUST use these helpers
 * to ensure format consistency across the system.
 */

/**
 * Generates a unique credential code.
 * Format: JER-{base36_timestamp}-{4_char_random}
 * Example: JER-M1ABC2D-K7X9
 */
export function generateCredentialCode(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `JER-${timestamp}-${random}`;
}

/**
 * Generates the official QR code value for a credential (legacy/unsigned).
 * Format: jer:{event_id}:{participant_id}:{credential_code}
 */
export function generateQrCodeValue(
  eventId: string,
  participantId: string,
  credentialCode: string,
): string {
  return `jer:${eventId}:${participantId}:${credentialCode}`;
}

/**
 * Generates a signed QR code value using the generate-credential-qr Edge Function.
 * Format: jer:v2:{event_id}:{participant_id}:{credential_code}:{hmac_short}
 */
export async function generateSignedQrCodeValue(
  eventId: string,
  participantId: string,
  credentialCode: string,
): Promise<string> {
  const { data, error } = await supabase.functions.invoke("generate-credential-qr", {
    body: { event_id: eventId, participant_id: participantId, credential_code: credentialCode },
  });

  if (error) {
    console.error("Error generating signed QR:", error);
    // Fallback to legacy format if function fails, but log error
    return generateQrCodeValue(eventId, participantId, credentialCode);
  }

  return data.qr_code_value;
}

