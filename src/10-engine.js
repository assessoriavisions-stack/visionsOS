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
  if (c.kind === 'espelho') return c.endDate && c.endDate < t ? 'encerrado' : 'ativo';
  if (c.endDate && c.endDate < t) return 'encerrado';
  if (c.endDate) return 'aviso';
  return 'ativo';
}
const brlValue = c => (Number(c.value) || 0) * fxRate(c);
const brlSetup = c => (Number(c.setupValue) || 0) * fxRate(c);
const contractActiveIn = (c, ym) => (c.kind === 'recorrente' || (c.kind === 'espelho' && n0(c.value) > 0)) && ymOf(c.startDate) <= ym && (!c.endDate || ymOf(c.endDate) >= ym);

// Gera as cobranças (virtuais) de um contrato. IDs determinísticos => pagamento fica em payments[id].
const ASAAS_PAID = ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH', 'DUNNING_RECEIVED'];
const ASAAS_PROBLEM = ['REFUNDED', 'REFUND_REQUESTED', 'REFUND_IN_PROGRESS', 'CHARGEBACK_REQUESTED', 'CHARGEBACK_DISPUTE', 'AWAITING_CHARGEBACK_REVERSAL'];
const ASAAS_LABEL = { PENDING: 'Aguardando pagamento', RECEIVED: 'Recebida', CONFIRMED: 'Confirmada', OVERDUE: 'Vencida', REFUNDED: 'Estornada', RECEIVED_IN_CASH: 'Recebida em dinheiro', REFUND_REQUESTED: 'Estorno solicitado', REFUND_IN_PROGRESS: 'Estorno em processamento', CHARGEBACK_REQUESTED: 'Chargeback', CHARGEBACK_DISPUTE: 'Disputa de chargeback', AWAITING_CHARGEBACK_REVERSAL: 'Aguardando reversão', DUNNING_REQUESTED: 'Em negativação', DUNNING_RECEIVED: 'Recuperada', AWAITING_RISK_ANALYSIS: 'Em análise' };
const CURRENCIES = { BRL: 'R$', USD: 'US$', EUR: '€', GBP: '£' };
const fxRate = (c, S) => (!c.currency || c.currency === 'BRL') ? 1 : (Number(c.fxRate) || Number(((S || settingsOf(store.data)).fx || {})[c.currency]) || 1);
const moneyCur = (v, cur) => (!cur || cur === 'BRL') ? money2(v) : (CURRENCIES[cur] || cur) + ' ' + num(v, 2);
function asaasIndex(db) {
  const m = {};
  vals(db.asaas).forEach(a => { if (a.externalReference && !(m[a.externalReference] && !m[a.externalReference].deleted && a.deleted)) m[a.externalReference] = a; });
  vals(db.payments).forEach(p => { if (p.asaasId && db.asaas[p.asaasId]) m[p.id] = db.asaas[p.asaasId]; }); // vínculos manuais/automáticos
  return m;
}
const mirrorCustomers = db => new Set(vals(db.contracts).filter(c => c.kind === 'espelho' && c.asaasCustomer).map(c => c.asaasCustomer));
const linkedAsaasIds = db => {
  const s = new Set(); vals(db.payments).forEach(p => p.asaasId && s.add(p.asaasId));
  vals(db.contracts).filter(c => c.kind === 'espelho' && c.asaasCustomer).forEach(c => vals(db.asaas).forEach(a => { // contratos espelho (dentro do período)
    if (a.customer === c.asaasCustomer && (!c.startDate || a.dueDate >= c.startDate) && (!c.endDate || a.dueDate <= c.endDate)) s.add(a.id);
  }));
  return s;
};
function invoicesOf(c, payments, horizonYm, ax) {
  const out = [];
  const pay = id => (payments && payments[id]) || null;
  const rate = fxRate(c);
  const billing = c.kind === 'espelho' ? 'asaas' : (c.billing || 'manual');
  const mk = (id, kind, label, due, amountOrig, extra) => {
    const p = pay(id);
    const a = ax && ax[id] && (billing === 'asaas' || (p && p.asaasId)) ? ax[id] : null;
    const amount = Math.round(amountOrig * rate * 100) / 100;
    const live = a && !a.deleted ? a : null; // cobrança vinculada ao Asaas: valor e vencimento de lá
    const amt = p && p.amount != null && p.amount !== '' ? Number(p.amount) : live && live.value != null ? Number(live.value) : amount;
    const d = (p && p.due) || (live && live.dueDate) || due;
    let status = d < today() ? 'atrasado' : 'pendente', paidAt = null, paidAmount = 0, source = 'local';
    if (p && p.status === 'pago') { status = 'pago'; paidAt = p.paidAt; paidAmount = Number(p.paidAmount != null ? p.paidAmount : amt); }
    else if (p && p.status === 'cancelado') status = 'cancelado';
    else if (a && !a.deleted) {
      source = 'asaas';
      if (ASAAS_PAID.includes(a.status)) { status = 'pago'; paidAt = a.paymentDate || a.clientPaymentDate || a.confirmedDate || a.dueDate; paidAmount = Number(a.netValue != null ? a.netValue : a.value); }
      else if (ASAAS_PROBLEM.includes(a.status)) status = 'problema';
      else if (a.status === 'OVERDUE') status = 'atrasado';
      else if (a.status === 'PENDING') status = 'pendente';
    }
    out.push(Object.assign({
      id, contractId: c.id, clientId: c.clientId, clientName: c.clientName, productId: c.productId, method: c.method || 'pix', billing,
      currency: c.currency || 'BRL', amountOrig: rate !== 1 ? amountOrig : null,
      kind, label, due: d, ym: ymOf(d), origYm: ymOf(due), amount: amt, status, source,
      paidAt, paidAmount, note: p && p.note, reminders: (p && p.reminders) || [], asaas: a, contractAmount: amount
    }, extra || {}));
  };
  const splitAmounts = (total, n) => {
    const base = Math.floor((total / n) * 100) / 100; const arr = Array(n).fill(base);
    arr[n - 1] = Math.round((total - base * (n - 1)) * 100) / 100; return arr;
  };
  if (c.kind === 'espelho') {
    (c._mirror || []).forEach((a, i) => mk(c.id + '-a' + a.id, 'mensal', (a.description && a.description.length < 40 ? a.description : 'Cobrança') + ' ' + fdateShort(a.dueDate), a.dueDate, Number(a.value) / (fxRate(c) || 1), { n: i + 1 }));
    return out;
  }
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
    const down = Math.min(Number(c.downPayment) || 0, Number(c.value) || 0);
    if (down > 0) mk(c.id + '-e', 'entrada', 'Entrada (sinal)', c.downDate || c.startDate || today(), down, { n: 0, of: n });
    const rest = (Number(c.value) || 0) - down;
    if (rest > 0.004) splitAmounts(rest, n).forEach((a, i) => mk(c.id + '-p' + i, 'parcela', n > 1 ? 'Parcela ' + (i + 1) + '/' + n : (down > 0 ? 'Saldo' : 'Pagamento único'), addMonthsDate(f, i), a, { n: i + 1, of: n }));
  }
  return out;
}
function allInvoices(db, horizonYm) {
  const ax = asaasIndex(db);
  // contratos "espelho do Asaas": cada cobrança do cliente no Asaas vira um recebível
  vals(db.contracts).filter(c => c.kind === 'espelho' && c.asaasCustomer).forEach(c => {
    c._mirror = vals(db.asaas).filter(a => a.customer === c.asaasCustomer && !a.deleted && (!c.startDate || a.dueDate >= c.startDate) && (!c.endDate || a.dueDate <= c.endDate)).sort((x, y) => (x.dueDate || '').localeCompare(y.dueDate || ''));
    c._mirror.forEach(a => (ax[c.id + '-a' + a.id] = a));
  });
  return vals(db.contracts).flatMap(c => invoicesOf(c, db.payments, horizonYm, ax));
}

/* ---------- conciliação: encontra erros de cobrança ---------- */
const ISSUE_TYPES = {
  nao_emitida: { l: 'Cobrança não emitida no Asaas', t: 'warn', h: 'Ainda não existe no Asaas. Se o cliente já tem assinatura lá, clique em Sincronizar: o sistema vincula sozinho.' },
  valor: { l: 'Contrato com valor diferente do Asaas', t: 'info', h: 'O sistema já usa o valor do Asaas. Se o preço mudou de vez, atualize o contrato.' },
  pago_aqui_aberto_la: { l: 'Pago aqui, em aberto no Asaas', t: 'bad', h: 'Você deu baixa manual, mas o Asaas ainda vai cobrar o cliente. Marque como "recebido em dinheiro" no Asaas ou cancele lá.' },
  problema: { l: 'Estorno / chargeback', t: 'bad', h: 'O pagamento foi estornado ou contestado.' },
  excluida: { l: 'Excluída no Asaas', t: 'warn', h: 'A cobrança foi removida no Asaas mas segue em aberto aqui.' },
  orfa: { l: 'Cobrança no Asaas sem contrato', t: 'info', h: 'Existe no Asaas, mas não está ligada a nenhum contrato do Visions OS.' },
  atrasada: { l: 'Atrasada', t: 'bad', h: 'Vencida e não paga.' },
  sem_documento: { l: 'Cliente sem CPF/CNPJ', t: 'warn', h: 'Necessário para emitir pelo Asaas.' }
};
function reconcile(db, inv) {
  const S = db.S; const out = [];
  const emitUntil = addDays(today(), Number(S.asaas.emitDays) || 10);
  const refs = new Set(inv.map(i => i.id));
  inv.forEach(i => {
    if (i.status === 'cancelado') return;
    const a = i.asaas; const p = db.payments[i.id];
    if (i.billing === 'asaas') {
      if (!a && i.status !== 'pago' && i.due <= emitUntil) {
        const cl = db.clients[i.clientId];
        out.push({ type: cl && (onlyDigits(cl.document) || cl.asaasId) ? 'nao_emitida' : 'sem_documento', i });
      }
      if (a && !a.deleted && Math.abs(Number(a.value) - i.contractAmount) > 0.01 && i.origYm >= ymNow()) out.push({ type: 'valor', i, extra: 'Asaas: ' + money2(a.value) + ' · contrato: ' + money2(i.contractAmount) });
      if (a && !a.deleted && p && p.status === 'pago' && (a.status === 'PENDING' || a.status === 'OVERDUE')) out.push({ type: 'pago_aqui_aberto_la', i });
      if (a && ASAAS_PROBLEM.includes(a.status)) out.push({ type: 'problema', i, extra: ASAAS_LABEL[a.status] || a.status });
      if (a && a.deleted && i.status !== 'pago') out.push({ type: 'excluida', i });
    }
    if (i.status === 'atrasado') out.push({ type: 'atrasada', i, extra: diffDays(i.due, today()) + ' dias' });
  });
  const linked = linkedAsaasIds(db);
  vals(db.asaas).forEach(a => { if (!a.deleted && !refs.has(a.externalReference) && !linked.has(a.id) && !ASAAS_PAID.includes(a.status) && a.status !== 'REFUNDED') out.push({ type: 'orfa', a }); });
  return out;
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
  const mrr = sum(recurring, c => brlValue(c));
  // competência
  const mensalidades = sum(invs.filter(i => i.kind === 'mensal' && i.origYm === ym && i.status !== 'cancelado'), i => i.amount);
  let projetos = 0;
  if (S.projectRecognition === 'parcela') {
    projetos = sum(invs.filter(i => (i.kind === 'parcela' || i.kind === 'entrada' || i.kind === 'setup') && i.origYm === ym && i.status !== 'cancelado'), i => i.amount);
  } else {
    projetos = sum(cts.filter(c => c.kind === 'projeto' && !c.canceled && ymOf(c.startDate) === ym), c => brlValue(c))
      + sum(cts.filter(c => c.kind === 'recorrente' && ymOf(c.startDate) === ym), c => brlSetup(c));
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
  const churned = cts.filter(c => (c.kind === 'recorrente' || (c.kind === 'espelho' && n0(c.value) > 0)) && ymOf(c.noticeDate || c.endDate) === ym && (c.noticeDate || c.endDate));
  const novoMrr = sum(novos, c => brlValue(c));
  const churnMrr = sum(churned, c => brlValue(c));
  const projetosVendidos = cts.filter(c => c.kind === 'projeto' && ymOf(c.startDate) === ym && !c.canceled);
  return {
    ym, mrr, recurring, receita, mensalidades, projetos, caixa, recebidos, previsto, aReceber, atrasadas,
    atrasadoTotal: sum(atrasadas, i => i.amount), custos, despesas, despesasCac, imposto,
    resultadoCaixa: caixa - despesas - imposto, resultadoCompetencia: receita - despesas - imposto,
    novos, churned, novoMrr, churnMrr, netMrr: novoMrr - churnMrr, projetosVendidos,
    vendasValor: novoMrr + sum(projetosVendidos, c => brlValue(c)) + sum(novos, c => brlSetup(c))
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
