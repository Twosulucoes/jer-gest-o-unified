import { supabase } from "@/integrations/supabase/client";

export type ServiceKind = "transport" | "meals" | "lodging";

export type VoucherType = "nominal" | "aggregate";

export interface VoucherRedeemResult {
  ok: boolean;
  reason?: string;
  voucher_type?: VoucherType;
  participant_id?: string | null;
  person_name?: string | null;
  label?: string | null;
  is_contingency?: boolean;
  remaining_uses?: number | null;
}

const REASONS: Record<string, string> = {
  not_found: "Voucher não encontrado",
  inactive: "Voucher revogado ou inativo",
  expired: "Voucher expirado",
  not_yet_valid: "Voucher ainda não está válido",
  scope_denied: "Voucher não cobre este serviço",
  max_uses_reached: "Limite de usos do voucher atingido",
};

/** Detecta se o QR escaneado é um voucher (prefixo `voucher:`). */
export function isVoucherQr(rawValue: string): boolean {
  return rawValue.trim().toLowerCase().startsWith("voucher:");
}

/** Mensagem amigável para uma `reason` retornada pela RPC. */
export function voucherReasonLabel(reason?: string): string {
  if (!reason) return "Voucher inválido";
  return REASONS[reason] ?? reason;
}

/**
 * Tenta redimir um voucher para o serviço informado.
 * Retorna `null` se o QR não for um voucher (chamador deve seguir o fluxo de credencial).
 */
export async function tryRedeemVoucher(
  rawValue: string,
  serviceKind: ServiceKind,
  contextId?: string,
): Promise<VoucherRedeemResult | null> {
  if (!isVoucherQr(rawValue)) return null;

  const { data, error } = await supabase.rpc("redeem_voucher" as any, {
    p_qr_value: rawValue.trim(),
    p_service_kind: serviceKind,
    ...(contextId ? { p_context_id: contextId } : {}),
  });

  if (error) {
    return { ok: false, reason: error.message };
  }
  return data as VoucherRedeemResult;
}
