# Links Externos — Distribuição de Acessos

## O que são Links Externos

Links Externos são **URLs curtas com QR Code** que o cliente usa para distribuir acesso aos módulos PWA para operadores de campo. Ideal para compartilhar via WhatsApp, email ou SMS.

Exemplo: `https://seudominio.com/go/motoristas` → redireciona para `/pwa/transporte`

---

## Como Criar um Link

1. Acesse **Acessos → Links Externos** no menu admin
2. Clique em **Novo Link**
3. Preencha o wizard:
   - **Módulo destino**: escolha entre Transporte, Alimentação, Alojamento, Coordenação, Delegação ou Ao Vivo
   - **Título**: nome descritivo (ex: "Acesso Motoristas JER 2026")
   - **Slug** (opcional): texto personalizado para a URL (ex: `motoristas` → `/go/motoristas`). Se vazio, gera automaticamente
   - **Expiração** (opcional): data limite. Se vazio, nunca expira
4. Clique em **Criar**
5. O sistema gera:
   - URL curta copiável
   - QR Code para download (PNG)
   - Preview do link

---

## Como Compartilhar

### Via WhatsApp
1. Na lista de links, clique em **Copiar Link**
2. Abra o WhatsApp e cole no chat do grupo de operadores
3. Envie com uma mensagem como: "Clique no link abaixo para acessar o módulo de Transporte. Use o email e senha que você recebeu por email."

### Via Email
1. Copie o link e cole no corpo do email
2. Ou baixe o QR Code (PNG) e anexe ao email

### Via SMS
1. Copie o link e envie por SMS

### Impressão com QR Code
1. Baixe o QR Code em PNG
2. Imprima e distribua em papel para operadores

---

## Como Editar

1. Na lista de links, clique no botão de edição do link
2. Altere título, slug ou expiração
3. Salve — a URL é atualizada automaticamente

---

## Como Desativar/Ativar

1. Na lista de links, use o **toggle de status** (ativo/inativo)
2. Link inativo: mostra mensagem "Este link foi desativado" quando acessado
3. Reative a qualquer momento com o toggle

---

## Como Funciona para o Operador

1. Operador recebe o link via WhatsApp
2. Clica no link → abre `/go/:slug`
3. Sistema verifica se link é válido e ativo
4. Redireciona para `/pwa/login` (se não autenticado)
5. Após login, redireciona automaticamente para o módulo do perfil
6. Operador trabalha no módulo isolado (sem acesso a outros módulos)

---

## Estados do Link

| Status | Comportamento |
|--------|--------------|
| **Ativo** | Redireciona normalmente |
| **Inativo** | Mostra "Este link foi desativado" |
| **Expirado** | Mostra "Este link expirou" |
| **Slug inválido** | Mostra página 404 |

---

## Exemplos de Uso

| Cenário | Título sugerido | Slug | Módulo |
|---------|----------------|------|--------|
| Motoristas do evento | "Acesso Motoristas JER 2026" | `motoristas` | Transporte |
| Equipe do refeitório | "Alimentação — Refeitório Central" | `refeitorio` | Alimentação |
| Porteiros do alojamento | "Alojamento — Check-in" | `checkin-alojamento` | Alojamento |
| Chefes de delegação | "Portal da Delegação" | `delegacao` | Delegação |
| Coordenadores técnicos | "Coordenação Técnica" | `coord-tecnica` | Coordenação |
