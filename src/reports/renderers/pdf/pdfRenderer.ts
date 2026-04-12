import { pdf } from '@react-pdf/renderer';
import React from 'react';
import { reportTokens } from '../../design/tokens';
import type { ReportDefinition, ReportContext } from '../../core/types';
import { PdfReportDocument } from './PdfReportDocument';

export async function renderPdf<Row extends Record<string, unknown>>(
  report: ReportDefinition<Row>,
  rows: Row[],
  filters: Record<string, unknown>,
  ctx: ReportContext,
  visibleColumns?: string[],
  eventName?: string
): Promise<Blob> {
  const doc = React.createElement(PdfReportDocument, {
    report,
    rows,
    filters,
    ctx,
    tokens: reportTokens,
    visibleColumns,
    eventName,
  });
  return await pdf(doc).toBlob();
}
