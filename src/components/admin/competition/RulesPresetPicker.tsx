import { FAMILY_PRESETS } from "@/types/sportEventRules";
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
          Presets por Família
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {Object.entries(FAMILY_PRESETS).map(([key, preset]) => (
            <Button
              key={key}
              variant="outline"
              size="sm"
              className="text-xs h-auto py-2 justify-start"
              onClick={() => onApply({ ...preset.rules })}
            >
              {preset.label}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
