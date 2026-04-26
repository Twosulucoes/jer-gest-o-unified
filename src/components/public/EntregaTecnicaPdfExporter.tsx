import { pdf, Document, Page, Text, View, StyleSheet, Image, Font } from "@react-pdf/renderer";
import { brand } from "@/theme/brand";

// Register fonts for better visual identity
Font.register({
  family: 'Montserrat',
  src: 'https://fonts.gstatic.com/s/montserrat/v25/JTUSjIg1_i6t8kCHKm4df1XWvG7061Jm.ttf',
  fontWeight: 'black',
});

Font.register({
  family: 'Inter',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.woff2', fontWeight: 'normal' },
    { src: 'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuGkyAZ9hiA.woff2', fontWeight: 'bold' },
  ]
});

const styles = StyleSheet.create({
  page: {
    padding: 40,
    backgroundColor: '#FFFFFF',
    fontFamily: 'Helvetica',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
    borderBottom: 2,
    borderBottomColor: brand.colors.primary,
    paddingBottom: 10,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: brand.colors.primary,
  },
  logoAccent: {
    color: brand.colors.accentTeal,
  },
  headerTitle: {
    fontSize: 10,
    color: brand.colors.muted,
    textAlign: 'right',
  },
  hero: {
    marginBottom: 30,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: brand.colors.primary,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    color: brand.colors.muted,
    marginBottom: 20,
    lineHeight: 1.5,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 30,
  },
  statCard: {
    flex: 1,
    padding: 15,
    backgroundColor: brand.colors.background,
    borderRadius: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: brand.colors.primary,
  },
  statLabel: {
    fontSize: 8,
    color: brand.colors.muted,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  section: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: brand.colors.primary,
    marginBottom: 12,
    borderLeft: 4,
    borderLeftColor: brand.colors.accentTeal,
    paddingLeft: 10,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  card: {
    width: '48%',
    padding: 12,
    border: 1,
    borderColor: brand.colors.border,
    borderRadius: 6,
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: brand.colors.primary,
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 9,
    color: brand.colors.muted,
    lineHeight: 1.4,
  },
  checklistRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottom: 1,
    borderBottomColor: brand.colors.border,
  },
  checklistMod: {
    fontSize: 10,
    fontWeight: 'bold',
    color: brand.colors.primary,
  },
  checklistDesc: {
    fontSize: 10,
    color: brand.colors.muted,
  },
  footer: {
    position: 'absolute',
    bottom: 40,
    left: 40,
    right: 40,
    borderTop: 1,
    borderTopColor: brand.colors.border,
    paddingTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 8,
    color: brand.colors.muted,
  },
  developerInfo: {
    fontSize: 8,
    color: brand.colors.primary,
    fontWeight: 'bold',
  }
});

interface EntregaTecnicaData {
  totalModulos: number;
  stats: {
    athletes: number;
    sports: number;
    medals: number;
    matchesToday: number;
    roles: number;
    latency: number;
  } | undefined;
  techStack: { name: string; desc: string }[];
  checklistItems: { mod: string; desc: string }[];
  modules: { title: string; desc: string }[];
}

const EntregaTecnicaDocument = ({ data }: { data: EntregaTecnicaData }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <Text style={styles.logoText}>JER <Text style={styles.logoAccent}>Gestão</Text></Text>
        </View>
        <View>
          <Text style={styles.headerTitle}>ENTREGA TÉCNICA · 2026</Text>
          <Text style={styles.headerTitle}>Plataforma Oficial Jogos Escolares de Roraima</Text>
        </View>
      </View>

      {/* Hero */}
      <View style={styles.hero}>
        <Text style={styles.title}>Relatório de Entrega Final</Text>
        <Text style={styles.subtitle}>
          Uma plataforma robusta, escalável e resiliente que orquestra {data.totalModulos} módulos integrados — 
          da importação SIGECOM à publicação pública dos resultados — operando com sincronização offline-first em campo.
        </Text>
      </View>

      {/* Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{data.totalModulos}</Text>
          <Text style={styles.statLabel}>Módulos Integrados</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>3</Text>
          <Text style={styles.statLabel}>PWAs Operacionais</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{data.stats?.roles ?? 12}</Text>
          <Text style={styles.statLabel}>Perfis de Acesso</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{data.stats?.latency ?? 24}ms</Text>
          <Text style={styles.statLabel}>Latência Média</Text>
        </View>
      </View>

      {/* Stack Técnica */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Stack Tecnológica</Text>
        <View style={styles.grid}>
          {data.techStack.map((tech, i) => (
            <View key={i} style={styles.card}>
              <Text style={styles.cardTitle}>{tech.name}</Text>
              <Text style={styles.cardDesc}>{tech.desc}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Checklist de Entrega */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Checklist de Homologação</Text>
        <View>
          {data.checklistItems.map((item, i) => (
            <View key={i} style={styles.checklistRow}>
              <Text style={styles.checklistMod}>{item.mod}</Text>
              <Text style={styles.checklistDesc}>{item.desc}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer} fixed>
        <Text style={styles.footerText}>Gerado em {new Date().toLocaleDateString('pt-BR')}</Text>
        <Text style={styles.developerInfo}>Desenvolvido por {brand.developer.name}</Text>
      </View>
    </Page>
  </Document>
);

export async function exportEntregaTecnicaPdf(data: EntregaTecnicaData) {
  const blob = await pdf(<EntregaTecnicaDocument data={data} />).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `entrega-tecnica-jer-2026.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
