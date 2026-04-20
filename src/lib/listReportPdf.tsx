import { pdf, Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import type { EventBrandingResolved } from "@/hooks/useEventBranding";

/**
 * Padrão de relatório PDF para listas (Participantes, Delegações etc).
 * Segue a identidade visual: header com logos do evento, título, subtítulo,
 * meta com data de geração + filtros aplicados, agrupamento opcional e rodapé.
 */

export interface PdfListColumn<T> {
  header: string;
  /** largura percentual da coluna (string '15%') ou flex weight numérico */
  width: string;
  align?: "left" | "center" | "right";
  accessor: (row: T) => string | number;
}

export interface PdfListGroup<T> {
  label: string;
  rows: T[];
}

export interface PdfListMeta {
  /** Título principal do relatório (ex.: "Relatório de Delegações") */
  title: string;
  /** Subtítulo opcional (ex.: "Filtrado") */
  subtitle?: string;
  branding?: EventBrandingResolved | null;
  eventName?: string;
  generatedAt: Date;
  /** Lista de filtros aplicados, mostrados na linha de meta */
  filters?: Array<{ label: string; value: string }>;
  /** Texto curto de agrupamento (ex.: "Agrupado por: Município") */
  groupingLabel?: string;
  /** Texto do rodapé (override do branding.rodape_texto) */
  footerText?: string;
  /** Orientação */
  orientation?: "portrait" | "landscape";
}

const s = StyleSheet.create({
  page: { paddingTop: 28, paddingBottom: 40, paddingHorizontal: 28, fontFamily: "Helvetica", fontSize: 9, color: "#111" },
  headerRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", marginBottom: 6, gap: 12 },
  logo: { height: 38, objectFit: "contain" },
  brandTitle: { fontSize: 13, fontWeight: "bold", textAlign: "center", color: "#0B2B5A" },
  brandSubtitle: { fontSize: 9, textAlign: "center", color: "#444", marginTop: 1 },
  reportTitle: { fontSize: 12, fontWeight: "bold", textAlign: "center", marginTop: 8, color: "#0B2B5A" },
  reportSubtitle: { fontSize: 9, textAlign: "center", color: "#666", marginTop: 1 },
  meta: { fontSize: 8, textAlign: "center", color: "#666", marginTop: 4 },
  filtersBox: { marginTop: 6, padding: 5, backgroundColor: "#f5f7fa", borderRadius: 2, borderLeftWidth: 2, borderLeftColor: "#0F5AA6" },
  filtersTitle: { fontSize: 7, fontWeight: "bold", color: "#0B2B5A", marginBottom: 2 },
  filtersText: { fontSize: 8, color: "#333", lineHeight: 1.35 },
  divider: { borderBottomWidth: 1, borderBottomColor: "#0F5AA6", marginVertical: 6 },
  groupHeader: { flexDirection: "row", alignItems: "center", marginTop: 8, marginBottom: 3, paddingVertical: 3, paddingHorizontal: 5, backgroundColor: "#0B2B5A" },
  groupHeaderText: { fontSize: 9, fontWeight: "bold", color: "#FFFFFF" },
  groupHeaderCount: { fontSize: 8, color: "#FFFFFF", marginLeft: "auto" },
  thRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#0B2B5A", backgroundColor: "#eef2f7", paddingVertical: 4, paddingHorizontal: 3 },
  th: { fontSize: 8, fontWeight: "bold", color: "#0B2B5A", paddingHorizontal: 2 },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#e2e8f0", paddingVertical: 3, paddingHorizontal: 3 },
  trZebra: { backgroundColor: "#fafbfd" },
  td: { fontSize: 8, paddingHorizontal: 2 },
  empty: { fontSize: 8, color: "#888", marginTop: 6, fontStyle: "italic", textAlign: "center" },
  footer: { position: "absolute", bottom: 18, left: 28, right: 28, fontSize: 7, color: "#888", borderTopWidth: 0.5, borderTopColor: "#ccc", paddingTop: 4, flexDirection: "row", justifyContent: "space-between" },
  totalLine: { marginTop: 6, fontSize: 8, fontWeight: "bold", textAlign: "right", color: "#0B2B5A" },
});

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  return String(v);
}

function ListReportDocument<T>({
  columns,
  groups,
  meta,
}: {
  columns: PdfListColumn<T>[];
  groups: PdfListGroup<T>[];
  meta: PdfListMeta;
}) {
  const logos = (meta.branding?.logos || []).filter((l) => l.active).slice(0, 3);
  const headerTitle = meta.branding?.nome_oficial || meta.branding?.fallbackEventName || meta.eventName || "JER Gestão";
  const brandSubtitle = meta.branding?.subtitulo || "";
  const localAno = meta.branding?.local_ano || "";
  const rodape = meta.footerText || meta.branding?.rodape_texto || "JER Gestão";
  const dateStr = meta.generatedAt.toLocaleDateString("pt-BR");
  const timeStr = meta.generatedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  const totalRows = groups.reduce((acc, g) => acc + g.rows.length, 0);

  return (
    <Document>
      <Page size="A4" orientation={meta.orientation ?? "landscape"} style={s.page}>
        {/* Branding */}
        {logos.length > 0 && (
          <View style={s.headerRow}>
            {logos.map((l, i) => (
              <Image key={i} src={l.url} style={s.logo} />
            ))}
          </View>
        )}
        <Text style={s.brandTitle}>{headerTitle}</Text>
        {brandSubtitle ? <Text style={s.brandSubtitle}>{brandSubtitle}</Text> : null}

        {/* Título do relatório */}
        <Text style={s.reportTitle}>{meta.title}</Text>
        {meta.subtitle ? <Text style={s.reportSubtitle}>{meta.subtitle}</Text> : null}
        <Text style={s.meta}>Gerado em {dateStr} às {timeStr} • {totalRows} registro(s)</Text>

        {/* Filtros aplicados */}
        {(meta.filters && meta.filters.length > 0) || meta.groupingLabel ? (
          <View style={s.filtersBox}>
            <Text style={s.filtersTitle}>FILTROS APLICADOS</Text>
            <Text style={s.filtersText}>
              {(meta.filters ?? []).map((f) => `${f.label}: ${f.value}`).join("  •  ") || "Nenhum"}
              {meta.groupingLabel ? `   |   ${meta.groupingLabel}` : ""}
            </Text>
          </View>
        ) : null}

        <View style={s.divider} />

        {/* Conteúdo */}
        {totalRows === 0 ? (
          <Text style={s.empty}>Nenhum registro encontrado para os filtros selecionados.</Text>
        ) : (
          groups.map((group, gi) => (
            <View key={gi} wrap>
              {group.label && (
                <View style={s.groupHeader} wrap={false}>
                  <Text style={s.groupHeaderText}>{group.label}</Text>
                  <Text style={s.groupHeaderCount}>{group.rows.length} registro(s)</Text>
                </View>
              )}
              <View style={s.thRow} wrap={false}>
                {columns.map((c, i) => (
                  <Text key={i} style={[s.th, { width: c.width, textAlign: c.align ?? "left" }]}>
                    {c.header}
                  </Text>
                ))}
              </View>
              {group.rows.map((row, ri) => (
                <View key={ri} style={[s.tr, ri % 2 === 1 ? s.trZebra : {}]} wrap={false}>
                  {columns.map((c, ci) => (
                    <Text key={ci} style={[s.td, { width: c.width, textAlign: c.align ?? "left" }]}>
                      {formatValue(c.accessor(row))}
                    </Text>
                  ))}
                </View>
              ))}
            </View>
          ))
        )}

        {totalRows > 0 && (
          <Text style={s.totalLine}>Total geral: {totalRows} registro(s)</Text>
        )}

        {/* Rodapé */}
        <View style={s.footer} fixed>
          <Text>{rodape}{localAno ? " • " + localAno : ""}</Text>
          <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export async function exportListPdf<T>(
  columns: PdfListColumn<T>[],
  groups: PdfListGroup<T>[],
  meta: PdfListMeta
): Promise<Blob> {
  return await pdf(<ListReportDocument columns={columns} groups={groups} meta={meta} />).toBlob();
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
