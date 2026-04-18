import type { ReportDefinition, ReportContext } from './types';
import { resultsByGroupReport } from '../definitions/sample.resultsByGroup';
import { delegationRosterReport } from '../definitions/sample.delegationRoster';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const reportRegistry: ReportDefinition<any>[] = [
  resultsByGroupReport,
  delegationRosterReport,
];

export function getReportById(id: string) {
  return reportRegistry.find((r) => r.id === id) || null;
}

export function listReportsForRoles(roles: string[]) {
  return reportRegistry.filter((r) => {
    if (!r.permissions?.roles) return true;
    return r.permissions.roles.some((pr) => roles.includes(pr));
  });
}

export function getDefaultFilters(report: ReportDefinition, ctx: ReportContext): Record<string, unknown> {
  const defaults: Record<string, unknown> = {};
  for (const f of report.filters) {
    if (f.defaultValue !== undefined) {
      defaults[f.key] = f.defaultValue;
    } else if (f.key === 'event_id' && ctx.activeEventId) {
      defaults[f.key] = ctx.activeEventId;
    }
  }
  return defaults;
}
