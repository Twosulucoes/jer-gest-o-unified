/**
 * Centralized slug utilities. Use this everywhere to keep the same rules
 * across wizard / form / auto-generation.
 */

export const SLUG_REGEX = /^[a-z0-9-]{3,64}$/;

export function slugify(text: string, maxLength = 64): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength);
}

export function isValidSlug(slug: string): boolean {
  return SLUG_REGEX.test(slug);
}
