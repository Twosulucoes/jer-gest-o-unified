import { useNavigate, useSearchParams } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ClipboardList, ChevronRight, Calendar } from "lucide-react";
import { PwaHeader } from "@/components/pwa/PwaHeader";
import { format, parseISO, isToday, isTomorrow, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { usePartidasModalidade, type PartidaItem } from "@/hooks/useLancamentoResultados";

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  agendada:     { label: "Agendada",     variant: "outline" },
  em_andamento: { label: "Em andamento", variant: "default" },
  finalizada:   { label: "Finalizada",   variant: "secondary" },
  publicado:    { label: "Publicado",    variant: "secondary" },
  cancelada:    { label: "Cancelada",    variant: "destructive" },
};

function getParticipantLabel(entry: PartidaItem["entries"][number]): string {
  return entry.team?.name ?? entry.participantName ?? "—";
}

function formatDate(dateStr: string): string {
  const d = parseISO(dateStr);
  if (isToday(d)) return "Hoje";
  if (isTomorrow(d)) return "Amanhã";
  if (isYesterday(d)) return "Ontem";
  return format(d, "EEE, dd/MM", { locale: ptBR });
}

function groupByDate(partidas: PartidaItem[]): Map<string, PartidaItem[]> {
  const map = new Map<string, PartidaItem[]>();
  for (const p of partidas) {
    const key = p.match_date ?? "Sem data";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(p);
  }
  return map;
}

export default function ResultadosPartidasPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const sportEventId = params.get("se");

  const { data: partidas = [], isLoading } = usePartidasModalidade(sportEventId);
  const grouped = groupByDate(partidas);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <PwaHeader title="Partidas" icon={ClipboardList} backTo="/pwa/resultados" />

      <main className="flex-1 p-4 max-w-md mx-auto w-full space-y-5">
        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
          </div>
        )}

        {!isLoading && partidas.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center space-y-2">
            <Calendar className="h-10 w-10 text-muted-foreground/40" />
            <p className="font-medium text-foreground">Nenhuma partida encontrada</p>
            <p className="text-xs text-muted-foreground">
              As partidas serão listadas assim que forem cadastradas pelo administrador.
            </p>
          </div>
        )}

        {Array.from(grouped.entries()).map(([dateKey, items]) => (
          <section key={dateKey} className="space-y-2">
            {/* Cabeçalho do grupo de data */}
            <div className="flex items-center gap-2 px-1">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                {dateKey !== "Sem data" ? formatDate(dateKey) : "Sem data"}
              </span>
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground">{items.length} partida{items.length !== 1 ? "s" : ""}</span>
            </div>

            {/* Cards de partida */}
            {items.map((p) => {
              const cfg = STATUS_CONFIG[p.status] ?? { label: p.status, variant: "outline" as const };
              const [entryA, entryB] = p.entries;
              const nameA = entryA ? getParticipantLabel(entryA) : "—";
              const nameB = entryB ? getParticipantLabel(entryB) : null;
              const scoreA = entryA?.score?.score_final;
              const scoreB = entryB?.score?.score_final;
              const hasScore = scoreA != null || scoreB != null;
              const hora = p.start_time ? p.start_time.slice(0, 5) : null;
              const contexto = [p.phase?.name, p.group?.name].filter(Boolean).join(" • ");

              return (
                <button
                  key={p.id}
                  onClick={() => navigate(`/pwa/resultados/partida/${p.id}`)}
                  className="w-full bg-card border rounded-xl text-left active:scale-[0.98] transition-transform hover:bg-accent/30"
                >
                  <div className="p-4 space-y-2">
                    {/* Topo: hora + contexto + status */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {hora && (
                          <span className="text-xs font-bold text-primary shrink-0">{hora}</span>
                        )}
                        {contexto && (
                          <span className="text-xs text-muted-foreground truncate">{contexto}</span>
                        )}
                      </div>
                      <Badge variant={cfg.variant} className="shrink-0 text-[10px]">{cfg.label}</Badge>
                    </div>

                    {/* Participantes e placar */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{nameA}</p>
                        {nameB && (
                          <p className="font-semibold text-sm truncate text-muted-foreground">{nameB}</p>
                        )}
                      </div>

                      {hasScore ? (
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-xl font-black tabular-nums">{scoreA ?? "—"}</span>
                          {nameB && (
                            <>
                              <span className="text-sm text-muted-foreground font-medium">×</span>
                              <span className="text-xl font-black tabular-nums">{scoreB ?? "—"}</span>
                            </>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-muted-foreground shrink-0">
                          <span className="text-xs">Sem placar</span>
                          <ChevronRight className="h-3 w-3" />
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </section>
        ))}
      </main>
    </div>
  );
}
