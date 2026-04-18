const BASE_URL = "https://adm.jers.com.br";

const PRIMARY_COLOR = "#0B2B5A";
const ACCENT_COLOR = "#0F5AA6";
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
<body style="margin:0;padding:0;background-color:#F6F8FC;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#F6F8FC;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:16px;border:1px solid #E2E8F0;overflow:hidden;">
          <tr>
            <td style="background-color:${PRIMARY_COLOR};padding:28px 32px;text-align:center;">
              <h1 style="margin:0;font-size:22px;font-weight:700;color:${PRIMARY_FOREGROUND};letter-spacing:0.5px;">JER's Gestão</h1>
              <p style="margin:4px 0 0;font-size:13px;color:#E2E8F0;font-weight:400;">Jogos Escolares de Roraima</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 32px 24px;">
              <p style="margin:0 0 16px;font-size:16px;color:#0B1220;font-weight:600;">${opts.greeting}</p>
              <p style="margin:0 0 28px;font-size:15px;line-height:1.6;color:#475569;">${opts.body}</p>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:0 auto;">
                <tr>
                  <td align="center" style="border-radius:12px;background-color:${ACCENT_COLOR};">
                    <a href="${opts.link}" target="_blank" style="display:inline-block;padding:14px 36px;font-size:15px;font-weight:600;color:${PRIMARY_FOREGROUND};text-decoration:none;border-radius:12px;">${opts.cta}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;border-top:1px solid #E2E8F0;background-color:#F6F8FC;">
              <p style="margin:0;font-size:12px;line-height:1.5;color:#94A3B8;text-align:center;">
                © ${new Date().getFullYear()} JER's Gestão — Jogos Escolares de Roraima
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
    subject: "JER's Gestão — Confirmação de cadastro",
    html: buildHtml({
      title: "Confirmação de cadastro",
      greeting: "Olá,",
      body: "Recebemos seu cadastro no <strong>JER's Gestão</strong>. Para concluir, confirme seu endereço de e-mail no botão abaixo.",
      cta: "Confirmar cadastro",
      link: "{{ .ConfirmationURL }}",
    }),
    text: `Olá,

Recebemos seu cadastro no JER's Gestão. Para concluir, confirme seu endereço de e-mail acessando:

{{ .ConfirmationURL }}

— JER's Gestão · Jogos Escolares de Roraima`,
  },
  {
    id: "magic-link",
    label: "Link de Acesso (Magic Link)",
    subject: "JER's Gestão — Seu acesso ao sistema",
    html: buildHtml({
      title: "Acesso ao sistema",
      greeting: "Olá,",
      body: "Conforme solicitado, segue o acesso à sua conta no <strong>JER's Gestão</strong>. O endereço abaixo é de uso individual.",
      cta: "Entrar no sistema",
      link: "{{ .MagicLink }}",
    }),
    text: `Olá,

Conforme solicitado, segue o acesso à sua conta no JER's Gestão. O endereço abaixo é de uso individual:

{{ .MagicLink }}

— JER's Gestão · Jogos Escolares de Roraima`,
  },
  {
    id: "recovery",
    label: "Redefinir Senha",
    subject: "JER's Gestão — Atualização de senha",
    html: buildHtml({
      title: "Atualização de senha",
      greeting: "Olá,",
      body: "Recebemos um pedido para atualizar a senha da sua conta no <strong>JER's Gestão</strong>. Use o botão abaixo para definir uma nova.",
      cta: "Definir nova senha",
      link: "{{ .RecoveryURL }}",
    }),
    text: `Olá,

Recebemos um pedido para atualizar a senha da sua conta no JER's Gestão. Use o endereço abaixo para definir uma nova:

{{ .RecoveryURL }}

— JER's Gestão · Jogos Escolares de Roraima`,
  },
  {
    id: "invite",
    label: "Convite de Acesso",
    subject: "JER's Gestão — Acesso ao sistema",
    html: buildHtml({
      title: "Acesso ao sistema",
      greeting: "Olá,",
      body: "Sua conta no <strong>JER's Gestão</strong> — sistema dos Jogos Escolares de Roraima — foi criada. Use o botão abaixo para configurar seu acesso.",
      cta: "Configurar acesso",
      link: "{{ .InviteURL }}",
    }),
    text: `Olá,

Sua conta no JER's Gestão — sistema dos Jogos Escolares de Roraima — foi criada. Use o endereço abaixo para configurar seu acesso:

{{ .InviteURL }}

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

### 3. Importante (SMTP padrão do Supabase)
O SMTP gratuito do Supabase tem filtro anti-spam que pode bloquear palavras como "clique aqui", "ative seu acesso", "link temporário", "não compartilhe", URLs duplicadas no corpo, etc. Os templates acima já estão ajustados. Para produção, configure um **SMTP próprio** (Resend, SendGrid, etc.) em Auth → SMTP Settings para evitar limites e bloqueios.
`;
