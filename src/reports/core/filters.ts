import type { ReportFilterDefinition } from './types';

export function normalizeFilters(
  defs: ReportFilterDefinition[],
  rawValues: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const def of defs) {
    const val = rawValues[def.key];
    if (val !== undefined && val !== null && val !== '') {
      result[def.key] = val;
    } else if (def.defaultValue !== undefined) {
      result[def.key] = def.defaultValue;
    }
  }
  return result;
}

export function validateFilters(
  defs: ReportFilterDefinition[],
  values: Record<string, unknown>
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const def of defs) {
    const val = values[def.key];
    if (def.required && (val === undefined || val === null || val === '')) {
      errors[def.key] = `${def.label} é obrigatório`;
    }
    if (def.validate && val !== undefined && val !== null) {
      const err = def.validate(val);
      if (err) errors[def.key] = err;
    }
  }
  return errors;
}

export function serializeFilters(values: Record<string, unknown>): string {
  return JSON.stringify(values);
}

export function deserializeFilters(str: string): Record<string, unknown> {
  try {
    return JSON.parse(str);
  } catch {
    return {};
  }
}

export function applyDependsOn(
  defs: ReportFilterDefinition[],
  values: Record<string, unknown>
): ReportFilterDefinition[] {
  return defs.filter((def) => {
    if (!def.dependsOn) return true;
    return !!values[def.dependsOn];
  });
}
