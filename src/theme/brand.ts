/** JER's Gestão — Brand Design Tokens (source of truth) */

export const brand = {
  colors: {
    primary: '#0B3B8C',
    primaryHover: '#072A63',
    accent: '#F2B705',
    support: '#1F8A4C',
    text: '#111827',
    muted: '#6B7280',
    border: '#E5E7EB',
    background: '#F6F7FB',
    white: '#FFFFFF',
  },
  typography: {
    headingFont: "'Montserrat', sans-serif",
    bodyFont: "'Inter', sans-serif",
  },
  radius: '0.75rem',
} as const;

export type Brand = typeof brand;
