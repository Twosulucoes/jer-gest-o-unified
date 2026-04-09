import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Plus, Pencil, Image, Eye, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import CredentialTemplateFormDialog from "@/components/admin/CredentialTemplateFormDialog";
import CredentialPreviewDialog from "@/components/admin/CredentialPreviewDialog";

export default function CredencialModelosPage() {
  const queryClient = useQueryClient();
  const { hasRole } = useAuth();
  const [selectedEventId, setSelectedEventId] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [previewTemplate, setPreviewTemplate] = useState<any>(null);

  const canManage = hasRole("admin") || hasRole("secretaria");

  const { data: events = [] } = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*").order("year", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: templates, isLoading } = useQuery({
    queryKey: ["credential-templates", selectedEventId],
    queryFn: async () => {
      if (!selectedEventId) return [];
      const { data, error } = await supabase
        .from("credential_templates")
        .select("*")
        .eq("event_id", selectedEventId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedEventId,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("credential_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["credential-templates"] });
      toast.success("Modelo excluído.");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Modelos de Credencial</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Cadastrar e gerenciar modelos visuais de credencial por evento
          </p>
        </div>
        {canManage && selectedEventId && (
          <Button onClick={() => { setEditingTemplate(null); setFormOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Novo Modelo
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="space-y-2 max-w-sm">
            <label className="text-sm font-medium text-foreground">Evento</label>
            <Select value={selectedEventId} onValueChange={setSelectedEventId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o evento" />
              </SelectTrigger>
              <SelectContent>
                {events.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.name} ({e.year})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {!selectedEventId ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 py-16 text-center">
          <Image className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground font-medium">Selecione um evento</p>
        </div>
      ) : isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-md" />
          ))}
        </div>
      ) : !templates || templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 py-16 text-center">
          <Image className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground font-medium">Nenhum modelo cadastrado</p>
          <p className="text-sm text-muted-foreground mt-1">Crie o primeiro modelo de credencial para este evento.</p>
        </div>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Dimensões</TableHead>
                <TableHead>Arte</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[200px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{t.width}×{t.height}px</TableCell>
                  <TableCell>
                    {t.background_url ? (
                      <Badge variant="secondary">Enviada</Badge>
                    ) : (
                      <Badge variant="outline">Sem arte</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={t.is_active ? "default" : "outline"}>
                      {t.is_active ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => setPreviewTemplate(t)}>
                        <Eye className="h-3 w-3" />
                      </Button>
                      {canManage && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => { setEditingTemplate(t); setFormOpen(true); }}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="outline">
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir modelo</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem certeza que deseja excluir "{t.name}"?
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteMutation.mutate(t.id)}>Excluir</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <CredentialTemplateFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        eventId={selectedEventId}
        template={editingTemplate}
      />

      {previewTemplate && (
        <CredentialPreviewDialog
          open={!!previewTemplate}
          onOpenChange={(open) => { if (!open) setPreviewTemplate(null); }}
          template={previewTemplate}
        />
      )}
    </div>
  );
}
