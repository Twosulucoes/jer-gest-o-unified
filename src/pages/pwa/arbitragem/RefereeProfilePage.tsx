import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { PwaContainer } from "@/components/pwa/PwaScreen";
import PwaLayout from "@/components/pwa/PwaLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Save, User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function RefereeProfilePage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [formData, setFormData] = useState<any>({});

  const { data: profile, isLoading } = useQuery({
    queryKey: ["referee-profile-pwa", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("referee_profiles")
        .select("*")
        .eq("user_id", user?.id)
        .maybeSingle();
      
      if (error) throw error;
      
      if (!data) {
        return { full_name: user?.user_metadata?.full_name || "", user_id: user?.id, status: "Ativo" };
      }
      
      return data;
    },
  });

  useEffect(() => {
    if (profile) setFormData(profile);
  }, [profile]);

  const saveMut = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any)
        .from("referee_profiles")
        .upsert({
          ...formData,
          user_id: user?.id,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });
      
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["referee-profile-pwa", user?.id] });
      toast.success("Perfil atualizado com sucesso");
    },
    onError: (err: any) => toast.error("Erro ao salvar: " + err.message),
  });

  const handleChange = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  };

  if (isLoading) {
    return (
      <PwaLayout moduleTitle="Meu Perfil">
        <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin" /></div>
      </PwaLayout>
    );
  }

  return (
    <PwaLayout moduleTitle="Meu Perfil" backTo="/pwa">
      <PwaContainer className="py-4 space-y-6 pb-20">
        <div className="space-y-1">
          <h2 className="text-xl font-bold">Dados Cadastrais</h2>
          <p className="text-sm text-muted-foreground">Mantenha seus dados atualizados para fins de remuneração.</p>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <User className="h-4 w-4" /> Dados Pessoais
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nome Completo</Label>
              <Input value={formData.full_name || ""} onChange={e => handleChange("full_name", e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>CPF</Label>
                <Input value={formData.cpf || ""} onChange={e => handleChange("cpf", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Data Nascimento</Label>
                <Input type="date" value={formData.birth_date || ""} onChange={e => handleChange("birth_date", e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Telefone / WhatsApp</Label>
              <Input value={formData.phone || ""} onChange={e => handleChange("phone", e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              Dados Bancários
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nome do Banco</Label>
              <Input value={formData.bank_name || ""} onChange={e => handleChange("bank_name", e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Agência</Label>
                <Input value={formData.bank_branch || ""} onChange={e => handleChange("bank_branch", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Conta / PIX</Label>
                <Input value={formData.bank_account || ""} onChange={e => handleChange("bank_account", e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Button 
          className="w-full h-12 rounded-xl" 
          onClick={() => saveMut.mutate()} 
          disabled={saveMut.isPending}
        >
          {saveMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Salvar Alterações
        </Button>
      </PwaContainer>
    </PwaLayout>
  );
}
