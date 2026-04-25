import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { getSelectedFacility } from "@/hooks/useAlojamento";
import { AlertTriangle, Loader2, Plus } from "lucide-react";
import { PwaHeader } from "@/components/pwa/PwaHeader";

export default function AlojamentoNovoIncidentePage() {
  const navigate = useNavigate();
  const facilityId = getSelectedFacility();
  const [severity, setSeverity] = useState("baixa");
  const [category, setCategory] = useState("geral");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!description.trim() || !facilityId) {
      toast.error("Preencha a descrição");
      return;
    }

    setSaving(true);
    const { data: { session } } = await supabase.auth.getSession();

    const { error } = await supabase.rpc("create_alojamento_incident" as any, {
      p_facility_id: facilityId,
      p_severity: severity,
      p_category: category,
      p_description: description.trim(),
      p_created_by: session?.user?.id || null,
    });

    if (error) {
      toast.error("Erro ao registrar: " + error.message);
    } else {
      toast.success("Ocorrência registrada");
      navigate("/pwa/alojamento/incidentes");
    }
    setSaving(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <PwaHeader 
        title="Nova Ocorrência" 
        icon={AlertTriangle}
        backTo="/pwa/alojamento/incidentes" 
      />

      <main className="p-4 max-w-md mx-auto pb-20">
        <Card className="rounded-2xl border-border/60 shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Registrar ocorrência
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Severidade</Label>
              <Select value={severity} onValueChange={setSeverity}>
                <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixa">Baixa</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Categoria</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="geral">Geral</SelectItem>
                  <SelectItem value="disciplina">Disciplina</SelectItem>
                  <SelectItem value="saude">Saúde</SelectItem>
                  <SelectItem value="patrimonio">Patrimônio</SelectItem>
                  <SelectItem value="seguranca">Segurança</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Descrição</Label>
              <Textarea
                placeholder="Descreva a ocorrência..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="rounded-xl bg-muted/20 border-border/60"
              />
            </div>

            <Button 
              className="w-full h-12 rounded-xl font-bold text-lg" 
              onClick={handleSave} 
              disabled={saving || !description.trim()}
            >
              {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : "Registrar"}
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
