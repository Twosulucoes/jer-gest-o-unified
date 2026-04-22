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
import { AlojamentoNavHeader } from "@/components/pwa/alojamento/AlojamentoNavHeader";
import { ArrowLeft, AlertTriangle, Loader2 } from "lucide-react";

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
      <header className="flex items-center gap-2 border-b bg-card px-4 h-14">
        <button onClick={() => navigate(-1)} className="text-muted-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <AlertTriangle className="h-5 w-5 text-amber-500" />
        <span className="font-semibold text-foreground">Nova Ocorrência</span>
      </header>

      <main className="p-4 max-w-md mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Registrar ocorrência</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Severidade</Label>
              <Select value={severity} onValueChange={setSeverity}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixa">Baixa</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
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
              <Label>Descrição</Label>
              <Textarea
                placeholder="Descreva a ocorrência..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
              />
            </div>

            <Button className="w-full h-12" onClick={handleSave} disabled={saving || !description.trim()}>
              {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : "Registrar"}
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
