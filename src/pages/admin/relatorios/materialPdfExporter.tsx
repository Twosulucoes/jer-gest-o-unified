import { pdf, Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import type { EventBrandingResolved } from "@/hooks/useEventBranding";
import {
  ptLabel,
  computeResumoQuantidade,
  type MaterialKitSummary,
  type MaterialDeliveryRow,
  type MaterialSchoolBreakdownRow,
} from "./useMaterialEntregasRelatorio";

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
  thRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#333", backgroundColor: "#fafafa", paddingVertical: 3 },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#ddd", paddingVertical: 3 },
  trAlt: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#ddd", paddingVertical: 3, backgroundColor: "#fafafa" },
  th: { fontSize: 8, fontWeight: "bold" },
  td: { fontSize: 8 },
  tdGreen: { fontSize: 8, color: "#16a34a", fontWeight: "bold" },
  tdAmber: { fontSize: 8, color: "#d97706" },
  tdRed: { fontSize: 8, color: "#dc2626" },
  footer: { position: "absolute", bottom: 24, left: 32, right: 32, fontSize: 7, color: "#888", textAlign: "center", borderTopWidth: 0.5, borderTopColor: "#ccc", paddingTop: 4 },
});

interface Meta {
  eventName: string;
  branding?: EventBrandingResolved | null;
  generatedAt: Date;
}

interface MaterialReportData {
  kits: MaterialKitSummary[];
  deliveries: MaterialDeliveryRow[];
  schoolBreakdown: MaterialSchoolBreakdownRow[];
}

function fmtDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

function MaterialDocument({ data, meta }: { data: MaterialReportData; meta: Meta }) {
  const logos = (meta.branding?.logos || []).filter((l) => l.active).slice(0, 3);
  const headerTitle = meta.branding?.nome_oficial || meta.branding?.fallbackEventName || meta.eventName;
  const subtitle = meta.branding?.subtitulo || "";
  const localAno = meta.branding?.local_ano || "";
  const rodape = meta.branding?.rodape_texto || "JER Gestão";
  const dateStr = meta.generatedAt.toLocaleDateString("pt-BR");
  const timeStr = meta.generatedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  const resumo = computeResumoQuantidade(data.kits, data.deliveries);
  const kitsAtivos = data.kits.filter((k) => k.is_active).length;

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {logos.length > 0 && (
          <View style={s.headerRow}>
            {logos.map((l, i) => (
              <Image key={i} src={l.url} style={s.logo} />
            ))}
          </View>
        )}
        <Text style={s.title}>{headerTitle}</Text>
        {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
        <Text style={s.meta}>RELATÓRIO DE ENTREGAS DE MATERIAL — {dateStr} às {timeStr}</Text>
        <View style={s.divider} />

        {/* Conferência de Quantidade */}
        <Text style={s.sectionTitle}>Conferência de Quantidade</Text>
        <Text style={{ fontSize: 8, color: "#666", marginBottom: 4 }}>
          Todo bipe com material entregue conta, tenha ou não o crachá sido reconhecido.
        </Text>
        <View style={s.kpiRow}>
          <View style={[s.kpi, { width: "31%" }]}>
            <Text style={s.kpiLabel}>Total entregue (controle de quantidade)</Text>
            <Text style={[s.kpiValue, { color: "#16a34a", fontSize: 16 }]}>{resumo.entreguesTotal}</Text>
            <Text style={{ fontSize: 6, color: "#888" }}>
              {resumo.identificadas} identificadas + {resumo.naoIdentificadas} não identificadas
            </Text>
          </View>
          <View style={s.kpi}>
            <Text style={s.kpiLabel}>Identificadas</Text>
            <Text style={s.kpiValue}>{resumo.identificadas}</Text>
            <Text style={{ fontSize: 6, color: "#888" }}>crachá reconhecido</Text>
          </View>
          <View style={s.kpi}>
            <Text style={s.kpiLabel}>Não identificadas</Text>
            <Text style={[s.kpiValue, { color: "#d97706" }]}>{resumo.naoIdentificadas}</Text>
            <Text style={{ fontSize: 6, color: "#888" }}>crachá não cadastrado</Text>
          </View>
        </View>
        <View style={s.kpiRow}>
          <View style={s.kpi}>
            <Text style={s.kpiLabel}>Credenciados</Text>
            <Text style={s.kpiValue}>{resumo.credenciados ?? "—"}</Text>
          </View>
          <View style={s.kpi}>
            <Text style={s.kpiLabel}>Diferença (entregue − credenciado)</Text>
            <Text style={[s.kpiValue, (resumo.diferenca ?? 0) > 0 ? { color: "#d97706" } : {}]}>
              {resumo.diferenca === null ? "—" : `${resumo.diferenca > 0 ? "+" : ""}${resumo.diferenca}`}
            </Text>
            {(resumo.diferenca ?? 0) > 0 && (
              <Text style={{ fontSize: 6, color: "#d97706" }}>saíram mais kits que credenciados</Text>
            )}
          </View>
          <View style={s.kpi}>
            <Text style={s.kpiLabel}>Estornadas</Text>
            <Text style={s.kpiValue}>{resumo.estornadas}</Text>
          </View>
          <View style={s.kpi}>
            <Text style={s.kpiLabel}>Kits Ativos</Text>
            <Text style={s.kpiValue}>{kitsAtivos}</Text>
          </View>
        </View>

        {/* Por kit */}
        <Text style={s.sectionTitle}>Progresso por Kit</Text>
        <View style={s.thRow}>
          <Text style={[s.th, { width: "35%" }]}>Kit</Text>
          <Text style={[s.th, { width: "18%" }]}>Etapa</Text>
          <Text style={[s.th, { width: "15%", textAlign: "center" }]}>Entregues</Text>
          <Text style={[s.th, { width: "17%", textAlign: "center" }]}>Credenciados</Text>
          <Text style={[s.th, { width: "15%", textAlign: "right" }]}>Faltam</Text>
        </View>
        {data.kits.map((k, i) => (
          <View key={k.id} style={i % 2 === 0 ? s.tr : s.trAlt}>
            <Text style={[s.td, { width: "35%" }]}>{k.name}</Text>
            <Text style={[s.td, { width: "18%" }]}>{k.stage_name || "—"}</Text>
            <Text style={[s.tdGreen, { width: "15%", textAlign: "center" }]}>{k.delivered}</Text>
            <Text style={[s.td, { width: "17%", textAlign: "center" }]}>{k.credentialed ?? "—"}</Text>
            <Text style={[s.tdAmber, { width: "15%", textAlign: "right" }]}>{k.faltam ?? "—"}</Text>
          </View>
        ))}
        {data.kits.length === 0 && <Text style={s.td}>Sem kits cadastrados.</Text>}

        {/* Por escola */}
        <Text style={s.sectionTitle}>Entregas por Escola</Text>
        <View style={s.thRow}>
          <Text style={[s.th, { width: "30%" }]}>Kit</Text>
          <Text style={[s.th, { width: "35%" }]}>Escola</Text>
          <Text style={[s.th, { width: "15%", textAlign: "center" }]}>Entregues</Text>
          <Text style={[s.th, { width: "20%", textAlign: "right" }]}>Faltam</Text>
        </View>
        {data.schoolBreakdown.map((r, i) => (
          <View key={`${r.kit_id}-${r.escola}-${i}`} style={i % 2 === 0 ? s.tr : s.trAlt}>
            <Text style={[s.td, { width: "30%" }]}>{r.kit_name}</Text>
            <Text style={[s.td, { width: "35%" }]}>{r.escola}</Text>
            <Text style={[s.tdGreen, { width: "15%", textAlign: "center" }]}>{r.delivered}</Text>
            <Text style={[s.tdAmber, { width: "20%", textAlign: "right" }]}>{r.faltam ?? "—"}</Text>
          </View>
        ))}
        {data.schoolBreakdown.length === 0 && <Text style={s.td}>Sem dados.</Text>}

        {/* Detalhado */}
        <Text style={s.sectionTitle} break>
          Entregas Detalhadas ({data.deliveries.length})
        </Text>
        <View style={s.thRow}>
          <Text style={[s.th, { width: "12%" }]}>Identificação</Text>
          <Text style={[s.th, { width: "22%" }]}>Participante</Text>
          <Text style={[s.th, { width: "18%" }]}>Escola</Text>
          <Text style={[s.th, { width: "14%" }]}>Kit</Text>
          <Text style={[s.th, { width: "11%" }]}>Tipo</Text>
          <Text style={[s.th, { width: "14%" }]}>Data/Hora</Text>
          <Text style={[s.th, { width: "9%", textAlign: "center" }]}>Status</Text>
        </View>
        {data.deliveries.map((d, i) => (
          <View key={d.id} style={i % 2 === 0 ? s.tr : s.trAlt}>
            <Text style={[d.linked ? s.td : s.tdAmber, { width: "12%" }]}>
              {d.linked ? "Identificada" : "Não ident."}
            </Text>
            <Text style={[d.linked ? s.td : s.tdAmber, { width: "22%" }]}>
              {d.linked ? d.full_name || "—" : `Crachá não vinculado (${d.qr_code})`}
            </Text>
            <Text style={[s.td, { width: "18%" }]}>{d.escola}</Text>
            <Text style={[s.td, { width: "14%" }]}>{d.kit_name}</Text>
            <Text style={[s.td, { width: "11%" }]}>{d.linked ? ptLabel(d.participant_type) : "—"}</Text>
            <Text style={[s.td, { width: "14%" }]}>{fmtDateTime(d.delivered_at)}</Text>
            <Text style={[d.status === "active" ? s.tdGreen : s.tdRed, { width: "9%", textAlign: "center" }]}>
              {d.status === "active" ? "Entregue" : "Estornada"}
            </Text>
          </View>
        ))}
        {data.deliveries.length === 0 && <Text style={s.td}>Nenhuma entrega para os filtros selecionados.</Text>}

        <Text style={s.footer}>
          {rodape}
          {localAno ? " • " + localAno : ""} • Gerado em {dateStr} às {timeStr}
        </Text>
      </Page>
    </Document>
  );
}

export async function exportMaterialPdf(data: MaterialReportData, meta: Meta): Promise<Blob> {
  return await pdf(<MaterialDocument data={data} meta={meta} />).toBlob();
}
