import { describe, it, expect } from 'vitest';
import { crossTabsByProfile, dimensionQuestions, scaleQuestionsOf, type SurveyRow } from './aggregate';
import type { PesquisaConfig } from './config';

const config: PesquisaConfig = {
  version: 2,
  sections: [
    { key: 'perfil', label: 'Perfil', order: 1 },
    { key: 'aval', label: 'Avaliação', order: 2 },
  ],
  questions: [
    { key: 'idade', section: 'perfil', order: 1, type: 'single_choice', label: 'Idade',
      options: [{ value: 'ate_12', label: 'Até 12' }, { value: '18_mais', label: '18+' }] },
    { key: 'municipio', section: 'perfil', order: 2, type: 'single_choice', label: 'Município',
      options: [{ value: 'boa_vista', label: 'Boa Vista' }, { value: 'canta', label: 'Cantá' }] },
    { key: 'nota', section: 'aval', order: 3, type: 'scale', scaleMax: 5, label: 'Nota geral' },
    { key: 'limpeza', section: 'aval', order: 4, type: 'scale', scaleMax: 5, label: 'Limpeza (banheiros)?' },
  ],
};

const mkRow = (id: string, answers: SurveyRow['answers']): SurveyRow => ({
  id, client_uuid: id, researcher_id: 'r', event_id: 'e', mode: 'entrevista',
  collected_at: '2026-07-01T12:00:00Z', application_location: null, answers,
});

const surveys: SurveyRow[] = [
  mkRow('1', { idade: 'ate_12', municipio: 'boa_vista', nota: 5, limpeza: 4 }),
  mkRow('2', { idade: 'ate_12', municipio: 'boa_vista', nota: 3, limpeza: 2 }),
  mkRow('3', { idade: '18_mais', municipio: 'canta', nota: 4, limpeza: 4 }),
];

describe('scaleQuestionsOf / dimensionQuestions', () => {
  it('picks scale questions in order', () => {
    expect(scaleQuestionsOf(config).map((q) => q.key)).toEqual(['nota', 'limpeza']);
  });
  it('uses perfil single_choice as dimensions', () => {
    expect(dimensionQuestions(config).map((q) => q.key)).toEqual(['idade', 'municipio']);
  });
  it('returns [] without config', () => {
    expect(dimensionQuestions(null)).toEqual([]);
    expect(scaleQuestionsOf(null)).toEqual([]);
  });
});

describe('crossTabsByProfile', () => {
  it('builds one cross-tab per dimension, rows sorted by count desc', () => {
    const cts = crossTabsByProfile(surveys, config);
    expect(cts.map((c) => c.key)).toEqual(['idade', 'municipio']);

    const idade = cts[0];
    // ate_12 (2 respostas) antes de 18_mais (1)
    expect(idade.rows.map((r) => r.value)).toEqual(['ate_12', '18_mais']);

    const ate12 = idade.rows[0];
    expect(ate12.count).toBe(2);
    // média nota = (5+3)/2 = 4 ; média limpeza = (4+2)/2 = 3
    expect(ate12.perScale.nota).toBe(4);
    expect(ate12.perScale.limpeza).toBe(3);
    // média geral = (4+3)/2 = 3.5 ; satisfação = média(4/5, 3/5)=0.7 -> 70%
    expect(ate12.overallAvg).toBe(3.5);
    expect(ate12.satisfactionPct).toBe(70);
  });

  it('omits options with no responses', () => {
    const cts = crossTabsByProfile(surveys, config);
    const municipio = cts.find((c) => c.key === 'municipio')!;
    expect(municipio.rows.map((r) => r.value).sort()).toEqual(['boa_vista', 'canta']);
  });

  it('returns [] without config or without surveys', () => {
    expect(crossTabsByProfile(surveys, null)).toEqual([]);
    expect(crossTabsByProfile([], config)).toEqual([]);
  });

  it('handles a subgroup missing a scale answer (null cell, excluded from averages)', () => {
    const partial = [
      mkRow('a', { idade: 'ate_12', nota: 4 }), // sem limpeza
    ];
    const idade = crossTabsByProfile(partial, config).find((c) => c.key === 'idade')!;
    const row = idade.rows[0];
    expect(row.perScale.nota).toBe(4);
    expect(row.perScale.limpeza).toBeNull();
    expect(row.overallAvg).toBe(4); // só a nota entra
    expect(row.satisfactionPct).toBe(80); // 4/5
  });
});
