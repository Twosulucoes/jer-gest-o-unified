import { pdf, Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer';
import { format } from 'date-fns';
import { orderedQuestions, boolLabel, type SurveyRow } from '@/lib/pesquisa/aggregate';
import type { PesquisaConfig, PesquisaQuestion, AnswerValue } from '@/lib/pesquisa/config';
import type { PesquisaReportMeta } from './pesquisaSatisfacaoPdfExporter';

// Relatório de LISTAGEM (registros individuais): uma linha por coleta, em paisagem,
// com todas as respostas. Complementa o consolidado analítico (que agrega).

const COLOR = {
  ink: '#111827',
  muted: '#6b7280',
  faint: '#9ca3af',
  line: '#e5e7eb',
  zebra: '#f8fafc',
  headBg: '#f3f4f6',
};

const s = StyleSheet.create({
  page: { paddingTop: 30, paddingBottom: 40, paddingHorizontal: 26, fontFamily: 'Helvetica', fontSize: 7, color: COLOR.ink },
  headerRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 12, marginBottom: 6 },
  logo: { height: 34, objectFit: 'contain' },
  title: { fontSize: 14, fontWeight: 'bold' },
  reportType: { fontSize: 10, fontWeight: 'bold', marginTop: 4 },
  subtitle: { fontSize: 9, color: COLOR.muted, marginTop: 2 },
  metaLine: { fontSize: 7.5, color: COLOR.faint, marginTop: 3 },
  divider: { borderBottomWidth: 1, borderBottomColor: COLOR.line, marginVertical: 6 },

  thRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#333', backgroundColor: COLOR.headBg, paddingVertical: 3 },
  tr: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: COLOR.line, paddingVertical: 2.5, minHeight: 12 },
  trZebra: { backgroundColor: COLOR.zebra },
  th: { fontSize: 6.5, fontWeight: 'bold', color: COLOR.muted, paddingHorizontal: 2 },
  td: { fontSize: 6.5, paddingHorizontal: 2 },

  empty: { color: COLOR.muted, marginTop: 8 },
  footer: { position: 'absolute', bottom: 20, left: 26, right: 26, fontSize: 7, color: COLOR.faint, textAlign: 'center', borderTopWidth: 0.5, borderTopColor: COLOR.line, paddingTop: 4 },
});

interface Column {
  key: string;
  header: string;
  /** Largura fixa (pt); sem valor => coluna flexível (compartilha o espaço restante). */
  width?: number;
  cell: (row: SurveyRow) => string;
}

/** Renderiza o valor de uma resposta conforme o tipo da pergunta. */
function answerText(q: PesquisaQuestion, raw: AnswerValue | undefined): string {
  if (raw === undefined || raw === null || raw === '') return '';
  switch (q.type) {
    case 'single_choice': {
      const opt = (q.options ?? []).find((o) => o.value === raw);
      return opt?.label ?? String(raw);
    }
    case 'multi_choice': {
      const arr = Array.isArray(raw) ? raw : [raw];
      return arr
        .map((v) => (q.options ?? []).find((o) => o.value === v)?.label ?? String(v))
        .join(', ');
    }
    case 'boolean':
      return typeof raw === 'boolean' ? boolLabel(raw) : String(raw);
    case 'scale':
      return String(raw);
    default:
      return String(raw);
  }
}

function buildColumns(config: PesquisaConfig | null, surveys: SurveyRow[]): Column[] {
  const questions = orderedQuestions(surveys, config);
  const meta: Column[] = [
    { key: '__dt', header: 'Data/Hora', width: 54, cell: (r) => format(new Date(r.collected_at), 'dd/MM/yy HH:mm') },
    { key: '__pe', header: 'Pesquisador', width: 58, cell: (r) => r.pesquisa_researchers?.name ?? '—' },
    { key: '__lo', header: 'Local', width: 52, cell: (r) => r.application_location || r.pesquisa_events?.location || '—' },
    { key: '__mo', header: 'Modo', width: 40, cell: (r) => r.mode ?? '—' },
  ];
  const qCols: Column[] = questions.map((q) => ({
    key: q.key,
    header: q.label,
    cell: (r) => answerText(q, r.answers?.[q.key]),
  }));
  return [...meta, ...qCols];
}

/** Estilo de largura de uma coluna: fixa ou flexível (compartilhada). */
const colWidth = (c: Column) =>
  c.width != null ? { width: c.width } : { flexGrow: 1, flexBasis: 0 };

function ListDocument({ surveys, config, meta }: { surveys: SurveyRow[]; config: PesquisaConfig | null; meta: PesquisaReportMeta }) {
  const columns = buildColumns(config, surveys);
  const dateStr = format(meta.generatedAt, 'dd/MM/yyyy');
  const timeStr = format(meta.generatedAt, 'HH:mm');

  const period = [meta.dateFrom, meta.dateTo].filter(Boolean).join(' a ');
  const filters = [
    meta.researcherName ? `Pesquisador: ${meta.researcherName}` : null,
    period ? `Período: ${period}` : null,
  ].filter(Boolean).join('   ·   ');

  const logos = (meta.branding?.logos || []).filter((l) => l.active).slice(0, 3);
  const brandTitle = meta.branding?.nome_oficial || meta.branding?.fallbackEventName;
  const rodape = meta.branding?.rodape_texto || 'JER Gestão';
  const localAno = meta.branding?.local_ano || '';

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={s.page}>
        {logos.length > 0 ? (
          <View style={s.headerRow}>{logos.map((l, i) => <Image key={i} src={l.url} style={s.logo} />)}</View>
        ) : null}
        {brandTitle ? (
          <>
            <Text style={s.title}>{brandTitle}</Text>
            {meta.branding?.subtitulo ? <Text style={s.subtitle}>{meta.branding.subtitulo}</Text> : null}
            <Text style={s.reportType}>Listagem de Coletas — Pesquisa de Satisfação</Text>
          </>
        ) : (
          <Text style={s.title}>Listagem de Coletas — Pesquisa de Satisfação</Text>
        )}
        <Text style={s.metaLine}>{meta.eventName}{filters ? `   ·   ${filters}` : ''}   ·   {surveys.length} registro(s)</Text>
        <Text style={s.metaLine}>Gerado em {dateStr} às {timeStr}</Text>
        <View style={s.divider} />

        {surveys.length === 0 ? (
          <Text style={s.empty}>Nenhuma coleta encontrada para os filtros selecionados.</Text>
        ) : (
          <>
            <View style={s.thRow} fixed>
              {columns.map((c) => <Text key={c.key} style={[s.th, colWidth(c)]}>{c.header}</Text>)}
            </View>
            {surveys.map((row, i) => (
              <View key={row.id} style={[s.tr, i % 2 === 1 ? s.trZebra : {}]} wrap={false}>
                {columns.map((c) => <Text key={c.key} style={[s.td, colWidth(c)]}>{c.cell(row)}</Text>)}
              </View>
            ))}
          </>
        )}

        <Text
          style={s.footer}
          render={({ pageNumber, totalPages }) =>
            `${rodape}${localAno ? ' • ' + localAno : ''} • Listagem de Coletas • Gerado em ${dateStr} às ${timeStr} • Página ${pageNumber}/${totalPages}`
          }
          fixed
        />
      </Page>
    </Document>
  );
}

export async function exportPesquisaListagemPdf(
  surveys: SurveyRow[],
  config: PesquisaConfig | null,
  meta: PesquisaReportMeta,
): Promise<Blob> {
  return await pdf(<ListDocument surveys={surveys} config={config} meta={meta} />).toBlob();
}
