export type ModuleId = "alojamento" | "alimentacao" | "credenciamento" | "transporte" | "admin" | "other";

export interface ModuleConfig {
  id: ModuleId;
  pathPrefix: string;
  label: string;
}

export const APP_MODULES: ModuleConfig[] = [
  { id: "alojamento", pathPrefix: "/pwa/alojamento", label: "Alojamento" },
  { id: "alimentacao", pathPrefix: "/pwa/alimentacao", label: "Alimentação" },
  { id: "credenciamento", pathPrefix: "/pwa/credenciamento", label: "Credenciamento" },
  { id: "transporte", pathPrefix: "/pwa/transporte", label: "Transporte" },
  { id: "admin", pathPrefix: "/admin", label: "Administração" },
];

export const getModuleByPath = (pathname: string): ModuleId => {
  const module = APP_MODULES.find((m) => pathname.startsWith(m.pathPrefix));
  return module ? module.id : "other";
};
