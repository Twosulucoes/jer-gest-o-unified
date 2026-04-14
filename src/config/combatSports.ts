/**
 * Combat sport detection configuration.
 * Add sport slugs here to enable the CombatResultForm for those modalities.
 * This is the single source of truth for combat sport detection.
 */
export const COMBAT_SPORT_SLUGS = new Set([
  "judo",
  "karate",
  "karate-kumite",
  "karate-kata",
  "taekwondo",
  "wrestling",
  "luta-olimpica",
  "luta-livre",
]);

/**
 * Check if a sport (by slug) is a combat modality.
 */
export function isCombatSport(sportSlug: string | null | undefined): boolean {
  if (!sportSlug) return false;
  return COMBAT_SPORT_SLUGS.has(sportSlug.toLowerCase());
}
