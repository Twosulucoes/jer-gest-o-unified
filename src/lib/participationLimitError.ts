/**
 * Detecta erro de limite de participação (P0001) retornado pelos triggers
 * validate_participation_limit_pse / validate_participation_limit_team_member.
 */
export function isParticipationLimitError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const msg = (error as any).message ?? "";
  const code = (error as any).code ?? "";
  return code === "P0001" || msg.includes("Limite de participação excedido");
}

export const PARTICIPATION_LIMIT_MESSAGE =
  "Limite de participação excedido (Art.24/29 JER). Verifique as inscrições do atleta.";
