# Visions OS 2 — Comercial · Financeiro · Metas

Sistema de gestão da Visions focado em **performance**: prospecção, CRM com cadências de follow-up, financeiro com parcelamento e visão **competência × caixa**, metas e calculadoras de CAC/prospecção.

É um **arquivo único** (`index.html`), igual ao Visions OS atual. Pode ser aberto direto no navegador ou publicado em qualquer hospedagem estática (Firebase Hosting, Netlify, Vercel, GitHub Pages).

---

## 1. O que existe hoje no Visions OS atual

Fiz o levantamento pelo código do arquivo `visions-os-com-ia.html`. Não deu para ler os dados do Firebase daqui (a rede deste ambiente bloqueia), então o "efetivamente usa" abaixo vem do código e do que você descreveu.

| Área | Módulos | Situação |
|---|---|---|
| **Operação de conteúdo** | Pipeline de clientes (kick-off → gestão), workspace por cliente (estratégia, briefing, posts com etapas e aprovação, roteiros, produção, site, checklist, mapas, créditos), Interno (overview semanal, cronograma, pendências, insights, relatório, tráfego, campanhas, membros) | **Continua no sistema atual.** Não foi alterado. |
| **Portal do cliente** | Acesso por código: diagnóstico, cronograma, to-dos, stories com IA, tráfego, treinamento, CRM do cliente, fidelidade | **Continua no sistema atual.** |
| **Financeiro** | Contratos (MRR, aviso de 30 dias), custos, projeção mensal, anual, calculadora de preço | **Substituído aqui.** Não tinha parcelamento, não separava receita de caixa e não registrava pagamentos. |
| **Comercial** | Funil do mês preenchido à mão (investimento, leads, reuniões), CAC/LTV, metas × realizado, kanban de leads com nota e próxima ação | **Substituído aqui.** Era tudo no total do mês, sem canal, sem cadência e sem prospecção diária. |

**Decisão:** o Visions OS 2 cobre a parte de **gestão do negócio** (comercial, financeiro, metas). A parte de **entrega** (conteúdo, portal do cliente) continua no sistema atual. Os dois usam o mesmo Firebase, mas o novo grava em chaves próprias (`vos7_*`), então **um não interfere no outro**.

---

## 2. O que o novo sistema faz

### Hoje (tela inicial)
Tudo o que precisa de ação no dia: follow-ups atrasados e de hoje (com script pronto e botão de WhatsApp), contador de abordagens com +1, reuniões, cobranças atrasadas ou vencendo, e o ritmo das metas do mês.

### Comercial
- **Pipeline (CRM)** em kanban ou lista: arrastar e soltar, filtros por canal, produto e responsável. As etapas são Novo lead → Em contato → Conectado → Reunião agendada → Reunião realizada → Proposta → Negociação → Ganho/Perdido.
- **Ficha do lead**: próximo passo da cadência com script, histórico de interações (WhatsApp, ligação, direct, e-mail, áudio, reunião…), motivo de perda e reativação automática em 90 dias.
- **Cadências de follow-up**: 4 prontas e editáveis (Outbound frio 7 toques/14 dias, Lead de tráfego *speed to lead*, Pós-reunião/Proposta, Reativação 90 dias). O sistema agenda cada passo, pula fim de semana e mostra no dia certo. "Respondeu!" move o lead para Conectado e para a cadência.
- **Regra de ouro**: nenhum lead aberto fica sem próxima ação. Os que estão sem ação aparecem destacados.
- **Prospecção diária**: contadores por canal (abordagens, respostas, conversas, follow-ups), meta por dia, semana e mapa de consistência do mês. Concluir passos de cadência já soma nos contadores.
- **Análise comercial**: funil do mês, tabela **por canal de aquisição** (abordagens, leads, reuniões, vendas, conversão, MRR, investimento, CPL e CAC por canal), motivos de perda, desempenho por pessoa e os últimos 6 meses.

### Financeiro
- **Venda / contrato** com:
  - **Recorrente** (mensalidade, dia de vencimento, fidelidade) e **setup parcelado** opcional;
  - **Projeto / valor fechado** (ex.: Consultoria 360) **parcelado em N vezes**;
  - forma de pagamento (Pix, boleto, cartão com taxa, transferência) e prévia das cobranças.
- **Recebíveis**: todas as mensalidades e parcelas geradas automaticamente. Um clique em **Recebido** dá baixa, e dá para ajustar valor e data, cancelar cobrança ou desfazer. Filtros: atrasados, vencem no mês, próximos 30 dias, recebidos.
- **Competência × Caixa**:
  - *Receita (competência)* = mensalidades do mês + projetos e setups vendidos no mês. Em Configurações dá para reconhecer projeto pelas parcelas, se preferir.
  - *Caixa* = o que efetivamente entrou no mês, pelas baixas.
  - A tela explica a diferença. Exemplo: uma Consultoria 360 de R$ 6.000 em 6x gera R$ 6.000 de receita e R$ 1.000 de caixa no mês da venda.
- **Fluxo de caixa projetado** (6 meses), **inadimplência** e **MRR**: novo, churn e líquido.
- **Despesas**: fixas mensais (repetem sozinhas e podem "pular mês"), únicas ou **parceladas**, por categoria. As categorias marcadas como "entra no CAC" (comercial, marketing próprio) somam no CAC completo.
- **Rescisão** com aviso prévio configurável: cobra até o fim do aviso e conta o churn no mês do aviso.
- **Clientes**: MRR, tempo de casa, LTV realizado (tudo que já pagou) e valor em atraso.

### Cobranças (Asaas + exterior)
- **Como cobrar**, escolhido em cada contrato: **Asaas** (boleto, Pix ou cartão), **Manual (Brasil)** ou **🌎 Cliente do exterior**.
- **Asaas**: emite as cobranças (uma por uma ou "Emitir N pendentes") e cadastra o cliente lá pelo CPF/CNPJ. Quando o cliente paga, o **webhook dá baixa sozinho** em Recebíveis, com o valor líquido.
- **Exterior** (o Asaas não cobra quem está fora do Brasil):
  - contrato em USD, EUR ou GBP, convertido para reais nos relatórios pela cotação das Configurações (ou por uma cotação fixa no contrato);
  - link e instruções de pagamento (Wise, PayPal, Stripe…);
  - **lembretes prontos em inglês, espanhol ou português** por WhatsApp ou e-mail, com histórico de quantos foram enviados.
- **Página Cobranças**: central de erros que mostra
  - cobrança não emitida;
  - cliente sem CPF/CNPJ;
  - **valor diferente** entre Asaas e contrato (corrige com um clique);
  - vencimento diferente;
  - **pago aqui mas em aberto no Asaas** (dá baixa no Asaas para o cliente não ser cobrado de novo);
  - estorno ou chargeback;
  - cobrança excluída no Asaas;
  - cobranças do Asaas sem contrato;
  - atrasos.

### Painel semanal de clientes (o dashboard do Netlify, agora dentro do sistema)
- **Por campanha**: cada cliente tem suas campanhas (nome e plataforma; dá para pausar). Ao registrar a semana, você preenche **uma linha por campanha** e o faturamento por outros canais do cliente.
- **Dois modelos de funil por cliente**:
  - *agendamento*: leads → agendamentos × ticket. Ex.: Life Embalagens.
  - *reunião → venda fechada*: leads → reuniões → vendas × ticket, com CAC por venda e taxa de fechamento. Ex.: Focus Consultoria.
- **Resultado por campanha**: investimento, % da verba, leads, CPL, agendamentos ou reuniões, custo por etapa, vendas, CAC, faturamento e ROAS. Clicar numa campanha filtra o painel inteiro por ela.
- **Gráficos**: faturamento acumulado × meta, CPL × CAC por semana e investimento por campanha.
- **Benchmarks** de CAC (valor fixo ou % do ticket) e de ROAS por cliente. Histórico editável, filtro de período e **Exportar PDF**.
- **% da meta** compara o faturamento do período com a meta mensal × nº de meses do período.
- **Ticket médio** = faturamento via tráfego ÷ conversões. O painel antigo fazia a média simples das semanas, contando as semanas sem venda como zero.

**Importar o painel antigo**: Configurações → Importar dados → "Importar o painel semanal antigo". Você copia os dados no navegador onde usa o painel, com um comando no console que só copia e não altera nada, e cola no sistema. Como reserva, existem também os dados transcritos das capturas de tela de 26/11, mas a Life Embalagens entra só com os totais.

### Clientes · operação e portal do cliente (antes no sistema antigo)
- **Clientes · operação**: o pipeline dos clientes (kick-off → gestão) em kanban com arrastar e soltar, arquivados e o MRR de cada um vindo dos contratos.
- **Área de trabalho do cliente**, com as abas **Briefing, Posts, Relatório, CRM, Checklist, Roteiro e Mapas mentais**.
  - Posts seguem o mesmo fluxo de etapas do sistema antigo. As etapas do cliente (aprovação de roteiro, envio de material etc.) geram pendências para ele, com prazo.
  - Relatório: métricas do CRM do cliente + painel semanal de tráfego do cliente vinculado.
- **Portal do cliente**: no login, "Sou cliente" + código de acesso. O cliente vê as mesmas 7 abas, aprova posts, pede ajuste e marca "material enviado". No checklist ele só vê os itens marcados como visíveis. O botão "Ver como cliente" abre essa visão para conferência.
  - O navegador do cliente não baixa contratos, cobranças nem dados financeiros da agência.
- **Login da equipe**: modo "Equipe" (senha própria), que vê só a operação e o painel semanal.
- Usa **as mesmas chaves do sistema antigo** (`vos6_clients`, `vos6_c<id>_posts`, `_briefing`, `_crm`, `_ck`, `_rot`, `_mapas`, `_todos`), então nada foi migrado nem copiado: os dois sistemas mostram os mesmos dados enquanto o antigo não for desligado. Os códigos de acesso dos clientes continuam os mesmos.

### Interno (gestão operacional da agência)
- **Pendências** (o principal): uma lista por pessoa (Júlia, Leonardo, Amanda…).
  - Os posts entram sozinhos quando chegam numa etapa dessa pessoa: Criação → Júlia; Gravação, Edição e Postagem → Leonardo; Edição de Arte → Amanda.
  - As etapas "(Cliente)" geram a pendência no portal do cliente.
  - Tudo vem agrupado em Atrasado / Esta semana / Semana que vem / Futuro, com botão para avançar a etapa ou marcar como postado.
  - Também mostra as pendências manuais, os posts com ajuste pedido pelo cliente, o aviso do dia 15 (criação de conteúdo) e a rotina do Leonardo (boletos seg/qua/sex, relatórios na segunda).
- **Overview semanal** e **Cronograma** mensal com os posts de todos os clientes.
- **Reuniões**: pauta, decisões, próximos passos e a **transcrição** colada, com busca.
- **Acessos** (só no login da agência) e **Membros**.
- **Instagram**: os insights mensais agora ficam no espaço de cada cliente (aba "Instagram", visível só para a agência).
- Mesmas chaves do sistema antigo: `vos6_internal` (colabs, ac, re, insights), `vos6_manpend` e os lembretes `vos6_day15_*`, `vos6_boletos_*`, `vos6_relcamp_*`. Ao salvar, o sistema relê `vos6_internal` e troca só a parte alterada. Relatório, Campanhas, Processos e Tráfego antigos não aparecem mais, mas os dados continuam guardados.

### Metas e calculadoras
- **Metas do mês** × realizado, com **marcador de ritmo** (onde você deveria estar hoje pelos dias úteis) e "faltam X por dia útil". Métricas: novo MRR, valor vendido, vendas, reuniões, leads, abordagens, caixa, receita, MRR, investimento e CAC máximo.
- **Calculadora de metas & CAC** (funil reverso, no estilo Visions Tracking): parte da meta de novo MRR e calcula vendas, reuniões, leads e investimento. Mostra CAC projetado × CAC máximo (LTV ÷ 3), LTV:CAC, payback, custo por reunião e diagnóstico. O botão "Usar meus números reais" preenche com os últimos 90 dias, e "Salvar metas" grava direto nas metas do mês.
- **Calculadora de prospecção** por canal, igual à do seu print: ticket, meta, prospecções/dia, dias úteis e as 5 taxas. Mostra o funil, a quantidade de prospecções por dia para bater a meta e o **gargalo** (a etapa mais abaixo da referência). O botão **"Definir N/dia como meta deste canal"** alimenta a prospecção diária.

### Usabilidade
- Menu lateral organizado; no celular, barra inferior e menu.
- **Ctrl+K** (ou `/`): busca leads e contratos, abre páginas e cria itens.
- Atalhos: **N** = novo lead, **V** = nova venda.
- Botão **+** flutuante para ações rápidas.
- "Desfazer" ao excluir ou dar baixa.
- Tema claro/escuro.
- **Funciona offline**: salva no navegador e sincroniza quando a conexão volta. O indicador fica no canto do menu.

---

## 3. Publicar no Netlify (necessário para o Asaas)

1. No Netlify: **Add new site → Import an existing project → GitHub** e escolha este repositório. O `netlify.toml` já configura tudo: o build gera `dist/index.html` e as funções ficam em `netlify/functions`.
2. Em **Site configuration → Environment variables**, crie:

   | Variável | Valor |
   |---|---|
   | `ASAAS_API_KEY` | chave da API do Asaas (Asaas → Integrações → Chave de API) |
   | `VOS_SECRET` | uma senha longa inventada por você, digitada uma vez em Configurações → Asaas |
   | `ASAAS_WEBHOOK_TOKEN` | outra senha inventada, usada no webhook |
   | `ASAAS_ENV` | `sandbox` para testar; apague para usar produção |

3. No Asaas: **Integrações → Webhooks → Adicionar**.
   - URL: `https://SEU-SITE.netlify.app/.netlify/functions/asaas-webhook`
   - Token: o mesmo do `ASAAS_WEBHOOK_TOKEN`
   - Eventos: os de **Cobranças**
4. No Visions OS: **Configurações → Asaas e exterior**. Ative, cole o `VOS_SECRET` e clique em **Testar conexão**.

A chave do Asaas fica só na função do Netlify e nunca vai para o navegador. A função só responde a quem envia o `VOS_SECRET` e guarda no banco apenas os campos que o sistema usa: nenhum dado de cartão é guardado.

## 4. Como começar

1. Abra o `index.html` (ou publique-o).
2. Entre com **a mesma senha do Visions OS atual** e escolha seu nome.
3. Vá em **Configurações → Importar dados → "Ler dados do banco atual"**. O sistema traz contratos, despesas, leads comerciais, metas e investimento em tráfego.
   - O sistema antigo **não é alterado** (só leitura).
   - Pode repetir a importação sem duplicar.
   - Por padrão, as mensalidades anteriores ao mês atual são consideradas pagas, porque o sistema antigo não registrava pagamentos.
   - Depois, revise o produto e a forma de pagamento dos contratos e as categorias das despesas.
4. Em **Configurações**, ajuste produtos e preços, canais, equipe, margem bruta, taxa do cartão e aviso prévio.
5. Use a **Calculadora de prospecção** para definir a meta diária de cada canal e a **Calculadora de metas & CAC** para salvar as metas do mês.

Para testar sem mexer no banco: abra `index.html?local=1`. Nesse modo os dados ficam só no navegador (senha `visions2025`).

---

## 5. Para quem for mexer no código

```
src/
  index.template.html   casca HTML
  styles.css            design system (tokens claro/escuro, componentes)
  00-core.js            utilitários, datas, storage (Firebase + cache + fila offline), padrões
  10-engine.js          cálculos puros: cobranças/parcelas, competência × caixa, funil, CAC, calculadoras
  20-ui.js              componentes (campos, modais, gráficos SVG com tooltip)
  30-comercial.js       pipeline, ficha do lead, cadências, follow-ups, prospecção, análise
  35-operacao.js        clientes · operação: pipeline, área de trabalho (briefing, posts, relatório, CRM, checklist, roteiro, mapas)
  40-financeiro.js      visão geral, recebíveis, contratos, despesas, clientes
  45-cobranca.js        Asaas (emissão, sincronização, conciliação) e lembretes do exterior
  50-metas.js           metas e calculadoras
  55-performance.js     painel semanal de clientes (tráfego, ROAS, CPL, CAC, meta)
  37-interno.js         interno: pendências, overview, cronograma, reuniões, acessos, membros; Instagram do cliente
  60-app.js             Hoje, configurações, importação, login (agência/equipe/cliente), navegação
  65-portal.js          portal do cliente
build.js                gera o index.html único (e dist/index.html):  node build.js
netlify/functions/      asaas.mjs (ponte segura com a API) e asaas-webhook.mjs (baixa automática)
```

Visual: paleta do painel Visions (azul `#4C6FE0` como cor principal, azul-marinho `#2050A0`, dourado `#C7860A`, verde `#17A567`) com fonte Inter. As cores ficam nos tokens de `src/styles.css`.

Stack: React 18 + [htm](https://github.com/developit/htm) via CDN, sem etapa de compilação além do `build.js`.

**Dados** (Firebase RTDB, em `/vos/vos7_<coleção>/<id>`): `deals`, `cadences`, `prospect` (contadores por dia/pessoa), `spend` (investimento por canal/mês), `goals`, `clients`, `contracts`, `payments` (baixas; as cobranças são geradas dos contratos com IDs determinísticos), `costs`, `perf` (semanas do painel de clientes) e `asaas` (cópia das cobranças do Asaas, ligadas pelo `externalReference` = ID da cobrança), além de `vos7_settings`. A operação e o portal leem e gravam as chaves `vos6_*` do sistema antigo (documento inteiro por chave); se a leitura de uma chave falhar, o sistema não grava nela, para não sobrescrever dados. Cada item é gravado separadamente, então duas pessoas editando ao mesmo tempo não apagam o trabalho uma da outra.

### ⚠️ Segurança do Firebase
O banco atual (`visions-os2-default-rtdb`) é acessado **sem autenticação**: quem tiver a URL consegue ler e gravar, inclusive dados de clientes e financeiros. A senha do sistema só protege a tela, não o banco. Recomendo, como próximo passo, ativar o Firebase Authentication e travar as regras do Realtime Database.
