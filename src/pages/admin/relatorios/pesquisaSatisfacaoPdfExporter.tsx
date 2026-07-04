import { pdf, Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer';
import { format } from 'date-fns';
import {
  computeStats, scaleHistogram, dailyCounts, type SurveyRow, type QStat,
} from '@/lib/pesquisa/aggregate';
import { DEFAULT_SCALE_LABELS, type PesquisaConfig } from '@/lib/pesquisa/config';
import type { EventBrandingResolved } from '@/hooks/useEventBranding';

export interface PesquisaReportMeta {
  eventName: string;
  researcherName?: string;
  dateFrom?: string;
  dateTo?: string;
  generatedAt: Date;
  branding?: EventBrandingResolved | null;
}

const COLOR = {
  ink: '#111827',
  muted: '#6b7280',
  faint: '#9ca3af',
  line: '#e5e7eb',
  track: '#eef0f3',
  primary: '#2563eb',
  bad: '#dc2626',
  warn: '#d97706',
  good: '#16a34a',
  headerBg: '#f3f4f6',
};

const s = StyleSheet.create({
  page: { paddingTop: 34, paddingBottom: 44, paddingHorizontal: 34, fontFamily: 'Helvetica', fontSize: 9, color: COLOR.ink },
  headerRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 12, marginBottom: 6 },
  logo: { height: 38, objectFit: 'contain' },
  title: { fontSize: 15, fontWeight: 'bold' },
  reportType: { fontSize: 11, fontWeight: 'bold', marginTop: 6 },
  subtitle: { fontSize: 10, color: COLOR.muted, marginTop: 2 },
  metaLine: { fontSize: 8, color: COLOR.faint, marginTop: 3 },
  divider: { borderBottomWidth: 1, borderBottomColor: COLOR.line, marginVertical: 8 },

  trendRow: { flexDirection: 'row', alignItems: 'flex-end', height: 86, gap: 4, marginTop: 4 },
  trendCol: { flexGrow: 1, flexBasis: 0, alignItems: 'center' },
  trendCount: { fontSize: 7, color: COLOR.muted, marginBottom: 2 },
  trendLabelRow: { flexDirection: 'row', gap: 4, marginTop: 2 },
  trendLabel: { flexGrow: 1, flexBasis: 0, fontSize: 6.5, color: COLOR.faint, textAlign: 'center' },

  kpiRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  kpi: { flexGrow: 1, flexBasis: 0, borderWidth: 0.5, borderColor: COLOR.line, borderRadius: 4, padding: 8 },
  kpiLabel: { fontSize: 7, color: COLOR.muted, textTransform: 'uppercase' },
  kpiValue: { fontSize: 17, fontWeight: 'bold', marginTop: 3, color: COLOR.primary },

  sectionTitle: { fontSize: 10, fontWeight: 'bold', marginTop: 12, marginBottom: 6, backgroundColor: COLOR.headerBg, paddingVertical: 4, paddingHorizontal: 6, borderRadius: 3 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  legendItem: { fontSize: 7, color: COLOR.muted },

  q: { marginBottom: 9 },
  qLabel: { fontSize: 9, marginBottom: 3 },
  qRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  barTrack: { flexGrow: 1, height: 9, backgroundColor: COLOR.track, borderRadius: 3, marginHorizontal: 6 },
  barFill: { height: 9, borderRadius: 3 },
  valTag: { fontSize: 8, color: COLOR.ink, width: 74, textAlign: 'right' },
  distRowLabel: { fontSize: 8, color: COLOR.muted, width: 96 },
  distRowLabelSm: { fontSize: 8, color: COLOR.muted, width: 18, textAlign: 'center' },
  caption: { fontSize: 7, color: COLOR.faint, marginTop: 1 },

  comment: { borderLeftWidth: 2, borderLeftColor: COLOR.primary, paddingLeft: 6, marginBottom: 5 },
  commentMeta: { fontSize: 7, color: COLOR.muted },
  commentText: { fontSize: 8.5, marginTop: 1 },

  thRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#333', backgroundColor: '#fafafa', paddingVertical: 3 },
  tr: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: COLOR.line, paddingVertical: 3 },
  th: { fontSize: 8, fontWeight: 'bold' },
  td: { fontSize: 8 },

  footer: { position: 'absolute', bottom: 22, left: 34, right: 34, fontSize: 7, color: COLOR.faint, textAlign: 'center', borderTopWidth: 0.5, borderTopColor: COLOR.line, paddingTop: 4 },
});

const pct = (n: number, total: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

function scaleColor(avg: number, max: number) {
  const r = max > 0 ? avg / max : 0;
  if (r < 0.5) return COLOR.bad;
  if (r < 0.7) return COLOR.warn;
  return COLOR.good;
}

/** Barra horizontal proporcional (0..1). */
function Bar({ ratio, color, width }: { ratio: number; color: string; width?: number }) {
  const w = Math.max(0, Math.min(1, ratio)) * 100;
  return (
    <View style={[s.barTrack, width != null ? { flexGrow: 0, width } : {}]}>
      <View style={[s.barFill, { width: `${w}%`, backgroundColor: color }]} />
    </View>
  );
}

function ScaleBlock({ stat, surveys }: { stat: Extract<QStat, { type: 'scale' }>; surveys: SurveyRow[] }) {
  const hist = scaleHistogram(stat.key, surveys, stat.scaleMax);
  const maxCount = Math.max(1, ...hist);
  const color = scaleColor(stat.avg, stat.scaleMax);
  return (
    <View style={s.q} wrap={false}>
      <Text style={s.qLabel}>{stat.label}</Text>
      <View style={s.qRow}>
        <Bar ratio={stat.avg / stat.scaleMax} color={color} />
        <Text style={s.valTag}>{stat.avg.toFixed(2)} / {stat.scaleMax}</Text>
      </View>
      {hist.map((c, i) => (
        <View key={i} style={s.qRow}>
          <Text style={s.distRowLabelSm}>{i + 1}</Text>
          <Bar ratio={c / maxCount} color={COLOR.primary} />
          <Text style={s.valTag}>{c} ({pct(c, stat.count)}%)</Text>
        </View>
      ))}
      <Text style={s.caption}>{stat.count} resposta(s)</Text>
    </View>
  );
}

function ChoiceBlock({ stat }: { stat: Extract<QStat, { type: 'choice' }> }) {
  const dist = [...stat.dist].sort((a, b) => b.count - a.count);
  const maxCount = Math.max(1, ...dist.map((d) => d.count));
  return (
    <View style={s.q} wrap={false}>
      <Text style={s.qLabel}>{stat.label}</Text>
      {dist.map((d) => (
        <View key={d.label} style={s.qRow}>
          <Text style={s.distRowLabel}>{d.label}</Text>
          <Bar ratio={d.count / maxCount} color={COLOR.primary} />
          <Text style={s.valTag}>{d.count} ({pct(d.count, stat.count)}%)</Text>
        </View>
      ))}
      <Text style={s.caption}>{stat.count} resposta(s)</Text>
    </View>
  );
}

function BooleanBlock({ stat }: { stat: Extract<QStat, { type: 'boolean' }> }) {
  const total = stat.yes + stat.no || 1;
  const rows = [
    { label: 'Sim', count: stat.yes, color: COLOR.good },
    { label: 'Não', count: stat.no, color: COLOR.bad },
  ];
  return (
    <View style={s.q} wrap={false}>
      <Text style={s.qLabel}>{stat.label}</Text>
      {rows.map((r) => (
        <View key={r.label} style={s.qRow}>
          <Text style={s.distRowLabel}>{r.label}</Text>
          <Bar ratio={r.count / total} color={r.color} />
          <Text style={s.valTag}>{r.count} ({pct(r.count, total)}%)</Text>
        </View>
      ))}
      <Text style={s.caption}>{stat.yes + stat.no} resposta(s)</Text>
    </View>
  );
}

function TextBlock({ stat }: { stat: Extract<QStat, { type: 'text' }> }) {
  if (stat.values.length === 0) return null;
  const items = [...stat.values].sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 30);
  return (
    <View style={s.q}>
      <Text style={s.qLabel}>{stat.label} ({stat.values.length})</Text>
      {items.map((v, i) => (
        <View key={i} style={s.comment} wrap={false}>
          <Text style={s.commentMeta}>
            {format(new Date(v.at), 'dd/MM HH:mm')}{v.who ? ` · ${v.who}` : ''}
          </Text>
          <Text style={s.commentText}>{v.text}</Text>
        </View>
      ))}
    </View>
  );
}

function TrendChart({ data }: { data: { label: string; count: number }[] }) {
  const days = data.slice(-14);
  const max = Math.max(1, ...days.map((d) => d.count));
  const barMaxH = 60;
  return (
    <View style={s.q} wrap={false}>
      <View style={s.trendRow}>
        {days.map((d, i) => (
          <View key={i} style={s.trendCol}>
            <Text style={s.trendCount}>{d.count}</Text>
            <View style={{ width: '68%', height: Math.max(2, (d.count / max) * barMaxH), backgroundColor: COLOR.primary, borderTopLeftRadius: 2, borderTopRightRadius: 2 }} />
          </View>
        ))}
      </View>
      <View style={s.trendLabelRow}>
        {days.map((d, i) => <Text key={i} style={s.trendLabel}>{d.label}</Text>)}
      </View>
    </View>
  );
}

function ReportDocument({ surveys, config, meta }: { surveys: SurveyRow[]; config: PesquisaConfig | null; meta: PesquisaReportMeta }) {
  const stats = computeStats(surveys, config);
  const dateStr = format(meta.generatedAt, 'dd/MM/yyyy');
  const timeStr = format(meta.generatedAt, 'HH:mm');

  const scaleLabels = config?.scaleLabels ?? DEFAULT_SCALE_LABELS;

  // Rótulo de seção por chave de pergunta (para agrupar os blocos).
  const sectionOfKey = new Map<string, string>();
  const sectionLabel = new Map<string, string>();
  if (config) {
    config.sections?.forEach((sec) => sectionLabel.set(sec.key, sec.label));
    config.questions.forEach((q) => sectionOfKey.set(q.key, q.section));
  }

  const period = [meta.dateFrom, meta.dateTo].filter(Boolean).join(' a ');
  const filters = [
    meta.researcherName ? `Pesquisador: ${meta.researcherName}` : null,
    period ? `Período: ${period}` : null,
  ].filter(Boolean).join('   ·   ');

  let currentSection: string | null = null;

  const logos = (meta.branding?.logos || []).filter((l) => l.active).slice(0, 3);
  const brandTitle = meta.branding?.nome_oficial || meta.branding?.fallbackEventName;
  const rodape = meta.branding?.rodape_texto || 'JER Gestão';
  const localAno = meta.branding?.local_ano || '';

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {logos.length > 0 ? (
          <View style={s.headerRow}>{logos.map((l, i) => <Image key={i} src={l.url} style={s.logo} />)}</View>
        ) : null}
        {brandTitle ? (
          <>
            <Text style={s.title}>{brandTitle}</Text>
            {meta.branding?.subtitulo ? <Text style={s.subtitle}>{meta.branding.subtitulo}</Text> : null}
            <Text style={s.reportType}>Relatório de Resultados — Pesquisa de Satisfação</Text>
          </>
        ) : (
          <Text style={s.title}>Relatório — Pesquisa de Satisfação</Text>
        )}
        <Text style={s.metaLine}>{meta.eventName}{filters ? `   ·   ${filters}` : ''}</Text>
        <Text style={s.metaLine}>Gerado em {dateStr} às {timeStr}</Text>
        <View style={s.divider} />

        {!stats ? (
          <Text style={{ color: COLOR.muted }}>Nenhuma coleta encontrada para os filtros selecionados.</Text>
        ) : (
          <>
            <View style={s.kpiRow}>
              <View style={s.kpi}>
                <Text style={s.kpiLabel}>Total de coletas</Text>
                <Text style={s.kpiValue}>{stats.total}</Text>
              </View>
              <View style={s.kpi}>
                <Text style={s.kpiLabel}>Média geral (escalas)</Text>
                <Text style={s.kpiValue}>{stats.overallAvg ?? '—'}</Text>
              </View>
              <View style={s.kpi}>
                <Text style={s.kpiLabel}>Coletas hoje</Text>
                <Text style={s.kpiValue}>{stats.today}</Text>
              </View>
            </View>

            <Text style={s.sectionTitle}>Coletas por dia</Text>
            <TrendChart data={dailyCounts(surveys)} />

            {config ? (
              <View style={s.legend}>
                {scaleLabels.map((l) => (
                  <Text key={l.value} style={s.legendItem}>{l.value} = {l.label}</Text>
                ))}
              </View>
            ) : null}

            {stats.qStats.map((stat) => {
              const sec = sectionOfKey.get(stat.key) ?? null;
              const header = sec && sec !== currentSection
                ? <Text key={`sec-${stat.key}`} style={s.sectionTitle}>{sectionLabel.get(sec) ?? sec}</Text>
                : null;
              if (sec) currentSection = sec;
              const block =
                stat.type === 'scale' ? <ScaleBlock key={stat.key} stat={stat} surveys={surveys} />
                : stat.type === 'choice' ? <ChoiceBlock key={stat.key} stat={stat} />
                : stat.type === 'boolean' ? <BooleanBlock key={stat.key} stat={stat} />
                : <TextBlock key={stat.key} stat={stat} />;
              return header ? <View key={`grp-${stat.key}`}>{header}{block}</View> : block;
            })}

            <Text style={s.sectionTitle}>Coletas ({stats.total})</Text>
            <View style={s.thRow}>
              <Text style={[s.th, { width: '24%' }]}>Data/Hora</Text>
              <Text style={[s.th, { width: '28%' }]}>Pesquisador</Text>
              <Text style={[s.th, { width: '30%' }]}>Local</Text>
              <Text style={[s.th, { width: '18%' }]}>Modo</Text>
            </View>
            {surveys.slice(0, 80).map((row) => (
              <View key={row.id} style={s.tr} wrap={false}>
                <Text style={[s.td, { width: '24%' }]}>{format(new Date(row.collected_at), 'dd/MM/yyyy HH:mm')}</Text>
                <Text style={[s.td, { width: '28%' }]}>{row.pesquisa_researchers?.name || '—'}</Text>
                <Text style={[s.td, { width: '30%' }]}>{row.application_location || row.pesquisa_events?.location || '—'}</Text>
                <Text style={[s.td, { width: '18%' }]}>{row.mode || '—'}</Text>
              </View>
            ))}
            {surveys.length > 80 ? (
              <Text style={s.caption}>Exibindo as 80 coletas mais recentes de {surveys.length}.</Text>
            ) : null}
          </>
        )}

        <Text
          style={s.footer}
          render={({ pageNumber, totalPages }) =>
            `${rodape}${localAno ? ' • ' + localAno : ''} • Pesquisa de Satisfação • Gerado em ${dateStr} às ${timeStr} • Página ${pageNumber}/${totalPages}`
          }
          fixed
        />
      </Page>
    </Document>
  );
}

export async function exportPesquisaSatisfacaoPdf(
  surveys: SurveyRow[],
  config: PesquisaConfig | null,
  meta: PesquisaReportMeta,
): Promise<Blob> {
  return await pdf(<ReportDocument surveys={surveys} config={config} meta={meta} />).toBlob();
}
