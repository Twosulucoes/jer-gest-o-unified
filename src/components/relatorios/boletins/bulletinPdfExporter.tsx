import { pdf, Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import type { BulletinDataset } from "./useBulletinData";
import { computeScoreStandings } from "./BulletinScore";
import type { EventBrandingResolved } from "@/hooks/useEventBranding";

const styles = StyleSheet.create({
  page: { padding: 32, fontFamily: "Helvetica", fontSize: 9 },
  headerRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", marginBottom: 8, gap: 12 },
  logo: { height: 40, objectFit: "contain" },
  title: { fontSize: 14, fontWeight: "bold", textAlign: "center", marginTop: 4 },
  subtitle: { fontSize: 10, textAlign: "center", color: "#444" },
  meta: { fontSize: 9, textAlign: "center", color: "#666", marginBottom: 8 },
  divider: { borderBottomWidth: 1, borderBottomColor: "#ccc", marginVertical: 6 },
  sectionTitle: { fontSize: 11, fontWeight: "bold", marginTop: 10, marginBottom: 4, backgroundColor: "#f0f0f0", padding: 4 },
  table: { display: "flex", width: "100%" },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#ddd", paddingVertical: 3 },
  thRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#333", backgroundColor: "#fafafa", paddingVertical: 3 },
  th: { fontSize: 8, fontWeight: "bold" },
  td: { fontSize: 8 },
  footer: { position: "absolute", bottom: 24, left: 32, right: 32, fontSize: 7, color: "#888", textAlign: "center", borderTopWidth: 0.5, borderTopColor: "#ccc", paddingTop: 4 },
});

interface ExportMeta {
  eventName: string;
  sportName: string;
  categoryName: string;
  gender: string;
  phaseName?: string;
  branding?: EventBrandingResolved | null;
}

function BulletinDocument({ data, meta }: { data: BulletinDataset; meta: ExportMeta }) {
  const standings = (data.family === "score") ? computeScoreStandings(data) : new Map();
  const eByM = new Map<string, typeof data.entries>();
  for (const e of data.entries) { if (!eByM.has(e.match_id)) eByM.set(e.match_id, []); eByM.get(e.match_id)!.push(e); }
  const rByE = new Map<string, typeof data.results[number]>();
  for (const r of data.results) rByE.set(r.match_entry_id, r);

  const activeLogos = (meta.branding?.logos || []).filter((l) => l.active).slice(0, 3);
  const headerTitle = meta.branding?.nome_oficial || meta.branding?.fallbackEventName || meta.eventName;
  const subtitle = meta.branding?.subtitulo || "";
  const localAno = meta.branding?.local_ano || "";
  const rodape = meta.branding?.rodape_texto || "JER Gestão";

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {activeLogos.length > 0 && (
          <View style={styles.headerRow}>
            {activeLogos.map((l, i) => <Image key={i} src={l.url} style={styles.logo} />)}
          </View>
        )}
        <Text style={styles.title}>{headerTitle}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        <Text style={styles.meta}>
          BOLETIM DE RESULTADO — {meta.sportName} • {meta.categoryName} • {meta.gender}
          {meta.phaseName ? ` • ${meta.phaseName}` : ""}
        </Text>
        <View style={styles.divider} />
        
        {/* Alertas de validação no PDF */}
        {data.validationAlerts && data.validationAlerts.length > 0 && (
          <View style={{ marginBottom: 12, padding: 8, backgroundColor: "#fffbeb", borderLeftWidth: 3, borderLeftColor: "#f59e0b" }}>
            <Text style={{ fontSize: 9, fontWeight: "bold", color: "#92400e", marginBottom: 4 }}>
              Alertas de inconsistência nos dados (Boletim Informativo):
            </Text>
            {data.validationAlerts.map((alert, i) => (
              <Text key={i} style={{ fontSize: 8, color: "#92400e", marginBottom: 2 }}>
                • {alert.message} {alert.details ? `(${alert.details})` : ""}
              </Text>
            ))}
          </View>
        )}

        {/* Classificação score */}
        {data.family === "score" && [...standings.entries()].map(([gid, list]: any) => {
          const groupName = data.groups.find((g) => g.id === gid)?.name ?? "Geral";
          return (
            <View key={gid}>
              <Text style={styles.sectionTitle}>Classificação — {groupName}</Text>
              <View style={styles.thRow}>
                <Text style={[styles.th, { width: "8%" }]}>Pos</Text>
                <Text style={[styles.th, { width: "44%" }]}>Equipe</Text>
                {["P", "J", "V", "E", "D", "GP", "GC", "SG"].map((c) => (
                  <Text key={c} style={[styles.th, { width: "6%", textAlign: "center" }]}>{c}</Text>
                ))}
              </View>
              {list.map((s: any, idx: number) => (
                <View key={s.team} style={styles.tr}>
                  <Text style={[styles.td, { width: "8%" }]}>{idx + 1}º</Text>
                  <Text style={[styles.td, { width: "44%" }]}>{s.team}</Text>
                  <Text style={[styles.td, { width: "6%", textAlign: "center", fontWeight: "bold" }]}>{s.P}</Text>
                  {[s.J, s.V, s.E, s.D, s.GP, s.GC, s.SG].map((v, i) => (
                    <Text key={i} style={[styles.td, { width: "6%", textAlign: "center" }]}>{v}</Text>
                  ))}
                </View>
              ))}
            </View>
          );
        })}

        {/* Partidas (todos) */}
        <Text style={styles.sectionTitle}>Partidas / Resultados</Text>
        <View style={styles.thRow}>
          <Text style={[styles.th, { width: "5%" }]}>#</Text>
          <Text style={[styles.th, { width: "13%" }]}>Data</Text>
          <Text style={[styles.th, { width: "30%" }]}>Lado A</Text>
          <Text style={[styles.th, { width: "12%", textAlign: "center" }]}>Placar</Text>
          <Text style={[styles.th, { width: "30%" }]}>Lado B</Text>
          <Text style={[styles.th, { width: "10%" }]}>Status</Text>
        </View>
        {data.matches.map((m) => {
          const ents = eByM.get(m.id) || [];
          const a = ents[0]; const b = ents[1];
          const ar = a ? rByE.get(a.id) : undefined;
          const br = b ? rByE.get(b.id) : undefined;
          return (
            <View key={m.id} style={styles.tr}>
              <Text style={[styles.td, { width: "5%" }]}>{m.match_number ?? "—"}</Text>
              <Text style={[styles.td, { width: "13%" }]}>
                {m.match_date ?? "—"}{m.start_time ? ` ${m.start_time.slice(0, 5)}` : ""}
              </Text>
              <Text style={[styles.td, { width: "30%" }]}>{a?.display_name ?? "—"}</Text>
              <Text style={[styles.td, { width: "12%", textAlign: "center", fontWeight: "bold" }]}>
                {ar?.score ?? "—"} × {br?.score ?? "—"}
              </Text>
              <Text style={[styles.td, { width: "30%" }]}>{b?.display_name ?? "—"}</Text>
              <Text style={[styles.td, { width: "10%" }]}>{ar?.result_status ?? m.status}</Text>
            </View>
          );
        })}

        <Text style={styles.footer} fixed>
          {rodape} {localAno ? `— ${localAno}` : ""} • Gerado em {new Date().toLocaleString("pt-BR")}
        </Text>
      </Page>
    </Document>
  );
}

export async function exportBulletinPdf(data: BulletinDataset, meta: ExportMeta) {
  const blob = await pdf(<BulletinDocument data={data} meta={meta} />).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `boletim-${meta.sportName}-${meta.categoryName}-${meta.gender}.pdf`.replace(/\s+/g, "_");
  a.click();
  URL.revokeObjectURL(url);
}
