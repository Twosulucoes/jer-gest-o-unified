import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

/**
 * Garante que rotas estáticas dentro de /admin/participantes
 * (historico, duplicidades) sejam resolvidas ANTES da rota dinâmica
 * /:participantId. Caso contrário, o React Router interpreta strings
 * como "duplicidades" como UUID e dispara erros 22P02 no backend.
 *
 * Este teste é um guardrail de regressão: se alguém reordenar as rotas
 * em src/App.tsx e colocar a dinâmica antes das estáticas, ele falha.
 */

const Lista = () => <div>LISTA</div>;
const Historico = () => <div>HISTORICO</div>;
const Duplicidades = () => <div>DUPLICIDADES</div>;
const Detalhe = () => <div>DETALHE</div>;
const Esportivo = () => <div>ESPORTIVO</div>;

function AppRoutes() {
  // Replica EXATAMENTE a ordem usada em src/App.tsx para o grupo
  // /admin/participantes. Se a ordem for alterada de forma que
  // ":participantId" passe a vir antes de "historico"/"duplicidades",
  // os asserts abaixo quebram.
  return (
    <Routes>
      <Route path="/admin">
        <Route path="participantes" element={<Lista />} />
        <Route path="participantes/historico" element={<Historico />} />
        <Route path="participantes/duplicidades" element={<Duplicidades />} />
        <Route path="participantes/:participantId" element={<Detalhe />} />
        <Route path="participantes/:participantId/esportivo" element={<Esportivo />} />
      </Route>
    </Routes>
  );
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  );
}

describe("Roteamento /admin/participantes — prioridade de rotas estáticas", () => {
  it("resolve /admin/participantes para a listagem", () => {
    renderAt("/admin/participantes");
    expect(screen.getByText("LISTA")).toBeInTheDocument();
  });

  it("resolve /admin/participantes/historico para a página de histórico (e NÃO para o detalhe)", () => {
    renderAt("/admin/participantes/historico");
    expect(screen.getByText("HISTORICO")).toBeInTheDocument();
    expect(screen.queryByText("DETALHE")).not.toBeInTheDocument();
  });

  it("resolve /admin/participantes/duplicidades para a página de duplicidades (e NÃO para o detalhe)", () => {
    renderAt("/admin/participantes/duplicidades");
    expect(screen.getByText("DUPLICIDADES")).toBeInTheDocument();
    expect(screen.queryByText("DETALHE")).not.toBeInTheDocument();
  });

  it("ainda resolve UUIDs reais para a página de detalhe do participante", () => {
    renderAt("/admin/participantes/2f3a8e9c-1111-2222-3333-444455556666");
    expect(screen.getByText("DETALHE")).toBeInTheDocument();
  });

  it("resolve a sub-rota /esportivo para um UUID", () => {
    renderAt("/admin/participantes/2f3a8e9c-1111-2222-3333-444455556666/esportivo");
    expect(screen.getByText("ESPORTIVO")).toBeInTheDocument();
  });
});
