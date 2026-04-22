import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface CompetitionContextType {
  selectedSportEventId: string | null;
  setSelectedSportEventId: (id: string | null) => void;
  selectedStageId: string | null;
  setSelectedStageId: (id: string | null) => void;
}

const CompetitionContext = createContext<CompetitionContextType | undefined>(undefined);

const SPORT_EVENT_STORAGE_KEY = "competition_selected_sport_event";
const STAGE_STORAGE_KEY = "competition_selected_stage";

export function CompetitionProvider({ children }: { children: ReactNode }) {
  const [selectedSportEventId, setSelectedSportEventIdState] = useState<string | null>(() => {
    return localStorage.getItem(SPORT_EVENT_STORAGE_KEY);
  });
  
  const [selectedStageId, setSelectedStageIdState] = useState<string | null>(() => {
    return localStorage.getItem(STAGE_STORAGE_KEY);
  });

  const setSelectedSportEventId = (id: string | null) => {
    setSelectedSportEventIdState(id);
    if (id) {
      localStorage.setItem(SPORT_EVENT_STORAGE_KEY, id);
    } else {
      localStorage.removeItem(SPORT_EVENT_STORAGE_KEY);
    }
  };

  const setSelectedStageId = (id: string | null) => {
    setSelectedStageIdState(id);
    if (id) {
      localStorage.setItem(STAGE_STORAGE_KEY, id);
    } else {
      localStorage.removeItem(STAGE_STORAGE_KEY);
    }
  };

  return (
    <CompetitionContext.Provider value={{
      selectedSportEventId,
      setSelectedSportEventId,
      selectedStageId,
      setSelectedStageId
    }}>
      {children}
    </CompetitionContext.Provider>
  );
}

export function useCompetitionContext() {
  const context = useContext(CompetitionContext);
  if (context === undefined) {
    throw new Error("useCompetitionContext must be used within a CompetitionProvider");
  }
  return context;
}
