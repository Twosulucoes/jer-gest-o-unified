import React, { useState, useEffect } from "react";
import { useActiveEvent } from "@/hooks/useActiveEvent";
import { useEventOscConfig } from "@/hooks/useEventOscConfig";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { RotateCcw, Save, Info } from "lucide-react";
import AdminLayout from "@/components/layouts/AdminLayout";

export default function ConfigOscPage() {
  const { eventId, eventName } = useActiveEvent();
  const { data: config, isLoading, upsertMutation, defaults } = useEventOscConfig(eventId);
  
  const [formData, setFormData] = useState<any>({});

  useEffect(() => {
    if (config) {
      setFormData(config);
    } else {
      setFormData({});
    }
  }, [config]);

  if (!eventId) {
    return (
      <AdminLayout>
        <div className="p-8 text-center">
          <p className="text-muted-foreground">Selecione um evento ativo para configurar o convênio.</p>
        </div>
      </AdminLayout>
    );
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev: any) => ({ ...prev, [name]: value }));
  };

  const handleSave = () => {
    upsertMutation.mutate(formData);
  };

  const handleReset = (field: string) => {
    setFormData((prev: any) => ({ ...prev, [field]: (defaults as any)[field] || "" }));
  };

  const isDefault = (field: string) => {
    const val = formData[field];
    const def = (defaults as any)[field];
    return !val || val === def;
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="p-8 space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Configuração do Convênio (OSC)</h1>
          <p className="text-muted-foreground">Evento: {eventName}</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Identificação Institucional</CardTitle>
            <CardDescription>
              Estes dados serão utilizados no cabeçalho e rodapé dos relatórios de prestação de contas.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="grantor_name">Órgão Concedente</Label>
                  {!isDefault("grantor_name") && (
                    <Badge variant="outline" className="text-[10px] h-4 cursor-pointer" onClick={() => handleReset("grantor_name")}>
                      Customizado <RotateCcw className="ml-1 h-2 w-2" />
                    </Badge>
                  )}
                </div>
                <Input 
                  id="grantor_name" 
                  name="grantor_name" 
                  value={formData.grantor_name || defaults.grantor_name} 
                  onChange={handleChange}
                  placeholder={defaults.grantor_name}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="osc_name">Nome da OSC</Label>
                <Input 
                  id="osc_name" 
                  name="osc_name" 
                  value={formData.osc_name || defaults.osc_name} 
                  onChange={handleChange}
                  placeholder={defaults.osc_name}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="osc_cnpj">CNPJ da OSC</Label>
                <Input 
                  id="osc_cnpj" 
                  name="osc_cnpj" 
                  value={formData.osc_cnpj || defaults.osc_cnpj} 
                  onChange={handleChange}
                  placeholder={defaults.osc_cnpj}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contract_number">Número do Convênio</Label>
                <Input 
                  id="contract_number" 
                  name="contract_number" 
                  value={formData.contract_number || ""} 
                  onChange={handleChange}
                  placeholder="Ex: 001/2026"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="osc_address">Endereço Institucional</Label>
              <Input 
                id="osc_address" 
                name="osc_address" 
                value={formData.osc_address || defaults.osc_address} 
                onChange={handleChange}
                placeholder={defaults.osc_address}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="validity_start">Início da Vigência</Label>
                <Input 
                  id="validity_start" 
                  name="validity_start" 
                  type="date"
                  value={formData.validity_start || ""} 
                  onChange={handleChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="validity_end">Fim da Vigência</Label>
                <Input 
                  id="validity_end" 
                  name="validity_end" 
                  type="date"
                  value={formData.validity_end || ""} 
                  onChange={handleChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="responsible_name">Responsável pela OSC</Label>
                <Input 
                  id="responsible_name" 
                  name="responsible_name" 
                  value={formData.responsible_name || defaults.responsible_name} 
                  onChange={handleChange}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Conteúdo do Relatório</CardTitle>
            <CardDescription>Modelo de texto para o resumo executivo.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="summary_model">Resumo Executivo Padrão</Label>
              <Textarea 
                id="summary_model" 
                name="summary_model" 
                rows={4}
                value={formData.summary_model || ""} 
                onChange={handleChange}
                placeholder="Descreva as atividades da etapa em alto nível..."
              />
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Info className="h-3 w-3" /> Se vazio, o sistema usará um texto padrão baseado nas estatísticas.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => setFormData(config || {})}>Cancelar</Button>
          <Button onClick={handleSave} disabled={upsertMutation.isPending}>
            <Save className="mr-2 h-4 w-4" /> 
            {upsertMutation.isPending ? "Salvando..." : "Salvar Configuração"}
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
}
