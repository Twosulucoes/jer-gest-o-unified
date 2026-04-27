/**
 * Dicionário único de mensagens de validação de voucher.
 *
 * Usado por:
 *  - PWAs operacionais (transporte, alimentação, alojamento)
 *  - Admin (página de vouchers e dialogs de uso)
 *  - voucherScan.ts (mensagens de fallback)
 *
 * Garante feedback consistente entre serviços, com suporte a PT/ES e
 * incluindo tanto cenários de erro quanto de sucesso.
 */

import type { VoucherRedeemResult, VoucherType, ServiceKind } from "./voucherScan";

export type PwaLang = "pt" | "es";

export type VoucherMessageTone = "success" | "error" | "warning" | "info";

export interface VoucherMessage {
  /** Texto pronto para exibição em toast/UI. */
  text: string;
  /** Tom semântico — quem chama escolhe o método (toast.success/error/...) */
  tone: VoucherMessageTone;
  /** Código estável para logs/telemetria. */
  code: string;
  /** Contexto adicional do erro para detalhamento (ex.: em conflitos offline) */
  context?: Record<string, any>;
}

// ---------------- Reasons (erros vindos da RPC redeem_voucher) ----------------

export type VoucherReason =
  | "not_found"
  | "inactive"
  | "expired"
  | "not_yet_valid"
  | "scope_denied"
  | "max_uses_reached"
  | "wrong_instance"
  | "already_used_here"
  | "unknown";

const REASON_TEXT: Record<VoucherReason, Record<PwaLang, string>> = {
  not_found: {
    pt: "Voucher não encontrado",
    es: "Voucher no encontrado",
  },
  inactive: {
    pt: "Voucher revogado ou inativo",
    es: "Voucher revocado o inactivo",
  },
  expired: {
    pt: "Voucher expirado",
    es: "Voucher expirado",
  },
  not_yet_valid: {
    pt: "Voucher ainda não está válido",
    es: "Voucher aún no es válido",
  },
  scope_denied: {
    pt: "Voucher não cobre este serviço",
    es: "Voucher no cubre este servicio",
  },
  max_uses_reached: {
    pt: "Limite de usos do voucher atingido",
    es: "Límite de usos del voucher alcanzado",
  },
  wrong_instance: {
    pt: "Voucher pertence a outra instância",
    es: "Voucher pertenece a otra instancia",
  },
  already_used_here: {
    pt: "Voucher já consumido nesta instância",
    es: "Voucher ya consumido en esta instancia",
  },
  unknown: {
    pt: "Voucher inválido ou erro de sistema",
    es: "Voucher inválido o error del sistema",
  },
};

// ---------------- Public helpers ----------------

function lang(l?: PwaLang): PwaLang {
  return l === "es" ? "es" : "pt";
}

/** Mensagem para uma `reason` retornada pela RPC. */
export function voucherErrorMessage(
  reason: string | undefined, 
  l?: PwaLang,
  context?: Record<string, any>
): VoucherMessage {
  const code = (reason && (reason as VoucherReason) in REASON_TEXT ? (reason as VoucherReason) : "unknown");
  
  let text = REASON_TEXT[code][lang(l)];

  // Detalhamento de contexto se disponível
  if (context) {
    if (code === "inactive" && context.revocation_reason) {
      text += `: ${context.revocation_reason}`;
      if (context.revoked_by) text += ` (por ${context.revoked_by})`;
    } else if (code === "expired" && context.valid_until) {
      text += ` (válido até ${new Date(context.valid_until).toLocaleString(lang(l) === 'es' ? 'es' : 'pt-BR')})`;
    } else if (code === "wrong_instance" && context.correct_instance) {
      text += `. Correto: ${context.correct_instance}`;
    } else if (code === "already_used_here" && context.used_at) {
      text += ` às ${new Date(context.used_at).toLocaleTimeString(lang(l) === 'es' ? 'es' : 'pt-BR')}`;
      if (context.operator_name) text += ` por ${context.operator_name}`;
    }
  }

  return {
    text,
    tone: "error",
    code: `voucher.${code}`,
    context
  };
}

/** Mensagem de sucesso após uma RPC `ok`. */
export function voucherSuccessMessage(
  voucher: VoucherRedeemResult,
  serviceKind: ServiceKind,
  l?: PwaLang,
): VoucherMessage {
  const lg = lang(l);
  const type = voucher.voucher_type ?? "nominal";
  const isAggregate = type === "aggregate" || !voucher.participant_id;
  const subject = isAggregate
    ? voucher.label || voucher.person_name || (lg === "es" ? "Acompañante" : "Acompanhante")
    : voucher.person_name || (lg === "es" ? "Participante" : "Participante");

  const typeLabel = TYPE_LABEL[isAggregate ? "aggregate" : "nominal"][lg];
  const serviceLabel = SERVICE_LABEL[serviceKind][lg];

  const remaining =
    voucher.remaining_uses === null || voucher.remaining_uses === undefined
      ? REMAINING_TEXT[lg]("infinite")
      : REMAINING_TEXT[lg](Math.max(0, voucher.remaining_uses));

  // Ex.: "🎫 Voucher agregado validado · Acompanhante (transporte) · 4 usos restantes"
  const text = `🎫 ${
    lg === "es" ? "Voucher" : "Voucher"
  } ${typeLabel} ${lg === "es" ? "validado" : "validado"} · ${subject} (${serviceLabel}) · ${remaining}`;

  return {
    text,
    tone: "success",
    code: `voucher.ok.${type}.${serviceKind}`,
  };
}

/** Aviso quando voucher nominal foi usado em modo contingência. */
export function voucherContingencyNotice(l?: PwaLang): VoucherMessage {
  const lg = lang(l);
  return {
    text:
      lg === "es"
        ? "⚠️ Voucher nominal de contingencia — registre el motivo en el log"
        : "⚠️ Voucher nominal de contingência — registre o motivo no log",
    tone: "warning",
    code: "voucher.contingency",
  };
}

/** Helper conveniente: dado o resultado da RPC, devolve a mensagem certa. */
export function voucherMessageFromResult(
  result: VoucherRedeemResult | null | undefined,
  serviceKind: ServiceKind,
  l?: PwaLang,
): VoucherMessage {
  if (!result || !result.ok) return voucherErrorMessage(result?.reason, l);
  return voucherSuccessMessage(result, serviceKind, l);
}
