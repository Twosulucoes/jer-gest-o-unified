import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { toast } from "sonner";

import { ENQUETE_FASES, type EnqueteFase, type EnqueteApuracaoRow } from "@/lib/enquete";

const FASE_LABELS: Record<EnqueteFase, string> = {
  cadastro: "Cadastro",
  votacao: "Votação",
  apurada: "Apurada",
  encerrada: "Encerrada",
};

const MEDALHAS: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };
const VOLTAS_ROLETA = 24;
const INTERVALO_ROLETA_MS = 90;

interface SorteioCandidato {
  id: string;
  nome: string;
  numero_sorte: number;
}

export default function EnqueteDirecaoPage() {
  const { user } = useAuth();

  const [fase, setFase] = useState<EnqueteFase | null>(null);
  const [alterandoFase, setAlterandoFase] = useState(false);

  const [cadastrados, setCadastrados] = useState<number | null>(null);
  const [votos, setVotos] = useState<number | null>(null);
  const [carregandoMetricas, setCarregandoMetricas] = useState(true);

  const [candidatosSorteio, setCandidatosSorteio] = useState<SorteioCandidato[]>([]);
  const [sorteando, setSorteando] = useState(false);
  const [nomeRoleta, setNomeRoleta] = useState<string | null>(null);
  const [vencedor, setVencedor] = useState<SorteioCandidato | null>(null);
  const roletaIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [apuracao, setApuracao] = useState<EnqueteApuracaoRow[]>([]);
  const [carregandoApuracao, setCarregandoApuracao] = useState(false);

  useEffect(() => {
    carregarFase();
    carregarMetricas();
    carregarCandidatosSorteio();

    return () => {
      if (roletaIntervalRef.current) clearInterval(roletaIntervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function carregarFase() {
    const { data, error } = await (supabase as any)
      .from("enq_config")
      .select("fase")
      .eq("id", 1)
      .maybeSingle();

    if (!error && data) setFase(data.fase);
  }

  async function carregarMetricas() {
    setCarregandoMetricas(true);

    const [cadastradosRes, votosRes] = await Promise.all([
      (supabase as any)
        .from("enq_participantes")
        .select("id", { count: "exact", head: true })
        .eq("cadastro_completo", true),
      (supabase as any).from("enq_votos").select("id", { count: "exact", head: true }),
    ]);

    setCadastrados(cadastradosRes.count ?? 0);
    setVotos(votosRes.count ?? 0);
    setCarregandoMetricas(false);
  }

  async function carregarCandidatosSorteio() {
    const { data, error } = await (supabase as any)
      .from("enq_participantes")
      .select("id, nome, numero_sorte")
      .eq("cadastro_completo", true)
      .not("numero_sorte", "is", null);

    if (!error) setCandidatosSorteio(data || []);
  }

  async function trocarFase(novaFase: EnqueteFase) {
    setAlterandoFase(true);

    try {
      const { error } = await (supabase as any)
        .from("enq_config")
        .update({ fase: novaFase })
        .eq("id", 1);

      if (error) throw error;

      setFase(novaFase);
      toast.success(`Fase alterada para "${FASE_LABELS[novaFase]}".`);
    } catch (err: any) {
      console.error(err);
      toast.error(
        err?.message || "Não foi possível alterar a fase. Confirme que está logado como admin."
      );
    } finally {
      setAlterandoFase(false);
    }
  }

  function sortear() {
    if (candidatosSorteio.length === 0 || sorteando) return;

    setVencedor(null);
    setSorteando(true);

    let voltas = 0;

    roletaIntervalRef.current = setInterval(() => {
      const aleatorio = candidatosSorteio[Math.floor(Math.random() * candidatosSorteio.length)];
      setNomeRoleta(aleatorio.nome);
      voltas += 1;

      if (voltas >= VOLTAS_ROLETA) {
        if (roletaIntervalRef.current) clearInterval(roletaIntervalRef.current);

        const sorteado = candidatosSorteio[Math.floor(Math.random() * candidatosSorteio.length)];
        setNomeRoleta(sorteado.nome);
        setVencedor(sorteado);
        setSorteando(false);
      }
    }, INTERVALO_ROLETA_MS);
  }

  async function carregarApuracao() {
    setCarregandoApuracao(true);

    try {
      const { data, error } = await (supabase as any).rpc("enq_apuracao");
      if (error) throw error;
      setApuracao(data || []);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Erro ao carregar apuração.");
    } finally {
      setCarregandoApuracao(false);
    }
  }

  const gruposApuracao = useMemo(() => {
    const mapa = new Map<string, EnqueteApuracaoRow[]>();

    for (const linha of apuracao) {
      const lista = mapa.get(linha.categoria) ?? [];
      lista.push(linha);
      mapa.set(linha.categoria, lista);
    }

    return Array.from(mapa.entries()).map(([categoria, linhas]) => {
      const ordenadas = [...linhas].sort((a, b) => a.posicao - b.posicao);
      const empatados = ordenadas.filter((linha) => linha.posicao === 1);

      return {
        categoria,
        emoji: ordenadas[0]?.emoji,
        linhas: ordenadas,
        empate: empatados.length > 1,
        empatados,
      };
    });
  }, [apuracao]);

  return (
    <div className="min-h-screen bg-muted/30 p-4 pb-10">
      <div className="mx-auto max-w-2xl space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Painel da Direção — Enquete JER 2026</h1>
          {!user && (
            <p className="mt-1 text-sm text-amber-600">
              Você não está logado. Ações de administração (troca de fase) exigem login de admin.
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold">{carregandoMetricas ? "-" : cadastrados}</p>
              <p className="text-xs text-muted-foreground">Cadastrados</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold">{carregandoMetricas ? "-" : votos}</p>
              <p className="text-xs text-muted-foreground">Votos registrados</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Fase da enquete</CardTitle>
          </CardHeader>

          <CardContent className="flex flex-wrap gap-2">
            {ENQUETE_FASES.map((f) => (
              <Button
                key={f}
                size="sm"
                variant={fase === f ? "default" : "outline"}
                disabled={alterandoFase || !user}
                onClick={() => trocarFase(f)}
              >
                {FASE_LABELS[f]}
              </Button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sorteio</CardTitle>
          </CardHeader>

          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              {candidatosSorteio.length} participante{candidatosSorteio.length === 1 ? "" : "s"} com
              número da sorte.
            </p>

            <div className="rounded-lg border bg-background p-6 text-center">
              <p className="text-2xl font-bold">{nomeRoleta ?? "?"}</p>
            </div>

            {vencedor && (
              <div className="rounded-lg border bg-green-50 p-3 text-center">
                <p className="text-xs text-muted-foreground">Vencedor(a)</p>
                <p className="font-bold text-green-700">
                  {vencedor.nome} — nº {vencedor.numero_sorte}
                </p>
              </div>
            )}

            <Button
              className="w-full"
              disabled={sorteando || candidatosSorteio.length === 0}
              onClick={sortear}
            >
              {sorteando ? "Sorteando..." : "Sortear"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Apuração por categoria</CardTitle>
            <Button
              size="sm"
              variant="outline"
              disabled={carregandoApuracao}
              onClick={carregarApuracao}
            >
              {carregandoApuracao ? "Calculando..." : "Calcular apuração"}
            </Button>
          </CardHeader>

          <CardContent className="space-y-4">
            {gruposApuracao.length === 0 && (
              <p className="text-center text-sm text-muted-foreground">
                Clique em "Calcular apuração" para ver o resultado.
              </p>
            )}

            {gruposApuracao.map((grupo) => (
              <div key={grupo.categoria} className="rounded-lg border p-3">
                <p className="font-semibold">
                  {grupo.emoji} {grupo.categoria}
                </p>

                {grupo.empate && (
                  <p className="mt-1 text-xs font-medium text-amber-600">
                    Empate em 1º lugar: {grupo.empatados.map((e) => e.participante).join(", ")}
                  </p>
                )}

                <div className="mt-2 space-y-1">
                  {grupo.linhas.map((linha, idx) => (
                    <div
                      key={`${grupo.categoria}-${linha.participante}-${idx}`}
                      className="flex items-center justify-between text-sm"
                    >
                      <span>
                        {MEDALHAS[linha.posicao] ?? `${linha.posicao}º`} {linha.participante}
                        {linha.orgao && (
                          <span className="text-xs text-muted-foreground"> · {linha.orgao}</span>
                        )}
                      </span>
                      <span className="font-semibold">{linha.votos} votos</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
