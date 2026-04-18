/**
 * Regulamento JER's 2026 + JERPA — Fonte estruturada
 *
 * Este arquivo é a tradução TS do documento oficial:
 *   docs/regulamento/jer-2026-consolidado.md
 *
 * Use SOMENTE este arquivo como fonte de verdade na UI de /admin/regras.
 * Quando o regulamento mudar:
 *   1) atualize o .md em docs/regulamento/
 *   2) atualize este arquivo
 *   3) (opcional) rode o sincronizador para reescrever sport_event_rules
 *      e event_edition_rules a partir daqui.
 */

export interface KV {
  label: string;
  value: string;
}

export interface ModalidadeRegulamento {
  slug: string;                 // canônico (mesmo usado em sports.slug)
  nome: string;
  bloco: "coletivo" | "combate" | "tempo-marca" | "tecnico" | "paralimpico";
  confederacao: string;
  familia: string;              // family no motor (score|sets|time|mark|combat|ranking)
  formato: string;              // sigla legível (GP+SE, ELIM+REP, RANK, etc.)
  resumo: string;
  atributos: KV[];
  categoriasPeso?: { titulo: string; linhas: KV[] }[];
  desempate?: string[];         // ordem dos critérios
  observacoes?: string[];
  limitesEscola?: { masc?: string; fem?: string; nota?: string };
}

export const EVENTO_INFO = {
  nomeOficial: "53º Jogos Escolares de Roraima (JER's)",
  paralimpico: "1º Jogos Escolares Paralímpicos de Roraima (JERPA)",
  organizador: "IDJUV-RR",
  parceiro: "SEED-RR",
  ano: 2026,
  abertura: "05/07/2026 — Boa Vista/RR",
  sigecom: "https://sigecom.mms.inf.br/login",
};

export const SISTEMAS_DISPUTA: KV[] = [
  { label: "RR", value: "Round Robin (todos contra todos)" },
  { label: "SE", value: "Eliminatório Simples (mata-mata)" },
  { label: "DE", value: "Eliminatório Duplo" },
  { label: "GP+SE", value: "Fase de grupos + eliminatório simples" },
  { label: "GP+DE", value: "Fase de grupos + eliminatório duplo" },
  { label: "SUÍÇO", value: "Sistema Suíço (rodadas calculadas por nº de inscritos)" },
  { label: "RANK", value: "Ranking por tempo/marca (sem confronto direto)" },
  { label: "ELIM+REP", value: "Eliminatório com repescagem (sistema olímpico)" },
];

export const CATEGORIAS_PADRAO = {
  jers: [
    { categoria: "12 a 14 anos", anos: "2012, 2013, 2014", generos: "Masc. e Fem." },
    { categoria: "15 a 17 anos", anos: "2009, 2010, 2011", generos: "Masc. e Fem." },
  ],
  jerpa: [
    { categoria: "11 a 14 anos", anos: "2012–2015", generos: "Masc. e Fem." },
    { categoria: "15 a 17 anos", anos: "2009–2011", generos: "Masc. e Fem." },
  ],
  especiais: [
    { modalidade: "Ginástica Rítmica", categoria: "12–13 anos", anos: "2013, 2014" },
    { modalidade: "Ginástica Rítmica", categoria: "14–15 anos", anos: "2011, 2012" },
    { modalidade: "Natação", categoria: "12–14 anos", anos: "2012–2014" },
    { modalidade: "Natação", categoria: "14–16 anos", anos: "2010–2012" },
    { modalidade: "Natação", categoria: "17 anos", anos: "2009" },
    { modalidade: "Judô", categoria: "12–14 anos", anos: "2012–2014" },
    { modalidade: "Judô", categoria: "15–16 anos", anos: "2010–2012 (excepcionalmente 2009 pode competir, mas não representa em nacionais)" },
    { modalidade: "Wrestling", categoria: "12–14 anos (Infantil)", anos: "2012–2014" },
    { modalidade: "Wrestling", categoria: "14–16 anos (Juvenil)", anos: "2010–2012 (atletas de 17 anos podem competir excepcionalmente, sem direito à vaga nacional)" },
    { modalidade: "Tênis de Mesa", categoria: "12–14 anos", anos: "2012–2014" },
    { modalidade: "Tênis de Mesa", categoria: "14–15 anos", anos: "2011–2012" },
    { modalidade: "Tênis de Mesa", categoria: "16–17 anos", anos: "2009–2010" },
  ],
};

export const PONTUACAO_GERAL = [
  { colocacao: "1º", pontos: 10 },
  { colocacao: "2º", pontos: 8 },
  { colocacao: "3º", pontos: 6 },
  { colocacao: "4º", pontos: 5 },
  { colocacao: "5º", pontos: 4 },
  { colocacao: "6º", pontos: 3 },
  { colocacao: "7º", pontos: 2 },
  { colocacao: "8º", pontos: 1 },
];

export const REGRAS_OPERACIONAIS = {
  wo: [
    { label: "WxO (ausência)", value: "Atleta/equipe não pronta em até 15 min após horário oficial" },
    { label: "WO (recusa)", value: "Não retoma a partida em até 5 min após horário de reinício" },
    { label: "Placar em WO/WxO", value: "Conforme regulamento específico de cada modalidade" },
    { label: "Exceção WxO", value: "Atraso comprovado por transporte oficial do Comitê" },
  ],
  protestos: [
    { label: "Prazo", value: "60 min após término do jogo/prova" },
    { label: "Forma", value: "Por escrito, na Secretaria Geral ou mesa de arbitragem" },
    { label: "Ônus da prova", value: "Exclusivamente do reclamante" },
  ],
  credenciamento: [
    { label: "Credencial", value: "Uso obrigatório, pessoal e intransferível" },
    { label: "Dupla função", value: "Proibida" },
    { label: "Segunda via", value: "3 kg alimento + formulário + documento com foto (até 3h para emissão)" },
    { label: "Adulteração/empréstimo", value: "Recolhimento imediato + encaminhamento à CDE" },
  ],
  pesagem: [
    { label: "Judô", value: "Dia anterior, aferição única, sunga/collant" },
    { label: "Karatê", value: "Data definida pela organização, tolerância 500g, short/blusa" },
    { label: "Taekwondo", value: "Até 2h, direito a 2 tentativas" },
    { label: "Wrestling", value: "2 dias antes, janela 3h, aferição única, tolerância 500g" },
    { label: "Wrestling remoto", value: "Permitida excepcionalmente para atletas do interior (com vídeo)" },
    { label: "Não bater peso", value: "Realocação automática (Judô/Wrestling) ou eliminação (Karatê/TKD)" },
  ],
  suspensoes: [
    { label: "Expulsão/desqualificação", value: "Suspensão automática da partida subsequente na mesma modalidade/categoria/gênero" },
    { label: "Absolvição CDE antes do cumprimento", value: "Suspensão pode ser revertida" },
  ],
};

export const INSCRICOES = {
  periodos: [
    { evento: "JER's", periodo: "16/03/2026 a 26/03/2026" },
    { evento: "JERPA", periodo: "01/04/2026 a 20/04/2026" },
  ],
  limitesAtleta: [
    { regra: "Máx. modalidades individuais", valor: "2" },
    { regra: "Máx. modalidade coletiva", valor: "1" },
    { regra: "JERPA: máx. modalidade", valor: "1" },
  ],
  substituicoes: [
    { regra: "Custo fora do prazo", valor: "3 kg alimento não perecível (exceto sal)" },
    { regra: "Coletivas: máx. substituições", valor: "3 por modalidade por gênero" },
    { regra: "Individuais: prazo", valor: "Até a Reunião Técnica" },
    { regra: "Após Reunião Técnica", valor: "PROIBIDAS (DNS)" },
    { regra: "Atletismo: limite", valor: "50% dos atletas por sexo e categoria" },
    { regra: "Mudanças peso/prova", valor: "Até 48h antes da Reunião Técnica (judô, karatê, natação, TKD, wrestling)" },
  ],
};

export const CALENDARIO = {
  jers: [
    { grupo: "1", modalidades: "Ciclismo", execucao: "30–31/05/2026" },
    { grupo: "2", modalidades: "Atletismo, Judô, Karatê, Taekwondo, Wrestling, Natação, Vôlei de Praia", execucao: "27/06–02/07/2026" },
    { grupo: "3", modalidades: "Badminton, Basquete, Futsal, Futebol, GR, Handebol, TM, Tiro Arco, Voleibol, Xadrez", execucao: "04–13/07/2026" },
  ],
  jerpa: [
    { grupo: "1", modalidades: "Atletismo Paralímpico, Natação Paralímpica, Bocha Paralímpica", execucao: "27/06–02/07/2026" },
    { grupo: "2", modalidades: "Parabadminton, Tênis de Mesa Paralímpico", execucao: "04–13/07/2026" },
  ],
};

// ─── MODALIDADES (24) ───────────────────────────────────────
export const MODALIDADES: ModalidadeRegulamento[] = [
  // ── COLETIVAS ─────────────────────────────────────────────
  {
    slug: "basquete", nome: "Basquetebol", bloco: "coletivo",
    confederacao: "CBB — Regras FIBA", familia: "score", formato: "GP+SE",
    resumo: "Modalidade coletiva com sistema de grupos + eliminatório.",
    limitesEscola: { masc: "12–14: até 10 / 15–17: 8 ou 10", fem: "12–14: até 10 / 15–17: 8 ou 10", nota: "Mínimo 5 para iniciar" },
    atributos: [
      { label: "Duração", value: "4 × 10 min (tempo corrido interrompido)" },
      { label: "Prorrogação", value: "5 min (quantas necessárias)" },
      { label: "Pontuação", value: "Vitória 2 pts · Derrota 1 pt · W.O. 0 pt" },
      { label: "Placar W.O.", value: "20 × 0" },
      { label: "Bola 12–14", value: "Nº 6 (M e F)" },
      { label: "Bola 15–17", value: "Nº 6 (F) · Nº 7 (M)" },
      { label: "Altura cesta", value: "3,05m" },
    ],
    desempate: [
      "Confronto direto entre os empatados",
      "Quociente de pontos (marcados ÷ sofridos) nos jogos entre empatados",
      "Quociente de pontos geral na fase",
      "Maior número de pontos marcados",
      "Sorteio",
    ],
  },
  {
    slug: "futsal", nome: "Futsal", bloco: "coletivo",
    confederacao: "CBFS — Regras FIFA/CBFS", familia: "score", formato: "GP+SE",
    resumo: "Modalidade coletiva — categoria Mirim (12–14) e Infantil (15–17).",
    limitesEscola: { masc: "até 10", fem: "até 10", nota: "Mínimo 6 para iniciar" },
    atributos: [
      { label: "Duração 15–17", value: "2 × 20 min (tempo corrido)" },
      { label: "Duração 12–14", value: "2 × 15 min (tempo corrido)" },
      { label: "Intervalo", value: "5 min" },
      { label: "Prorrogação (final)", value: "2 × 5 min" },
      { label: "Pênaltis", value: "Série de 3 cobranças, depois alternadas" },
      { label: "Pontuação", value: "Vitória 3 · Empate 1 · Derrota 0 · W.O. 0" },
      { label: "Placar W.O.", value: "3 × 0" },
      { label: "Bola", value: "Nº 3 (12–14) · Nº 4 (15–17)" },
    ],
    desempate: [
      "Confronto direto", "Saldo de gols no confronto direto", "Maior nº de gols no confronto direto",
      "Saldo de gols geral", "Maior nº de gols geral",
      "Menor nº de cartões vermelhos", "Menor nº de cartões amarelos", "Sorteio",
    ],
  },
  {
    slug: "futebol", nome: "Futebol de Campo", bloco: "coletivo",
    confederacao: "CBF — Regras FIFA", familia: "score", formato: "GP+SE",
    resumo: "Somente categoria 15–17 anos.",
    limitesEscola: { masc: "até 16", fem: "até 16", nota: "Mínimo 11 para iniciar" },
    atributos: [
      { label: "Duração", value: "2 × 30 min (tempo corrido)" },
      { label: "Intervalo", value: "10 min" },
      { label: "Prorrogação (final)", value: "2 × 10 min" },
      { label: "Pênaltis", value: "Série de 5 cobranças, depois alternadas" },
      { label: "Pontuação", value: "Vitória 3 · Empate 1 · Derrota 0 · W.O. 0" },
      { label: "Placar W.O.", value: "3 × 0" },
    ],
    desempate: [
      "Confronto direto", "Saldo de gols no confronto direto", "Gols marcados no confronto direto",
      "Saldo de gols geral", "Gols marcados geral",
      "Menor nº de cartões vermelhos", "Menor nº de cartões amarelos", "Sorteio",
    ],
  },
  {
    slug: "handebol", nome: "Handebol", bloco: "coletivo",
    confederacao: "CBHB — Regras IHF", familia: "score", formato: "GP+SE",
    resumo: "Todos os jogos devem ter vencedor.",
    limitesEscola: { masc: "12–14: até 12 / 15–17: até 14", fem: "12–14: até 12 / 15–17: até 14", nota: "Mínimo 6 para iniciar" },
    atributos: [
      { label: "Duração", value: "2 × 25 min" },
      { label: "Prorrogação (final)", value: "2 × 5 min" },
      { label: "Pênaltis", value: "Série de 5 cobranças" },
      { label: "Pontuação", value: "Vitória 2 · Empate 1 · Derrota 0 · W.O. 0" },
      { label: "Placar W.O.", value: "5 × 0" },
      { label: "Bola 12–14", value: "H1 (M e F)" },
      { label: "Bola 15–17", value: "H2 (F) · H3 (M)" },
    ],
    desempate: [
      "Confronto direto", "Saldo de gols no confronto direto", "Gols marcados no confronto direto",
      "Saldo de gols geral", "Gols marcados geral", "Sorteio",
    ],
  },
  {
    slug: "volei", nome: "Voleibol", bloco: "coletivo",
    confederacao: "CBV — Regras FIVB", familia: "sets", formato: "GP+SE",
    resumo: "Classificatória melhor de 2 sets; final melhor de 5.",
    limitesEscola: { masc: "até 12", fem: "até 12", nota: "Mínimo 6 para iniciar" },
    atributos: [
      { label: "Classificatória", value: "Melhor de 2 sets (25 pts, vant. 2); tie-break: 1 set de 15" },
      { label: "Fase Final", value: "Melhor de 5 sets (25 pts sets 1–4, 15 pts set 5)" },
      { label: "Pontuação 3×0/3×1", value: "3 pts vencedor · 0 pts perdedor" },
      { label: "Pontuação 3×2", value: "2 pts vencedor · 1 pt perdedor" },
      { label: "W.O. classif.", value: "2 × 0 (25×0/25×0)" },
      { label: "W.O. final", value: "3 × 0 (25×0/25×0/25×0)" },
      { label: "Equipe < 6 atletas", value: "Derrota 2×0 (não exclui)" },
      { label: "Rede 12–14", value: "2,10m (F) · 2,24m (M)" },
      { label: "Rede 15–17", value: "2,24m (F) · 2,43m (M)" },
    ],
    desempate: [
      "Pontos na tabela",
      "Quociente de sets (vencidos ÷ perdidos)",
      "Quociente de pontos (marcados ÷ sofridos)",
      "Confronto direto (repetir critérios 2 e 3)",
      "Sorteio",
    ],
    observacoes: ["Equipe que não perde set/ponto é classificada automaticamente (impossível divisão por zero)."],
  },
  {
    slug: "volei-de-praia", nome: "Vôlei de Praia", bloco: "coletivo",
    confederacao: "CBV — Regras FIVB Beach", familia: "sets", formato: "RR + SE",
    resumo: "Duplas — coletiva (12–14) ou individual (15–17).",
    limitesEscola: { masc: "2–4 atletas (1–2 duplas)", fem: "2–4 atletas (1–2 duplas)" },
    atributos: [
      { label: "Formato", value: "Melhor de 3 sets" },
      { label: "Sets 1–2", value: "21 pts (vant. 2)" },
      { label: "Set 3", value: "15 pts (vant. 2)" },
      { label: "Pontuação", value: "2×0: 3 · 2×1: 2 · 1×2: 1 · 0×2: 0" },
      { label: "Rede 12–14", value: "2,20m (F) · 2,35m (M)" },
      { label: "Rede 15–17", value: "2,24m (F) · 2,43m (M)" },
    ],
    desempate: ["Quociente de sets", "Quociente de pontos", "Sorteio"],
    observacoes: [
      "Dupla impossibilitada por contusão: vencedora 2 pts, perdedora 1 pt; placar 21×0/21×0",
      "Dupla não comparece: vencedora 2 pts, perdedora 0; placar 21×0/21×0",
      "Desistência durante: sets concluídos mantêm placar; sets não disputados = 21×0",
    ],
  },

  // ── COMBATE ───────────────────────────────────────────────
  {
    slug: "judo", nome: "Judô", bloco: "combate",
    confederacao: "CBJ — Regras IJF", familia: "combat", formato: "ELIM+REP",
    resumo: "Sistema olímpico com bronze duplo.",
    limitesEscola: { masc: "10", fem: "10", nota: "1 atleta por categoria de peso" },
    atributos: [
      { label: "Combate", value: "4 min (todas as categorias)" },
      { label: "Vitória por", value: "Ippon · 2 Waza-ari · 3 Shidos do adversário (Hansoku-make)" },
      { label: "Empate", value: "Golden Score (tempo extra ilimitado)" },
      { label: "3º lugar", value: "Bronze duplo" },
      { label: "Graduação 12–14", value: "Faixa azul" },
      { label: "Graduação 15–16", value: "Faixa laranja" },
      { label: "Pesagem", value: "Dia anterior, aferição única (sunga/collant)" },
    ],
    categoriasPeso: [
      {
        titulo: "12 a 14 anos (M e F)",
        linhas: [
          { label: "Super Ligeiro", value: "até 36 kg" },
          { label: "Ligeiro", value: "até 40 kg" },
          { label: "Meio-leve", value: "até 44 kg" },
          { label: "Leve", value: "até 48 kg" },
          { label: "Meio-Médio", value: "até 53 kg" },
          { label: "Médio", value: "até 58 kg" },
          { label: "Meio-pesado", value: "até 64 kg" },
          { label: "Pesado", value: "acima de 64 kg" },
        ],
      },
      {
        titulo: "14 a 16 anos — Feminino",
        linhas: [
          { label: "Super Ligeiro", value: "-40 kg" }, { label: "Ligeiro", value: "-44 kg" },
          { label: "Meio-Leve", value: "-48 kg" }, { label: "Leve", value: "-52 kg" },
          { label: "Meio-Médio", value: "-57 kg" }, { label: "Médio", value: "-63 kg" },
          { label: "Meio-Pesado", value: "-70 kg" }, { label: "Pesado", value: "+70 kg" },
        ],
      },
      {
        titulo: "14 a 16 anos — Masculino",
        linhas: [
          { label: "Super Ligeiro", value: "-50 kg" }, { label: "Ligeiro", value: "-55 kg" },
          { label: "Meio-Leve", value: "-60 kg" }, { label: "Leve", value: "-66 kg" },
          { label: "Meio-Médio", value: "-73 kg" }, { label: "Médio", value: "-81 kg" },
          { label: "Meio-Pesado", value: "-90 kg" }, { label: "Pesado", value: "+90 kg" },
        ],
      },
    ],
  },
  {
    slug: "karate", nome: "Karatê", bloco: "combate",
    confederacao: "CBKC — Regras WKF", familia: "combat", formato: "SE (Kumite) / Eliminatório por notas (Kata)",
    resumo: "Pode inscrever em kata E kumite. 2 terceiros (sem repescagem).",
    limitesEscola: { masc: "10", fem: "10" },
    atributos: [
      { label: "Graduação mínima", value: "6º kyu" },
      { label: "Tolerância pesagem", value: "500g (short + blusa/top)" },
      { label: "Duração Kumite", value: "2 min (Shobu, diferença de 8 pts)" },
      { label: "Pontuações", value: "Sanbon: 3 · Nihon: 2 · Ippon: 1" },
      { label: "Área de luta", value: "8 × 8 m" },
      { label: "Contato Jodan", value: "Superficial (leve toque) em 12–14 e 15–17" },
      { label: "Contato Chudan", value: "Normal" },
      { label: "Mínimo categoria", value: "2 atletas" },
    ],
    categoriasPeso: [
      {
        titulo: "Kumite 12–14",
        linhas: [
          { label: "Masc.", value: "-45 / -52 / -63 / +63 kg" },
          { label: "Fem.", value: "-42 / -47 / -54 / +54 kg" },
        ],
      },
      {
        titulo: "Kumite 15–17",
        linhas: [
          { label: "Masc.", value: "-61 / -68 / -76 / +76 kg" },
          { label: "Fem.", value: "-48 / -53 / -59 / +59 kg" },
        ],
      },
    ],
  },
  {
    slug: "taekwondo", nome: "Taekwondo", bloco: "combate",
    confederacao: "CBTKD — Regras WT", familia: "combat", formato: "ELIM+REP",
    resumo: "12–14: chute na cabeça PROIBIDO · 15–17: PERMITIDO.",
    limitesEscola: { masc: "10", fem: "10", nota: "Até 4 atletas por categoria de peso" },
    atributos: [
      { label: "Graduação 12–14", value: "Máx. 3º GUB (faixa azul ponta vermelha)" },
      { label: "Graduação 15–17", value: "Mín. 4º GUB (faixa azul clara)" },
      { label: "Duração 12–14", value: "2 rounds × 2 min, intervalo 1 min" },
      { label: "Duração 15–17", value: "3 rounds × 2 min, intervalo 1 min" },
      { label: "Pontuações", value: "Soco tronco 1 · Chute tronco 2 · Chute cabeça 3 · Giro tronco 4 · Giro cabeça 5" },
      { label: "Penalidade", value: "Gam-jeom -1 pt" },
      { label: "Vitória", value: "Maior pontuação · RSC (sup. 20 pts) · Nocaute" },
      { label: "Empate", value: "Golden Point" },
      { label: "Pesagem", value: "Direito a 2 pesagens" },
    ],
    categoriasPeso: [
      {
        titulo: "12 a 14 anos",
        linhas: [
          { label: "Fem.", value: "≤37 / ≤44 / ≤51 / ≤59 / >59 kg" },
          { label: "Masc.", value: "≤37 / ≤45 / ≤53 / ≤61 / >61 kg" },
        ],
      },
      {
        titulo: "15 a 17 anos",
        linhas: [
          { label: "Fem.", value: "≤44 / ≤49 / ≤55 / ≤63 / >63 kg" },
          { label: "Masc.", value: "≤48 / ≤55 / ≤63 / ≤73 / >73 kg" },
        ],
      },
    ],
    observacoes: ["Poomsae: 8º ao 3º GUB; se apenas 1 atleta na categoria, executa como exibição."],
  },
  {
    slug: "wrestling", nome: "Wrestling (Luta Olímpica)", bloco: "combate",
    confederacao: "CBW — Regras UWW", familia: "combat", formato: "ELIM+REP",
    resumo: "Estilos: Livre M, Livre F, Greco-Romano M.",
    limitesEscola: { masc: "10", fem: "10", nota: "1 atleta por categoria de peso por estilo" },
    atributos: [
      { label: "Sub-14", value: "2 × 2 min, intervalo 30s" },
      { label: "Sub-16", value: "2 × 3 min, intervalo 30s" },
      { label: "Sup. técnica Livre", value: "10 pts" },
      { label: "Sup. técnica Greco", value: "8 pts" },
      { label: "Pesagem", value: "2 dias antes, janela 3h, tolerância 500g" },
      { label: "Não bater peso", value: "Realocação automática se houver categoria compatível" },
      { label: "Pesagem remota", value: "Permitida excepcionalmente para interior (com vídeo)" },
      { label: "Chave 2 atletas", value: "Melhor de 3 combates" },
      { label: "Chave 3–4", value: "Round Robin" },
      { label: "Chave 5–8", value: "Eliminatório com repescagem" },
      { label: "Chave 9+", value: "Eliminatório com repescagem e chaves" },
    ],
    desempate: [
      "Maior número de vitórias",
      "Maior número de vitórias por superioridade técnica",
      "Maior número de vitórias por encostamento (fall)",
      "Maior diferença de pontos técnicos",
      "Menor número de pontos técnicos sofridos",
    ],
  },

  // ── TEMPO/MARCA ───────────────────────────────────────────
  {
    slug: "atletismo", nome: "Atletismo", bloco: "tempo-marca",
    confederacao: "CBAt — World Athletics", familia: "time", formato: "RANK",
    resumo: "Máx. 3 provas individuais + revezamento por atleta.",
    limitesEscola: { masc: "12 por categoria", fem: "12 por categoria", nota: "Máx. 2 atletas por prova" },
    atributos: [
      { label: "Substituição após RT", value: "PROIBIDA (DNS)" },
      { label: "Atleta em prova combinada", value: "Só pode ter revezamento como 2ª prova" },
    ],
    observacoes: [
      "12–14 M/F: 80m, 150m, 800m, 2.000m, 5×80m, marcha (5km M/3km F), saltos altura/distância, peso (4kg M/3kg F), dardo (600g M/400g F), disco (1kg M/700g F), Tetratlo",
      "15–17: 100m, 200m, 400m, 800m, 3.000m, 110m c/ barreiras (M)/100m c/ barr. (F), 4×100m, marcha 5km, saltos altura/distância/triplo (M), peso (5kg M/3kg F), dardo (700g M/500g F), disco (1,5kg M/1kg F), Pentatlo",
    ],
  },
  {
    slug: "natacao", nome: "Natação", bloco: "tempo-marca",
    confederacao: "CBDA — World Aquatics", familia: "time", formato: "RANK (séries → final)",
    resumo: "Piscina 50m, mín. 6 raias.",
    limitesEscola: { masc: "10", fem: "10", nota: "Até 6 provas individuais + revezamentos no programa total; máx. 4 individuais por etapa" },
    atributos: [
      { label: "12–14", value: "Borb/Costas/Peito 50m e 100m · Livre 50/100/200/400 · Medley 100/200 · Revezamentos 4×50" },
      { label: "14–16", value: "Borb/Costas/Peito 50/100/200 · Livre 50/100/200/400/800F ou 1500M · Medley 200/400 · Revezamentos 4×100" },
      { label: "17", value: "Mesmo programa do 14–16" },
    ],
  },
  {
    slug: "ciclismo", nome: "Ciclismo", bloco: "tempo-marca",
    confederacao: "FCR — Regras UCI", familia: "time", formato: "RANK (menor tempo)",
    resumo: "Contrarrelógio e/ou Circuito (MTB XCO ou Estrada).",
    limitesEscola: { masc: "3", fem: "3" },
    atributos: [
      { label: "Bicicleta", value: "MTB ou estrada, peso mín. 6,8 kg" },
      { label: "Proibido", value: "Guidão clipe, rodas carbono, rodas fechadas, capacetes aero" },
      { label: "Rodas", value: "Tradicionais raiadas alumínio, mín. 16 raios" },
      { label: "Concentração", value: "60 min antes da largada" },
      { label: "Empate", value: "Menor tempo no último setor cronometrado" },
    ],
  },
  {
    slug: "aguas-abertas", nome: "Águas Abertas", bloco: "tempo-marca",
    confederacao: "CBDA — World Aquatics", familia: "time", formato: "RANK (menor tempo)",
    resumo: "Categorias 12–14, 14–16, 17 anos.",
    atributos: [],
  },

  // ── TÉCNICOS ──────────────────────────────────────────────
  {
    slug: "badminton", nome: "Badminton", bloco: "tecnico",
    confederacao: "CBBd — Regras BWF", familia: "sets", formato: "GP+SE (ou RR)",
    resumo: "Simples M/F + Duplas M/F + Mistas.",
    limitesEscola: { masc: "4", fem: "4" },
    atributos: [
      { label: "Formato", value: "Melhor de 3 games" },
      { label: "Game", value: "Até 21 pts (vant. 2; limite 30×29)" },
      { label: "Pontuação grupos", value: "Vitória 2 · Derrota 1 · W.O. 0" },
      { label: "Tolerância início", value: "15 min" },
      { label: "Classif. municipais", value: "4 primeiros em simples" },
      { label: "Classif. capital", value: "8 primeiros em simples" },
    ],
    desempate: ["Confronto direto", "Quociente de games", "Quociente de pontos", "Sorteio"],
  },
  {
    slug: "tenis-de-mesa", nome: "Tênis de Mesa", bloco: "tecnico",
    confederacao: "CBTM — Regras ITTF", familia: "sets", formato: "GP+SE (ou RR)",
    resumo: "Individual + Equipe.",
    limitesEscola: { masc: "4", fem: "4" },
    atributos: [
      { label: "Individual", value: "Melhor de 5 games a 11 pts (vant. 2)" },
      { label: "Equipe", value: "Melhor de 5 games" },
      { label: "Pontuação grupos", value: "Vitória 2 · Derrota 1 · W.O. 0" },
      { label: "Grupos classif.", value: "Mín. 3, máx. 4 atletas" },
      { label: "Fase Ouro", value: "2 primeiros de cada grupo" },
      { label: "Fase Prata", value: "Demais atletas" },
    ],
    desempate: ["Confronto direto", "Quociente de games", "Quociente de pontos", "Sorteio"],
  },
  {
    slug: "tiro-com-arco", nome: "Tiro com Arco", bloco: "tecnico",
    confederacao: "CBTARCO — World Archery", familia: "ranking", formato: "Ranking Round → SE (Set System)",
    resumo: "Somente 12–14 anos. Arco Recurvo, Individual.",
    limitesEscola: { masc: "4", fem: "4" },
    atributos: [
      { label: "Round Indoor", value: "60 flechas a 18m, face 40cm full, 2 rounds × 10 séries × 3 flechas" },
      { label: "Tempo por série", value: "1 min 30 seg" },
      { label: "Eliminatória", value: "Set System: 2 pts por set vencido, 1 pt empate" },
      { label: "Vitória", value: "Primeiro a 6 pts · Shoot-off se empate 5×5" },
    ],
  },
  {
    slug: "xadrez", nome: "Xadrez", bloco: "tecnico",
    confederacao: "CBX — Regras FIDE", familia: "ranking", formato: "Suíço",
    resumo: "Mirim 12–14 · Infantil 15–17.",
    limitesEscola: { masc: "4", fem: "4", nota: "Coordenação pode autorizar adicionais" },
    atributos: [
      { label: "Pontuação por partida", value: "Vitória 1 · Empate 0,5 · Derrota 0" },
      { label: "Controle de tempo", value: "Rápido: 15 min + 10 seg/lance" },
    ],
    desempate: [
      "Buchholz (soma dos pontos dos adversários)",
      "Buchholz cortado (menor resultado excluído)",
      "Sonneborn-Berger",
      "Número de vitórias",
      "Confronto direto",
      "Sorteio",
    ],
  },
  {
    slug: "ginastica-ritmica", nome: "Ginástica Rítmica", bloco: "tecnico",
    confederacao: "CBG — Regras FIG", familia: "ranking", formato: "Pontuação acumulada",
    resumo: "Somente feminino — Segunda Divisão (JEBs).",
    limitesEscola: { fem: "12–13: até 4 / 14–15: até 3" },
    atributos: [
      { label: "Pontuação", value: "Nota Dificuldade (D) + Execução (E) − penalidades" },
      { label: "Aparelhos", value: "Arco e Maças (ambas categorias)" },
      { label: "Ordem", value: "Sorteio" },
    ],
    desempate: [
      "Maior nota de Dificuldade acumulada",
      "Maior nota de Execução acumulada",
      "Menor penalidade acumulada",
    ],
  },

  // ── PARALÍMPICAS ──────────────────────────────────────────
  {
    slug: "atletismo-paralimpico", nome: "Atletismo Paralímpico", bloco: "paralimpico",
    confederacao: "CBCA — World Para Athletics", familia: "time", formato: "Série classif. → final por classe funcional",
    resumo: "Menor tempo (pista) · Maior marca (campo).",
    limitesEscola: { masc: "até 12", fem: "até 12" },
    atributos: [
      { label: "Atleta-guia", value: "Permitido nas classes T11–T12" },
      { label: "Empate", value: "Ambos recebem mesma medalha" },
      { label: "Classes pista (T)", value: "T11–T13 (visual), T20 (intelectual), T31–T54, T61–T64, RR1–RR3" },
      { label: "Classes campo (F)", value: "F11–F13, F20, F31–F54 (mesma lógica)" },
      { label: "Provas pista", value: "75m, 100m, 150m, 200m, 400m, 800m, 2.000m, 3.000m + Salto distância" },
      { label: "Provas campo", value: "Peso, dardo, disco, club" },
    ],
  },
  {
    slug: "natacao-paralimpica", nome: "Natação Paralímpica", bloco: "paralimpico",
    confederacao: "CBCA — World Para Swimming", familia: "time", formato: "Série classif. → final por classe funcional",
    resumo: "Classes S1–S14 (físico, visual, intelectual).",
    limitesEscola: { masc: "10", fem: "10" },
    atributos: [
      { label: "Toque parede", value: "Adaptado (S11–S13: tappers)" },
    ],
  },
  {
    slug: "tenis-de-mesa-paralimpico", nome: "Tênis de Mesa Paralímpico", bloco: "paralimpico",
    confederacao: "CBTM — Regras ITTF Para", familia: "sets", formato: "GP+SE por classe funcional",
    resumo: "Cadeirantes 1–2 / 3–5 · Andantes 6–8 / 9–10 · Intelectual 11.",
    limitesEscola: { masc: "até 6", fem: "até 6", nota: "2 andantes + 2 cadeirantes + 2 intelectuais por gênero" },
    atributos: [
      { label: "Classificatória", value: "Melhor de 3 sets a 11 pts (vant. 2)" },
      { label: "Eliminatória", value: "Melhor de 5 sets a 11 pts (vant. 2)" },
    ],
  },
  {
    slug: "parabadminton", nome: "Parabadminton", bloco: "paralimpico",
    confederacao: "CBBd — Regras BWF Para", familia: "sets", formato: "GP+SE por classe funcional",
    resumo: "Simples M/F (sem duplas).",
    limitesEscola: { masc: "até 20", fem: "até 20" },
    atributos: [
      { label: "Formato", value: "Melhor de 3 games a 21 pts (vant. 2; limite 30×29)" },
      { label: "Grupos", value: "Mín. 3, máx. 4 atletas" },
      { label: "Classes", value: "WH (cadeira) · SL (membro inferior) · SU (membro superior) · SH (baixa estatura) · SI (intelectual)" },
    ],
    observacoes: [
      "Poucas inscrições: classes podem ser combinadas (exceto SH).",
      "1 atleta em classe: combinação entre gêneros possível com aprovação da Comissão Técnica.",
    ],
  },
  {
    slug: "bocha-paralimpica", nome: "Bocha Paralímpica", bloco: "paralimpico",
    confederacao: "ABBC — Regras BISFed", familia: "score", formato: "GP+SE por classe funcional",
    resumo: "Classes BC1, BC2, BC3, BC4.",
    limitesEscola: { masc: "até 4", fem: "até 4" },
    atributos: [
      { label: "Individual", value: "4 ends" },
      { label: "Pontuação por end", value: "Bolas do vencedor mais próximas ao jack" },
      { label: "Empate", value: "End extra (golden end)" },
      { label: "Cadeira de rodas", value: "Altura máx. 66 cm (exceto BC3)" },
      { label: "Calhas/rampas", value: "Box 2,5m × 1,0m; sem mira/freio/propulsão mecânica" },
    ],
  },
];

export const PREMIACAO = [
  { tipo: "Troféu", coletivas: "1º, 2º e 3º (equipe)", individuais: "—" },
  { tipo: "Medalha", coletivas: "Atletas + técnico das 3 primeiras", individuais: "1º, 2º e 3º por prova/categoria" },
  { tipo: "Lutas (com repescagem)", coletivas: "—", individuais: "2 bronzes (perdedores das semis)" },
];

export const SEM_NACIONAL = [
  { categoria: "15–17 anos", modalidades: "Futebol, Karatê, Xadrez" },
  { categoria: "12–14 anos", modalidades: "Tiro com Arco, Águas Abertas" },
];

export const SELECAO_ESTADUAL = {
  intro: "Coletivas 15–17 — convocação:",
  linhas: [
    { total: "Número par", campea: "50%", seletiva: "50%" },
    { total: "Número ímpar", campea: "40%", seletiva: "60%" },
  ],
  notas: [
    "Técnico da campeã é convidado para Comissão Técnica Estadual",
    "JERPA: sem etapa classificatória — somente Fase Final em Boa Vista",
  ],
};

export const CLASSIFICACAO_FUNCIONAL = [
  { tipo: "Visual", documentacao: "Laudo oftalmológico", processo: "Enviado no link de inscrição" },
  { tipo: "Intelectual (Down / CID F70-79)", documentacao: "Diagnóstico CID F70-79 ou Q90", processo: "Enviado no link de inscrição" },
  { tipo: "Física", documentacao: "Laudo médico + banca presencial", processo: "Banca CRP/UERR" },
];
