import { supabase } from "@/integrations/supabase/client";

/**
 * Geração e emissão de credenciais nativas — single source of truth.
 *
 * Formato canônico (decisão de UX, mai/2026):
 *   credential_code = "J" + 5 dígitos numéricos (ex: "J04382")
 *   qr_code_value   = mesmo valor (sem prefixo "jer:", sem HMAC)
 *
 * Por que esse formato:
 *   - Operador no campo digita 6 caracteres em segundos.
 *   - Tudo numérico após o "J" (zero ambiguidade visual O/0, I/1, etc).
 *   - QR físico curto → câmera ruim ainda lê.
 *   - Único valor (qr_code_value === credential_code) → resolveQrCredential
 *     já bate em qualquer um dos campos sem mágica.
 *
 * Universo: 100.000 combinações por evento. Suficiente para a operação
 * típica do JER (≤ alguns milhares de credenciais por evento). O helper
 * `issueCredentialWithRetry` lida com colisão automaticamente.
 *
 * Compatibilidade com legado:
 *   - Credenciais antigas (`JER-XXXX-YYYY` + `jer:v2:...:hmac16`) continuam
 *     válidas. resolveQrCredential procura nas duas colunas.
 *   - Edge function `generate-credential-qr` segue viva por compat mas não
 *     é mais consumida.
 */

const CRED_PREFIX = "J";
const CRED_DIGITS = 5;
const CRED_MAX_RETRIES = 8;

/** Gera um credential_code novo no formato J + 5 dígitos. */
export function generateCredentialCode(): string {
  const max = 10 ** CRED_DIGITS; // 100000
  const n = Math.floor(Math.random() * max);
  return CRED_PREFIX + n.toString().padStart(CRED_DIGITS, "0");
}

/** QR value canonical: mesmo valor do credential_code. */
export function generateQrCodeValue(
  _eventId: string,
  _participantId: string,
  credentialCode: string,
): string {
  return credentialCode;
}

/**
 * Mantida por compat — agora retorna o próprio credentialCode (sem HMAC).
 * @deprecated Use `generateQrCodeValue` ou `issueCredentialWithRetry`.
 *             A edge function `generate-credential-qr` virou no-op.
 */
export async function generateSignedQrCodeValue(
  _eventId: string,
  _participantId: string,
  credentialCode: string,
): Promise<string> {
  return credentialCode;
}

interface IssueOptions {
  /** Quando reemitindo, ID da credencial anterior (vai pra status='reissued'). */
  revokeId?: string | null;
  /** Default 'manual'. */
  bindingSource?: "import" | "manual" | "api_sync" | "external";
  /** Tentativas máximas em caso de colisão de credential_code. */
  maxRetries?: number;
}

interface IssueResult {
  credentialCode: string;
  qrCodeValue: string;
  attempts: number;
}

/**
 * Emite credencial chamando `issue_participant_credential` com retry em
 * colisão de UNIQUE (event_id, credential_code). Retorna o code/qr efetivos.
 *
 * Idempotência: cada tentativa gera código novo via Math.random; chance de
 * colidir 8 vezes seguidas é desprezível para um evento com ≤ 5 mil
 * credenciais.
 *
 * Erros não-colisão (RLS, permissão, FK quebrada) propagam imediatamente.
 */
export async function issueCredentialWithRetry(
  eventId: string,
  participantId: string,
  userId: string,
  options: IssueOptions = {},
): Promise<IssueResult> {
  const max = options.maxRetries ?? CRED_MAX_RETRIES;
  const bindingSource = options.bindingSource ?? "manual";
  let lastError: any = null;

  for (let attempt = 1; attempt <= max; attempt++) {
    const credentialCode = generateCredentialCode();
    const qrCodeValue = credentialCode;

    const { error } = await (supabase as any).rpc("issue_participant_credential", {
      p_event_id: eventId,
      p_participant_id: participantId,
      p_credential_code: credentialCode,
      p_qr_code_value: qrCodeValue,
      p_user_id: userId,
      p_binding_source: bindingSource,
      p_revoke_id: options.revokeId ?? null,
    });

    if (!error) return { credentialCode, qrCodeValue, attempts: attempt };

    // Após L2 a RPC issue_participant_credential captura unique_violation
    // e relança com HINT = nome da constraint. Recoverable significa "gerar
    // outro código resolve": uq_event_credential (mesmo evento) e
    // uq_credential_qr (cross-event). Non-recoverable: participante já tem
    // ativa — só Reemitir resolve, e nesse caso o caller passa revokeId.
    const code = String((error as any).code ?? "");
    const hint = String((error as any).hint ?? "");
    const msgLower = (error.message || "").toLowerCase();
    const isUniqueViolation = code === "23505" || msgLower.includes("23505");

    const RECOVERABLE_CONSTRAINTS = new Set(["uq_event_credential", "uq_credential_qr"]);
    const isRecoverable =
      isUniqueViolation &&
      (RECOVERABLE_CONSTRAINTS.has(hint) ||
        // Fallback pré-L2 (constraint name no message cru): mantém retry
        // funcionando antes da migration L2 ser aplicada.
        (!hint && (msgLower.includes("uq_event_credential") || msgLower.includes("uq_credential_qr"))));

    if (!isRecoverable) {
      // Erro não-recuperável (participante já tem ativa, RLS, FK quebrada,
      // etc.) — error.message já é humano após L2. Propaga sem mascarar.
      throw error;
    }

    lastError = error;
  }

  throw new Error(
    `Não foi possível gerar credential_code único após ${max} tentativas (universo J+${CRED_DIGITS}d quase esgotado neste evento).` +
      (lastError ? ` Último erro: ${lastError.message}` : ""),
  );
}
