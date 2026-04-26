/**
 * Fonte única de verdade para as exceções da regra "toda página PWA
 * operacional deve renderizar PwaRefreshButton".
 *
 * Consumido por:
 *   - scripts/audit-pwa-refresh.ts  (auditoria CLI / CI)
 *   - src/test/pwa-refresh-button.test.ts  (teste automatizado)
 *
 * Mantenha qualquer ajuste APENAS aqui — as duas pontas leem deste módulo.
 *
 * REGRA DE NEGÓCIO — Telas isentas
 * --------------------------------
 * O botão de refresh só faz sentido em telas operacionais autenticadas que
 * exibem dados sincronizáveis. Estão isentas, por design:
 *
 *  1. Telas de autenticação / pré-sessão
 *     (Login, Recover, SetPassword) — não há dados a recarregar.
 *  2. Telas utilitárias / status fixo
 *     (AcessoNegado, Debug, Confirmação pós-ação) — conteúdo estático.
 *
 * Para marcar uma nova tela como isenta:
 *   - Adicione o caminho relativo em `EXCEPTIONS`, OU
 *   - Garanta que o nome do arquivo case com algum `EXCEPTION_PATTERNS`.
 */

/** Raízes varridas pela auditoria/teste. */
export const PWA_ROOTS = ["src/pages/pwa", "src/pages/aovivo"] as const;

/** Padrões de nome de arquivo que indicam tela isenta. */
export const EXCEPTION_PATTERNS: RegExp[] = [
  // Autenticação / pré-sessão
  /Login(Page)?\.tsx$/,
  /RecoverPage\.tsx$/,
  /SetPasswordPage\.tsx$/,
  // Utilitárias / status
  /AcessoNegadoPage\.tsx$/,
  /DebugPage\.tsx$/,
  /ConfirmacaoPage\.tsx$/,
];

/** Exceções pontuais por caminho relativo (use somente se não couber em padrão). */
export const EXCEPTIONS: ReadonlySet<string> = new Set<string>([]);

/**
 * Decide se um caminho relativo (ex.: `src/pages/pwa/login/LoginPage.tsx`)
 * está isento da invariante de PwaRefreshButton.
 *
 * Aceita separadores `/` ou `\` (normalizado internamente).
 */
export function isPwaRefreshException(rel: string): boolean {
  const normalized = rel.replace(/\\/g, "/");
  if (EXCEPTIONS.has(normalized)) return true;
  return EXCEPTION_PATTERNS.some((re) => re.test(normalized));
}
