import { pdf, Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import type { OscData } from "./useOscData";
import type { EventBrandingResolved } from "@/hooks/useEventBranding";

const s = StyleSheet.create({
  page: { padding: 32, fontFamily: "Helvetica", fontSize: 9 },
  headerRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", marginBottom: 8, gap: 12 },
  logo: { height: 40, objectFit: "contain" },
  title: { fontSize: 14, fontWeight: "bold", textAlign: "center", marginTop: 6 },
  subtitle: { fontSize: 10, textAlign: "center", color: "#444" },
  meta: { fontSize: 8, textAlign: "center", color: "#666", marginBottom: 8 },
  sectionTitle: { fontSize: 11, fontWeight: "bold", marginTop: 12, marginBottom: 4, color: "#0B2B5A" },
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", marginTop: 4 },
  kpiCard: { width: "33.33%", padding: 4 },
  kpiBox: { borderWidth: 1, borderColor: "#ddd", borderRadius: 4, padding: 6 },
  kpiLabel: { fontSize: 7, color: "#666" },
  kpiValue: { fontSize: 12, fontWeight: "bold", marginTop: 2 },
  kpiSub: { fontSize: 7, color: "#888", marginTop: 1 },
  thRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#333", backgroundColor: "#fafafa", paddingVertical: 3, marginTop: 6 },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#ddd", paddingVertical: 3 },
  th: { fontSize: 8, fontWeight: "bold" },
  td: { fontSize: 8 },
  footer: { position: "absolute", bottom: 24, left: 32, right: 32, fontSize: 7, color: "#888", textAlign: "center", borderTopWidth: 0.5, borderTopColor: "#ccc", paddingTop: 4 },
  signature: { marginTop: 30, alignItems: "center" },
  signLine: { borderTopWidth: 0.5, borderTopColor: "#333", width: 240, marginBottom: 3, paddingTop: 4 },
  signName: { fontSize: 9, fontWeight: "bold" },
  signRole: { fontSize: 8, color: "#666" },
  note: { fontSize: 7, color: "#666", marginTop: 4, fontStyle: "italic" },
});

interface Meta {
  eventName: string;
  branding?: EventBrandingResolved | null;
  generatedAt: Date;
  periodLabel: string;
}

function Header({ meta, title }: { meta: Meta; title: string }) {
  const logos = (meta.branding?.logos || []).filter((l) => l.active).slice(0, 3);
  const headerTitle = meta.branding?.nome_oficial || meta.eventName;
  const subtitle = meta.branding?.subtitulo || "";
  const localAno = meta.branding?.local_ano || "";
  const dateStr = meta.generatedAt.toLocaleDateString("pt-BR");
  return (
    <>
      {logos.length > 0 && (
        <View style={s.headerRow}>{logos.map((l, i) => <Image key={i} src={l.url} style={s.logo} />)}</View>
      )}
      <Text style={s.title}>{headerTitle}</Text>
      {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
      <Text style={s.meta}>{localAno ? `${localAno} · ` : ""}Período: {meta.periodLabel} · Emitido em {dateStr}</Text>
      <Text style={s.title}>{title}</Text>
    </>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <View style={s.kpiCard}>
      <View style={s.kpiBox}>
        <Text style={s.kpiLabel}>{label}</Text>
        <Text style={s.kpiValue}>{value}</Text>
        {sub ? <Text style={s.kpiSub}>{sub}</Text> : null}
      </View>
    </View>
  );
}

function OscDocument({ data, meta }: { data: OscData; meta: Meta }) {
  const r = data.resumo;
  const lodgingPct = r.totalLodgingCapacity > 0 ? Math.round((r.totalLodgingOccupied / r.totalLodgingCapacity) * 100) : 0;
  const credPct = r.totalParticipants > 0 ? Math.round((r.totalCredentialed / r.totalParticipants) * 100) : 0;

  return (
    <Document>
      {/* Capa + KPIs */}
      <Page size="A4" style={s.page}>
        <Header meta={meta} title="PRESTAÇÃO DE CONTAS — RELATÓRIO CONSOLIDADO" />

        <Text style={s.sectionTitle}>1. Indicadores Gerais</Text>
        <View style={s.kpiGrid}>
          <Kpi label="Participantes" value={r.totalParticipants} sub={`${r.totalAthletes} atletas`} />
          <Kpi label="Credenciados" value={r.totalCredentialed} sub={`${credPct}% do total`} />
          <Kpi label="Delegações" value={r.totalDelegations} />
          <Kpi label="Modalidades" value={r.totalSports} />
          <Kpi label="Partidas" value={r.totalMatches} sub={`${r.totalMatchesPublished} com resultado publicado`} />
          <Kpi label="Refeições servidas" value={r.totalMeals} />
          <Kpi label="Alojamento" value={`${r.totalLodgingOccupied}/${r.totalLodgingCapacity}`} sub={`${lodgingPct}% ocupação`} />
          <Kpi label="Viagens realizadas" value={r.totalTrips} sub={`${r.totalPassengers} passageiros`} />
          <Kpi label="Doação alimentos (kg)" value={r.foodDonationKg} sub="Por delegação × total" />
        </View>

        <Text style={s.sectionTitle}>2. Quadro de Medalhas Consolidado</Text>
        <View style={s.kpiGrid}>
          <Kpi label="Ouro" value={r.totalMedalsGold} />
          <Kpi label="Prata" value={r.totalMedalsSilver} />
          <Kpi label="Bronze" value={r.totalMedalsBronze} />
        </View>

        <Text style={s.note}>
          Documento emitido para fins de prestação de contas junto a parceiros institucionais e órgãos de controle.
        </Text>

        <Text style={s.footer} fixed>{meta.branding?.rodape_texto || "JER Gestão · Documento oficial"}</Text>
      </Page>

      {/* Modalidades executadas */}
      <Page size="A4" style={s.page}>
        <Header meta={meta} title="MODALIDADES EXECUTADAS" />
        <View style={s.thRow}>
          <Text style={[s.th, { width: "55%" }]}>Modalidade</Text>
          <Text style={[s.th, { width: "15%", textAlign: "center" }]}>Partidas</Text>
          <Text style={[s.th, { width: "15%", textAlign: "center" }]}>Publicadas</Text>
          <Text style={[s.th, { width: "15%", textAlign: "center" }]}>% Concluído</Text>
        </View>
        {data.sports.length === 0 ? (
          <Text style={[s.td, { padding: 8, textAlign: "center", color: "#888" }]}>Nenhuma modalidade registrada.</Text>
        ) : data.sports.map((sp) => {
          const pct = sp.matches > 0 ? Math.round((sp.published / sp.matches) * 100) : 0;
          return (
            <View key={sp.id} style={s.tr}>
              <Text style={[s.td, { width: "55%" }]}>{sp.name}</Text>
              <Text style={[s.td, { width: "15%", textAlign: "center" }]}>{sp.matches}</Text>
              <Text style={[s.td, { width: "15%", textAlign: "center" }]}>{sp.published}</Text>
              <Text style={[s.td, { width: "15%", textAlign: "center" }]}>{pct}%</Text>
            </View>
          );
        })}
        <Text style={s.footer} fixed>{meta.branding?.rodape_texto || "JER Gestão · Documento oficial"}</Text>
      </Page>

      {/* Delegações */}
      <Page size="A4" style={s.page} orientation="landscape">
        <Header meta={meta} title="ATENDIMENTO POR DELEGAÇÃO" />
        <View style={s.thRow}>
          <Text style={[s.th, { width: "30%" }]}>Escola</Text>
          <Text style={[s.th, { width: "12%" }]}>Rede</Text>
          <Text style={[s.th, { width: "10%", textAlign: "center" }]}>Inscritos</Text>
          <Text style={[s.th, { width: "10%", textAlign: "center" }]}>Cred.</Text>
          <Text style={[s.th, { width: "10%", textAlign: "center" }]}>Refeições</Text>
          <Text style={[s.th, { width: "8%", textAlign: "center" }]}>Ouro</Text>
          <Text style={[s.th, { width: "8%", textAlign: "center" }]}>Prata</Text>
          <Text style={[s.th, { width: "8%", textAlign: "center" }]}>Bronze</Text>
          <Text style={[s.th, { width: "4%", textAlign: "center" }]}>Σ</Text>
        </View>
        {data.delegations.length === 0 ? (
          <Text style={[s.td, { padding: 8, textAlign: "center", color: "#888" }]}>Nenhuma delegação registrada.</Text>
        ) : data.delegations.map((d) => (
          <View key={d.delegationId} style={s.tr}>
            <Text style={[s.td, { width: "30%" }]}>{d.schoolName}</Text>
            <Text style={[s.td, { width: "12%" }]}>{d.network || "—"}</Text>
            <Text style={[s.td, { width: "10%", textAlign: "center" }]}>{d.totalParticipants}</Text>
            <Text style={[s.td, { width: "10%", textAlign: "center" }]}>{d.credentialed}</Text>
            <Text style={[s.td, { width: "10%", textAlign: "center" }]}>{d.meals}</Text>
            <Text style={[s.td, { width: "8%", textAlign: "center" }]}>{d.medalsGold}</Text>
            <Text style={[s.td, { width: "8%", textAlign: "center" }]}>{d.medalsSilver}</Text>
            <Text style={[s.td, { width: "8%", textAlign: "center" }]}>{d.medalsBronze}</Text>
            <Text style={[s.td, { width: "4%", textAlign: "center" }]}>{d.medalsGold + d.medalsSilver + d.medalsBronze}</Text>
          </View>
        ))}
        <Text style={s.footer} fixed>{meta.branding?.rodape_texto || "JER Gestão · Documento oficial"}</Text>
      </Page>

      {/* Assinatura */}
      <Page size="A4" style={s.page}>
        <Header meta={meta} title="DECLARAÇÃO E ASSINATURA" />
        <Text style={[s.td, { marginTop: 16, lineHeight: 1.5 }]}>
          Declaramos para os devidos fins de prestação de contas que os dados consolidados neste relatório refletem
          os registros operacionais do sistema JER Gestão referentes ao evento{" "}
          <Text style={{ fontWeight: "bold" }}>{meta.eventName}</Text>, abrangendo o período de{" "}
          <Text style={{ fontWeight: "bold" }}>{meta.periodLabel}</Text>. As evidências de execução
          (listas de presença, registros de credenciamento, consumo de refeições, ocupação de alojamento, viagens
          realizadas e resultados publicados) encontram-se disponíveis no sistema para verificação.
        </Text>

        <View style={s.signature}>
          <View style={s.signLine}><Text> </Text></View>
          <Text style={s.signName}>{meta.branding?.assinatura_nome || "________________________________"}</Text>
          <Text style={s.signRole}>{meta.branding?.assinatura_cargo || "Responsável"}</Text>
        </View>

        <Text style={s.footer} fixed>{meta.branding?.rodape_texto || "JER Gestão · Documento oficial"}</Text>
      </Page>
    </Document>
  );
}

export async function exportOscPdf(data: OscData, meta: Meta) {
  const blob = await pdf(<OscDocument data={data} meta={meta} />).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const dateISO = meta.generatedAt.toISOString().slice(0, 10);
  a.href = url;
  a.download = `Prestacao_Contas_${meta.eventName.replace(/\s+/g, "_")}_${dateISO}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
