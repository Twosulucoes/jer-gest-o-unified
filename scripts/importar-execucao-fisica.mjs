#!/usr/bin/env node
/**
 * Importador da planilha "Modelo de Execução Física das Metas".
 * Lê o arquivo .xlsx preenchido pelo gestor e gera o SQL de carga no BD:
 *   - Aba "4. Modalidades x Sedes"  -> public.event_stage_sports (sync por evento)
 *   - Aba "2. Meta 1 – Delegações"  -> public.osc_meta_targets (valor_executado, por etapa)
 *   - Aba "3. Meta 2 – Competições" -> public.osc_meta_targets (valor_executado, global)
 *
 * Uso:
 *   node scripts/importar-execucao-fisica.mjs <arquivo.xlsx> > carga.sql
 * Depois revise carga.sql e aplique no banco.
 *
 * Observação: a aba de modalidades é aplicada em modo SYNC — o que estiver
 * marcado na planilha passa a ser a verdade (linhas de origem cronograma/planilha
 * do evento são substituídas). As metas são upsert (não apagam o previsto).
 */
import ExcelJS from 'exceljs';

const EVENT_ID = 'de0cd62b-05b9-4147-9257-9543d61d5739'; // 53º JER's e 1º JERPA 2026

const STAGE = {
  '01': '523c1148-b7ba-408b-87cc-7eddcd398bf2', '02': 'eed3d459-c6d7-478c-b339-8dd9333dd3e8',
  '03': 'e398f9d2-4faa-4e50-bd1d-ab80f935eb9e', '04': 'b3c61dea-3492-4f8a-8f9c-5e5226f1d7c6',
  '05': '5c53fa71-c6b6-4a35-b14d-eb4d4891adec', '06': '014641c9-ee48-4ee8-9556-5f9fc6bdf186',
  '07': '58c8ea06-4652-4099-8aed-c05b0838a7d1', '08': '72aa8663-dca8-46e4-9a10-f134bb5b3acc',
  '09': 'fda9a42e-3c9a-425a-8a09-1e599468afcd', '10': '718a60e7-24d0-4ad1-bd18-197660cc43f0',
  'F1': '7cb1f2f2-11de-414c-b252-cdd5da0dbb6d',
};
const F2 = { jers: '524f74d8-bc06-43a7-bbfd-69883d412a66', jerpa: 'e440e659-6592-4cb2-8b22-65d4d6a95723' };
const F3 = { jers: 'e17788df-e08f-4031-bb10-f1a57a759f81', jerpa: 'a5309136-5f60-42b7-8dc1-2df37e538fc8' };

// modalidade (texto da coluna "Modalidade (cronograma)") -> { ol: id olímpico, pa: id paralímpico }
const SP = {
  'Vôlei de Praia': { ol: '9c09d1b8-bbe9-40d1-b76f-ca40d8be23ac' },
  'Futsal': { ol: '4660d7c2-a066-450a-8b23-70425e5ee4de' },
  'Futebol': { ol: 'b806d4cd-0184-4c0e-96be-20788573c10c' },
  'Vôlei de Quadra': { ol: '9471e34c-8f8d-446a-b625-8b552cd5da3b' },
  'Ciclismo': { ol: 'aa009bf0-0933-4294-acad-75c870635870' },
  'Basquete': { ol: 'f0fcdbd8-1c96-4b29-b780-40643a209356' },
  'Handebol': { ol: '249f1878-5480-418c-a242-44128cba653e' },
  'Atletismo': { ol: 'f254c254-6289-4e98-86f3-d9d268c32a82', pa: '03950e1d-fbcf-4853-8bb9-1a07beac82d8' },
  'Badminton': { ol: 'b02c8d94-cadf-4b5b-9617-f49cae285329', pa: '98c3ce0b-67f8-4dec-9200-d20d4b4e66f0' },
  'Bocha Paralímpica': { pa: '105cc7cf-9c19-4856-adf5-5f210345a597' },
  'Ginástica Rítmica': { ol: '67691644-91c0-4c36-8c04-dc035f90fa07' },
  'Judô': { ol: '2ab5c34c-42c4-45ca-9a49-6334bcf97ed6' },
  'Karatê': { ol: 'bfbaf85e-b628-4bf4-afe3-e2e55c3010da' },
  'Wrestling': { ol: '3355de46-a854-46eb-82d2-95acbdac5d28' },
  'Natação': { ol: 'cfd26923-2693-4dbe-84ee-fb97d507aeab', pa: 'bf797a25-57b6-40c5-8e89-018d496a7162' },
  'Taekwondo': { ol: '75d38123-7c40-4058-85ac-0288dd6b5917' },
  'Tênis de Mesa': { ol: 'd0b9ca2d-5ab8-4a44-9311-5f0fd9ad1e18', pa: 'cc7f84ad-8830-4fed-9880-d2d3d3a9412e' },
  'Tiro com Arco': { ol: '853d6423-9c8a-40f5-be44-5dab39c80a5f' },
  'Xadrez': { ol: '9f6313ef-950d-45e6-9fec-d6ad6cfc24a2' },
};

const META1 = {
  'Delegações atendidas': ['delegacoes_atendidas', 'delegações'],
  'Atletas alojados': ['atletas_alojados', 'atletas'],
  'Refeições fornecidas': ['refeicoes_fornecidas', 'refeições'],
  'Kits-atleta entregues': ['kits_entregues', 'kits'],
};
const META2 = {
  'Nº de modalidades realizadas': ['modalidades_realizadas', 'modalidades'],
  'Nº de etapas executadas': ['etapas_executadas', 'etapas'],
  'Nº de jogos / provas executados': ['jogos_executados', 'jogos'],
  'Nº de árbitros mobilizados': ['arbitros_mobilizados', 'árbitros'],
  'Nº de profissionais de apoio técnico': ['profissionais_apoio', 'profissionais'],
  'Modalidades paralímpicas (JERPA) realizadas': ['modalidades_jerpa_realizadas', 'modalidades'],
};

const q = (v) => (v == null ? 'null' : `'${String(v).replace(/'/g, "''")}'`);
const num = (v) => {
  if (v == null || v === '') return null;
  if (typeof v === 'object' && 'result' in v) v = v.result; // célula com fórmula
  const n = Number(String(v).replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};
const txt = (c) => (c == null ? '' : (typeof c === 'object' && c.text ? c.text : String(c))).trim();

function colCodeFromHeader(h) {
  const t = txt(h);
  const m = t.match(/^(0\d|10|F\d)/);
  return m ? m[1] : null;
}

async function main() {
  const file = process.argv[2];
  if (!file) { console.error('Uso: node scripts/importar-execucao-fisica.mjs <arquivo.xlsx>'); process.exit(1); }
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);

  const out = [];
  out.push('-- Carga gerada por importar-execucao-fisica.mjs');
  out.push(`-- Arquivo: ${file}  ·  Gerado: ${new Date().toISOString()}`);
  out.push('begin;');

  /* ---- Modalidades x Sedes (SYNC) ---- */
  const mx = wb.getWorksheet('4. Modalidades x Sedes');
  if (mx) {
    const header = mx.getRow(1).values; // [ ,A,B,C,01,02,...]
    const codeByCol = {};
    for (let c = 4; c <= mx.columnCount; c++) {
      const code = colCodeFromHeader(header[c]);
      if (code) codeByCol[c] = code;
    }
    const links = []; // [stage, sport, programa]
    mx.eachRow((row, rn) => {
      if (rn <= 2) return;
      const mod = txt(row.getCell(1).value);
      const sp = SP[mod];
      if (!sp) return;
      for (const [c, code] of Object.entries(codeByCol)) {
        const mark = txt(row.getCell(Number(c)).value).toUpperCase();
        if (mark !== 'X') continue;
        if (code === 'F2') { if (sp.ol) links.push([F2.jers, sp.ol, 'jers']); if (sp.pa) links.push([F2.jerpa, sp.pa, 'jerpa']); }
        else if (code === 'F3') { if (sp.ol) links.push([F3.jers, sp.ol, 'jers']); if (sp.pa) links.push([F3.jerpa, sp.pa, 'jerpa']); }
        else { const st = STAGE[code]; if (st && sp.ol) links.push([st, sp.ol, 'jers']); }
      }
    });
    out.push('');
    out.push('-- event_stage_sports: substitui vínculos de origem cronograma/planilha do evento');
    out.push(`delete from public.event_stage_sports where event_id='${EVENT_ID}' and source in ('cronograma','cronograma (ajustado)','planilha');`);
    if (links.length) {
      const vals = links.map(([s, sp, pr]) => `('${EVENT_ID}','${s}','${sp}','${pr}','planilha')`);
      out.push('insert into public.event_stage_sports (event_id,event_stage_id,sport_id,programa,source) values');
      out.push(vals.join(',\n') + '\non conflict (event_stage_id,sport_id) do nothing;');
    }
  }

  /* ---- Meta 1 (por etapa) ---- */
  const m1 = wb.getWorksheet('2. Meta 1 – Delegações');
  if (m1) {
    const header = m1.getRow(1).values.map(txt);
    const colOf = (label) => header.findIndex((h) => h === label);
    out.push('');
    out.push('-- Meta 1: valor_executado por etapa');
    m1.eachRow((row, rn) => {
      if (rn === 1) return;
      const stage = txt(row.getCell(1).value);
      if (!/^[0-9a-f-]{36}$/i.test(stage)) return; // só linhas com id de etapa
      for (const [label, [key, unidade]] of Object.entries(META1)) {
        const ci = colOf(label);
        if (ci < 1) continue;
        const v = num(row.getCell(ci).value);
        if (v == null) continue;
        out.push(`insert into public.osc_meta_targets (event_id,meta_number,metric_key,event_stage_id,valor_executado,unidade,fonte) ` +
          `values ('${EVENT_ID}',1,${q(key)},'${stage}',${v},${q(unidade)},'planilha') ` +
          `on conflict (event_id,meta_number,metric_key,event_stage_id) where event_stage_id is not null ` +
          `do update set valor_executado=excluded.valor_executado, unidade=excluded.unidade, fonte=excluded.fonte, updated_at=now();`);
      }
    });
  }

  /* ---- Meta 2 (global) ---- */
  const m2 = wb.getWorksheet('3. Meta 2 – Competições');
  if (m2) {
    out.push('');
    out.push('-- Meta 2: valor_executado global');
    m2.eachRow((row, rn) => {
      if (rn === 1) return;
      const ind = txt(row.getCell(1).value);
      const map = META2[ind];
      if (!map) return;
      const v = num(row.getCell(3).value); // coluna "Executado (PREENCHER)"
      if (v == null) return;
      out.push(`insert into public.osc_meta_targets (event_id,meta_number,metric_key,event_stage_id,valor_executado,unidade,fonte) ` +
        `values ('${EVENT_ID}',2,${q(map[0])},null,${v},${q(map[1])},'planilha') ` +
        `on conflict (event_id,meta_number,metric_key) where event_stage_id is null ` +
        `do update set valor_executado=excluded.valor_executado, unidade=excluded.unidade, fonte=excluded.fonte, updated_at=now();`);
    });
  }

  out.push('');
  out.push('commit;');
  process.stdout.write(out.join('\n') + '\n');
}

main().catch((e) => { console.error(e); process.exit(1); });
