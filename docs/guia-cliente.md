# Guia do Cliente — JER Gestão

Este guia é para a **equipe organizadora do evento** (secretaria, coordenação técnica) que utiliza o painel administrativo (`/admin`).

---

## 1. Primeiros Passos

### Primeiro Login
1. Acesse a URL do sistema (ex: `https://joyful-sports-hub.lovable.app`)
2. Faça login com email e senha fornecidos pelo administrador
3. Você será direcionado ao **Dashboard** com KPIs do evento ativo

### Configurar Evento
1. Vá em **Preparação → Eventos**
2. Crie um novo evento (nome, ano, datas de início/fim)
3. O evento criado ficará com status "Planejamento"
4. Ative o evento no **seletor de evento** no header para começar a trabalhar

### Importar Dados do SIGECOM
1. Vá em **Preparação → Importação**
2. Faça upload da planilha XLSX exportada do SIGECOM
3. Mapeie as colunas (o sistema sugere mapeamento automático)
4. Confirme a importação — o sistema cria automaticamente: instituições, delegações, participantes e inscrições esportivas
5. Verifique em **Preparação → Normalização** se todas as provas foram mapeadas corretamente

---

## 2. Credenciamento

### Buscar e Emitir Credencial
1. Vá em **Credenciamento → Busca e Emissão**
2. Busque participante por nome, CPF ou delegação
3. Clique em **Check-in** para registrar presença
4. Clique em **Emitir Credencial** para gerar a credencial com QR Code
5. Imprima a credencial

### Validação QR
1. Vá em **Credenciamento → Validação QR**
2. Escaneie o QR da credencial com a câmera
3. O sistema mostra dados do participante e valida se está ativo

---

## 3. Montando a Competição

### Usando a Central da Competição (Wizard)
1. Vá em **Competição → Central da Competição**
2. Selecione a prova (modalidade + categoria + gênero)
3. O wizard guia em passos:
   - **Regras**: configurar pontuação, desempate, formato
   - **Estrutura**: criar fases e grupos (ou baterias para individuais)
   - **Inscritos**: validar quórum e elegibilidade
   - **Confrontos**: gerar partidas automaticamente
   - **Agenda**: definir datas, horários e locais
   - **Classificação**: acompanhar tabela em tempo real
   - **Resultados**: lançar, validar e publicar

### Partidas e Agenda
1. Vá em **Competição → Partidas e Agenda**
2. Use o toggle **Lista/Calendário** para alternar visualizações
3. Na visão Lista: filtre por prova, fase, status
4. Na visão Calendário: veja timeline por dia/hora

---

## 4. Lançando Resultados

### Fluxo de Governança
1. **Mesário lança** o resultado na partida (placar, eventos, escalação)
2. **Coordenador valida** — revisa dados e confirma
3. **Publicar** — resultado vira oficial, vinculado a boletim
4. O status progride: `lançado → validado → publicado`

### Via Admin
1. Clique na partida em **Partidas e Agenda**
2. Na página de detalhe, registre placar e eventos
3. Use a aba **Resultados** para lançar o resultado oficial

---

## 5. Gerenciando Logística

### Transporte
1. **Veículos**: cadastre a frota em **Logística → Transporte → Veículos**
2. **Rotas**: defina itinerários em **Rotas**
3. **Viagens**: agende viagens vinculando veículo + rota + data/hora

### Alimentação
1. **Tipos de Refeição**: cadastre em **Logística → Alimentação → Tipos** (café, almoço, jantar, etc.)
2. **Janelas de Serviço**: defina horários de cada refeição por dia
3. **Consumo**: registre consumo via scan QR ou busca manual
4. **Dashboard**: acompanhe estatísticas em tempo real

### Alojamento
1. **Locais**: cadastre espaços em **Logística → Alojamento → Locais**
2. **Unidades**: crie quartos/salas dentro de cada local
3. **Ocupação**: aloque participantes e faça check-in/out

---

## 6. Criando Acessos para Operadores

### Criar Usuário Operacional
1. Vá em **Acessos → Usuários Operacionais**
2. Clique **Novo Usuário**
3. Preencha: email, nome completo, perfil (transporte, alimentação, etc.)
4. O sistema envia convite por email
5. Operador recebe email → clica no link → define senha → conta ativa

### Criar e Compartilhar Link Externo
1. Vá em **Acessos → Links Externos**
2. Clique **Novo Link**
3. Escolha o módulo destino (ex: Transporte)
4. Defina um título descritivo (ex: "Acesso Motoristas JER 2026")
5. Opcional: personalize o slug (ex: `motoristas`)
6. Copie o link gerado ou baixe o QR Code
7. Compartilhe via **WhatsApp, email ou SMS**

---

## 7. Relatórios

1. Vá em **Relatórios** no menu lateral
2. Escolha o tipo: Competição, Transporte, Alimentação ou Alojamento
3. Configure filtros (data, delegação, prova, etc.)
4. Exporte em **PDF** ou **Excel**

---

## 8. Pesquisa de Satisfação

1. Vá em **Pesquisa → Eventos de Pesquisa** para criar um evento
2. Cadastre pesquisadores em **Pesquisa → Pesquisadores** (cada um recebe um PIN)
3. Pesquisador acessa `/pwa/pesquisa/login` com o PIN
4. Respostas são sincronizadas automaticamente (funciona offline)
5. Acompanhe resultados em **Pesquisa → Dashboard**

---

## 9. Troubleshooting

| Problema | Solução |
|----------|---------|
| Operador não consegue logar | Verificar se convite foi enviado e aceito. Reenviar convite em Acessos → Usuários |
| Link externo não funciona | Verificar se link está ativo (toggle na lista de links) |
| Resultado não aparece publicado | Verificar se passou por validação: lançado → validado → publicado |
| Participante sem credencial | Fazer check-in primeiro, depois emitir em Credenciamento |
| Importação com erros | Ver erros em Preparação → Importação → aba Erros. Corrigir planilha e reimportar |
| QR Code não é reconhecido | Verificar formato (deve ser `jer:{event_id}:{participant_id}:{code}`) |
| Dashboard sem dados | Verificar se evento ativo está selecionado no header |
