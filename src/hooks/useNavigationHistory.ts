import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const STORAGE_KEY = "jer_nav_history_v1";
const MAX_PER_MODULE = 20;

type HistoryMap = Record<string, string[]>;

/**
 * Returns the "module key" for a given pathname.
 * - /admin                  -> "_root"
 * - /admin/competicao/x     -> "competicao"
 * - /admin/etapa/:id/...    -> "etapa:<stageId>"
 * Anything else (PWA, super, etc.) -> the first segment.
 */
export function getModuleKey(pathname: string): string {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] === "admin") {
    if (parts.length === 1) return "_root";
    if (parts[1] === "etapa" && parts[2]) return `etapa:${parts[2]}`;
    return parts[1];
  }
  return parts[0] ?? "_root";
}

/** Default fallback path when there is no history within the current module. */
export function getModuleFallbackPath(moduleKey: string): string {
  if (moduleKey === "_root") return "/admin";
  if (moduleKey.startsWith("etapa:")) {
    const stageId = moduleKey.slice("etapa:".length);
    return `/admin/etapa/${stageId}`;
  }
  return `/admin/${moduleKey}`;
}

function readHistory(): HistoryMap {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as HistoryMap) : {};
  } catch {
    return {};
  }
}

function writeHistory(map: HistoryMap) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* ignore quota */
  }
}

/**
 * Tracks the current location into a per-module history stack stored in
 * sessionStorage. Use <NavigationHistoryTracker /> once at the layout level.
 */
export function useTrackNavigationHistory() {
  const location = useLocation();
  const fullPath = location.pathname + location.search;

  useEffect(() => {
    const key = getModuleKey(location.pathname);
    const map = readHistory();
    const stack = map[key] ?? [];
    // Avoid consecutive duplicates
    if (stack[stack.length - 1] !== fullPath) {
      stack.push(fullPath);
      if (stack.length > MAX_PER_MODULE) stack.splice(0, stack.length - MAX_PER_MODULE);
      map[key] = stack;
      writeHistory(map);
    }
  }, [fullPath, location.pathname]);
}

/**
 * Returns the previous path within the given module, or null if none.
 * Pops the current entry so the caller can navigate to the returned path.
 */
export function popPreviousInModule(moduleKey: string, currentFullPath: string): string | null {
  const map = readHistory();
  const stack = map[moduleKey] ?? [];

  // Drop trailing entries equal to current path
  while (stack.length > 0 && stack[stack.length - 1] === currentFullPath) {
    stack.pop();
  }

  const previous = stack[stack.length - 1] ?? null;
  map[moduleKey] = stack;
  writeHistory(map);
  return previous;
}

/**
 * Peek the previous path without mutating the stack.
 */
export function peekPreviousInModule(moduleKey: string, currentFullPath: string): string | null {
  const map = readHistory();
  const stack = map[moduleKey] ?? [];
  for (let i = stack.length - 1; i >= 0; i--) {
    if (stack[i] !== currentFullPath) return stack[i];
  }
  return null;
}

/** Component wrapper around useTrackNavigationHistory for layout files. */
export function NavigationHistoryTracker() {
  useTrackNavigationHistory();
  return null;
}
