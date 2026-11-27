/* ============================================================
   FINANCEIRO — competência x caixa, recebíveis, contratos, despesas
   ============================================================ */
const METHODS = [{ v: 'pix', l: 'Pix' }, { v: 'boleto', l: 'Boleto' }, { v: 'cartao', l: 'Cartão de crédito' }, { v: 'transferencia', l: 'Transferência' }, { v: 'dinheiro', l: 'Dinheiro' }];
const methodL = v => (METHODS.find(m => m.v === v) || {}).l || v || '—';
const ST_TAG = { pago: ['good', 'Pago'], atrasado: ['bad', 'Atrasado'], pendente: ['', 'A receber'], cancelado: ['', 'Cancelado'], problema: ['bad', 'Estorno/contestação'] };
const ctStatusTag = s => ({ ativo: ['good', 'Ativo'], aviso: ['warn', 'Em aviso'], encerrado: ['', 'Encerrado'], projeto: ['info', 'Projeto'] }[s] || ['', s]);
const cv = (c, v) => (c.currency && c.currency !== 'BRL' ? moneyCur(v, c.currency) : money(v));
const condText = c => c.kind === 'espelho' ? 'Espelho do Asaas: todas as cobranças do cliente' + (c.value ? ' · ≈ ' + cv(c, c.value) + '/mês' : '') : c.kind === 'recorrente'
  ? cv(c, c.value) + '/mês · dia ' + (c.payDay || '—') + (c.setupValue > 0 ? ' + setup ' + cv(c, c.setupValue) + (c.setupInstallments > 1 ? ' em ' + c.setupInstallments + 'x' : '') : '')
  : (Number(c.downPayment) > 0 ? 'entrada ' + cv(c, c.downPayment) + ' + ' : '') + (Number(c.installments) > 1 ? c.installments + 'x de ' + cv(c, (c.value - (Number(c.downPayment) || 0)) / c.installments) : (Number(c.downPayment) > 0 ? 'saldo' : 'à vista')) + ' · total ' + cv(c, c.value);

/* ---------- visão geral ---------- */
function FinancePage({ nav }) {
  const db = useDB(); const S = db.S;
  const [ym, setYm] = useState(ymNow());
  const inv = useMemo(() => allInvoices(db, addMonths(ymNow(), 7)), [db.contracts, db.payments, db.asaas, db.settings]);
  const f = monthFinance(db, ym, inv);
  const months = Array.from({ length: 9 }, (_, i) => addMonths(ymNow(), i - 5));
  const fins = months.map(m => monthFinance(db, m, inv));
  const cashOrPrev = (x) => x.ym < ymNow() ? x.caixa : x.ym === ymNow() ? x.caixa + x.aReceber : x.previsto;
  // fluxo projetado
  const flow = Array.from({ length: 6 }, (_, i) => addMonths(ymNow(), i)).map(m => {
    const x = monthFinance(db, m, inv);
    const ent = m === ymNow() ? x.caixa + x.aReceber : x.previsto;
    return { m, ent, sai: x.despesas, saldo: ent - x.despesas };
  });
  let acc = 0; flow.forEach(r => { acc += r.saldo; r.acc = acc; });
  const gap = f.receita - f.caixa;
  return html`<div>
    <${PageH} t="Financeiro" s="Receita por competência × caixa realmente recebido, recebíveis e resultado.">
      <${MonthNav} v=${ym} on=${setYm}/>
      <${Btn} v="pri" icon="plus" on=${() => nav.newContract()}>Nova venda</${Btn}>
    </${PageH}>
    <${MonthSummary} db=${db} ym=${ym} inv=${inv} f=${f} nav=${nav}/>
    <${RevenueByProduct} db=${db} ym=${ym} inv=${inv} nav=${nav}/>
    <div class="grid g-side mb16">
      <div class="card"><div class="card-h"><h3>Receita × Caixa</h3><span class="sub">meses futuros = previsto pelas parcelas e mensalidades</span></div>
        <${BarChart} labels=${months.map(monthShort)} highlight=${months.indexOf(ym)} fmt=${v => (Math.abs(v) >= 1000 ? 'R$' + num(v / 1000, 0) + 'k' : money(v))}
          series=${[{ name: 'Receita (competência)', data: fins.map(x => x.receita), color: 'var(--s1)' }, { name: 'Caixa (recebido / previsto)', data: fins.map(cashOrPrev), color: 'var(--s3)' }, { name: 'Despesas', data: fins.map(x => x.despesas), color: 'var(--s2)' }]}/>
      </div>
      <div class="card"><div class="card-h"><h3>MRR total (ativo + aviso) — ${monthLabel(ym)}</h3></div>
        <div class="calc-out"><div class="big">${money(f.mrr)}</div><div class="small muted">${f.recurring.length} contratos recorrentes no mês, incluindo quem está em aviso</div></div>
        <div class="hr"/>
        <div class="row between small mb8"><span class="muted">+ Novo MRR (${f.novos.length})</span><b class="delta-up num">${money(f.novoMrr)}</b></div>
        <div class="row between small mb8"><span class="muted">− Churn / avisos (${f.churned.length})</span><b class="delta-down num">${money(f.churnMrr)}</b></div>
        <div class="row between"><span class="b">= MRR líquido</span><b class=${'num ' + (f.netMrr >= 0 ? 'delta-up' : 'delta-down')}>${money(f.netMrr)}</b></div>
        ${f.projetosVendidos.length > 0 && html`<div class="row between small mt12"><span class="muted">Projetos vendidos (${f.projetosVendidos.length})</span><b class="num">${money(sum(f.projetosVendidos, c => c.value))}</b></div>`}
      </div>
    </div>
    <div class="grid g2">
      <div class="card flush"><div class="lgroup"><span>Fluxo de caixa projetado</span><span>entradas previstas − despesas</span></div>
        <table class="tbl"><thead><tr><th>Mês</th><th class="r">Entradas</th><th class="r">Saídas</th><th class="r">Saldo</th><th class="r">Acumulado</th></tr></thead><tbody>
        ${flow.map(r => html`<tr key=${r.m}><td class="b" style=${{ textTransform: 'capitalize' }}>${monthShort(r.m)}</td><td class="r num">${money(r.ent)}</td><td class="r num">${money(r.sai)}</td>
          <td class="r num b" style=${{ color: r.saldo >= 0 ? 'var(--good)' : 'var(--bad)' }}>${money(r.saldo)}</td><td class="r num">${money(r.acc)}</td></tr>`)}</tbody></table>
        <div class="small faint" style=${{ padding: '10px 14px' }}>Considera contratos ativos, avisos até o fim e parcelas pendentes. Não inclui vendas futuras.</div>
      </div>
      <div class="card flush"><div class="lgroup bad"><span>Inadimplência (meses anteriores)</span><span>${money(sum(f.atrasadas.filter(isInadimplente), i => i.amount))}</span></div>
        ${f.atrasadas.filter(isInadimplente).length ? f.atrasadas.filter(isInadimplente).sort((a, b) => a.due.localeCompare(b.due)).slice(0, 8).map(i => html`<${InvRow} key=${i.id} i=${i}/>`) : html`<${Empty} t="Nenhuma inadimplência 👏" s=""/>`}
        ${f.atrasadas.filter(isInadimplente).length > 8 && html`<div style=${{ padding: 10 }}><${Btn} sz="sm" on=${() => { LS.set('vos7_rec_tab', 'inad'); nav.go('recebiveis'); }}>Ver todas</${Btn}></div>`}
      </div>
    </div>
  </div>`;
}

/* ---------- recebíveis ---------- */
function InvRow({ i, onClick }) {
  const [pay, setPay] = useState(false);
  const [t, l] = ST_TAG[i.status];
  return html`<div class="lrow">
    <div style=${{ width: 54, textAlign: 'center' }}><div class="b num">${pad(parseD(i.due).getDate())}</div><div class="xs faint">${MSHORT[parseD(i.due).getMonth()]}</div></div>
    <div style=${{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick=${() => setPay(true)}><div class="main-t ellipsis">${i.clientName || '—'}</div>
      <div class="xs faint row" style=${{ gap: 6, flexWrap: 'wrap' }}><${Tag} t=${t} style=${{ fontSize: 10.5, padding: '0 6px' }}>${l}</${Tag}><${BillingBadge} i=${i}/><span>${i.label}${i.billing === 'asaas' ? (i.asaas ? ' · ' + (ASAAS_LABEL[i.asaas.status] || i.asaas.status) : '') : ' · ' + methodL(i.method)}${i.status === 'pago' ? ' · recebido ' + fdate(i.paidAt) : ''}</span></div></div>
    <div class="num b" style=${{ textAlign: 'right', whiteSpace: 'nowrap' }}>${i.amountOrig != null && i.status !== 'pago' ? html`<span>${moneyCur(i.amountOrig, i.currency)}<div class="xs faint" style=${{ fontWeight: 500 }}>≈ ${money(i.amount)}</div></span>` : money(i.status === 'pago' ? i.paidAmount : i.amount, true)}</div>
    <${InvActions} i=${i}/>
    ${i.status !== 'pago' && i.status !== 'cancelado' ? html`<${Btn} sz="xs" v="good" icon="check" on=${() => quickPay(i)} title="Marcar como recebido hoje">Recebido</${Btn}>` : html`<${Btn} sz="xs" v="ghost" on=${() => setPay(true)}>Detalhes</${Btn}>`}
    ${pay && html`<${PayModal} i=${i} onClose=${() => setPay(false)}/>`}
  </div>`;
}
function netOf(i) { const S = settingsOf(store.data); return i.method === 'cartao' && S.cardFee ? Math.round(i.amount * (1 - S.cardFee / 100) * 100) / 100 : i.amount; }
function quickPay(i) {
  if (i.billing === 'asaas' && i.asaas && !i.asaas.deleted && !confirm('Esta cobrança está no Asaas. Se o cliente pagou por lá, a baixa é automática. Dar baixa manual mesmo assim? (Depois, em Cobranças, você pode dar baixa no Asaas também para ele não cobrar de novo.)')) return;
  const prev = store.data.payments[i.id];
  store.put('payments', Object.assign({}, prev || {}, { id: i.id, contractId: i.contractId, status: 'pago', paidAt: today(), paidAmount: netOf(i) }));
  toast('Recebimento de ' + money(netOf(i), true) + ' registrado.', { l: 'Desfazer', f: () => prev ? store.restore('payments', prev) : store.del('payments', i.id) });
}
function PayModal({ i, onClose }) {
  const prev = store.data.payments[i.id] || {};
  const [f, setF] = useState({ paidAt: i.paidAt || today(), paidAmount: i.status === 'pago' ? i.paidAmount : netOf(i), amount: i.amount, due: i.due, note: prev.note || '' });
  const F = k => v => setF(p => ({ ...p, [k]: v }));
  const base = { id: i.id, contractId: i.contractId };
  const savePaid = () => { store.put('payments', Object.assign({}, prev, base, { status: 'pago', paidAt: f.paidAt, paidAmount: n0(f.paidAmount), amount: n0(f.amount), due: f.due, note: f.note })); onClose(); toast('Recebimento salvo.'); };
  const saveOpen = () => { store.put('payments', Object.assign({}, prev, base, { status: 'aberto', paidAt: '', paidAmount: 0, amount: n0(f.amount), due: f.due, note: f.note })); onClose(); toast('Cobrança atualizada.'); };
  const cancel = () => { store.put('payments', Object.assign({}, prev, base, { status: 'cancelado', note: f.note })); onClose(); toast('Cobrança cancelada (não entra mais no previsto).'); };
  return html`<${Modal} title=${i.clientName + ' — ' + i.label} onClose=${onClose}
    footer=${html`${i.status !== 'cancelado' && html`<${Btn} v="ghost" cls="danger" on=${cancel}>Cancelar cobrança</${Btn}>`}<span style=${{ flex: 1 }}/><${Btn} on=${saveOpen}>${i.status === 'pago' ? 'Marcar como não pago' : 'Salvar sem receber'}</${Btn}><${Btn} v="good" on=${savePaid}>Salvar como recebido</${Btn}>`}>
    ${i.asaas && html`<div class="callout info mb12"><b class="t">Asaas: ${ASAAS_LABEL[i.asaas.status] || i.asaas.status}</b>${money2(i.asaas.value)} · vence ${fdate(i.asaas.dueDate)}${i.asaas.netValue != null ? ' · líquido ' + money2(i.asaas.netValue) : ''}${i.asaas.invoiceUrl ? html` · <a href=${i.asaas.invoiceUrl} target="_blank" rel="noopener">abrir fatura</a>` : ''}</div>`}
    <div class="form c2">
      <${Money} label="Valor da cobrança (R$)" v=${f.amount} on=${F('amount')}/>
      <${Input} label="Vencimento" type="date" v=${f.due} on=${F('due')}/>
      <${Money} label="Valor recebido (líquido)" v=${f.paidAmount} on=${F('paidAmount')} hint=${i.amountOrig != null ? 'Cobrança de ' + moneyCur(i.amountOrig, i.currency) + ': informe quanto caiu em reais (câmbio e taxas)' : i.method === 'cartao' ? 'Já descontada a taxa do cartão de ' + settingsOf(store.data).cardFee + '%' : ''}/>
      <${Input} label="Data do recebimento" type="date" v=${f.paidAt} on=${F('paidAt')}/>
      <${Input} cls="span3" label="Observação" v=${f.note} on=${F('note')} ph="Ex: pagou com juros, comprovante no Drive…"/>
    </div></${Modal}>`;
}
function ReceivablesPage({ nav }) {
  const db = useDB();
  const [tab, setTab] = useState(() => { const t0 = LS.get('vos7_rec_tab', 'mes'); LS.set('vos7_rec_tab', 'mes'); return t0; }); const [q, setQ] = useState(''); const [ym, setYm] = useState(ymNow());
  const [bulk, setBulk] = useState(null);
  const inv = useMemo(() => allInvoices(db, addMonths(ymNow(), 12)), [db.contracts, db.payments, db.asaas, db.settings]);
  const t = today(), in30 = addDays(t, 30);
  let list = inv.filter(i => {
    if (q && !(i.clientName || '').toLowerCase().includes(q.toLowerCase())) return false;
    if (tab === 'atrasado') return i.status === 'atrasado' && !isInadimplente(i);
    if (tab === 'inad') return isInadimplente(i);
    if (tab === 'mes') return i.ym === ym && i.status !== 'cancelado' && !isInadimplente(i);
    if (tab === 'prox') return i.status !== 'pago' && i.status !== 'cancelado' && i.due >= t && i.due <= in30;
    if (tab === 'recebido') return i.status === 'pago' && ymOf(i.paidAt) === ym;
    return true;
  }).sort((a, b) => (tab === 'recebido' ? (a.paidAt || '').localeCompare(b.paidAt || '') : a.due.localeCompare(b.due)));
  const atr = inv.filter(i => i.status === 'atrasado' && !isInadimplente(i));
  const inad = inv.filter(isInadimplente);
  const mes = inv.filter(i => i.ym === ym && i.status !== 'cancelado' && !isInadimplente(i));
  const recMes = inv.filter(i => i.status === 'pago' && ymOf(i.paidAt) === ym);
  const tot = sum(list, i => (i.status === 'pago' ? i.paidAmount : i.amount));
  return html`<div>
    <${PageH} t="Recebíveis" s="Todas as mensalidades e parcelas em um lugar. Clique em Recebido quando o dinheiro cair.">
      ${(tab === 'mes' || tab === 'recebido') && html`<${MonthNav} v=${ym} on=${setYm}/>`}
      ${list.some(i => i.status === 'pendente' || i.status === 'atrasado') && html`<${Btn} icon="check" on=${() => setBulk(list.filter(i => i.status === 'pendente' || i.status === 'atrasado'))}>Dar baixa em várias</${Btn}>`}
    </${PageH}>
    <div class="grid g5 mb16">
      <${Kpi} l="Atrasado neste mês" v=${money(sum(atr, i => i.amount))} s=${atr.length ? atr.length + ' cobranças para cobrar já' : 'nenhuma'} tone=${atr.length ? 'bad' : null}/>
      <div class="kpi" style=${{ cursor: 'pointer', borderStyle: 'dashed' }} onClick=${() => setTab('inad')}><div class="l">Inadimplência (à parte)</div><div class="v" style=${{ color: 'var(--text-2)' }}>${money(sum(inad, i => i.amount))}</div><div class="s">${inad.length} cobranças de meses anteriores · não entram nos totais</div></div>
      <${Kpi} l=${'Previsto em ' + monthShort(ym)} v=${money(sum(mes, i => i.amount))} s=${mes.length + ' cobranças'}/>
      <${Kpi} l=${'Recebido em ' + monthShort(ym)} v=${money(sum(recMes, i => i.paidAmount))} tone="good"/>
      <${Kpi} l="Falta receber no mês" v=${money(sum(mes.filter(i => i.status !== 'pago'), i => i.amount))}/>
    </div>
    <div class="row wrap mb12">
      <${Seg} v=${tab} on=${setTab} opts=${[{ v: 'mes', l: 'Vencem no mês' }, { v: 'atrasado', l: 'Atrasados do mês (' + atr.length + ')' }, { v: 'prox', l: 'Próximos 30 dias' }, { v: 'recebido', l: 'Recebidos no mês' }, { v: 'inad', l: 'Inadimplentes (' + inad.length + ')' }, { v: 'todos', l: 'Todos' }]}/>
      <div style=${{ flex: '1 1 200px', maxWidth: 300, marginLeft: 'auto' }}><${Input} v=${q} on=${setQ} ph="Buscar cliente…"/></div>
    </div>
    <div class="card flush">
      <div class="lgroup"><span>${list.length} cobranças${tab === 'inad' ? ' · vencidas antes de ' + monthLabel(ymNow()) : ''}</span><span class="num">${money(tot)}</span></div>
      ${tab === 'inad' && html`<div class="small muted" style=${{ padding: '8px 14px' }}>Clientes com cobranças em atraso desde meses anteriores. Ficam fora dos totais de "a receber" para não inflar o mês. Use o sininho para mandar lembrete ou dê baixa quando pagarem.</div>`}
      ${list.slice(0, 300).map(i => html`<${InvRow} key=${i.id} i=${i}/>`)}
      ${bulk && html`<${BulkPayModal} list=${bulk} onClose=${() => setBulk(null)}/>`}
      ${!list.length && html`<${Empty} t="Nada por aqui" s="Cadastre vendas em Contratos para gerar as cobranças automaticamente."><${Btn} v="pri" icon="plus" on=${() => nav.newContract()}>Nova venda</${Btn}></${Empty}>`}
    </div>
  </div>`;
}

/* ---------- contratos ---------- */
function ContractForm({ init, onClose, onSaved, deal }) {
  const db = useDB(); const S = db.S;
  const firstProd = S.products.find(p => !p.legacy) || S.products[0] || {};
  const [f, setF] = useState(() => Object.assign({
    clientId: '', clientName: '', productId: firstProd.id, kind: firstProd.kind || 'recorrente', value: firstProd.price || '', payDay: '10',
    startDate: today(), firstDue: today(), installments: 1, method: 'pix', setupValue: firstProd.setup || '', setupInstallments: 1, setupFirstDue: today(),
    channelId: '', ownerId: CURRENT_USER.id, fidelity: '', notes: '', phone: '', document: '', email: '', downPayment: '', downDate: '',
    billing: S.asaas.enabled ? 'asaas' : 'manual', asaasBilling: '', currency: 'BRL', fxRate: '', payLink: '', payInstructions: '', reminderLang: 'en'
  }, init || {}));
  const curCl = f.clientId ? db.clients[f.clientId] : null;
  const [doc, setDoc] = useState(() => (curCl && curCl.document) || f.document || '');
  const sym = f.billing === 'exterior' ? (CURRENCIES[f.currency] || f.currency) : 'R$';
  const F = k => v => setF(p => ({ ...p, [k]: v }));
  const isNew = !f.id;
  const pickProd = id => { const p = prodOf(S, id) || {}; const cur = p.currency && p.currency !== 'BRL' ? p.currency : null;
    setF(x => ({ ...x, productId: id, kind: p.kind || x.kind, listPrice: p.price || '', discount: '', value: isNew || x.productId !== id ? (p.price || x.value) : x.value, setupValue: isNew ? (p.setup || '') : x.setupValue,
      ...(cur ? { billing: 'exterior', currency: cur } : (x.billing === 'exterior' && isNew ? { billing: S.asaas.enabled ? 'asaas' : 'manual', currency: 'BRL' } : {})) })); };
  const prodNow = prodOf(S, f.productId) || {};
  const setDiscount = v => setF(x => { const lp = n0(x.listPrice || prodNow.price); const dv = String(v).includes('%') ? lp * n0(String(v).replace('%', '')) / 100 : n0(v); return { ...x, discount: v, value: lp ? Math.round((lp - dv) * 100) / 100 : x.value }; });
  const clients = vals(db.clients).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  const preview = useMemo(() => {
    const c = Object.assign({ id: 'preview' }, f, { value: n0(f.value), setupValue: n0(f.setupValue), currency: f.billing === 'exterior' ? f.currency : 'BRL', fxRate: n0(f.fxRate) || '' });
    if (c.kind === 'recorrente') c.endDate = ''; // prévia sem término
    return invoicesOf(c, {}, addMonths(ymOf(f.firstDue || today()), 2)).filter(i => i.kind !== 'mensal' || i.n <= 3);
  }, [f]);
  const save = () => {
    const name = (f.clientName || '').trim() || ((db.clients[f.clientId] || {}).name || '');
    if (!name) return toast('Informe o cliente.');
    if (!n0(f.value)) return toast('Informe o valor.');
    let clientId = f.clientId;
    if (!clientId) {
      const ex = clients.find(c => c.name.toLowerCase() === name.toLowerCase());
      clientId = ex ? ex.id : store.put('clients', { name, phone: f.phone, email: f.email, document: doc, channelId: f.channelId, since: f.startDate, country: f.billing === 'exterior' ? 'exterior' : 'BR' }).id;
    }
    const clNow = store.data.clients[clientId];
    if (clNow && doc && clNow.document !== doc) store.put('clients', Object.assign({}, clNow, { document: doc }));
    if (f.billing === 'asaas' && !onlyDigits(doc)) { if (!confirm('Sem CPF/CNPJ não dá para emitir no Asaas. Salvar mesmo assim e completar depois?')) return; }
    const orig = f.id ? store.data.contracts[f.id] : null;
    const sig = c => [c.kind, n0(c.value), Math.max(1, n0(c.installments)), n0(c.downPayment), c.downDate || '', c.firstDue || '', n0(c.setupValue), Math.max(1, n0(c.setupInstallments)), c.setupFirstDue || ''].join('|');
    if (orig && sig(orig) !== sig(f)) {
      const old = vals(store.data.payments).filter(p => p.contractId === f.id || String(p.id).startsWith(f.id + '-'));
      const parcOld = old.filter(p => !/-m\d{4}-\d{2}$/.test(p.id));
      if (parcOld.length) {
        if (!confirm('Você mudou valor, entrada ou parcelas deste contrato. As ' + parcOld.length + ' baixa(s) de parcelas/entrada/setup registradas nele serão apagadas, para você marcar de novo só o que foi pago (em Recebíveis → Dar baixa em várias). As mensalidades não são afetadas. Continuar?')) return;
        parcOld.forEach(p => store.del('payments', p.id));
      }
    }
    const obj = Object.assign({}, f, { downPayment: f.kind === 'projeto' ? n0(f.downPayment) : 0, currency: f.billing === 'exterior' ? f.currency : 'BRL', fxRate: f.billing === 'exterior' ? n0(f.fxRate) || '' : '', clientId, clientName: name, value: n0(f.value), setupValue: f.kind === 'recorrente' ? n0(f.setupValue) : 0, installments: Math.max(1, n0(f.installments)), setupInstallments: Math.max(1, n0(f.setupInstallments)), payDay: n0(f.payDay) || parseD(f.firstDue).getDate() });
    if (deal) obj.dealId = deal.id;
    const saved = store.put('contracts', obj);
    if (deal && deal.stage !== 'ganho') store.put('deals', Object.assign({}, deal, stagePatch(deal, 'ganho'), { contractId: saved.id, clientId }, logActivity(deal, 'nota', 'Venda fechada: ' + prodName(S, f.productId) + ' — ' + condText(obj))));
    toast(isNew ? (deal ? '🎉 Venda registrada! Cobranças geradas em Recebíveis.' : 'Contrato criado. Cobranças geradas em Recebíveis.') : 'Contrato atualizado.');
    onSaved && onSaved(saved); onClose();
  };
  const P = [1, 2, 3, 4, 5, 6, 10, 12];
  return html`<${Modal} title=${deal ? '🎉 Registrar venda — ' + deal.name : isNew ? 'Nova venda / contrato' : 'Editar contrato'} size="lg" onClose=${onClose}
    footer=${html`<${Btn} on=${onClose}>Cancelar</${Btn}><${Btn} v="pri" on=${save}>${isNew ? 'Registrar venda' : 'Salvar'}</${Btn}>`}>
    <div class="form c2">
      <${Field} label="Cliente *">${f.clientId && !f._typing ? html`<div class="row"><${Select} v=${f.clientId} on=${F('clientId')} opts=${clients.map(c => ({ v: c.id, l: c.name }))}/><${Btn} sz="sm" v="ghost" on=${() => setF({ ...f, clientId: '', _typing: true })}>Outro</${Btn}></div>`
      : html`<div><input class="inp" list="vos-clients" value=${f.clientName} placeholder="Nome do cliente / empresa" onChange=${e => { const v = e.target.value; const ex = clients.find(c => c.name === v); setF({ ...f, clientName: v, clientId: ex ? ex.id : '', _typing: !ex }); }}/>
          <datalist id="vos-clients">${clients.map(c => html`<option key=${c.id} value=${c.name}/>`)}</datalist></div>`}</${Field}>
      <${Select} label="Canal de origem (p/ CAC)" v=${f.channelId} on=${F('channelId')} ph="—" opts=${S.channels.map(c => ({ v: c.id, l: c.name }))}/>
      <${Field} label="Produto" cls="span3"><${Chips} v=${f.productId} on=${pickProd} opts=${S.products.filter(p => !p.legacy || p.id === f.productId).map(p => ({ v: p.id, l: p.name + (p.price ? ' · ' + (p.currency && p.currency !== 'BRL' ? moneyCur(p.price, p.currency) : money(p.price)) : '') }))}/></${Field}>
      ${prodNow.allowDiscount && html`<div class="span3 card tight" style=${{ background: 'var(--surface-2)' }}><div class="form c3">
        <${Field} label="Preço de tabela"><div class="b num" style=${{ padding: '9px 0' }}>${money(n0(f.listPrice || prodNow.price))}</div></${Field}>
        <${Input} label="Desconto" v=${f.discount} on=${setDiscount} ph="Ex: 500 ou 10%" hint="Em reais ou em %"/>
        <${Field} label="Valor final"><div class="b num" style=${{ padding: '9px 0', color: 'var(--good)' }}>${money(n0(f.value))}</div></${Field}></div></div>`}
      <${Field} label="Como cobrar" cls="span3"><${Seg} v=${f.billing} on=${v => setF(x => ({ ...x, billing: v, currency: v === 'exterior' ? (x.currency && x.currency !== 'BRL' ? x.currency : 'USD') : 'BRL' }))} opts=${[{ v: 'asaas', l: 'Asaas (boleto · Pix · cartão)' }, { v: 'manual', l: 'Manual (Brasil)' }, { v: 'exterior', l: '🌎 Cliente do exterior' }]}/></${Field}>
      ${f.billing === 'asaas' && html`<${Input} label="CPF / CNPJ do cliente" v=${doc} on=${setDoc} ph="Obrigatório para o Asaas"/>
        <${Select} label="Forma no Asaas" v=${f.asaasBilling} on=${F('asaasBilling')} ph=${'Padrão (' + ({ UNDEFINED: 'cliente escolhe', PIX: 'Pix', BOLETO: 'boleto', CREDIT_CARD: 'cartão' }[S.asaas.billingType] || '') + ')'} opts=${[{ v: 'UNDEFINED', l: 'Cliente escolhe' }, { v: 'PIX', l: 'Pix' }, { v: 'BOLETO', l: 'Boleto' }, { v: 'CREDIT_CARD', l: 'Cartão de crédito' }]}/>`}
      ${f.billing === 'exterior' && html`<div class="span3 card tight" style=${{ background: 'var(--surface-2)' }}><div class="form c3">
        <${Select} label="Moeda" v=${f.currency} on=${F('currency')} opts=${['USD', 'EUR', 'GBP'].map(c => ({ v: c, l: c }))}/>
        <${Input} label="Cotação fixa (opcional)" type="number" v=${f.fxRate} on=${F('fxRate')} ph=${'hoje ' + num(S.fx[f.currency] || 0, 2)} hint=${'Vazio = cotação do dia (' + (CURRENCIES[f.currency] || f.currency) + ' 1 = ' + money2(S.fx[f.currency] || 0) + ')'}/>
        <${Select} label="Idioma do lembrete" v=${f.reminderLang} on=${F('reminderLang')} opts=${[{ v: 'en', l: 'English' }, { v: 'es', l: 'Español' }, { v: 'pt', l: 'Português' }]}/>
        <${Input} cls="span2" label="Link de pagamento" v=${f.payLink} on=${F('payLink')} ph="Wise, PayPal, Stripe…"/>
        <${Input} label="E-mail do financeiro" v=${f.email} on=${F('email')}/>
        <${Textarea} cls="span3" label="Instruções de pagamento (vão no lembrete)" v=${f.payInstructions} on=${F('payInstructions')} rows=${2} ph="Ex: dados bancários internacionais / IBAN"/></div></div>`}
      <${Field} label="Tipo de cobrança" cls="span3"><${Seg} v=${f.kind} on=${F('kind')} opts=${[{ v: 'recorrente', l: 'Recorrente (mensalidade)' }, { v: 'projeto', l: 'Projeto / valor fechado (parcelável)' }]}/></${Field}>
      ${f.kind === 'recorrente' ? html`
        <${Input} type="number" pre=${sym} label="Mensalidade" v=${f.value} on=${F('value')}/>
        <${Input} label="Dia de vencimento" type="number" min="1" max="31" v=${f.payDay} on=${F('payDay')}/>
        <${Input} label="Início do contrato" type="date" v=${f.startDate} on=${v => setF({ ...f, startDate: v, firstDue: f.firstDue === f.startDate ? v : f.firstDue })} hint="Conta como venda e MRR neste mês"/>
        <${Input} label="1º vencimento" type="date" v=${f.firstDue} on=${F('firstDue')}/>
        <${Input} label="Fidelidade (meses)" type="number" v=${f.fidelity} on=${F('fidelity')} ph="Ex: 6"/>
        ${f.billing !== 'asaas' ? html`<${Select} label="Forma de pagamento" v=${f.method} on=${F('method')} opts=${METHODS}/>` : html`<div/>`}
        <div class="span3 card tight" style=${{ background: 'var(--surface-2)' }}>
          <div class="b small mb8">Setup / implantação (opcional)</div>
          <div class="form c3"><${Input} type="number" pre=${sym} label="Valor do setup" v=${f.setupValue} on=${F('setupValue')}/>
            <${Input} label="Parcelas" type="number" min="1" v=${f.setupInstallments} on=${F('setupInstallments')}/>
            <${Input} label="1ª parcela" type="date" v=${f.setupFirstDue} on=${F('setupFirstDue')}/></div></div>
      ` : html`
        <${Input} type="number" pre=${sym} label="Valor total do projeto" v=${f.value} on=${F('value')}/>
        ${f.billing !== 'asaas' ? html`<${Select} label="Forma de pagamento" v=${f.method} on=${F('method')} opts=${METHODS}/>` : html`<div/>`}
        <${Field} label="Parcelas" cls="span3"><div class="row wrap"><${Chips} v=${Number(f.installments)} on=${v => F('installments')(v || 1)} opts=${P.map(n => ({ v: n, l: n === 1 ? 'À vista' : n + 'x' }))}/><input class="inp sm" style=${{ width: 70 }} type="number" min="1" value=${f.installments} onChange=${e => F('installments')(e.target.value)}/></div></${Field}>
        <div class="span3 card tight" style=${{ background: 'var(--surface-2)' }}><div class="b small mb8">Entrada / sinal (opcional)</div>
          <div class="form c2"><${Input} type="number" pre=${sym} label="Valor da entrada" v=${f.downPayment} on=${F('downPayment')} hint=${n0(f.downPayment) > 0 ? 'O restante (' + (sym + ' ' + num(n0(f.value) - n0(f.downPayment), 2)) + ') é dividido nas parcelas acima' : 'Ex: R$ 2.500 de sinal e o resto em parcelas'}/>
            <${Input} label="Data da entrada" type="date" v=${f.downDate} on=${F('downDate')}/></div></div>
        <${Input} label="Data da venda" type="date" v=${f.startDate} on=${v => setF({ ...f, startDate: v, firstDue: f.firstDue === f.startDate ? v : f.firstDue })} hint=${S.projectRecognition === 'venda' ? 'A receita entra inteira neste mês (competência)' : 'A receita entra conforme as parcelas vencem'}/>
        <${Input} label="1ª parcela" type="date" v=${f.firstDue} on=${F('firstDue')}/>
      `}
      <${Select} label="Vendedor" v=${f.ownerId} on=${F('ownerId')} opts=${S.team.map(t => ({ v: t.id, l: t.name }))}/>
      <${Input} label="Observações" v=${f.notes} on=${F('notes')}/>
    </div>
    <div class="card tight mt16" style=${{ background: 'var(--surface-2)' }}>
      <div class="row between mb8"><b class="small">Prévia das cobranças</b><span class="xs faint">${f.kind === 'recorrente' ? 'mostrando os 3 primeiros meses' : ''}</span></div>
      ${preview.map(i => html`<div key=${i.id} class="row between small" style=${{ padding: '3px 0' }}><span>${fdate(i.due)} · ${i.label}</span><b class="num">${i.amountOrig != null ? moneyCur(i.amountOrig, i.currency) + ' ≈ ' + money(i.amount) : money2(i.amount)}</b></div>`)}
      ${f.billing === 'asaas' && html`<div class="xs faint mt8">Com o Asaas conectado, cada cobrança é emitida lá (em Cobranças ou no botão "Emitir") e a baixa acontece sozinha quando o cliente paga.</div>`}
      ${f.method === 'cartao' && html`<div class="xs faint mt8">Cartão: ao marcar como recebido, o sistema sugere o valor líquido descontando ${S.cardFee}% de taxa.</div>`}
    </div>
  </${Modal}>`;
}
function EndContractModal({ c, onClose }) {
  const S = settingsOf(store.data);
  const [mode, setMode] = useState('aviso'); const [d, setD] = useState(today());
  const end = mode === 'aviso' ? addDays(d, S.noticeDays) : d;
  const save = () => { store.put('contracts', Object.assign({}, c, { noticeDate: d, endDate: end })); onClose(); toast('Contrato ' + (mode === 'aviso' ? 'em aviso até ' + fdate(end) : 'encerrado') + '.'); };
  return html`<${Modal} title=${'Encerrar — ' + c.clientName} onClose=${onClose} footer=${html`<${Btn} on=${onClose}>Cancelar</${Btn}><${Btn} v="pri" cls="danger" on=${save}>Confirmar</${Btn}>`}>
    <div class="form"><${Seg} v=${mode} on=${setMode} opts=${[{ v: 'aviso', l: 'Aviso prévio (' + S.noticeDays + ' dias)' }, { v: 'agora', l: 'Encerrar na data' }]}/>
      <${Input} label=${mode === 'aviso' ? 'Data em que o cliente avisou' : 'Data de encerramento'} type="date" v=${d} on=${setD}/>
      <div class="callout info">Último dia do contrato: <b>${fdate(end)}</b>. Mensalidades com vencimento até essa data continuam sendo cobradas; o churn é contado em <b>${monthLabel(ymOf(d))}</b>.</div></div></${Modal}>`;
}
function ContractDrawer({ id, onClose }) {
  const db = useDB(); const S = db.S; const c = db.contracts[id];
  const [edit, setEdit] = useState(false); const [end, setEnd] = useState(false);
  if (!c) return null;
  const inv = invoicesOf(c, db.payments, addMonths(ymNow(), 3));
  const st = contractStatus(c); const [tt, tl] = ctStatusTag(st);
  const paid = sum(inv.filter(i => i.status === 'pago'), i => i.paidAmount);
  const head = html`<div><div class="row between"><div><h3 style=${{ fontSize: 18 }}>${c.clientName}</h3><div class="muted small">${prodName(S, c.productId)} · ${condText(c)}</div></div><button class="btn ghost icon" onClick=${onClose}><${Icon} n="x"/></button></div>
    <div class="row wrap mt12"><${Tag} t=${tt}>${tl}</${Tag}>${c.channelId && html`<${Tag}>${chName(S, c.channelId)}</${Tag}>`}<${Tag}>Início ${fdate(c.startDate)}</${Tag}>${c.endDate && html`<${Tag} t="warn">Término ${fdate(c.endDate)}</${Tag}>`}${c.fidelity && html`<${Tag}>Fidelidade ${c.fidelity}m</${Tag}>`}</div>
    <div class="row wrap mt12">${c.kind !== 'espelho' && html`<${Btn} sz="sm" icon="edit" on=${() => setEdit(true)}>Editar</${Btn}>`}
      ${c.kind === 'espelho' && html`<${Btn} sz="sm" on=${() => { const v = prompt('Valor mensal aproximado (para o MRR e relatórios), em R$:', c.value || ''); if (v != null) store.put('contracts', Object.assign({}, c, { value: n0(v) })); }}>Valor mensal aprox.</${Btn}>`}
      ${(c.kind === 'recorrente' || c.kind === 'espelho') && !c.endDate && html`<${Btn} sz="sm" cls="danger" on=${() => setEnd(true)}>Registrar rescisão</${Btn}>`}
      ${c.endDate && html`<${Btn} sz="sm" on=${() => store.put('contracts', Object.assign({}, c, { endDate: '', noticeDate: '' }))}>Reativar</${Btn}>`}
      <span style=${{ flex: 1 }}/><${Btn} sz="sm" v="ghost" cls="danger" icon="trash" on=${() => { onClose(); delWithUndo('contracts', c.id, 'Contrato'); }}>Excluir</${Btn}></div></div>`;
  return html`<${Drawer} onClose=${onClose} head=${head}>
    <div class="grid g3 mb16"><${Kpi} l="Já recebido" v=${money(paid)} tone="good"/><${Kpi} l="Em aberto" v=${money(sum(inv.filter(i => i.status === 'pendente' || i.status === 'atrasado'), i => i.amount))}/><${Kpi} l="Atrasado" v=${money(sum(inv.filter(i => i.status === 'atrasado'), i => i.amount))} tone=${inv.some(i => i.status === 'atrasado') ? 'bad' : null}/></div>
    <div class="card flush">${inv.map(i => html`<${InvRow} key=${i.id} i=${i}/>`)}</div>
    ${c.notes && html`<div class="callout info mt16">${c.notes}</div>`}
    ${edit && html`<${ContractForm} init=${c} onClose=${() => setEdit(false)}/>`}
    ${end && html`<${EndContractModal} c=${c} onClose=${() => setEnd(false)}/>`}
  </${Drawer}>`;
}
function ContractsPage({ nav }) {
  const db = useDB(); const S = db.S;
  const [tab, setTab] = useState('ativo'); const [q, setQ] = useState('');
  const all = vals(db.contracts).map(c => ({ c, st: contractStatus(c) }));
  const cnt = s => all.filter(x => x.st === s).length;
  const list = all.filter(x => x.st === tab && (!q || (x.c.clientName || '').toLowerCase().includes(q.toLowerCase()))).sort((a, b) => (b.c.startDate || '').localeCompare(a.c.startDate || ''));
  const mrr = sum(all.filter(x => x.st === 'ativo' || x.st === 'aviso'), x => brlValue(x.c));
  return html`<div>
    <${PageH} t="Contratos" s=${'MRR atual ' + money(mrr) + ' · ' + cnt('ativo') + ' recorrentes ativos'}>
      <${Btn} v="pri" icon="plus" on=${() => nav.newContract()}>Nova venda</${Btn}>
    </${PageH}>
    <div class="row wrap mb12"><${Seg} v=${tab} on=${setTab} opts=${[{ v: 'ativo', l: 'Ativos (' + cnt('ativo') + ')' }, { v: 'aviso', l: 'Em aviso (' + cnt('aviso') + ')' }, { v: 'projeto', l: 'Projetos (' + cnt('projeto') + ')' }, { v: 'encerrado', l: 'Encerrados (' + cnt('encerrado') + ')' }]}/>
      <div style=${{ flex: '1 1 200px', maxWidth: 300, marginLeft: 'auto' }}><${Input} v=${q} on=${setQ} ph="Buscar cliente…"/></div></div>
    <div class="card flush tbl-wrap"><table class="tbl"><thead><tr><th>Cliente</th><th>Produto</th><th>Condição</th><th>Pagamento</th><th>Início</th><th class="r">Valor</th></tr></thead><tbody>
      ${list.map(({ c, st }) => html`<tr key=${c.id} class="click" onClick=${() => nav.contract(c.id)}>
        <td><div class="b">${c.clientName}</div>${c.endDate && html`<div class="xs" style=${{ color: 'var(--warn)' }}>termina ${fdate(c.endDate)}</div>`}</td>
        <td class="small">${prodName(S, c.productId)}</td><td class="small">${c.kind === 'espelho' ? 'Espelho do Asaas' : c.kind === 'recorrente' ? 'Mensal · dia ' + c.payDay : (c.installments > 1 ? c.installments + 'x' : 'À vista')}${c.setupValue > 0 ? ' + setup' : ''}</td>
        <td class="small">${c.billing === 'asaas' ? 'Asaas' : c.billing === 'exterior' ? '🌎 ' + c.currency : methodL(c.method)}</td><td class="small">${fdate(c.startDate)}</td><td class="r num b">${cv(c, c.value)}${c.kind === 'recorrente' ? html`<span class="faint xs">/mês</span>` : ''}</td></tr>`)}
    </tbody></table>${!list.length && html`<${Empty} t="Nenhum contrato aqui" s=""/>`}</div>
  </div>`;
}

/* ---------- despesas ---------- */
function CostForm({ init, onClose }) {
  const db = useDB(); const S = db.S;
  const [f, setF] = useState(Object.assign({ desc: '', category: 'ferramentas', amount: '', date: today(), recurring: false, endYm: '', installments: 1, supplier: '' }, init || {}));
  const F = k => v => setF(p => ({ ...p, [k]: v }));
  const save = () => {
    if (!f.desc.trim() || !n0(f.amount)) return toast('Preencha descrição e valor.');
    const n = Math.max(1, n0(f.installments));
    if (!f.id && !f.recurring && n > 1) {
      const g = uid(); const each = Math.round(n0(f.amount) / n * 100) / 100;
      for (let i = 0; i < n; i++) store.put('costs', { desc: f.desc + ' (' + (i + 1) + '/' + n + ')', category: f.category, amount: each, date: addMonthsDate(f.date, i), recurring: false, groupId: g, supplier: f.supplier });
      toast(n + ' parcelas lançadas.');
    } else { store.put('costs', Object.assign({}, f, { amount: n0(f.amount), installments: 1 })); toast('Despesa salva.'); }
    onClose();
  };
  return html`<${Modal} title=${f.id ? 'Editar despesa' : 'Nova despesa'} onClose=${onClose} footer=${html`${f.id && html`<${Btn} v="ghost" cls="danger" on=${() => { onClose(); delWithUndo('costs', f.id, 'Despesa'); }}>Excluir</${Btn}>`}<span style=${{ flex: 1 }}/><${Btn} on=${onClose}>Cancelar</${Btn}><${Btn} v="pri" on=${save}>Salvar</${Btn}>`}>
    <div class="form c2">
      <${Input} cls="span3" label="Descrição" v=${f.desc} on=${F('desc')} ph="Ex: Salário Júlia, mLabs, anúncios da Visions" autoFocus=${true}/>
      <${Money} label=${!f.id && !f.recurring && f.installments > 1 ? 'Valor total' : 'Valor'} v=${f.amount} on=${F('amount')}/>
      <${Input} label=${f.recurring ? 'Começa em (dia do vencimento)' : 'Data / vencimento'} type="date" v=${f.date} on=${F('date')}/>
      <${Field} label="Categoria" cls="span3"><${Chips} v=${f.category} on=${F('category')} opts=${S.costCategories.map(c => ({ v: c.id, l: c.name + (c.cac ? ' · CAC' : '') }))}/></${Field}>
      <div class="span3"><${Seg} v=${f.recurring ? 'rec' : 'uni'} on=${v => F('recurring')(v === 'rec')} opts=${[{ v: 'uni', l: 'Única / parcelada' }, { v: 'rec', l: 'Fixa mensal' }]}/></div>
      ${f.recurring ? html`<${Input} label="Termina em (opcional)" type="month" v=${f.endYm} on=${F('endYm')}/>` : !f.id && html`<${Input} label="Parcelas" type="number" min="1" v=${f.installments} on=${F('installments')} hint=${f.installments > 1 ? f.installments + 'x de ' + money2(n0(f.amount) / f.installments) : ''}/>`}
      <${Input} label="Fornecedor" v=${f.supplier} on=${F('supplier')}/>
    </div></${Modal}>`;
}
function CostsPage() {
  const db = useDB(); const S = db.S;
  const [ym, setYm] = useState(ymNow()); const [edit, setEdit] = useState(null);
  const list = costsInMonth(db, ym).sort((a, b) => a.due.localeCompare(b.due));
  const byCat = S.costCategories.map(c => ({ c, v: sum(list.filter(x => x.category === c.id), x => x.amount) })).filter(x => x.v > 0).sort((a, b) => b.v - a.v);
  const total = sum(list, x => x.amount);
  const prev = sum(costsInMonth(db, addMonths(ym, -1)), x => x.amount);
  const skip = c => { const o = db.costs[c.id]; store.put('costs', Object.assign({}, o, { skip: (o.skip || []).concat(ym) })); toast('"' + c.desc + '" não conta em ' + monthShort(ym) + '.', { l: 'Desfazer', f: () => store.restore('costs', o) }); };
  return html`<div>
    <${PageH} t="Despesas" s="Custos fixos se repetem sozinhos todo mês. Compras parceladas viram uma despesa por mês.">
      <${MonthNav} v=${ym} on=${setYm}/><${Btn} v="pri" icon="plus" on=${() => setEdit({})}>Nova despesa</${Btn}>
    </${PageH}>
    <div class="grid g3 mb16"><${Kpi} l=${'Total em ' + monthShort(ym)} v=${money(total)} s=${prev ? (total >= prev ? '+' : '') + pct((total / prev - 1) * 100) + ' vs mês anterior' : ''}/>
      <${Kpi} l="Fixas" v=${money(sum(list.filter(x => x.recurring), x => x.amount))}/><${Kpi} l="Entram no CAC" v=${money(sum(list.filter(x => (S.costCategories.find(c => c.id === x.category) || {}).cac), x => x.amount))} s="Comercial + marketing próprio"/></div>
    <div class="grid g-side">
      <div class="card flush">${list.map(c => html`<div class="lrow" key=${c.id + c.due}>
        <div style=${{ width: 54, textAlign: 'center' }}><div class="b num">${pad(parseD(c.due).getDate())}</div><div class="xs faint">${MSHORT[parseD(c.due).getMonth()]}</div></div>
        <div style=${{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick=${() => setEdit(db.costs[c.id])}><div class="main-t ellipsis">${c.desc}</div><div class="xs faint">${(S.costCategories.find(x => x.id === c.category) || {}).name || c.category}${c.recurring ? ' · fixa mensal ↻' : ''}${c.supplier ? ' · ' + c.supplier : ''}</div></div>
        <div class="num b">${money2(c.amount)}</div>
        ${c.recurring && html`<${Btn} sz="xs" v="ghost" on=${() => skip(c)} title="Não lançar neste mês">Pular mês</${Btn}>`}</div>`)}
        ${!list.length && html`<${Empty} t="Nenhuma despesa neste mês" s="Lance custos fixos uma vez e eles se repetem automaticamente."/>`}</div>
      <div class="card"><div class="card-h"><h3>Por categoria</h3></div>${byCat.length ? html`<${FunnelBars} rows=${byCat.map(x => ({ l: x.c.name.split('(')[0], v: x.v, c: 'var(--s2)' }))} fmt=${v => money(v)}/>` : html`<div class="faint small">—</div>`}</div>
    </div>
    ${edit && html`<${CostForm} init=${edit.id ? edit : null} onClose=${() => setEdit(null)}/>`}
  </div>`;
}

/* ---------- clientes ---------- */
function ClientsPage({ nav }) {
  const db = useDB(); const S = db.S;
  const [q, setQ] = useState(''); const [edit, setEdit] = useState(null);
  const inv = useMemo(() => allInvoices(db, ymNow()), [db.contracts, db.payments]);
  const rows = vals(db.clients).map(cl => {
    const cts = vals(db.contracts).filter(c => c.clientId === cl.id);
    const act = cts.filter(c => ['ativo', 'aviso'].includes(contractStatus(c)));
    const ci = inv.filter(i => i.clientId === cl.id);
    const first = cts.map(c => c.startDate).filter(Boolean).sort()[0];
    return { cl, cts, act, mrr: sum(act.filter(c => c.kind === 'recorrente'), c => brlValue(c)), paid: sum(ci.filter(i => i.status === 'pago'), i => i.paidAmount), late: sum(ci.filter(i => i.status === 'atrasado'), i => i.amount), first, months: first ? Math.max(0, diffDays(first, today()) / 30.4) : 0 };
  }).filter(r => !q || r.cl.name.toLowerCase().includes(q.toLowerCase())).sort((a, b) => b.mrr - a.mrr || a.cl.name.localeCompare(b.cl.name));
  const ativos = rows.filter(r => r.act.length);
  return html`<div>
    <${PageH} t="Clientes" s=${ativos.length + ' clientes ativos · LTV realizado = tudo que o cliente já pagou'}>
      <div style=${{ width: 240 }}><${Input} v=${q} on=${setQ} ph="Buscar…"/></div><${Btn} v="pri" icon="plus" on=${() => nav.newContract()}>Nova venda</${Btn}>
    </${PageH}>
    <div class="card flush tbl-wrap"><table class="tbl"><thead><tr><th>Cliente</th><th>Produtos ativos</th><th class="r">MRR</th><th class="r">Tempo de casa</th><th class="r">LTV realizado</th><th class="r">Atrasado</th><th></th></tr></thead><tbody>
      ${rows.map(r => html`<tr key=${r.cl.id}>
        <td><div class="row"><${Avatar} name=${r.cl.name} size=${28}/><div><div class="b">${r.cl.name}</div><div class="xs faint">${[r.cl.phone, r.cl.email].filter(Boolean).join(' · ')}</div></div></div></td>
        <td><div class="row wrap">${r.act.map(c => html`<${Tag} key=${c.id} t="pri" style=${{ cursor: 'pointer' }}><span onClick=${() => nav.contract(c.id)}>${prodName(S, c.productId)}</span></${Tag}>`)}${!r.act.length && html`<${Tag}>inativo</${Tag}>`}</div></td>
        <td class="r num b">${r.mrr ? money(r.mrr) : '—'}</td><td class="r num">${r.first ? num(r.months, 1) + ' meses' : '—'}</td><td class="r num">${money(r.paid)}</td>
        <td class="r num" style=${{ color: r.late ? 'var(--bad)' : null }}>${r.late ? money(r.late) : '—'}</td>
        <td class="r"><${Btn} sz="xs" v="ghost" icon="edit" on=${() => setEdit(r.cl)}/></td></tr>`)}
    </tbody></table>${!rows.length && html`<${Empty} t="Nenhum cliente" s="Clientes são criados automaticamente ao registrar uma venda."/>`}</div>
    ${edit && html`<${ClientForm} c=${edit} onClose=${() => setEdit(null)}/>`}
  </div>`;
}
function ClientForm({ c, onClose }) {
  const [f, setF] = useState(Object.assign({}, c)); const F = k => v => setF(p => ({ ...p, [k]: v }));
  const save = () => {
    store.put('clients', f);
    vals(store.data.contracts).filter(x => x.clientId === f.id && x.clientName !== f.name).forEach(x => store.put('contracts', Object.assign({}, x, { clientName: f.name })));
    onClose(); toast('Cliente salvo.');
  };
  return html`<${Modal} title="Cliente" onClose=${onClose} footer=${html`<${Btn} on=${onClose}>Cancelar</${Btn}><${Btn} v="pri" on=${save}>Salvar</${Btn}>`}>
    <div class="form c2"><${Input} cls="span3" label="Nome / empresa" v=${f.name} on=${F('name')}/><${Input} label="Telefone" v=${f.phone} on=${F('phone')}/><${Input} label="E-mail" v=${f.email} on=${F('email')}/>
      <${Input} label="CNPJ / CPF" v=${f.document} on=${F('document')}/><${Input} label="Responsável" v=${f.contact} on=${F('contact')}/><${Textarea} cls="span3" label="Observações" v=${f.notes} on=${F('notes')}/></div></${Modal}>`;
}

/* ---------- resumo do mês em linguagem clara ---------- */
const isInadimplente = i => i.status === 'atrasado' && i.due < ymNow() + '-01';
function MonthSummary({ db, ym, inv, f, nav }) {
  const S = db.S;
  const [open, setOpen] = useState(LS.get('vos7_fin_open', { ativos: true, aviso: true, outros: true, desp: true }));
  const tog = k => { const n = { ...open, [k]: !open[k] }; setOpen(n); LS.set('vos7_fin_open', n); };
  const monthEnd = ym + '-' + pad(daysInMonth(ym));
  const rec = vals(db.contracts).filter(c => contractActiveIn(c, ym));
  const emAviso = c => !!c.endDate;
  const ativos = rec.filter(c => !emAviso(c)).sort((a, b) => brlValue(b) - brlValue(a));
  const aviso = rec.filter(emAviso).sort((a, b) => (a.endDate || '').localeCompare(b.endDate || ''));
  const mrrAtivo = sum(ativos, brlValue), mrrAviso = sum(aviso, brlValue);
  const doMes = inv.filter(i => i.ym === ym && i.status !== 'cancelado');
  const byContract = groupBy(doMes, i => i.contractId);
  const recIds = new Set(rec.map(c => c.id));
  const outros = doMes.filter(i => !recIds.has(i.contractId) || i.kind !== 'mensal').sort((a, b) => a.due.localeCompare(b.due));
  const desp = f.custos.slice().sort((a, b) => b.amount - a.amount);
  const res = f.caixa - f.despesas - f.imposto;
  const pend = doMes.filter(i => i.status !== 'pago');
  const inad = inv.filter(isInadimplente);
  const statusOf = c => { const l = (byContract[c.id] || []).filter(i => i.kind === 'mensal'); if (!l.length) return null; const pg = l.every(i => i.status === 'pago'); const at = l.some(i => i.status === 'atrasado'); return pg ? ['good', 'pago'] : at ? ['bad', 'atrasado'] : ['', 'a receber']; };
  const Box = ({ t, v, s, tone, icon }) => html`<div class="kpi"><div class="l">${icon && html`<${Icon} n=${icon} s=${14}/>`}${t}</div><div class="v" style=${tone ? { color: 'var(--' + tone + ')' } : null}>${v}</div><div class="s" style=${{ color: 'var(--text-2)' }}>${s}</div></div>`;
  const Group = ({ k, title, total, tone, children, hint }) => html`<div class="mb12">
    <button class="row between" style=${{ width: '100%', border: 0, background: 'none', padding: '6px 0', cursor: 'pointer' }} onClick=${() => tog(k)}>
      <span class="xs b" style=${{ letterSpacing: '.08em', textTransform: 'uppercase', color: tone ? 'var(--' + tone + ')' : 'var(--text-2)' }}>${open[k] ? '▾' : '▸'} ${title}</span><b class="num small">${total}</b></button>
    ${hint && open[k] && html`<div class="xs faint mb8">${hint}</div>`}
    ${open[k] && children}</div>`;
  const Row = ({ name, sub, val, tag, onClick, border }) => html`<div class="row" style=${{ padding: '8px 12px', borderLeft: '3px solid ' + (border || 'var(--border)'), background: 'var(--surface-2)', borderRadius: '0 8px 8px 0', marginBottom: 4, cursor: onClick ? 'pointer' : null }} onClick=${onClick}>
    <div style=${{ flex: 1, minWidth: 0 }}><div class="small b ellipsis">${name}</div>${sub && html`<div class="xs faint ellipsis">${sub}</div>`}</div>
    ${tag && html`<${Tag} t=${tag[0]} style=${{ fontSize: 10.5 }}>${tag[1]}</${Tag}>`}<b class="num small" style=${{ minWidth: 90, textAlign: 'right' }}>${val}</b></div>`;
  return html`<div>
    <div class="grid g5 mb12">
      <${Box} icon="repeat" t="MRR ativo" v=${money(mrrAtivo)} s=${ativos.length + ' clientes que continuam (mensalidade de cada mês)'} tone="good"/>
      <${Box} icon="alert" t="Em aviso" v=${money(mrrAviso)} s=${aviso.length ? aviso.length + ' saindo: pagam até o fim do aviso e depois saem do MRR' : 'ninguém saindo'} tone=${aviso.length ? 'warn' : null}/>
      <${Box} icon="wallet" t="Receita real (caixa)" v=${money(f.caixa)} s=${'O que caiu na conta em ' + monthShort(ym) + (pend.length ? ' · faltam ' + money(sum(pend, i => i.amount)) : '')} tone="good"/>
      <${Box} icon="down" t="Despesas" v=${money(f.despesas + f.imposto)} s=${'O que saiu: ' + f.custos.length + ' lançamentos'}/>
      <${Box} icon="dollar" t="Resultado" v=${money(res)} s="Receita real − despesas" tone=${res >= 0 ? 'good' : 'bad'}/>
    </div>
    ${inad.length > 0 && html`<div class="callout warn mb16 row between" style=${{ gap: 12 }}><div><b class="t">Inadimplência (fora das contas acima): ${money(sum(inad, i => i.amount))}</b>${inad.length} cobranças vencidas antes de ${monthLabel(ymNow())}. Não entram em "a receber" para não inflar o mês.</div><${Btn} sz="sm" on=${() => { LS.set('vos7_rec_tab', 'inad'); nav.go('recebiveis'); }}>Ver inadimplentes</${Btn}></div>`}
    <div class="grid g2 mb16" style=${{ alignItems: 'start' }}>
      <div class="card">
        <div class="card-h"><h3>Receitas de ${monthLabel(ym)}</h3><span class="sub">previsto ${money(sum(doMes, i => i.amount))} · recebido ${money(sum(doMes.filter(i => i.status === 'pago'), i => i.paidAmount))}</span></div>
        <${Group} k="ativos" title="Mensalidades — clientes ativos" total=${money(mrrAtivo)} tone="good">
          ${ativos.map(c => html`<${Row} key=${c.id} name=${c.clientName} sub=${prodName(S, c.productId) + (c.currency && c.currency !== 'BRL' ? ' · ' + moneyCur(c.value, c.currency) : '')} val=${money(brlValue(c))} tag=${statusOf(c)} border="var(--good)" onClick=${() => nav.contract(c.id)}/>`)}
          ${!ativos.length && html`<div class="xs faint">—</div>`}</${Group}>
        <${Group} k="aviso" title="Em aviso — saindo" total=${money(mrrAviso)} tone="warn" hint="Ainda pagam neste mês. Depois da data de saída, deixam de entrar no MRR.">
          ${aviso.map(c => html`<${Row} key=${c.id} name=${c.clientName} sub=${'sai em ' + fdate(c.endDate) + ' · ' + prodName(S, c.productId)} val=${money(brlValue(c))} tag=${statusOf(c)} border="var(--warn)" onClick=${() => nav.contract(c.id)}/>`)}
          ${!aviso.length && html`<div class="xs faint">Nenhum cliente em aviso.</div>`}</${Group}>
        <${Group} k="outros" title="Projetos, parcelas e cobranças avulsas" total=${money(sum(outros, i => i.amount))} hint="Consultorias, implantações, setups e parcelas que vencem neste mês (não são MRR).">
          ${outros.map(i => html`<${Row} key=${i.id} name=${i.clientName} sub=${i.label + ' · vence ' + fdateShort(i.due)} val=${i.amountOrig != null ? moneyCur(i.amountOrig, i.currency) : money(i.amount)} tag=${ST_TAG[i.status]} border="var(--s1)" onClick=${() => nav.contract(i.contractId)}/>`)}
          ${!outros.length && html`<div class="xs faint">Nada neste mês.</div>`}</${Group}>
      </div>
      <div class="card">
        <div class="card-h"><h3>Despesas de ${monthLabel(ym)}</h3><${Btn} sz="xs" icon="plus" on=${() => nav.newCost()}>Despesa</${Btn}></div>
        <${Group} k="desp" title="Custos do mês" total=${money(f.despesas)} tone="bad">
          ${desp.map(c => html`<${Row} key=${c.id + c.due} name=${c.desc} sub=${((S.costCategories.find(x => x.id === c.category) || {}).name || '') + (c.recurring ? ' · fixo mensal' : '')} val=${money2(c.amount)} border="var(--bad)" onClick=${() => nav.go('despesas')}/>`)}
          ${!desp.length && html`<div class="xs faint">Nenhuma despesa neste mês.</div>`}</${Group}>
        ${f.imposto > 0 && html`<${Row} name="Imposto estimado" sub=${S.taxRate + '% sobre o caixa'} val=${money(f.imposto)} border="var(--bad)"/>`}
        <div class="hr"/>
        <div class="row between small mb8"><span class="muted">Receita real (caixa)</span><b class="num delta-up">${money(f.caixa)}</b></div>
        <div class="row between small mb8"><span class="muted">− Despesas</span><b class="num delta-down">${money(f.despesas + f.imposto)}</b></div>
        <div class="row between"><b>= Resultado do mês</b><b class=${'num ' + (res >= 0 ? 'delta-up' : 'delta-down')}>${money(res)}</b></div>
        <div class="xs faint mt12">Se todos pagarem o que falta este mês: <b>${money(f.caixa + sum(pend, i => i.amount) - f.despesas - f.imposto)}</b>.</div>
      </div>
    </div>
    <details class="card mb16"><summary class="small b" style=${{ cursor: 'pointer' }}>O que é "receita por competência"? (${money(f.receita)} em ${monthShort(ym)})</summary>
      <div class="small muted mt8">É o valor <b>vendido/faturado</b> no mês, mesmo que ainda não tenha caído na conta: mensalidades do mês (${money(f.mensalidades)}) + projetos e setups vendidos no mês, pelo valor total (${money(f.projetos)}). Ex.: uma Consultoria 360 de R$ 5.500 vendida em setembro conta R$ 5.500 de receita em setembro, mas o caixa entra parcela por parcela. Para o dia a dia, olhe a <b>receita real (caixa)</b>.</div></details>
  </div>`;
}

/* ---------- de onde vem a receita (por produto) ---------- */
function suggestProduct(c, S) {
  const has = id => S.products.some(p => p.id === id);
  const txt = (c.notes || '').toLowerCase(); // só as observações do contrato (o nome do cliente engana)
  let s = '';
  if (/consultoria 360|\b360\b/.test(txt)) s = 'c360';
  else if (/rede|social|conteúdo|conteudo/.test(txt)) s = 'social';
  else if (/\bia\b|intelig|humaniz/.test(txt)) s = 'ia';
  else if (/sistema|crm/.test(txt) && c.kind === 'projeto') s = 'sistemas';
  else if (c.kind === 'recorrente' || c.kind === 'espelho') {
    if (c.currency && c.currency !== 'BRL') s = 'trafego_eua';
    else if (Math.abs(n0(c.value) - 197) < 1) s = 'tracking';
    else s = 'trafego';
  } else if (c.kind === 'projeto') {
    const v = n0(c.value) * fxRate(c);
    if (v >= 7000) s = 'sistemas'; else if (v >= 4500 && v < 7000) s = 'c360';
  }
  return has(s) ? s : '';
}
function RevenueByProduct({ db, ym, inv, nav }) {
  const S = db.S;
  const [showInfo, setShowInfo] = useState(false); const [fix, setFix] = useState(false);
  const isLegacy = id => !id || !(S.products.find(p => p.id === id)) || (S.products.find(p => p.id === id) || {}).legacy;
  const keyOf = id => (isLegacy(id) ? '__sem' : id);
  const cts = vals(db.contracts);
  const rows = {}; const R = k => (rows[k] = rows[k] || { k, mrr: 0, prev: 0, rec: 0, comp: 0, clients: new Set() });
  cts.filter(c => contractActiveIn(c, ym)).forEach(c => { const r = R(keyOf(c.productId)); r.mrr += brlValue(c); r.clients.add(c.clientId); });
  inv.filter(i => i.ym === ym && i.status !== 'cancelado' && !isInadimplente(i)).forEach(i => { const r = R(keyOf(i.productId)); r.prev += i.amount; r.clients.add(i.clientId); });
  inv.filter(i => i.status === 'pago' && ymOf(i.paidAt) === ym).forEach(i => { R(keyOf(i.productId)).rec += i.paidAmount; });
  inv.filter(i => i.kind === 'mensal' && i.origYm === ym && i.status !== 'cancelado').forEach(i => { R(keyOf(i.productId)).comp += i.amount; });
  cts.filter(c => c.kind === 'projeto' && !c.canceled && ymOf(c.startDate) === ym).forEach(c => { R(keyOf(c.productId)).comp += brlValue(c); });
  const list = Object.values(rows).filter(r => r.mrr || r.prev || r.rec || r.comp).sort((a, b) => b.rec + b.prev - (a.rec + a.prev));
  const tot = { mrr: sum(list, r => r.mrr), prev: sum(list, r => r.prev), rec: sum(list, r => r.rec), comp: sum(list, r => r.comp) };
  const nameOf = k => (k === '__sem' ? 'Sem produto definido (contratos antigos)' : prodName(S, k));
  const colorOf = k => (k === '__sem' ? 'var(--border-strong)' : 'var(--' + ((S.products.find(p => p.id === k) || {}).color || 's1') + ')');
  const toFix = cts.filter(c => isLegacy(c.productId) && (contractStatus(c) !== 'encerrado'));
  return html`<div class="card flush mb16">
    <div class="lgroup"><span>De onde vem a receita — ${monthLabel(ym)}</span><span style=${{ textTransform: 'none', letterSpacing: 0 }}><button class="btn xs ghost" onClick=${() => setShowInfo(!showInfo)}>${showInfo ? 'Fechar' : 'ⓘ O que é cada número?'}</button></span></div>
    ${showInfo && html`<div class="grid g4" style=${{ padding: 14, gap: 10, background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
      <div class="small"><b>MRR</b><div class="muted">Soma das mensalidades dos contratos ativos e em aviso. É a "receita que se repete todo mês". Não conta projetos.</div></div>
      <div class="small"><b>Previsto no mês</b><div class="muted">Tudo que vence neste mês: mensalidades, parcelas, setups. Não inclui inadimplência de meses anteriores.</div></div>
      <div class="small"><b>Recebido (receita real)</b><div class="muted">O que de fato caiu na conta no mês. Pelo Asaas, já vem líquido das taxas.</div></div>
      <div class="small"><b>Vendido (competência)</b><div class="muted">Mensalidades do mês + valor total dos projetos fechados no mês, mesmo que parcelados.</div></div>
    </div>`}
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Produto</th><th class="r">Clientes</th><th class="r">MRR</th><th class="r">Previsto no mês</th><th class="r">Recebido</th><th class="r">Vendido (competência)</th><th style=${{ width: '22%' }}>% do recebido</th></tr></thead><tbody>
      ${list.map(r => html`<tr key=${r.k}><td><span class="row" style=${{ gap: 8 }}><span class="dot" style=${{ background: colorOf(r.k) }}/><b class="small">${nameOf(r.k)}</b></span></td>
        <td class="r num">${r.clients.size}</td><td class="r num">${r.mrr ? money(r.mrr) : '—'}</td><td class="r num">${money(r.prev)}</td><td class="r num b">${money(r.rec)}</td><td class="r num">${money(r.comp)}</td>
        <td><div class="row" style=${{ gap: 8 }}><div class="bar" style=${{ flex: 1 }}><i style=${{ width: (tot.rec ? r.rec / tot.rec * 100 : 0) + '%', background: colorOf(r.k) }}/></div><span class="xs num" style=${{ width: 36, textAlign: 'right' }}>${pct(tot.rec ? r.rec / tot.rec * 100 : 0)}</span></div></td></tr>`)}
    </tbody><tfoot><tr><td>Total</td><td/><td class="r">${money(tot.mrr)}</td><td class="r">${money(tot.prev)}</td><td class="r">${money(tot.rec)}</td><td class="r">${money(tot.comp)}</td><td/></tr></tfoot></table></div>
    ${toFix.length > 0 && html`<div class="callout warn" style=${{ margin: 12 }}><div class="row between wrap" style=${{ gap: 10 }}><div><b class="t">${toFix.length} contratos sem produto definido</b>Vieram do sistema antigo como "Gestão de Marketing". Classifique para ver a receita por produto certinha.</div><${Btn} sz="sm" v="pri" on=${() => setFix(true)}>Classificar agora</${Btn}></div></div>`}
    ${fix && html`<${ClassifyProducts} list=${toFix} onClose=${() => setFix(false)}/>`}
  </div>`;
}
function ClassifyProducts({ list, onClose }) {
  const db = useDB(); const S = db.S;
  const [pick, setPick] = useState(() => Object.fromEntries(list.map(c => [c.id, suggestProduct(c, S)])));
  const opts = S.products.filter(p => !p.legacy).map(p => ({ v: p.id, l: p.name }));
  const save = () => {
    let n = 0; list.forEach(c => { if (pick[c.id] && pick[c.id] !== c.productId) { store.put('contracts', Object.assign({}, store.data.contracts[c.id], { productId: pick[c.id] })); n++; } });
    toast(n + ' contrato(s) classificados.'); onClose();
  };
  return html`<${Modal} title="Classificar contratos por produto" size="lg" onClose=${onClose} footer=${html`<${Btn} on=${onClose}>Cancelar</${Btn}><${Btn} v="pri" on=${save}>Salvar ${Object.entries(pick).filter(([id, v]) => v).length} classificações</${Btn}>`}>
    <p class="small muted" style=${{ marginTop: 0 }}>Já deixei uma <b>sugestão</b> em cada um (pelo valor, moeda e tipo). Confira e troque o que estiver errado. Deixe em branco se não souber.</p>
    <div class="card flush" style=${{ maxHeight: '55vh', overflowY: 'auto' }}>${list.sort((a, b) => (a.clientName || '').localeCompare(b.clientName || '')).map(c => html`<div class="lrow" key=${c.id}>
      <div style=${{ flex: 1, minWidth: 0 }}><div class="main-t ellipsis">${c.clientName}</div><div class="xs faint ellipsis">${condText(c)}${c.notes ? ' · ' + c.notes : ''}</div></div>
      <div style=${{ width: 300 }}><${Select} sm=${true} v=${pick[c.id]} on=${v => setPick(p => ({ ...p, [c.id]: v }))} ph="— escolher —" opts=${opts}/></div></div>`)}</div>
  </${Modal}>`;
}
