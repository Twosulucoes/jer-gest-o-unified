# Guia de Verificação Manual: Fluxo de Redirecionamento PWA

Este guia descreve os passos para validar manualmente que as rotas do PWA estão protegidas e redirecionam corretamente, evitando loops de navegação.

## 1. Verificação de Acesso Sem Evento Selecionado
**Objetivo:** Garantir que o usuário seja levado à configuração se tentar acessar um módulo sem um evento ativo.

1.  Faça login no sistema.
2.  Se já tiver um evento selecionado, vá para `/pwa/configuracao` e remova a seleção (ou limpe o localStorage/cookies se aplicável).
3.  Tente acessar diretamente a URL: `https://[sua-url]/pwa/coordenacao-tecnica/incidentes`.
4.  **Resultado Esperado:** Você deve ser redirecionado instantaneamente para `/pwa/configuracao` com a mensagem de que um evento é necessário.

## 2. Verificação de Acesso Sem Etapa (Stage) Selecionada
**Objetivo:** Garantir que o usuário seja levado à configuração se tiver um evento, mas nenhuma etapa ativa.

1.  Selecione um evento em `/pwa/configuracao`.
2.  Certifique-se de que **nenhuma etapa** está selecionada.
3.  Tente acessar: `https://[sua-url]/pwa/coordenacao-tecnica/incidentes`.
4.  **Resultado Esperado:** Você deve ser redirecionado para `/pwa/configuracao` com a indicação de que uma etapa é necessária.

## 3. Prevenção de Loop de Redirecionamento
**Objetivo:** Garantir que a página de configuração em si não tente redirecionar para ela mesma.

1.  Estando em `/pwa/configuracao` sem evento/etapa.
2.  Observe se a página carrega corretamente e permite as seleções.
3.  **Resultado Esperado:** A página deve permanecer estável (sem recarregamentos infinitos ou mensagens de erro de redirecionamento).

## 4. Fluxo de Pós-Login
**Objetivo:** Garantir que o redirecionamento após o login respeite o estado do PWA.

1.  Faça logout.
2.  Tente acessar `https://[sua-url]/pwa/coordenacao-tecnica/incidentes` (estando deslogado).
3.  Você será levado ao `/login`.
4.  Realize o login.
5.  **Resultado Esperado:**
    *   Se você **não** tinha evento/etapa selecionados antes, deve ir para `/pwa/configuracao`.
    *   Se você **já tinha** evento/etapa configurados, deve ir para a rota original solicitada.

## 5. Rotas de Exceção
**Objetivo:** Validar que rotas que não exigem etapa (como `/pwa/install`) funcionam sem redirecionamento.

1.  Acesse `https://[sua-url]/pwa/install`.
2.  **Resultado Esperado:** A página deve abrir normalmente, mesmo sem evento ou etapa selecionados.
