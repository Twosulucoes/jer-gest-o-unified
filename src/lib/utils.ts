/**
 * Utility functions for JER Gestão.
 * Includes Tailwind CSS class merging and formatting helpers.
 */
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges class names using clsx and tailwind-merge to avoid conflicts.
 * Useful for building reusable Shadcn components.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
