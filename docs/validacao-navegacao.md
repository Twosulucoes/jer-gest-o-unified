# Checklist de Validação — Navegação em 3 Níveis

Data: 2026-04-14

---

## Validação Super Admin

- [ ] Criar role super_admin via SQL: `INSERT INTO user_roles (user_id, role) VALUES ('<uuid>', 'super_admin');`
- [ ] Logar com conta super_admin
- [ ] Acessar `/super` — dashboard global carrega com KPIs
- [ ] `/super/eventos` — lista todos os eventos de todos os clientes
- [ ] `/super/logs` — audit_events carregam com filtros
- [ ] `/super/config` — configurações globais editáveis
- [ ] Admin comum tenta acessar `/super` → redireciona para `/admin` com toast "Acesso negado"

## Validação Cliente Admin

- [ ] Logar como admin
- [ ] Menu lateral tem 10 seções (Dashboard, Preparação, Credenciamento, Competição, Logística, Relatórios, Pesquisa, Acessos, Configurações, Sistema)
- [ ] **Partidas e Agenda** (`/admin/competicao/partidas-agenda`) — toggle Lista/Calendário funciona
- [ ] **Diagnóstico do Sistema** (`/admin/sistema/diagnostico`) — tabs Mapa/Diagnóstico funcionam
- [ ] **Dashboard Alimentação** aparece no menu Logística → Alimentação
- [ ] Seção **Relatórios** tem 4 itens (Competição, Transporte, Alimentação, Alojamento)
- [ ] **Links Externos** (`/admin/links`) — criar link com wizard funciona
- [ ] Rotas sem menu acessíveis via URL: `/admin/competicao/fases`, `/admin/competicao/grupos`
- [ ] Badge "Super" visível no avatar se usuário é super_admin

## Validação Links Externos

- [ ] Criar link em `/admin/links` escolhendo módulo Transporte
- [ ] Título: "Teste Transporte", slug: "transporte-teste"
- [ ] Preview mostra URL correta (`/go/transporte-teste`)
- [ ] Copiar URL funciona (clipboard)
- [ ] QR Code gerado e baixável
- [ ] Fazer logout
- [ ] Acessar `/go/transporte-teste` em aba anônima
- [ ] Redireciona para `/pwa/login` (ou destino configurado)
- [ ] Fazer login como usuário com perfil transporte
- [ ] Após login redireciona para `/pwa/transporte` automaticamente

## Validação Operadores PWA

### Transporte
- [ ] Logar como perfil `transporte`
- [ ] Redireciona automaticamente para `/pwa/transporte`
- [ ] Header mostra ícone + "Transporte" + botão logout
- [ ] NÃO tem menu lateral ou navegação para outros módulos
- [ ] Tentar acessar `/pwa/alimentacao` manualmente → bloqueado (acesso negado)
- [ ] Logout funciona e volta para `/pwa/login`

### Alimentação
- [ ] Logar como perfil `alimentacao`
- [ ] Redireciona automaticamente para `/pwa/alimentacao`
- [ ] Header mostra "Alimentação"
- [ ] Sem navegação lateral

### Alojamento
- [ ] Logar como perfil `alojamento`
- [ ] Redireciona automaticamente para `/pwa/alojamento`
- [ ] Header mostra "Alojamento"
- [ ] Sem navegação lateral

### Coordenação Técnica
- [ ] Logar como perfil `coordenacao_tecnica`
- [ ] Redireciona para `/pwa/coordenacao`
- [ ] Funcionalidades carregam

### Delegação
- [ ] Logar como perfil `delegacao`
- [ ] Redireciona para `/pwa/delegacao`
- [ ] Vê apenas dados da própria delegação

## Validação Redirecionamento Automático

- [ ] Admin logando em `/pwa/login` é redirecionado para `/admin`
- [ ] Super admin logando em `/pwa/login` é redirecionado para `/admin`
- [ ] Operador com 1 perfil é redirecionado diretamente para seu módulo
- [ ] Acessar `/pwa` root autenticado redireciona automaticamente (não mostra landing genérica)

## Validação de Build

- [ ] `npm run build` executa sem erros TypeScript
- [ ] Nenhum warning crítico
- [ ] Todas as rotas renderizam sem erro 404
