# CHANGELOG — Registro vivo de mudanças

> **Documento vivo.** Toda entrega registra aqui uma entrada datada: **o que mudou e por quê**, com os IDs do
> [ROADMAP](./ROADMAP.md) e dos achados da [AUDITORIA](./AUDITORIA.md) afetados e a evidência de verificação.
> Entradas mais novas no topo. Não reescreva entradas antigas; corrija com uma entrada nova.
>
> O histórico anterior a 2026-10-14 está no [`CHANGELOG.md` da raiz](../CHANGELOG.md) (congelado, ver [D-001](./DECISOES.md#d-001)).

## Formato da entrada

```
## AAAA-MM-DD — título curto
- Tarefas: R-xxx (status anterior → novo)
- Achados: FE-xx, DB-xx … (status anterior → novo)
- O que mudou: arquivos/migrations/configs
- Por quê: motivo em uma ou duas frases
- Verificação: comando, teste, consulta ou PR que comprova
- Novas descobertas: achados/tarefas abertos durante o trabalho (ou "nenhuma")
```

---

## 2026-10-14 — Auditoria inicial e criação da documentação viva

- **Tarefas:** criado o ROADMAP com 54 tarefas (R-001 a R-054) em 6 fases; nenhuma concluída.
- **Achados:** registrados na AUDITORIA 36 de frontend (FE-01..36), 25 de banco (DB-01..25), 7 só visíveis no banco ao vivo
  (LIVE-01..07), 14 de Edge Functions (EF-01..14), 12 de segurança (SEC-01..12), 18 de infraestrutura (INF-01..18),
  6 de qualidade (QA-01..06), 3 de documentação (DOC-01..03) e 24 pendências herdadas de docs antigos (DOC-P01..P24).
- **O que mudou:**
  - `docs/AUDITORIA.md`, `docs/ROADMAP.md`, `docs/CHANGELOG.md`, `docs/DECISOES.md` criados.
  - `CLAUDE.md`: nova seção "Documentação viva (obrigatório)" com as regras de manutenção.
  - `src/pages/super/DocumentationPage.tsx`: os quatro documentos vivos saem do `import.meta.glob`, para não irem ao
    bundle público do site ([D-007](./DECISOES.md#d-007)). Única mudança de código; nenhuma migration ou configuração
    de runtime foi alterada.
- **Por quê:** servir de base para o planejamento de finalização, num formato que evolui com cada entrega
  em vez de um relatório estático.
- **Verificação:**
  - Código @ `8e802ac`: `npm ci` ok; `tsc --noEmit -p tsconfig.app.json` 65 erros; `eslint .` 2.548 problemas;
    `vitest run` 29/223 falhando; `vite build` ok; `npm audit --omit=dev` 41 vulnerabilidades.
  - Após a mudança no glob: `vite build` ok, nenhum chunk em `dist/assets` contém texto dos documentos vivos;
    `vitest` e `tsc` com os mesmos números da linha de base (sem regressão).
  - Supabase prod `dfzjrijdcskncrwaiykr`: advisors de segurança e performance, `pg_policies`, `pg_proc`,
    `has_function_privilege('anon', …)`, `cron.job`, `storage.buckets`, `supabase_migrations.schema_migrations`,
    contagens de tabelas e logs das últimas 24 h.
  - GitHub: visibilidade do repositório (público) e últimos runs de Actions em `main`.
- **Novas descobertas:** todas registradas na AUDITORIA. As que exigem ação imediata estão na Fase 0 do ROADMAP
  (repositório público com PII, RPCs e tabelas abertas a anon, tomada de conta em `admin-users`).
