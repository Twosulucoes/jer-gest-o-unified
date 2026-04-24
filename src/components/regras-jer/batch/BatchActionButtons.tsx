import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Zap, RefreshCw, Eye } from "lucide-react";

interface Props {
  canEdit: boolean;
  canOverwrite: boolean;
  isPending: boolean;
  totalProvas: number;
  onSeed: (mode: string, dryRun: boolean) => void;
}

export function BatchActionButtons({
  canEdit,
  canOverwrite,
  isPending,
  totalProvas,
  onSeed,
}: Props) {
  if (!canEdit) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Ações em Massa</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => onSeed("missing_only", true)} disabled={isPending}>
          <Eye className="h-4 w-4 mr-1" />
          Dry Run
        </Button>
        <Button size="sm" onClick={() => onSeed("missing_only", false)} disabled={isPending}>
          <Zap className="h-4 w-4 mr-1" />
          Gerar (somente faltantes)
        </Button>
        {canOverwrite && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="destructive" disabled={isPending}>
                <RefreshCw className="h-4 w-4 mr-1" />
                Regerar (sobrescrever)
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Sobrescrever regras existentes?</AlertDialogTitle>
                <AlertDialogDescription>
                  Isto vai substituir TODAS as regras existentes para as {totalProvas} provas do evento.
                  As configurações manuais serão perdidas. Esta ação requer perfil admin.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => onSeed("overwrite", false)}>
                  Confirmar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </CardContent>
    </Card>
  );
}
