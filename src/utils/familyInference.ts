import { SPORT_PRESET_CATALOG } from "@/config/sportPresetCatalog";
import type { RulesFamily } from "@/types/competition";

/**
 * Infece a família de uma prova baseada no nome da modalidade e da prova.
 */
export function inferFamilyFromSport(sportName: string, eventName: string): { family: RulesFamily; reason: string } {
  const normalizedSport = sportName.toLowerCase();
  const normalizedEvent = eventName.toLowerCase();

  // 1. Tentar encontrar no catálogo de presets
  const preset = SPORT_PRESET_CATALOG.find(p => 
    normalizedSport === p.label.toLowerCase() || 
    normalizedEvent.includes(p.label.toLowerCase())
  );

  if (preset) {
    return { 
      family: preset.rules.family as RulesFamily, 
      reason: `Baseado no preset: ${preset.label}` 
    };
  }

  // 2. Regras específicas para modalidades multi-família
  if (normalizedSport.includes("atletismo")) {
    if (normalizedEvent.includes("pista") || normalizedEvent.includes("rasos") || normalizedEvent.includes("revezamento") || normalizedEvent.includes("marcha")) {
      return { family: "time", reason: "Atletismo: Prova de pista/marcha (tempo)" };
    }
    if (normalizedEvent.includes("salto") || normalizedEvent.includes("lançamento") || normalizedEvent.includes("arremesso")) {
      return { family: "mark", reason: "Atletismo: Prova de campo (marca)" };
    }
  }

  if (normalizedSport.includes("karatê") || normalizedSport.includes("karate")) {
    if (normalizedEvent.includes("kumite")) {
      return { family: "combat", reason: "Karatê: Kumite (combate)" };
    }
    if (normalizedEvent.includes("kata")) {
      return { family: "ranking", reason: "Karatê: Kata (ranking)" };
    }
  }

  // 3. Heurísticas baseadas em palavras-chave
  if (normalizedEvent.includes("combate") || normalizedEvent.includes("luta")) return { family: "combat", reason: "Palavra-chave: combate/luta" };
  if (normalizedEvent.includes("sets") || normalizedSport.includes("vôlei") || normalizedSport.includes("volei")) return { family: "sets", reason: "Palavra-chave: sets/volei" };

  // Default
  return { family: "score", reason: "Padrão: Placar simples (score)" };
}
