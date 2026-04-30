-- Inserir novas seções
INSERT INTO public.help_manual_sections (id, category, title, content_md, sort_order, is_published)
VALUES 
(gen_random_uuid(), '4. PWAs Mobile', '4.0 Operação Offline e Sincronização', 'O sistema JER''s Gestão foi projetado para operar em ambientes de baixa conectividade ou total ausência de internet (ginásios, estradas ou refeitórios subterrâneos).

### Como funciona
O aplicativo mobile armazena os dados localmente no seu aparelho. Quando você realiza uma leitura ou registro, a informação é salva primeiro no celular e, assim que houver conexão, é enviada automaticamente para o servidor central.

### Indicadores de Sincronização
No topo da tela das PWAs, você encontrará um ícone de nuvem ou setas circulares:
- **Ícone Verde/Estático:** Todos os dados estão sincronizados com o servidor.
- **Ícone Amarelo/Animado:** Existem registros pendentes sendo enviados. Não feche o app agora.
- **Ícone Vermelho:** Você está offline. Continue operando normalmente; o sistema sincronizará quando a rede voltar.

### Garantia de Dados
- **Não troque de aparelho** se houver registros pendentes (ícone amarelo/vermelho).
- **Não limpe o cache do navegador** durante o evento.
- **Bateria fraca:** Se o aparelho desligar, os dados salvos localmente não são perdidos, mas só subirão quando você ligar o aparelho e abrir o app novamente com internet.

* [imagem sugerida: detalhe do ícone de sincronização nos três estados: verde, amarelo e vermelho]
', 39, true),
(gen_random_uuid(), '4. PWAs Mobile', '4.6 Vouchers Operacionais', 'Vouchers são documentos (digitais ou impressos) que autorizam um consumo ou acesso excepcional que não está previsto na credencial padrão do participante.

### O que são e quando usar
São usados para:
- Convidados extras em refeições.
- Atletas que perderam a credencial e aguardam segunda via.
- Necessidades logísticas de última hora (transporte extra).

### Como validar um Voucher
Nas PWAs de Alimentação, Alojamento e Transporte, o scanner possui um modo específico para **Voucher**. Ao ativar este modo, o sistema lerá o QR Code do voucher e verificará:
1. Se o voucher é autêntico.
2. Se já foi utilizado (bloqueio de reuso).
3. Se está dentro do prazo de validade.

### Quem emite
Vouchers são emitidos exclusivamente pela Secretaria Geral ou Coordenação de Logística através do Painel Administrativo.

* [imagem sugerida: exemplo de um voucher impresso com QR Code destacado]
', 45, true);

-- Atualizar seção 4.1 Alojamento
UPDATE public.help_manual_sections 
SET title = '4.1 PWA Alojamento',
    content_md = '### 1. Visão geral
PWA voltada para o controle de ocupação, presença noturna e integridade das unidades de alojamento (escolas e hotéis).

### 2. Quem utiliza
Fiscais de alojamento, coordenadores de logística e equipes de manutenção.

### 3. Acesso e instalação
- **Link:** `https://seuevento.com/pwa/alojamento`
- **Instalação:** Ao acessar pelo Chrome (Android) ou Safari (iOS), use a opção "Adicionar à tela de início" para criar o ícone do app no seu celular.

### 4. Interface operacional
O painel exibe KPIs de ocupação em tempo real (Total de vagas vs. Ocupadas). Abaixo, o seletor de Unidade e Quarto. O botão central de **Scanner** é a ferramenta principal.

### 5. Jornada passo a passo
1. **Seleção de Unidade:** Escolha a escola ou hotel onde você está atuando.
2. **Modo de Operação:** No scanner, selecione a ação desejada:
   - **Check-in:** Registra a chegada do atleta no quarto.
   - **Presença (Lua):** Realizada à noite para confirmar quem realmente dormiu no local.
   - **Check-out:** Registra a saída definitiva.
3. **Leitura:** Aponte para o QR Code da credencial do atleta. O sistema valida automaticamente gênero e idade para o quarto selecionado.
4. **Registro de Ocorrências:** Se encontrar danos no quarto (chuveiro quebrado, colchão rasgado), use o botão "Nova Ocorrência", descreva o fato e anexe uma foto.

### 6. Operação offline
O registro de presença noturna pode ser feito totalmente offline em ginásios sem sinal. Os dados subirão assim que você retornar à área com Wi-Fi. Veja mais em [4.0 Operação Offline](#).

### 7. Dúvidas frequentes
- **O QR Code não lê?** Limpe a lente da câmera ou use a busca manual pelo CPF/Nome.
- **Vaga indisponível?** Verifique se o atleta está designado para outra unidade no sistema central.
- **Uso de Vouchers:** Se um atleta estiver sem credencial, mude o scanner para modo "Voucher". Veja [4.6 Vouchers Operacionais](#).

* [imagem sugerida: tela principal da PWA Alojamento mostrando os KPIs de vagas]
'
WHERE title LIKE '4.1%';

-- Atualizar seção 4.2 Alimentação
UPDATE public.help_manual_sections 
SET title = '4.2 PWA Alimentação',
    content_md = '### 1. Visão geral
Controle rigoroso de acesso aos refeitórios oficiais, garantindo que cada participante consuma apenas o previsto para sua categoria e janela de tempo.

### 2. Quem utiliza
Operadores de buffet, fiscais de refeitório e coordenação de suprimentos.

### 3. Acesso e instalação
- **Link:** `https://seuevento.com/pwa/alimentacao`
- **Instalação:** Adicione à tela de início para operação rápida.

### 4. Interface operacional
Exibe a **Janela Ativa** (ex: Almoço - 11:30 às 14:30) e o contador de consumos realizados. O scanner fica em modo de "Leitura Contínua" para agilizar a fila.

### 5. Jornada passo a passo
1. **Verificação de Janela:** O app detecta automaticamente se há uma refeição ativa.
2. **Scanner de Credencial:** O operador aponta a câmera para o QR Code de cada participante que entra na fila.
3. **Feedback Visual:** 
   - **Verde:** Acesso liberado.
   - **Vermelho:** Bloqueado (já consumiu nesta janela ou não tem direito a esta refeição).
4. **Busca Manual:** Caso o QR Code esteja danificado, use a lupa para buscar por CPF.
5. **Registro de Ocorrências:** Use para reportar filas excessivas ou falta de insumos (ex: "Acabou a proteína às 13h").

### 6. Operação offline
O bloqueio de "Duplo Consumo" exige sincronização rápida. Em modo offline, o sistema permite o acesso mas marcará o conflito assim que voltar a conexão. Veja mais em [4.0 Operação Offline](#).

### 7. Dúvidas frequentes
- **Participante com restrição alimentar?** O sistema exibe um alerta sonoro e visual caso o atleta tenha alergias cadastradas.
- **Convidado sem credencial?** Utilize a validação via modo "Voucher". Veja [4.6 Vouchers Operacionais](#).

* [imagem sugerida: tela de feedback positivo (Verde) após leitura bem-sucedida]
'
WHERE title LIKE '4.2%';

-- Atualizar seção 4.3 Transporte
UPDATE public.help_manual_sections 
SET title = '4.3 PWA Transporte',
    content_md = '### 1. Visão geral
Gestão de embarque em ônibus, vans e veículos oficiais, monitorando o fluxo de passageiros entre locais de competição e alojamentos.

### 2. Quem utiliza
Motoristas e fiscais de transporte.

### 3. Acesso e instalação
- **Link:** `https://seuevento.com/pwa/transporte`
- **Instalação:** Essencial adicionar à tela de início para uso durante a condução (em paradas).

### 4. Interface operacional
Apresenta a lista de "Viagens Disponíveis". Ao selecionar uma, o motorista visualiza a lista de passageiros previstos e o botão de embarque.

### 5. Jornada passo a passo
1. **Assumir Viagem:** O motorista clica em "Iniciar Viagem" na rota designada.
2. **Scanner de Embarque:** Na porta do veículo, faz a leitura das credenciais. O sistema conta automaticamente os assentos ocupados.
3. **Adição Manual:** Caso um passageiro extra autorizado suba, o fiscal pode adicioná-lo manualmente pesquisando pelo nome.
4. **Finalização:** Ao chegar ao destino, clica em "Finalizar Viagem".
5. **Registro de Ocorrências:** Reportar problemas de percurso (pneu furado, atraso por trânsito, comportamento inadequado).

### 6. Operação offline
Crucial para rotas de estrada. O motorista faz o embarque offline e a lista de passageiros sincroniza ao chegar no destino com sinal. Veja mais em [4.0 Operação Offline](#).

### 7. Dúvidas frequentes
- **Ônibus lotado?** O sistema impedirá novos embarques se a capacidade cadastrada for atingida.
- **Uso de Vouchers:** Para passageiros eventuais autorizados. Veja [4.6 Vouchers Operacionais](#).

* [imagem sugerida: lista de viagens ativas com indicador de ocupação]
'
WHERE title LIKE '4.3%';

-- Atualizar seção 4.4 JER Ao Vivo
UPDATE public.help_manual_sections 
SET title = '4.4 PWA JER Ao Vivo',
    content_md = '### 1. Visão geral
Central de comando das competições em tempo real. Integra a preparação da quadra com o lançamento oficial dos placares que alimentam o site público.

### 2. Quem utiliza
Coordenadores de Praça Esportiva, Árbitros e Mesários.

### 3. Acesso e instalação
- **Link:** `https://seuevento.com/pwa/aovivo`

### 4. Subseção: Coordenação Técnica
Neste fluxo, o coordenador prepara a partida:
- Visualiza a lista de jogos do dia na sua praça.
- **Designação:** Confirma quais árbitros e mesários estão atuando em cada partida.
- **Ocorrências de Partida:** Registra atrasos de início, W.O. ou problemas na estrutura da quadra.

### 5. Subseção: Lançamento de Resultados (Mesário)
O coração da operação. O mesário seleciona a partida designada e executa:
- **Lançamento Dinâmico:** A interface muda conforme a modalidade (pontos para basquete, sets para vôlei, tempo para atletismo).
- **Placar Parcial e Final:** Atualiza o andamento do jogo para o público externo.
- **Anexos Obrigatórios:** Ao final, é **obrigatório** tirar uma foto da súmula de papel assinada para validação.
- **Publicação:** Envia o resultado para homologação final da secretaria.

### 6. Operação offline
O lançamento pode ser feito offline, mas o placar "ao vivo" só atualizará para o público quando o aparelho sincronizar. Veja mais em [4.0 Operação Offline](#).

### 7. Dúvidas frequentes
- **Errei o placar e publiquei?** Apenas o Super Admin pode reverter um resultado publicado. Entre em contato imediatamente com a Coordenação Técnica.

* [imagem sugerida: interface de lançamento de pontos de uma partida de futsal]
'
WHERE title LIKE '4.4%';

-- Atualizar seção 4.5 Delegação
UPDATE public.help_manual_sections 
SET title = '4.5 PWA Delegação',
    content_md = '### 1. Visão geral
Canal direto de comunicação e logística para os chefes de delegação, permitindo acompanhar o status de seus atletas e registrar demandas oficiais.

### 2. Quem utiliza
Exclusivamente Chefes de Delegação e dirigentes autorizados.

### 3. Acesso e instalação
- **Link:** `https://seuevento.com/pwa/delegacao`

### 4. Interface operacional
Exibe o "Saúde da Delegação": quantos atletas já chegaram, quantos estão com credenciamento pendente e a agenda de jogos do dia da sua escola/município.

### 5. Jornada passo a passo
1. **Monitoramento:** Acompanha em tempo real quem já fez check-in no alojamento e quem já almoçou.
2. **Logística:** Consulta as rotas de transporte designadas para sua equipe.
3. **Agenda:** Lista de partidas, locais e horários específicos da delegação.
4. **Protestos:** Caso haja uma irregularidade na competição, o chefe registra o protesto formal pelo app, anexa fotos/vídeos e acompanha o status do julgamento pela CDE.

### 6. Operação offline
Permite consulta básica da agenda e participantes mesmo sem sinal. Veja mais em [4.0 Operação Offline](#).

### 7. Dúvidas frequentes
- **Atleta não aparece na lista?** Verifique no menu "Participantes" se ele foi importado corretamente do SIGECOM.

> ### **Responsabilidade sobre dados pessoais**
> O Chefe de Delegação tem acesso a dados de identificação e informações operacionais dos participantes sob sua responsabilidade, protegidos pela LGPD. Estes dados devem ser utilizados **exclusivamente** para fins operacionais durante o evento. É expressamente proibido compartilhar, fotografar, copiar ou divulgar estas informações para terceiros. O uso indevido sujeita o responsável às sanções legais previstas em lei.

* [imagem sugerida: dashboard da delegação mostrando o funil de credenciamento]
'
WHERE title LIKE '4.5%';

-- Padronização final: Substituir qualquer ocorrência restante de "Incidente" por "Ocorrência" nas seções da categoria 4
UPDATE public.help_manual_sections 
SET content_md = REPLACE(content_md, 'Incidente', 'Ocorrência')
WHERE category = '4. PWAs Mobile';

UPDATE public.help_manual_sections 
SET content_md = REPLACE(content_md, 'incidente', 'ocorrência')
WHERE category = '4. PWAs Mobile';
