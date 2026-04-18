import { useMemo, useState } from "react";
import {
  EVENTO_INFO, SISTEMAS_DISPUTA, CATEGORIAS_PADRAO, MODALIDADES,
  PONTUACAO_GERAL, REGRAS_OPERACIONAIS, INSCRICOES, CALENDARIO,
  PREMIACAO, SEM_NACIONAL, SELECAO_ESTADUAL, CLASSIFICACAO_FUNCIONAL,
} from "@/data/regulamentoJer2026";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Search, Info, Calendar, Trophy, ScrollText, Users, Award, Accessibility } from "lucide-react";
import { RegraSection, KvTable } from "@/components/regras-jer/RegraSection";
import { ModalidadeCard } from "@/components/regras-jer/ModalidadeCard";

const BLOCO_TABS = [
  { value: "todas", label: "Todas" },
  { value: "coletivo", label: "Coletivas" },
  { value: "combate", label: "Combate" },
  { value: "tempo-marca", label: "Tempo/Marca" },
  { value: "tecnico", label: "Técnicas" },
  { value: "paralimpico", label: "Paralímpicas" },
] as const;

export default function RegrasPage() {
  const [filtro, setFiltro] = useState("");
  const [bloco, setBloco] = useState<typeof BLOCO_TABS[number]["value"]>("todas");

  const modalidades = useMemo(() => {
    const f = filtro.trim().toLowerCase();
    return MODALIDADES.filter((m) => {
      if (bloco !== "todas" && m.bloco !== bloco) return false;
      if (!f) return true;
      return m.nome.toLowerCase().includes(f) || m.slug.includes(f) || m.confederacao.toLowerCase().includes(f);
    });
  }, [filtro, bloco]);

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-heading font-bold">Regras do Evento</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {EVENTO_INFO.nomeOficial} · {EVENTO_INFO.paralimpico} · {EVENTO_INFO.ano}
          </p>
        </div>
        <Badge variant="outline" className="font-mono">v2026 · Regulamento consolidado</Badge>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription className="text-xs">
          Esta página é a <strong>fonte única de verdade</strong> das regras, derivada do
          regulamento oficial em <code className="bg-muted px-1 rounded">docs/regulamento/jer-2026-consolidado.md</code>.
          Para alterar regras, edite o documento e o módulo
          <code className="bg-muted px-1 rounded">src/data/regulamentoJer2026.ts</code>.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="modalidades" className="w-full">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="modalidades"><Trophy className="h-3.5 w-3.5 mr-1" />Modalidades</TabsTrigger>
          <TabsTrigger value="evento"><Info className="h-3.5 w-3.5 mr-1" />Evento</TabsTrigger>
          <TabsTrigger value="categorias"><Users className="h-3.5 w-3.5 mr-1" />Categorias</TabsTrigger>
          <TabsTrigger value="inscricoes"><ScrollText className="h-3.5 w-3.5 mr-1" />Inscrições</TabsTrigger>
          <TabsTrigger value="operacional"><ScrollText className="h-3.5 w-3.5 mr-1" />Operacional</TabsTrigger>
          <TabsTrigger value="pontuacao"><Award className="h-3.5 w-3.5 mr-1" />Pontuação</TabsTrigger>
          <TabsTrigger value="calendario"><Calendar className="h-3.5 w-3.5 mr-1" />Calendário</TabsTrigger>
          <TabsTrigger value="jerpa"><Accessibility className="h-3.5 w-3.5 mr-1" />JERPA</TabsTrigger>
        </TabsList>

        {/* MODALIDADES */}
        <TabsContent value="modalidades" className="space-y-4">
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, slug ou confederação..."
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-1">
              {BLOCO_TABS.map((b) => (
                <Badge
                  key={b.value}
                  variant={bloco === b.value ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => setBloco(b.value)}
                >
                  {b.label}
                </Badge>
              ))}
            </div>
            <Badge variant="secondary">{modalidades.length} de {MODALIDADES.length}</Badge>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {modalidades.map((m) => <ModalidadeCard key={m.slug} m={m} />)}
          </div>
          {modalidades.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-12">
              Nenhuma modalidade encontrada para o filtro.
            </p>
          )}
        </TabsContent>

        {/* EVENTO */}
        <TabsContent value="evento" className="space-y-4">
          <RegraSection title="Identificação do evento">
            <KvTable items={[
              { label: "Nome oficial", value: EVENTO_INFO.nomeOficial },
              { label: "Paralímpico", value: EVENTO_INFO.paralimpico },
              { label: "Organizador", value: EVENTO_INFO.organizador },
              { label: "Parceiro principal", value: EVENTO_INFO.parceiro },
              { label: "Ano", value: String(EVENTO_INFO.ano) },
              { label: "Abertura Fase Final", value: EVENTO_INFO.abertura },
              { label: "Sistema oficial de inscrição", value: EVENTO_INFO.sigecom },
            ]} />
          </RegraSection>

          <RegraSection title="Sistemas de disputa — Legenda">
            <KvTable items={SISTEMAS_DISPUTA} />
          </RegraSection>
        </TabsContent>

        {/* CATEGORIAS */}
        <TabsContent value="categorias" className="space-y-4">
          <RegraSection title="JER's — Categorias padrão">
            <KvTable items={CATEGORIAS_PADRAO.jers.map(c => ({
              label: c.categoria, value: `${c.anos} · ${c.generos}`,
            }))} />
          </RegraSection>

          <RegraSection title="JERPA — Categorias padrão">
            <KvTable items={CATEGORIAS_PADRAO.jerpa.map(c => ({
              label: c.categoria, value: `${c.anos} · ${c.generos}`,
            }))} />
          </RegraSection>

          <RegraSection title="Categorias especiais por modalidade">
            <KvTable items={CATEGORIAS_PADRAO.especiais.map(c => ({
              label: `${c.modalidade} · ${c.categoria}`, value: c.anos,
            }))} />
          </RegraSection>
        </TabsContent>

        {/* INSCRIÇÕES */}
        <TabsContent value="inscricoes" className="space-y-4">
          <RegraSection title="Períodos de inscrição">
            <KvTable items={INSCRICOES.periodos.map(p => ({ label: p.evento, value: p.periodo }))} />
          </RegraSection>
          <RegraSection title="Limites por atleta">
            <KvTable items={INSCRICOES.limitesAtleta.map(p => ({ label: p.regra, value: p.valor }))} />
          </RegraSection>
          <RegraSection title="Substituições">
            <KvTable items={INSCRICOES.substituicoes.map(p => ({ label: p.regra, value: p.valor }))} />
          </RegraSection>
        </TabsContent>

        {/* OPERACIONAL */}
        <TabsContent value="operacional" className="space-y-4">
          <RegraSection title="W.O. e WxO">
            <KvTable items={REGRAS_OPERACIONAIS.wo} />
          </RegraSection>
          <RegraSection title="Pesagem (modalidades de luta)">
            <KvTable items={REGRAS_OPERACIONAIS.pesagem} />
          </RegraSection>
          <RegraSection title="Protestos">
            <KvTable items={REGRAS_OPERACIONAIS.protestos} />
          </RegraSection>
          <RegraSection title="Credenciamento">
            <KvTable items={REGRAS_OPERACIONAIS.credenciamento} />
          </RegraSection>
          <RegraSection title="Suspensões automáticas">
            <KvTable items={REGRAS_OPERACIONAIS.suspensoes} />
          </RegraSection>
        </TabsContent>

        {/* PONTUAÇÃO */}
        <TabsContent value="pontuacao" className="space-y-4">
          <RegraSection title="Tabela de pontos do Campeonato Geral (Art. 108)">
            <KvTable items={PONTUACAO_GERAL.map(p => ({ label: p.colocacao, value: `${p.pontos} pts` }))} />
          </RegraSection>
          <RegraSection title="Premiação">
            <div className="rounded-md border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-3 py-2">Tipo</th>
                    <th className="text-left px-3 py-2">Coletivas</th>
                    <th className="text-left px-3 py-2">Individuais</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {PREMIACAO.map((p, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2 font-medium">{p.tipo}</td>
                      <td className="px-3 py-2">{p.coletivas}</td>
                      <td className="px-3 py-2">{p.individuais}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </RegraSection>
          <RegraSection title="Modalidades sem correspondência nacional">
            <KvTable items={SEM_NACIONAL.map(s => ({ label: s.categoria, value: s.modalidades }))} />
          </RegraSection>
          <RegraSection title="Seleção Estadual — Coletivas 15–17" description={SELECAO_ESTADUAL.intro}>
            <KvTable items={SELECAO_ESTADUAL.linhas.map(l => ({
              label: l.total, value: `Campeã JER's: ${l.campea} · Seletiva ampla: ${l.seletiva}`,
            }))} />
            <ul className="text-xs text-muted-foreground list-disc list-inside mt-2">
              {SELECAO_ESTADUAL.notas.map((n, i) => <li key={i}>{n}</li>)}
            </ul>
          </RegraSection>
        </TabsContent>

        {/* CALENDÁRIO */}
        <TabsContent value="calendario" className="space-y-4">
          <RegraSection title="JER's — Fase Final (Boa Vista)">
            <KvTable items={CALENDARIO.jers.map(g => ({
              label: `Grupo ${g.grupo} · ${g.execucao}`, value: g.modalidades,
            }))} />
          </RegraSection>
          <RegraSection title="JERPA — Fase Final (Boa Vista)">
            <KvTable items={CALENDARIO.jerpa.map(g => ({
              label: `Grupo ${g.grupo} · ${g.execucao}`, value: g.modalidades,
            }))} />
          </RegraSection>
        </TabsContent>

        {/* JERPA */}
        <TabsContent value="jerpa" className="space-y-4">
          <RegraSection title="Classificação Funcional — JERPA">
            <div className="rounded-md border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-3 py-2">Tipo de deficiência</th>
                    <th className="text-left px-3 py-2">Documentação</th>
                    <th className="text-left px-3 py-2">Processo</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {CLASSIFICACAO_FUNCIONAL.map((c, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2 font-medium">{c.tipo}</td>
                      <td className="px-3 py-2">{c.documentacao}</td>
                      <td className="px-3 py-2">{c.processo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="text-xs text-muted-foreground list-disc list-inside mt-3">
              <li>Classificação provisória (não válida para nível nacional CPB)</li>
              <li>Atletas sem classificação funcional NÃO podem participar</li>
              <li>Atletas já classificados: enviar cópia do documento</li>
            </ul>
          </RegraSection>

          <RegraSection title="Modalidades JERPA">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {MODALIDADES.filter(m => m.bloco === "paralimpico").map(m => (
                <ModalidadeCard key={m.slug} m={m} />
              ))}
            </div>
          </RegraSection>
        </TabsContent>
      </Tabs>
    </div>
  );
}
