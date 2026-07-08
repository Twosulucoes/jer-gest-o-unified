import { pdf, Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer';
import { format } from 'date-fns';
import {
  computeStats, computeHighlights, countBy, dailyCounts, scaleHistogram, crossTabsByProfile,
  type SurveyRow, type QStat, type ScaleStat, type CrossTab,
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

  // Resumo executivo / listas de destaque
  satBox: { borderWidth: 0.5, borderColor: COLOR.line, borderRadius: 4, padding: 8, marginBottom: 6, backgroundColor: '#f8fafc', flexDirection: 'row', alignItems: 'center', gap: 10 },
  satValue: { fontSize: 20, fontWeight: 'bold', color: COLOR.good },
  satLabel: { fontSize: 8, color: COLOR.muted, textTransform: 'uppercase' },
  satHint: { fontSize: 7.5, color: COLOR.faint, marginTop: 1 },
  twoCol: { flexDirection: 'row', gap: 12, marginBottom: 4 },
  col: { flexGrow: 1, flexBasis: 0 },
  colTitle: { fontSize: 8, fontWeight: 'bold', color: COLOR.muted, textTransform: 'uppercase', marginBottom: 3 },
  hlRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  hlDot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  hlLabel: { flexGrow: 1, flexBasis: 0, fontSize: 8.5 },
  hlVal: { fontSize: 8.5, fontWeight: 'bold', width: 44, textAlign: 'right' },

  // Tabela-resumo de escalas
  sumHead: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#333', backgroundColor: '#fafafa', paddingVertical: 3, marginTop: 2 },
  sumRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 0.5, borderBottomColor: COLOR.line, paddingVertical: 3 },
  sumQ: { flexGrow: 1, flexBasis: 0, fontSize: 8.5, paddingRight: 6 },
  sumAvg: { width: 52, textAlign: 'right', fontSize: 8.5, fontWeight: 'bold' },
  sumN: { width: 40, textAlign: 'right', fontSize: 8, color: COLOR.muted },
  sumHeadCell: { fontSize: 7.5, fontWeight: 'bold', color: COLOR.muted },

  // Lista chave/valor (resumo de coletas)
  kvRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 1.5, borderBottomWidth: 0.5, borderBottomColor: COLOR.line },
  kvLabel: { fontSize: 8, flexGrow: 1, flexBasis: 0, paddingRight: 6 },
  kvVal: { fontSize: 8, fontWeight: 'bold', width: 34, textAlign: 'right' },

  q: { marginBottom: 9 },
  qLabel: { fontSize: 9, marginBottom: 3 },
  qRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  barTrack: { flexGrow: 1, height: 9, backgroundColor: COLOR.track, borderRadius: 3, marginHorizontal: 6 },
  barFill: { height: 9, borderRadius: 3 },
  valTag: { fontSize: 8, color: COLOR.ink, width: 74, textAlign: 'right' },
  distRowLabel: { fontSize: 8, color: COLOR.muted, width: 96 },
  distRowLabelSm: { fontSize: 8, color: COLOR.muted, width: 18, textAlign: 'center' },
  caption: { fontSize: 7, color: COLOR.faint, marginTop: 1 },

  // Distribuição de notas (histograma por pergunta de escala)
  distTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 3 },
  distAvgTag: { fontSize: 8, fontWeight: 'bold', color: COLOR.ink },
  distNoteLabel: { fontSize: 7.5, color: COLOR.muted, width: 88 },

  // Matriz de cruzamento (escala × dimensão)
  mHead: { flexDirection: 'row', alignItems: 'flex-end', borderBottomWidth: 1, borderBottomColor: '#333', backgroundColor: '#fafafa', paddingVertical: 3 },
  mRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 0.5, borderBottomColor: COLOR.line, paddingVertical: 2.5 },
  mDim: { flexGrow: 1, flexBasis: 0, fontSize: 7.5, paddingRight: 4 },
  mDimHead: { flexGrow: 1, flexBasis: 0, fontSize: 7, fontWeight: 'bold', color: COLOR.muted },
  mN: { width: 24, fontSize: 7.5, textAlign: 'right' },
  mNHead: { width: 24, fontSize: 7, fontWeight: 'bold', color: COLOR.muted, textAlign: 'right' },
  mCell: { width: 30, fontSize: 7.5, textAlign: 'right', fontWeight: 'bold' },
  mCellHead: { width: 30, fontSize: 6.5, color: COLOR.muted, textAlign: 'right' },
  mSatHead: { width: 34, fontSize: 7, fontWeight: 'bold', color: COLOR.muted, textAlign: 'right' },
  mSat: { width: 34, fontSize: 7.5, fontWeight: 'bold', textAlign: 'right' },

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

/** Tabela-resumo compacta de perguntas de escala (uma linha por pergunta). */
function ScaleSummaryTable({ stats }: { stats: ScaleStat[] }) {
  if (stats.length === 0) return null;
  return (
    <View style={s.q} wrap={false}>
      <View style={s.sumHead}>
        <Text style={[s.sumQ, s.sumHeadCell]}>Pergunta</Text>
        <View style={[s.barTrack, { flexGrow: 0, width: 100, backgroundColor: 'transparent' }]} />
        <Text style={[s.sumAvg, s.sumHeadCell]}>Média</Text>
        <Text style={[s.sumN, s.sumHeadCell]}>Nº</Text>
      </View>
      {stats.map((stat) => (
        <View key={stat.key} style={s.sumRow}>
          <Text style={s.sumQ}>{stat.label}</Text>
          <Bar ratio={stat.avg / stat.scaleMax} color={scaleColor(stat.avg, stat.scaleMax)} width={100} />
          <Text style={s.sumAvg}>{stat.avg.toFixed(2)}/{stat.scaleMax}</Text>
          <Text style={s.sumN}>{stat.count}</Text>
        </View>
      ))}
    </View>
  );
}

/** Histograma de notas (1..scaleMax) de uma pergunta de escala. */
function ScaleDistributionBlock({
  stat, surveys, scaleLabels,
}: {
  stat: ScaleStat;
  surveys: SurveyRow[];
  scaleLabels: { value: number; emoji?: string; label: string }[];
}) {
  const hist = scaleHistogram(stat.key, surveys, stat.scaleMax);
  const totalResp = hist.reduce((a, b) => a + b, 0);
  if (totalResp === 0) return null;
  const maxCount = Math.max(1, ...hist);
  const labelOf = (n: number) => scaleLabels.find((l) => l.value === n)?.label ?? '';
  return (
    <View style={s.q} wrap={false}>
      <View style={s.distTitleRow}>
        <Text style={s.qLabel}>{stat.label}</Text>
        <Text style={s.distAvgTag}>Média {stat.avg.toFixed(2)}/{stat.scaleMax}</Text>
      </View>
      {hist.map((count, i) => {
        const note = i + 1;
        return (
          <View key={note} style={s.qRow}>
            <Text style={s.distNoteLabel}>{note} — {labelOf(note)}</Text>
            <Bar ratio={count / maxCount} color={scaleColor(note, stat.scaleMax)} />
            <Text style={s.valTag}>{count} ({pct(count, totalResp)}%)</Text>
          </View>
        );
      })}
      <Text style={s.caption}>{totalResp} resposta(s)</Text>
    </View>
  );
}

/** Tabela de cruzamento: satisfação/média por pergunta de escala em cada opção da dimensão. */
function CrossMatrixTable({ ct }: { ct: CrossTab }) {
  if (ct.rows.length === 0) return null;
  // Abreviação do cabeçalho de cada escala (mantém legível na matriz estreita).
  const abbr = (label: string) => {
    const clean = label.replace(/\?.*$/, '').replace(/\(.*?\)/g, '').trim();
    return clean.length > 18 ? clean.slice(0, 17) + '…' : clean;
  };
  return (
    <View style={s.q} wrap={false}>
      <Text style={s.qLabel}>{ct.label}</Text>
      <View style={s.mHead}>
        <Text style={s.mDimHead}>Opção</Text>
        <Text style={s.mNHead}>Nº</Text>
        <Text style={s.mSatHead}>Satisf.</Text>
        {ct.scaleKeys.map((sk) => (
          <Text key={sk.key} style={s.mCellHead}>{abbr(sk.label)}</Text>
        ))}
      </View>
      {ct.rows.map((r) => (
        <View key={r.value} style={s.mRow}>
          <Text style={s.mDim}>{r.label}</Text>
          <Text style={s.mN}>{r.count}</Text>
          <Text style={[s.mSat, { color: r.satisfactionPct != null ? scaleColor(r.satisfactionPct, 100) : COLOR.faint }]}>
            {r.satisfactionPct != null ? `${r.satisfactionPct}%` : '—'}
          </Text>
          {ct.scaleKeys.map((sk) => {
            const v = r.perScale[sk.key];
            return (
              <Text key={sk.key} style={[s.mCell, { color: v != null ? scaleColor(v, sk.scaleMax) : COLOR.faint }]}>
                {v != null ? v.toFixed(1) : '—'}
              </Text>
            );
          })}
        </View>
      ))}
    </View>
  );
}

/** Lista curta de destaques (pontos fortes / de atenção). */
function HighlightList({ title, items }: { title: string; items: ScaleStat[] }) {
  if (items.length === 0) return null;
  return (
    <View style={s.col}>
      <Text style={s.colTitle}>{title}</Text>
      {items.map((it) => (
        <View key={it.key} style={s.hlRow}>
          <View style={[s.hlDot, { backgroundColor: scaleColor(it.avg, it.scaleMax) }]} />
          <Text style={s.hlLabel}>{it.label}</Text>
          <Text style={[s.hlVal, { color: scaleColor(it.avg, it.scaleMax) }]}>{it.avg.toFixed(2)}/{it.scaleMax}</Text>
        </View>
      ))}
    </View>
  );
}

/** Lista chave/valor agregada (ex.: coletas por pesquisador / local). */
function KVList({ title, items }: { title: string; items: { label: string; count: number }[] }) {
  return (
    <View style={s.col}>
      <Text style={s.colTitle}>{title}</Text>
      {items.map((it) => (
        <View key={it.label} style={s.kvRow}>
          <Text style={s.kvLabel}>{it.label}</Text>
          <Text style={s.kvVal}>{it.count}</Text>
        </View>
      ))}
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

  const highlights = stats ? computeHighlights(stats) : null;
  const crossTabs = crossTabsByProfile(surveys, config);

  // Agrupa as perguntas por seção, preservando a ordem de aparição.
  const groups: { key: string; label: string | null; stats: QStat[] }[] = [];
  const groupIndex = new Map<string, number>();
  stats?.qStats.forEach((st) => {
    const secKey = sectionOfKey.get(st.key) ?? '__geral__';
    let idx = groupIndex.get(secKey);
    if (idx === undefined) {
      idx = groups.length;
      groupIndex.set(secKey, idx);
      groups.push({ key: secKey, label: sectionLabel.get(secKey) ?? null, stats: [] });
    }
    groups[idx].stats.push(st);
  });

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
                <Text style={s.kpiLabel}>Índice de satisfação</Text>
                <Text style={s.kpiValue}>{highlights?.satisfactionPct != null ? `${highlights.satisfactionPct}%` : '—'}</Text>
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

            {/* Resumo executivo: pontos fortes e de atenção */}
            {highlights && (highlights.best.length > 0 || highlights.worst.length > 0) ? (
              <>
                <Text style={s.sectionTitle}>Resumo executivo</Text>
                <View style={s.twoCol}>
                  <HighlightList title="Pontos fortes" items={highlights.best} />
                  <HighlightList title="Pontos de atenção" items={highlights.worst} />
                </View>
              </>
            ) : null}

            <Text style={s.sectionTitle}>Coletas por dia</Text>
            <TrendChart data={dailyCounts(surveys)} />

            {config ? (
              <View style={s.legend}>
                {scaleLabels.map((l) => (
                  <Text key={l.value} style={s.legendItem}>{l.value} = {l.label}</Text>
                ))}
              </View>
            ) : null}

            {/* Resultados por seção: tabela-resumo de escalas + distribuições de notas + demais perguntas */}
            {groups.map((g) => {
              const scaleStats = g.stats.filter((st): st is ScaleStat => st.type === 'scale');
              const others = g.stats.filter((st) => st.type !== 'scale');
              return (
                <View key={g.key}>
                  {/* Mantém o título da seção junto da tabela-resumo (evita cabeçalho órfão). */}
                  <View wrap={false}>
                    {g.label ? <Text style={s.sectionTitle}>{g.label}</Text> : null}
                    <ScaleSummaryTable stats={scaleStats} />
                  </View>
                  {/* Distribuição das notas (1..scaleMax) por pergunta de escala */}
                  {scaleStats.map((stat) => (
                    <ScaleDistributionBlock key={stat.key} stat={stat} surveys={surveys} scaleLabels={scaleLabels} />
                  ))}
                  {others.map((stat) =>
                    stat.type === 'choice' ? <ChoiceBlock key={stat.key} stat={stat} />
                    : stat.type === 'boolean' ? <BooleanBlock key={stat.key} stat={stat} />
                    : <TextBlock key={stat.key} stat={stat} />
                  )}
                </View>
              );
            })}

            {/* Análise cruzada (dados cruzados): satisfação por dimensão de perfil */}
            {crossTabs.length > 0 ? (
              <>
                <Text style={s.sectionTitle} break>Análise Cruzada (Dados Cruzados)</Text>
                <Text style={s.caption}>
                  Satisfação (índice 0–100) e média por pergunta de escala, segmentadas por perfil do respondente.
                </Text>
                {crossTabs.map((ct) => <CrossMatrixTable key={ct.key} ct={ct} />)}
              </>
            ) : null}

            {/* Resumo de coletas (agregado, substitui a listagem linha-a-linha) */}
            <Text style={s.sectionTitle}>Resumo de coletas ({stats.total})</Text>
            <View style={s.twoCol}>
              <KVList title="Por pesquisador" items={countBy(surveys, (r) => r.pesquisa_researchers?.name).slice(0, 8)} />
              <KVList title="Por local" items={countBy(surveys, (r) => r.application_location || r.pesquisa_events?.location).slice(0, 8)} />
            </View>
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
