import { getAllItems, STATUS_META, ModuleStatus, type SystemMapItem } from "@/config/systemMap";

export interface SystemItemWithGroup extends SystemMapItem {
  groupLabel: string;
}

/**
 * Find a system map item by its route path.
 */
export function findSystemItemByRoute(route: string): SystemItemWithGroup | null {
  const allItems = getAllItems();
  return allItems.find((item) => item.route === route) ?? null;
}

/**
 * Get status metadata (emoji, label, color) for a given ModuleStatus.
 */
export function getStatusMeta(status: ModuleStatus) {
  return STATUS_META[status];
}

/**
 * Get a tiny status emoji for sidebar badges.
 */
export function getStatusEmoji(route: string): string {
  const item = findSystemItemByRoute(route);
  if (!item) {
    return ""; // Silent return if not found to avoid log pollution
  }
  return STATUS_META[item.status].emoji;
}
