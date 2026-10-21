# DECISÕES — Registro de decisões técnicas

> **Documento vivo.** Cada decisão técnica relevante ganha uma entrada com contexto, decisão, motivo e consequências.
> Decisões não são apagadas: quando mudar de ideia, crie uma nova entrada que **substitui** a anterior e marque a
> antiga como `Substituída por D-xxx`. Decisões que dependem do responsável pelo projeto ficam como `Proposta`
> até a resposta dele.

| Status possível | Significado |
|---|---|
| `Aceita` | Em vigor |
| `Proposta` | Aguardando decisão do responsável |
| `Substituída por D-xxx` | Não vale mais |

---

## D-001

**Documentação viva em `docs/` com quatro arquivos** · 2026-10-14 · Aceita

- **Contexto:** havia 55+ documentos em `docs/`, vários duplicados ou desatualizados, pendências espalhadas em 6+
  arquivos e um `CHANGELOG.md` na raiz parado em maio/2026.
- **Decisão:** a fonte de verdade do estado do sistema passa a ser `docs/AUDITORIA.md` (estado), `docs/ROADMAP.md`
  (fila de trabalho), `docs/CHANGELOG.md` (o que mudou e por quê) e `docs/DECISOES.md` (este arquivo). O
  `CHANGELOG.md` da raiz fica congelado como histórico até 2026-10-14; não é apagado. Os demais docs continuam como
  referência temática e são consolidados pela tarefa R-046.
- **Motivo:** um lugar só para estado e fila evita que cada sessão redescubra pendências; preservar o histórico segue
  a regra do projeto de aproveitar o que existe.
- **Consequências:** toda entrega atualiza ROADMAP + CHANGELOG + seção da AUDITORIA juntos (regra no `CLAUDE.md`).

## D-002

**IDs estáveis para achados e tarefas** · 2026-10-14 · Aceita

- **Decisão:** achados usam prefixo por área (`FE-`, `DB-`, `LIVE-`, `EF-`, `SEC-`, `INF-`, `QA-`, `DOC-`, `DOC-P`) e
  tarefas usam `R-` com numeração sequencial. IDs nunca são reaproveitados nem renumerados; itens resolvidos ou
  cancelados mudam de status e ficam no documento.
- **Motivo:** permitir referência cruzada estável entre AUDITORIA, ROADMAP, CHANGELOG, commits e PRs.

## D-003

**Como medir o percentual de conclusão** · 2026-10-14 · Aceita

- **Decisão:** dois indicadores, sempre lado a lado:
  1. **Cobertura funcional** = média dos módulos da AUDITORIA §2, com pesos Pronto 1,0 · Pronto/Parcial 0,85 ·
     Parcial 0,6 · Quebrado/Bloqueado 0,3 · Pendente/desligado 0,1. Recalculada quando o status de um módulo muda.
  2. **Prontidão para lançamento** = tarefas concluídas das Fases 0–2 do ROADMAP ÷ total dessas fases.
- **Motivo:** o sistema tem muita funcionalidade operando (o primeiro número mostra isso), mas não pode ser lançado
  enquanto os bloqueantes estiverem abertos (o segundo mostra isso). Um número único esconderia um dos dois fatos.
- **Valores em 2026-10-14:** cobertura funcional ≈ 61 %; prontidão 0/28.

## D-004

**Banco de produção é a referência quando diverge do repositório** · 2026-10-14 · Aceita

- **Contexto:** migrations do repositório não batem com o histórico aplicado (LIVE-01), há migrations nunca aplicadas
  (LIVE-03) e objetos que só existem em produção (DB-10).
- **Decisão:** achados de banco são confirmados contra prod sempre que possível e marcados com `prod:` na evidência.
  Até a tarefa R-011 (baseline), nenhuma migration é aplicada em prod sem antes comparar com o estado real do objeto.
- **Motivo:** corrigir a partir do repositório sem olhar prod pode reintroduzir ou apagar objetos em uso.

## D-005

**Segredos e dados pessoais nunca entram nos documentos** · 2026-10-14 · Aceita

- **Decisão:** chaves, tokens, telefones, CPFs e afins aparecem como `<redigido>` na AUDITORIA, no ROADMAP, em
  commits e em PRs. A evidência aponta o arquivo e a linha, não o valor.
- **Motivo:** o repositório está público (DOC-01) e, mesmo privado, documentos são copiados para fora com facilidade.

## D-006

**Publicação da auditoria enquanto o repositório for público** · 2026-10-14 · Aceita (2026-10-21)

- **Contexto:** a AUDITORIA descreve vulnerabilidades ainda abertas (funções do banco e Edge Functions sem
  autenticação, tomada de conta). Com o repositório público, publicar a branch expõe esse mapa a qualquer pessoa.
- **Proposta original:** só enviar a branch e abrir o PR depois que o repositório estiver privado (R-001).
- **Decisão (2026-10-21):** o responsável pelo projeto pediu para publicar mesmo com o repositório público
  ("Publica assim mesmo"). Risco aceito por ele: o mapa de vulnerabilidades abertas fica visível no GitHub.
- **Consequências:** a urgência da Fase 0 aumenta. R-001 (tornar o repositório privado) segue recomendado, e as
  correções de R-003 a R-006 passam a ser as primeiras a executar. Segredos e PII continuam redigidos ([D-005](#d-005)).

## D-007

**Documentos vivos fora do bundle do app** · 2026-10-14 · Aceita

- **Contexto:** `src/pages/super/DocumentationPage.tsx` usa `import.meta.glob("/**/*.md", { eager: true })`, que embute
  todo `.md` do repositório num chunk JS servido publicamente pelo site, mesmo com a rota `/super/documentacao` protegida
  (INF-16).
- **Decisão:** excluir `docs/AUDITORIA.md`, `docs/ROADMAP.md`, `docs/CHANGELOG.md` e `docs/DECISOES.md` do glob.
  A restrição geral do glob continua na tarefa R-041.
- **Motivo:** sem isso, o merge desta auditoria publicaria o mapa de vulnerabilidades abertas no site de produção.
- **Verificação:** `vite build` e busca nos chunks gerados: nenhum contém trechos desses quatro arquivos.
