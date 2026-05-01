import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";

interface Props {
  userId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RefereeProfileDialog({ userId, open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const [formData, setFormData] = useState<any>({});

  const { data: profile, isLoading } = useQuery({
    queryKey: ["referee-profile", userId],
    enabled: !!userId && open,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("referee_profiles")
        .select("*")
        .eq("user_id", userId!)
        .maybeSingle();
      
      if (error) throw error;
      
      // Se não existir, tenta buscar do perfil básico para pré-preencher
      if (!data) {
        const { data: p } = await supabase.from("profiles").select("full_name").eq("id", userId!).single();
        return { full_name: p?.full_name || "", user_id: userId, status: "Ativo" };
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
          user_id: userId,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });
      
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["referee-profile", userId] });
      toast.success("Perfil de árbitro atualizado");
      onOpenChange(false);
    },
    onError: (err: any) => toast.error("Erro ao salvar: " + err.message),
  });

  const handleChange = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle>Cadastro Detalhado do Árbitro</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center p-12"><Loader2 className="animate-spin" /></div>
        ) : (
          <div className="flex-1 overflow-hidden">
            <Tabs defaultValue="pessoal" className="w-full h-full flex flex-col">
              <div className="px-6 border-b">
                <TabsList className="w-full justify-start h-10 bg-transparent gap-4">
                  <TabsTrigger value="pessoal" className="border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none h-10">Dados Pessoais</TabsTrigger>
                  <TabsTrigger value="contato" className="border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none h-10">Endereço/Contato</TabsTrigger>
                  <TabsTrigger value="bancario" className="border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none h-10">Dados Bancários</TabsTrigger>
                </TabsList>
              </div>

              <ScrollArea className="flex-1 p-6">
                <TabsContent value="pessoal" className="space-y-4 mt-0">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2 space-y-1.5">
                      <Label>Nome Completo *</Label>
                      <Input value={formData.full_name || ""} onChange={e => handleChange("full_name", e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>CPF</Label>
                      <Input value={formData.cpf || ""} onChange={e => handleChange("cpf", e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>RG</Label>
                      <Input value={formData.rg || ""} onChange={e => handleChange("rg", e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Data de Nascimento</Label>
                      <Input type="date" value={formData.birth_date || ""} onChange={e => handleChange("birth_date", e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Status</Label>
                      <Select value={formData.status || "Ativo"} onValueChange={v => handleChange("status", v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Ativo">Ativo</SelectItem>
                          <SelectItem value="Inativo">Inativo</SelectItem>
                          <SelectItem value="Pendente">Pendente</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="contato" className="space-y-4 mt-0">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>E-mail</Label>
                      <Input type="email" value={formData.email || ""} onChange={e => handleChange("email", e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Telefone</Label>
                      <Input value={formData.phone || ""} onChange={e => handleChange("phone", e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>CEP</Label>
                      <Input value={formData.zip_code || ""} onChange={e => handleChange("zip_code", e.target.value)} />
                    </div>
                    <div className="col-span-2 space-y-1.5">
                      <Label>Logradouro</Label>
                      <Input value={formData.street_address || ""} onChange={e => handleChange("street_address", e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Cidade</Label>
                      <Input value={formData.city || ""} onChange={e => handleChange("city", e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Estado (UF)</Label>
                      <Input value={formData.state || ""} onChange={e => handleChange("state", e.target.value)} />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="bancario" className="space-y-4 mt-0">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2 space-y-1.5">
                      <Label>Nome do Banco</Label>
                      <Input value={formData.bank_name || ""} onChange={e => handleChange("bank_name", e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Agência</Label>
                      <Input value={formData.bank_branch || ""} onChange={e => handleChange("bank_branch", e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Conta Corrente / PIX</Label>
                      <Input value={formData.bank_account || ""} onChange={e => handleChange("bank_account", e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>PIS / PASEP</Label>
                      <Input value={formData.pis_pasep || ""} onChange={e => handleChange("pis_pasep", e.target.value)} />
                    </div>
                  </div>
                </TabsContent>
              </ScrollArea>
            </Tabs>
          </div>
        )}

        <DialogFooter className="p-6 border-t bg-muted/20">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending || !formData.full_name}>
            {saveMut.isPending ? "Salvando..." : "Salvar Cadastro"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
