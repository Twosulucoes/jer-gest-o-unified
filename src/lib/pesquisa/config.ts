// Modelo dinâmico da Pesquisa de Satisfação (schema v2).
// Contrato ÚNICO compartilhado entre PWA (coleta), builder (admin) e dashboard.
// Espelha exatamente o questions_config gravado no banco (ver migration
// 20260704010000_pesquisa_dynamic_answers.sql).

export type QuestionType = 'scale' | 'single_choice' | 'multi_choice' | 'text' | 'boolean';

export interface QuestionOption {
  value: string;
  label: string;
}

export interface ScaleLabel {
  value: number;
  emoji?: string;
  label: string;
}

// Exibição condicional: a pergunta só aparece se a resposta de `key` estiver em `values`.
export interface VisibleIf {
  key: string;
  values: Array<string | number | boolean>;
}

export interface PesquisaQuestion {
  key: string;
  section: string;
  order: number;
  type: QuestionType;
  label: string;
  required?: boolean;
  scaleMax?: number;          // scale (default 5)
  options?: QuestionOption[]; // single_choice / multi_choice
  visibleIf?: VisibleIf;
  placeholder?: string;       // text
  maxLength?: number;         // text
}

export interface PesquisaSection {
  key: string;
  label: string;
  order: number;
}

export interface PesquisaConfig {
  version: 2;
  name?: string;
  scaleLabels?: ScaleLabel[];
  sections: PesquisaSection[];
  questions: PesquisaQuestion[];
}

export type AnswerValue = number | string | string[] | boolean;
export type Answers = Record<string, AnswerValue>;

// ---------------------------------------------------------------------------
// Guards / helpers
// ---------------------------------------------------------------------------

/** Reconhece um config v2 (objeto com array de perguntas). */
export function isConfigV2(c: unknown): c is PesquisaConfig {
  return !!c && typeof c === 'object' && Array.isArray((c as PesquisaConfig).questions);
}

export const DEFAULT_SCALE_LABELS: ScaleLabel[] = [
  { value: 1, emoji: '😞', label: 'Não gostei' },
  { value: 2, emoji: '🤔', label: 'Pode melhorar' },
  { value: 3, emoji: '😶', label: 'Neutro' },
  { value: 4, emoji: '🫡', label: 'Gostei' },
  { value: 5, emoji: '🤗', label: 'Excelente' },
];

/** Avalia visibleIf contra as respostas atuais. */
export function isQuestionVisible(q: PesquisaQuestion, answers: Answers): boolean {
  if (!q.visibleIf) return true;
  const ctrl = answers[q.visibleIf.key];
  if (ctrl === undefined || ctrl === null) return false;
  return q.visibleIf.values.some((v) => v === ctrl);
}

/** Uma resposta conta como preenchida? (para checagem de obrigatória) */
export function isAnswerFilled(v: AnswerValue | undefined | null): boolean {
  if (v === undefined || v === null) return false;
  if (typeof v === 'string') return v.trim() !== '';
  if (Array.isArray(v)) return v.length > 0;
  return true; // number | boolean
}

export function orderedSections(config: PesquisaConfig): PesquisaSection[] {
  return [...(config.sections ?? [])].sort((a, b) => a.order - b.order);
}

/** Perguntas de uma seção, ordenadas e apenas as visíveis para as respostas atuais. */
export function visibleQuestionsForSection(
  config: PesquisaConfig,
  sectionKey: string,
  answers: Answers,
): PesquisaQuestion[] {
  return config.questions
    .filter((q) => q.section === sectionKey && isQuestionVisible(q, answers))
    .sort((a, b) => a.order - b.order);
}

/** Todas as perguntas visíveis, ordenadas. */
export function allVisibleQuestions(config: PesquisaConfig, answers: Answers): PesquisaQuestion[] {
  return config.questions
    .filter((q) => isQuestionVisible(q, answers))
    .sort((a, b) => a.order - b.order);
}

/**
 * Valida as respostas no cliente (espelho do RPC pesquisa_pwa_submit_survey).
 * Retorna a primeira violação ({ key, reason }) ou null se tudo ok.
 * Só considera perguntas visíveis.
 */
export function firstValidationError(
  config: PesquisaConfig,
  answers: Answers,
): { key: string; reason: string } | null {
  for (const q of config.questions) {
    if (!isQuestionVisible(q, answers)) continue;
    const v = answers[q.key];
    if (q.required && !isAnswerFilled(v)) {
      return { key: q.key, reason: 'required' };
    }
    if (v === undefined || v === null) continue;
    if (q.type === 'scale') {
      const max = q.scaleMax ?? 5;
      if (typeof v !== 'number' || v < 1 || v > max || !Number.isInteger(v)) {
        return { key: q.key, reason: 'range' };
      }
    } else if (q.type === 'boolean') {
      if (typeof v !== 'boolean') return { key: q.key, reason: 'type' };
    } else if (q.type === 'text') {
      if (typeof v !== 'string') return { key: q.key, reason: 'type' };
    } else if (q.type === 'single_choice') {
      if (typeof v !== 'string' || !(q.options ?? []).some((o) => o.value === v)) {
        return { key: q.key, reason: 'option' };
      }
    } else if (q.type === 'multi_choice') {
      if (!Array.isArray(v) || v.some((sel) => !(q.options ?? []).some((o) => o.value === sel))) {
        return { key: q.key, reason: 'option' };
      }
    }
  }
  return null;
}

/** Remove do mapa de respostas as chaves de perguntas escondidas (não devem ser enviadas). */
export function pruneHiddenAnswers(config: PesquisaConfig, answers: Answers): Answers {
  const out: Answers = {};
  for (const q of config.questions) {
    if (!isQuestionVisible(q, answers)) continue;
    const v = answers[q.key];
    if (isAnswerFilled(v)) out[q.key] = v as AnswerValue;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Preset default — formulário "JER Alojamento" (PDF de referência).
// Deve espelhar o backfill da migration. Usado como fallback quando o evento
// não devolve um config v2 e como ponto de partida no builder admin.
// ---------------------------------------------------------------------------

const RR_MUNICIPIOS: QuestionOption[] = [
  ['alto_alegre', 'Alto Alegre'], ['amajari', 'Amajari'], ['boa_vista', 'Boa Vista'],
  ['bonfim', 'Bonfim'], ['canta', 'Cantá'], ['caracarai', 'Caracaraí'],
  ['caroebe', 'Caroebe'], ['iracema', 'Iracema'], ['mucajai', 'Mucajaí'],
  ['normandia', 'Normandia'], ['pacaraima', 'Pacaraima'], ['rorainopolis', 'Rorainópolis'],
  ['sao_joao_baliza', 'São João da Baliza'], ['sao_luiz', 'São Luiz'], ['uiramuta', 'Uiramutã'],
].map(([value, label]) => ({ value, label }));

export const DEFAULT_CONFIG: PesquisaConfig = {
  version: 2,
  name: 'JER Alojamento',
  scaleLabels: DEFAULT_SCALE_LABELS,
  sections: [
    { key: 'perfil', label: 'Perfil', order: 1 },
    { key: 'servicos', label: 'Estrutura e Serviços', order: 2 },
    { key: 'avaliacao', label: 'Avaliação Geral', order: 3 },
    { key: 'final', label: 'Finalização', order: 4 },
  ],
  questions: [
    { key: 'idade', section: 'perfil', order: 1, type: 'single_choice', label: 'Idade', required: true,
      options: [
        { value: 'ate_12', label: 'Até 12 anos' }, { value: '13_14', label: '13 a 14 anos' },
        { value: '15_17', label: '15 a 17 anos' }, { value: '18_mais', label: '18 anos ou mais' },
      ] },
    { key: 'sexo', section: 'perfil', order: 2, type: 'single_choice', label: 'Sexo', required: true,
      options: [
        { value: 'feminino', label: 'Feminino' }, { value: 'masculino', label: 'Masculino' },
        { value: 'nao_informado', label: 'Prefiro não informar' },
      ] },
    { key: 'municipio', section: 'perfil', order: 3, type: 'single_choice', label: 'Município de origem', required: true, options: RR_MUNICIPIOS },
    { key: 'tipo', section: 'perfil', order: 4, type: 'single_choice', label: 'Você é', required: true,
      options: [
        { value: 'estudante_atleta', label: 'Estudante/Atleta' }, { value: 'professor', label: 'Professor(a)' },
        { value: 'tecnico', label: 'Técnico(a)/Treinador(a)' }, { value: 'arbitro', label: 'Árbitro(a)' },
        { value: 'outro', label: 'Outro' },
      ] },
    { key: 'tipo_outro', section: 'perfil', order: 5, type: 'text', label: 'Qual? (especifique)', required: true,
      visibleIf: { key: 'tipo', values: ['outro'] } },
    { key: 'alojamento', section: 'servicos', order: 6, type: 'scale', scaleMax: 5, required: true,
      label: 'Como você avalia o alojamento? (limpeza, organização e equipe de apoio)' },
    { key: 'lavanderia', section: 'servicos', order: 7, type: 'scale', scaleMax: 5, required: true,
      label: 'Gostou da lavanderia de roupas nos alojamentos?' },
    { key: 'lavanderia_feedback', section: 'servicos', order: 8, type: 'text', required: false, maxLength: 500,
      label: 'Fale um pouco mais sobre sua nota, como podemos melhorar?', visibleIf: { key: 'lavanderia', values: [1, 2, 3] } },
    { key: 'alimentacao', section: 'servicos', order: 9, type: 'scale', scaleMax: 5, required: true,
      label: 'Como você avalia a alimentação oferecida? (quantidade e cardápio)' },
    { key: 'kit_higiene', section: 'servicos', order: 10, type: 'boolean', required: true,
      label: 'Você recebeu o kit de higiene?' },
    { key: 'kit_higiene_nota', section: 'servicos', order: 11, type: 'scale', scaleMax: 5, required: true,
      label: 'Como você avalia o kit de higiene recebido?', visibleIf: { key: 'kit_higiene', values: [true] } },
    { key: 'organizacao', section: 'avaliacao', order: 12, type: 'scale', scaleMax: 5, required: true,
      label: 'Como você avalia a organização dos Jogos Escolares?' },
    { key: 'estrutura', section: 'avaliacao', order: 13, type: 'scale', scaleMax: 5, required: true,
      label: 'Como você avalia a estrutura do evento? (local, equipamentos e espaços)' },
    { key: 'gostando', section: 'avaliacao', order: 14, type: 'scale', scaleMax: 5, required: true,
      label: 'De 0 a 5, quanto você está gostando dos Jogos Escolares?' },
    { key: 'participaria', section: 'final', order: 15, type: 'boolean', required: true,
      label: 'Você participaria novamente dos Jogos Escolares?' },
    { key: 'feedback', section: 'final', order: 16, type: 'text', required: false, maxLength: 500,
      label: 'Espaço livre para feedback sobre o evento (até 50 palavras)' },
  ],
};

export interface PesquisaPreset {
  id: string;
  name: string;
  description: string;
  config: PesquisaConfig;
}

export const PESQUISA_PRESETS: PesquisaPreset[] = [
  {
    id: 'jer_alojamento',
    name: 'JER Alojamento',
    description: 'Formulário completo dos Jogos Escolares (perfil + alojamento, alimentação, kit, avaliação geral).',
    config: DEFAULT_CONFIG,
  },
];

/** Extrai um PesquisaConfig v2 do valor bruto do banco; cai no default se não for v2. */
export function coerceConfig(raw: unknown): PesquisaConfig {
  return isConfigV2(raw) ? (raw as PesquisaConfig) : DEFAULT_CONFIG;
}
