
export type PwaMessageCode =
  | "ERR_NOT_FOUND"
  | "ERR_ALREADY_REGISTERED"
  | "ERR_SESSION_EXPIRED"
  | "ERR_WINDOW_REQUIRED"
  | "ERR_LIMIT_REACHED"
  | "ERR_UNKNOWN"
  | "ERR_NAME_REQUIRED"
  | "SUCCESS_REGISTERED"
  | "SUCCESS_BOARDING"
  | "ALREADY_BOARDED"
  | "SEARCH_PLACEHOLDER"
  | "NO_RESULTS"
  | "MANUAL_SEARCH"
  | "QR_VALID"
  | "VOUCHER_NOT_FOUND"
  | "VOUCHER_INACTIVE"
  | "VOUCHER_EXPIRED"
  | "VOUCHER_NOT_YET_VALID"
  | "VOUCHER_SCOPE_DENIED"
  | "VOUCHER_MAX_USES"
  | "MANUAL_BOARDING"
  | "FULL_NAME"
  | "PASSENGER_NAME_PLACEHOLDER"
  | "TAKE_PHOTO"
  | "SAVING"
  | "REGISTER_BOARDING"
  | "CANCEL"
  | "SEARCH_MANUALLY"
  | "CHECKIN_SUCCESS"
  | "CHECKOUT_SUCCESS"
  | "ERR_INVALID_QR"
  | "ERR_SELECT_FACILITY"
  | "ERR_UNDER_12"
  | "ERR_ALREADY_STAYING"
  | "ERR_NOT_STAYING";

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
    pt: "QR válido",
    es: "QR válido",
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

export function getVoucherMessage(reason: string | undefined, lang?: PwaLang): string {
  const l = lang || getPwaLang();
  switch (reason) {
    case "not_found": return getPwaMessage("VOUCHER_NOT_FOUND", l);
    case "inactive": return getPwaMessage("VOUCHER_INACTIVE", l);
    case "expired": return getPwaMessage("VOUCHER_EXPIRED", l);
    case "not_yet_valid": return getPwaMessage("VOUCHER_NOT_YET_VALID", l);
    case "scope_denied": return getPwaMessage("VOUCHER_SCOPE_DENIED", l);
    case "max_uses_reached": return getPwaMessage("VOUCHER_MAX_USES", l);
    default: return reason || getPwaMessage("ERR_UNKNOWN", l);
  }
}
