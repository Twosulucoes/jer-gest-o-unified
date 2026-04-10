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
 * Generates the official QR code value for a credential.
 * Format: jer:{event_id}:{participant_id}:{credential_code}
 * 
 * This is the canonical format used for validation.
 * The validate-qr edge function looks up credentials by this value.
 */
export function generateQrCodeValue(
  eventId: string,
  participantId: string,
  credentialCode: string,
): string {
  return `jer:${eventId}:${participantId}:${credentialCode}`;
}
