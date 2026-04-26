import { useState, useEffect } from "react";

const PREFIX = "jer_persisted_";

/**
 * A hook that works like useState but persists the value in localStorage.
 * Useful for preserving filters and UI state across reloads.
 */
export function usePersistedState<T>(key: string, defaultValue: T) {
  const storageKey = `${PREFIX}${key}`;
  
  const [state, setState] = useState<T>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved !== null) {
        return JSON.parse(saved);
      }
    } catch (error) {
      console.warn(`Error reading localStorage key "${storageKey}":`, error);
    }
    return defaultValue;
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
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

