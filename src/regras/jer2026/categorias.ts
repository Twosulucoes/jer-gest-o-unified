import type { CategoriaEtaria } from "./types";

/**
 * Categorias etárias JER 2026 (seção 3 do regulamento consolidado).
 * Slugs são chaves canônicas — NÃO ALTERAR sem migration.
 */
export const CATEGORIAS_JER2026: CategoriaEtaria[] = [
  // 3.1 JER's padrão
  {
    slug: "jers-12-14",
    nome: "12 a 14 anos",
    min_ano_nascimento: 2012,
    max_ano_nascimento: 2014,
    naipes: ["Masculino", "Feminino"],
  },
  {
    slug: "jers-15-17",
    nome: "15 a 17 anos",
    min_ano_nascimento: 2009,
    max_ano_nascimento: 2011,
    naipes: ["Masculino", "Feminino"],
  },

  // 3.2 JERPA padrão
  {
    slug: "jerpa-11-14",
    nome: "11 a 14 anos (JERPA)",
    min_ano_nascimento: 2012,
    max_ano_nascimento: 2015,
    naipes: ["Masculino", "Feminino"],
  },
  {
    slug: "jerpa-15-17",
    nome: "15 a 17 anos (JERPA)",
    min_ano_nascimento: 2009,
    max_ano_nascimento: 2011,
    naipes: ["Masculino", "Feminino"],
  },

  // 3.3 Especiais
  {
    slug: "gr-12-13",
    nome: "Ginástica Rítmica 12–13",
    min_ano_nascimento: 2013,
    max_ano_nascimento: 2014,
    naipes: ["Feminino"],
    exclusiva_para: ["ginastica-ritmica"],
  },
  {
    slug: "gr-14-15",
    nome: "Ginástica Rítmica 14–15",
    min_ano_nascimento: 2011,
    max_ano_nascimento: 2012,
    naipes: ["Feminino"],
    exclusiva_para: ["ginastica-ritmica"],
  },
  {
    slug: "nat-12-14",
    nome: "Natação 12–14",
    min_ano_nascimento: 2012,
    max_ano_nascimento: 2014,
    naipes: ["Masculino", "Feminino"],
    exclusiva_para: ["natacao"],
  },
  {
    slug: "nat-14-16",
    nome: "Natação 14–16",
    min_ano_nascimento: 2010,
    max_ano_nascimento: 2012,
    naipes: ["Masculino", "Feminino"],
    exclusiva_para: ["natacao"],
  },
  {
    slug: "nat-17",
    nome: "Natação 17",
    min_ano_nascimento: 2009,
    max_ano_nascimento: 2009,
    naipes: ["Masculino", "Feminino"],
    exclusiva_para: ["natacao"],
  },
  {
    slug: "judo-12-14",
    nome: "Judô 12–14",
    min_ano_nascimento: 2012,
    max_ano_nascimento: 2014,
    naipes: ["Masculino", "Feminino"],
    exclusiva_para: ["judo"],
  },
  {
    slug: "judo-15-16",
    nome: "Judô 15–16",
    min_ano_nascimento: 2010,
    max_ano_nascimento: 2012,
    naipes: ["Masculino", "Feminino"],
    exclusiva_para: ["judo"],
  },
  {
    slug: "wrestling-12-14",
    nome: "Wrestling Infantil 12–14",
    min_ano_nascimento: 2012,
    max_ano_nascimento: 2014,
    naipes: ["Masculino", "Feminino"],
    exclusiva_para: ["wrestling"],
  },
  {
    slug: "wrestling-14-16",
    nome: "Wrestling Juvenil 14–16",
    min_ano_nascimento: 2010,
    max_ano_nascimento: 2012,
    naipes: ["Masculino", "Feminino"],
    exclusiva_para: ["wrestling"],
  },
  {
    slug: "tm-12-14",
    nome: "Tênis de Mesa 12–14",
    min_ano_nascimento: 2012,
    max_ano_nascimento: 2014,
    naipes: ["Masculino", "Feminino"],
    exclusiva_para: ["tenis-de-mesa"],
  },
  {
    slug: "tm-14-15",
    nome: "Tênis de Mesa 14–15",
    min_ano_nascimento: 2011,
    max_ano_nascimento: 2012,
    naipes: ["Masculino", "Feminino"],
    exclusiva_para: ["tenis-de-mesa"],
  },
  {
    slug: "tm-16-17",
    nome: "Tênis de Mesa 16–17",
    min_ano_nascimento: 2009,
    max_ano_nascimento: 2010,
    naipes: ["Masculino", "Feminino"],
    exclusiva_para: ["tenis-de-mesa"],
  },
];

export const ALIASES_CATEGORIAS: Record<string, string> = {
  "12 A 14": "jers-12-14",
  "12-14": "jers-12-14",
  "12/14": "jers-12-14",
  "MIRIM": "jers-12-14",
  "15 A 17": "jers-15-17",
  "15-17": "jers-15-17",
  "15/17": "jers-15-17",
  "INFANTIL": "jers-15-17",
  "11-14": "jerpa-11-14",
  "11 A 14": "jerpa-11-14",
  "11/14": "jerpa-11-14",
  "JERPA 11-14": "jerpa-11-14",
  "JERPA 15-17": "jerpa-15-17",
  "SUB-14": "jers-12-14",
  "SUB-17": "jers-15-17",
  "SUB 14": "jers-12-14",
  "SUB 17": "jers-15-17",
};
