import { useState, useEffect } from "react";

const PREFIX = "jer_persisted_";
const DEFAULT_TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

interface PersistedValue<T> {
  value: T;
  timestamp: number;
}

/**
 * A hook that works like useState but persists the value in localStorage.
 * Useful for preserving filters and UI state across reloads.
 * Now includes a TTL (Time To Live) to automatically clear expired data.
 */
export function usePersistedState<T>(key: string, defaultValue: T, ttl: number = DEFAULT_TTL) {
  const storageKey = `${PREFIX}${key}`;
  
  const [state, setState] = useState<T>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved !== null) {
        const parsed = JSON.parse(saved) as PersistedValue<T>;
        
        // Check if it's the new format with timestamp
        if (parsed && typeof parsed === "object" && "timestamp" in parsed && "value" in parsed) {
          const now = Date.now();
          if (now - parsed.timestamp < ttl) {
            return parsed.value;
          } else {
            // TTL expired
            localStorage.removeItem(storageKey);
            return defaultValue;
          }
        }
        
        // Handle legacy format (just the value)
        return parsed as unknown as T;
      }
    } catch (error) {
      console.warn(`Error reading localStorage key "${storageKey}":`, error);
    }
    return defaultValue;
  });

  useEffect(() => {
    try {
      const dataToSave: PersistedValue<T> = {
        value: state,
        timestamp: Date.now()
      };
      localStorage.setItem(storageKey, JSON.stringify(dataToSave));
    } catch (error) {
      console.warn(`Error writing localStorage key "${storageKey}":`, error);
    }
  }, [storageKey, state]);

  return [state, setState] as const;
}

/**
 * Clears all persisted filters/UI state managed by usePersistedState.
 * Should be called when switching event/stage context or on logout.
 */
export function clearPersistedFilters() {
  try {
    const keys = Object.keys(localStorage);
    keys.forEach((key) => {
      if (key.startsWith(PREFIX)) {
        localStorage.removeItem(key);
      }
    });
  } catch (error) {
    console.warn("Error clearing persisted filters:", error);
  }
}
