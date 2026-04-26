import { useState, useEffect } from "react";
import { logger } from "@/lib/logger";

const PREFIX = "jer_persisted_";
const STATS_KEY = "jer_persisted_stats";

export const PERSISTENCE_TTLS = {
  SENSITIVE: 15 * 60 * 1000,      // 15 minutes
  DEFAULT: 24 * 60 * 60 * 1000,   // 24 hours
  LONG: 7 * 24 * 60 * 60 * 1000,    // 7 days
};

type PersistenceCategory = "SENSITIVE" | "DEFAULT" | "LONG" | "OVERRIDE";

/**
 * Returns the TTL and category for a given key based on patterns or overrides.
 */
const getTTLMetadata = (key: string, overrideTTL?: number): { ttl: number; category: PersistenceCategory } => {
  if (overrideTTL !== undefined) return { ttl: overrideTTL, category: "OVERRIDE" };
  
  const lowerKey = key.toLowerCase();
  
  // Sensitive data should expire quickly
  if (lowerKey.includes("sensitive") || lowerKey.includes("auth") || lowerKey.includes("private") || lowerKey.includes("password")) {
    return { ttl: PERSISTENCE_TTLS.SENSITIVE, category: "SENSITIVE" };
  }
  
  // Filters and preferences often want to stay longer
  if (lowerKey.includes("filter") || lowerKey.includes("search") || lowerKey.includes("pref") || lowerKey.includes("view")) {
    return { ttl: PERSISTENCE_TTLS.LONG, category: "LONG" };
  }

  return { ttl: PERSISTENCE_TTLS.DEFAULT, category: "DEFAULT" };
};

const incrementExpirationStat = (category: string) => {
  try {
    const saved = localStorage.getItem(STATS_KEY);
    const stats = saved ? JSON.parse(saved) : {};
    stats[category] = (stats[category] || 0) + 1;
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
    logger.info(`[Persistence] Incrementada expiração para categoria: ${category}. Total:`, stats);
  } catch (error) {
    // Silently fail for stats
  }
};

interface PersistedValue<T> {
  value: T;
  timestamp: number;
}

/**
 * A hook that works like useState but persists the value in localStorage.
 * Useful for preserving filters and UI state across reloads.
 * Now includes a TTL (Time To Live) to automatically clear expired data.
 */
export function usePersistedState<T>(key: string, defaultValue: T, ttl?: number) {
  const storageKey = `${PREFIX}${key}`;
  const { ttl: effectiveTTL, category } = getTTLMetadata(key, ttl);
  
  const [state, setState] = useState<T>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved !== null) {
        const parsed = JSON.parse(saved) as PersistedValue<T>;
        
        // Check if it's the new format with timestamp
        if (parsed && typeof parsed === "object" && "timestamp" in parsed && "value" in parsed) {
          const now = Date.now();
          if (now - parsed.timestamp < effectiveTTL) {
            return parsed.value;
          } else {
            // TTL expired
            logger.info(`TTL expired for localStorage key "${storageKey}" (${category}). Clearing.`);
            incrementExpirationStat(category);
            localStorage.removeItem(storageKey);
            return defaultValue;
          }
        }

        
        // Handle legacy format (just the value)
        return parsed as unknown as T;
      }
    } catch (error) {
      logger.warn(`Error reading localStorage key "${storageKey}":`, error);
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
      logger.warn(`Error writing localStorage key "${storageKey}":`, error);
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
    logger.warn("Error clearing persisted filters:", error);
  }
}

/**
 * Returns the current stats of expired keys by category.
 */
export function getPersistedStateStats() {
  try {
    const saved = localStorage.getItem(STATS_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch (error) {
    return {};
  }
}

/**
 * Resets the expiration stats.
 */
export function resetPersistedStateStats() {
  try {
    localStorage.removeItem(STATS_KEY);
    logger.info("[Persistence] Stats reset successfully.");
  } catch (error) {
    logger.warn("Error resetting persistence stats:", error);
  }
}

