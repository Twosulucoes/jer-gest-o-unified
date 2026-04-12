import { useState, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { SportEventRulesV1 } from "@/types/sportEventRules";

interface Props {
  rules: SportEventRulesV1;
  onApply: (rules: SportEventRulesV1) => void;
}

export default function RulesJsonEditor({ rules, onApply }: Props) {
  const [json, setJson] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setJson(JSON.stringify(rules, null, 2));
    setError(null);
  }, [rules]);

  const handleApply = () => {
    try {
      const parsed = JSON.parse(json) as SportEventRulesV1;
      if (!parsed.family || !parsed.format) {
        setError("JSON deve conter 'family' e 'format'");
        return;
      }
      setError(null);
      onApply(parsed);
    } catch {
      setError("JSON inválido");
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">JSON Avançado</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <Textarea
          className="font-mono text-xs"
          rows={16}
          value={json}
          onChange={(e) => setJson(e.target.value)}
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
        <Button size="sm" variant="outline" onClick={handleApply}>
          Aplicar JSON
        </Button>
      </CardContent>
    </Card>
  );
}
