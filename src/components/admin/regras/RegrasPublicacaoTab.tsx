import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Send, Plus, History, Shield } from "lucide-react";
import type { PermLevel } from "@/hooks/useEventEditionRules";
import { useEventEditionVersions, useEventRulesAuditLog } from "@/hooks/useEventEditionRules";

interface Props {
  eventId: string | undefined;
  status: string | null;
  version: number;
  perm: PermLevel;
  isLoading: boolean;
  onPublish: () => void;
  isPublishing: boolean;
  onNewVersion: () => void;
}

export default function RegrasPublicacaoTab({ eventId, status, version, perm, isLoading, onPublish, isPublishing, onNewVersion }: Props) {
  const { data: versions = [], isLoading: loadingVersions } = useEventEditionVersions(eventId);
  const { data: auditLog = [], isLoading: loadingAudit } = useEventRulesAuditLog(eventId);

  if (isLoading) return <div className="space-y-3"><Skeleton className="h-10 w-full" /><Skeleton className="h-40 w-full" /></div>;

  const canPublish = perm === "full";

  return (
    <div className="space-y-4">
      {/* Publish actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Send className="h-4 w-4" />
            Publicação
          </CardTitle>
          <CardDescription>Publique a edição ativa para que as regras entrem em vigor</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Badge variant={status === "published" ? "default" : "secondary"} className="text-sm">
              {status === "published" ? "✅ Publicada" : "📝 Rascunho"}
            </Badge>
            <span className="text-sm text-muted-foreground">Versão {version}</span>
          </div>

          {status === "draft" && canPublish && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button disabled={isPublishing}>
                  <Send className="h-4 w-4 mr-1" />
                  {isPublishing ? "Publicando..." : "Publicar edição"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Publicar regras?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Ao publicar, as regras da versão {version} entram em vigor imediatamente.
                    Todos os módulos do sistema passarão a usar estas regras como referência.
                    Esta ação pode ser revertida criando uma nova versão.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={onPublish}>Confirmar publicação</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          {status === "draft" && !canPublish && (
            <Alert>
              <Shield className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Apenas administradores podem publicar regras.
              </AlertDescription>
            </Alert>
          )}

          {status === "published" && canPublish && (
            <Button variant="outline" onClick={onNewVersion}>
              <Plus className="h-4 w-4 mr-1" />
              Criar nova versão (rascunho)
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Version history */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <History className="h-4 w-4" />
            Histórico de Versões
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingVersions ? (
            <Skeleton className="h-20 w-full" />
          ) : versions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma versão criada.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Versão</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Publicada em</TableHead>
                  <TableHead>Criada em</TableHead>
                  <TableHead>Última alteração</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {versions.map((v: any) => (
                  <TableRow key={v.id}>
                    <TableCell className="font-mono font-bold">v{v.version}</TableCell>
                    <TableCell>
                      <Badge variant={v.status === "published" ? "default" : "secondary"} className="text-xs">
                        {v.status === "published" ? "Publicada" : "Rascunho"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{v.published_at ? new Date(v.published_at).toLocaleString("pt-BR") : "—"}</TableCell>
                    <TableCell className="text-xs">{new Date(v.created_at).toLocaleString("pt-BR")}</TableCell>
                    <TableCell className="text-xs">{new Date(v.updated_at).toLocaleString("pt-BR")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Audit log */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Log de Auditoria
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingAudit ? (
            <Skeleton className="h-20 w-full" />
          ) : auditLog.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum registro de auditoria.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Seção</TableHead>
                  <TableHead>Ação</TableHead>
                  <TableHead>Resumo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditLog.map((log: any) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs">{new Date(log.performed_at).toLocaleString("pt-BR")}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px]">{log.section}</Badge></TableCell>
                    <TableCell className="text-xs">{log.action}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{log.changes_summary || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
