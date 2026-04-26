import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Lint estrutural: lê src/App.tsx e garante que, dentro do grupo
 * /admin/participantes, as rotas estáticas (historico, duplicidades)
 * estejam DECLARADAS antes da rota dinâmica :participantId.
 *
 * Em React Router v6 a ordem de declaração não é o que decide o match
 * (o ranking é por especificidade), MAS manter a ordem correta evita
 * confusão e protege contra refactors que troquem o paradigma.
 */
describe("App.tsx — ordem de rotas /admin/participantes", () => {
  const src = readFileSync(resolve(__dirname, "../../App.tsx"), "utf8");

  const idxHistorico = src.indexOf('path="participantes/historico"');
  const idxDuplicidades = src.indexOf('path="participantes/duplicidades"');
  const idxDinamica = src.indexOf('path="participantes/:participantId"');

  it("declara as três rotas no arquivo", () => {
    expect(idxHistorico).toBeGreaterThan(-1);
    expect(idxDuplicidades).toBeGreaterThan(-1);
    expect(idxDinamica).toBeGreaterThan(-1);
  });

  it("declara participantes/historico antes de participantes/:participantId", () => {
    expect(idxHistorico).toBeLessThan(idxDinamica);
  });

  it("declara participantes/duplicidades antes de participantes/:participantId", () => {
    expect(idxDuplicidades).toBeLessThan(idxDinamica);
  });
});
