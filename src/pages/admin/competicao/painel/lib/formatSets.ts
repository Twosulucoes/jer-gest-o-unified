export function formatMatchSets(match: any) {
  if (!match.match_results || match.match_results.length === 0) return null;
  
  // Placar final em sets (ex: 3×1)
  // Assumimos que o primeiro resultado é da equipe A e o segundo da equipe B
  const results = match.match_results;
  if (results.length < 2) return results[0]?.score || "—";
  
  return `${results[0].score} × ${results[1].score}`;
}

export function formatMatchPartials(match: any) {
  if (!match.match_scores || match.match_scores.length === 0) return null;
  
  const scoreA = match.match_scores.find((s: any) => {
    const entry = match.match_entries.find((e: any) => e.id === s.match_entry_id);
    return entry?.side === "A" || entry?.side === "left";
  });
  
  const scoreB = match.match_scores.find((s: any) => {
    const entry = match.match_entries.find((e: any) => e.id === s.match_entry_id);
    return entry?.side === "B" || entry?.side === "right";
  });
  
  if (!scoreA?.score_detail || !scoreB?.score_detail) return null;
  
  const detailsA = scoreA.score_detail as Record<string, string>;
  const detailsB = scoreB.score_detail as Record<string, string>;
  
  const partials: string[] = [];
  // Assumimos que as chaves são p1, p2, p3...
  const periods = Object.keys(detailsA).filter(k => k.startsWith('p')).length;
  
  for (let i = 1; i <= 10; i++) { // Limite razoável de sets
    const valA = detailsA[`p${i}`];
    const valB = detailsB[`p${i}`];
    
    if (valA !== undefined && valB !== undefined && (valA !== "" || valB !== "")) {
      partials.push(`${valA || 0}-${valB || 0}`);
    } else {
      break;
    }
  }
  
  return partials.join(" / ");
}
