import type { ReportTokens } from '../../design/tokens';

export function getExcelHeaderStyle(t: ReportTokens) {
  return {
    fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: t.table.headerBg.replace('#', 'FF') } },
    font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 },
    border: {
      top: { style: 'thin' as const, color: { argb: t.table.borderColor.replace('#', 'FF') } },
      bottom: { style: 'thin' as const, color: { argb: t.table.borderColor.replace('#', 'FF') } },
      left: { style: 'thin' as const, color: { argb: t.table.borderColor.replace('#', 'FF') } },
      right: { style: 'thin' as const, color: { argb: t.table.borderColor.replace('#', 'FF') } },
    },
    alignment: { vertical: 'middle' as const, horizontal: 'center' as const },
  };
}

export function getExcelZebraFill(t: ReportTokens) {
  return {
    type: 'pattern' as const,
    pattern: 'solid' as const,
    fgColor: { argb: t.table.rowAltBg.replace('#', 'FF') },
  };
}

export function getExcelBorder(t: ReportTokens) {
  return {
    top: { style: 'thin' as const, color: { argb: t.table.borderColor.replace('#', 'FF') } },
    bottom: { style: 'thin' as const, color: { argb: t.table.borderColor.replace('#', 'FF') } },
    left: { style: 'thin' as const, color: { argb: t.table.borderColor.replace('#', 'FF') } },
    right: { style: 'thin' as const, color: { argb: t.table.borderColor.replace('#', 'FF') } },
  };
}
