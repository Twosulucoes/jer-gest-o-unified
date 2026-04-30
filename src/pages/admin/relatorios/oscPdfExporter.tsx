import { pdf, Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import type { OscData } from "./useOscData";
import type { EventBrandingResolved } from "@/hooks/useEventBranding";
import type { EventOscConfig } from "@/hooks/useEventOscConfig";
import QRCode from "qrcode";

const s = StyleSheet.create({
  page: { padding: 32, fontFamily: "Helvetica", fontSize: 9 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12, borderBottomWidth: 1, borderBottomColor: "#0B2B5A", paddingBottom: 8 },
  logo: { height: 40, objectFit: "contain" },
  headerRight: { textAlign: "right", flex: 1 },
  headerTitle: { fontSize: 14, fontWeight: "bold", color: "#0B2B5A" },
  headerMeta: { fontSize: 7, color: "#666", marginTop: 2 },
  title: { fontSize: 16, fontWeight: "bold", textAlign: "center", marginTop: 16, marginBottom: 8, color: "#0B2B5A", textTransform: "uppercase" },
  subtitle: { fontSize: 10, textAlign: "center", color: "#444", marginBottom: 16 },
  sectionTitle: { fontSize: 12, fontWeight: "bold", marginTop: 16, marginBottom: 6, color: "#0B2B5A", backgroundColor: "#f0f4f8", padding: 4 },
  grid: { flexDirection: "row", flexWrap: "wrap", marginTop: 4 },
  gridCol2: { width: "50%", padding: 4 },
  gridCol3: { width: "33.33%", padding: 4 },
  label: { fontSize: 7, color: "#666", textTransform: "uppercase" },
  value: { fontSize: 10, fontWeight: "bold", marginTop: 2 },
  evidenceGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  evidenceCard: { width: "48%", border: "0.5px solid #eee", padding: 4 },
  evidenceImg: { width: "100%", height: 120, objectFit: "cover" },
  evidenceLabel: { fontSize: 6, color: "#444", marginTop: 4 },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#ddd", paddingVertical: 4 },
  th: { fontSize: 8, fontWeight: "bold", backgroundColor: "#f9fafb" },
  td: { fontSize: 8 },
  footer: { position: "absolute", bottom: 20, left: 32, right: 32, fontSize: 7, color: "#888", textAlign: "center", borderTopWidth: 0.5, borderTopColor: "#ccc", paddingTop: 4 },
  signatureArea: { marginTop: 40, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  signatureBox: { width: 220, alignItems: "center", borderTopWidth: 0.5, borderTopColor: "#333", paddingTop: 4 },
  qrBox: { width: 80, alignItems: "center" },
  qrImg: { width: 60, height: 60 },
  qrText: { fontSize: 6, color: "#666", marginTop: 2, textAlign: "center" },
  statusBadge: { 
    position: "absolute", 
    top: 100, 
    right: 32, 
    borderWidth: 2, 
    borderColor: "#059669", 
    color: "#059669", 
    padding: 8, 
    borderRadius: 4, 
    transform: "rotate(15deg)",
    opacity: 0.8
  },
  statusText: { fontSize: 12, fontWeight: "bold", textTransform: "uppercase" }
});

interface Meta {
  eventName: string;
  branding?: EventBrandingResolved | null;
  oscConfig?: EventOscConfig | null;
  generatedAt: Date;
  periodLabel: string;
  evidences?: any[];
  reportId?: string;
  qrCodeDataUrl?: string;
}

function OscDocument({ data, meta }: { data: OscData; meta: Meta }) {
  const r = data.resumo;
  const config = meta.oscConfig;
  const evs = meta.evidences || [];

  return (
    <Document title={`Relatório OSC - ${meta.eventName}`} author="JER Gestão">
      <Page size="A4" style={s.page}>
        <View style={s.headerRow}>
          {meta.branding?.logos?.[0]?.url && <Image src={meta.branding.logos[0].url} style={s.logo} />}
          <View style={s.headerRight}>
            <Text style={s.headerTitle}>{config?.grantor_name || "Governo de Roraima"}</Text>
            <Text style={s.headerMeta}>{config?.osc_name || "IDR - Instituto de Desporto de Roraima"}</Text>
            <Text style={s.headerMeta}>Convênio nº {config?.contract_number || "—"} / {config?.contract_year || "2026"}</Text>
          </View>
        </View>

        {/* Carimbo de Publicado se houver ReportId */}
        {meta.reportId && (
          <View style={s.statusBadge}>
            <Text style={s.statusText}>PUBLICADO</Text>
            <Text style={{ fontSize: 7, marginTop: 2 }}>VIA JER GESTÃO</Text>
          </View>
        )}

        <Text style={s.title}>Relatório de Prestação de Contas</Text>
        <Text style={s.subtitle}>Evento: {meta.eventName} | Período: {meta.periodLabel}</Text>

        <Text style={s.sectionTitle}>1. Identificação Institucional</Text>
        <View style={s.grid}>
          <View style={s.gridCol2}><Text style={s.label}>OSC Responsável</Text><Text style={s.value}>{config?.osc_name || "—"}</Text></View>
          <View style={s.gridCol2}><Text style={s.label}>CNPJ</Text><Text style={s.value}>{config?.osc_cnpj || "—"}</Text></View>
          <View style={s.gridCol2}><Text style={s.label}>Responsável Técnico</Text><Text style={s.value}>{config?.responsible_name || "—"}</Text></View>
          <View style={s.gridCol2}><Text style={s.label}>Vigência</Text><Text style={s.value}>{config?.validity_start ? `${config.validity_start} a ${config.validity_end}` : "—"}</Text></View>
        </View>

        <Text style={s.sectionTitle}>2. Resumo Executivo</Text>
        <Text style={[s.td, { lineHeight: 1.4 }]}>
          {config?.summary_model || `A etapa de ${meta.eventName} foi realizada com sucesso, atendendo ${r.totalParticipants} participantes de ${r.totalDelegations} delegações, com a execução de ${r.totalSports} modalidades esportivas e ${r.totalMatches} partidas registradas.`}
        </Text>

        <Text style={s.sectionTitle}>3. Indicadores Consolidados</Text>
        <View style={s.grid}>
          <View style={s.gridCol3}><Text style={s.label}>Total Participantes</Text><Text style={s.value}>{r.totalParticipants}</Text></View>
          <View style={s.gridCol3}><Text style={s.label}>Total Atletas</Text><Text style={s.value}>{r.totalAthletes}</Text></View>
          <View style={s.gridCol3}><Text style={s.label}>Partidas Realizadas</Text><Text style={s.value}>{r.totalMatches}</Text></View>
          <View style={s.gridCol3}><Text style={s.label}>Refeições Servidas</Text><Text style={s.value}>{r.totalMeals}</Text></View>
          <View style={s.gridCol3}><Text style={s.label}>Passageiros Transp.</Text><Text style={s.value}>{r.totalPassengers}</Text></View>
          <View style={s.gridCol3}><Text style={s.label}>Alojamentos Ocup.</Text><Text style={s.value}>{r.totalLodgingOccupied}</Text></View>
        </View>

        <Text style={s.footer} fixed>JER Gestão - Prestação de Contas Automática - {meta.generatedAt.toLocaleDateString("pt-BR")} - ID: {meta.reportId || "Draft"}</Text>
      </Page>

      {/* Evidências Fotográficas */}
      {evs.length > 0 && (
        <Page size="A4" style={s.page}>
          <Text style={s.sectionTitle}>4. Evidências Fotográficas</Text>
          <View style={s.evidenceGrid}>
            {evs.map((ev, i) => (
              <View key={i} style={s.evidenceCard} wrap={false}>
                <Image src={ev.file_url} style={s.evidenceImg} />
                <Text style={s.evidenceLabel}>{ev.osc_category?.toUpperCase() || "GERAL"} - {ev.caption || ev.description || "Sem legenda"}</Text>
                <Text style={[s.evidenceLabel, { color: "#888" }]}>Local: {ev.location_name || "—"} | Data: {ev.photo_at ? new Date(ev.photo_at).toLocaleDateString("pt-BR") : "—"}</Text>
              </View>
            ))}
          </View>
          <Text style={s.footer} fixed>JER Gestão - Relatório de Evidências</Text>
        </Page>
      )}

      {/* Assinaturas e QR Code */}
      <Page size="A4" style={s.page}>
        <Text style={s.sectionTitle}>Declaração de Responsabilidade</Text>
        <Text style={[s.td, { marginTop: 10, lineHeight: 1.5 }]}>
          Declaramos que os dados contidos neste relatório são expressão da verdade e foram extraídos diretamente do sistema JER Gestão, estando em conformidade com as evidências operacionais coletadas em campo.
        </Text>
        
        <View style={s.signatureArea}>
          {meta.qrCodeDataUrl ? (
            <View style={s.qrBox}>
              <Image src={meta.qrCodeDataUrl} style={s.qrImg} />
              <Text style={s.qrText}>Validação Digital</Text>
              <Text style={[s.qrText, { fontSize: 4 }]}>{meta.reportId}</Text>
            </View>
          ) : <View style={{ width: 80 }} />}

          <View style={s.signatureBox}>
            <Text style={s.value}>{config?.responsible_name || "________________________________"}</Text>
            <Text style={s.label}>Responsável Técnico</Text>
          </View>
        </View>

        <View style={{ marginTop: 40, borderTopWidth: 0.5, borderTopColor: "#eee", paddingTop: 10 }}>
          <Text style={{ fontSize: 7, color: "#999" }}>
            A autenticidade deste documento pode ser verificada através do QR Code acima ou informando o ID {meta.reportId} no portal de auditoria do sistema JER Gestão.
          </Text>
        </View>
      </Page>
    </Document>
  );
}

export async function exportOscPdf(data: OscData, meta: Meta) {
  let qrCodeDataUrl = undefined;
  if (meta.reportId) {
    try {
      // URL de validação (aponta para a página de validação QR do admin por enquanto, 
      // mas passando o token como parâmetro para futura expansão)
      const validationUrl = `${window.location.origin}/admin/validar-qr?report=${meta.reportId}`;
      qrCodeDataUrl = await QRCode.toDataURL(validationUrl, {
        margin: 1,
        width: 200,
        color: { dark: "#0B2B5A", light: "#FFFFFF" }
      });
    } catch (e) {
      console.error("Erro ao gerar QR Code para o PDF", e);
    }
  }

  const blob = await pdf(<OscDocument data={data} meta={{ ...meta, qrCodeDataUrl }} />).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Relatorio_OSC_${meta.eventName.replace(/\s+/g, "_")}_${new Date().getTime()}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
