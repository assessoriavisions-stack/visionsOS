/* ============================================================
   Motor de cálculo — financeiro (competência x caixa, parcelas)
   e comercial (funil, canais, CAC, LTV)
   ============================================================ */

/* ---------- contratos ---------- */
// status derivado pelas datas: ativo / aviso (tem data de término futura) / encerrado
function contractStatus(c, ref) {
  const t = ref || today();
  if (c.kind === 'projeto') {
    if (c.canceled) return 'encerrado';
    return 'projeto';
  }
  if (c.endDate && c.endDate < t) return 'encerrado';
  if (c.endDate) return 'aviso';
  return 'ativo';
}
const contractActiveIn = (c, ym) => c.kind === 'recorrente' && ymOf(c.startDate) <= ym && (!c.endDate || ymOf(c.endDate) >= ym);

// Gera as cobranças (virtuais) de um contrato. IDs determinísticos => pagamento fica em payments[id].
function invoicesOf(c, payments, horizonYm) {
  const out = [];
  const pay = id => (payments && payments[id]) || null;
  const mk = (id, kind, label, due, amount, extra) => {
    const p = pay(id);
    const amt = p && p.amount != null && p.amount !== '' ? Number(p.amount) : amount;
    const d = (p && p.due) || due;
    let status = p && p.status === 'pago' ? 'pago' : p && p.status === 'cancelado' ? 'cancelado' : (d < today() ? 'atrasado' : 'pendente');
    out.push(Object.assign({
      id, contractId: c.id, clientId: c.clientId, clientName: c.clientName, productId: c.productId, method: c.method || 'pix',
      kind, label, due: d, ym: ymOf(d), origYm: ymOf(due), amount: amt, status,
      paidAt: p && p.paidAt, paidAmount: p && p.status === 'pago' ? Number(p.paidAmount != null ? p.paidAmount : amt) : 0, note: p && p.note
    }, extra || {}));
  };
  const splitAmounts = (total, n) => {
    const base = Math.floor((total / n) * 100) / 100; const arr = Array(n).fill(base);
    arr[n - 1] = Math.round((total - base * (n - 1)) * 100) / 100; return arr;
  };
  if (c.kind === 'recorrente') {
    const first = c.firstDue || c.startDate;
    if (first) {
      let ym = ymOf(first); const hz = horizonYm || addMonths(ymNow(), 12); let i = 0;
      while (ym <= hz && i < 240) {
        const due = i === 0 ? first : dueIn(ym, c.payDay || parseD(first).getDate());
        if (c.endDate && due > c.endDate) break;
        mk(c.id + '-m' + ym, 'mensal', 'Mensalidade ' + monthShort(ym), due, Number(c.value) || 0, { n: i + 1 });
        ym = addMonths(ym, 1); i++;
      }
    }
    if (Number(c.setupValue) > 0) {
      const n = Math.max(1, Number(c.setupInstallments) || 1);
      const f = c.setupFirstDue || c.startDate || today();
      splitAmounts(Number(c.setupValue), n).forEach((a, i) => mk(c.id + '-s' + i, 'setup', 'Setup ' + (n > 1 ? (i + 1) + '/' + n : ''), addMonthsDate(f, i), a, { n: i + 1, of: n }));
    }
  } else {
    const n = Math.max(1, Number(c.installments) || 1);
    const f = c.firstDue || c.startDate || today();
    splitAmounts(Number(c.value) || 0, n).forEach((a, i) => mk(c.id + '-p' + i, 'parcela', n > 1 ? 'Parcela ' + (i + 1) + '/' + n : 'Pagamento único', addMonthsDate(f, i), a, { n: i + 1, of: n }));
  }
  return out;
}
function allInvoices(db, horizonYm) {
  return vals(db.contracts).flatMap(c => invoicesOf(c, db.payments, horizonYm));
}

/* ---------- despesas ---------- */
function costsInMonth(db, ym) {
  return vals(db.costs).filter(c => {
    if (!c.recurring) return ymOf(c.date) === ym;
    if (ymOf(c.date) > ym) return false;
    if (c.endYm && c.endYm < ym) return false;
    if ((c.skip || []).includes(ym)) return false;
    return true;
  }).map(c => Object.assign({}, c, { due: c.recurring ? dueIn(ym, parseD(c.date).getDate()) : c.date }));
}

/* ---------- visão financeira do mês ---------- */
function monthFinance(db, ym, inv) {
  const S = db.S;
  const invs = inv || allInvoices(db, addMonths(ym, 1));
  const cts = vals(db.contracts);
  const recurring = cts.filter(c => contractActiveIn(c, ym));
  const mrr = sum(recurring, c => c.value);
  // competência
  const mensalidades = sum(invs.filter(i => i.kind === 'mensal' && i.origYm === ym && i.status !== 'cancelado'), i => i.amount);
  let projetos = 0;
  if (S.projectRecognition === 'parcela') {
    projetos = sum(invs.filter(i => (i.kind === 'parcela' || i.kind === 'setup') && i.origYm === ym && i.status !== 'cancelado'), i => i.amount);
  } else {
    projetos = sum(cts.filter(c => c.kind === 'projeto' && !c.canceled && ymOf(c.startDate) === ym), c => c.value)
      + sum(cts.filter(c => c.kind === 'recorrente' && ymOf(c.startDate) === ym), c => c.setupValue);
  }
  const receita = mensalidades + projetos;
  // caixa
  const recebidos = invs.filter(i => i.status === 'pago' && ymOf(i.paidAt) === ym);
  const caixa = sum(recebidos, i => i.paidAmount);
  const doMes = invs.filter(i => i.ym === ym && i.status !== 'cancelado');
  const previsto = sum(doMes, i => i.amount);
  const aReceber = sum(doMes.filter(i => i.status !== 'pago'), i => i.amount);
  const atrasadas = invs.filter(i => i.status === 'atrasado');
  // despesas
  const custos = costsInMonth(db, ym);
  const despesas = sum(custos, c => c.amount);
  const catCac = new Set(S.costCategories.filter(c => c.cac).map(c => c.id));
  const despesasCac = sum(custos.filter(c => catCac.has(c.category)), c => c.amount);
  const imposto = S.taxAuto ? caixa * (Number(S.taxRate) || 0) / 100 : 0;
  // movimentos de MRR
  const novos = cts.filter(c => c.kind === 'recorrente' && ymOf(c.startDate) === ym);
  const churned = cts.filter(c => c.kind === 'recorrente' && ymOf(c.noticeDate || c.endDate) === ym && (c.noticeDate || c.endDate));
  const novoMrr = sum(novos, c => c.value);
  const churnMrr = sum(churned, c => c.value);
  const projetosVendidos = cts.filter(c => c.kind === 'projeto' && ymOf(c.startDate) === ym && !c.canceled);
  return {
    ym, mrr, recurring, receita, mensalidades, projetos, caixa, recebidos, previsto, aReceber, atrasadas,
    atrasadoTotal: sum(atrasadas, i => i.amount), custos, despesas, despesasCac, imposto,
    resultadoCaixa: caixa - despesas - imposto, resultadoCompetencia: receita - despesas - imposto,
    novos, churned, novoMrr, churnMrr, netMrr: novoMrr - churnMrr, projetosVendidos,
    vendasValor: novoMrr + sum(projetosVendidos, c => c.value) + sum(novos, c => c.setupValue)
  };
}

/* retenção média (meses) pelos contratos recorrentes encerrados */
function retentionAuto(db) {
  const ended = vals(db.contracts).filter(c => c.kind === 'recorrente' && c.startDate && c.endDate && c.endDate < today());
  if (!ended.length) return null;
  return sum(ended, c => Math.max(1, diffDays(c.startDate, c.endDate) / 30.4)) / ended.length;
}
function retentionMonths(db) { return Number(db.S.retentionMonths) > 0 ? Number(db.S.retentionMonths) : (retentionAuto(db) || 12); }

/* ---------- comercial ---------- */
// marca no histórico todas as etapas até a nova (funil monotônico)
function stagePatch(deal, to) {
  const hist = (deal.history || []).slice();
  const has = new Set(hist.map(h => h.s));
  const at = stamp();
  if (to !== 'perdido') {
    const ti = stageIdx(to);
    for (let i = 0; i <= ti; i++) { const s = STAGES[i].id; if (!has.has(s)) hist.push({ s, at }); }
  } else hist.push({ s: 'perdido', at });
  const p = { stage: to, history: hist, stageAt: at };
  if (to === 'ganho') p.wonAt = deal.wonAt || at;
  if (to !== 'perdido') p.lostAt = null;
  if (to === 'perdido') p.lostAt = at;
  if (to === 'ganho' || to === 'perdido') { p.cadenceId = null; }
  return p;
}
const reached = (deal, s) => (deal.history || []).some(h => h.s === s) || (deal.stage !== 'perdido' && stageIdx(deal.stage) >= stageIdx(s));
const enteredAt = (deal, s) => { const h = (deal.history || []).find(x => x.s === s); return h ? dOfStamp(h.at) : (s === 'novo' ? dOfStamp(deal.createdAt) : null); };
const inRange = (d, a, b) => d && d >= a && d <= b;

// eventos de funil num período [a,b] (datas). Opcional filtro de canal/responsável.
function funnelEvents(db, a, b, filt) {
  const ds = vals(db.deals).filter(d => (!filt || filt(d)));
  const cnt = s => ds.filter(d => inRange(enteredAt(d, s), a, b)).length;
  const won = ds.filter(d => d.stage === 'ganho' && inRange(dOfStamp(d.wonAt), a, b));
  const lost = ds.filter(d => d.stage === 'perdido' && inRange(dOfStamp(d.lostAt), a, b));
  return {
    leads: ds.filter(d => inRange(dOfStamp(d.createdAt), a, b)).length,
    conexao: cnt('conexao'), agendada: cnt('agendada'), realizada: cnt('realizada'), proposta: cnt('proposta'),
    ganhos: won.length, perdidos: lost.length, won, lost,
    mrrGanho: sum(won, d => d.mrr), setupGanho: sum(won, d => d.setup),
    ciclo: won.length ? sum(won, d => Math.max(0, diffDays(dOfStamp(d.createdAt), dOfStamp(d.wonAt)))) / won.length : NaN
  };
}
// coorte: leads criados no período e até onde chegaram
function cohort(db, a, b, filt) {
  const ds = vals(db.deals).filter(d => inRange(dOfStamp(d.createdAt), a, b) && (!filt || filt(d)));
  const r = s => ds.filter(d => reached(d, s)).length;
  return { n: ds.length, conexao: r('conexao'), agendada: r('agendada'), realizada: r('realizada'), proposta: r('proposta'), ganho: ds.filter(d => d.stage === 'ganho').length, perdido: ds.filter(d => d.stage === 'perdido').length, deals: ds };
}

// prospecção: soma dos contadores diários
function prospectTotals(db, a, b, chId, userId) {
  const tot = { abord: 0, resp: 0, conv: 0, fup: 0 };
  vals(db.prospect).forEach(p => {
    if (!inRange(p.date, a, b)) return;
    if (userId && p.user !== userId) return;
    Object.entries(p.byCh || {}).forEach(([ch, m]) => {
      if (chId && ch !== chId) return;
      PROSP_METRICS.forEach(k => (tot[k.id] += Number(m[k.id]) || 0));
    });
  });
  return tot;
}
const prospectDocId = (date, user) => date + '_' + (user || 'geral');

// investimento em mídia/canais no mês
function spendOf(db, ym, chId) {
  const s = db.spend[ym]; if (!s) return 0;
  if (chId) return Number((s.byCh || {})[chId]) || 0;
  return sum(Object.values(s.byCh || {}));
}

// visão comercial do mês: CAC blended e por canal
function commercialMonth(db, ym) {
  const a = ym + '-01', b = ym + '-' + pad(daysInMonth(ym));
  const ev = funnelEvents(db, a, b);
  const midia = spendOf(db, ym);
  const fin = monthFinance(db, ym);
  // custos comerciais (categorias marcadas "entra no CAC") — se marketing próprio também estiver lançado como despesa, evitar dupla contagem:
  const investTotal = midia + fin.despesasCac;
  const cac = ev.ganhos ? investTotal / ev.ganhos : NaN;
  const cacMidia = ev.ganhos ? midia / ev.ganhos : NaN;
  const ticket = ev.ganhos ? ev.mrrGanho / ev.ganhos : NaN;
  const ret = retentionMonths(db);
  const margin = (Number(db.S.grossMargin) || 60) / 100;
  const ltv = Number.isFinite(ticket) ? ticket * ret * margin : NaN;
  const pros = prospectTotals(db, a, b);
  const byCh = db.S.channels.map(ch => {
    const f = d => d.channelId === ch.id;
    const e = funnelEvents(db, a, b, f);
    const sp = spendOf(db, ym, ch.id);
    const p = prospectTotals(db, a, b, ch.id);
    return { ch, ...e, spend: sp, pros: p, cpl: e.leads ? sp / e.leads : NaN, cac: e.ganhos ? sp / e.ganhos : NaN };
  });
  return { ym, a, b, ev, midia, investTotal, cac, cacMidia, ticket, ltv, ltvCac: ltv / cac, payback: cac / (ticket * margin), ret, margin, pros, byCh, fin };
}

/* follow-ups: próxima ação de cada lead aberto */
function cadenceOf(db, id) { return id ? db.cadences[id] : null; }
function nextTask(db, d) {
  if (d.stage === 'ganho') return null;
  if (d.stage === 'perdido') return d.reactivateAt ? { kind: 'manual', due: d.reactivateAt, title: 'Reativar lead perdido' + (d.lostReason ? ' (' + d.lostReason + ')' : '') } : null;
  const cad = cadenceOf(db, d.cadenceId);
  if (cad && !d.cadencePaused) {
    const i = d.cadenceStep || 0;
    const st = (cad.steps || [])[i];
    if (st) {
      const due = d.cadenceDue || nextBiz(addDays(d.cadenceStart || today(), st.day || 0));
      return { kind: 'cad', due, step: st, i, total: cad.steps.length, cad };
    }
  }
  if (d.nextDate) return { kind: 'manual', due: d.nextDate, title: d.nextAction || 'Próxima ação' };
  return { kind: 'none' };
}
function followupBuckets(db, userId) {
  const t = today(); const in7 = addDays(t, 7);
  const out = { atrasado: [], hoje: [], proximos: [], semAcao: [] };
  vals(db.deals).forEach(d => {
    if (userId && d.ownerId && d.ownerId !== userId) return;
    const tk = nextTask(db, d); if (!tk) return;
    const item = { d, tk };
    if (tk.kind === 'none') out.semAcao.push(item);
    else if (tk.due < t) out.atrasado.push(item);
    else if (tk.due === t) out.hoje.push(item);
    else if (tk.due <= in7) out.proximos.push(item);
  });
  const byDue = (x, y) => (x.tk.due || '').localeCompare(y.tk.due || '');
  out.atrasado.sort(byDue); out.proximos.sort(byDue);
  return out;
}

/* metas: realizado do mês e ritmo */
function goalActuals(db, ym) {
  const cm = commercialMonth(db, ym);
  const f = cm.fin;
  return {
    newMrr: f.novoMrr, sales: cm.ev.ganhos, vendasValor: f.vendasValor, meetings: cm.ev.realizada, scheduled: cm.ev.agendada, leads: cm.ev.leads,
    approaches: cm.pros.abord, cash: f.caixa, revenue: f.receita, invest: cm.midia, cac: cm.cac, mrr: f.mrr
  };
}
const GOAL_FIELDS = [
  { id: 'newMrr', l: 'Novo MRR vendido', fmt: 'money', h: 'Soma das mensalidades dos contratos recorrentes que começaram no mês' },
  { id: 'vendasValor', l: 'Valor total vendido', fmt: 'money', h: 'Novo MRR + projetos + setups vendidos no mês' },
  { id: 'sales', l: 'Vendas (contratos)', fmt: 'int', h: 'Leads marcados como Ganho no mês' },
  { id: 'meetings', l: 'Reuniões realizadas', fmt: 'int', h: 'Leads que entraram em "Reunião realizada" no mês' },
  { id: 'scheduled', l: 'Reuniões agendadas', fmt: 'int' },
  { id: 'leads', l: 'Novos leads', fmt: 'int', h: 'Leads criados no CRM no mês' },
  { id: 'approaches', l: 'Abordagens (prospecção)', fmt: 'int', h: 'Soma dos contadores de prospecção' },
  { id: 'cash', l: 'Caixa recebido', fmt: 'money' },
  { id: 'revenue', l: 'Receita (competência)', fmt: 'money' },
  { id: 'mrr', l: 'MRR total da carteira', fmt: 'money' },
  { id: 'invest', l: 'Investimento em mídia', fmt: 'money', lower: true, h: 'Quanto você planeja investir. Abaixo da meta = bom' },
  { id: 'cac', l: 'CAC máximo', fmt: 'money', lower: true, h: 'Custo por cliente. Abaixo da meta = bom' }
];
const fmtBy = (f, v) => (f === 'money' ? money(v) : f === 'pct' ? pct(v) : num(v));

/* ---------- calculadoras ---------- */
// Calculadora de metas & CAC (funil reverso estilo Visions Tracking)
function calcGoal(p) {
  const ticket = n0(p.ticket), setup = n0(p.setup), meta = n0(p.meta);
  const r1 = n0(p.rLeadMeet) / 100, r2 = n0(p.rShow) / 100, r3 = n0(p.rClose) / 100;
  const cpl = n0(p.cpl), ret = n0(p.ret) || 1, margin = n0(p.margin) / 100, days = n0(p.days) || 22, fixed = n0(p.fixed);
  const sales = p.mode === 'vendas' ? n0(p.sales) : (ticket > 0 ? Math.ceil(meta / ticket) : 0);
  const meetings = r3 > 0 ? Math.ceil(sales / r3) : 0;
  const scheduled = r2 > 0 ? Math.ceil(meetings / r2) : 0;
  const leads = r1 > 0 ? Math.ceil(scheduled / r1) : 0;
  const invest = leads * cpl;
  const cac = sales > 0 ? (invest + fixed) / sales : NaN;
  const ltv = ticket * ret * margin + setup;
  const cacMax = ltv / 3;
  const payback = ticket * margin > 0 ? cac / (ticket * margin) : NaN;
  return {
    sales, meetings, scheduled, leads, invest, cac, ltv, cacMax, ltvCac: ltv / cac, payback,
    leadsDay: leads / days, newMrr: sales * ticket, setupTotal: sales * setup, cpm: meetings ? (invest + fixed) / meetings : NaN,
    roi12: sales > 0 ? ((ticket * margin * Math.min(12, ret) + setup) * sales - invest - fixed) / (invest + fixed || 1) : NaN
  };
}
// Calculadora de prospecção (abordagens -> respostas -> conversas -> reuniões -> comparecem -> vendas)
function calcProsp(p) {
  const perDay = n0(p.perDay), days = n0(p.days) || 22, ticket = n0(p.ticket), meta = n0(p.meta);
  const r = [n0(p.rResp), n0(p.rConv), n0(p.rMeet), n0(p.rShow), n0(p.rClose)].map(x => x / 100);
  const total = perDay * days;
  const steps = [total]; r.forEach((x, i) => steps.push(steps[i] * x));
  const prodR = r.reduce((a, b) => a * b, 1);
  const vendasPrev = steps[5];
  const vendasNec = ticket > 0 ? Math.ceil(meta / ticket) : 0;
  const perDayNeeded = prodR > 0 ? Math.ceil(vendasNec / prodR / days) : NaN;
  return { total, steps, vendasPrev, fat: vendasPrev * ticket, vendasNec, perDayNeeded, prodR };
}
const PROSP_REF = { rResp: 9, rConv: 38, rMeet: 33, rShow: 80, rClose: 30 };
