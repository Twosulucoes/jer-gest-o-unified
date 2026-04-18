import { useEventBranding } from "@/hooks/useEventBranding";

interface ReportFooterProps {
  eventId?: string | null;
  pageNumber?: number;
  totalPages?: number;
  generatedAt?: Date;
}

export function ReportFooter({ eventId, pageNumber, totalPages, generatedAt }: ReportFooterProps) {
  const { data } = useEventBranding(eventId);
  const when = generatedAt ?? new Date();

  const rodape = data?.rodape_texto ?? "";
  const localAno = data?.local_ano ?? "";

  const dateStr = when.toLocaleDateString("pt-BR");
  const timeStr = when.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  return (
    <footer className="w-full border-t border-border pt-3 mt-4 text-[11px] text-muted-foreground">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex-1 min-w-[200px]">
          {rodape && <p className="font-medium text-foreground/80">{rodape}</p>}
          {localAno && <p>{localAno}</p>}
        </div>
        <div className="text-right">
          <p>Gerado em {dateStr} às {timeStr}</p>
          {pageNumber !== undefined && (
            <p>
              Página {pageNumber}
              {totalPages !== undefined ? ` de ${totalPages}` : ""}
            </p>
          )}
        </div>
      </div>
    </footer>
  );
}

export default ReportFooter;
