import { useStageScope } from "./useStageScope";

/**
 * @deprecated Use `useStageScope` (./useStageScope) diretamente.
 *
 * Mantido como alias para compatibilidade. Agora detecta o escopo de etapa
 * tanto pelo parâmetro de rota `:stageId` (StageLayout) quanto pelo
 * `?stage=` (links legados/banner global).
 */
export function useStageParticipantFilter() {
  const scope = useStageScope();
  return {
    stageId: scope.stageId,
    stage: scope.stage,
    participantIds: scope.participantIds,
    isFiltering: scope.isStageScoped,
    isLoading: scope.isLoading,
  };
}
