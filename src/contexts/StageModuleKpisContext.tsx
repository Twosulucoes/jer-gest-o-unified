import { createContext, useContext, useState, useCallback, useEffect, useMemo } from "react";
import type { StageMiniDashKpi } from "@/components/admin/stage/StageMiniDash";

interface StageModuleKpisContextValue {
  moduleKpis: StageMiniDashKpi[];
  hideGlobal: boolean;
  setModuleKpis: (kpis: StageMiniDashKpi[], hideGlobal?: boolean) => void;
  clear: () => void;
}

const StageModuleKpisContext = createContext<StageModuleKpisContextValue | undefined>(undefined);

export function StageModuleKpisProvider({ children }: { children: React.ReactNode }) {
  const [moduleKpis, setKpis] = useState<StageMiniDashKpi[]>([]);
  const [hideGlobal, setHideGlobal] = useState(false);

  const setModuleKpis = useCallback((kpis: StageMiniDashKpi[], hide = false) => {
    setKpis(kpis);
    setHideGlobal(hide);
  }, []);

  const clear = useCallback(() => {
    setKpis([]);
    setHideGlobal(false);
  }, []);

  const value = useMemo(() => ({ moduleKpis, hideGlobal, setModuleKpis, clear }), [moduleKpis, hideGlobal, setModuleKpis, clear]);

  return <StageModuleKpisContext.Provider value={value}>{children}</StageModuleKpisContext.Provider>;
}

export function useStageModuleKpisContext() {
  const ctx = useContext(StageModuleKpisContext);
  return ctx; // pode ser undefined se chamado fora — toleramos
}

/**
 * Hook usado pelas páginas filhas para registrar seus KPIs de módulo no scaffold pai.
 * Limpa automaticamente ao desmontar.
 */
export function useStageModuleKpis(kpis: StageMiniDashKpi[], hideGlobal = false) {
  const ctx = useStageModuleKpisContext();
  // Serializa para detectar mudanças de conteúdo
  const key = JSON.stringify(kpis.map(k => ({ l: k.label, v: k.value, t: k.tone })));
  useEffect(() => {
    if (!ctx) return;
    ctx.setModuleKpis(kpis, hideGlobal);
    return () => ctx.clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, hideGlobal]);
}
