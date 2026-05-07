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
  kpiRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 },
  kpi: { width: "23%", borderWidth: 0.5, borderColor: "#ccc", padding: 6 },
  kpiLabel: { fontSize: 7, color: "#666" },
  kpiValue: { fontSize: 13, fontWeight: "bold", marginTop: 2 },
  kpiSub: { fontSize: 7, color: "#888", marginTop: 2 },
  progressBar: { height: 8, backgroundColor: "#e5e7eb", borderRadius: 4, marginVertical: 4 },
  progressFill: { height: 8, backgroundColor: "#22c55e", borderRadius: 4 },
  thRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#333", backgroundColor: "#fafafa", paddingVertical: 3 },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#ddd", paddingVertical: 3 },
  trAlt: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#ddd", paddingVertical: 3, backgroundColor: "#fafafa" },
  th: { fontSize: 8, fontWeight: "bold" },
  td: { fontSize: 8 },
  tdGreen: { fontSize: 8, color: "#16a34a", fontWeight: "bold" },
  tdAmber: { fontSize: 8, color: "#d97706" },
  totalRow: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "#333", paddingVertical: 4, backgroundColor: "#f0f0f0" },
  footer: { position: "absolute", bottom: 24, left: 32, right: 32, fontSize: 7, color: "#888", textAlign: "center", borderTopWidth: 0.5, borderTopColor: "#ccc", paddingTop: 4 },
});

interface Meta {
  eventName: string;
  branding?: EventBrandingResolved | null;
  generatedAt: Date;
}

function pct(n: number, total: number) { return total > 0 ? Math.round((n / total) * 100) : 0; }
function fmtDate(d: string) {
  try { return new Date(d + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }); }
  catch { return d; }
}

function CredenciamentoDocument({ data, meta }: { data: DashboardData; meta: Meta }) {
  const logos = (meta.branding?.logos || []).filter((l) => l.active).slice(0, 3);
  const headerTitle = meta.branding?.nome_oficial || meta.branding?.fallbackEventName || meta.eventName;
  const subtitle = meta.branding?.subtitulo || "";
  const localAno = meta.branding?.local_ano || "";
  const rodape = meta.branding?.rodape_texto || "JER Gestão";
  const dateStr = meta.generatedAt.toLocaleDateString("pt-BR");
  const timeStr = meta.generatedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const r = data.resumo;
  const credPct = pct(r.credentialed, r.athletes_total);

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {logos.length > 0 && (
          <View style={s.headerRow}>
            {logos.map((l, i) => <Image key={i} src={l.url} style={s.logo} />)}
          </View>
        )}
        <Text style={s.title}>{headerTitle}</Text>
        {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
        <Text style={s.meta}>RELATÓRIO DE CREDENCIAMENTO — {dateStr} às {timeStr}</Text>
        <View style={s.divider} />

        {/* KPIs */}
        <Text style={s.sectionTitle}>Indicadores de Credenciamento</Text>
        <View style={s.kpiRow}>
          <View style={s.kpi}>
            <Text style={s.kpiLabel}>Total de Atletas</Text>
            <Text style={s.kpiValue}>{r.athletes_total}</Text>
            <Text style={s.kpiSub}>participantes cadastrados</Text>
          </View>
          <View style={s.kpi}>
            <Text style={s.kpiLabel}>Credenciados</Text>
            <Text style={s.kpiValue}>{r.credentialed}</Text>
            <Text style={s.kpiSub}>{credPct}% do total</Text>
          </View>
          <View style={s.kpi}>
            <Text style={s.kpiLabel}>Credenciais Ativas</Text>
            <Text style={s.kpiValue}>{r.credentials_active}</Text>
            <Text style={s.kpiSub}>em vigor</Text>
          </View>
          <View style={s.kpi}>
            <Text style={s.kpiLabel}>Emitidas Hoje</Text>
            <Text style={s.kpiValue}>{r.credentials_today}</Text>
            <Text style={s.kpiSub}>novas credenciais no dia</Text>
          </View>
        </View>

        {/* Progresso geral */}
        <View style={{ marginBottom: 10 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 2 }}>
            <Text style={{ fontSize: 8, fontWeight: "bold" }}>Progresso geral de credenciamento</Text>
            <Text style={{ fontSize: 8 }}>{credPct}%</Text>
          </View>
          <View style={s.progressBar}>
            <View style={[s.progressFill, { width: `${credPct}%` }]} />
          </View>
          <Text style={{ fontSize: 7, color: "#888" }}>
            {r.athletes_total - r.credentialed} participantes ainda não credenciados
          </Text>
        </View>

        {/* Credenciamentos por dia */}
        {data.credenciamento.daily.length > 0 && (
          <>
            <Text style={s.sectionTitle}>Credenciamentos por Dia</Text>
            <View style={s.thRow}>
              <Text style={[s.th, { width: "50%" }]}>Data</Text>
              <Text style={[s.th, { width: "50%", textAlign: "center" }]}>Credenciamentos</Text>
            </View>
            {data.credenciamento.daily.map((d, i) => (
              <View key={i} style={i % 2 === 0 ? s.tr : s.trAlt}>
                <Text style={[s.td, { width: "50%" }]}>{fmtDate(d.date)}</Text>
                <Text style={[s.td, { width: "50%", textAlign: "center" }]}>{d.count}</Text>
              </View>
            ))}
          </>
        )}

        {/* Por delegação */}
        <Text style={s.sectionTitle}>Detalhamento por Delegação</Text>
        <View style={s.thRow}>
          <Text style={[s.th, { width: "45%" }]}>Delegação</Text>
          <Text style={[s.th, { width: "13%", textAlign: "center" }]}>Total</Text>
          <Text style={[s.th, { width: "17%", textAlign: "center" }]}>Credenciados</Text>
          <Text style={[s.th, { width: "13%", textAlign: "center" }]}>Pendentes</Text>
          <Text style={[s.th, { width: "12%", textAlign: "right" }]}>%</Text>
        </View>
        {data.credenciamento.by_delegation.map((d, i) => (
          <View key={d.delegation_id} style={i % 2 === 0 ? s.tr : s.trAlt}>
            <Text style={[s.td, { width: "45%" }]}>{d.name}</Text>
            <Text style={[s.td, { width: "13%", textAlign: "center" }]}>{d.total}</Text>
            <Text style={[s.tdGreen, { width: "17%", textAlign: "center" }]}>{d.credentialed}</Text>
            <Text style={[s.tdAmber, { width: "13%", textAlign: "center" }]}>{d.total - d.credentialed}</Text>
            <Text style={[s.td, { width: "12%", textAlign: "right" }]}>{d.pct}%</Text>
          </View>
        ))}
        {data.credenciamento.by_delegation.length === 0 && <Text style={s.td}>Sem dados.</Text>}

        {/* Totais */}
        {data.credenciamento.by_delegation.length > 0 && (
          <View style={s.totalRow}>
            <Text style={[s.th, { width: "45%" }]}>TOTAL GERAL</Text>
            <Text style={[s.th, { width: "13%", textAlign: "center" }]}>{r.athletes_total}</Text>
            <Text style={[s.th, { width: "17%", textAlign: "center", color: "#16a34a" }]}>{r.credentialed}</Text>
            <Text style={[s.th, { width: "13%", textAlign: "center", color: "#d97706" }]}>{r.athletes_total - r.credentialed}</Text>
            <Text style={[s.th, { width: "12%", textAlign: "right" }]}>{credPct}%</Text>
          </View>
        )}

        <Text style={s.footer}>
          {rodape}{localAno ? " • " + localAno : ""} • Gerado em {dateStr} às {timeStr}
        </Text>
      </Page>
    </Document>
  );
}

export async function exportCredenciamentoPdf(data: DashboardData, meta: Meta): Promise<Blob> {
  return await pdf(<CredenciamentoDocument data={data} meta={meta} />).toBlob();
}
