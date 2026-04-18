# Vercel — Bloqueio de deploy por acesso do autor do commit

## Sintoma

Erro no deploy:

- `The deployment was blocked because the commit author did not have contributing access to the project on Vercel.`
- `The Hobby Plan does not support collaboration for private repositories. Please upgrade to Pro to add team members.`

## Causa raiz

Quando o projeto é **privado** e está no plano **Hobby**, a Vercel não permite colaboração em time para esse cenário. Se o autor do commit não for reconhecido como colaborador válido do projeto na Vercel, o deploy automático é bloqueado.

## Como desbloquear (ordem recomendada)

1. **Upgrade para Vercel Pro** (recomendado)
   - Criar Team na Vercel.
   - Adicionar os contribuidores (mesmo email vinculado ao GitHub).
   - Garantir acesso ao projeto (Project > Settings > Members).

2. **Alternativa sem upgrade imediato**
   - Manter deploy apenas pela conta dona do projeto (owner).
   - Evitar que commits de contas sem acesso disparem deploy automático.

3. **Pipeline com token técnico (service account/owner)**
   - Fazer deploy por CI usando `VERCEL_TOKEN`, `VERCEL_ORG_ID` e `VERCEL_PROJECT_ID` da conta que possui acesso.
   - Isso remove dependência do autor individual do commit para publicar.

## Checklist rápido

- [ ] Repositório privado confirmado.
- [ ] Plano da Vercel verificado (Hobby vs Pro).
- [ ] Emails GitHub/Vercel dos contribuidores alinhados.
- [ ] Membros adicionados ao projeto (se Pro).
- [ ] Se necessário, deploy via token técnico configurado no CI.
