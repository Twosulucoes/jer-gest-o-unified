import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { KvTable, OrderedList } from "./RegraSection";
import { Trophy, Swords, Timer, Target, Accessibility } from "lucide-react";
import type { ModalidadeRegulamento } from "@/data/regulamentoJer2026";

const BLOCO_LABEL: Record<ModalidadeRegulamento["bloco"], { label: string; icon: any }> = {
  coletivo: { label: "Coletiva", icon: Trophy },
  combate: { label: "Combate", icon: Swords },
  "tempo-marca": { label: "Tempo/Marca", icon: Timer },
  tecnico: { label: "Técnica", icon: Target },
  paralimpico: { label: "Paralímpica", icon: Accessibility },
};

export function ModalidadeCard({ m }: { m: ModalidadeRegulamento }) {
  const meta = BLOCO_LABEL[m.bloco];
  const Icon = meta.icon;
  return (
    <Card id={`mod-${m.slug}`} className="scroll-mt-24">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <CardTitle className="font-heading text-base flex items-center gap-2">
              <Icon className="h-4 w-4 text-primary" />
              {m.nome}
              <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                {m.slug}
              </code>
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">{m.resumo}</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="secondary">{meta.label}</Badge>
            <Badge variant="outline">{m.formato}</Badge>
            <Badge variant="outline">família: {m.familia}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Confederação:</span> {m.confederacao}
        </div>

        {m.limitesEscola && (
          <div className="rounded-md border bg-muted/30 p-3 text-xs space-y-0.5">
            <div className="font-semibold text-foreground mb-1">Limite por escola</div>
            {m.limitesEscola.masc && <div>Masc.: {m.limitesEscola.masc}</div>}
            {m.limitesEscola.fem && <div>Fem.: {m.limitesEscola.fem}</div>}
            {m.limitesEscola.nota && <div className="text-muted-foreground italic">{m.limitesEscola.nota}</div>}
          </div>
        )}

        {m.atributos.length > 0 && (
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
              Atributos
            </h4>
            <KvTable items={m.atributos} />
          </div>
        )}

        {m.categoriasPeso?.map((cp, i) => (
          <div key={i}>
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
              {cp.titulo}
            </h4>
            <KvTable items={cp.linhas} />
          </div>
        ))}

        {m.desempate && (
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
              Desempate (ordem)
            </h4>
            <OrderedList items={m.desempate} />
          </div>
        )}

        {m.observacoes && m.observacoes.length > 0 && (
          <div className="rounded-md border-l-4 border-primary/40 bg-muted/30 p-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
              Observações
            </h4>
            <ul className="list-disc list-inside text-xs space-y-1">
              {m.observacoes.map((o, i) => <li key={i}>{o}</li>)}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
