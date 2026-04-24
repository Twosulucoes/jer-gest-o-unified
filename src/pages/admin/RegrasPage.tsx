import { useEventContext as useEvent } from "@/contexts/EventContext";
import { FONTE_DE_VERDADE_JER2026 } from "@/regras/jer2026";
import { EVENTO_INFO } from "@/data/regulamentoJer2026";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Info,
  BookOpen,
  GitCompareArrows,
  RefreshCw,
  Sparkles,
  Cpu,
  Pencil,
} from "lucide-react";
import { MotorPanel } from "@/components/regras-jer/MotorPanel";
import { EditorRegrasProva } from "@/components/regras-jer/EditorRegrasProva";
import { VisaoPanel } from "@/components/regras-jer/panels/VisaoPanel";
import { DiffPanel } from "@/components/regras-jer/panels/DiffPanel";
import { SyncPanel } from "@/components/regras-jer/panels/SyncPanel";
import { AliasesPanel } from "@/components/regras-jer/panels/AliasesPanel";

/**
 * Central de Regras — Fonte única de verdade JER 2026.
 *
 * 4 grupos de abas:
 *  • Visão (Modalidades, Evento, Categorias, Inscrições, Operacional, Pontuação, Calendário, JERPA)
 *  • Diff (regulamento .ts × banco)
 *  • Sincronizar (regrava o banco a partir do .ts)
 *  • Aliases (sinônimos de importação)
 */
export default function RegrasPage() {
  const { activeEvent } = useEvent();
  const eventId = activeEvent?.id;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-heading font-bold">Central de Regras</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {EVENTO_INFO.nomeOficial} · {EVENTO_INFO.paralimpico} · {EVENTO_INFO.ano}
          </p>
        </div>
        <Badge variant="outline" className="font-mono">
          v{FONTE_DE_VERDADE_JER2026.versao} · {FONTE_DE_VERDADE_JER2026.modalidades.length}{" "}
          modalidades
        </Badge>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription className="text-xs">
          Esta página é a <strong>fonte única de verdade</strong> das regras. O regulamento vive em
          <code className="bg-muted px-1 rounded mx-1">src/regras/jer2026/</code> e alimenta a
          importação, o motor de competição e esta tela. Use a aba <strong>Sincronizar</strong> para
          gravar no banco.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="visao" className="w-full">
        <TabsList className="grid grid-cols-6 max-w-4xl">
          <TabsTrigger value="visao">
            <BookOpen className="h-3.5 w-3.5 mr-1" />
            Visão
          </TabsTrigger>
          <TabsTrigger value="editar">
            <Pencil className="h-3.5 w-3.5 mr-1" />
            Editar
          </TabsTrigger>
          <TabsTrigger value="diff">
            <GitCompareArrows className="h-3.5 w-3.5 mr-1" />
            Diff
          </TabsTrigger>
          <TabsTrigger value="sync">
            <RefreshCw className="h-3.5 w-3.5 mr-1" />
            Sincronizar
          </TabsTrigger>
          <TabsTrigger value="motor">
            <Cpu className="h-3.5 w-3.5 mr-1" />
            Motor
          </TabsTrigger>
          <TabsTrigger value="aliases">
            <Sparkles className="h-3.5 w-3.5 mr-1" />
            Aliases
          </TabsTrigger>
        </TabsList>

        <TabsContent value="visao">
          <VisaoPanel />
        </TabsContent>
        <TabsContent value="editar">
          <EditorRegrasProva />
        </TabsContent>
        <TabsContent value="diff">
          <DiffPanel eventId={eventId} />
        </TabsContent>
        <TabsContent value="sync">
          <SyncPanel eventId={eventId} />
        </TabsContent>
        <TabsContent value="motor">
          <MotorPanel />
        </TabsContent>
        <TabsContent value="aliases">
          <AliasesPanel eventId={eventId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
