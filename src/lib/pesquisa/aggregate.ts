// Agregação compartilhada da Pesquisa de Satisfação.
// Fonte ÚNICA usada tanto pelo painel (PesquisaDashboardPage) quanto pelo
// exportador de PDF (pesquisaSatisfacaoPdfExporter). Não duplicar esta lógica.

import { format } from 'date-fns';
import type { PesquisaConfig, PesquisaQuestion, Answers, AnswerValue } from './config';

export type SurveyRow = {
  id: string;
  client_uuid: string;
  researcher_id: string;
  event_id: string;
  mode: string | null;
  collected_at: string;
  application_location: string | null;
  answers: Answers;
  pesquisa_researchers?: { name?: string } | null;
  pesquisa_events?: { name?: string; location?: string | null } | null;
};

// Estatística agregada de uma pergunta.
export type QStat =
  | { key: string; label: string; type: 'scale'; avg: number; count: number; scaleMax: number }
  | { key: string; label: string; type: 'choice'; dist: { label: string; count: number }[]; count: number }
  | { key: string; label: string; type: 'boolean'; yes: number; no: number; count: number }
  | { key: string; label: string; type: 'text'; values: { text: string; at: string; who?: string }[] };

export const boolLabel = (b: boolean) => (b ? 'Sim' : 'Não');

export function aggregateQuestion(q: PesquisaQuestion, surveys: SurveyRow[]): QStat {
  const vals = surveys.map((s) => s.answers?.[q.key]).filter((v) => v !== undefined && v !== null) as AnswerValue[];
  if (q.type === 'scale') {
    const nums = vals.map((v) => (typeof v === 'number' ? v : NaN)).filter((n) => !Number.isNaN(n));
    const avg = nums.length ? +(nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2) : 0;
    return { key: q.key, label: q.label, type: 'scale', avg, count: nums.length, scaleMax: q.scaleMax ?? 5 };
  }
  if (q.type === 'boolean') {
    let yes = 0, no = 0;
    vals.forEach((v) => { if (v === true) yes++; else if (v === false) no++; });
    return { key: q.key, label: q.label, type: 'boolean', yes, no, count: yes + no };
  }
  if (q.type === 'single_choice' || q.type === 'multi_choice') {
    const counts = new Map<string, number>();
    vals.forEach((v) => {
      const arr = Array.isArray(v) ? v : [v];
      arr.forEach((raw) => {
        const opt = (q.options ?? []).find((o) => o.value === raw);
        const label = opt?.label ?? String(raw);
        counts.set(label, (counts.get(label) ?? 0) + 1);
      });
    });
    return { key: q.key, label: q.label, type: 'choice', dist: [...counts].map(([label, count]) => ({ label, count })), count: vals.length };
  }
  // text
  const values = surveys
    .map((s) => ({ v: s.answers?.[q.key], at: s.collected_at, who: s.pesquisa_researchers?.name }))
    .filter((x) => typeof x.v === 'string' && (x.v as string).trim() !== '')
    .map((x) => ({ text: x.v as string, at: x.at, who: x.who }));
  return { key: q.key, label: q.label, type: 'text', values };
}

/** Sem config (visão "todos eventos"): infere perguntas pelas chaves de answers. */
export function inferQuestions(surveys: SurveyRow[]): PesquisaQuestion[] {
  const keys = new Set<string>();
  surveys.forEach((s) => Object.keys(s.answers ?? {}).forEach((k) => keys.add(k)));
  return [...keys].map((key, i) => {
    const sample = surveys.map((s) => s.answers?.[key]).find((v) => v !== undefined && v !== null);
    const type: PesquisaQuestion['type'] =
      typeof sample === 'number' ? 'scale'
      : typeof sample === 'boolean' ? 'boolean'
      : Array.isArray(sample) ? 'multi_choice'
      : 'text';
    return { key, label: key, section: 'geral', order: i + 1, type };
  });
}

/** Perguntas a agregar, na ordem: do config (evento) ou inferidas das respostas. */
export function orderedQuestions(surveys: SurveyRow[], config: PesquisaConfig | null): PesquisaQuestion[] {
  return config
    ? [...config.questions].sort((a, b) => a.order - b.order)
    : inferQuestions(surveys);
}

export interface PesquisaStats {
  total: number;
  today: number;
  overallAvg: number | null;
  qStats: QStat[];
  scaleStats: Extract<QStat, { type: 'scale' }>[];
  recentComments: { text: string; at: string; who?: string; question: string }[];
}

/** Estatísticas completas de um conjunto de coletas (idêntico ao painel). */
export function computeStats(surveys: SurveyRow[], config: PesquisaConfig | null): PesquisaStats | null {
  if (!surveys || surveys.length === 0) return null;
  const total = surveys.length;
  const todayStr = new Date().toDateString();
  const today = surveys.filter((s) => new Date(s.collected_at).toDateString() === todayStr).length;

  const questions = orderedQuestions(surveys, config);
  const qStats: QStat[] = questions.map((q) => aggregateQuestion(q, surveys));

  const scaleStats = qStats.filter((s): s is Extract<QStat, { type: 'scale' }> => s.type === 'scale' && s.count > 0);
  const overallAvg = scaleStats.length
    ? +(scaleStats.reduce((a, s) => a + s.avg, 0) / scaleStats.length).toFixed(2)
    : null;

  const textStats = qStats.filter((s): s is Extract<QStat, { type: 'text' }> => s.type === 'text');
  const recentComments = textStats
    .flatMap((s) => s.values.map((v) => ({ ...v, question: s.label })))
    .sort((a, b) => (a.at < b.at ? 1 : -1))
    .slice(0, 12);

  return { total, today, overallAvg, qStats, scaleStats, recentComments };
}

/** Distribuição de uma pergunta de escala: contagem por valor 1..scaleMax. */
export function scaleHistogram(key: string, surveys: SurveyRow[], scaleMax: number): number[] {
  const hist = new Array(scaleMax).fill(0) as number[];
  surveys.forEach((s) => {
    const v = s.answers?.[key];
    if (typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= scaleMax) hist[v - 1]++;
  });
  return hist;
}

/** Coletas por dia (ordenado por data), para o gráfico de tendência. */
export function dailyCounts(surveys: SurveyRow[]): { day: string; label: string; count: number }[] {
  const map = new Map<string, number>();
  surveys.forEach((s) => {
    const day = format(new Date(s.collected_at), 'yyyy-MM-dd');
    map.set(day, (map.get(day) ?? 0) + 1);
  });
  return [...map.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([day, count]) => ({ day, label: format(new Date(day + 'T12:00:00'), 'dd/MM'), count }));
}
