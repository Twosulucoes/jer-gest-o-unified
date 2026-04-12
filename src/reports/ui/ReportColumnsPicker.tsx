import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";
import type { ReportColumnDefinition } from "../core/types";

interface Props {
  columns: ReportColumnDefinition[];
  visible: string[];
  onChange: (visible: string[]) => void;
}

export function ReportColumnsPicker({ columns, visible, onChange }: Props) {
  const toggle = (key: string) => {
    if (visible.includes(key)) {
      onChange(visible.filter((k) => k !== key));
    } else {
      onChange([...visible, key]);
    }
  };

  const resetDefaults = () => {
    onChange(columns.filter((c) => c.visibleByDefault !== false).map((c) => c.key));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium text-muted-foreground">Colunas Visíveis</Label>
        <Button variant="ghost" size="sm" onClick={resetDefaults} className="h-7 text-xs gap-1">
          <RotateCcw className="h-3 w-3" /> Restaurar
        </Button>
      </div>
      <div className="flex flex-wrap gap-3">
        {columns.map((col) => (
          <label key={col.key} className="flex items-center gap-1.5 text-sm cursor-pointer">
            <Checkbox
              checked={visible.includes(col.key)}
              onCheckedChange={() => toggle(col.key)}
            />
            {col.label}
          </label>
        ))}
      </div>
    </div>
  );
}
