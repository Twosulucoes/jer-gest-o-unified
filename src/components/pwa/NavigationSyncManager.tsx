import { useNavigationSync } from "@/hooks/useNavigationSync";

/**
 * Component that initializes the navigation sync logic.
 * Replaces AppStatePreserver with a more consolidated approach.
 */
export function NavigationSyncManager() {
  useNavigationSync();
  return null;
}
