import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

import {
  ENQUETE_TAGS,
  ENQUETE_SELOS_ZOEIRA,
  ENQUETE_MAX_TAGS,
  ENQUETE_ROUTES,
  XP_POR_TAG,
  XP_POR_SUBJETIVA,
} from "@/lib/enquete";

const XP_MAXIMO_TAGS = ENQUETE_MAX_TAGS * XP_POR_TAG;
const XP_MAXIMO_SUBJETIVAS = 2 * XP_POR_SUBJETIVA;
const XP_MAXIMO_CADASTRO = XP_MAXIMO_TAGS + XP_MAXIMO_SUBJETIVAS;

interface Slide {
  titulo: string;
  emoji: string;
  conteudo: ReactNode;
}

const SLIDES: Slide[] = [
  {
    titulo: "O que é a Enquete JER 2026?",
    emoji: "🎉",
    conteudo: (
      <div className="space-y-3 text-center">
        <p className="text-base">
          Uma enquete interna pra reconhecer quem fez os Jogos Escolares de Roraima
          acontecerem — com XP, títulos, selos e sorteio entre os participantes.
        </p>
        <p className="text-sm text-muted-foreground">
          Leva menos de 2 minutos pra participar. Vamos te mostrar como funciona.
        </p>
      </div>
    ),
  },
  {
    titulo: "Como você ganha XP",
    emoji: "⚡",
    conteudo: (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border p-3 text-center">
            <p className="text-2xl font-bold text-primary">{XP_POR_TAG}</p>
            <p className="text-xs text-muted-foreground">XP por tag marcada</p>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <p className="text-2xl font-bold text-primary">{XP_POR_SUBJETIVA}</p>
            <p className="text-xs text-muted-foreground">XP por resposta escrita</p>
          </div>
        </div>
        <p className="text-center text-sm text-muted-foreground">
          Até {ENQUETE_MAX_TAGS} tags ({XP_MAXIMO_TAGS} XP) + 2 respostas escritas (
          {XP_MAXIMO_SUBJETIVAS} XP) = até <strong className="text-foreground">{XP_MAXIMO_CADASTRO} XP</strong>{" "}
          só no cadastro.
        </p>
      </div>
    ),
  },
  {
    titulo: "Passo 1 — Seu cadastro",
    emoji: "📝",
    conteudo: (
      <div className="space-y-3">
        <p className="text-sm text-center text-muted-foreground">
          Nome, WhatsApp e setor — e depois escolha até {ENQUETE_MAX_TAGS} tags que mais
          combinam com o que você fez nos Jogos:
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          {ENQUETE_TAGS.slice(0, 6).map((tag) => (
            <div
              key={tag.id}
              className="flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs font-medium"
            >
              <span>{tag.emoji}</span>
              <span>{tag.label}</span>
            </div>
          ))}
        </div>
        <p className="text-center text-xs text-muted-foreground">
          e mais {ENQUETE_TAGS.length - 6} outras tags pra escolher.
        </p>
      </div>
    ),
  },
  {
    titulo: "Passo 2 — Momento MVP e perrengue",
    emoji: "🎤",
    conteudo: (
      <div className="space-y-3">
        <div className="rounded-lg border p-3">
          <p className="text-sm font-semibold">Qual foi seu momento MVP nos Jogos?</p>
          <p className="text-xs text-muted-foreground">Aquele momento que valeu a pena.</p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-sm font-semibold">Qual foi seu maior perrengue?</p>
          <p className="text-xs text-muted-foreground">Aquela sufoco que virou história.</p>
        </div>
        <p className="text-center text-sm text-muted-foreground">
          São opcionais, mas cada resposta preenchida vale {XP_POR_SUBJETIVA} XP.
        </p>
      </div>
    ),
  },
  {
    titulo: "Selo de zoeira (opcional)",
    emoji: "🤡",
    conteudo: (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-1.5">
          {ENQUETE_SELOS_ZOEIRA.map((selo) => (
            <Badge key={selo.id} variant="outline" className="justify-center py-1.5 text-xs">
              {selo.emoji} {selo.label}
            </Badge>
          ))}
        </div>
        <p className="text-center text-sm text-muted-foreground">
          Escolha um selo e marque "Exibir meu selo no mural" se quiser aparecer com ele
          no ranking público.
        </p>
      </div>
    ),
  },
  {
    titulo: "Depois de enviar",
    emoji: "🍀",
    conteudo: (
      <div className="space-y-3 text-center">
        <p className="text-sm text-muted-foreground">
          Assim que você confirma o cadastro, a tela mostra:
        </p>
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg border p-2">
            <p className="text-xs text-muted-foreground">Número</p>
            <p className="font-bold">da sorte</p>
          </div>
          <div className="rounded-lg border p-2">
            <p className="text-xs text-muted-foreground">Seu</p>
            <p className="font-bold">título</p>
          </div>
          <div className="rounded-lg border p-2">
            <p className="text-xs text-muted-foreground">Seu</p>
            <p className="font-bold">XP</p>
          </div>
        </div>
      </div>
    ),
  },
  {
    titulo: "Depois vem a votação",
    emoji: "🗳️",
    conteudo: (
      <div className="space-y-2 text-sm text-muted-foreground">
        <p>Quando a votação abrir, quem já se cadastrou pode votar:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Confirma o WhatsApp do cadastro pra entrar</li>
          <li>Vota uma categoria por vez, com barra de progresso</li>
          <li>Pode buscar colegas pelo nome</li>
          <li>Você não aparece na sua própria lista — ninguém vota em si mesmo</li>
        </ul>
      </div>
    ),
  },
  {
    titulo: "Mural de Reconhecimento",
    emoji: "🏆",
    conteudo: (
      <div className="space-y-2 text-center">
        <p className="text-sm text-muted-foreground">
          Um ranking público, atualizado a cada 15 segundos, com o XP de cada colega, o
          título conquistado e os selos de zoeira de quem escolheu aparecer no mural.
        </p>
      </div>
    ),
  },
  {
    titulo: "Sorteio e resultado final",
    emoji: "🎁",
    conteudo: (
      <div className="space-y-2 text-center text-sm text-muted-foreground">
        <p>
          Ao final, a direção sorteia um número da sorte entre os participantes e
          divulga o resultado de cada categoria — inclusive quando dá empate em 1º
          lugar.
        </p>
      </div>
    ),
  },
];

export default function EnqueteSobrePage() {
  const [indice, setIndice] = useState(0);

  const total = SLIDES.length;
  const slide = SLIDES[indice];
  const ultimo = indice === total - 1;
  const progresso = Math.round(((indice + 1) / total) * 100);

  function avancar() {
    setIndice((i) => Math.min(i + 1, total - 1));
  }

  function voltar() {
    setIndice((i) => Math.max(i - 1, 0));
  }

  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      <div className="sticky top-0 z-20 border-b bg-background/95 p-3 backdrop-blur">
        <div className="mx-auto max-w-lg space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold">
              Passo {indice + 1} de {total}
            </span>
            <span className="font-semibold text-primary">{progresso}%</span>
          </div>
          <Progress value={progresso} />
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-4 p-4">
        <Card>
          <CardContent className="space-y-4 p-6">
            <div className="text-center">
              <p className="text-4xl">{slide.emoji}</p>
              <h1 className="mt-1 text-xl font-bold">{slide.titulo}</h1>
            </div>

            {slide.conteudo}
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={voltar}
            disabled={indice === 0}
          >
            Voltar
          </Button>

          {ultimo ? (
            <Link to={ENQUETE_ROUTES.cadastro} className="flex-1">
              <Button className="w-full">Fazer meu cadastro agora</Button>
            </Link>
          ) : (
            <Button className="flex-1" onClick={avancar}>
              Avançar
            </Button>
          )}
        </div>

        {!ultimo && (
          <Link
            to={ENQUETE_ROUTES.cadastro}
            className="text-center text-sm text-muted-foreground underline underline-offset-2"
          >
            Pular e ir direto pro cadastro
          </Link>
        )}
      </div>
    </div>
  );
}
