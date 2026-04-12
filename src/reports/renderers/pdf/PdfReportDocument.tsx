import React from 'react';
import { Document, Page, View, Text } from '@react-pdf/renderer';
import type { ReportTokens } from '../../design/tokens';
import { getPdfStyles } from '../../design/styles';
import type { ReportDefinition, ReportContext, ReportColumnDefinition } from '../../core/types';
import { PdfHeader, PdfFooter, PdfTable, PdfSummaryBox } from './PdfComponents';

interface Props<Row> {
  report: ReportDefinition<Row>;
  rows: Row[];
  filters: Record<string, unknown>;
  ctx: ReportContext;
  tokens: ReportTokens;
  visibleColumns?: string[];
  eventName?: string;
}

export function PdfReportDocument<Row extends Record<string, unknown>>({
  report,
  rows,
  filters,
  ctx,
  tokens,
  visibleColumns,
  eventName,
}: Props<Row>) {
  const s = getPdfStyles(tokens);
  const orientation = report.layout?.orientation || 'portrait';
  const now = new Date().toLocaleString('pt-BR');

  const cols: ReportColumnDefinition<Row>[] = visibleColumns
    ? report.columns.filter((c) => visibleColumns.includes(c.key))
    : report.columns.filter((c) => c.visibleByDefault !== false);

  const filterSummary = Object.entries(filters)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}: ${v}`)
    .join(' | ');

  const summaryItems = report.summary?.enabled
    ? report.summary.reducers.map((r) => ({ label: r.label, value: r.fn(rows as Record<string, unknown>[]) }))
    : [];

  return (
    <Document>
      <Page size="A4" orientation={orientation} style={s.page}>
        <PdfHeader tokens={tokens} reportName={report.name} eventName={eventName} generatedAt={now} filtersSummary={filterSummary} />
        <View style={{ marginTop: 8 }}>
          <Text style={s.title}>{report.name}</Text>
          {report.description && <Text style={s.metaRow}>{report.description}</Text>}
          <Text style={s.metaRow}>Gerado em: {now}</Text>
          <Text style={s.metaRow}>Total de registros: {rows.length}</Text>
        </View>
        <View style={{ marginTop: tokens.layout.sectionGap }}>
          <PdfTable tokens={tokens} columns={cols} rows={rows} />
        </View>
        {summaryItems.length > 0 && <PdfSummaryBox tokens={tokens} items={summaryItems} />}
        <PdfFooter tokens={tokens} />
      </Page>
    </Document>
  );
}
