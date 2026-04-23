/**
 * Accent por módulo (HSL string sem o `hsl()`).
 * Cada cor é injetada em --module-accent via RouteAccentSync.
 * Paleta acordada com o produto:
 *  - Transporte           = azul   (#3B82F6)
 *  - Alimentação          = verde  (#22C55E)
 *  - Alojamento           = roxo   (#A855F7)
 *  - Competição / Ao Vivo = vermelho (#EF4444)
 *  - Delegação            = âmbar  (#F59E0B)
 *  - Coordenação          = âmbar  (#F59E0B) — alertas usam vermelho/amarelo
 */
const MODULE_ACCENTS: Array<{ test: (path: string) => boolean; accent: string }> = [
  { test: (p) => p.includes("/transporte"), accent: "212 100% 67%" },   // blue   #58a6ff
  { test: (p) => p.includes("/alimentacao"), accent: "134 48% 49%" },   // green  #3fb950
  { test: (p) => p.includes("/alojamento"), accent: "263 100% 78%" },   // purple #bc8cff
  { test: (p) => p.includes("/aovivo"), accent: "4 92% 62%" },          // red    #f85149
  { test: (p) => p.includes("/competicao"), accent: "4 92% 62%" },      // red
  { test: (p) => p.includes("/coordenacao"), accent: "212 100% 67%" },  // blue
  { test: (p) => p.includes("/delegacao"), accent: "39 100% 47%" },     // amber  #f0a500
  { test: (p) => p.includes("/super"), accent: "39 100% 47%" },         // amber
  { test: (p) => p.includes("/admin"), accent: "39 100% 47%" },         // amber
];

export function getModuleAccentForPath(pathname: string): string {
  const normalized = pathname.toLowerCase();
  const found = MODULE_ACCENTS.find((entry) => entry.test(normalized));
  return found?.accent ?? "39 100% 47%";
}
