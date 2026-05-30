import { pdf, Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import type { EventBrandingResolved } from "@/hooks/useEventBranding";
import {
  EVIDENCE_CATEGORIES,
  type ExecucaoFisicaReport,
} from "./execucaoFisicaService";

// Paleta verde institucional
const GREEN = "#166534";
const GREEN_SOFT = "#dcfce7";
const GREEN_LINE = "#86efac";

const s = StyleSheet.create({
  page: { padding: 32, fontFamily: "Helvetica", fontSize: 9, color: "#1f2937" },
  headerRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    marginBottom: 10, borderBottomWidth: 2, borderBottomColor: GREEN, paddingBottom: 8,
  },
  logo: { height: 42, objectFit: "contain" },
  headerRight: { textAlign: "right", flex: 1 },
  headerTitle: { fontSize: 12, fontWeight: "bold", color: GREEN },
  headerMeta: { fontSize: 7, color: "#666", marginTop: 2 },
  title: {
    fontSize: 15, fontWeight: "bold", textAlign: "center", marginTop: 10, marginBottom: 4,
    color: GREEN, textTransform: "uppercase",
  },
  subtitle: { fontSize: 9, textAlign: "center", color: "#444", marginBottom: 12 },
  sectionTitle: {
    fontSize: 11, fontWeight: "bold", marginTop: 14, marginBottom: 6, color: "#fff",
    backgroundColor: GREEN, padding: 5,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", marginTop: 2 },
  gridCol2: { width: "50%", padding: 3 },
  label: { fontSize: 7, color: "#666", textTransform: "uppercase" },
  value: { fontSize: 10, fontWeight: "bold", marginTop: 1 },

  table: { marginTop: 6, borderWidth: 0.5, borderColor: GREEN_LINE },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#d1d5db" },
  trHead: { backgroundColor: GREEN_SOFT },
  trTotal: { backgroundColor: "#f0fdf4", borderTopWidth: 1, borderTopColor: GREEN },
  th: { fontSize: 7.5, fontWeight: "bold", padding: 4, color: GREEN },
  td: { fontSize: 7.5, padding: 4 },
  cellLeft: { flex: 3, textAlign: "left" },
  cellNum: { flex: 1, textAlign: "right" },

  declaration: { marginTop: 18, lineHeight: 1.5, fontSize: 9, textAlign: "justify" },
  signatureArea: { marginTop: 48, flexDirection: "row", justifyContent: "space-around" },
  signatureBox: { width: 230, alignItems: "center", borderTopWidth: 0.7, borderTopColor: "#333", paddingTop: 4 },
  footer: {
    position: "absolute", bottom: 18, left: 32, right: 32, fontSize: 7, color: "#888",
    textAlign: "center", borderTopWidth: 0.5, borderTopColor: "#ccc", paddingTop: 4,
  },
  note: { fontSize: 6.5, color: "#888", marginTop: 3, fontStyle: "italic" },
});

const nf = new Intl.NumberFormat("pt-BR");
const fmt = (n: number | null | undefined) => nf.format(Number(n || 0));
const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "—";

export interface ExecFisicaPdfMeta {
  branding?: EventBrandingResolved | null;
  generatedAt: Date;
  periodLabel: string;
  oscFallbackName?: string;
}

function ReportDocument({ report, meta }: { report: ExecucaoFisicaReport; meta: ExecFisicaPdfMeta }) {
  const id = report.identificacao;
  const rows = report.meta1.por_etapa.filter(
    (r) =>
      r.delegacoes_atendidas > 0 ||
      r.atletas_alojados > 0 ||
      r.refeicoes_fornecidas > 0 ||
      r.kits_entregues > 0,
  );
  const total = report.meta1.total;
  const oscName = id.osc_name || meta.oscFallbackName || "Instituto AcolheRR";
  const evCount = (cat: string) => report.evidencias.find((e) => e.osc_category === cat)?.count ?? 0;

  return (
    <Document title={`Relatório de Execução Física - ${id.event_name}`} author="JER Gestão">
      <Page size="A4" style={s.page}>
        <View style={s.headerRow}>
          {meta.branding?.logos?.[0]?.url && <Image src={meta.branding.logos[0].url} style={s.logo} />}
          <View style={s.headerRight}>
            <Text style={s.headerTitle}>{id.grantor_name || "Governo do Estado de Roraima"}</Text>
            <Text style={s.headerMeta}>{oscName}</Text>
            <Text style={s.headerMeta}>Termo de Fomento nº {id.termo_fomento}</Text>
          </View>
        </View>

        <Text style={s.title}>Relatório de Execução Física das Metas</Text>
        <Text style={s.subtitle}>{id.objeto} • Período: {meta.periodLabel}</Text>

        {/* Identificação */}
        <Text style={s.sectionTitle}>1. Identificação</Text>
        <View style={s.grid}>
          <View style={s.gridCol2}><Text style={s.label}>Termo de Fomento</Text><Text style={s.value}>{id.termo_fomento}</Text></View>
          <View style={s.gridCol2}><Text style={s.label}>Objeto</Text><Text style={s.value}>{id.objeto}</Text></View>
          <View style={s.gridCol2}><Text style={s.label}>OSC Parceira</Text><Text style={s.value}>{oscName}</Text></View>
          <View style={s.gridCol2}><Text style={s.label}>CNPJ</Text><Text style={s.value}>{id.osc_cnpj || "—"}</Text></View>
          <View style={s.gridCol2}><Text style={s.label}>Órgão Concedente</Text><Text style={s.value}>{id.grantor_name || "IDJUV/RR"}</Text></View>
          <View style={s.gridCol2}><Text style={s.label}>Vigência</Text><Text style={s.value}>{id.validity_start ? `${fmtDate(id.validity_start)} a ${fmtDate(id.validity_end)}` : "—"}</Text></View>
        </View>

        {/* Meta 1 */}
        <Text style={s.sectionTitle}>2. Meta 1 — Apoio às Delegações (por etapa regional / cidade-sede)</Text>
        <View style={s.table}>
          <View style={[s.tr, s.trHead]}>
            <Text style={[s.th, s.cellLeft]}>Etapa / Cidade-sede</Text>
            <Text style={[s.th, s.cellNum]}>Delegações</Text>
            <Text style={[s.th, s.cellNum]}>Atletas alojados</Text>
            <Text style={[s.th, s.cellNum]}>Refeições</Text>
            <Text style={[s.th, s.cellNum]}>Kits-atleta</Text>
          </View>
          {rows.map((r) => (
            <View style={s.tr} key={r.event_stage_id} wrap={false}>
              <Text style={[s.td, s.cellLeft]}>{r.host_city}</Text>
              <Text style={[s.td, s.cellNum]}>{fmt(r.delegacoes_atendidas)}</Text>
              <Text style={[s.td, s.cellNum]}>{fmt(r.atletas_alojados)}</Text>
              <Text style={[s.td, s.cellNum]}>{fmt(r.refeicoes_fornecidas)}</Text>
              <Text style={[s.td, s.cellNum]}>{fmt(r.kits_entregues)}</Text>
            </View>
          ))}
          <View style={[s.tr, s.trTotal]}>
            <Text style={[s.th, s.cellLeft]}>TOTAL (consolidado, sem duplicidade)</Text>
            <Text style={[s.th, s.cellNum]}>{fmt(total.delegacoes_atendidas)}</Text>
            <Text style={[s.th, s.cellNum]}>{fmt(total.atletas_alojados)}</Text>
            <Text style={[s.th, s.cellNum]}>{fmt(total.refeicoes_fornecidas)}</Text>
            <Text style={[s.th, s.cellNum]}>{fmt(total.kits_entregues)}</Text>
          </View>
        </View>
        <Text style={s.note}>
          O TOTAL é o consolidado único por participante no evento; a soma simples das etapas é maior porque um mesmo atleta pode participar de mais de uma etapa.
        </Text>

        {/* Meta 2 */}
        <Text style={s.sectionTitle}>3. Meta 2 — Competições (previsto x executado)</Text>
        <View style={s.table}>
          <View style={[s.tr, s.trHead]}>
            <Text style={[s.th, s.cellLeft]}>Indicador</Text>
            <Text style={[s.th, s.cellNum]}>Previsto</Text>
            <Text style={[s.th, s.cellNum]}>Executado</Text>
          </View>
          {report.meta2.map((m) => (
            <View style={s.tr} key={m.metric_key} wrap={false}>
              <Text style={[s.td, s.cellLeft]}>{m.label}</Text>
              <Text style={[s.td, s.cellNum]}>{m.previsto > 0 ? fmt(m.previsto) : "—"}</Text>
              <Text style={[s.td, s.cellNum]}>{fmt(m.executado)}</Text>
            </View>
          ))}
        </View>

        {/* Evidências */}
        <Text style={s.sectionTitle}>4. Checklist de Evidências</Text>
        <View style={s.grid}>
          <View style={s.gridCol2}><Text style={s.label}>Listas de credenciamento</Text><Text style={s.value}>Disponíveis no sistema (módulo Credenciamento)</Text></View>
          <View style={s.gridCol2}><Text style={s.label}>Relatório do sistema</Text><Text style={s.value}>Este documento (gerado automaticamente)</Text></View>
          {EVIDENCE_CATEGORIES.map((cat) => (
            <View style={s.gridCol2} key={cat}>
              <Text style={s.label}>Fotos — {cat}</Text>
              <Text style={s.value}>{evCount(cat)} evidência(s) aprovada(s)</Text>
            </View>
          ))}
        </View>

        {/* Declaração */}
        <Text style={s.sectionTitle}>5. Declaração</Text>
        <Text style={s.declaration}>
          Declaramos, para fins de prestação de contas junto ao IDJUV/RR, que os dados de execução
          FÍSICA constantes neste relatório foram extraídos diretamente do sistema JER Gestão e
          correspondem fielmente às atividades realizadas no âmbito do {id.objeto}. O presente
          documento trata exclusivamente da execução física das metas, não contemplando informações
          de natureza financeira.
        </Text>

        <View style={s.signatureArea}>
          <View style={s.signatureBox}>
            <Text style={s.value}>{id.responsible_name || "________________________________"}</Text>
            <Text style={s.label}>Responsável Técnico — {oscName}</Text>
          </View>
        </View>

        <Text style={s.footer} fixed>
          JER Gestão — Relatório de Execução Física das Metas — gerado em {meta.generatedAt.toLocaleString("pt-BR")}
        </Text>
      </Page>
    </Document>
  );
}

export async function exportExecucaoFisicaPdf(report: ExecucaoFisicaReport, meta: ExecFisicaPdfMeta) {
  const blob = await pdf(<ReportDocument report={report} meta={meta} />).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Execucao_Fisica_${report.identificacao.event_name.replace(/[^\w]+/g, "_")}_${Date.now()}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
