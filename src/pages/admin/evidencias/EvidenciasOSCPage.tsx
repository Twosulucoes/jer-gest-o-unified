import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useActiveEventId } from "@/contexts/EventContext";
import { toast } from "sonner";
import {
  FileCheck, Plus, Search, Download, Trash2, Check, X, User, 
  Upload, Loader2, Camera, MapPin, Calendar as CalendarIcon, Type, Link as LinkIcon
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
import { Separator } from "@/components/ui/separator";

const OSC_CATEGORIES = [
  { value: "abertura_encerramento", label: "Abertura ou Encerramento" },
  { value: "partida_andamento", label: "Partida em Andamento" },
  { value: "premiacao_podio", label: "Premiação ou Pódio" },
  { value: "equipes_atletas", label: "Equipes e Atletas" },
  { value: "organizacao_voluntarios", label: "Organização e Voluntários" },
  { value: "estrutura_geral", label: "Estrutura (Sede, Refeitório, Alojamento)" }
];

export default function EvidenciasOSCPage() {
  const qc = useQueryClient();
  const { user, hasRole } = useAuth();
  const selectedEventId = useActiveEventId();
  
  const [moduleFilter, setModuleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  
  const isAdminOrSecretaria = hasRole("admin") || hasRole("secretaria");

  const { data: matches = [] } = useQuery({
    queryKey: ["competition_matches", selectedEventId],
    queryFn: async () => {
      if (!selectedEventId) return [];
      const { data, error } = await supabase
        .from("competition_matches")
        .select(`id, match_number, sport_events(sports(name))`)
        .eq("event_id", selectedEventId);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedEventId,
  });

  const { data: evidences = [], isLoading } = useQuery({
    queryKey: ["operational_evidence", selectedEventId, moduleFilter, statusFilter],
    queryFn: async () => {
      if (!selectedEventId) return [];
      let q = (supabase as any).from("operational_evidence").select(`
        *,
        uploader:uploaded_by(email),
        reviewer:reviewed_by(email),
        match:match_id(id, match_number, sport_events(sports(name)))
      `).eq("event_id", selectedEventId);
      
      if (moduleFilter !== "all") q = q.eq("module", moduleFilter);
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      
      const { data, error } = await q.order("created_at", { ascending: false });
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
      const { error: storageError } = await supabase.storage.from("operational-evidence").upload(path, file);
      if (storageError) throw storageError;
      const { data: urlData } = supabase.storage.from("operational-evidence").getPublicUrl(path);
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
        status: 'pending',
        osc_category: v.osc_category || null,
        photo_at: v.photo_at || null,
        location_name: v.location_name || null,
        caption: v.caption || null,
        match_id: v.match_id || null
      });
      if (dbError) throw dbError;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["operational_evidence"] });
      toast.success("Evidência enviada!");
      setDrawerOpen(false);
    },
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string, status: string, notes?: string }) => {
      const { error } = await (supabase as any).from("operational_evidence").update({
        status,
        reviewed_by: user!.id,
        updated_at: new Date().toISOString(),
        review_notes: notes || null
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["operational_evidence"] });
      toast.success("Status atualizado!");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("operational_evidence").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["operational_evidence"] });
      toast.success("Evidência removida.");
    },
  });

  const filteredEvidences = evidences.filter((e: any) => {
    if (!isAdminOrSecretaria) {
      if (e.module === 'alimentacao' && !hasRole('alimentacao')) return false;
      if (e.module === 'alojamento' && !hasRole('alojamento')) return false;
      if (e.module === 'transporte' && !hasRole('transporte')) return false;
      if (e.module === 'competicao' && !hasRole('coordenacao_tecnica')) return false;
    }
    return (e.description?.toLowerCase().includes(searchTerm.toLowerCase()) || e.file_name?.toLowerCase().includes(searchTerm.toLowerCase()));
  });

  const getModuleLabel = (m: string) => {
    const labels: any = { credenciamento: "Credenciamento", alimentacao: "Alimentação", alojamento: "Alojamento", transporte: "Transporte", competicao: "Competição", geral: "Geral" };
    return labels[m] || m;
  };

  const getStatusBadge = (s: string) => {
    switch (s) {
      case "approved": return <Badge className="bg-green-100 text-green-700">Aprovada</Badge>;
      case "rejected": return <Badge variant="destructive">Rejeitada</Badge>;
      default: return <Badge variant="secondary" className="bg-amber-100 text-amber-700">Pendente</Badge>;
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

      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <Label className="text-xs">Buscar</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Descrição..." className="pl-9 h-10" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Módulo</Label>
              <Select value={moduleFilter} onValueChange={setModuleFilter}>
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="competicao">Competição</SelectItem>
                  <SelectItem value="geral">Geral</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? <div className="p-8 space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Módulo / Categoria</TableHead>
                  <TableHead>Descrição / Arquivo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEvidences.map((e: any) => (
                  <TableRow key={e.id}>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Badge variant="outline" className="w-fit">{getModuleLabel(e.module)}</Badge>
                        {e.osc_category && <span className="text-[10px] text-muted-foreground">{OSC_CATEGORIES.find(c => c.value === e.osc_category)?.label}</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-sm">{e.description || "Sem descrição"}</span>
                        <a href={e.file_url} target="_blank" rel="noreferrer" className="text-xs text-primary flex items-center gap-1"><Download className="h-3 w-3" /> {e.file_name}</a>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(e.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {isAdminOrSecretaria && e.status === "pending" && <Button size="icon" variant="ghost" onClick={() => reviewMutation.mutate({ id: e.id, status: "approved" })}><Check className="h-4 w-4 text-green-600" /></Button>}
                        {isAdminOrSecretaria && <Button size="icon" variant="ghost" onClick={() => { if (confirm("Remover?")) deleteMutation.mutate(e.id); }}><Trash2 className="h-4 w-4" /></Button>}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          <SheetHeader><SheetTitle>Adicionar Evidência</SheetTitle></SheetHeader>
          <form className="space-y-4 py-4" onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const file = fd.get("file") as File;
            if (!file || file.size === 0) return toast.error("Selecione um arquivo");
            uploadMutation.mutate({
              module: fd.get("module"),
              evidence_type: fd.get("type"),
              description: fd.get("description"),
              osc_category: fd.get("osc_category"),
              photo_at: fd.get("photo_at"),
              location_name: fd.get("location_name"),
              caption: fd.get("caption"),
              match_id: fd.get("match_id"),
              file
            });
          }}>
            <div className="space-y-2">
              <Label>Arquivo</Label>
              <Input type="file" name="file" />
            </div>
            <div className="space-y-2">
              <Label>Módulo</Label>
              <Select name="module" defaultValue="competicao">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="competicao">Competição</SelectItem><SelectItem value="geral">Geral</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Categoria OSC</Label>
              <Select name="osc_category">
                <SelectTrigger><SelectValue placeholder="Selecione categoria" /></SelectTrigger>
                <SelectContent>{OSC_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Partida (Opcional)</Label>
              <Select name="match_id">
                <SelectTrigger><SelectValue placeholder="Vincular a partida" /></SelectTrigger>
                <SelectContent>{matches.map((m: any) => <SelectItem key={m.id} value={m.id}>Jogo {m.match_number} - {m.sport_events?.sports?.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Data/Hora da Foto</Label>
              <Input type="datetime-local" name="photo_at" />
            </div>
            <div className="space-y-2">
              <Label>Local</Label>
              <Input name="location_name" placeholder="Ex: Ginásio Poliesportivo" />
            </div>
            <div className="space-y-2">
              <Label>Legenda</Label>
              <Textarea name="caption" maxLength={200} />
            </div>
            <Button type="submit" className="w-full" disabled={uploadMutation.isPending}>{uploadMutation.isPending ? "Enviando..." : "Enviar Evidência"}</Button>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
