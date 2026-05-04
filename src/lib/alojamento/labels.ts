// ============================================================
// Labels e tons unificados para o módulo Alojamento
// Auditoria: docs/modulos/alojamento-auditoria.md (Etapa 4)
//
// Antes desta lib, cada tela traduzia status/gender/severity por
// conta própria — daí divergências como "Masculino" vs "Masc."
// e status `planned`/`cancelled` aparecendo crus na UI. Aqui é
// o ponto único de tradução.
// ============================================================

export type LodgingStatusTone = "neutral" | "module" | "ok" | "danger" | "pending";

export interface LodgingLabel {
  label: string;
  tone: LodgingStatusTone;
}

// ------------------------------------------------------------
// lodging_occupancies.status
// ------------------------------------------------------------
// Valores aceitos pelo CHECK (Etapa 3):
//   planned, allocated, checked_in, checked_out, cancelled
// ------------------------------------------------------------

const STATUS_MAP: Record<string, LodgingLabel> = {
  planned:     { label: "Planejada",   tone: "neutral" },
  allocated:   { label: "Alocada",     tone: "module" },
  checked_in:  { label: "Check-in",    tone: "ok" },
  checked_out: { label: "Check-out",   tone: "neutral" },
  cancelled:   { label: "Cancelada",   tone: "danger" },
};

export function lodgingStatusLabel(status: string | null | undefined): LodgingLabel {
  if (!status) return { label: "—", tone: "neutral" };
  return STATUS_MAP[status] ?? { label: status, tone: "neutral" };
}

// ------------------------------------------------------------
// lodging_units.gender_restriction
// ------------------------------------------------------------
// Valores aceitos pelo CHECK (Etapa 3): male, female, mixed
// ------------------------------------------------------------

interface GenderLabelOptions {
  /** Se true, retorna versão curta ("Masc." em vez de "Masculino"). */
  short?: boolean;
}

const GENDER_LONG: Record<string, string> = {
  male:   "Masculino",
  female: "Feminino",
  mixed:  "Misto",
};

const GENDER_SHORT: Record<string, string> = {
  male:   "Masc.",
  female: "Fem.",
  mixed:  "Misto",
};

export function genderRestrictionLabel(
  gender: string | null | undefined,
  opts: GenderLabelOptions = {},
): string {
  if (!gender) return "—";
  const map = opts.short ? GENDER_SHORT : GENDER_LONG;
  return map[gender] ?? gender;
}

// ------------------------------------------------------------
// lodging_incidents.severity / category / status
// ------------------------------------------------------------

const SEVERITY_MAP: Record<string, LodgingLabel> = {
  baixa: { label: "Baixa", tone: "module" },
  media: { label: "Média", tone: "pending" },
  alta:  { label: "Alta",  tone: "danger" },
};

export function severityLabel(severity: string | null | undefined): LodgingLabel {
  if (!severity) return { label: "—", tone: "neutral" };
  return SEVERITY_MAP[severity] ?? { label: severity, tone: "neutral" };
}

const CATEGORY_LABELS: Record<string, string> = {
  geral:      "Geral",
  disciplina: "Disciplina",
  saude:      "Saúde",
  patrimonio: "Patrimônio",
  seguranca:  "Segurança",
};

const CATEGORY_TONES: Record<string, LodgingStatusTone> = {
  geral:      "neutral",
  disciplina: "module",
  saude:      "danger",
  patrimonio: "pending",
  seguranca:  "danger",
};

export function categoryLabel(category: string | null | undefined): LodgingLabel {
  if (!category) return { label: "—", tone: "neutral" };
  return {
    label: CATEGORY_LABELS[category] ?? category,
    tone: CATEGORY_TONES[category] ?? "neutral",
  };
}

const INCIDENT_STATUS_MAP: Record<string, LodgingLabel> = {
  aberta:         { label: "Aberta",         tone: "danger" },
  em_atendimento: { label: "Em atendimento", tone: "pending" },
  resolvida:      { label: "Resolvida",      tone: "ok" },
};

export function incidentStatusLabel(status: string | null | undefined): LodgingLabel {
  if (!status) return { label: "—", tone: "neutral" };
  return INCIDENT_STATUS_MAP[status] ?? { label: status, tone: "neutral" };
}

// ------------------------------------------------------------
// Helpers para UI shadcn
// ------------------------------------------------------------

/** Mapeia o tone para a `variant` do shadcn `<Badge>`. */
export function toneToBadgeVariant(
  tone: LodgingStatusTone,
): "default" | "secondary" | "destructive" | "outline" {
  switch (tone) {
    case "ok":      return "default";
    case "danger":  return "destructive";
    case "pending": return "secondary";
    case "module":  return "default";
    case "neutral":
    default:        return "outline";
  }
}

/** Classe Tailwind para texto colorido por tone (ex: badges destacados). */
export function toneToTextClass(tone: LodgingStatusTone): string {
  switch (tone) {
    case "ok":      return "text-emerald-600 dark:text-emerald-400";
    case "danger":  return "text-destructive";
    case "pending": return "text-amber-600 dark:text-amber-400";
    case "module":  return "text-module";
    case "neutral":
    default:        return "text-muted-foreground";
  }
}
