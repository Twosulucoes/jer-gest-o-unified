import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Search } from "lucide-react";

import { phoneMask, normalizeTelefone, type EnqueteVotarResult } from "@/lib/enquete";

type Fase = "cadastro" | "votacao" | "apurada" | "encerrada" | null;

interface Votante {
  id: string;
  nome: string;
  telefone: string;
}

interface Categoria {
  id: string;
  nome: string;
  emoji: string | null;
  descricao: string | null;
  ordem: number;
}

interface Candidato {
  id: string;
  nome: string;
  orgao: string | null;
}

export default function EnqueteVotarPage() {
  const [fase, setFase] = useState<Fase>(null);
  const [carregandoFase, setCarregandoFase] = useState(true);

  const [whatsapp, setWhatsapp] = useState("");
  const [validandoTelefone, setValidandoTelefone] = useState(false);
  const [votante, setVotante] = useState<Votante | null>(null);

  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [candidatos, setCandidatos] = useState<Candidato[]>([]);
  const [carregandoDados, setCarregandoDados] = useState(false);

  const [indiceAtual, setIndiceAtual] = useState(0);
  const [busca, setBusca] = useState("");
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const [votando, setVotando] = useState(false);
  const [concluido, setConcluido] = useState(false);

  useEffect(() => {
    async function carregarFase() {
      const { data, error } = await (supabase as any)
        .from("enq_config")
        .select("fase")
        .eq("id", 1)
        .maybeSingle();

      if (!error && data) setFase(data.fase);
      setCarregandoFase(false);
    }

    carregarFase();
  }, []);

  const categoriaAtual = categorias[indiceAtual] ?? null;
  const totalCategorias = categorias.length;
  const progresso = totalCategorias > 0 ? Math.round((indiceAtual / totalCategorias) * 100) : 0;

  const candidatosFiltrados = useMemo(() => {
    if (!votante) return [];
    const termo = busca.trim().toLowerCase();
    return candidatos
      .filter((c) => c.id !== votante.id)
      .filter((c) => !termo || c.nome.toLowerCase().includes(termo));
  }, [candidatos, busca, votante]);

  async function validarTelefone() {
    const telefone = normalizeTelefone(whatsapp);

    if (telefone.length < 10 || telefone.length > 11) {
      toast.error("Informe um WhatsApp válido.");
      return;
    }

    setValidandoTelefone(true);

    try {
      const { data, error } = await (supabase as any)
        .from("enq_participantes")
        .select("id, nome, telefone")
        .eq("telefone", telefone)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        toast.error(
          "Não encontramos cadastro com esse WhatsApp. Faça seu cadastro antes de votar."
        );
        return;
      }

      setVotante(data);
      setCarregandoDados(true);

      const [categoriasRes, candidatosRes] = await Promise.all([
        (supabase as any)
          .from("enq_categorias")
          .select("id, nome, emoji, descricao, ordem")
          .eq("ativa", true)
          .order("ordem"),
        (supabase as any)
          .from("enq_participantes")
          .select("id, nome, orgao")
          .eq("cadastro_completo", true)
          .order("nome"),
      ]);

      if (categoriasRes.error) throw categoriasRes.error;
      if (candidatosRes.error) throw candidatosRes.error;

      setCategorias(categoriasRes.data || []);
      setCandidatos(candidatosRes.data || []);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Erro ao validar telefone.");
    } finally {
      setValidandoTelefone(false);
      setCarregandoDados(false);
    }
  }

  async function votar() {
    if (!votante || !categoriaAtual || !selecionadoId) return;

    setVotando(true);

    try {
      const { data, error } = await (supabase as any).rpc("enq_votar", {
        p_telefone_votante: votante.telefone,
        p_categoria_id: categoriaAtual.id,
        p_votado_id: selecionadoId,
      });

      if (error) throw error;

      const resultado = data as EnqueteVotarResult;

      if (!resultado.ok) {
        toast.error(resultado.erro || "Não foi possível registrar o voto.");
        return;
      }

      setSelecionadoId(null);
      setBusca("");

      if (indiceAtual + 1 >= totalCategorias) {
        setConcluido(true);
      } else {
        setIndiceAtual((i) => i + 1);
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Erro ao registrar voto.");
    } finally {
      setVotando(false);
    }
  }

  if (carregandoFase) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (fase !== "votacao") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="space-y-2 p-6 text-center">
            <h1 className="text-2xl font-bold">Votação fechada</h1>
            <p className="text-sm text-muted-foreground">
              A votação da Enquete de Reconhecimento JER 2026 não está disponível no momento.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (concluido) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="space-y-2 p-6 text-center">
            <h1 className="text-2xl font-bold text-green-600">Obrigado por votar!</h1>
            <p className="text-sm text-muted-foreground">
              Seus votos em todas as categorias foram registrados.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!votante) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="space-y-4 p-6">
            <div className="text-center">
              <h1 className="text-2xl font-bold">Votação — Enquete JER 2026</h1>
              <p className="text-sm text-muted-foreground">
                Informe o WhatsApp usado no cadastro para votar.
              </p>
            </div>

            <Input
              placeholder="WhatsApp *"
              inputMode="numeric"
              value={whatsapp}
              onChange={(e) => setWhatsapp(phoneMask(e.target.value))}
            />

            <Button disabled={validandoTelefone} onClick={validarTelefone} className="w-full">
              {validandoTelefone ? "Validando..." : "Continuar"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (carregandoDados || !categoriaAtual) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
        <p className="text-sm text-muted-foreground">
          {totalCategorias === 0
            ? "Nenhuma categoria disponível para votação."
            : "Carregando categorias..."}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 pb-8">
      <div className="sticky top-0 z-20 border-b bg-background/95 p-3 backdrop-blur">
        <div className="mx-auto max-w-lg space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold">
              Categoria {indiceAtual + 1} de {totalCategorias}
            </span>
            <span className="font-semibold text-primary">{progresso}%</span>
          </div>
          <Progress value={progresso} />
        </div>
      </div>

      <div className="mx-auto max-w-lg space-y-4 p-4">
        <div className="text-center">
          <p className="text-4xl">{categoriaAtual.emoji}</p>
          <h1 className="text-xl font-bold">{categoriaAtual.nome}</h1>
          {categoriaAtual.descricao && (
            <p className="text-sm text-muted-foreground">{categoriaAtual.descricao}</p>
          )}
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por nome"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>

        <Card>
          <CardContent className="max-h-80 space-y-1.5 overflow-y-auto p-3">
            {candidatosFiltrados.length === 0 && (
              <p className="p-3 text-center text-sm text-muted-foreground">
                Nenhum participante encontrado.
              </p>
            )}

            {candidatosFiltrados.map((candidato) => {
              const selecionado = candidato.id === selecionadoId;
              return (
                <button
                  key={candidato.id}
                  type="button"
                  onClick={() => setSelecionadoId(candidato.id)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                    selecionado
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background hover:bg-muted"
                  )}
                >
                  <span className="font-medium">{candidato.nome}</span>
                  {candidato.orgao && (
                    <span
                      className={cn(
                        "text-xs",
                        selecionado ? "text-primary-foreground/80" : "text-muted-foreground"
                      )}
                    >
                      {candidato.orgao}
                    </span>
                  )}
                </button>
              );
            })}
          </CardContent>
        </Card>

        <Button disabled={!selecionadoId || votando} onClick={votar} className="w-full" size="lg">
          {votando ? "Registrando voto..." : "Confirmar voto"}
        </Button>
      </div>
    </div>
  );
}
