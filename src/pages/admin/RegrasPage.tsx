import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEventContext as useEvent } from "@/contexts/EventContext";
import { FONTE_DE_VERDADE_JER2026 } from "@/regras/jer2026";
import {
  EVENTO_INFO, SISTEMAS_DISPUTA, CATEGORIAS_PADRAO, MODALIDADES,
  PONTUACAO_GERAL, REGRAS_OPERACIONAIS, INSCRICOES, CALENDARIO,
  PREMIACAO, SEM_NACIONAL, SELECAO_ESTADUAL, CLASSIFICACAO_FUNCIONAL,
} from "@/data/regulamentoJer2026";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Search, Info, Calendar, Trophy, ScrollText, Users, Award, Accessibility,
  GitCompareArrows, RefreshCw, Sparkles, Database, BookOpen, AlertCircle, CheckCircle2, Cpu,
} from "lucide-react";
import { RegraSection, KvTable } from "@/components/regras-jer/RegraSection";
import { ModalidadeCard } from "@/components/regras-jer/ModalidadeCard";
import { MotorPanel } from "@/components/regras-jer/MotorPanel";
import { EditorRegrasProva } from "@/components/regras-jer/EditorRegrasProva";
import { toast } from "sonner";

const BLOCO_TABS = [
  { value: "todas", label: "Todas" },
  { value: "coletivo", label: "Coletivas" },
  { value: "combate", label: "Combate" },
  { value: "tempo-marca", label: "Tempo/Marca" },
  { value: "tecnico", label: "Técnicas" },
  { value: "paralimpico", label: "Paralímpicas" },
] as const;

/**
 * Central de Regras — Fonte única de verdade JER 2026.
 *
 * 4 grupos de abas:
 *  • Visão (Modalidades, Evento, Categorias, Inscrições, Operacional, Pontuação, Calendário, JERPA)
 *  • Diff (regulamento .ts × banco)
 *  • Sincronizar (regrava o banco a partir do .ts)
 *  • Aliases (sinônimos de importação)
 */
export default function RegrasPage() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <Header />
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription className="text-xs">
          Esta página é a <strong>fonte única de verdade</strong> das regras. O regulamento vive em
          <code className="bg-muted px-1 rounded mx-1">src/regras/jer2026/</code> e alimenta a importação,
          o motor de competição e esta tela. Use a aba <strong>Sincronizar</strong> para gravar no banco.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="visao" className="w-full">
        <TabsList className="grid grid-cols-5 max-w-3xl">
          <TabsTrigger value="visao"><BookOpen className="h-3.5 w-3.5 mr-1" />Visão</TabsTrigger>
          <TabsTrigger value="diff"><GitCompareArrows className="h-3.5 w-3.5 mr-1" />Diff</TabsTrigger>
          <TabsTrigger value="sync"><RefreshCw className="h-3.5 w-3.5 mr-1" />Sincronizar</TabsTrigger>
          <TabsTrigger value="motor"><Cpu className="h-3.5 w-3.5 mr-1" />Motor</TabsTrigger>
          <TabsTrigger value="aliases"><Sparkles className="h-3.5 w-3.5 mr-1" />Aliases</TabsTrigger>
        </TabsList>

        <TabsContent value="visao"><VisaoTabs /></TabsContent>
        <TabsContent value="diff"><DiffPanel /></TabsContent>
        <TabsContent value="sync"><SyncPanel /></TabsContent>
        <TabsContent value="motor"><MotorPanel /></TabsContent>
        <TabsContent value="aliases"><AliasesPanel /></TabsContent>
      </Tabs>
    </div>
  );
}

function Header() {
  return (
    <div className="flex items-start justify-between gap-3 flex-wrap">
      <div>
        <h1 className="text-2xl md:text-3xl font-heading font-bold">Central de Regras</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {EVENTO_INFO.nomeOficial} · {EVENTO_INFO.paralimpico} · {EVENTO_INFO.ano}
        </p>
      </div>
      <Badge variant="outline" className="font-mono">
        v{FONTE_DE_VERDADE_JER2026.versao} · {FONTE_DE_VERDADE_JER2026.modalidades.length} modalidades
      </Badge>
    </div>
  );
}

// ═══════════════════ VISÃO (sub-abas) ═══════════════════

function VisaoTabs() {
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

      <TabsContent value="categorias" className="space-y-4">
        <RegraSection title="JER's — Categorias padrão">
          <KvTable items={CATEGORIAS_PADRAO.jers.map(c => ({ label: c.categoria, value: `${c.anos} · ${c.generos}` }))} />
        </RegraSection>
        <RegraSection title="JERPA — Categorias padrão">
          <KvTable items={CATEGORIAS_PADRAO.jerpa.map(c => ({ label: c.categoria, value: `${c.anos} · ${c.generos}` }))} />
        </RegraSection>
        <RegraSection title="Categorias especiais por modalidade">
          <KvTable items={CATEGORIAS_PADRAO.especiais.map(c => ({ label: `${c.modalidade} · ${c.categoria}`, value: c.anos }))} />
        </RegraSection>
      </TabsContent>

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

      <TabsContent value="operacional" className="space-y-4">
        <RegraSection title="W.O. e WxO"><KvTable items={REGRAS_OPERACIONAIS.wo} /></RegraSection>
        <RegraSection title="Pesagem (modalidades de luta)"><KvTable items={REGRAS_OPERACIONAIS.pesagem} /></RegraSection>
        <RegraSection title="Protestos"><KvTable items={REGRAS_OPERACIONAIS.protestos} /></RegraSection>
        <RegraSection title="Credenciamento"><KvTable items={REGRAS_OPERACIONAIS.credenciamento} /></RegraSection>
        <RegraSection title="Suspensões automáticas"><KvTable items={REGRAS_OPERACIONAIS.suspensoes} /></RegraSection>
      </TabsContent>

      <TabsContent value="pontuacao" className="space-y-4">
        <RegraSection title="Tabela de pontos do Campeonato Geral (Art. 108)">
          <KvTable items={PONTUACAO_GERAL.map(p => ({ label: p.colocacao, value: `${p.pontos} pts` }))} />
        </RegraSection>
        <RegraSection title="Premiação">
          <div className="rounded-md border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50"><tr>
                <th className="text-left px-3 py-2">Tipo</th>
                <th className="text-left px-3 py-2">Coletivas</th>
                <th className="text-left px-3 py-2">Individuais</th>
              </tr></thead>
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

      <TabsContent value="calendario" className="space-y-4">
        <RegraSection title="JER's — Fase Final (Boa Vista)">
          <KvTable items={CALENDARIO.jers.map(g => ({ label: `Grupo ${g.grupo} · ${g.execucao}`, value: g.modalidades }))} />
        </RegraSection>
        <RegraSection title="JERPA — Fase Final (Boa Vista)">
          <KvTable items={CALENDARIO.jerpa.map(g => ({ label: `Grupo ${g.grupo} · ${g.execucao}`, value: g.modalidades }))} />
        </RegraSection>
      </TabsContent>

      <TabsContent value="jerpa" className="space-y-4">
        <RegraSection title="Classificação Funcional — JERPA">
          <div className="rounded-md border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50"><tr>
                <th className="text-left px-3 py-2">Tipo de deficiência</th>
                <th className="text-left px-3 py-2">Documentação</th>
                <th className="text-left px-3 py-2">Processo</th>
              </tr></thead>
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
  );
}

// ═══════════════════ DIFF ═══════════════════

function useEventId() {
  const { activeEvent } = useEvent();
  return activeEvent?.id;
}

function NoEvent() {
  return (
    <Alert>
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Selecione um evento</AlertTitle>
      <AlertDescription>Escolha um evento ativo para usar esta funcionalidade.</AlertDescription>
    </Alert>
  );
}

function DiffPanel() {
  const eventId = useEventId();
  const fonte = FONTE_DE_VERDADE_JER2026;

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["rules-diff", eventId, fonte.versao],
    enabled: !!eventId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rpc_diff_rules_vs_truth", {
        p_event_id: eventId!, p_payload: fonte as any,
      });
      if (error) throw error;
      return data as any;
    },
  });

  if (!eventId) return <NoEvent />;
  if (isLoading) return <p className="text-muted-foreground">Comparando…</p>;
  if (!data) return null;

  const sincronizado = data.sincronizado;
  const onlyInTruth: string[] = data.modalidades_apenas_no_regulamento ?? [];
  const onlyInDb: string[] = data.modalidades_apenas_no_banco ?? [];

  return (
    <div className="space-y-4">
      <Alert variant={sincronizado ? "default" : "destructive"}>
        {sincronizado ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
        <AlertTitle>
          {sincronizado ? "Banco sincronizado com o regulamento" : "Divergências detectadas"}
        </AlertTitle>
        <AlertDescription>
          {sincronizado
            ? "Todas as modalidades do regulamento estão presentes no banco."
            : "O banco não reflete o regulamento atual. Vá para a aba Sincronizar."}
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="h-4 w-4" /> Regulamento (.ts)
          </CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div>Versão: <Badge variant="outline">{data.truth.versao}</Badge></div>
            <div>Modalidades: <strong>{data.truth.modalidades}</strong></div>
            <div>Categorias: <strong>{data.truth.categorias}</strong></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2">
            <Database className="h-4 w-4" /> Banco
          </CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div>Modalidades: <strong>{data.db.modalidades}</strong></div>
            <div>Provas (sport_events): <strong>{data.db.sport_events}</strong></div>
            <div>Categorias: <strong>{data.db.categorias}</strong></div>
            <div>Regras técnicas: <strong>{data.db.rules}</strong></div>
          </CardContent>
        </Card>
      </div>

      {(onlyInTruth.length > 0 || onlyInDb.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-amber-600">
                Faltando no banco ({onlyInTruth.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-1">
              {onlyInTruth.length === 0 && <span className="text-muted-foreground text-sm">—</span>}
              {onlyInTruth.map((s) => <Badge key={s} variant="outline">{s}</Badge>)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-rose-600">
                Sobrando no banco ({onlyInDb.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-1">
              {onlyInDb.length === 0 && <span className="text-muted-foreground text-sm">—</span>}
              {onlyInDb.map((s) => <Badge key={s} variant="destructive">{s}</Badge>)}
            </CardContent>
          </Card>
        </div>
      )}

      <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
        <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
        Recomparar
      </Button>
    </div>
  );
}

// ═══════════════════ SYNC ═══════════════════

function SyncPanel() {
  const eventId = useEventId();
  const fonte = FONTE_DE_VERDADE_JER2026;
  const queryClient = useQueryClient();
  const [confirm, setConfirm] = useState("");

  const { data: diff } = useQuery({
    queryKey: ["rules-diff", eventId, fonte.versao],
    enabled: !!eventId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rpc_diff_rules_vs_truth", {
        p_event_id: eventId!, p_payload: fonte as any,
      });
      if (error) throw error;
      return data as any;
    },
  });

  const sync = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("rpc_sync_rules_from_truth", {
        p_event_id: eventId!, p_payload: fonte as any,
      });
      if (error) throw error;
      return data as any;
    },
    onSuccess: (res) => {
      toast.success(
        `Regras aplicadas: ${res.sport_events} provas, ${res.rules} regras técnicas, ${res.aliases} aliases.`
      );
      queryClient.invalidateQueries({ queryKey: ["rules-diff"] });
      setConfirm("");
    },
    onError: (e: any) => toast.error("Falha ao sincronizar: " + e.message),
  });

  if (!eventId) return <NoEvent />;

  const provasEstimadas = fonte.modalidades.reduce(
    (s, m) => s + m.provas.length * m.categorias.length * m.naipes.length, 0
  );

  return (
    <div className="space-y-4 max-w-3xl">
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Operação destrutiva</AlertTitle>
        <AlertDescription>
          Esta ação <strong>apaga e regrava</strong> todas as categorias, provas, regras técnicas
          e aliases de importação do evento atual. Use sempre que o regulamento mudar.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" /> O que será aplicado
          </CardTitle>
          <CardDescription>Regulamento JER {fonte.regras_gerais.evento.ano} v{fonte.versao}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row label="Modalidades" value={fonte.modalidades.length} />
          <Row label="Categorias etárias" value={fonte.categorias.length} />
          <Row label="Provas estimadas (modalidade × prova × categoria × naipe)" value={provasEstimadas} />
          <Row label="Aliases de modalidades" value={Object.keys(fonte.aliases_modalidades).length} />
          <Separator className="my-2" />
          <Row label="Atualmente no banco" value={
            diff ? `${diff.db.sport_events} provas, ${diff.db.rules} regras` : "—"
          } />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Confirmar sincronização</CardTitle>
          <CardDescription>
            Digite <span className="font-mono font-semibold">SINCRONIZAR</span> para liberar o botão.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value.toUpperCase())}
            placeholder="SINCRONIZAR"
          />
          <Button
            onClick={() => sync.mutate()}
            disabled={confirm !== "SINCRONIZAR" || sync.isPending}
            className="w-full"
          >
            {sync.isPending && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
            Aplicar regulamento JER 2026
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

// ═══════════════════ ALIASES ═══════════════════

function AliasesPanel() {
  const eventId = useEventId();
  const fonte = FONTE_DE_VERDADE_JER2026;
  const [filter, setFilter] = useState("");

  const { data: dbAliases } = useQuery({
    queryKey: ["import-aliases", eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("import_aliases")
        .select("kind, alias_norm, canonical_slug")
        .or(`event_id.eq.${eventId},event_id.is.null`)
        .order("kind").order("alias_norm");
      if (error) throw error;
      return data ?? [];
    },
  });

  const all = useMemo(() => {
    const fromTruth = [
      ...Object.entries(fonte.aliases_modalidades).map(([alias, slug]) => ({
        kind: "sport", alias_norm: alias, canonical_slug: slug,
      })),
      ...Object.entries(fonte.aliases_categorias).map(([alias, slug]) => ({
        kind: "category", alias_norm: alias, canonical_slug: slug,
      })),
    ];
    const dbSet = new Set((dbAliases ?? []).map((a) => `${a.kind}:${a.alias_norm}`));
    return fromTruth.map((a) => ({ ...a, no_banco: dbSet.has(`${a.kind}:${a.alias_norm}`) }));
  }, [fonte, dbAliases]);

  const filtered = all.filter(
    (a) =>
      a.alias_norm.includes(filter.toUpperCase()) ||
      a.canonical_slug.includes(filter.toLowerCase())
  );

  if (!eventId) return <NoEvent />;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Aliases de importação</CardTitle>
        <CardDescription>
          Sinônimos reconhecidos no SIGECOM e convertidos para o slug canônico.
          Provenientes do regulamento. Para sincronizar com o banco, use a aba <em>Sincronizar</em>.
        </CardDescription>
        <div className="relative pt-2">
          <Search className="absolute left-2 top-4.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Filtrar alias ou slug…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="pl-8"
          />
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[500px]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-background border-b">
              <tr className="text-left">
                <th className="py-2 pr-4">Tipo</th>
                <th className="py-2 pr-4">Alias (entrada)</th>
                <th className="py-2 pr-4">→</th>
                <th className="py-2 pr-4">Slug canônico</th>
                <th className="py-2">Banco</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="py-1.5 pr-4">
                    <Badge variant="outline" className="text-xs">{a.kind}</Badge>
                  </td>
                  <td className="py-1.5 pr-4 font-mono text-xs">{a.alias_norm}</td>
                  <td className="py-1.5 pr-4 text-muted-foreground">→</td>
                  <td className="py-1.5 pr-4 font-mono text-xs">{a.canonical_slug}</td>
                  <td className="py-1.5">
                    {a.no_banco
                      ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      : <AlertCircle className="h-4 w-4 text-amber-500" />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
