import { useState } from "react";
import { useEventContext } from "@/contexts/EventContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ShieldCheck, 
  Camera, 
  FileText, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  Plus,
  ArrowRight,
  TrendingUp,
  Image as ImageIcon,
  UtensilsCrossed,
  Sparkles,
  Trash2,
  Wand2,
  BrainCircuit,
  Loader2
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import PrestacaoContasOscPage from "../relatorios/PrestacaoContasOscPage";
import { useOscData } from "../relatorios/useOscData";
import { useEventOscConfig } from "@/hooks/useEventOscConfig";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function OscAccountabilityModule() {
  const { activeEvent } = useEventContext();
  const eventId = activeEvent?.id;
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview");
  const [isRecordDialogOpen, setIsRecordDialogOpen] = useState(false);
  const [isAiDialogOpen, setIsAiDialogOpen] = useState(false);
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [recordType, setRecordType] = useState<string>("doacao_alimento");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  const { data: oscData, isLoading: isLoadingOsc } = useOscData(eventId);
  const { data: oscConfig } = useEventOscConfig(eventId);

  // Histórico de relatórios
  const { data: reportHistory } = useQuery({
    queryKey: ["osc-report-history", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("osc_generated_reports")
        .select(`
          *,
          template:osc_accountability_templates(name)
        `)
        .eq("event_id", eventId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!eventId
  });

  const { data: templates } = useQuery({
    queryKey: ["osc-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("osc_accountability_templates")
        .select("*")
        .order("name");
      if (error) throw error;
      
      const defaultTpl = data.find(t => t.is_default);
      if (defaultTpl && !selectedTemplateId) {
        setSelectedTemplateId(defaultTpl.id);
      }
      
      return data;
    }
  });

  const { data: evidences, isLoading: isLoadingEvidences } = useQuery({
    queryKey: ["osc-evidences", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("operational_evidence")
        .select("*")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!eventId
  });

  const saveReportMutation = useMutation({
    mutationFn: async ({ content, promptType, templateId }: { content: string, promptType: string, templateId?: string | null }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data, error } = await supabase
        .from("osc_generated_reports")
        .insert({
          event_id: eventId,
          user_id: user.id,
          content,
          prompt_type: promptType,
          template_id: templateId,
          metadata: { generated_at: new Date().toISOString() }
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["osc-report-history"] });
      toast.success("Relatório salvo no histórico");
    }
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("operational_evidence")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["osc-evidences"] });
      toast.success("Status atualizado");
    }
  });

  const createRecordMutation = useMutation({
    mutationFn: async (record: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("osc_registros").insert({
        ...record,
        event_id: eventId,
        recorded_by: user?.id
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["osc-data"] });
      toast.success("Registro adicionado com sucesso");
      setIsRecordDialogOpen(false);
    }
  });

  const deleteRecordMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("osc_registros").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["osc-data"] });
      toast.success("Registro removido");
    }
  });

  if (!activeEvent) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <ShieldCheck className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-bold">Selecione um evento</h2>
        <p className="text-muted-foreground">O módulo de OSC requer um evento ativo.</p>
      </div>
    );
  }

  const pendingCount = evidences?.filter(e => e.status === "pending").length || 0;
  const approvedCount = evidences?.filter(e => e.status === "approved").length || 0;

  const r = oscData?.resumo;
  const categories = ["infraestrutura", "atendimento", "competicao", "cerimonial"];
  const photoCounts = categories.reduce((acc, cat) => {
    acc[cat] = evidences?.filter(e => e.osc_category === cat && e.status === 'approved').length || 0;
    return acc;
  }, {} as Record<string, number>);

  const hasConfig = !!oscConfig?.id;
  const resultsPct = r && r.totalMatches > 0 ? Math.round((r.totalMatchesPublished / r.totalMatches) * 100) : 0;
  
  const executionPct = Math.round(
    ((hasConfig ? 1 : 0) + 
    (Object.values(photoCounts).filter(c => c >= 2).length / categories.length) +
    (resultsPct / 100)) / 3 * 100
  );

  const handleCreateRecord = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      type: formData.get("type"),
      value_numeric: Number(formData.get("value")),
      unit: formData.get("unit"),
      description: formData.get("description"),
      status: "aprovado" // Por padrão admin lança já aprovado
    };
    createRecordMutation.mutate(data);
  };

  const generateAiReport = async () => {
    setIsAiLoading(true);
    setAiReport("");
    setIsAiDialogOpen(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-osc-report`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ 
            event_id: eventId, 
            prompt_type: "full_report",
            stream: true,
            template_id: selectedTemplateId
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Falha ao conectar com o serviço de IA');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      
      if (!reader) throw new Error('Falha ao iniciar stream');

      let fullContent = "";
      let hasStarted = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          // Quando terminar o stream, salva automaticamente no banco
          if (fullContent) {
            saveReportMutation.mutate({
              content: fullContent,
              promptType: "full_report",
              templateId: selectedTemplateId
            });
          }
          break;
        }
        
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine || !trimmedLine.startsWith('data: ')) continue;
          
          const dataStr = trimmedLine.slice(6).trim();
          if (dataStr === '[DONE]') break;
          
          try {
            const data = JSON.parse(dataStr);
            const content = data.choices?.[0]?.delta?.content || "";
            if (content) {
              if (!hasStarted) {
                hasStarted = true;
                setIsAiLoading(false);
              }
              fullContent += content;
              setAiReport(fullContent);
            }
          } catch (e) {
            console.warn("Could not parse JSON chunk:", dataStr);
          }
        }
      }
    } catch (error: any) {
      toast.error("Erro ao gerar relatório com IA: " + error.message);
      setIsAiDialogOpen(false);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleOpenLastReport = () => {
    if (reportHistory && reportHistory.length > 0) {
      setAiReport(reportHistory[0].content);
      setSelectedTemplateId(reportHistory[0].template_id);
      setIsAiDialogOpen(true);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            Gestão de Prestação de Contas (OSC)
          </h1>
          <p className="text-muted-foreground text-sm">
            Fluxo completo de lançamento, curadoria e validação para o relatório formal.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
            Convênio Ativo
          </Badge>
          <Badge variant="secondary">
            {pendingCount} Pendências
          </Badge>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-4 w-full max-w-md">
          <TabsTrigger value="overview">Workflow</TabsTrigger>
          <TabsTrigger value="validation">Validação</TabsTrigger>
          <TabsTrigger value="report">Relatório</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
        </TabsList>

        {/* WORKFLOW / LANÇAMENTO */}
        <TabsContent value="overview" className="mt-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="hover:border-primary/50 transition-colors cursor-pointer" onClick={() => setActiveTab("validation")}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                  <Camera className="h-4 w-4" /> EVIDÊNCIAS FOTOGRÁFICAS
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{evidences?.length || 0}</div>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="secondary" className="bg-amber-100 text-amber-700 hover:bg-amber-100">
                    {pendingCount} para validar
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="hover:border-primary/50 transition-colors">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                  <TrendingUp className="h-4 w-4" /> STATUS DE EXECUÇÃO
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{executionPct}%</div>
                <p className="text-xs text-muted-foreground mt-2">Meta global de conformidade</p>
              </CardContent>
            </Card>

            <Card className="hover:border-primary/50 transition-colors cursor-pointer" onClick={() => setActiveTab("report")}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                  <FileText className="h-4 w-4" /> INDICADORES TOTAIS
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{oscData?.resumo.totalOscRegistros || 0}</div>
                <p className="text-xs text-muted-foreground mt-2 text-emerald-600 font-medium">Registros operacionais manuais</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <BrainCircuit className="h-5 w-5 text-primary" />
                      Assistente de IA OSC
                    </CardTitle>
                    <CardDescription>Gerar rascunhos de relatórios e análises</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select value={selectedTemplateId || ""} onValueChange={setSelectedTemplateId}>
                      <SelectTrigger className="w-[200px] h-9">
                        <SelectValue placeholder="Selecione o template" />
                      </SelectTrigger>
                      <SelectContent>
                        {templates?.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button size="sm" onClick={generateAiReport} className="gap-2">
                      <Sparkles className="h-4 w-4" />
                      Gerar
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Nossa IA analisa todos os registros operacionais, evidências fotográficas e resultados do evento para criar um rascunho completo da prestação de contas.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Ações de Lançamento</CardTitle>
                <CardDescription>Atalhos rápidos para registro de dados operacionais</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button variant="outline" className="w-full justify-between" onClick={() => window.open('/pwa/registros', '_blank')}>
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-blue-100 rounded-lg"><ImageIcon className="h-4 w-4 text-blue-600" /></div>
                    <span>Coletar Evidências (PWA)</span>
                  </div>
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <Button variant="outline" className="w-full justify-between" onClick={() => { setRecordType("refeicao_extra"); setIsRecordDialogOpen(true); }}>
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-emerald-100 rounded-lg"><UtensilsCrossed className="h-4 w-4 text-emerald-600" /></div>
                    <span>Lançar Refeições Extraordinárias</span>
                  </div>
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <Button variant="outline" className="w-full justify-between" onClick={() => { setRecordType("doacao_alimento"); setIsRecordDialogOpen(true); }}>
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-amber-100 rounded-lg"><Sparkles className="h-4 w-4 text-amber-600" /></div>
                    <span>Registrar Doação de Alimentos</span>
                  </div>
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <Button variant="outline" className="w-full justify-between" onClick={() => { setRecordType("ocorrencia_gestao"); setIsRecordDialogOpen(true); }}>
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-blue-100 rounded-lg"><AlertCircle className="h-4 w-4 text-blue-600" /></div>
                    <span>Registrar Ocorrência de Gestão</span>
                  </div>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Conformidade do Relatório</CardTitle>
                <CardDescription>Checklist automático para publicação</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    {hasConfig ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <AlertCircle className="h-4 w-4 text-amber-500" />}
                    Configuração do Convênio
                  </span>
                  <Badge variant={hasConfig ? "outline" : "secondary"}>{hasConfig ? "OK" : "Pendente"}</Badge>
                </div>
                {categories.map(cat => (
                  <div key={cat} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 capitalize">
                      {photoCounts[cat] >= 2 ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <AlertCircle className="h-4 w-4 text-amber-500" />}
                      Fotos: {cat}
                    </span>
                    <Badge variant={photoCounts[cat] >= 2 ? "outline" : "secondary"}>
                      {photoCounts[cat]}/4
                    </Badge>
                  </div>
                ))}
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    {resultsPct === 100 ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <AlertCircle className="h-4 w-4 text-amber-500" />}
                    Resultados de Partidas
                  </span>
                  <Badge variant={resultsPct === 100 ? "outline" : "secondary"}>{resultsPct}%</Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Lista de Registros Manuais */}
          {oscData?.oscRegistros && oscData.oscRegistros.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Últimos Registros Manuais</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {oscData.oscRegistros.slice(0, 5).map(reg => (
                    <div key={reg.id} className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${
                          reg.type === 'doacao_alimento' ? 'bg-amber-100 text-amber-700' :
                          reg.type === 'refeicao_extra' ? 'bg-emerald-100 text-emerald-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {reg.type === 'doacao_alimento' ? <Sparkles className="h-4 w-4" /> : 
                           reg.type === 'refeicao_extra' ? <UtensilsCrossed className="h-4 w-4" /> :
                           <AlertCircle className="h-4 w-4" />}
                        </div>
                        <div>
                          <p className="text-sm font-medium capitalize">{reg.type.replace('_', ' ')}</p>
                          <p className="text-xs text-muted-foreground">{reg.description || 'Sem descrição'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-right">
                        <div>
                          <p className="text-sm font-bold">{reg.value_numeric} {reg.unit}</p>
                          <p className="text-[10px] text-muted-foreground">{new Date(reg.recorded_at).toLocaleDateString()}</p>
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => deleteRecordMutation.mutate(reg.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Dialog de Lançamento */}
          <Dialog open={isRecordDialogOpen} onOpenChange={setIsRecordDialogOpen}>
            <DialogContent>
              <form onSubmit={handleCreateRecord}>
                <DialogHeader>
                  <DialogTitle className="capitalize">Lançar {recordType.replace('_', ' ')}</DialogTitle>
                  <DialogDescription>Preencha os dados para compor o relatório da OSC.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <input type="hidden" name="type" value={recordType} />
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Valor / Quantidade</Label>
                      <Input name="value" type="number" step="0.01" required placeholder="0.00" />
                    </div>
                    <div className="space-y-2">
                      <Label>Unidade</Label>
                      <Select name="unit" defaultValue={recordType === 'doacao_alimento' ? 'kg' : 'unidades'}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="kg">Quilogramas (kg)</SelectItem>
                          <SelectItem value="unidades">Unidades</SelectItem>
                          <SelectItem value="refeicoes">Refeições</SelectItem>
                          <SelectItem value="outros">Outros</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Descrição / Observações</Label>
                    <Textarea name="description" placeholder="Detalhes sobre este registro..." />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsRecordDialogOpen(false)}>Cancelar</Button>
                  <Button type="submit" disabled={createRecordMutation.isPending}>
                    {createRecordMutation.isPending ? "Salvando..." : "Salvar Registro"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          {/* Dialog de IA */}
          <Dialog open={isAiDialogOpen} onOpenChange={setIsAiDialogOpen}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Wand2 className="h-5 w-5 text-primary" />
                  Rascunho de Relatório Gerado por IA
                </DialogTitle>
                <DialogDescription>
                  Este rascunho é baseado nos dados reais do evento. Revise e ajuste antes de publicar.
                </DialogDescription>
              </DialogHeader>
              
              <div className="flex-1 overflow-y-auto py-4">
                {isAiLoading && !aiReport ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-4">
                    <Loader2 className="h-10 w-10 text-primary animate-spin" />
                    <p className="text-sm text-muted-foreground animate-pulse">
                      Analisando dados e redigindo relatório...
                    </p>
                  </div>
                ) : (
                  <div className="prose prose-sm dark:prose-invert max-w-none bg-muted/50 p-6 rounded-lg border">
                    <div className="whitespace-pre-wrap leading-relaxed text-zinc-300">
                      {aiReport}
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter className="gap-2 border-t pt-4">
                <Button variant="outline" onClick={() => setIsAiDialogOpen(false)}>Fechar</Button>
                <Button 
                  onClick={() => {
                    navigator.clipboard.writeText(aiReport || "");
                    toast.success("Copiado para a área de transferência!");
                  }}
                  disabled={!aiReport}
                >
                  Copiar Texto
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* VALIDAÇÃO DE EVIDÊNCIAS */}
        <TabsContent value="validation" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Curadoria de Evidências</CardTitle>
                <CardDescription>Analise e aprove as fotos que irão compor o relatório da OSC</CardDescription>
              </div>
              <Badge>{evidences?.length || 0} Total</Badge>
            </CardHeader>
            <CardContent>
              {isLoadingEvidences ? (
                <div className="p-10 text-center">Carregando evidências...</div>
              ) : evidences?.length === 0 ? (
                <div className="p-10 text-center text-muted-foreground border-2 border-dashed rounded-xl">
                  Nenhuma evidência capturada ainda.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {evidences?.map((ev) => (
                    <Card key={ev.id} className="overflow-hidden border shadow-none hover:shadow-md transition-shadow">
                      <div className="aspect-video relative bg-muted group">
                        <img 
                          src={ev.file_url} 
                          alt={ev.description} 
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute top-2 right-2">
                          <Badge className={
                            ev.status === 'approved' ? 'bg-emerald-500' : 
                            ev.status === 'rejected' ? 'bg-red-500' : 'bg-amber-500'
                          }>
                            {ev.status === 'approved' ? 'Aprovado' : 
                             ev.status === 'rejected' ? 'Rejeitado' : 'Pendente'}
                          </Badge>
                        </div>
                      </div>
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                            {ev.osc_category || "Sem categoria"}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(ev.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-xs line-clamp-2 min-h-[2rem] text-muted-foreground mb-3">
                          {ev.description || ev.caption || "Sem descrição"}
                        </p>
                        <div className="flex gap-2">
                          {ev.status === 'pending' ? (
                            <>
                              <Button 
                                size="sm" 
                                className="flex-1 h-8 bg-emerald-600 hover:bg-emerald-700"
                                onClick={() => updateStatusMutation.mutate({ id: ev.id, status: 'approved' })}
                              >
                                Aprovar
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline" 
                                className="flex-1 h-8 text-red-600 border-red-200 hover:bg-red-50"
                                onClick={() => updateStatusMutation.mutate({ id: ev.id, status: 'rejected' })}
                              >
                                Rejeitar
                              </Button>
                            </>
                          ) : (
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="w-full h-8 text-xs"
                              onClick={() => updateStatusMutation.mutate({ id: ev.id, status: 'pending' })}
                            >
                              Alterar Status
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* RELATÓRIO FINAL */}
        <TabsContent value="report" className="mt-6">
          <PrestacaoContasOscPage />
        </TabsContent>
        {/* Templates da IA */}
        <TabsContent value="templates" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Templates de Prestação de Contas</CardTitle>
                <CardDescription>Configure a estrutura dos textos gerados pela IA</CardDescription>
              </div>
              <Button size="sm" className="gap-2" onClick={() => toast.info("Em breve: Criação de templates personalizada")}>
                <Plus className="h-4 w-4" /> Novo Template
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {templates?.map((template) => (
                  <div key={template.id} className="flex items-start justify-between p-4 border rounded-lg hover:bg-muted/30 transition-colors">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold">{template.name}</h4>
                        {template.is_default && <Badge variant="secondary">Padrão</Badge>}
                        <Badge variant="outline" className="capitalize">{template.category}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{template.description}</p>
                      <pre className="mt-2 text-xs bg-muted p-2 rounded max-h-24 overflow-y-auto whitespace-pre-wrap font-mono">
                        {template.prompt_structure}
                      </pre>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon" onClick={() => toast.info("Em breve: Edição de templates")}>
                        <FileText className="h-4 w-4" />
                      </Button>
                      {!template.is_default && (
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => toast.info("Em breve: Remoção de templates")}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
