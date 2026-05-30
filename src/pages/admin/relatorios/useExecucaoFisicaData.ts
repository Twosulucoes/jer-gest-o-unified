import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  fetchExecucaoFisicaReport,
  saveMeta2Target,
  type ExecucaoFisicaReport,
} from "./execucaoFisicaService";

/** Hook que carrega o Relatório de Execução Física das Metas para um evento/período. */
export function useExecucaoFisicaData(
  eventId: string | null | undefined,
  dateFrom?: string | null,
  dateTo?: string | null,
) {
  return useQuery<ExecucaoFisicaReport>({
    queryKey: ["osc-execucao-fisica", eventId, dateFrom ?? null, dateTo ?? null],
    enabled: !!eventId,
    staleTime: 60_000,
    queryFn: () => fetchExecucaoFisicaReport(eventId!, dateFrom, dateTo),
  });
}

/** Mutation para salvar valores PREVISTOS (Meta 2) e revalidar o relatório. */
export function useSaveMeta2Target(eventId: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ metricKey, valor }: { metricKey: string; valor: number }) => {
      if (!eventId) throw new Error("Evento não selecionado");
      return saveMeta2Target(eventId, metricKey, valor);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["osc-execucao-fisica", eventId] });
      toast.success("Meta prevista atualizada.");
    },
    onError: (e: any) => {
      console.error("Erro ao salvar meta prevista:", e);
      toast.error("Erro ao salvar meta prevista.", { description: e?.message });
    },
  });
}
