import { pdf, Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import type { DashboardData } from "./useDashboardData";
import type { EventBrandingResolved } from "@/hooks/useEventBranding";

const s = StyleSheet.create({
  page: { padding: 32, fontFamily: "Helvetica", fontSize: 9 },
  headerRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", marginBottom: 8, gap: 12 },
  logo: { height: 40, objectFit: "contain" },
  title: { fontSize: 14, fontWeight: "bold", textAlign: "center", marginTop: 4 },
  subtitle: { fontSize: 10, textAlign: "center", color: "#444" },
  meta: { fontSize: 9, textAlign: "center", color: "#666", marginBottom: 8 },
  divider: { borderBottomWidth: 1, borderBottomColor: "#ccc", marginVertical: 6 },
  sectionTitle: { fontSize: 11, fontWeight: "bold", marginTop: 10, marginBottom: 4, backgroundColor: "#f0f0f0", padding: 4 },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#ddd", paddingVertical: 3 },
  thRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#333", backgroundColor: "#fafafa", paddingVertical: 3 },
  th: { fontSize: 8, fontWeight: "bold" },
  td: { fontSize: 8 },
  kpiRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 },
  kpi: { width: "32%", borderWidth: 0.5, borderColor: "#ccc", padding: 6, marginBottom: 4 },
  kpiLabel: { fontSize: 7, color: "#666" },
  kpiValue: { fontSize: 13, fontWeight: "bold", marginTop: 2 },
  kpiSub: { fontSize: 7, color: "#888", marginTop: 2 },
  footer: { position: "absolute", bottom: 24, left: 32, right: 32, fontSize: 7, color: "#888", textAlign: "center", borderTopWidth: 0.5, borderTopColor: "#ccc", paddingTop: 4 },
});

interface Meta {
  eventName: string;
  branding?: EventBrandingResolved | null;
  generatedAt: Date;
}

function pct(n: number, total: number) { return total > 0 ? Math.round((n / total) * 100) : 0; }

function DashboardDocument({ data, meta }: { data: DashboardData; meta: Meta }) {
  const logos = (meta.branding?.logos || []).filter((l) => l.active).slice(0, 3);
  const headerTitle = meta.branding?.nome_oficial || meta.branding?.fallbackEventName || meta.eventName;
  const subtitle = meta.branding?.subtitulo || "";
  const localAno = meta.branding?.local_ano || "";
  const rodape = meta.branding?.rodape_texto || "JER Gestão";
  const dateStr = meta.generatedAt.toLocaleDateString("pt-BR");
  const timeStr = meta.generatedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const r = data.resumo;

  const kpis = [
    { l: "Participantes", v: r.participants_total, s: `${r.credentialed} credenciados (${pct(r.credentialed, r.participants_total)}%)` },
    { l: "Credenciais Ativas", v: r.credentials_active, s: `${r.credentials_today} emitidas hoje` },
    { l: "Partidas", v: r.matches_total, s: `${r.matches_done} concluídas · ${r.matches_published} publicadas` },
    { l: "Refeições Servidas", v: r.meals_total, s: `${r.meals_today} servidas hoje` },
    { l: "Alojamento", v: `${r.lodging_occupied}/${r.lodging_capacity}`, s: `${pct(r.lodging_occupied, r.lodging_capacity)}% de ocupação` },
    { l: "Transporte", v: r.transport_trips, s: `${r.transport_passengers} passageiros` },
  ];

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {logos.length > 0 && (
          <View style={s.headerRow}>{logos.map((l, i) => <Image key={i} src={l.url} style={s.logo} />)}</View>
        )}
        <Text style={s.title}>{headerTitle}</Text>
        {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
        <Text style={s.meta}>DASHBOARD OPERACIONAL — {dateStr} {timeStr}</Text>
        <View style={s.divider} />

        <Text style={s.sectionTitle}>Indicadores Gerais</Text>
        <View style={s.kpiRow}>
          {kpis.map((k, i) => (
            <View key={i} style={s.kpi}>
              <Text style={s.kpiLabel}>{k.l}</Text>
              <Text style={s.kpiValue}>{String(k.v)}</Text>
              <Text style={s.kpiSub}>{k.s}</Text>
            </View>
          ))}
        </View>

        <Text style={s.sectionTitle}>Progresso por Modalidade</Text>
        <View style={s.thRow}>
          <Text style={[s.th, { width: "52%" }]}>Modalidade</Text>
          <Text style={[s.th, { width: "12%", textAlign: "center" }]}>Total</Text>
          <Text style={[s.th, { width: "12%", textAlign: "center" }]}>Concluídas</Text>
          <Text style={[s.th, { width: "12%", textAlign: "center" }]}>Publicadas</Text>
          <Text style={[s.th, { width: "12%", textAlign: "center" }]}>%</Text>
        </View>
        {data.competicao.by_sport.slice(0, 30).map((row) => (
          <View key={row.sport_event_id} style={s.tr}>
            <Text style={[s.td, { width: "52%" }]}>{row.name}</Text>
            <Text style={[s.td, { width: "12%", textAlign: "center" }]}>{row.total}</Text>
            <Text style={[s.td, { width: "12%", textAlign: "center" }]}>{row.done}</Text>
            <Text style={[s.td, { width: "12%", textAlign: "center" }]}>{row.published}</Text>
            <Text style={[s.td, { width: "12%", textAlign: "center" }]}>{row.pct}%</Text>
          </View>
        ))}
        {data.competicao.by_sport.length === 0 && <Text style={s.td}>Sem dados.</Text>}

        <Text style={s.sectionTitle}>Credenciamento por Delegação</Text>
        <View style={s.thRow}>
          <Text style={[s.th, { width: "60%" }]}>Delegação</Text>
          <Text style={[s.th, { width: "13%", textAlign: "center" }]}>Inscritos</Text>
          <Text style={[s.th, { width: "15%", textAlign: "center" }]}>Credenciados</Text>
          <Text style={[s.th, { width: "12%", textAlign: "center" }]}>%</Text>
        </View>
        {data.credenciamento.by_delegation.slice(0, 40).map((row) => (
          <View key={row.delegation_id} style={s.tr}>
            <Text style={[s.td, { width: "60%" }]}>{row.name}</Text>
            <Text style={[s.td, { width: "13%", textAlign: "center" }]}>{row.total}</Text>
            <Text style={[s.td, { width: "15%", textAlign: "center" }]}>{row.credentialed}</Text>
            <Text style={[s.td, { width: "12%", textAlign: "center" }]}>{row.pct}%</Text>
          </View>
        ))}
        {data.credenciamento.by_delegation.length === 0 && <Text style={s.td}>Sem dados.</Text>}

        <Text style={s.sectionTitle}>Consumo de Refeições por Delegação</Text>
        <View style={s.thRow}>
          <Text style={[s.th, { width: "70%" }]}>Delegação</Text>
          <Text style={[s.th, { width: "30%", textAlign: "center" }]}>Refeições</Text>
        </View>
        {data.alimentacao.by_delegation.slice(0, 40).map((row, i) => (
          <View key={i} style={s.tr}>
            <Text style={[s.td, { width: "70%" }]}>{row.name}</Text>
            <Text style={[s.td, { width: "30%", textAlign: "center" }]}>{row.total}</Text>
          </View>
        ))}
        {data.alimentacao.by_delegation.length === 0 && <Text style={s.td}>Sem dados.</Text>}

        <Text style={s.footer}>
          {rodape}{localAno ? " • " + localAno : ""} • Gerado em {dateStr} às {timeStr}
        </Text>
      </Page>
    </Document>
  );
}

export async function exportDashboardPdf(data: DashboardData, meta: Meta): Promise<Blob> {
  return await pdf(<DashboardDocument data={data} meta={meta} />).toBlob();
}
