import { pdf, Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import type { MedalTableData, ScopeFilter } from "./useMedalTableData";
import type { EventBrandingResolved } from "@/hooks/useEventBranding";

const s = StyleSheet.create({
  page: { padding: 32, fontFamily: "Helvetica", fontSize: 9 },
  headerRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", marginBottom: 8, gap: 12 },
  logo: { height: 40, objectFit: "contain" },
  title: { fontSize: 13, fontWeight: "bold", textAlign: "center", marginTop: 4 },
  subtitle: { fontSize: 10, textAlign: "center", color: "#444" },
  meta: { fontSize: 8, textAlign: "center", color: "#666", marginBottom: 6 },
  badge: { alignSelf: "center", marginVertical: 4, paddingHorizontal: 8, paddingVertical: 2, fontSize: 8, fontWeight: "bold", borderWidth: 1, borderRadius: 3 },
  badgeOficial: { color: "#0a6b1d", borderColor: "#0a6b1d", backgroundColor: "#e6f5ea" },
  badgePartial: { color: "#8a5a00", borderColor: "#c98a1f", backgroundColor: "#fdf3dc" },
  thRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#333", backgroundColor: "#fafafa", paddingVertical: 3, marginTop: 6 },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#ddd", paddingVertical: 3 },
  trTop: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#ddd", paddingVertical: 3, backgroundColor: "#fff7e6" },
  th: { fontSize: 8, fontWeight: "bold" },
  td: { fontSize: 8 },
  footer: { position: "absolute", bottom: 24, left: 32, right: 32, fontSize: 7, color: "#888", textAlign: "center", borderTopWidth: 0.5, borderTopColor: "#ccc", paddingTop: 4 },
  note: { fontSize: 7, color: "#666", marginTop: 8, fontStyle: "italic" },
});

interface Meta {
  eventName: string;
  branding?: EventBrandingResolved | null;
  generatedAt: Date;
  scope: ScopeFilter;
}

const SCOPE_LABEL: Record<ScopeFilter, string> = { all: "GERAL", jer: "JER", jerpa: "JERPA" };

function Header({ meta, title }: { meta: Meta; title: string }) {
  const logos = (meta.branding?.logos || []).filter((l) => l.active).slice(0, 3);
  const headerTitle = meta.branding?.nome_oficial || meta.branding?.fallbackEventName || meta.eventName;
  const subtitle = meta.branding?.subtitulo || "";
  const localAno = meta.branding?.local_ano || "";
  const dateStr = meta.generatedAt.toLocaleDateString("pt-BR");
  const timeStr = meta.generatedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return (
    <>
      {logos.length > 0 && (
        <View style={s.headerRow}>{logos.map((l, i) => <Image key={i} src={l.url} style={s.logo} />)}</View>
      )}
      <Text style={s.title}>{headerTitle}</Text>
      {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
      <Text style={s.meta}>{localAno ? `${localAno} · ` : ""}Gerado em {dateStr} {timeStr}</Text>
      <Text style={s.title}>{title}</Text>
    </>
  );
}

function MedalDocument({ data, meta }: { data: MedalTableData; meta: Meta }) {
  const isOficial = !data.partial.hasPartial;
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <Header meta={meta} title={`QUADRO DE MEDALHAS — ${SCOPE_LABEL[meta.scope]}`} />
        <Text style={[s.badge, isOficial ? s.badgeOficial : s.badgePartial]}>
          {isOficial ? "OFICIAL" : `PARCIAL — ${data.partial.pendingSports} prova(s) pendente(s)`}
        </Text>

        <View style={s.thRow}>
          <Text style={[s.th, { width: "8%" }]}>Pos</Text>
          <Text style={[s.th, { width: "52%" }]}>Escola</Text>
          <Text style={[s.th, { width: "10%", textAlign: "center" }]}>Ouro</Text>
          <Text style={[s.th, { width: "10%", textAlign: "center" }]}>Prata</Text>
          <Text style={[s.th, { width: "10%", textAlign: "center" }]}>Bronze</Text>
          <Text style={[s.th, { width: "10%", textAlign: "center" }]}>Total</Text>
        </View>
        {data.medalsBySchool.length === 0 ? (
          <Text style={s.note}>Nenhum resultado publicado.</Text>
        ) : (
          data.medalsBySchool.map((r) => (
            <View key={r.schoolId} style={r.pos <= 3 ? s.trTop : s.tr}>
              <Text style={[s.td, { width: "8%" }]}>{r.pos}º</Text>
              <Text style={[s.td, { width: "52%" }]}>{r.schoolName}</Text>
              <Text style={[s.td, { width: "10%", textAlign: "center" }]}>{r.ouro}</Text>
              <Text style={[s.td, { width: "10%", textAlign: "center" }]}>{r.prata}</Text>
              <Text style={[s.td, { width: "10%", textAlign: "center" }]}>{r.bronze}</Text>
              <Text style={[s.td, { width: "10%", textAlign: "center" }]}>{r.total}</Text>
            </View>
          ))
        )}

        <Text style={s.footer}>
          {meta.branding?.rodape_texto || "JER Gestão"} — Critério olímpico (ouro &gt; prata &gt; bronze).
        </Text>
      </Page>
    </Document>
  );
}

function RankingDocument({ data, meta }: { data: MedalTableData; meta: Meta }) {
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <Header meta={meta} title={`CLASSIFICAÇÃO GERAL — CAMPEONATO GERAL ${SCOPE_LABEL[meta.scope]}`} />
        {data.partial.hasPartial && (
          <Text style={[s.badge, s.badgePartial]}>
            PARCIAL — {data.partial.pendingSports} prova(s) com resultados não publicados
          </Text>
        )}

        <View style={s.thRow}>
          <Text style={[s.th, { width: "6%" }]}>Pos</Text>
          <Text style={[s.th, { width: "36%" }]}>Escola</Text>
          <Text style={[s.th, { width: "11%", textAlign: "center" }]}>Pts Col.</Text>
          <Text style={[s.th, { width: "11%", textAlign: "center" }]}>Pts Ind.</Text>
          <Text style={[s.th, { width: "12%", textAlign: "center" }]}>Total</Text>
          <Text style={[s.th, { width: "8%", textAlign: "center" }]}>Ouro</Text>
          <Text style={[s.th, { width: "8%", textAlign: "center" }]}>Prata</Text>
          <Text style={[s.th, { width: "8%", textAlign: "center" }]}>Bronze</Text>
        </View>
        {data.rankingGeral.length === 0 ? (
          <Text style={s.note}>Nenhum resultado publicado.</Text>
        ) : (
          data.rankingGeral.map((r) => (
            <View key={r.schoolId} style={r.pos <= 3 ? s.trTop : s.tr}>
              <Text style={[s.td, { width: "6%" }]}>{r.pos}º</Text>
              <Text style={[s.td, { width: "36%" }]}>{r.schoolName}</Text>
              <Text style={[s.td, { width: "11%", textAlign: "center" }]}>{r.ptsColetivas}</Text>
              <Text style={[s.td, { width: "11%", textAlign: "center" }]}>{r.ptsIndividuais}</Text>
              <Text style={[s.td, { width: "12%", textAlign: "center", fontWeight: "bold" }]}>{r.totalGeral}</Text>
              <Text style={[s.td, { width: "8%", textAlign: "center" }]}>{r.ouros}</Text>
              <Text style={[s.td, { width: "8%", textAlign: "center" }]}>{r.pratas}</Text>
              <Text style={[s.td, { width: "8%", textAlign: "center" }]}>{r.bronzes}</Text>
            </View>
          ))
        )}

        <Text style={s.note}>
          Pontuação conforme Art. 108 do Regulamento Geral (1º=10, 2º=8, 3º=6, 4º=5, 5º=4, 6º=3, 7º=2, 8º=1).
          Desempate conforme Art. 111 (mais ouros → mais pratas → mais bronzes → desempenho coletivas).
        </Text>

        <Text style={s.footer}>
          {meta.branding?.rodape_texto || "JER Gestão"}
        </Text>
      </Page>
    </Document>
  );
}

function fname(prefix: string, scope: ScopeFilter, d: Date) {
  const iso = d.toISOString().slice(0, 10);
  return `${prefix}_${SCOPE_LABEL[scope]}_${iso}.pdf`;
}

export async function exportMedalTablePdf(data: MedalTableData, meta: Meta) {
  const blob = await pdf(<MedalDocument data={data} meta={meta} />).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fname("Quadro_Medalhas", meta.scope, meta.generatedAt);
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportRankingGeralPdf(data: MedalTableData, meta: Meta) {
  const blob = await pdf(<RankingDocument data={data} meta={meta} />).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fname("Classificacao_Geral", meta.scope, meta.generatedAt);
  a.click();
  URL.revokeObjectURL(url);
}
