import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Retorna o próximo número de boletim disponível para o evento.
 * Trata-se apenas de uma **prévia** — a reserva atômica acontece
 * server-side via RPC `rpc_create_bulletin` no momento da criação.
 *
 * Revalida automaticamente quando a janela recupera o foco, para
 * reduzir a chance de mostrar um número desatualizado quando dois
 * usuários estão criando boletins simultaneamente.
 */
export function useNextBulletinNumber(eventId: string | null | undefined, enabled = true) {
  const query = useQuery({
    queryKey: ["next-bulletin-number", eventId],
    enabled: !!eventId && enabled,
    staleTime: 5_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("official_bulletins")
        .select("number")
        .eq("event_id", eventId!)
        .order("number", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data?.number ?? 0) + 1;
    },
  });

  // Revalida ao focar a janela
  useEffect(() => {
    if (!enabled || !eventId) return;
    const onFocus = () => query.refetch();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [enabled, eventId, query]);

  return query;
}
