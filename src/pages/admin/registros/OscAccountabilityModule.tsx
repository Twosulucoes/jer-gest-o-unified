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
  Image as ImageIcon
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import PrestacaoContasOscPage from "../relatorios/PrestacaoContasOscPage";

export default function OscAccountabilityModule() {
  const { activeEvent } = useEventContext();
  const eventId = activeEvent?.id;
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview");

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
        <TabsList className="grid grid-cols-3 w-full max-w-md">
          <TabsTrigger value="overview">Workflow</TabsTrigger>
          <TabsTrigger value="validation">Validação</TabsTrigger>
          <TabsTrigger value="report">Relatório</TabsTrigger>
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
                <div className="text-3xl font-bold">84%</div>
                <p className="text-xs text-muted-foreground mt-2">Meta de evidências por categoria</p>
              </CardContent>
            </Card>

            <Card className="hover:border-primary/50 transition-colors cursor-pointer" onClick={() => setActiveTab("report")}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                  <FileText className="h-4 w-4" /> RELATÓRIOS GERADOS
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">12</div>
                <p className="text-xs text-muted-foreground mt-2 text-emerald-600 font-medium">Último: 15/05/2026</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                <Button variant="outline" className="w-full justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-emerald-100 rounded-lg"><Plus className="h-4 w-4 text-emerald-600" /></div>
                    <span>Lançar Refeições Extraordinárias</span>
                  </div>
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <Button variant="outline" className="w-full justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-amber-100 rounded-lg"><Plus className="h-4 w-4 text-amber-600" /></div>
                    <span>Registrar Doação de Alimentos</span>
                  </div>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Conformidade do Relatório</CardTitle>
                <CardDescription>Checklist para publicação do PDF oficial</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Configuração do Convênio</span>
                  <Badge variant="outline">OK</Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Fotos: Atendimento</span>
                  <Badge variant="outline">4/4</Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2"><AlertCircle className="h-4 w-4 text-amber-500" /> Fotos: Infraestrutura</span>
                  <Badge variant="secondary" className="bg-amber-100 text-amber-700">1/4</Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Resultados de Partidas</span>
                  <Badge variant="outline">100%</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
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
      </Tabs>
    </div>
  );
}
