import { StyleSheet } from '@react-pdf/renderer';
import type { ReportTokens } from './tokens';

export function getPdfStyles(t: ReportTokens) {
  return StyleSheet.create({
    page: {
      fontFamily: t.typography.fontFamily,
      fontSize: t.typography.body.fontSize,
      paddingTop: t.layout.pageMargin.top,
      paddingRight: t.layout.pageMargin.right,
      paddingBottom: t.layout.pageMargin.bottom,
      paddingLeft: t.layout.pageMargin.left,
      color: t.brand.neutral900,
    },
    header: {
      position: 'absolute',
      top: 10,
      left: t.layout.pageMargin.left,
      right: t.layout.pageMargin.right,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor: t.brand.primary,
      paddingBottom: 6,
    },
    headerTitle: {
      fontSize: t.typography.h2.fontSize,
      fontWeight: t.typography.h2.fontWeight,
      color: t.brand.primary,
    },
    headerMeta: {
      fontSize: t.typography.small.fontSize,
      color: t.brand.neutral500,
      textAlign: 'right' as const,
    },
    footer: {
      position: 'absolute',
      bottom: 12,
      left: t.layout.pageMargin.left,
      right: t.layout.pageMargin.right,
      flexDirection: 'row',
      justifyContent: 'space-between',
      borderTopWidth: 0.5,
      borderTopColor: t.brand.neutral200,
      paddingTop: 4,
    },
    footerText: {
      fontSize: t.typography.small.fontSize,
      color: t.brand.neutral500,
    },
    title: {
      fontSize: t.typography.h1.fontSize,
      fontWeight: t.typography.h1.fontWeight,
      color: t.brand.neutral900,
      marginBottom: 4,
    },
    subtitle: {
      fontSize: t.typography.h2.fontSize,
      color: t.brand.neutral700,
      marginBottom: t.layout.sectionGap,
    },
    metaRow: {
      fontSize: t.typography.small.fontSize,
      color: t.brand.neutral500,
      marginBottom: 2,
    },
    tableHeader: {
      flexDirection: 'row',
      backgroundColor: t.table.headerBg,
      minHeight: t.layout.tableRowHeight,
      alignItems: 'center',
    },
    tableHeaderCell: {
      color: t.table.headerText,
      fontSize: t.typography.small.fontSize,
      fontWeight: 700,
      paddingHorizontal: 4,
      paddingVertical: 3,
    },
    tableRow: {
      flexDirection: 'row',
      minHeight: t.layout.tableRowHeight,
      alignItems: 'center',
      borderBottomWidth: t.table.borderWidth,
      borderBottomColor: t.table.borderColor,
    },
    tableRowAlt: {
      backgroundColor: t.table.rowAltBg,
    },
    tableCell: {
      fontSize: t.typography.body.fontSize,
      paddingHorizontal: 4,
      paddingVertical: 2,
    },
    summaryBox: {
      marginTop: t.layout.sectionGap,
      padding: 8,
      backgroundColor: t.brand.neutral100,
      borderRadius: 4,
      borderWidth: 0.5,
      borderColor: t.brand.neutral200,
    },
    summaryLabel: {
      fontSize: t.typography.small.fontSize,
      fontWeight: 600,
      color: t.brand.neutral700,
    },
    summaryValue: {
      fontSize: t.typography.h2.fontSize,
      fontWeight: 700,
      color: t.brand.primary,
    },
  });
}

export function getExcelStyles(t: ReportTokens) {
  return {
    headerFill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: t.table.headerBg.replace('#', 'FF') } },
    headerFont: { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 },
    zebraFill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: t.table.rowAltBg.replace('#', 'FF') } },
    borderThin: {
      top: { style: 'thin' as const, color: { argb: t.table.borderColor.replace('#', 'FF') } },
      bottom: { style: 'thin' as const, color: { argb: t.table.borderColor.replace('#', 'FF') } },
      left: { style: 'thin' as const, color: { argb: t.table.borderColor.replace('#', 'FF') } },
      right: { style: 'thin' as const, color: { argb: t.table.borderColor.replace('#', 'FF') } },
    },
    titleFont: { bold: true, size: 14, color: { argb: t.brand.neutral900.replace('#', 'FF') } },
    subtitleFont: { bold: true, size: 11, color: { argb: t.brand.neutral700.replace('#', 'FF') } },
    metaFont: { size: 9, color: { argb: t.brand.neutral500.replace('#', 'FF') } },
  };
}
