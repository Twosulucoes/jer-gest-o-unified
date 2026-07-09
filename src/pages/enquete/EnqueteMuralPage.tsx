import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import { ENQUETE_SELOS_ZOEIRA } from "@/lib/enquete";

const INTERVALO_ATUALIZACAO_MS = 15000;
const MEDALHAS = ["🥇", "🥈", "🥉"];

interface ParticipanteRanking {
  id: string;
  nome: string;
  orgao: string | null;
  xp: number;
  titulo: string | null;
  selo_zoeira: string | null;
  selo_publico: boolean;
}

function buscarSelo(id: string | null) {
  return ENQUETE_SELOS_ZOEIRA.find((selo) => selo.id === id) ?? null;
}

export default function EnqueteMuralPage() {
  const [ranking, setRanking] = useState<ParticipanteRanking[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;

    async function carregar() {
      const { data, error } = await (supabase as any)
        .from("enq_participantes")
        .select("id, nome, orgao, xp, titulo, selo_zoeira, selo_publico")
        .eq("cadastro_completo", true)
        .order("xp", { ascending: false });

      if (!ativo) return;

      if (!error) setRanking(data || []);
      setCarregando(false);
    }

    carregar();
    const intervalId = setInterval(carregar, INTERVALO_ATUALIZACAO_MS);

    return () => {
      ativo = false;
      clearInterval(intervalId);
    };
  }, []);

  return (
    <div className="min-h-screen bg-muted/30 pb-8">
      <div className="sticky top-0 z-20 border-b bg-background/95 p-4 backdrop-blur">
        <div className="mx-auto max-w-lg space-y-1 text-center">
          <h1 className="text-xl font-bold">Mural de Reconhecimento — JER 2026</h1>
          <p className="text-sm text-muted-foreground">
            {ranking.length} servidor{ranking.length === 1 ? "" : "es"} cadastrado
            {ranking.length === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-lg space-y-2 p-4">
        {carregando && (
          <p className="p-6 text-center text-sm text-muted-foreground">Carregando ranking...</p>
        )}

        {!carregando && ranking.length === 0 && (
          <p className="p-6 text-center text-sm text-muted-foreground">
            Ainda não há participantes cadastrados.
          </p>
        )}

        {ranking.map((participante, index) => {
          const selo = participante.selo_publico ? buscarSelo(participante.selo_zoeira) : null;

          return (
            <Card key={participante.id}>
              <CardContent className="flex items-center gap-3 p-3">
                <div className="w-8 text-center text-lg font-bold text-muted-foreground">
                  {MEDALHAS[index] ?? index + 1}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{participante.nome}</p>

                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                    {participante.orgao && (
                      <span className="text-xs text-muted-foreground">{participante.orgao}</span>
                    )}

                    {participante.titulo && (
                      <Badge variant="secondary" className="text-[10px]">
                        {participante.titulo}
                      </Badge>
                    )}

                    {selo && (
                      <Badge variant="outline" className="text-[10px]">
                        {selo.emoji} {selo.label}
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="text-right">
                  <p className="font-bold text-primary">{participante.xp}</p>
                  <p className="text-[10px] text-muted-foreground">XP</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
