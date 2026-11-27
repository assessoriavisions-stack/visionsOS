/* ============================================================
   Visions OS 2 — núcleo: utilitários, datas, storage, defaults
   ============================================================ */
const { useState, useEffect, useMemo, useRef, useCallback, useContext, createContext, Fragment } = React;
const html = htm.bind(React.createElement);

/* ---------- formatação ---------- */
const BRL0 = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const BRL2 = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money = (v, dec) => { const n = Number(v) || 0; return (dec || (Math.abs(n) < 100 && n % 1 !== 0) ? BRL2 : BRL0).format(n); };
const money2 = v => BRL2.format(Number(v) || 0);
const num = (v, d = 0) => (Number.isFinite(+v) ? (+v).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—');
const pct = (v, d = 0) => (Number.isFinite(v) ? num(v, d) + '%' : '—');
const ratio = (a, b) => (b > 0 ? a / b : NaN);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const n0 = v => { const x = parseFloat(String(v ?? '').replace(',', '.')); return Number.isFinite(x) ? x : 0; };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const sum = (arr, f) => arr.reduce((s, x) => s + (f ? (Number(f(x)) || 0) : (Number(x) || 0)), 0);
const groupBy = (arr, f) => arr.reduce((m, x) => { const k = f(x); (m[k] = m[k] || []).push(x); return m; }, {});
const vals = o => (o ? Object.values(o) : []).filter(Boolean);
const initials = s => (s || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
const fill = (tpl, map) => (tpl || '').replace(/\{(\w+)\}/g, (m, k) => (map[k] != null && map[k] !== '' ? map[k] : m));
const onlyDigits = s => String(s || '').replace(/\D/g, '');
const waLink = (phone, text) => {
  let d = onlyDigits(phone);
  if (d && d.length <= 11) d = '55' + d;
  return 'https://wa.me/' + d + (text ? '?text=' + encodeURIComponent(text) : '');
};

/* ---------- datas (sempre no fuso local; nada de toISOString) ---------- */
const pad = n => String(n).padStart(2, '0');
const dstr = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const today = () => dstr(new Date());
const parseD = s => { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1, 12); };
const addDays = (s, n) => { const d = parseD(s); d.setDate(d.getDate() + n); return dstr(d); };
const diffDays = (a, b) => Math.round((parseD(b) - parseD(a)) / 864e5); // b - a
const ymOf = s => String(s || '').slice(0, 7);
const ymNow = () => ymOf(today());
const addMonths = (ym, n) => { const [y, m] = ym.split('-').map(Number); const d = new Date(y, m - 1 + n, 1, 12); return d.getFullYear() + '-' + pad(d.getMonth() + 1); };
const daysInMonth = ym => { const [y, m] = ym.split('-').map(Number); return new Date(y, m, 0).getDate(); };
const dueIn = (ym, day) => ym + '-' + pad(clamp(Number(day) || 1, 1, daysInMonth(ym)));
const addMonthsDate = (s, n, dayPref) => dueIn(addMonths(ymOf(s), n), dayPref || parseD(s).getDate());
const isWeekend = s => { const w = parseD(s).getDay(); return w === 0 || w === 6; };
const nextBiz = s => { let x = s; while (isWeekend(x)) x = addDays(x, 1); return x; };
const bizDays = ym => { let c = 0; for (let i = 1; i <= daysInMonth(ym); i++) if (!isWeekend(dueIn(ym, i))) c++; return c; };
const bizElapsed = (ym, ref) => { // dias úteis já transcorridos no mês (inclui hoje)
  const t = ref || today(); if (ymOf(t) > ym) return bizDays(ym); if (ymOf(t) < ym) return 0;
  let c = 0; const lim = parseD(t).getDate(); for (let i = 1; i <= lim; i++) if (!isWeekend(dueIn(ym, i))) c++; return c;
};
const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const MSHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const monthLabel = ym => { const [y, m] = ym.split('-').map(Number); return MONTHS[m - 1] + ' ' + y; };
const monthShort = ym => { const [y, m] = ym.split('-').map(Number); return MSHORT[m - 1] + '/' + String(y).slice(2); };
const fdate = s => { if (!s) return '—'; const d = parseD(s); return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + String(d.getFullYear()).slice(2); };
const fdateShort = s => { if (!s) return '—'; const d = parseD(s); return pad(d.getDate()) + ' ' + MSHORT[d.getMonth()]; };
const relDay = s => {
  if (!s) return '';
  const k = diffDays(today(), s);
  if (k === 0) return 'hoje'; if (k === 1) return 'amanhã'; if (k === -1) return 'ontem';
  return k < 0 ? 'há ' + (-k) + 'd' : 'em ' + k + 'd';
};
const WEEKD = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const stamp = () => new Date().toISOString();
const dOfStamp = ts => (ts ? dstr(new Date(ts)) : '');

/* ---------- configuração padrão (editável em Configurações) ---------- */
const DEFAULT_SETTINGS = {
  version: 1,
  company: 'Visions Marketing',
  products: [
    { id: 'c360', name: 'Consultoria 360', kind: 'projeto', price: 6000, currency: 'BRL', allowDiscount: true, color: 's7' },
    { id: 'tracking', name: 'Visions Tracking (CRM básico Visions)', kind: 'recorrente', price: 197, currency: 'BRL', color: 's3' },
    { id: 'trafego', name: 'Tráfego Pago + Assessoria Comercial (Brasil)', kind: 'recorrente', price: 1500, currency: 'BRL', color: 's1' },
    { id: 'trafego_eua', name: 'Tráfego Pago + Assessoria Comercial + CRM (EUA)', kind: 'recorrente', price: 400, currency: 'USD', color: 's6' },
    { id: 'sistemas', name: 'Construção de Sistemas', kind: 'projeto', price: 8000, currency: 'BRL', color: 's4' },
    { id: 'ia', name: 'Implantação IA Humanizada', kind: 'projeto', price: 5000, currency: 'BRL', color: 's5' },
    { id: 'social', name: 'Gestão de Redes Sociais', kind: 'recorrente', price: 2000, currency: 'BRL', color: 's2' },
    { id: 'ia_mensal', name: 'IA Humanizada (mensalidade)', kind: 'recorrente', price: 597, currency: 'BRL', color: 's5' },
    { id: 'assessoria_vendas', name: 'Assessoria de Vendas', kind: 'recorrente', price: 700, currency: 'BRL', color: 's6' },
    { id: 'conteudo', name: 'Gestão de Marketing (antigo)', kind: 'recorrente', price: 0, currency: 'BRL', legacy: true, color: 's8' },
    { id: 'site', name: 'Site / Landing Page', kind: 'projeto', price: 0, currency: 'BRL', hidden: true, color: 's4' }
  ],

  channels: [
    { id: 'ig_dm', name: 'Prospecção — Instagram DM', kind: 'outbound' },
    { id: 'wpp', name: 'Prospecção — WhatsApp', kind: 'outbound' },
    { id: 'cold', name: 'Ligação fria', kind: 'outbound' },
    { id: 'linkedin', name: 'LinkedIn', kind: 'outbound' },
    { id: 'meta', name: 'Tráfego — Meta Ads', kind: 'pago' },
    { id: 'google', name: 'Tráfego — Google Ads', kind: 'pago' },
    { id: 'indicacao', name: 'Indicação', kind: 'indicacao' },
    { id: 'organico', name: 'Orgânico / Inbound', kind: 'inbound' },
    { id: 'eventos', name: 'Eventos / Parcerias', kind: 'inbound' },
    { id: 'base', name: 'Base / Recompra (upsell)', kind: 'inbound' }
  ],
  team: [
    { id: 'leonardo', name: 'Leonardo', role: 'Sócio / Closer' },
    { id: 'julia', name: 'Júlia', role: 'Consultora' },
    { id: 'amanda', name: 'Amanda', role: 'Designer' }
  ],
  costCategories: [
    { id: 'pessoas', name: 'Pessoas / Equipe', cac: false },
    { id: 'comercial', name: 'Comercial (SDR, comissões)', cac: true },
    { id: 'marketing', name: 'Marketing próprio (anúncios da Visions)', cac: true },
    { id: 'ferramentas', name: 'Ferramentas / Software', cac: false },
    { id: 'estrutura', name: 'Estrutura / Escritório', cac: false },
    { id: 'impostos', name: 'Impostos', cac: false },
    { id: 'financeiro', name: 'Taxas financeiras', cac: false },
    { id: 'outros', name: 'Outros', cac: false }
  ],
  lossReasons: ['Preço', 'Sem resposta / sumiu', 'Sem timing agora', 'Escolheu concorrente', 'Sem fit / porte', 'Vai fazer internamente', 'Sem verba de mídia', 'Outro'],
  noticeDays: 30,
  projectRecognition: 'venda', // 'venda' = receita do projeto inteira no mês da venda; 'parcela' = pelo vencimento
  taxRate: 6,
  taxAuto: false,
  cardFee: 4.5,
  grossMargin: 60,
  retentionMonths: 0, // 0 = calcular automático pelos contratos encerrados
  dailyGoals: { ig_dm: 20, wpp: 10 },
  calcGoal: null,
  calcProsp: {},
  fx: { USD: 5.4, EUR: 5.9, GBP: 6.9 },
  asaas: { enabled: false, proxyUrl: '/.netlify/functions/asaas', billingType: 'UNDEFINED', emitDays: 10 },
  perfBench: { roas: 3, cacShare: 50 },
  seeded: false
};

const STAGES = [
  { id: 'novo', l: 'Novo lead', c: 'var(--text-3)' },
  { id: 'contato', l: 'Em contato', c: 'var(--s1)' },
  { id: 'conexao', l: 'Conectado', c: 'var(--s3)' },
  { id: 'agendada', l: 'Reunião agendada', c: 'var(--s7)' },
  { id: 'realizada', l: 'Reunião realizada', c: 'var(--s5)' },
  { id: 'proposta', l: 'Proposta enviada', c: 'var(--s4)' },
  { id: 'negociacao', l: 'Negociação', c: 'var(--s2)' },
  { id: 'ganho', l: 'Ganho', c: 'var(--good)' },
  { id: 'perdido', l: 'Perdido', c: 'var(--bad)' }
];
const OPEN_STAGES = STAGES.filter(s => s.id !== 'ganho' && s.id !== 'perdido');
const stageIdx = id => STAGES.findIndex(s => s.id === id);
const stageOf = id => STAGES.find(s => s.id === id) || STAGES[0];

const ACT_TYPES = [
  { id: 'whatsapp', l: 'WhatsApp', e: '💬' },
  { id: 'ligacao', l: 'Ligação', e: '📞' },
  { id: 'dm', l: 'Direct Instagram', e: '📸' },
  { id: 'email', l: 'E-mail', e: '✉️' },
  { id: 'audio', l: 'Áudio', e: '🎙️' },
  { id: 'linkedin', l: 'LinkedIn', e: '💼' },
  { id: 'reuniao', l: 'Reunião', e: '🤝' },
  { id: 'proposta', l: 'Proposta', e: '📄' },
  { id: 'nota', l: 'Nota', e: '📝' }
];
const actType = id => ACT_TYPES.find(a => a.id === id) || ACT_TYPES[ACT_TYPES.length - 1];

const PROSP_METRICS = [
  { id: 'abord', l: 'Abordagens', h: 'Primeiras mensagens/ligações para quem nunca falou com você' },
  { id: 'resp', l: 'Respostas', h: 'Pessoas que responderam' },
  { id: 'conv', l: 'Conversas', h: 'Viraram ligação / conversa de qualificação' },
  { id: 'fup', l: 'Follow-ups', h: 'Toques de follow-up enviados' }
];

/* Cadências padrão (D+n = dias corridos a partir do início; fins de semana empurram p/ segunda) */
const DEFAULT_CADENCES = [
  {
    id: 'cad_outbound', name: 'Outbound frio — 7 toques / 14 dias', desc: 'Para quem nunca falou com a Visions. Começa no direct/WhatsApp e alterna canais.', steps: [
      { day: 0, ch: 'dm', title: 'Abertura personalizada', script: 'Oi {nome}, tudo bem? Vi o perfil da {empresa} e reparei em [algo específico]. Ajudamos negócios como o seu a gerar clientes todo mês com tráfego pago + rastreamento de vendas. Posso te mandar uma ideia rápida do que faria por vocês?' },
      { day: 1, ch: 'dm', title: 'Interação + reforço', script: 'Curtir/comentar 1 post recente. Depois: "{nome}, conseguiu ver minha mensagem? Vale 2 min, prometo ser direto."' },
      { day: 3, ch: 'whatsapp', title: 'Prova social', script: 'Oi {nome}! Aqui é {eu} da Visions. Um cliente do mesmo segmento saiu de [X] para [Y] leads/mês em 60 dias com a gente. Faz sentido uma conversa de 15 min essa semana?' },
      { day: 5, ch: 'ligacao', title: 'Ligação', script: 'Objetivo: 1 pergunta de dor + agendar diagnóstico. "Hoje como chegam os clientes novos da {empresa}? Vocês sabem quanto custa cada venda?"' },
      { day: 7, ch: 'audio', title: 'Áudio curto (até 40s)', script: 'Áudio humano, cite algo do perfil e ofereça o diagnóstico gratuito de 20 min.' },
      { day: 10, ch: 'whatsapp', title: 'Oferta de diagnóstico', script: '{nome}, separei 2 horários para um diagnóstico gratuito do marketing da {empresa}: [dia/hora] ou [dia/hora]. Qual fica melhor?' },
      { day: 14, ch: 'whatsapp', title: 'Break-up', script: '{nome}, imagino que a rotina esteja corrida. Vou encerrar por aqui para não incomodar. Se em algum momento quiser previsibilidade de clientes, é só me chamar. Sucesso!' }
    ]
  },
  {
    id: 'cad_inbound', name: 'Lead de tráfego — speed to lead', desc: 'Lead que chegou por anúncio/formulário. Velocidade é tudo: primeiro contato em até 5 minutos.', steps: [
      { day: 0, ch: 'ligacao', title: 'Ligar em até 5 min', script: 'Oi {nome}, aqui é {eu} da Visions, você acabou de pedir contato pelo nosso anúncio. Tem 2 minutinhos?' },
      { day: 0, ch: 'whatsapp', title: 'WhatsApp se não atendeu', script: 'Oi {nome}! Sou {eu} da Visions, recebi seu cadastro agora há pouco. Te liguei mas não consegui falar. Qual o melhor horário pra gente conversar hoje?' },
      { day: 1, ch: 'ligacao', title: '2ª tentativa de ligação', script: 'Ligar em horário diferente do primeiro.' },
      { day: 2, ch: 'audio', title: 'Áudio + pergunta', script: 'Áudio curto perguntando o principal objetivo (mais clientes? mais vendas no digital?).' },
      { day: 4, ch: 'whatsapp', title: 'Case', script: '{nome}, olha esse resultado de um cliente parecido com a {empresa}: [print/case]. Quer que eu te mostre como faríamos no seu caso?' },
      { day: 7, ch: 'whatsapp', title: 'Break-up', script: '{nome}, vou pausar o contato por aqui. Se ainda fizer sentido, me responde com um "sim" que eu te chamo.' }
    ]
  },
  {
    id: 'cad_proposta', name: 'Pós-reunião / Proposta', desc: 'Depois do diagnóstico ou da proposta enviada. Nenhuma proposta fica sem follow-up.', steps: [
      { day: 0, ch: 'whatsapp', title: 'Resumo + proposta', script: '{nome}, obrigado pela conversa! Resumo do que combinamos: [3 pontos]. A proposta está aqui: [link]. Qualquer dúvida estou por aqui.' },
      { day: 2, ch: 'whatsapp', title: 'Checar dúvidas', script: '{nome}, conseguiu dar uma olhada na proposta? Ficou alguma dúvida sobre o escopo ou investimento?' },
      { day: 4, ch: 'whatsapp', title: 'Case relevante', script: 'Lembrei de vocês: [case de cliente parecido]. É exatamente o caminho que desenhamos para a {empresa}.' },
      { day: 7, ch: 'ligacao', title: 'Ligação de decisão', script: 'Perguntar: "O que falta para a gente começar?" Mapear objeção real (preço, timing, sócio).' },
      { day: 10, ch: 'whatsapp', title: 'Condição com prazo', script: '{nome}, consigo manter [condição: setup/parcelamento] até [data]. Depois disso entra a tabela normal.' },
      { day: 15, ch: 'whatsapp', title: 'Break-up', script: '{nome}, vou considerar que não é o momento e arquivar a proposta. Se mudar, me chama que retomamos de onde paramos.' }
    ]
  },
  {
    id: 'cad_nutricao', name: 'Reativação / Nutrição (90 dias)', desc: 'Perdidos por timing e leads frios. Um toque de valor por mês.', steps: [
      { day: 0, ch: 'whatsapp', title: 'Conteúdo de valor', script: 'Oi {nome}, vi esse material e lembrei da {empresa}: [link/conteúdo]. Sem compromisso!' },
      { day: 30, ch: 'whatsapp', title: 'Novidade / case', script: '{nome}, tudo certo? Tivemos um resultado legal com [cliente] esse mês, lembrei de você.' },
      { day: 60, ch: 'ligacao', title: 'Check-in', script: 'Ligação rápida: como está o comercial? O cenário mudou?' },
      { day: 90, ch: 'whatsapp', title: 'Nova oferta', script: '{nome}, abrimos [X] vagas para [oferta] este mês. Quer que eu reserve uma pra {empresa}?' }
    ]
  }
];

/* ---------- storage: Firebase RTDB (REST) + cache local + fila offline ---------- */
const FB_BASE = 'https://visions-os2-default-rtdb.firebaseio.com/vos';
const NS = 'vos7_';
const COLLS = ['clients', 'contracts', 'payments', 'costs', 'deals', 'cadences', 'prospect', 'spend', 'goals', 'perf', 'asaas', 'mkposts', 'mkads'];
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sem storage */ } }
};
const urlLocal = /[?&]local=1/.test(location.search);
const MODE = urlLocal ? 'local' : 'remote';
const CACHE_KEY = MODE === 'local' ? 'vos7_localdb' : 'vos7_cache';
const QUEUE_KEY = 'vos7_queue';

const cleanKey = k => String(k).replace(/[.$#\[\]\/]/g, '_');
const fbUrl = path => FB_BASE + '/' + path + '.json';
async function fbGet(path) {
  const r = await fetch(fbUrl(path), { cache: 'no-store' });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const v = await r.json();
  if (v && typeof v === 'object' && typeof v.error === 'string' && Object.keys(v).length === 1) throw new Error(v.error);
  return v;
}
async function fbPut(path, body) {
  const r = await fetch(fbUrl(path), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error('HTTP ' + r.status);
}
async function fbDel(path) {
  const r = await fetch(fbUrl(path), { method: 'DELETE' });
  if (!r.ok) throw new Error('HTTP ' + r.status);
}

function createStore() {
  const empty = () => { const d = { settings: null }; COLLS.forEach(c => (d[c] = {})); return d; };
  let data = Object.assign(empty(), LS.get(CACHE_KEY, {}));
  COLLS.forEach(c => { if (!data[c] || typeof data[c] !== 'object') data[c] = {}; });
  let queue = MODE === 'remote' ? LS.get(QUEUE_KEY, []) : [];
  let status = MODE === 'local' ? 'local' : 'loading';
  let lastSync = null;
  const subs = new Set();
  let ver = 0;
  const emit = () => { ver++; subs.forEach(f => f(ver)); };
  let saveT = null;
  const persist = () => { clearTimeout(saveT); saveT = setTimeout(() => LS.set(CACHE_KEY, data), 150); };
  const applyOp = (op) => {
    if (op.coll === 'settings') { data = Object.assign({}, data, { settings: op.body }); return; }
    const m = Object.assign({}, data[op.coll]);
    if (op.op === 'del') delete m[op.id]; else m[op.id] = op.body;
    data = Object.assign({}, data, { [op.coll]: m });
  };
  queue.forEach(applyOp); // alterações ainda não enviadas continuam visíveis após recarregar
  window.addEventListener('beforeunload', () => { clearTimeout(saveT); if (!window.__vosNoPersist) LS.set(CACHE_KEY, data); });
  const pathOf = op => NS + op.coll + (op.coll === 'settings' ? '' : '/' + cleanKey(op.id));
  async function flush() {
    if (MODE !== 'remote' || !queue.length) return;
    while (queue.length) {
      const op = queue[0];
      try {
        if (op.op === 'del') await fbDel(pathOf(op)); else await fbPut(pathOf(op), op.body);
        queue.shift(); LS.set(QUEUE_KEY, queue);
      } catch (e) { status = 'offline'; emit(); return; }
    }
    status = 'online'; lastSync = new Date(); emit();
  }
  function write(op) {
    applyOp(op); persist(); emit();
    if (MODE === 'remote') { queue.push(op); LS.set(QUEUE_KEY, queue); flush(); }
  }
  async function load() {
    if (MODE === 'local') { status = 'local'; emit(); return true; }
    try {
      const res = await Promise.all(COLLS.map(c => fbGet(NS + c)).concat([fbGet(NS + 'settings')]));
      const nd = empty();
      COLLS.forEach((c, i) => { const v = res[i]; nd[c] = v && typeof v === 'object' && !Array.isArray(v) ? v : {}; });
      nd.settings = res[COLLS.length] || null;
      data = nd;
      queue.forEach(applyOp); // mudanças locais ainda não enviadas por cima do remoto
      persist(); status = queue.length ? 'syncing' : 'online'; lastSync = new Date(); emit();
      flush();
      return true;
    } catch (e) {
      console.warn('Visions OS: sem conexão com o banco, usando cópia local.', e);
      status = 'offline'; emit(); return false;
    }
  }
  return {
    get data() { return data; },
    get status() { return status; },
    get pending() { return queue.length; },
    get lastSync() { return lastSync; },
    subscribe(f) { subs.add(f); return () => subs.delete(f); },
    load, flush,
    put(coll, obj) {
      const body = Object.assign({}, obj, { updatedAt: stamp() });
      if (!body.id) body.id = uid();
      if (!body.createdAt) body.createdAt = body.updatedAt;
      write({ op: 'put', coll, id: body.id, body });
      return body;
    },
    putMany(coll, list) { list.forEach(o => this.put(coll, o)); },
    del(coll, id) { const prev = data[coll] && data[coll][id]; write({ op: 'del', coll, id }); return prev; },
    restore(coll, obj) { write({ op: 'put', coll, id: obj.id, body: obj }); },
    setSettings(patch) {
      const body = Object.assign({}, settingsOf(data), patch, { updatedAt: stamp() });
      write({ op: 'put', coll: 'settings', id: 'settings', body });
    },
    replaceAll(nd) { // usado no restore de backup
      data = Object.assign(empty(), nd); persist(); emit();
      if (MODE === 'remote') {
        COLLS.forEach(c => vals(data[c]).forEach(o => queue.push({ op: 'put', coll: c, id: o.id, body: o })));
        if (data.settings) queue.push({ op: 'put', coll: 'settings', id: 'settings', body: data.settings });
        LS.set(QUEUE_KEY, queue); flush();
      }
    }
  };
}
const settingsOf = d => {
  const s = Object.assign({}, DEFAULT_SETTINGS, d.settings || {});
  ['products', 'channels', 'team', 'costCategories', 'lossReasons'].forEach(k => { if (!Array.isArray(s[k]) || !s[k].length) s[k] = DEFAULT_SETTINGS[k]; });
  s.dailyGoals = s.dailyGoals || {}; s.calcProsp = s.calcProsp || {};
  s.fx = Object.assign({}, DEFAULT_SETTINGS.fx, s.fx || {}); s.asaas = Object.assign({}, DEFAULT_SETTINGS.asaas, s.asaas || {}); s.perfBench = Object.assign({}, DEFAULT_SETTINGS.perfBench, s.perfBench || {});
  return s;
};

const store = createStore();
const StoreCtx = createContext(null);
function useStore() {
  const [, setV] = useState(0);
  useEffect(() => store.subscribe(v => setV(v)), []);
  return store;
}
function useDB() { // dados + settings normalizados
  const s = useStore();
  const d = s.data;
  return useMemo(() => ({ ...d, S: settingsOf(d), store: s }), [d, s.status]);
}

/* ---------- toast global ---------- */
const toastBus = { list: [], subs: new Set() };
function toast(msg, action, ms = 5000) {
  const t = { id: uid(), msg, action };
  toastBus.list = toastBus.list.concat(t).slice(-3); toastBus.subs.forEach(f => f(toastBus.list));
  setTimeout(() => { toastBus.list = toastBus.list.filter(x => x.id !== t.id); toastBus.subs.forEach(f => f(toastBus.list)); }, ms);
}
function delWithUndo(coll, id, label) {
  const prev = store.del(coll, id);
  if (prev) toast((label || 'Item') + ' excluído.', { l: 'Desfazer', f: () => store.restore(coll, prev) }, 8000);
}
