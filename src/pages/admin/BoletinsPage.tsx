import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEventId } from "@/contexts/EventContext";
import RequireActiveEvent from "@/components/admin/RequireActiveEvent";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, FileText, Send, Loader2, Edit, RotateCcw } from "lucide-react";
import { format } from "date-fns";

export default function BoletinsPage() {
  const eventId = useActiveEventId();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editingBulletin, setEditingBulletin] = useState<any>(null);
  const [title, setTitle] = useState("");
  const [contentMd, setContentMd] = useState("");

  const { data: bulletins = [], isLoading } = useQuery({
    queryKey: ["bulletins", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("official_bulletins")
        .select("*")
        .eq("event_id", eventId)
        .order("number", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createBulletin = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("rpc_create_bulletin", {
        p_event_id: eventId,
        p_title: title,
        p_content_md: contentMd,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      toast.success(`Boletim #${data.number} criado.`);
      setShowCreate(false);
      setTitle("");
      setContentMd("");
      queryClient.invalidateQueries({ queryKey: ["bulletins"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const publishBulletin = useMutation({
    mutationFn: async (bulletinId: string) => {
      const { data, error } = await supabase.rpc("rpc_publish_bulletin", { p_bulletin_id: bulletinId });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Boletim publicado.");
      queryClient.invalidateQueries({ queryKey: ["bulletins"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateBulletin = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("official_bulletins")
        .update({ title, content_md: contentMd, updated_at: new Date().toISOString() })
        .eq("id", editingBulletin.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Boletim atualizado.");
      setEditingBulletin(null);
      queryClient.invalidateQueries({ queryKey: ["bulletins"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const rectifyBulletin = useMutation({
    mutationFn: async (originalId: string) => {
      // Mark original as rectified
      await supabase
        .from("official_bulletins")
        .update({ status: "rectified", updated_at: new Date().toISOString() })
        .eq("id", originalId);
      // Create new bulletin referencing original
      const { data, error } = await supabase.rpc("rpc_create_bulletin", {
        p_event_id: eventId,
        p_title: `Retificação do Boletim`,
        p_content_md: "",
      });
      if (error) throw error;
      // Update the new bulletin to set rectifies_bulletin_id
      if (data) {
        await supabase
          .from("official_bulletins")
          .update({ rectifies_bulletin_id: originalId })
          .eq("id", (data as any).id);
      }
      return data;
    },
    onSuccess: (data: any) => {
      toast.success(`Retificação #${data.number} criada.`);
      queryClient.invalidateQueries({ queryKey: ["bulletins"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const statusBadge = (status: string) => {
    switch (status) {
      case "draft": return <Badge variant="secondary">Rascunho</Badge>;
      case "published": return <Badge variant="default">Publicado</Badge>;
      case "rectified": return <Badge variant="destructive">Retificado</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <RequireActiveEvent>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Boletins Oficiais</h1>
              <p className="text-sm text-muted-foreground">Registro cronológico e numerado de comunicados e resultados.</p>
            </div>
          </div>
          <Button onClick={() => { setTitle(""); setContentMd(""); setShowCreate(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Novo Boletim
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">#</TableHead>
                <TableHead>Título</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Publicado em</TableHead>
                <TableHead>Retifica</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bulletins.map((b: any) => (
                <TableRow key={b.id}>
                  <TableCell className="font-mono font-bold">{b.number}</TableCell>
                  <TableCell className="font-medium">{b.title}</TableCell>
                  <TableCell>{statusBadge(b.status)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {b.published_at ? format(new Date(b.published_at), "dd/MM/yyyy HH:mm") : "—"}
                  </TableCell>
                  <TableCell>
                    {b.rectifies_bulletin_id ? (
                      <Badge variant="outline">
                        #{bulletins.find((x: any) => x.id === b.rectifies_bulletin_id)?.number || "?"}
                      </Badge>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="flex gap-1">
                    {b.status === "draft" && (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => { setTitle(b.title); setContentMd(b.content_md || ""); setEditingBulletin(b); }}>
                          <Edit className="h-3 w-3" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="default">
                              <Send className="h-3 w-3 mr-1" /> Publicar
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Publicar Boletim #{b.number}?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Após publicado, o boletim não poderá ser editado. Para correções, use "Retificar".
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => publishBulletin.mutate(b.id)}>Publicar</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </>
                    )}
                    {b.status === "published" && (
                      <Button size="sm" variant="outline" onClick={() => rectifyBulletin.mutate(b.id)}>
                        <RotateCcw className="h-3 w-3 mr-1" /> Retificar
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {bulletins.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Nenhum boletim registrado.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        )}

        {/* Create Dialog */}
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo Boletim</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <Input placeholder="Título do boletim" value={title} onChange={e => setTitle(e.target.value)} />
              <Textarea placeholder="Conteúdo (Markdown)" value={contentMd} onChange={e => setContentMd(e.target.value)} rows={8} />
              <Button onClick={() => createBulletin.mutate()} disabled={!title.trim() || createBulletin.isPending}>
                {createBulletin.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Criar Boletim
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={!!editingBulletin} onOpenChange={(o) => !o && setEditingBulletin(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Editar Boletim #{editingBulletin?.number}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <Input placeholder="Título" value={title} onChange={e => setTitle(e.target.value)} />
              <Textarea placeholder="Conteúdo (Markdown)" value={contentMd} onChange={e => setContentMd(e.target.value)} rows={8} />
              <Button onClick={() => updateBulletin.mutate()} disabled={!title.trim() || updateBulletin.isPending}>
                {updateBulletin.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Salvar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </RequireActiveEvent>
  );
}
