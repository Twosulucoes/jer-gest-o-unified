import { useEventBranding, type BrandingLogoWithUrl } from "@/hooks/useEventBranding";

interface ReportHeaderProps {
  eventId?: string | null;
  /** Permite passar logos/textos diretamente (preview ao vivo). Quando definido, ignora a query. */
  override?: {
    logos?: BrandingLogoWithUrl[];
    nome_oficial?: string | null;
    subtitulo?: string | null;
    fallbackEventName?: string;
  };
}

export function ReportHeader({ eventId, override }: ReportHeaderProps) {
  const { data } = useEventBranding(override ? null : eventId);

  const logos = (override?.logos ?? data?.logos ?? []).filter((l) => l.active && l.url);
  const nome = override?.nome_oficial ?? data?.nome_oficial ?? data?.fallbackEventName ?? override?.fallbackEventName ?? "Evento";
  const subtitulo = override?.subtitulo ?? data?.subtitulo ?? null;

  return (
    <header className="w-full border-b border-border pb-4 mb-4">
      {logos.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-8 mb-3">
          {logos.map((logo, idx) => (
            <img
              key={`${logo.path}-${idx}`}
              src={logo.url}
              alt={logo.label || `Logo ${idx + 1}`}
              className="h-16 max-w-[180px] object-contain"
              crossOrigin="anonymous"
            />
          ))}
        </div>
      )}
      <div className="text-center">
        <h1 className="font-heading text-xl font-bold text-foreground leading-tight">
          {nome}
        </h1>
        {subtitulo && (
          <p className="text-sm text-muted-foreground mt-1">{subtitulo}</p>
        )}
      </div>
    </header>
  );
}

export default ReportHeader;
