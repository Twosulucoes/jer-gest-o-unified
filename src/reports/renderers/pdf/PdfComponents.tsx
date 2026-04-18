import React from 'react';
import { View, Text } from '@react-pdf/renderer';
import type { ReportTokens } from '../../design/tokens';
import { getPdfStyles } from '../../design/styles';
import type { ReportColumnDefinition } from '../../core/types';

interface PdfHeaderProps {
  tokens: ReportTokens;
  reportName: string;
  eventName?: string;
  generatedAt: string;
  filtersSummary?: string;
}

export function PdfHeader({ tokens, reportName, eventName, generatedAt, filtersSummary }: PdfHeaderProps) {
  const s = getPdfStyles(tokens);
  return (
    <View style={s.header} fixed>
      <View>
        <Text style={s.headerTitle}>JER Gestão</Text>
        <Text style={{ fontSize: 8, color: tokens.brand.neutral500 }}>{reportName}</Text>
      </View>
      <View>
        <Text style={s.headerMeta}>{eventName || ''}</Text>
        <Text style={s.headerMeta}>{generatedAt}</Text>
        {filtersSummary && <Text style={s.headerMeta}>{filtersSummary}</Text>}
      </View>
    </View>
  );
}

export function PdfFooter({ tokens }: { tokens: ReportTokens }) {
  const s = getPdfStyles(tokens);
  return (
    <View style={s.footer} fixed>
      <Text style={s.footerText}>JER Gestão — adm.jers.com.br</Text>
      <Text style={s.footerText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  );
}

export function PdfSectionTitle({ tokens, children }: { tokens: ReportTokens; children: string }) {
  const s = getPdfStyles(tokens);
  return <Text style={s.subtitle}>{children}</Text>;
}

interface PdfTableProps<Row> {
  tokens: ReportTokens;
  columns: ReportColumnDefinition<Row>[];
  rows: Row[];
}

export function PdfTable<Row extends Record<string, unknown>>({ tokens, columns, rows }: PdfTableProps<Row>) {
  const s = getPdfStyles(tokens);
  const colWidth = (col: ReportColumnDefinition<Row>) => col.width ? `${col.width}%` : `${Math.floor(100 / columns.length)}%`;

  return (
    <View>
      <View style={s.tableHeader} fixed>
        {columns.map((col) => (
          <View key={col.key} style={{ width: colWidth(col) }}>
            <Text style={[s.tableHeaderCell, col.align === 'right' ? { textAlign: 'right' } : col.align === 'center' ? { textAlign: 'center' } : {}]}>
              {col.label}
            </Text>
          </View>
        ))}
      </View>
      {rows.map((row, i) => (
        <View key={i} style={[s.tableRow, tokens.table.zebra && i % 2 === 1 ? s.tableRowAlt : {}]} wrap={false}>
          {columns.map((col) => {
            const val = col.format ? col.format(row) : (row[col.key] ?? '—');
            return (
              <View key={col.key} style={{ width: colWidth(col) }}>
                <Text style={[
                  s.tableCell,
                  col.align === 'right' ? { textAlign: 'right' } : col.align === 'center' ? { textAlign: 'center' } : {},
                  col.pdf?.bold ? { fontWeight: 700 } : {},
                  col.pdf?.fontSize ? { fontSize: col.pdf.fontSize } : {},
                ]}>
                  {String(val)}
                </Text>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

interface PdfSummaryBoxProps {
  tokens: ReportTokens;
  items: Array<{ label: string; value: string | number }>;
}

export function PdfSummaryBox({ tokens, items }: PdfSummaryBoxProps) {
  const s = getPdfStyles(tokens);
  return (
    <View style={[s.summaryBox, { flexDirection: 'row', gap: 16 }]}>
      {items.map((item) => (
        <View key={item.label} style={{ marginRight: 16 }}>
          <Text style={s.summaryLabel}>{item.label}</Text>
          <Text style={s.summaryValue}>{String(item.value)}</Text>
        </View>
      ))}
    </View>
  );
}
