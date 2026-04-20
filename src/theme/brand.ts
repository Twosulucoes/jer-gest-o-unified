/** JER Gestão — Brand Design Tokens (source of truth) */

export const brand = {
  brandName: "JER Gestão",
  colors: {
    primary: '#0B2B5A',
    primaryHover: '#072044',
    accentBlue: '#0F5AA6',
    accentTeal: '#0BA3A3',
    accentGreen: '#33B249',
    accentLime: '#B5E12A',
    text: '#0B1220',
    muted: '#64748B',
    border: '#E2E8F0',
    background: '#F6F8FC',
    surface: '#FFFFFF',
    success: '#33B249',
    warning: '#F2B705',
    danger: '#E11D48',
    info: '#0F5AA6',
  },
  gradients: {
    brandGradient: 'linear-gradient(135deg, #0B2B5A 0%, #0F5AA6 35%, #0BA3A3 65%, #33B249 100%)',
    brandGradientSoft: 'linear-gradient(135deg, rgba(11,43,90,0.08) 0%, rgba(15,90,166,0.08) 35%, rgba(11,163,163,0.06) 65%, rgba(51,178,73,0.06) 100%)',
  },
  typography: {
    headingFont: "'Montserrat', sans-serif",
    bodyFont: "'Inter', sans-serif",
  },
  radius: {
    card: '1rem',
    button: '0.75rem',
    input: '0.75rem',
  },
  table: {
    zebraBg: '#F6F8FC',
    headerBg: '#0B2B5A',
    headerText: '#FFFFFF',
    border: '#E2E8F0',
  },
  developer: {
    name: 'Two Soluções',
    role: 'Desenvolvedora da Plataforma',
    website: 'https://twosulucoes.com.br',
  },
} as const;

export type Brand = typeof brand;
