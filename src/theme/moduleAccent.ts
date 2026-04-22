const MODULE_ACCENTS: Array<{ test: (path: string) => boolean; accent: string }> = [
  { test: (path) => path.includes("/transporte"), accent: "212 100% 67%" }, // blue
  { test: (path) => path.includes("/alimentacao"), accent: "128 49% 49%" }, // green
  { test: (path) => path.includes("/alojamento"), accent: "266 100% 77%" }, // purple
  { test: (path) => path.includes("/coordenacao-tecnica"), accent: "212 100% 67%" }, // blue
  { test: (path) => path.includes("/competicao"), accent: "212 100% 67%" }, // blue
  { test: (path) => path.includes("/delegacao"), accent: "41 100% 47%" }, // amber
  { test: (path) => path.includes("/aovivo"), accent: "3 92% 63%" }, // red
];

export function getModuleAccentForPath(pathname: string): string {
  const normalized = pathname.toLowerCase();
  const found = MODULE_ACCENTS.find((entry) => entry.test(normalized));
  return found?.accent ?? "41 100% 47%";
}
