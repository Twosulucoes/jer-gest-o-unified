const BASE_URL = "https://adm.jers.com.br";

const PRIMARY_COLOR = "#0B2B5A";
const ACCENT_COLOR = "#0BA3A3";
const PRIMARY_FOREGROUND = "#ffffff";

function buildHtml(opts: {
  title: string;
  greeting: string;
  body: string;
  cta: string;
  link: string;
}) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${opts.title}</title>
</head>
<body style="margin:0;padding:0;background-color:#F6F8FC;font-family:'Inter',Arial,Helvetica,sans-serif;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#F6F8FC;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:16px;border:1px solid #E2E8F0;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg, ${PRIMARY_COLOR} 0%, #0F5AA6 50%, ${ACCENT_COLOR} 100%);padding:28px 32px;text-align:center;">
              <h1 style="margin:0;font-size:22px;font-weight:700;color:${PRIMARY_FOREGROUND};letter-spacing:0.5px;font-family:'Montserrat',Arial,sans-serif;">JER's Gestão</h1>
              <p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,0.85);font-weight:400;">Jogos Escolares de Roraima</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px 32px 24px;">
              <p style="margin:0 0 16px;font-size:16px;color:#0B1220;font-weight:600;">${opts.greeting}</p>
              <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#64748B;">${opts.body}</p>
              <!-- CTA Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto;">
                <tr>
                  <td style="border-radius:12px;background:linear-gradient(135deg, #0F5AA6 0%, ${ACCENT_COLOR} 100%);">
                    <a href="${opts.link}" target="_blank" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;color:${PRIMARY_FOREGROUND};text-decoration:none;border-radius:12px;">${opts.cta}</a>
                  </td>
                </tr>
              </table>
              <!-- Fallback link -->
              <p style="margin:24px 0 0;font-size:12px;line-height:1.5;color:#94a3b8;word-break:break-all;">
                Se o botão não funcionar, copie e cole este link no navegador:<br/>
                <a href="${opts.link}" style="color:#0F5AA6;text-decoration:underline;">${opts.link}</a>
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;border-top:1px solid #E2E8F0;background-color:#F6F8FC;">
              <p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8;text-align:center;">
                Se você não solicitou esta ação, ignore este e-mail.<br/>
                © JER's Gestão — Jogos Escolares de Roraima
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export interface EmailTemplate {
  id: string;
  label: string;
  subject: string;
  html: string;
  text: string;
}

export const EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: "confirm",
    label: "Confirmar E-mail",
    subject: "JER's Gestão — Confirme seu e-mail",
    html: buildHtml({
      title: "Confirme seu e-mail",
      greeting: "Olá!",
      body: "Para ativar seu acesso ao <strong>JER's Gestão</strong>, confirme seu endereço de e-mail clicando no botão abaixo.",
      cta: "Confirmar e-mail",
      link: "{{ .ConfirmationURL }}",
    }),
    text: `Olá!

Para ativar seu acesso ao JER's Gestão, confirme seu endereço de e-mail acessando o link abaixo:

{{ .ConfirmationURL }}

Se você não solicitou esta ação, ignore este e-mail.

— JER's Gestão · Jogos Escolares de Roraima`,
  },
  {
    id: "magic-link",
    label: "Link de Acesso (Magic Link)",
    subject: "JER's Gestão — Link de acesso",
    html: buildHtml({
      title: "Link de acesso",
      greeting: "Olá!",
      body: "Você solicitou um link de acesso ao <strong>JER's Gestão</strong>. Este link é pessoal e temporário — <strong>não compartilhe</strong> com outras pessoas.",
      cta: "Acessar agora",
      link: "{{ .MagicLink }}",
    }),
    text: `Olá!

Você solicitou um link de acesso ao JER's Gestão. Este link é pessoal e temporário — não compartilhe com outras pessoas.

{{ .MagicLink }}

Se você não solicitou esta ação, ignore este e-mail.

— JER's Gestão · Jogos Escolares de Roraima`,
  },
  {
    id: "recovery",
    label: "Redefinir Senha",
    subject: "JER's Gestão — Redefinição de senha",
    html: buildHtml({
      title: "Redefinição de senha",
      greeting: "Olá!",
      body: "Recebemos uma solicitação para redefinir a senha da sua conta no <strong>JER's Gestão</strong>. Clique no botão abaixo para criar uma nova senha.",
      cta: "Redefinir senha",
      link: "{{ .RecoveryURL }}",
    }),
    text: `Olá!

Recebemos uma solicitação para redefinir a senha da sua conta no JER's Gestão. Acesse o link abaixo para criar uma nova senha:

{{ .RecoveryURL }}

Se você não solicitou esta ação, ignore este e-mail.

— JER's Gestão · Jogos Escolares de Roraima`,
  },
  {
    id: "invite",
    label: "Convite de Acesso",
    subject: "JER's Gestão — Convite de acesso",
    html: buildHtml({
      title: "Convite de acesso",
      greeting: "Olá!",
      body: "Você foi convidado(a) para acessar o <strong>JER's Gestão</strong> — sistema dos Jogos Escolares de Roraima. Clique no botão abaixo para aceitar o convite e configurar sua conta.",
      cta: "Aceitar convite",
      link: "{{ .InviteURL }}",
    }),
    text: `Olá!

Você foi convidado(a) para acessar o JER's Gestão — sistema dos Jogos Escolares de Roraima. Acesse o link abaixo para aceitar o convite e configurar sua conta:

{{ .InviteURL }}

Se você não reconhece este convite, ignore este e-mail.

— JER's Gestão · Jogos Escolares de Roraima`,
  },
];

export const SUPABASE_CHECKLIST = `## Como configurar no Supabase

### 1. Authentication → URL Configuration
- **Site URL:** ${BASE_URL}
- **Additional Redirect URLs:**
  - ${BASE_URL}/**
  - ${BASE_URL}/auth/callback
  - ${BASE_URL}/reset-senha
  - ${BASE_URL}/confirmar-email
  - ${BASE_URL}/convite

### 2. Authentication → Email Templates
Para cada template abaixo, copie o **Subject**, o **HTML Body** e o **Message** (texto puro) e cole na aba correspondente do Supabase:

- **Confirm signup** → Template "Confirmar E-mail"
- **Magic Link** → Template "Link de Acesso"
- **Reset Password** → Template "Redefinir Senha"
- **Invite** → Template "Convite de Acesso"
`;
