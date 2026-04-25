import { useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft, Trophy, Users, Paperclip, Send,
  Trash2, Plus, Upload, FileText, Image, CheckCircle2,
} from "lucide-react";
import {
  usePartidaDetalhe,
  useArbitrosPartida,
  useAdicionarArbitro,
  useRemoverArbitro,
  useAnexosPartida,
  useUploadAnexo,
  useDeleteAnexo,
  useSalvarPlacar,
  usePublicarResultado,
  ROLES_ARBITRAGEM,
  TIPOS_ANEXO,
  type EntradaPartida,
} from "@/hooks/useLancamentoResultados";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nomeEntrada(e: EntradaPartida): string {
  return e.team?.name ?? e.participantName ?? "—";
}

const STATUS_LABELS: Record<string, string> = {
  agendada: "Agendada",
  em_andamento: "Em andamento",
  finalizada: "Finalizada",
  publicado: "Publicado",
  cancelada: "Cancelada",
};

const STATUS_COLORS: Record<string, string> = {
  agendada: "bg-slate-100 text-slate-700",
  em_andamento: "bg-blue-100 text-blue-700",
  finalizada: "bg-emerald-100 text-emerald-700",
  publicado: "bg-green-100 text-green-700",
  cancelada: "bg-red-100 text-red-700",
};

// ─── Tab Placar ───────────────────────────────────────────────────────────────

function TabPlacar({ matchId, entries }: { matchId: string; entries: EntradaPartida[] }) {
  const salvar = useSalvarPlacar(matchId);

  const [scores, setScores] = useState<Record<string, { scoreFinal: string; outcome: string }>>(() =>
    Object.fromEntries(entries.map((e) => [e.id, {
      scoreFinal: e.score?.score_final ?? "",
      outcome: e.score?.outcome ?? "",
    }]))
  );

  const handleSave = () => {
    const payload = entries.map((e) => ({
      entryId: e.id,
      scoreFinal: scores[e.id]?.scoreFinal ?? "",
      outcome: scores[e.id]?.outcome ?? "",
    }));
    salvar.mutate(payload);
  };

  return (
    <div className="space-y-4">
      {entries.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">
          Nenhum participante cadastrado nesta partida.
        </p>
      )}

      {entries.map((entry, idx) => (
        <div key={entry.id} className="bg-card border rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
              {idx + 1}
            </div>
            <span className="font-semibold text-sm flex-1 truncate">{nomeEntrada(entry)}</span>
            {entry.side === "home" && (
              <Badge variant="outline" className="text-[10px]">Mandante</Badge>
            )}
            {entry.side === "away" && (
              <Badge variant="outline" className="text-[10px]">Visitante</Badge>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Placar</Label>
              <Input
                type="text"
                inputMode="numeric"
                placeholder="0"
                value={scores[entry.id]?.scoreFinal ?? ""}
                onChange={(e) =>
                  setScores((prev) => ({ ...prev, [entry.id]: { ...prev[entry.id], scoreFinal: e.target.value } }))
                }
                className="h-11 text-lg font-bold text-center"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Resultado</Label>
              <Select
                value={scores[entry.id]?.outcome ?? ""}
                onValueChange={(v) =>
                  setScores((prev) => ({ ...prev, [entry.id]: { ...prev[entry.id], outcome: v } }))
                }
              >
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vitoria">Vitória</SelectItem>
                  <SelectItem value="derrota">Derrota</SelectItem>
                  <SelectItem value="empate">Empate</SelectItem>
                  <SelectItem value="wo">W.O.</SelectItem>
                  <SelectItem value="dq">Desclassificado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      ))}

      {entries.length > 0 && (
        <Button
          className="w-full h-12 text-base font-semibold"
          onClick={handleSave}
          disabled={salvar.isPending}
        >
          {salvar.isPending ? "Salvando..." : "Salvar Placar"}
        </Button>
      )}
    </div>
  );
}

// ─── Tab Arbitragem ───────────────────────────────────────────────────────────

function TabArbitragem({ matchId }: { matchId: string }) {
  const { data: arbitros = [], isLoading } = useArbitrosPartida(matchId);
  const adicionar = useAdicionarArbitro(matchId);
  const remover = useRemoverArbitro(matchId);

  const [nome, setNome] = useState("");
  const [role, setRole] = useState("");

  const handleAdd = () => {
    if (!nome.trim() || !role) return;
    adicionar.mutate({ name: nome.trim(), role }, {
      onSuccess: () => { setNome(""); setRole(""); },
    });
  };

  return (
    <div className="space-y-4">
      {/* Formulário de adição */}
      <div className="bg-card border rounded-xl p-4 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Adicionar membro da arbitragem
        </p>
        <div className="space-y-2">
          <Input
            placeholder="Nome completo"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="h-11"
          />
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger className="h-11">
              <SelectValue placeholder="Função" />
            </SelectTrigger>
            <SelectContent>
              {ROLES_ARBITRAGEM.map((r) => (
                <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            className="w-full h-11"
            onClick={handleAdd}
            disabled={!nome.trim() || !role || adicionar.isPending}
            variant="secondary"
          >
            <Plus className="h-4 w-4 mr-2" />
            Adicionar
          </Button>
        </div>
      </div>

      {/* Lista de árbitros */}
      {isLoading && <Skeleton className="h-14 w-full" />}

      {!isLoading && arbitros.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          Nenhum membro adicionado ainda.
        </p>
      )}

      <div className="space-y-2">
        {arbitros.map((a) => {
          const roleLabel = ROLES_ARBITRAGEM.find((r) => r.value === a.role)?.label ?? a.role;
          return (
            <div key={a.id} className="flex items-center gap-3 bg-card border rounded-xl px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{a.name}</p>
                <p className="text-xs text-muted-foreground">{roleLabel}</p>
              </div>
              <button
                onClick={() => remover.mutate(a.id)}
                className="text-destructive p-1 active:opacity-60 shrink-0"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Tab Anexos ───────────────────────────────────────────────────────────────

function TabAnexos({ matchId }: { matchId: string }) {
  const { data: anexos = [], isLoading } = useAnexosPartida(matchId);
  const upload = useUploadAnexo(matchId);
  const deletar = useDeleteAnexo(matchId);

  const fileRef = useRef<HTMLInputElement>(null);
  const [tipoSelecionado, setTipoSelecionado] = useState("sumula");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    upload.mutate({ file, tipo: tipoSelecionado });
    e.target.value = "";
  };

  const isImage = (url: string) => /\.(jpg|jpeg|png|gif|webp)$/i.test(url);

  return (
    <div className="space-y-4">
      {/* Upload */}
      <div className="bg-card border rounded-xl p-4 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Anexar arquivo
        </p>
        <Select value={tipoSelecionado} onValueChange={setTipoSelecionado}>
          <SelectTrigger className="h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIPOS_ANEXO.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <input
          ref={fileRef}
          type="file"
          accept="image/*,.pdf"
          className="hidden"
          onChange={handleFileChange}
        />
        <Button
          variant="secondary"
          className="w-full h-11"
          onClick={() => fileRef.current?.click()}
          disabled={upload.isPending}
        >
          <Upload className="h-4 w-4 mr-2" />
          {upload.isPending ? "Enviando..." : "Selecionar arquivo"}
        </Button>
      </div>

      {/* Lista de anexos */}
      {isLoading && <Skeleton className="h-14 w-full" />}

      {!isLoading && anexos.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          Nenhum arquivo anexado ainda.
        </p>
      )}

      <div className="space-y-2">
        {anexos.map((a) => {
          const tipoLabel = TIPOS_ANEXO.find((t) => t.value === a.file_type)?.label ?? a.file_type;
          return (
            <div key={a.id} className="flex items-center gap-3 bg-card border rounded-xl px-4 py-3">
              <div className="shrink-0 text-muted-foreground">
                {isImage(a.file_url) ? <Image className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{a.file_name}</p>
                <p className="text-xs text-muted-foreground">{tipoLabel}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <a
                  href={a.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary p-1 active:opacity-60"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Paperclip className="h-4 w-4" />
                </a>
                <button
                  onClick={() => deletar.mutate(a.id)}
                  className="text-destructive p-1 active:opacity-60"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Tab Publicar ─────────────────────────────────────────────────────────────

function TabPublicar({
  matchId,
  sportEventId,
  matchStatus,
}: {
  matchId: string;
  sportEventId: string | null;
  matchStatus: string;
}) {
  const publicar = usePublicarResultado(matchId);
  const [boletimTitulo, setBoletimTitulo] = useState(
    `Resultados — ${new Date().toLocaleDateString("pt-BR")}`
  );
  const [incluirBoletim, setIncluirBoletim] = useState(false);

  const isPublicado = matchStatus === "publicado";
  const isFinalizada = matchStatus === "finalizada" || isPublicado;

  const handlePublicar = () => {
    if (!sportEventId) return;
    publicar.mutate({
      sportEventId,
      boletimTitulo: incluirBoletim ? boletimTitulo : undefined,
    });
  };

  return (
    <div className="space-y-4">
      {/* Status atual */}
      <div className="bg-card border rounded-xl p-4 space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Status da partida
        </p>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[matchStatus] ?? "bg-slate-100 text-slate-700"}`}>
            {STATUS_LABELS[matchStatus] ?? matchStatus}
          </span>
        </div>
        {isPublicado && (
          <div className="flex items-center gap-2 text-green-700 text-sm">
            <CheckCircle2 className="h-4 w-4" />
            <span>Resultado publicado no portal</span>
          </div>
        )}
      </div>

      {/* Opção de boletim */}
      {!isPublicado && (
        <div className="bg-card border rounded-xl p-4 space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={incluirBoletim}
              onChange={(e) => setIncluirBoletim(e.target.checked)}
              className="h-4 w-4 rounded"
            />
            <span className="text-sm font-medium">Incluir no Boletim do Dia</span>
          </label>
          {incluirBoletim && (
            <Input
              value={boletimTitulo}
              onChange={(e) => setBoletimTitulo(e.target.value)}
              placeholder="Título do boletim"
              className="h-11"
            />
          )}
        </div>
      )}

      {/* Botão publicar */}
      {!isPublicado && (
        <Button
          className="w-full h-12 text-base font-semibold"
          onClick={handlePublicar}
          disabled={publicar.isPending || !sportEventId || !isFinalizada}
        >
          <Send className="h-4 w-4 mr-2" />
          {publicar.isPending
            ? "Publicando..."
            : isFinalizada
            ? "Publicar no Portal"
            : "Salve o placar antes de publicar"}
        </Button>
      )}

      {!isFinalizada && (
        <p className="text-xs text-muted-foreground text-center">
          Salve o placar na aba "Placar" para habilitar a publicação.
        </p>
      )}
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function ResultadosPartidaFormPage() {
  const navigate = useNavigate();
  const { matchId } = useParams<{ matchId: string }>();

  const { data: match, isLoading } = usePartidaDetalhe(matchId ?? null);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="flex items-center gap-3 border-b bg-card px-4 h-14 shrink-0">
          <button onClick={() => navigate(-1)} className="text-muted-foreground p-1 -ml-1">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <Skeleton className="h-4 w-32" />
        </header>
        <main className="p-4 space-y-4">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </main>
      </div>
    );
  }

  if (!match || !matchId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Partida não encontrada.</p>
      </div>
    );
  }

  const [entryA, entryB] = match.entries;
  const nomeA = entryA ? nomeEntrada(entryA) : "—";
  const nomeB = entryB ? nomeEntrada(entryB) : null;
  const contexto = [match.phase?.name, match.group?.name].filter(Boolean).join(" • ");
  const hora = match.start_time ? match.start_time.slice(0, 5) : null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="flex items-center gap-3 border-b bg-card px-4 h-14 shrink-0">
        <button
          onClick={() => navigate(-1)}
          className="text-muted-foreground p-1 -ml-1 active:opacity-60"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <Trophy className="h-5 w-5 text-primary shrink-0" />
        <span className="font-semibold text-foreground truncate">
          {match.match_number ? `Jogo ${match.match_number}` : "Partida"}
        </span>
        <span className={`ml-auto inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${STATUS_COLORS[match.status] ?? "bg-slate-100 text-slate-700"}`}>
          {STATUS_LABELS[match.status] ?? match.status}
        </span>
      </header>

      {/* Card resumo */}
      <div className="bg-card border-b px-4 py-3 flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="font-bold text-sm truncate flex-1 mr-2">{nomeA}</span>
          {entryA?.score?.score_final != null && (
            <span className="text-2xl font-black tabular-nums">{entryA.score.score_final}</span>
          )}
        </div>
        {nomeB && (
          <div className="flex items-center justify-between">
            <span className="font-medium text-sm text-muted-foreground truncate flex-1 mr-2">{nomeB}</span>
            {entryB?.score?.score_final != null && (
              <span className="text-2xl font-black tabular-nums text-muted-foreground">{entryB.score.score_final}</span>
            )}
          </div>
        )}
        {(hora || contexto) && (
          <p className="text-xs text-muted-foreground">
            {[hora, contexto].filter(Boolean).join(" • ")}
          </p>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="placar" className="flex-1 flex flex-col">
        <TabsList className="w-full rounded-none border-b h-11 bg-background shrink-0 grid grid-cols-4">
          <TabsTrigger value="placar" className="flex items-center gap-1 text-xs">
            <Trophy className="h-3.5 w-3.5" />
            Placar
          </TabsTrigger>
          <TabsTrigger value="arbitros" className="flex items-center gap-1 text-xs">
            <Users className="h-3.5 w-3.5" />
            Árbitros
          </TabsTrigger>
          <TabsTrigger value="anexos" className="flex items-center gap-1 text-xs">
            <Paperclip className="h-3.5 w-3.5" />
            Anexos
          </TabsTrigger>
          <TabsTrigger value="publicar" className="flex items-center gap-1 text-xs">
            <Send className="h-3.5 w-3.5" />
            Publicar
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-y-auto">
          <TabsContent value="placar" className="p-4 mt-0">
            <TabPlacar matchId={matchId} entries={match.entries} />
          </TabsContent>

          <TabsContent value="arbitros" className="p-4 mt-0">
            <TabArbitragem matchId={matchId} />
          </TabsContent>

          <TabsContent value="anexos" className="p-4 mt-0">
            <TabAnexos matchId={matchId} />
          </TabsContent>

          <TabsContent value="publicar" className="p-4 mt-0">
            <TabPublicar
              matchId={matchId}
              sportEventId={match.sport_event_id}
              matchStatus={match.status}
            />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
