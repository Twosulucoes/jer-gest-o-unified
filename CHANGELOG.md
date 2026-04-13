# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).

## [Unreleased]

### Added
- Geração automática de baterias (heats) para modalidades individuais de família time e mark (Atletismo, Natação, etc.)
- Componente `CentralStructureHeatsTab` com wizard de 3 sub-etapas (Definir → Revisar → Confirmar)
- `useCollectiveStepStatus` agora suporta bloqueio de passos para individuais time/mark
- Documentação completa do projeto (README, /docs, CHANGELOG, CONTRIBUTING)

### Changed
- Labels de credenciamento padronizados ("Registrar presença", "Emitir credencial")

### Fixed
- Unificação de `credential_code` e `qr_code_value` em utilitário centralizado
- Confirmação modal em ações batch de credenciamento

### Security
- RLS habilitado em 100% das tabelas (41/41)
- 13 triggers de validação de integridade referencial

---

## Convenção de Registro

Ao registrar mudanças, use o módulo como prefixo:

```
### Added
- **[Credenciamento]** Link direto para página do participante na listagem
- **[Competição]** Página de agenda visual de partidas

### Fixed
- **[Alimentação]** Constraint de duplicidade em consumo por janela
```

### Categorias

| Seção | Quando usar |
|-------|------------|
| `Added` | Funcionalidade nova |
| `Changed` | Alteração em funcionalidade existente |
| `Deprecated` | Funcionalidade marcada para remoção |
| `Removed` | Funcionalidade removida |
| `Fixed` | Correção de bug |
| `Security` | Correção ou melhoria de segurança |
