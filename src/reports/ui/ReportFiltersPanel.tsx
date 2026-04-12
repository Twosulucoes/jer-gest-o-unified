import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ReportFilterDefinition } from "../core/types";

interface Props {
  filters: ReportFilterDefinition[];
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}

export function ReportFiltersPanel({ filters, values, onChange }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {filters.map((f) => (
        <div key={f.key} className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">
            {f.label} {f.required && <span className="text-destructive">*</span>}
          </Label>
          {f.type === 'select' || f.type === 'multiSelect' ? (
            <Select
              value={(values[f.key] as string) || ''}
              onValueChange={(v) => onChange(f.key, v || undefined)}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder={`Selecionar ${f.label.toLowerCase()}`} />
              </SelectTrigger>
              <SelectContent>
                {f.options?.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : f.type === 'date' ? (
            <Input
              type="date"
              className="h-9"
              value={(values[f.key] as string) || ''}
              onChange={(e) => onChange(f.key, e.target.value || undefined)}
            />
          ) : f.type === 'number' ? (
            <Input
              type="number"
              className="h-9"
              value={(values[f.key] as string) || ''}
              onChange={(e) => onChange(f.key, e.target.value ? Number(e.target.value) : undefined)}
            />
          ) : (
            <Input
              className="h-9"
              placeholder={f.label}
              value={(values[f.key] as string) || ''}
              onChange={(e) => onChange(f.key, e.target.value || undefined)}
            />
          )}
        </div>
      ))}
    </div>
  );
}
