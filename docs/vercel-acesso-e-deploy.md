# Vercel — Acesso e Deploy

Guia rápido para publicar o JER Gestão na Vercel como alternativa/complemento ao deploy nativo do Lovable.

## Pré-requisitos

- Repositório GitHub conectado (use **Export to GitHub** no editor do Lovable).
- Conta na Vercel (gratuita serve para staging).
- Variáveis de ambiente do Supabase já configuradas no projeto (publishable key + URL).

## Passo a passo

1. **Importar projeto** em https://vercel.com/new selecionando o repositório.
2. **Framework preset**: Vite (auto-detectado).
3. **Build command**: `npm run build` (padrão).
4. **Output directory**: `dist` (padrão Vite).
5. **Environment variables**: copie as chaves do `.env` local (apenas as `VITE_*` — nunca segredos privados).
6. Clique em **Deploy**.

## SPA Rewrite (obrigatório)

Como o app usa `react-router-dom`, é preciso reescrever todas as rotas para `index.html`. Crie `vercel.json` na raiz:

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

## Domínio customizado

Em **Settings → Domains** adicione o domínio próprio. A Vercel emite TLS automaticamente via Let's Encrypt.

## Acesso de equipe

- **Owner / Admin**: gerencia billing e domínios.
- **Member**: faz deploys e revê preview URLs.
- **Viewer**: apenas leitura.

Convide pelo painel `Settings → Members`.

## Preview Deployments

Cada PR no GitHub gera um preview URL único. Útil para validar refinos de UX/PWA antes do merge na branch principal.

## Observações

- **Service Worker / PWA**: não habilitar no preview do Lovable; em produção (Vercel) funciona normalmente.
- **Edge Functions** continuam no Supabase — Vercel hospeda apenas o frontend.
- Para variáveis sensíveis (chaves admin Supabase), **nunca** commitar — use o painel de env vars da Vercel marcando como `Sensitive`.
