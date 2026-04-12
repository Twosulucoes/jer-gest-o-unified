import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { reportTokens } from '../../design/tokens';
import type { ReportDefinition, ReportContext, ReportColumnDefinition } from '../../core/types';
import { getExcelHeaderStyle, getExcelZebraFill, getExcelBorder } from './excelStyles';

export async function renderExcel<Row extends Record<string, unknown>>(
  report: ReportDefinition<Row>,
  rows: Row[],
  filters: Record<string, unknown>,
  ctx: ReportContext,
  visibleColumns?: string[],
  eventName?: string
): Promise<Blob> {
  const t = reportTokens;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'JER Gestão';
  wb.created = new Date();

  const ws = wb.addWorksheet(report.name.substring(0, 31));

  const cols: ReportColumnDefinition<Row>[] = visibleColumns
    ? report.columns.filter((c) => visibleColumns.includes(c.key))
    : report.columns.filter((c) => c.visibleByDefault !== false);

  // Title rows
  const titleRow = ws.addRow([report.name]);
  titleRow.font = { bold: true, size: 14, color: { argb: t.brand.neutral900.replace('#', 'FF') } };
  ws.mergeCells(1, 1, 1, cols.length);

  if (eventName) {
    const evRow = ws.addRow([`Evento: ${eventName}`]);
    evRow.font = { size: 10, color: { argb: t.brand.neutral500.replace('#', 'FF') } };
    ws.mergeCells(2, 1, 2, cols.length);
  }

  const now = new Date().toLocaleString('pt-BR');
  const metaRow = ws.addRow([`Gerado em: ${now} | Registros: ${rows.length}`]);
  metaRow.font = { size: 9, color: { argb: t.brand.neutral500.replace('#', 'FF') } };
  ws.mergeCells(metaRow.number, 1, metaRow.number, cols.length);

  // Filters summary
  const filterEntries = Object.entries(filters).filter(([, v]) => v !== undefined && v !== null && v !== '');
  if (filterEntries.length > 0) {
    const filtersStr = filterEntries.map(([k, v]) => `${k}: ${v}`).join(' | ');
    const fRow = ws.addRow([`Filtros: ${filtersStr}`]);
    fRow.font = { size: 9, italic: true, color: { argb: t.brand.neutral500.replace('#', 'FF') } };
    ws.mergeCells(fRow.number, 1, fRow.number, cols.length);
  }

  ws.addRow([]); // blank

  // Header
  const headerStyle = getExcelHeaderStyle(t);
  const headerRow = ws.addRow(cols.map((c) => c.label));
  headerRow.eachCell((cell) => {
    cell.fill = headerStyle.fill as ExcelJS.FillPattern;
    cell.font = headerStyle.font;
    cell.border = headerStyle.border;
    cell.alignment = headerStyle.alignment;
  });

  // Set column widths
  ws.columns = cols.map((c) => ({ width: c.width || 18 }));

  // Freeze header
  ws.views = [{ state: 'frozen', ySplit: headerRow.number, xSplit: 0 }];

  // Data rows
  const zebraFill = getExcelZebraFill(t);
  const border = getExcelBorder(t);

  rows.forEach((row, idx) => {
    const values = cols.map((col) => {
      if (col.format) return col.format(row);
      return row[col.key] ?? '';
    });
    const dataRow = ws.addRow(values);

    dataRow.eachCell((cell, colIdx) => {
      const col = cols[colIdx - 1];
      cell.border = border;
      if (t.table.zebra && idx % 2 === 1) {
        cell.fill = zebraFill as ExcelJS.FillPattern;
      }
      if (col?.align === 'right') cell.alignment = { horizontal: 'right' };
      else if (col?.align === 'center') cell.alignment = { horizontal: 'center' };
      if (col?.excel?.numFmt) cell.numFmt = col.excel.numFmt;
      if (col?.excel?.bold) cell.font = { bold: true };
      if (col?.excel?.wrap) cell.alignment = { ...cell.alignment, wrapText: true };
    });
  });

  // Summary sheet
  if (report.summary?.enabled && report.summary.reducers.length > 0) {
    const sumWs = wb.addWorksheet('Resumo');
    sumWs.addRow(['Resumo']).font = { bold: true, size: 14 };
    sumWs.addRow([]);
    for (const reducer of report.summary.reducers) {
      const val = reducer.fn(rows as Record<string, unknown>[]);
      sumWs.addRow([reducer.label, val]);
    }
    sumWs.columns = [{ width: 30 }, { width: 20 }];
  }

  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export async function downloadExcel<Row extends Record<string, unknown>>(
  report: ReportDefinition<Row>,
  rows: Row[],
  filters: Record<string, unknown>,
  ctx: ReportContext,
  visibleColumns?: string[],
  eventName?: string
) {
  const blob = await renderExcel(report, rows, filters, ctx, visibleColumns, eventName);
  saveAs(blob, `${report.id}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
