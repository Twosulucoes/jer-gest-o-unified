import { supabase } from "@/integrations/supabase/client";

export interface ResolvedCredential {
  participant_id: string;
  full_name: string | null;
  source:
    | "participant_credentials"
    | "external_credentials"
    | "cpf"
    | "people_qr_token";
  matched_by?: "qr_code_value" | "credential_code" | "external_credential" | "cpf";
  credential_code?: string | null;
}

const ACTIVE_EVENT_KEY = "jer_active_event_id";

function getActiveEventId(): string | null {
  try {
    return typeof window !== "undefined"
      ? window.localStorage.getItem(ACTIVE_EVENT_KEY)
      : null;
  } catch {
    return null;
  }
}

/**
 * Extrai possíveis identificadores de uma string escaneada (texto, JSON, URL).
 * Mesma lógica usada na edge function `validate-qr` para garantir paridade
 * entre validação centralizada e fluxos PWA (transporte/alimentação).
 */
export function extractCandidates(raw: string): {
  values: string[];
  cpfDigits: string | null;
} {
  const set = new Set<string>();
  const value = (raw ?? "").trim();
  if (!value) return { values: [], cpfDigits: null };
  set.add(value);

  // Variações canônicas (jer:event:participant:code) e legadas
  const canonicalMatch = value.match(/^jer:([^:]+):([^:]+):(.+)$/i);
  if (canonicalMatch) set.add(canonicalMatch[3]);
  if (/^JER-ALJ:/i.test(value)) set.add(value.replace(/^JER-ALJ:/i, ""));
  if (/^JER:/i.test(value)) set.add(value.replace(/^JER:/i, ""));

  // JSON?
  if (value.startsWith("{")) {
    try {
      const obj = JSON.parse(value);
      for (const k of [
        "qr",
        "qr_code",
        "qr_code_value",
        "code",
        "credential_code",
        "cpf",
        "id",
        "token",
      ]) {
        if (obj?.[k]) set.add(String(obj[k]).trim());
      }
    } catch {
      /* ignore */
    }
  }

  // URL?
  if (/^https?:\/\//i.test(value)) {
    try {
      const u = new URL(value);
      for (const k of ["qr", "code", "credential_code", "cpf", "id", "token"]) {
        const v = u.searchParams.get(k);
        if (v) set.add(v.trim());
      }
      const seg = u.pathname.split("/").filter(Boolean).pop();
      if (seg) set.add(seg);
    } catch {
      /* ignore */
    }
  }

  // Versão só com dígitos (útil p/ CPF) e uppercase para códigos
  const digits = value.replace(/\D/g, "");
  if (digits) set.add(digits);
  set.add(value.toUpperCase());

  const cpfDigits = digits.length === 11 ? digits : null;
  return { values: Array.from(set).filter(Boolean), cpfDigits };
}

function quoteList(values: string[]) {
  return values.map((v) => `"${v.replace(/"/g, '\\"')}"`).join(",");
}

/**
 * Resolver centralizado de credenciais por QR. Ordem:
 *  1. participant_credentials por qr_code_value OU credential_code (status active)
 *  2. external_credentials.credential_code (status active) → busca a credencial real
 *  3. CPF (11 dígitos) → people → participants → credencial mais recente
 *
 * Quando possível, escopa por `event_id` ativo para evitar ambiguidade entre eventos.
 */
export async function resolveQrCredential(
  rawValue: string,
  options?: { eventId?: string | null },
): Promise<ResolvedCredential | null> {
  const eventId = options?.eventId ?? getActiveEventId();
  const { values: candidates, cpfDigits } = extractCandidates(rawValue);
  if (candidates.length === 0) return null;

  const list = quoteList(candidates);

  // 1) participant_credentials
  {
    let q = supabase
      .from("participant_credentials")
      .select(
        "participant_id, qr_code_value, credential_code, event_id, status, participant:participants(person:people(full_name))",
      )
      .or(
        `qr_code_value.in.(${list}),credential_code.in.(${list})`,
      )
      .eq("status", "active");
    if (eventId) q = q.eq("event_id", eventId);

    const { data } = await q.limit(1).maybeSingle();
    if (data) {
      const matched = candidates.includes((data as any).qr_code_value)
        ? "qr_code_value"
        : "credential_code";
      return {
        participant_id: (data as any).participant_id,
        full_name: (data as any).participant?.person?.full_name ?? null,
        source: "participant_credentials",
        matched_by: matched,
        credential_code: (data as any).credential_code ?? null,
      };
    }
  }

  // 2) external_credentials
  {
    let q = supabase
      .from("external_credentials")
      .select(
        "participant_id, credential_code, event_id, status, participant:participants(person:people(full_name))",
      )
      .in("credential_code", candidates)
      .eq("status", "active");
    if (eventId) q = q.eq("event_id", eventId);

    const { data: ext } = await q.limit(1).maybeSingle();
    if (ext) {
      return {
        participant_id: (ext as any).participant_id,
        full_name: (ext as any).participant?.person?.full_name ?? null,
        source: "external_credentials",
        matched_by: "external_credential",
        credential_code: (ext as any).credential_code ?? null,
      };
    }
  }

  // 3) CPF → people → participants
  if (cpfDigits) {
    const cpfFmt = cpfDigits.replace(
      /(\d{3})(\d{3})(\d{3})(\d{2})/,
      "$1.$2.$3-$4",
    );
    const { data: person } = await supabase
      .from("people")
      .select("id, full_name")
      .or(`cpf.eq.${cpfDigits},cpf.eq.${cpfFmt}`)
      .limit(1)
      .maybeSingle();

    if (person) {
      let pq = supabase
        .from("participants")
        .select("id")
        .eq("person_id", (person as any).id);
      if (eventId) pq = pq.eq("event_id", eventId);

      const { data: part } = await pq.limit(1).maybeSingle();
      if (part) {
        // Tenta achar credencial real
        let cq = supabase
          .from("participant_credentials")
          .select("credential_code")
          .eq("participant_id", (part as any).id)
          .order("created_at", { ascending: false });
        if (eventId) cq = cq.eq("event_id", eventId);

        const { data: pc } = await cq.limit(1).maybeSingle();

        return {
          participant_id: (part as any).id,
          full_name: (person as any).full_name ?? null,
          source: "cpf",
          matched_by: "cpf",
          credential_code: (pc as any)?.credential_code ?? null,
        };
      }
    }
  }

  return null;
}

/**
 * Extrai um token "plano" de um QR escaneado para módulos baseados em RPC
 * (ex.: Alojamento usa `alojamento.resolve_qr` com `qr_tokens.token`).
 * Aceita formatos canônico, JER:/JER-ALJ: e textos curtos.
 */
export function extractQrToken(raw: string): string | null {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return null;

  const canonicalMatch = trimmed.match(/^jer:([^:]+):([^:]+):(.+)$/i);
  if (canonicalMatch) return canonicalMatch[3];

  if (/^JER-ALJ:/i.test(trimmed)) return trimmed.replace(/^JER-ALJ:/i, "");
  if (/^JER:/i.test(trimmed)) return trimmed.replace(/^JER:/i, "");

  // Tenta JSON
  if (trimmed.startsWith("{")) {
    try {
      const obj = JSON.parse(trimmed);
      for (const k of ["token", "qr", "code", "credential_code", "id"]) {
        if (obj?.[k]) return String(obj[k]).trim();
      }
    } catch {
      /* ignore */
    }
  }

  // Tenta URL
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const u = new URL(trimmed);
      for (const k of ["token", "qr", "code", "credential_code", "id"]) {
        const v = u.searchParams.get(k);
        if (v) return v.trim();
      }
      const seg = u.pathname.split("/").filter(Boolean).pop();
      if (seg) return seg;
    } catch {
      /* ignore */
    }
  }

  if (trimmed.length >= 4 && trimmed.length <= 128) return trimmed;
  return null;
}
