import { voucherErrorMessage } from "./voucherMessages";

export const PWA_MESSAGE_CODES = [
  "ERR_NOT_FOUND",
  "ERR_ALREADY_REGISTERED",
  "ERR_SESSION_EXPIRED",
  "ERR_WINDOW_REQUIRED",
  "ERR_LIMIT_REACHED",
  "ERR_UNKNOWN",
  "ERR_NAME_REQUIRED",
  "SUCCESS_REGISTERED",
  "SUCCESS_BOARDING",
  "ALREADY_BOARDED",
  "SEARCH_PLACEHOLDER",
  "NO_RESULTS",
  "MANUAL_SEARCH",
  "QR_VALID",
  "VOUCHER_NOT_FOUND",
  "VOUCHER_INACTIVE",
  "VOUCHER_EXPIRED",
  "VOUCHER_NOT_YET_VALID",
  "VOUCHER_SCOPE_DENIED",
  "VOUCHER_MAX_USES",
  "MANUAL_BOARDING",
  "FULL_NAME",
  "PASSENGER_NAME_PLACEHOLDER",
  "TAKE_PHOTO",
  "SAVING",
  "REGISTER_BOARDING",
  "CANCEL",
  "SEARCH_MANUALLY",
  "CHECKIN_SUCCESS",
  "CHECKOUT_SUCCESS",
  "ERR_INVALID_QR",
  "ERR_SELECT_FACILITY",
  "ERR_UNDER_12",
  "ERR_ALREADY_STAYING",
  "ERR_NOT_STAYING",
  "SCAN_QR",
  "SCAN_TITLE",
  "SCAN",
  "BUSCANDO",
  "EMBARQUE",
  "MANUAL",
  "FINALIZAR",
  "NENHUM_PASSAGEIRO",
  "EMBARCADO",
  "PENDENTE",
  "VOLTAR",
  "ACESSO_BLOQUEADO",
  "APENAS_MOTORISTA",
  "SCAN_EMBARQUE",
  "SYNC_PENDING",
  "SYNCING",
  "SYNC_SUCCESS",
  "SYNC_CONFLICTS",
  "VOUCHER_OFFLINE_RECORDED",
  "GENDER_MISMATCH",
  "CAPACITY_FULL",
  "CAPACITY_NOT_DEFINED",
  "PRESENCE_SUCCESS"
] as const;

export type PwaMessageCode = typeof PWA_MESSAGE_CODES[number];

export type PwaLang = "pt" | "es";

const MESSAGES: Record<PwaMessageCode, Record<PwaLang, string>> = {
  ERR_NOT_FOUND: {
    pt: "Credencial não encontrada",
    es: "Credencial no encontrada",
  },
  ERR_ALREADY_REGISTERED: {
    pt: "Já registrado",
    es: "Ya registrado",
  },
  ERR_SESSION_EXPIRED: {
    pt: "Sessão expirada. Faça login novamente.",
    es: "Sesión expirada. Inicie sesión de nuevo.",
  },
  ERR_WINDOW_REQUIRED: {
    pt: "Selecione uma janela de refeição primeiro",
    es: "Seleccione una ventana de comida primero",
  },
  ERR_LIMIT_REACHED: {
    pt: "Limite diário de refeições atingido",
    es: "Límite diario de comidas alcanzado",
  },
  ERR_UNKNOWN: {
    pt: "Erro desconhecido",
    es: "Error desconocido",
  },
  ERR_NAME_REQUIRED: {
    pt: "Nome é obrigatório",
    es: "El nombre es obligatorio",
  },
  SUCCESS_REGISTERED: {
    pt: "Registrado com sucesso",
    es: "Registrado con éxito",
  },
  SUCCESS_BOARDING: {
    pt: "embarcado com sucesso",
    es: "embarcado con éxito",
  },
  ALREADY_BOARDED: {
    pt: "já embarcou",
    es: "ya embarcó",
  },
  SEARCH_PLACEHOLDER: {
    pt: "Buscar por nome ou CPF…",
    es: "Buscar por nombre o CPF…",
  },
  NO_RESULTS: {
    pt: "Nenhum participante encontrado",
    es: "No se encontró ningún participante",
  },
  MANUAL_SEARCH: {
    pt: "Busca manual",
    es: "Búsqueda manual",
  },
  QR_VALID: {
    pt: "QR Code validado!",
    es: "¡QR Code validado!",
  },
  VOUCHER_NOT_FOUND: {
    pt: "Voucher não encontrado",
    es: "Voucher no encontrado",
  },
  VOUCHER_INACTIVE: {
    pt: "Voucher revogado ou inativo",
    es: "Voucher revocado o inactivo",
  },
  VOUCHER_EXPIRED: {
    pt: "Voucher expirado",
    es: "Voucher expirado",
  },
  VOUCHER_NOT_YET_VALID: {
    pt: "Voucher ainda não está válido",
    es: "Voucher aún no es válido",
  },
  VOUCHER_SCOPE_DENIED: {
    pt: "Voucher não cobre este serviço",
    es: "Voucher no cubre este servicio",
  },
  VOUCHER_MAX_USES: {
    pt: "Limite de usos do voucher atingido",
    es: "Límite de usos del voucher alcanzado",
  },
  MANUAL_BOARDING: {
    pt: "Embarque Manual",
    es: "Embarque Manual",
  },
  FULL_NAME: {
    pt: "Nome completo",
    es: "Nombre completo",
  },
  PASSENGER_NAME_PLACEHOLDER: {
    pt: "Nome do passageiro",
    es: "Nombre del pasajero",
  },
  TAKE_PHOTO: {
    pt: "Tirar foto do documento",
    es: "Tomar foto del documento",
  },
  SAVING: {
    pt: "Salvando...",
    es: "Guardando...",
  },
  REGISTER_BOARDING: {
    pt: "Registrar Embarque",
    es: "Registrar Embarque",
  },
  CANCEL: {
    pt: "Cancelar",
    es: "Cancelar",
  },
  SEARCH_MANUALLY: {
    pt: "ou buscar manualmente",
    es: "o buscar manualmente",
  },
  CHECKIN_SUCCESS: {
    pt: "Check-in realizado!",
    es: "¡Check-in realizado!",
  },
  CHECKOUT_SUCCESS: {
    pt: "Check-out realizado!",
    es: "¡Check-out realizado!",
  },
  ERR_INVALID_QR: {
    pt: "Código QR inválido",
    es: "Código QR inválido",
  },
  ERR_SELECT_FACILITY: {
    pt: "Selecione um local primeiro",
    es: "Seleccione un local primero",
  },
  ERR_UNDER_12: {
    pt: "Pessoa com idade inferior a 12 anos",
    es: "Persona menor de 12 años",
  },
  ERR_ALREADY_STAYING: {
    pt: "Pessoa já está hospedada neste local",
    es: "Persona ya está alojada en este lugar",
  },
  ERR_NOT_STAYING: {
    pt: "Pessoa não está hospedada neste local",
    es: "Persona no está alojada en este lugar",
  },
  SCAN_QR: {
    pt: "Escanear QR",
    es: "Escanear QR",
  },
  SCAN_TITLE: {
    pt: "Credencial ou voucher",
    es: "Credencial o voucher",
  },
  SCAN: {
    pt: "Scan",
    es: "Scan",
  },
  BUSCANDO: {
    pt: "Buscando…",
    es: "Buscando…",
  },
  EMBARQUE: {
    pt: "Embarque",
    es: "Embarque",
  },
  MANUAL: {
    pt: "Manual",
    es: "Manual",
  },
  FINALIZAR: {
    pt: "Finalizar",
    es: "Finalizar",
  },
  NENHUM_PASSAGEIRO: {
    pt: "Nenhum passageiro nesta viagem",
    es: "Ningún pasajero en este viaje",
  },
  EMBARCADO: {
    pt: "Embarcado",
    es: "Embarcado",
  },
  PENDENTE: {
    pt: "Pendente",
    es: "Pendiente",
  },
  VOLTAR: {
    pt: "Voltar",
    es: "Volver",
  },
  ACESSO_BLOQUEADO: {
    pt: "Acesso Bloqueado",
    es: "Acceso Bloqueado",
  },
  APENAS_MOTORISTA: {
    pt: "Apenas o motorista responsável pode registrar embarques nesta viagem.",
    es: "Solo el conductor responsable puede registrar embarques en este viaje.",
  },
  SCAN_EMBARQUE: {
    pt: "Scan Embarque",
    es: "Scan Embarque",
  },
  SYNC_PENDING: {
    pt: "Sincronização pendente",
    es: "Sincronización pendiente",
  },
  SYNCING: {
    pt: "Sincronizando...",
    es: "Sincronizando...",
  },
  SYNC_SUCCESS: {
    pt: "Sincronização concluída",
    es: "Sincronización completada",
  },
  SYNC_CONFLICTS: {
    pt: "Sincronização concluída com conflitos",
    es: "Sincronización completada con conflictos",
  },
  VOUCHER_OFFLINE_RECORDED: {
    pt: "Voucher registrado offline. Sincronize quando houver internet.",
    es: "Voucher registrado offline. Sincronice cuando haya internet.",
  },
  GENDER_MISMATCH: {
    pt: "Gênero incompatível com a unidade",
    es: "Género incompatible con la unidad",
  },
  CAPACITY_FULL: {
    pt: "Unidade lotada",
    es: "Unidad llena",
  },
  CAPACITY_NOT_DEFINED: {
    pt: "Capacidade não definida (solicite à coordenação)",
    es: "Capacidad no definida (solicite a la coordinación)",
  },
  PRESENCE_SUCCESS: {
    pt: "Presença registrada!",
    es: "¡Presencia registrada!",
  },
};

export function getPwaLang(): PwaLang {
  if (typeof window === "undefined") return "pt";
  const stored = localStorage.getItem("pwa_lang");
  if (stored === "es" || stored === "pt") return stored;
  
  // Try browser language
  const browserLang = navigator.language.split("-")[0];
  if (browserLang === "es") return "es";
  
  return "pt";
}

export function setPwaLang(lang: PwaLang) {
  localStorage.setItem("pwa_lang", lang);
}

export function getPwaMessage(code: PwaMessageCode, lang?: PwaLang): string {
  const l = lang || getPwaLang();
  return MESSAGES[code][l] || MESSAGES[code]["pt"];
}

/**
 * @deprecated Prefira `voucherErrorMessage` de `@/lib/voucherMessages`
 * (dicionário único). Mantido como fachada para compatibilidade.
 */
export function getVoucherMessage(reason: string | undefined, lang?: PwaLang): string {
  return voucherErrorMessage(reason, lang).text;
}