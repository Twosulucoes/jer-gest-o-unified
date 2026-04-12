// Report Design Tokens - aligned with JER's Gestão brand identity

export const reportTokens = {
  brand: {
    primary: '#0B3B8C',
    primaryLight: '#1A5BC4',
    secondary: '#F2B705',
    support: '#1F8A4C',
    neutral900: '#111827',
    neutral700: '#374151',
    neutral500: '#6B7280',
    neutral200: '#E5E7EB',
    neutral100: '#F6F7FB',
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
    headerBg: '#0B3B8C',
    headerText: '#FFFFFF',
    rowAltBg: '#F6F7FB',
    borderColor: '#E5E7EB',
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