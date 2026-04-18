// Report Design Tokens - aligned with JER's Gestão brand identity

export const reportTokens = {
  brand: {
    primary: '#0B2B5A',
    primaryLight: '#0F5AA6',
    secondary: '#0BA3A3',
    support: '#33B249',
    neutral900: '#0B1220',
    neutral700: '#334155',
    neutral500: '#64748B',
    neutral200: '#E2E8F0',
    neutral100: '#F6F8FC',
    white: '#FFFFFF',
  },
  typography: {
    fontFamily: 'Helvetica',
    h1: { fontSize: 20, fontWeight: 700 as const },
    h2: { fontSize: 14, fontWeight: 600 as const },
    body: { fontSize: 10, fontWeight: 400 as const },
    small: { fontSize: 8, fontWeight: 400 as const },
    monospace: 'Courier',
  },
  layout: {
    pageMargin: { top: 60, right: 40, bottom: 50, left: 40 },
    headerHeight: 50,
    footerHeight: 30,
    sectionGap: 12,
    tableRowHeight: 20,
  },
  table: {
    headerBg: '#0B2B5A',
    headerText: '#FFFFFF',
    rowAltBg: '#F6F8FC',
    borderColor: '#E2E8F0',
    borderWidth: 0.5,
    zebra: true,
  },
  statusPill: {
    success: { bg: '#DEF7EC', text: '#03543F' },
    warn: { bg: '#FEF3C7', text: '#92400E' },
    danger: { bg: '#FEE2E2', text: '#991B1B' },
    info: { bg: '#DBEAFE', text: '#1E40AF' },
  },
} as const;

export type ReportTokens = typeof reportTokens;
