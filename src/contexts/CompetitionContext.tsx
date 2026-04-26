import { createContext, useContext, useState, ReactNode } from "react";
import { clearPersistedFilters } from "@/hooks/usePersistedState";

interface CompetitionContextType {
  selectedSportId: string | null;
  setSelectedSportId: (id: string | null) => void;
  selectedSportEventId: string | null;
  setSelectedSportEventId: (id: string | null) => void;
  selectedStageId: string | null;
  setSelectedStageId: (id: string | null) => void;
  selectedPhaseId: string | null;
  setSelectedPhaseId: (id: string | null) => void;
}

const CompetitionContext = createContext<CompetitionContextType | undefined>(undefined);

const SPORT_STORAGE_KEY = "competition_selected_sport";
const SPORT_EVENT_STORAGE_KEY = "competition_selected_sport_event";
const STAGE_STORAGE_KEY = "competition_selected_stage";
const PHASE_STORAGE_KEY = "competition_selected_phase";

export function CompetitionProvider({ children }: { children: ReactNode }) {
  const [selectedSportId, setSelectedSportIdState] = useState<string | null>(() => {
    return localStorage.getItem(SPORT_STORAGE_KEY);
  });
  
  const [selectedSportEventId, setSelectedSportEventIdState] = useState<string | null>(() => {
    return localStorage.getItem(SPORT_EVENT_STORAGE_KEY);
  });
  
  const [selectedStageId, setSelectedStageIdState] = useState<string | null>(() => {
    return localStorage.getItem(STAGE_STORAGE_KEY);
  });
  
  const [selectedPhaseId, setSelectedPhaseIdState] = useState<string | null>(() => {
    return localStorage.getItem(PHASE_STORAGE_KEY);
  });

  const setSelectedSportId = (id: string | null) => {
    setSelectedSportIdState(id);
    if (id) {
      localStorage.setItem(SPORT_STORAGE_KEY, id);
    } else {
      localStorage.removeItem(SPORT_STORAGE_KEY);
    }
  };

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

  const setSelectedPhaseId = (id: string | null) => {
    setSelectedPhaseIdState(id);
    if (id) {
      localStorage.setItem(PHASE_STORAGE_KEY, id);
    } else {
      localStorage.removeItem(PHASE_STORAGE_KEY);
    }
  };

  return (
    <CompetitionContext.Provider value={{
      selectedSportId,
      setSelectedSportId,
      selectedSportEventId,
      setSelectedSportEventId,
      selectedStageId,
      setSelectedStageId,
      selectedPhaseId,
      setSelectedPhaseId
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
