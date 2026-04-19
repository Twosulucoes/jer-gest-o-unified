# Refinamentos UX/UI — Telas PWA

Este documento descreve os refinamentos transversais aplicados às telas operacionais do PWA (Transporte, Alimentação, Alojamento) para melhorar a experiência dos operadores em campo.

## 1. Modo contínuo de scan

Telas afetadas:
- `/pwa/transporte/scan`
- `/pwa/alimentacao/scan`

Quando habilitado, o scanner reabre automaticamente após cada leitura bem-sucedida ou com erro, evitando que o operador toque no botão "Escanear" entre cada credencial. Ideal para filas longas de embarque ou entrada de refeitório.

A preferência é persistida por usuário em `localStorage` (`pwaScan:prefs:{module}:{userId}`), de modo que cada operador mantém sua configuração mesmo após reload da PWA.

## 2. Delay de reabertura configurável

Quando o modo contínuo está ativo, o operador pode escolher o tempo entre leituras:

| Opção   | Delay   | Quando usar                                     |
|---------|---------|------------------------------------------------|
| Rápido  | 0,3 s   | Filas muito ágeis (operador experiente)        |
| Normal  | 0,45 s  | Padrão recomendado                              |
| Calmo   | 0,8 s   | Permite confirmação visual antes do próximo    |
| Lento   | 1,5 s   | Treinamento ou auditoria pontual                |

## 3. Telemetria local

Cada tela de scan exibe contadores do dia:
- **Total** de leituras
- **OK** (sucesso)
- **Erro** (credencial inválida, duplicidade, falha técnica)

Os contadores são reiniciados automaticamente à meia-noite (data muda) e podem ser zerados manualmente pelo botão de reset. Tudo é client-side — não há envio para o backend nesta camada.

## 4. Padronização de mensagens de erro

Mensagens unificadas via helper `getErrorMessage(err)` que extrai `err.message` de `Error` ou retorna `"desconhecido"`. Evita exibição de `[object Object]` ou stacks.

## 5. Componentes/Utilitários introduzidos

- `src/lib/pwaScan.ts` — preferências e telemetria (load/save/bump/reset).
- `src/components/pwa/ScanPreferencesPanel.tsx` — painel reutilizável (modo contínuo + delay + contadores).

Para adicionar a um novo módulo PWA basta importar o painel, instanciar `loadScanPreferences/Telemetry` no estado e chamar `bumpScanTelemetry` em cada outcome.
