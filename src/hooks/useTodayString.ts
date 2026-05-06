import { useEffect, useState } from "react";

/**
 * Devolve a data de "hoje" em ISO local (YYYY-MM-DD) e mantém o valor
 * sincronizado quando o relógio cruza meia-noite ou quando a aba é
 * trazida para o primeiro plano.
 *
 * Auditoria PWA Alimentação (bloqueador 5): páginas usavam
 * `new Date().toLocaleDateString('fr-CA')` direto no render (calculado
 * uma única vez por mount). Em tablets que ficam ligados a noite toda
 * — comum em tendas de operação — o "hoje" continuava sendo o dia
 * anterior, escondendo as janelas do dia novo e desalinhando filtros.
 */
function computeToday(): string {
  // `fr-CA` produz `YYYY-MM-DD` sem dependência de moment/date-fns e
  // respeita o fuso horário local do dispositivo (que é o que importa
  // para o operador no chão).
  return new Date().toLocaleDateString("fr-CA");
}

export function useTodayString(): string {
  const [today, setToday] = useState<string>(() => computeToday());

  useEffect(() => {
    const tick = () => {
      const next = computeToday();
      setToday((prev) => (prev === next ? prev : next));
    };

    // Rechecagem leve a cada minuto cobre a transição de meia-noite
    // sem dependência de eventos do navegador.
    const interval = window.setInterval(tick, 60_000);

    // Voltar do background é o caso prático mais comum (operador
    // bloqueia a tela, volta de manhã). `visibilitychange` cobre.
    const onVisibility = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", tick);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", tick);
    };
  }, []);

  return today;
}
