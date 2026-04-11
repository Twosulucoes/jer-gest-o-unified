/**
 * Detecta e mapeia erros de elegibilidade (P0001) retornados pelo trigger
 * validate_match_entry_eligibility.
 */
export function getEligibilityErrorMessage(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const msg = (error as any).message ?? "";
  const code = (error as any).code ?? "";

  if (code !== "P0001" && code !== "23514") return null;

  if (msg.includes("credencial ativa")) {
    if (msg.includes("Equipe") || msg.includes("membros")) {
      return "Equipe contém membros sem credencial ativa. Regularize no credenciamento antes de vincular.";
    }
    return "Participante sem credencial ativa para este evento. Regularize no credenciamento.";
  }

  if (msg.includes("não aprovada") || msg.includes("não confirmada") || msg.includes("Inscrição")) {
    return "Inscrição não aprovada/confirmada para esta prova. Verifique a relação nominal.";
  }

  if (msg.includes("Limite de participação")) {
    return "Limite de participação excedido (Art.24/29 JER). Verifique as inscrições do atleta.";
  }

  // Fallback for P0001 codes we don't recognize specifically
  if (code === "P0001") return msg;

  return null;
}
