import { supabase } from "@/integrations/supabase/client";

export type CancelamentoMotivo =
  | "duplicidade"
  | "participante_errado"
  | "janela_errada"
  | "lancamento_acidental"
  | "incidente_operacional";

export const CANCELAMENTO_MOTIVOS: { value: CancelamentoMotivo; label: string }[] = [
  { value: "duplicidade", label: "Duplicidade" },
  { value: "participante_errado", label: "Participante errado" },
  { value: "janela_errada", label: "Janela errada" },
  { value: "lancamento_acidental", label: "Lançamento acidental" },
  { value: "incidente_operacional", label: "Incidente operacional" },
];

export async function cancelarConsumo(
  consumoId: string,
  motivo: CancelamentoMotivo,
): Promise<{ ok: true }> {
  if (!consumoId) throw new Error("ID do consumo é obrigatório");
  if (!motivo) throw new Error("Motivo é obrigatório");

  const { data, error } = await supabase.rpc("reverse_meal_consumption" as any, {
    p_consumption_id: consumoId,
    p_reason: motivo,
  });

  if (error) throw error;
  if (!data?.ok) throw new Error("Falha ao cancelar consumo");

  return { ok: true };
}

export async function restaurarConsumo(consumoId: string): Promise<{ ok: true }> {
  if (!consumoId) throw new Error("ID do consumo é obrigatório");

  const { data, error } = await supabase.rpc("restore_meal_consumption" as any, {
    p_consumption_id: consumoId,
  });

  if (error) throw error;
  if (!data?.ok) throw new Error("Falha ao restaurar consumo");

  return { ok: true };
}
