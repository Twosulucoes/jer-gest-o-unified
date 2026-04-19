import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Download, ArrowLeft, Sparkles, BookOpen, ListChecks, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import ModuleHeader from "@/components/admin/ModuleHeader";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEventId } from "@/contexts/EventContext";
import { downloadModeloXlsx, type ModeloDataSources } from "@/lib/import/buildModeloXlsx";
import { MODALIDADES_CATALOGO, CATEGORIAS_CATALOGO } from "@/lib/import/templateCatalog";

export default function ImportacaoModeloPage() {
  const eventId = useActiveEventId();
  const [generating, setGenerating] = useState(false);

  const { data: event } = useQuery({
    queryKey: ["event", eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data } = await supabase.from("events").select("*").eq("id", eventId).maybeSingle();
      return data;
    },
  });

  const { data: dynamicData } = useQuery({
    queryKey: ["modelo-import-data", eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const [sportsRes, sportEventsRes, categoriesRes, delegationsRes] = await Promise.all([
        supabase.from("sports").select("name").eq("event_id", eventId).order("name"),
        supabase.from("sport_events").select("id, name, sport:sports(name), category:categories(name, gender_scope)").eq("event_id", eventId).eq("is_active", true).order("name"),
        supabase.from("categories").select("name, gender_scope").eq("event_id", eventId).order("name"),
        supabase.from("delegations").select("school_name").eq("event_id", eventId).order("school_name"),
      ]);

      const modalidades = Array.from(new Set((sportsRes.data ?? []).map((s: any) => s.name))).filter(Boolean);
      const escolas = Array.from(new Set((delegationsRes.data ?? []).map((d: any) => d.school_name))).filter(Boolean);

      // Provas: nomes reais das sport_events cadastradas
      const provasSet = new Set<string>();
      (sportEventsRes.data ?? []).forEach((se: any) => {
        if (se.name) provasSet.add(se.name);
      });

      // Categorias: combinar nome + naipe legível
      const naipeLabel = (g: string) => g === "male" ? "Masculino" : g === "female" ? "Feminino" : "Misto";
      const cats = Array.from(new Set(
        (categoriesRes.data ?? []).map((c: any) => `${c.name} ${naipeLabel(c.gender_scope)}`)
      )).filter(Boolean);

      return {
        modalidades,
        provas: Array.from(provasSet),
        categorias: cats,
        escolas,
      };
    },
  });

  const usingFallback = !dynamicData || (
    (dynamicData.modalidades?.length ?? 0) === 0 &&
    (dynamicData.categorias?.length ?? 0) === 0
  );

  const handleDownload = () => {
    if (!event) {
      toast.error("Evento ativo não encontrado.");
      return;
    }
    setGenerating(true);
    try {
      const sources: ModeloDataSources = {
        modalidades: dynamicData?.modalidades,
        provas: dynamicData?.provas,
        categorias: dynamicData?.categorias,
        escolas: dynamicData?.escolas,
        eventName: event.name,
        eventYear: event.year,
        stageName: "Geral",
      };
      downloadModeloXlsx(sources);
      toast.success("Modelo gerado e baixado!");
    } catch (err) {
      toast.error(`Erro ao gerar modelo: ${(err as Error).message}`);
    } finally {
      setGenerating(false);
    }
  };

  const totalProvasCatalogo = MODALIDADES_CATALOGO.reduce((sum, m) => sum + m.provas.length, 0);

  return (
    <div className="container mx-auto py-6 space-y-6 max-w-5xl">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link to="/admin/importacao">
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para Importação
          </Link>
        </Button>
      </div>

      <ModuleHeader
        route="/admin/importacao/modelo"
        title="Modelo de importação (SIGECOM → JER)"
      />

      {/* Hero CTA */}
      <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Gerar planilha modelo personalizada
              </h2>
              <p className="text-sm text-muted-foreground">
                Use como referência ou preencha manualmente para o evento <strong>{event?.name ?? "—"}</strong>.
                A exportação direta do SIGECOM também é aceita no upload.
              </p>
            </div>
            <Button onClick={handleDownload} disabled={generating || !event} size="lg">
              <Download className="mr-2 h-5 w-5" />
              {generating ? "Gerando…" : "Baixar modelo .xlsx"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Status dos dados de referência */}
      {usingFallback ? (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Usando catálogo padrão JER</AlertTitle>
          <AlertDescription className="space-y-1">
            <p>
              Como ainda não há modalidades/categorias cadastradas neste evento, o modelo será gerado
              com o <strong>catálogo canônico do JER/JERPA</strong>:
            </p>
            <ul className="list-disc pl-5 text-sm mt-2">
              <li>{MODALIDADES_CATALOGO.length} modalidades oficiais (Atletismo, Futsal, Natação, Judô…)</li>
              <li>{totalProvasCatalogo} provas técnicas pré-cadastradas</li>
              <li>{CATEGORIAS_CATALOGO.length} categorias por idade × Masculino/Feminino</li>
            </ul>
          </AlertDescription>
        </Alert>
      ) : (
        <Alert className="border-primary/30 bg-primary/5">
          <ListChecks className="h-4 w-4 text-primary" />
          <AlertTitle>Modelo será gerado com seus dados reais</AlertTitle>
          <AlertDescription>
            <div className="flex flex-wrap gap-2 mt-2">
              <Badge variant="outline">{dynamicData?.modalidades?.length ?? 0} modalidades</Badge>
              <Badge variant="outline">{dynamicData?.categorias?.length ?? 0} categorias</Badge>
              <Badge variant="outline">{dynamicData?.escolas?.length ?? 0} escolas</Badge>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* O que tem na planilha */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            O que vem dentro do modelo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div className="space-y-2">
              <p className="font-medium">📄 Aba "Inscrições" (principal)</p>
              <ul className="list-disc pl-5 text-muted-foreground space-y-1">
                <li><strong>17 colunas</strong> com nomes exatos esperados pelo importador</li>
                <li>Cabeçalho vermelho = obrigatório (NOME, ESCOLA, MODALIDADE, PROVA)</li>
                <li>Linha 2 = descrição de cada campo (cinza)</li>
                <li>3 linhas de exemplo prontas (apagar antes de enviar)</li>
                <li>Dropdowns em SEXO, ESFERA, TIPO USUARIO, PCD, STATUS</li>
                <li>Dropdowns dinâmicos em MODALIDADE, PROVA, COMPETICAO</li>
              </ul>
            </div>
            <div className="space-y-2">
              <p className="font-medium">📚 Abas auxiliares (referência)</p>
              <ul className="list-disc pl-5 text-muted-foreground space-y-1">
                <li><strong>📖 Instruções</strong> — guia de preenchimento</li>
                <li><strong>Modalidades</strong> — lista válida</li>
                <li><strong>Provas</strong> — provas por modalidade</li>
                <li><strong>Categorias</strong> — categoria + naipe</li>
                <li><strong>Escolas</strong> — delegações já cadastradas (se houver)</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Dicas finais */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">💡 Boas práticas</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2 text-muted-foreground">
          <p>• <strong>SIGECOM direto:</strong> exporte as inscrições Deferidas e faça upload — o sistema mapeia as colunas automaticamente.</p>
          <p>• <strong>Uma linha = uma inscrição em uma prova.</strong> Atleta em 3 provas → 3 linhas (mesma pessoa, provas diferentes).</p>
          <p>• <strong>DATA NASCIMENTO resolve a categoria:</strong> informe-a e deixe COMPETICAO em branco — o sistema calcula sozinho.</p>
          <p>• <strong>CPF é essencial:</strong> sem ele, dois atletas com nome parecido viram pendência. Sempre inclua se disponível no SIGECOM.</p>
          <p>• <strong>Nome da escola consistente:</strong> use exatamente o mesmo nome em todas as linhas da mesma escola — diferenças geram delegações duplicadas.</p>
          <p>• <strong>Reimportação é segura:</strong> corrigir a planilha e reenviar não duplica registros.</p>
        </CardContent>
      </Card>
    </div>
  );
}
