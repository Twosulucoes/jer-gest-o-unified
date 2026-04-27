import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useActiveEventId } from "@/contexts/EventContext";
import { toast } from "sonner";
import {
  FileCheck, Plus, Search, Download, Trash2, Check, X, User, 
  Upload, Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function EvidenciasOSCPage() {
  const qc = useQueryClient();
  const { user, hasRole } = useAuth();
  const selectedEventId = useActiveEventId();
  
  const [moduleFilter, setModuleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  
  const isAdminOrSecretaria = hasRole("admin") || hasRole("secretaria");

  // Fetch evidences
  const { data: evidences = [], isLoading } = useQuery({
    queryKey: ["operational_evidence", selectedEventId, moduleFilter, statusFilter],
    queryFn: async () => {
      if (!selectedEventId) return [];
      let q = (supabase as any).from("operational_evidence").select(`
        *,
        uploader:uploaded_by(email),
        reviewer:reviewed_by(email)
      `).eq("event_id", selectedEventId);
      
      if (moduleFilter !== "all") q = q.eq("module", moduleFilter);
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      
      const { data, error } = await q.order("uploaded_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedEventId,
  });

  const uploadMutation = useMutation({
    mutationFn: async (v: any) => {
      const file = v.file;
      const module = v.module;
      const path = `${selectedEventId}/${module}/${Date.now()}_${file.name}`;
      
      // 1. Upload to storage
      const { error: storageError } = await supabase.storage
        .from("operational-evidence")
        .upload(path, file);
      if (storageError) throw storageError;
      
      const { data: urlData } = supabase.storage
        .from("operational-evidence")
        .getPublicUrl(path);
        
      // 2. Insert record
      const { error: dbError } = await (supabase as any).from("operational_evidence").insert({
        event_id: selectedEventId,
        module: v.module,
        evidence_type: v.evidence_type,
        description: v.description,
        file_url: urlData.publicUrl,
        file_name: file.name,
        mime_type: file.type,
        file_size_bytes: file.size,
        uploaded_by: user!.id,
        status: 'pending'
      });
      if (dbError) throw dbError;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["operational_evidence"] });
      toast.success("Evidência enviada com sucesso!");
      setDrawerOpen(false);
    },
    onError: (e: any) => toast.error("Erro no upload: " + e.message),
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string, status: string, notes?: string }) => {
      const { error } = await (supabase.from("operational_evidence") as any).update({
        status,
        reviewed_by: user!.id,
        reviewed_at: new Date().toISOString(),
        review_notes: notes || null
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["operational_evidence"] });
      toast.success("Status atualizado!");
    },
    onError: (e: any) => toast.error("Erro ao atualizar: " + e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("operational_evidence") as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["operational_evidence"] });
      toast.success("Evidência removida.");
    },
    onError: (e: any) => toast.error("Erro ao remover: " + e.message),
  });

  const filteredEvidences = evidences.filter((e: any) => 
    e.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.file_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    total: evidences.length,
    pending: evidences.filter((e: any) => e.status === "pending").length,
    approved: evidences.filter((e: any) => e.status === "approved").length,
    byModule: evidences.reduce((acc: any, e: any) => {
      acc[e.module] = (acc[e.module] || 0) + 1;
      return acc;
    }, {})
  };

  const getModuleLabel = (m: string) => {
    const labels: any = {
      credenciamento: "Credenciamento",
      alimentacao: "Alimentação",
      alojamento: "Alojamento",
      transporte: "Transporte",
      competicao: "Competição",
      geral: "Geral"
    };
    return labels[m] || m;
  };

  const getStatusBadge = (s: string) => {
    switch (s) {
      case "approved": return <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200">Aprovada</Badge>;
      case "rejected": return <Badge variant="destructive">Rejeitada</Badge>;
      default: return <Badge variant="secondary" className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-200">Pendente</Badge>;
    }
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Evidências OSC</h1>
          <p className="text-sm text-muted-foreground mt-1">Gestão de provas operacionais para prestação de contas</p>
        </div>
        <Button onClick={() => setDrawerOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Adicionar Evidência
        </Button>
      </div>

      {/* Dashboard Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4 pb-4">
          <p className="text-xs text-muted-foreground">Total de Evidências</p>
          <p className="text-2xl font-bold">{stats.total}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-4">
          <p className="text-xs text-muted-foreground text-amber-600">Pendentes</p>
          <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-4">
          <p className="text-xs text-muted-foreground text-green-600">Aprovadas</p>
          <p className="text-2xl font-bold text-green-600">{stats.approved}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-4">
          <p className="text-xs text-muted-foreground">Módulos Ativos</p>
          <p className="text-2xl font-bold">{Object.keys(stats.byModule).length}</p>
        </CardContent></Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <Label className="text-xs">Buscar</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Descrição ou arquivo..." 
                  className="pl-9 h-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Módulo</Label>
              <Select value={moduleFilter} onValueChange={setModuleFilter}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Todos os módulos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os módulos</SelectItem>
                  <SelectItem value="credenciamento">Credenciamento</SelectItem>
                  <SelectItem value="alimentacao">Alimentação</SelectItem>
                  <SelectItem value="alojamento">Alojamento</SelectItem>
                  <SelectItem value="transporte">Transporte</SelectItem>
                  <SelectItem value="competicao">Competição</SelectItem>
                  <SelectItem value="geral">Geral</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Todos os status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="pending">Pendentes</SelectItem>
                  <SelectItem value="approved">Aprovadas</SelectItem>
                  <SelectItem value="rejected">Rejeitadas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button variant="outline" className="w-full h-10" onClick={() => { setModuleFilter("all"); setStatusFilter("all"); setSearchTerm(""); }}>
                Limpar Filtros
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* List */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 space-y-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : filteredEvidences.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <FileCheck className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <h3 className="font-bold text-lg">Nenhuma evidência encontrada</h3>
              <p className="text-muted-foreground text-sm max-w-xs mt-1">
                Ajuste os filtros ou adicione uma nova prova operacional para este evento.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Módulo</TableHead>
                  <TableHead>Descrição / Arquivo</TableHead>
                  <TableHead>Enviado por</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEvidences.map((e: any) => (
                  <TableRow key={e.id}>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {getModuleLabel(e.module)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-sm line-clamp-1">{e.description || "Sem descrição"}</span>
                        <a 
                          href={e.file_url} 
                          target="_blank" 
                          rel="noreferrer"
                          className="text-xs text-primary hover:underline flex items-center gap-1"
                        >
                          <Download className="h-3 w-3" /> {e.file_name}
                        </a>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-xs">
                        <User className="h-3 w-3 text-muted-foreground" />
                        <span>{e.uploader?.email?.split('@')[0] || "—"}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(e.uploaded_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>{getStatusBadge(e.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {isAdminOrSecretaria && e.status === "pending" && (
                          <>
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              className="h-8 w-8 text-green-600 hover:bg-green-50"
                              onClick={() => reviewMutation.mutate({ id: e.id, status: "approved" })}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              className="h-8 w-8 text-destructive hover:bg-destructive/5"
                              onClick={() => {
                                const reason = prompt("Motivo da rejeição:");
                                if (reason) reviewMutation.mutate({ id: e.id, status: "rejected", notes: reason });
                              }}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        {isAdminOrSecretaria && (
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-8 w-8 text-muted-foreground"
                            onClick={() => { if (confirm("Remover evidência?")) deleteMutation.mutate(e.id); }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Upload Drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Adicionar Evidência</SheetTitle>
            <SheetDescription>
              Faça o upload de documentos, fotos ou listas para comprovação operacional.
            </SheetDescription>
          </SheetHeader>
          
          <form className="space-y-6 py-6" onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            const file = (formData.get("file") as File);
            if (!file || file.size === 0) return toast.error("Selecione um arquivo");
            
            uploadMutation.mutate({
              module: formData.get("module"),
              evidence_type: formData.get("type"),
              description: formData.get("description"),
              file: file
            });
          }}>
            <div className="space-y-2">
              <Label>Módulo</Label>
              <Select name="module" defaultValue="geral">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="credenciamento">Credenciamento</SelectItem>
                  <SelectItem value="alimentacao">Alimentação</SelectItem>
                  <SelectItem value="alojamento">Alojamento</SelectItem>
                  <SelectItem value="transporte">Transporte</SelectItem>
                  <SelectItem value="competicao">Competição</SelectItem>
                  <SelectItem value="geral">Geral</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Tipo de Prova</Label>
              <Select name="type" defaultValue="document">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="photo">Foto</SelectItem>
                  <SelectItem value="document">Documento / PDF</SelectItem>
                  <SelectItem value="list">Lista de Presença / Consumo</SelectItem>
                  <SelectItem value="report">Relatório Técnico</SelectItem>
                  <SelectItem value="other">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea 
                name="description" 
                placeholder="Ex: Lista de assinaturas do café da manhã - Dia 02" 
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Arquivo</Label>
              <div className="flex items-center justify-center w-full">
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-muted/30 hover:bg-muted/50 transition-colors">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Upload className="w-8 h-8 mb-3 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Clique para selecionar ou arraste</p>
                  </div>
                  <input type="file" name="file" className="hidden" required />
                </label>
              </div>
            </div>

            <SheetFooter>
              <Button type="button" variant="outline" onClick={() => setDrawerOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={uploadMutation.isPending}>
                {uploadMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando...
                  </>
                ) : (
                  <>Finalizar Upload</>
                )}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
