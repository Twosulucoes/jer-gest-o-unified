import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface BrandingLogo {
  path: string; // caminho no bucket report-assets
  label: string;
  active: boolean;
  order: number;
}

export interface EventBranding {
  event_id: string;
  logos: BrandingLogo[];
  nome_oficial: string | null;
  subtitulo: string | null;
  rodape_texto: string | null;
  local_ano: string | null;
  assinatura_nome: string | null;
  assinatura_cargo: string | null;
  updated_at?: string;
}

export interface BrandingLogoWithUrl extends BrandingLogo {
  url: string;
}

export interface EventBrandingResolved extends Omit<EventBranding, "logos"> {
  logos: BrandingLogoWithUrl[];
  fallbackEventName?: string;
}

function publicUrl(path: string): string {
  if (!path) return "";
  const { data } = supabase.storage.from("report-assets").getPublicUrl(path);
  return data.publicUrl;
}

export function useEventBranding(eventId?: string | null) {
  return useQuery<EventBrandingResolved | null>({
    queryKey: ["event-branding", eventId],
    enabled: !!eventId,
    staleTime: 60_000,
    queryFn: async () => {
      if (!eventId) return null;

      const [{ data: branding }, { data: ev }] = await Promise.all([
        supabase.from("event_branding").select("*").eq("event_id", eventId).maybeSingle(),
        supabase.from("events").select("name").eq("id", eventId).maybeSingle(),
      ]);

      const fallbackEventName = ev?.name ?? undefined;

      if (!branding) {
        return {
          event_id: eventId,
          logos: [],
          nome_oficial: null,
          subtitulo: null,
          rodape_texto: null,
          local_ano: null,
          assinatura_nome: null,
          assinatura_cargo: null,
          fallbackEventName,
        };
      }

      const rawLogos = Array.isArray(branding.logos) ? (branding.logos as unknown as BrandingLogo[]) : [];
      const logos: BrandingLogoWithUrl[] = rawLogos
        .filter((l) => l && l.path)
        .map((l) => ({ ...l, url: publicUrl(l.path) }))
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

      return {
        event_id: branding.event_id,
        logos,
        nome_oficial: branding.nome_oficial,
        subtitulo: branding.subtitulo,
        rodape_texto: branding.rodape_texto,
        local_ano: branding.local_ano,
        assinatura_nome: branding.assinatura_nome,
        assinatura_cargo: branding.assinatura_cargo,
        updated_at: branding.updated_at,
        fallbackEventName,
      };
    },
  });
}
