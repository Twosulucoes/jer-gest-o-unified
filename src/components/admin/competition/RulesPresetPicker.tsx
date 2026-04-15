import { SPORT_PRESET_CATALOG, PRESET_CATEGORIES } from "@/config/sportPresetCatalog";
import type { SportEventRulesV1 } from "@/types/sportEventRules";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Sparkles } from "lucide-react";

interface Props {
  onApply: (rules: SportEventRulesV1) => void;
}

export default function RulesPresetPicker({ onApply }: Props) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Sparkles className="h-4 w-4" />
          Presets Esportivos ({SPORT_PRESET_CATALOG.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {PRESET_CATEGORIES.map((cat) => {
          const presets = SPORT_PRESET_CATALOG.filter((p) => p.category === cat.value);
          if (presets.length === 0) return null;
          return (
            <div key={cat.value}>
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">{cat.label}</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {presets.map((preset) => (
                  <Button
                    key={preset.key}
                    variant="outline"
                    size="sm"
                    className="text-xs h-auto py-2 justify-start flex-col items-start gap-0.5"
                    onClick={() => onApply(preset.rules as SportEventRulesV1)}
                  >
                    <span className="font-medium">{preset.label}</span>
                    <span className="text-[10px] text-muted-foreground font-normal">
                      {preset.rules.family} · {preset.rules.format}
                    </span>
                  </Button>
                ))}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
