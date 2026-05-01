export type ModuleId = 
  | "alojamento" 
  | "alimentacao" 
  | "credenciamento" 
  | "transporte" 
  | "coordenacao-tecnica" 
  | "delegacao" 
  | "resultados" 
  | "registros" 
  | "aovivo"
  | "admin" 
  | "other";

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
  { id: "coordenacao-tecnica", pathPrefix: "/pwa/coordenacao-tecnica", label: "Coordenação Técnica" },
  { id: "delegacao", pathPrefix: "/pwa/delegacao", label: "Delegação" },
  { id: "resultados", pathPrefix: "/pwa/resultados", label: "Resultados" },
  { id: "registros", pathPrefix: "/pwa/registros", label: "Registros" },
  { id: "aovivo", pathPrefix: "/aovivo", label: "Ao Vivo" },
  { id: "admin", pathPrefix: "/admin", label: "Administração" },
];

export const getModuleByPath = (pathname: string): ModuleId => {
  const module = APP_MODULES.find((m) => pathname.startsWith(m.pathPrefix));
  return module ? module.id : "other";
};

