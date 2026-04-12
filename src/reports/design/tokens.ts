// Report Design Tokens - aligned with JER Gestão design system (index.css)

export const reportTokens = {
  brand: {
    primary: '#2D7A4F',       // hsl(152, 55%, 28%)
    primaryLight: '#3DA366',  // hsl(152, 55%, 45%)
    secondary: '#E8A800',     // hsl(38, 92%, 50%)
    neutral900: '#1A2332',    // hsl(224, 28%, 12%)
    neutral700: '#3D4A5C',
    neutral500: '#6B7280',
    neutral200: '#E5E7EB',
    neutral100: '#F3F4F6',
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
    headerBg: '#2D7A4F',
    headerText: '#FFFFFF',
    rowAltBg: '#F9FAFB',
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
