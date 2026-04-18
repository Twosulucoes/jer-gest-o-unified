import { useState, useEffect } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { GripVertical, Shuffle, Swords, RefreshCw, AlertTriangle } from "lucide-react";
import type { KnockoutParticipant } from "@/hooks/useKnockoutParticipants";

interface Props {
  participants: KnockoutParticipant[];
  hasExistingBracket: boolean;
  onGenerate: (seeds: KnockoutParticipant[], force: boolean) => void;
  isPending: boolean;
}

function SortableItem({ participant, index }: { participant: KnockoutParticipant; index: number }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: participant.participant_id,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-2 rounded-md border bg-card hover:bg-accent/50 transition-colors"
    >
      <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-muted-foreground">
        <GripVertical className="h-4 w-4" />
      </button>
      <Badge variant="outline" className="min-w-[2rem] justify-center">{index + 1}</Badge>
      <span className="font-medium text-sm flex-1">{participant.label}</span>
      {participant.delegation && (
        <span className="text-xs text-muted-foreground truncate max-w-[120px]">{participant.delegation}</span>
      )}
    </div>
  );
}

export default function SeedingPanel({ participants, hasExistingBracket, onGenerate, isPending }: Props) {
  const [seeds, setSeeds] = useState<KnockoutParticipant[]>([]);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    setSeeds(participants.map((p, i) => ({ ...p, seed: i + 1 })));
  }, [participants]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setSeeds((items) => {
        const oldIndex = items.findIndex((i) => i.participant_id === active.id);
        const newIndex = items.findIndex((i) => i.participant_id === over.id);
        return arrayMove(items, oldIndex, newIndex).map((p, i) => ({ ...p, seed: i + 1 }));
      });
    }
  }

  function handleAutoSeed() {
    setSeeds((s) =>
      [...s].sort((a, b) => a.label.localeCompare(b.label)).map((p, i) => ({ ...p, seed: i + 1 }))
    );
  }

  function handleGenerate() {
    if (hasExistingBracket) {
      setShowConfirm(true);
    } else {
      onGenerate(seeds, false);
    }
  }

  if (seeds.length < 2) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          É necessário pelo menos 2 participantes/equipes para gerar uma chave de mata-mata.
          Cadastre inscritos na aba "Inscritos" ou "Equipes".
        </AlertDescription>
      </Alert>
    );
  }

  const bracketSize = Math.pow(2, Math.ceil(Math.log2(seeds.length)));
  const byes = bracketSize - seeds.length;

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Seeding ({seeds.length} participantes)</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleAutoSeed}>
                <Shuffle className="h-4 w-4 mr-1" /> Auto-seed
              </Button>
              <Button size="sm" onClick={handleGenerate} disabled={isPending}>
                {hasExistingBracket ? (
                  <><RefreshCw className="h-4 w-4 mr-1" /> Regenerar</>
                ) : (
                  <><Swords className="h-4 w-4 mr-1" /> Gerar Chave</>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {byes > 0 && (
            <p className="text-xs text-muted-foreground mb-3">
              Chave de {bracketSize} → {byes} bye(s) serão gerados automaticamente.
            </p>
          )}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={seeds.map((s) => s.participant_id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
                {seeds.map((p, i) => (
                  <SortableItem key={p.participant_id} participant={p} index={i} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </CardContent>
      </Card>

      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Regenerar chave?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Todas as partidas existentes desta fase serão removidas e recriadas. Esta ação não pode ser desfeita.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirm(false)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={() => { setShowConfirm(false); onGenerate(seeds, true); }}
              disabled={isPending}
            >
              Confirmar Regeneração
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
