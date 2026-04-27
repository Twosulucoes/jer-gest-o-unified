import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useActiveEventId } from "@/contexts/EventContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { Search, UserPlus, Users, Loader2, ShieldAlert, Trash2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

interface EventualPerson {
  id: string;
  full_name: string;
  involvement_type: string;
  document_id: string | null;
  organization: string | null;
  notes: string | null;
  authorized_by: string | null;
  created_at: string;
  vouchers_count?: number;
}

const INVOLVEMENT_TYPES = [
  { value: "prestador", label: "Prestador de Serviço" },
  { value: "acompanhante", label: "Acompanhante" },
  { value: "visitante", label: "Visitante Autorizado" },
  { value: "outro", label: "Outro" },
];

export default function EventuaisPage() {
  const { hasRole } = useAuth();
  const { activeEventId } = useActiveEventId();
  const qc = useQueryClient();
  const canManage = hasRole("admin") || hasRole("secretaria") || hasRole("super_admin");

  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [involvementType, setInvolvementType] = useState("");
  const [documentId, setDocumentId] = useState("");
  const [organization, setOrganization] = useState("");
  const [notes, setNotes] = useState("");
  const [authorizedBy, setAuthorizedBy] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: eventuais = [], isLoading } = useQuery({
    queryKey: ["eventual-people", activeEventId, search],
    queryFn: async () => {
      if (!activeEventId) return [];
      let q = supabase
        .from("service_eventual_people")
        .select("*, vouchers:service_vouchers(count)")
        .eq("event_id", activeEventId)
        .order("full_name");

      if (search.trim().length >= 2) {
        q = q.ilike("full_name", `%${search.trim()}%`);
      }

      const { data, error } = await q;
      if (error) throw error;
      
      return (data as any[]).map(p => ({
        ...p,
        vouchers_count: p.vouchers?.[0]?.count || 0
      })) as EventualPerson[];
    },
    enabled: !!activeEventId,
  });

  const resetForm = () => {
    setFullName("");
    setInvolvementType("");
    setDocumentId("");
    setOrganization("");
    setNotes("");
    setAuthorizedBy("");
    setEditingId(null);
  };

  const openEdit = (p: EventualPerson) => {
    setEditingId(p.id);
    setFullName(p.full_name);
    setInvolvementType(p.involvement_type);
    setDocumentId(p.document_id || "");
    setOrganization(p.organization || "");
    setNotes(p.notes || "");
    setAuthorizedBy(p.authorized_by || "");
    setFormOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!fullName || !involvementType) {
        throw new Error("Nome e tipo de envolvimento são obrigatórios");
      }
      
      const payload = {
        event_id: activeEventId,
        full_name: fullName,
        involvement_type: involvementType,
        document_id: documentId || null,
        organization: organization || null,
        notes: notes || null,
        authorized_by: authorizedBy || null,
      };

      if (editingId) {
        const { error } = await supabase.from("service_eventual_people").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("service_eventual_people").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: editingId ? "Cadastro atualizado" : "Cadastro realizado" });
      setFormOpen(false);
      resetForm();
      qc.invalidateQueries({ queryKey: ["eventual-people"] });
    },
    onError: (e: any) => {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("service_eventual_people").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Cadastro excluído" });
      qc.invalidateQueries({ queryKey: ["eventual-people"] });
    },
    onError: (e: any) => {
      toast({ title: "Erro ao excluir", description: "Verifique se há vouchers vinculados.", variant: "destructive" });
    },
  });

  if (!canManage) {
    return (
      <Card className="m-4">
        <CardContent className="flex items-center gap-2 p-6 text-muted-foreground">
          <ShieldAlert className="h-5 w-5" />
          Acesso restrito a administração e secretaria.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Users className="h-6 w-6 text-primary" /> Pessoas Eventuais
          </h1>
          <p className="text-sm text-muted-foreground">
            Gestão de pessoas sem credencial oficial para emissão de vouchers.
          </p>
        </div>
        <Button onClick={() => { resetForm(); setFormOpen(true); }}>
          <UserPlus className="mr-2 h-4 w-4" /> Novo eventual
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Buscar</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Nome do eventual..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : eventuais.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              Nenhuma pessoa eventual cadastrada para este evento.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Organização</TableHead>
                    <TableHead className="text-center">Vouchers</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {eventuais.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.full_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {INVOLVEMENT_TYPES.find(t => t.value === p.involvement_type)?.label || p.involvement_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{p.organization || "—"}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={p.vouchers_count! > 0 ? "default" : "secondary"}>
                          {p.vouchers_count}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button size="sm" variant="outline" onClick={() => openEdit(p)}>
                          Editar
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="text-destructive"
                          disabled={p.vouchers_count! > 0}
                          onClick={() => {
                            if (confirm("Tem certeza que deseja excluir este cadastro?")) {
                              deleteMutation.mutate(p.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar eventual" : "Novo eventual"}</DialogTitle>
            <DialogDescription>
              Pessoas cadastradas aqui podem receber vouchers nominais.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">Nome completo *</Label>
              <Input id="full_name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Ex: João da Silva" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="involvement">Tipo de envolvimento *</Label>
                <Select value={involvementType} onValueChange={setInvolvementType}>
                  <SelectTrigger id="involvement">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {INVOLVEMENT_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="doc">Documento (RG/CPF)</Label>
                <Input id="doc" value={documentId} onChange={(e) => setDocumentId(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="org">Empresa / Instituição</Label>
                <Input id="org" value={organization} onChange={(e) => setOrganization(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="auth">Autorizado por</Label>
                <Input id="auth" value={authorizedBy} onChange={(e) => setAuthorizedBy(e.target.value)} placeholder="Nome do responsável" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Observações</Label>
              <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingId ? "Salvar alterações" : "Cadastrar eventual"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
