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
  { test: (p) => p.includes("/transporte"), accent: "217 91% 60%" },           // azul
  { test: (p) => p.includes("/alimentacao"), accent: "142 71% 45%" },          // verde
  { test: (p) => p.includes("/alojamento"), accent: "271 91% 65%" },           // roxo
  { test: (p) => p.includes("/aovivo"), accent: "0 84% 60%" },                 // vermelho
  { test: (p) => p.includes("/competicao"), accent: "0 84% 60%" },             // vermelho
  { test: (p) => p.includes("/coordenacao"), accent: "38 92% 50%" },           // âmbar
  { test: (p) => p.includes("/delegacao"), accent: "38 92% 50%" },             // âmbar
  { test: (p) => p.includes("/super"), accent: "212 100% 60%" },               // azul institucional
  { test: (p) => p.includes("/admin"), accent: "212 100% 60%" },               // azul institucional
];

export function getModuleAccentForPath(pathname: string): string {
  const normalized = pathname.toLowerCase();
  const found = MODULE_ACCENTS.find((entry) => entry.test(normalized));
  return found?.accent ?? "38 92% 50%";
}
