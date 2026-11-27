/* ============================================================
   PAINEL SEMANAL DE CLIENTES — por campanha
   Tráfego, aquisição e metas por cliente, com dois modelos de funil:
   - agendamento: leads → agendamentos × ticket (clínicas, serviços, varejo)
   - venda:       leads → reuniões → vendas fechadas × ticket (B2B / consultivo)
   ============================================================ */
const PERF_MODELS = {
  agendamento: { l: 'Leads → agendamento', step: 'Agendamentos', stepS: 'agendamento', cac: 'CAC (por agendamento)' },
  venda: { l: 'Leads → reunião → venda fechada', step: 'Reuniões', stepS: 'reunião', cac: 'CAC (por venda fechada)' }
};
const PLATFORMS = ['Meta Ads', 'Google Ads', 'TikTok Ads', 'LinkedIn Ads', 'YouTube', 'Outra'];
const OUTROS = '__outros';
const perfModel = cl => (cl && cl.perfModel === 'venda' ? 'venda' : 'agendamento');
const campaignsOf = cl => (cl && Array.isArray(cl.campaigns) && cl.campaigns.length ? cl.campaigns : [{ id: 'geral', name: 'Geral', platform: 'Meta Ads', active: true }]);
function perfRow(r, model) {
  const spend = n0(r.spend), leads = n0(r.leads), appts = n0(r.appts), sales = n0(r.sales), ticket = n0(r.ticket), outros = n0(r.outros);
  const conv = model === 'venda' ? sales : appts;
  return { ...r, spend, leads, appts, sales, ticket, outros, trafego: conv * ticket };
}
function perfAgg(rows, model) {
  const t = { spend: sum(rows, r => r.spend), leads: sum(rows, r => r.leads), appts: sum(rows, r => r.appts), sales: sum(rows, r => r.sales), trafego: sum(rows, r => r.trafego), outros: sum(rows, r => r.outros) };
  const conv = model === 'venda' ? t.sales : t.appts;
  t.total = t.trafego + t.outros;
  t.roas = t.spend ? t.trafego / t.spend : NaN;
  t.cpl = t.leads ? t.spend / t.leads : NaN;
  t.convStep = t.leads ? t.appts / t.leads * 100 : NaN;     // leads → agendamento/reunião
  t.costStep = t.appts ? t.spend / t.appts : NaN;           // custo por agendamento/reunião
  t.close = t.appts ? t.sales / t.appts * 100 : NaN;        // reunião → venda
  t.cac = conv ? t.spend / conv : NaN;
  t.ticket = conv ? t.trafego / conv : NaN;
  return t;
}
const PERF_PERIODS = [{ v: 'all', l: 'Tudo' }, { v: '7', l: 'Últimos 7 dias' }, { v: '30', l: 'Últimos 30 dias' }, { v: 'mes', l: 'Este mês' }, { v: 'custom', l: 'Período' }];
const perfRecsOf = (db, clId) => vals(db.perf).filter(r => r.clientId === clId);
const monthsSpanned = (a, b) => { let n = 0, m = ymOf(a); while (m <= ymOf(b) && n < 240) { n++; m = addMonths(m, 1); } return Math.max(1, n); };

/* ---------- registrar / editar semana (uma linha por campanha) ---------- */
function PerfWeekForm({ cl, date, onClose }) {
  const db = useDB(); const model = perfModel(cl); const M = PERF_MODELS[model];
  const camps = campaignsOf(cl);
  const existing = date ? perfRecsOf(db, cl.id).filter(r => r.date === date) : [];
  const lastTicket = id => { const r = perfRecsOf(db, cl.id).filter(x => x.campaignId === id && n0(x.ticket) > 0).sort((a, b) => b.date.localeCompare(a.date))[0]; return r ? r.ticket : ''; };
  const [d, setD] = useState(date || today());
  const [rows, setRows] = useState(() => {
    const m = {};
    camps.filter(c => c.active !== false || existing.some(r => r.campaignId === c.id)).forEach(c => {
      const ex = existing.find(r => (r.campaignId || 'geral') === c.id);
      m[c.id] = ex ? { spend: ex.spend, leads: ex.leads, appts: ex.appts, sales: ex.sales, ticket: ex.ticket } : { spend: '', leads: '', appts: '', sales: '', ticket: lastTicket(c.id) };
    });
    return m;
  });
  const exOut = existing.find(r => r.campaignId === OUTROS);
  const [outros, setOutros] = useState(exOut ? exOut.outros : '');
  const setR = (id, k, v) => setRows(p => ({ ...p, [id]: { ...p[id], [k]: v } }));
  const calc = Object.entries(rows).map(([id, r]) => perfRow(r, model));
  const tot = perfAgg(calc, model);
  const save = () => {
    if (!d) return toast('Informe a data.');
    // remove os registros antigos desta data (edição) e grava os novos
    existing.forEach(r => store.del('perf', r.id));
    if (date && date !== d) perfRecsOf(store.data, cl.id).filter(r => r.date === d).forEach(r => store.del('perf', r.id));
    Object.entries(rows).forEach(([cid, r]) => {
      if (![r.spend, r.leads, r.appts, r.sales].some(v => n0(v))) return;
      store.put('perf', { id: cleanKey(cl.id + '_' + d + '_' + cid), clientId: cl.id, campaignId: cid, date: d, spend: n0(r.spend), leads: n0(r.leads), appts: n0(r.appts), sales: n0(r.sales), ticket: n0(r.ticket), by: CURRENT_USER.id });
    });
    if (n0(outros)) store.put('perf', { id: cleanKey(cl.id + '_' + d + '_' + OUTROS), clientId: cl.id, campaignId: OUTROS, date: d, outros: n0(outros), by: CURRENT_USER.id });
    toast('Semana salva.'); onClose();
  };
  const cols = model === 'venda'
    ? [['spend', 'Gasto (R$)'], ['leads', 'Leads'], ['appts', 'Reuniões'], ['sales', 'Vendas fechadas'], ['ticket', 'Ticket médio (R$)']]
    : [['spend', 'Gasto (R$)'], ['leads', 'Leads / conversas'], ['appts', 'Agendamentos'], ['ticket', 'Ticket médio (R$)']];
  return html`<${Modal} title=${(date ? 'Editar semana · ' : 'Registrar semana · ') + cl.name} size="lg" onClose=${onClose} footer=${html`<${Btn} on=${onClose}>Cancelar</${Btn}><${Btn} v="pri" on=${save}>Salvar semana</${Btn}>`}>
    <div class="row wrap mb12"><div style=${{ width: 180 }}><${Input} label="Data" type="date" v=${d} on=${setD}/></div><div class="xs faint" style=${{ flex: 1 }}>Uma linha por campanha. Deixe em branco as campanhas que não rodaram nesta semana.</div></div>
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Campanha</th>${cols.map(c => html`<th key=${c[0]} class="r">${c[1]}</th>`)}<th class="r">Faturamento</th></tr></thead><tbody>
      ${Object.keys(rows).map(id => { const c = camps.find(x => x.id === id) || { name: id }; const pr = perfRow(rows[id], model);
    return html`<tr key=${id}><td><b class="small">${c.name}</b><div class="xs faint">${c.platform || ''}</div></td>
          ${cols.map(([k]) => html`<td key=${k}><input class="inp sm num" style=${{ width: k === 'spend' || k === 'ticket' ? 104 : 74, textAlign: 'right' }} inputMode="decimal" value=${rows[id][k] ?? ''} onChange=${e => setR(id, k, e.target.value)}/></td>`)}
          <td class="r num small">${money2(pr.trafego)}</td></tr>`; })}
    </tbody><tfoot><tr><td>Total</td>${cols.map(([k]) => html`<td key=${k} class="r">${k === 'ticket' ? (Number.isFinite(tot.ticket) ? money2(tot.ticket) : '—') : k === 'spend' ? money2(tot.spend) : num(tot[k])}</td>`)}<td class="r">${money2(tot.trafego)}</td></tr></tfoot></table></div>
    <div class="form c2 mt16"><${Money} label="Faturamento via outros canais (orgânico, indicação, loja…)" v=${outros} on=${setOutros} hint="Do cliente na semana, sem ligação com campanha"/>
      <div class="callout info"><b class="t">Faturamento total da semana: ${money2(tot.trafego + n0(outros))}</b>CPL = gasto ÷ leads · ${M.cac} = gasto ÷ ${model === 'venda' ? 'vendas fechadas' : 'agendamentos'} · Faturamento via tráfego = ${model === 'venda' ? 'vendas fechadas' : 'agendamentos'} × ticket médio.</div></div>
  </${Modal}>`;
}

/* ---------- cliente: meta, benchmarks, modelo e campanhas ---------- */
function MergeBox({ db, cl, status, onDone }) {
  const opts = vals(db.clients).filter(c => c.id !== cl.id && !c.mergedInto && status[c.id] === 'ativo').sort((a, b) => a.name.localeCompare(b.name));
  const words = normName(cl.name);
  const guess = opts.find(c => normName(c.name).some(w => words.includes(w)));
  const [to, setTo] = useState(guess ? guess.id : '');
  return html`<div class="callout warn mb16 no-print"><${Icon} n="alert" s=${18}/><div style=${{ flex: 1 }}>
    <b class="t">${cl.name} não está ligado a nenhum contrato</b>
    Ele foi criado pela importação do painel antigo. Se é o mesmo cliente da carteira, junte os dois: as semanas e campanhas passam para o cliente com contrato, e ele some do painel quando o contrato de tráfego terminar.
    <div class="row wrap mt8" style=${{ gap: 8 }}><select class="inp sm" style=${{ width: 260 }} value=${to} onChange=${e => setTo(e.target.value)}><option value="">Escolha o cliente da carteira…</option>${opts.map(c => html`<option key=${c.id} value=${c.id}>${c.name}</option>`)}</select>
      <${Btn} sz="sm" v="pri" disabled=${!to} on=${() => { if (!confirm('Juntar "' + cl.name + '" com "' + db.clients[to].name + '"? As ' + perfRecsOf(db, cl.id).length + ' semana(s) registradas passam para ele.')) return; mergePerfClient(db, cl.id, to); onDone(to); toast('Clientes unificados.'); }}>Juntar</${Btn}>
      <span class="xs faint">Se não for cliente de tráfego com contrato, pode ignorar.</span></div>
  </div></div>`;
}
function PerfClientForm({ cl, onClose, onSaved }) {
  const S = settingsOf(store.data);
  const [f, setF] = useState(() => Object.assign({ name: '', perfGoal: '', perfRoas: S.perfBench.roas, perfCacShare: S.perfBench.cacShare, perfCac: '', perfModel: 'agendamento' }, cl || {}, { campaigns: JSON.parse(JSON.stringify(campaignsOf(cl))) }));
  const F = k => v => setF(p => ({ ...p, [k]: v }));
  const setC = (i, k, v) => setF(p => ({ ...p, campaigns: p.campaigns.map((c, j) => (j === i ? { ...c, [k]: v } : c)) }));
  const save = () => {
    if (!f.name.trim()) return toast('Informe o nome.');
    const campaigns = f.campaigns.filter(c => c.name.trim()).map(c => ({ ...c, id: c.id || cleanKey(uid()) }));
    const o = store.put('clients', Object.assign({}, f, { campaigns, perfGoal: n0(f.perfGoal), perfRoas: n0(f.perfRoas), perfCacShare: n0(f.perfCacShare), perfCac: f.perfCac === '' ? '' : n0(f.perfCac), perf: true }));
    onSaved && onSaved(o.id); onClose(); toast('Cliente salvo.');
  };
  return html`<${Modal} title=${cl && cl.id ? 'Configurar ' + cl.name : 'Novo cliente no painel'} size="lg" onClose=${onClose} footer=${html`<${Btn} on=${onClose}>Cancelar</${Btn}><${Btn} v="pri" on=${save}>Salvar</${Btn}>`}>
    <div class="form c2">
      <${Input} label="Cliente" v=${f.name} on=${F('name')}/>
      <${Money} label="Meta mensal de faturamento" v=${f.perfGoal} on=${F('perfGoal')}/>
      <${Field} label="Modelo de funil" cls="span3"><${Seg} v=${f.perfModel} on=${F('perfModel')} opts=${[{ v: 'agendamento', l: PERF_MODELS.agendamento.l }, { v: 'venda', l: PERF_MODELS.venda.l }]}/></${Field}>
      <${Input} label="ROAS esperado (x)" type="number" v=${f.perfRoas} on=${F('perfRoas')}/>
      <${Money} label="CAC esperado (opcional)" v=${f.perfCac} on=${F('perfCac')} hint=${'Vazio = ' + (n0(f.perfCacShare) || 50) + '% do ticket médio'}/>
      <${Input} label="Regra do CAC (% do ticket médio)" type="number" v=${f.perfCacShare} on=${F('perfCacShare')} hint="Regra prática: até metade do ticket (50%)"/>
    </div>
    <div class="xs faint b mt16 mb8" style=${{ letterSpacing: '.1em' }}>CAMPANHAS</div>
    ${f.campaigns.map((c, i) => html`<div class="row mb8" key=${c.id || i}>
      <div style=${{ flex: 2 }}><${Input} sm=${true} v=${c.name} on=${v => setC(i, 'name', v)} ph="Nome da campanha (ex: Captação WhatsApp)"/></div>
      <div style=${{ flex: 1 }}><${Select} sm=${true} v=${c.platform} on=${v => setC(i, 'platform', v)} opts=${PLATFORMS}/></div>
      <${Toggle} v=${c.active !== false} on=${v => setC(i, 'active', v)} label="ativa"/>
    </div>`)}
    <${Btn} sz="sm" icon="plus" on=${() => setF(p => ({ ...p, campaigns: p.campaigns.concat({ id: '', name: '', platform: 'Meta Ads', active: true }) }))}>Adicionar campanha</${Btn}>
    <div class="xs faint mt8">Campanhas pausadas somem do formulário semanal, mas o histórico continua no painel.</div>
  </${Modal}>`;
}

/* ---------- componentes visuais ---------- */
function Gauge({ pct: p }) {
  const v = Number.isFinite(p) ? p : 0; const a = clamp(v, 0, 100) / 100;
  const color = v >= 100 ? 'var(--good)' : v >= 70 ? 'var(--gold)' : 'var(--bad)';
  const R = 70, cx = 90, cy = 86; const ang = Math.PI * (1 - a);
  const ex = cx + R * Math.cos(ang), ey = cy - R * Math.sin(ang);
  return html`<svg viewBox="0 0 180 100" style=${{ width: 190, display: 'block', margin: '0 auto' }} aria-label=${'Meta ' + num(v) + '%'}>
    <path d=${`M${cx - R},${cy} A${R},${R} 0 0 1 ${cx + R},${cy}`} fill="none" stroke="var(--surface-3)" stroke-width="12" stroke-linecap="round"/>
    ${a > 0 && html`<path d=${`M${cx - R},${cy} A${R},${R} 0 0 1 ${ex},${ey}`} fill="none" stroke=${color} stroke-width="12" stroke-linecap="round"/>`}
  </svg>`;
}
function Bench({ l, cur, exp, fmt, lowerBetter, note }) {
  const ok = Number.isFinite(cur) && Number.isFinite(exp) && (lowerBetter ? cur <= exp : cur >= exp);
  const max = Math.max(cur || 0, exp || 0) * 1.15 || 1;
  return html`<div class="card">
    <div class="row between mb8"><b>${l}</b>${Number.isFinite(cur) && Number.isFinite(exp) && html`<${Tag} t=${ok ? 'good' : 'bad'}>${ok ? 'Dentro do esperado' : lowerBetter ? 'Acima do esperado' : 'Abaixo do esperado'}</${Tag}>`}</div>
    <div class="row between small mb8"><span class="muted">Atual</span><b class="num">${Number.isFinite(cur) ? fmt(cur) : '—'}</b></div>
    <div class=${'bar ' + (ok ? 'good' : 'bad')} style=${{ height: 10 }}><i style=${{ width: clamp((cur || 0) / max * 100, 0, 100) + '%' }}/>${Number.isFinite(exp) && html`<span class="pace" style=${{ left: clamp(exp / max * 100, 0, 100) + '%' }} title="Esperado"/>`}</div>
    <div class="row between small mt8"><span class="muted">Esperado</span><b class="num">${Number.isFinite(exp) ? fmt(exp) : '—'}</b></div>
    <div class="xs faint mt8">${note}</div></div>`;
}

/* ---------- página ---------- */
/* quem aparece no painel: clientes com contrato de tráfego ativo (ou em aviso).
   Contrato de tráfego encerrado = some do painel (o histórico continua em "Mostrar encerrados"). */
const TRAFFIC_PRODS = ['trafego', 'trafego_eua'];
const isTrafficContract = k => TRAFFIC_PRODS.includes(k.productId) || (k.productShares || k.mix || []).some(m => m && TRAFFIC_PRODS.includes(m.productId || m.id));
function trafficStatus(db, c) {
  const all = vals(db.contracts).filter(k => k.clientId === c.id);
  const tr = all.filter(isTrafficContract);
  if (tr.some(k => k.kind !== 'projeto' && contractStatus(k) !== 'encerrado')) return 'ativo';
  if (tr.length) return 'encerrado';
  return all.length ? 'outro' : 'sem_contrato';
}
/* junta um cliente do painel (criado pela importação do painel antigo) com o cliente da carteira que tem o contrato */
function mergePerfClient(db, fromId, toId) {
  const a = db.clients[fromId], b = db.clients[toId]; if (!a || !b) return;
  const F = ['campaigns', 'perfGoal', 'perfRoas', 'perfCacShare', 'perfCac', 'perfModel'];
  const add = {}; F.forEach(f => { const empty = v => v == null || v === '' || (Array.isArray(v) && !v.length); if (!empty(a[f]) && empty(b[f])) add[f] = a[f]; });
  if (Array.isArray(a.campaigns) && Array.isArray(b.campaigns) && b.campaigns.length) add.campaigns = b.campaigns.concat(a.campaigns.filter(c => !b.campaigns.some(x => x.id === c.id)));
  store.put('clients', Object.assign({}, b, add, { perf: true }));
  perfRecsOf(db, fromId).forEach(r => store.put('perf', Object.assign({}, r, { clientId: toId })));
  store.put('clients', Object.assign({}, a, { mergedInto: toId, perf: false }));
}
const normName = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, ' ').split(' ').filter(w => w.length > 2 && !['clinica', 'loja', 'pet', 'shop', 'petshop'].includes(w));
function PerformancePage() {
  const db = useDB();
  const [showEnded, setShowEnded] = useState(false);
  const status = {}; vals(db.clients).forEach(c => (status[c.id] = trafficStatus(db, c)));
  const hasData = c => c.perf || perfRecsOf(db, c.id).length;
  const clients = vals(db.clients).filter(c => !c.mergedInto && !c.archived && c.name)
    .filter(c => status[c.id] === 'ativo' || (status[c.id] === 'sem_contrato' && c.perf) || (showEnded && hasData(c)))
    .sort((a, b) => a.name.localeCompare(b.name));
  const tagOf = c => (status[c.id] === 'ativo' ? '' : status[c.id] === 'sem_contrato' ? ' · sem contrato' : ' · encerrado');
  const [sel, setSel] = useState(LS.get('vos7_perfcl', ''));
  const cl = db.clients[sel] && clients.some(c => c.id === sel) ? db.clients[sel] : clients[0];
  useEffect(() => { if (cl) LS.set('vos7_perfcl', cl.id); }, [cl && cl.id]);
  const [per, setPer] = useState('all'); const [from, setFrom] = useState(addDays(today(), -30)); const [to, setTo] = useState(today());
  const [camp, setCamp] = useState('');
  const [week, setWeek] = useState(null); const [edit, setEdit] = useState(null);
  useEffect(() => setCamp(''), [cl && cl.id]);
  if (!cl) return html`<div><${PageH} t="Painel semanal de clientes" s="Tráfego, aquisição e metas por cliente e por campanha"/>
    <div class="card"><${Empty} t="Nenhum cliente no painel" s="Adicione um cliente (ou importe do painel antigo em Configurações → Importar dados)."><${Btn} v="pri" icon="plus" on=${() => setEdit({})}>Novo cliente</${Btn}></${Empty}></div>
    ${edit && html`<${PerfClientForm} cl=${null} onClose=${() => setEdit(null)} onSaved=${setSel}/>`}</div>`;
  const model = perfModel(cl); const M = PERF_MODELS[model];
  const camps = campaignsOf(cl);
  const recs = perfRecsOf(db, cl.id).map(r => perfRow(Object.assign({}, r, { campaignId: r.campaignId || 'geral' }), model));
  const dates = [...new Set(recs.map(r => r.date))].sort();
  const range = per === '7' ? [addDays(today(), -6), today()] : per === '30' ? [addDays(today(), -29), today()] : per === 'mes' ? [ymNow() + '-01', today()] : per === 'custom' ? [from, to] : [dates[0] || today(), dates[dates.length - 1] || today()];
  const inR = recs.filter(r => r.date >= range[0] && r.date <= range[1]);
  const adRows = inR.filter(r => r.campaignId !== OUTROS && (!camp || r.campaignId === camp));
  const outRows = camp ? [] : inR.filter(r => r.campaignId === OUTROS);
  const t = perfAgg(adRows.concat(outRows), model);
  const goal = n0(cl.perfGoal); const months = monthsSpanned(range[0], range[1]);
  const goalPer = goal * months; const pctMeta = goalPer && !camp ? t.total / goalPer * 100 : NaN;
  const roasExp = n0(cl.perfRoas) || db.S.perfBench.roas;
  const cacExp = cl.perfCac !== '' && cl.perfCac != null && n0(cl.perfCac) > 0 ? n0(cl.perfCac) : (Number.isFinite(t.ticket) ? t.ticket * ((n0(cl.perfCacShare) || db.S.perfBench.cacShare) / 100) : NaN);
  const wDates = [...new Set(inR.map(r => r.date))].sort();
  const byDate = wDates.map(dd => { const rs = inR.filter(r => r.date === dd); return { d: dd, ad: perfAgg(rs.filter(r => r.campaignId !== OUTROS && (!camp || r.campaignId === camp)), model), out: sum(rs.filter(r => r.campaignId === OUTROS), r => r.outros) }; });
  const cum = {}; const cumRows = byDate.map(w => { const m = ymOf(w.d); cum[m] = cum[m] || { t: 0, o: 0 }; cum[m].t += w.ad.trafego; cum[m].o += camp ? 0 : w.out; return { label: fdateShort(w.d), t: cum[m].t, o: cum[m].o }; });
  const campStats = camps.map((c, k) => ({ c, k, a: perfAgg(inR.filter(r => r.campaignId === c.id), model) })).filter(x => x.a.spend || x.a.leads);
  const orphan = [...new Set(inR.map(r => r.campaignId))].filter(id => id !== OUTROS && !camps.some(c => c.id === id));
  orphan.forEach(id => campStats.push({ c: { id, name: id === 'geral' ? 'Geral' : id, platform: '' }, a: perfAgg(inR.filter(r => r.campaignId === id), model) }));
  const spendTot = sum(campStats, x => x.a.spend);
  const colorOf = i => ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s6)', 'var(--s5)', 'var(--s7)', 'var(--s8)', 'var(--s4)'][i % 8];
  const bestRoas = campStats.filter(x => Number.isFinite(x.a.roas) && x.a.spend > 0).sort((a, b) => b.a.roas - a.a.roas);
  const setGoal = () => { const v = prompt('Meta mensal de faturamento de ' + cl.name + ' (R$):', goal || ''); if (v == null) return; store.put('clients', Object.assign({}, cl, { perfGoal: n0(v), perf: true })); };
  const exportPdf = () => { document.title = 'Painel semanal — ' + cl.name; window.print(); setTimeout(() => (document.title = 'Visions OS'), 500); };
  const last = dates[dates.length - 1];
  const kpis = model === 'venda'
    ? [[money2(t.spend), 'Gasto no período'], [num(t.leads), 'Leads no período'], [Number.isFinite(t.cpl) ? money2(t.cpl) : '—', 'Custo por lead'], [pct(t.convStep), 'Conversão leads → reunião'], [Number.isFinite(t.costStep) ? money2(t.costStep) : '—', 'Custo por reunião'], [Number.isFinite(t.cac) ? money2(t.cac) : '—', 'CAC (por venda fechada)'], [pct(t.close), 'Taxa de fechamento'], [Number.isFinite(t.ticket) ? money2(t.ticket) : '—', 'Ticket médio'], [num(wDates.length), 'Semanas no período']]
    : [[money2(t.spend), 'Gasto no período'], [num(t.leads), 'Leads no período'], [Number.isFinite(t.cpl) ? money2(t.cpl) : '—', 'Custo por lead'], [pct(t.convStep), 'Conversão leads → agendamento'], [Number.isFinite(t.costStep) ? money2(t.costStep) : '—', 'Custo por agendamento'], [Number.isFinite(t.cac) ? money2(t.cac) : '—', 'CAC (por agendamento)'], [Number.isFinite(t.ticket) ? money2(t.ticket) : '—', 'Ticket médio'], [num(wDates.length), 'Semanas no período']];
  return html`<div class="perf-page">
    ${status[cl.id] === 'sem_contrato' && html`<${MergeBox} key=${cl.id} db=${db} cl=${cl} status=${status} onDone=${setSel}/>`}
    <${PageH} t="Painel semanal de clientes" s=${'Tráfego, aquisição e metas por cliente e campanha · ' + M.l}>
      <div style=${{ width: 220 }}><${Select} v=${cl.id} on=${v => (v === '__new' ? setEdit({}) : setSel(v))} opts=${clients.map(c => ({ v: c.id, l: c.name + tagOf(c) })).concat({ v: '__new', l: '+ Novo cliente' })}/></div>
      <label class="row xs muted" style=${{ gap: 6, cursor: 'pointer' }}><input type="checkbox" checked=${showEnded} onChange=${e => setShowEnded(e.target.checked)}/>Mostrar encerrados</label>
      <span class="xs faint">${clients.filter(c => status[c.id] === 'ativo').length} clientes com tráfego ativo</span>
      <${Btn} v="ghost" icon="gear" on=${() => setEdit(cl)} title="Configurar cliente e campanhas"/>
      <button class="btn" onClick=${setGoal} title="Editar meta">Meta mensal: <b>${goal ? money2(goal) : 'definir'}</b></button>
      <${Btn} icon="down" on=${exportPdf}>Exportar PDF</${Btn}>
      <${Btn} v="pri" icon="plus" on=${() => setWeek({ date: null })}>Registrar semana</${Btn}>
    </${PageH}>
    <div class="card tight row wrap mb12 no-print"><span class="small muted">Período:</span><${Seg} v=${per} on=${setPer} opts=${PERF_PERIODS}/>
      ${per === 'custom' && html`<input class="inp sm" type="date" value=${from} onChange=${e => setFrom(e.target.value)} style=${{ width: 150 }}/><span class="faint">até</span><input class="inp sm" type="date" value=${to} onChange=${e => setTo(e.target.value)} style=${{ width: 150 }}/>`}</div>
    <div class="chips mb16 no-print"><button class=${'chip' + (!camp ? ' on' : '')} onClick=${() => setCamp('')}>Todas as campanhas</button>
      ${camps.map(c => html`<button key=${c.id} class=${'chip' + (camp === c.id ? ' on' : '')} onClick=${() => setCamp(c.id)}>${c.name}${c.active === false ? ' (pausada)' : ''}</button>`)}
      <button class="chip" onClick=${() => setEdit(cl)}>+ campanha</button></div>
    ${!recs.length ? html`<div class="card"><${Empty} t=${'Nenhuma semana registrada para ' + cl.name} s="Configure as campanhas na engrenagem e clique em Registrar semana."/></div>` : html`
    <div class="grid mb16" style=${{ gridTemplateColumns: 'minmax(260px,1fr) minmax(0,2.3fr)' }}>
      <div class="card" style=${{ textAlign: 'center' }}>
        <${Gauge} pct=${pctMeta}/>
        <div style=${{ fontSize: 34, fontWeight: 800, marginTop: -18, color: !Number.isFinite(pctMeta) ? 'var(--text-3)' : pctMeta >= 100 ? 'var(--good)' : pctMeta >= 70 ? 'var(--gold)' : 'var(--bad)' }}>${Number.isFinite(pctMeta) ? num(pctMeta) + '%' : '—'}</div>
        <div class="small muted">${camp ? 'meta é do cliente (todas as campanhas)' : (last ? fdateShort(last) + ' · última leitura' : '')}${Number.isFinite(pctMeta) && pctMeta > 100 ? html`<div class="delta-up">+${num(pctMeta - 100)}% acima</div>` : ''}</div>
        <div class="hr"/>
        <div class="grid g2" style=${{ textAlign: 'left', gap: 10 }}>
          <div><div class="xs muted">Faturamento ${camp ? 'da campanha' : 'total'}</div><b class="num">${money2(t.total)}</b></div>
          <div><div class="xs muted">Meta ${months > 1 ? 'do período (' + months + ' meses)' : 'do mês'}</div><b class="num">${goal ? money2(goalPer) : '—'}</b></div>
          <div><div class="xs muted">Via tráfego direto</div><b class="num" style=${{ color: 'var(--s1)' }}>${money2(t.trafego)}</b></div>
          <div><div class="xs muted">Via outros canais</div><b class="num" style=${{ color: 'var(--gold)' }}>${camp ? '—' : money2(t.outros)}</b></div>
        </div>
      </div>
      <div class="col" style=${{ gap: 14 }}>
        <div class="grid g2">
          <div class="card" style=${{ background: 'color-mix(in srgb,var(--good) 7%,var(--surface))', borderColor: 'color-mix(in srgb,var(--good) 30%,var(--border))' }}>
            <div class="row"><b style=${{ fontSize: 34, color: 'var(--good)' }}>${Number.isFinite(t.roas) ? num(t.roas, 1) + 'x' : '—'}</b>${Number.isFinite(t.roas) && html`<span class="tag good">ROI ${num(t.roas, 1)}x</span>`}</div>
            <div class="xs b" style=${{ color: 'var(--good)', letterSpacing: '.06em' }}>ROAS · RETORNO SOBRE O INVESTIMENTO EM TRÁFEGO</div>
            <div class="small muted mt8">${Number.isFinite(t.roas) ? 'A cada R$ 1 investido, voltaram ' + money2(t.roas) + ' em faturamento via tráfego.' : 'Registre gasto e conversões.'}</div></div>
          <div class="card" style=${{ background: 'var(--brand-soft)', borderColor: 'color-mix(in srgb,var(--brand-2) 30%,var(--border))' }}>
            <b style=${{ fontSize: 30, color: 'var(--primary)' }} class="num">${money2(t.total)}</b>
            <div class="xs b" style=${{ color: 'var(--primary)', letterSpacing: '.06em' }}>FATURAMENTO GERADO NO PERÍODO</div>
            <div class="small mt8"><span style=${{ color: 'var(--s1)' }}>Tráfego: ${money2(t.trafego)}</span>  <span style=${{ color: 'var(--gold)', marginLeft: 8 }}>Outros: ${camp ? '—' : money2(t.outros)}</span></div></div>
        </div>
        <div class="grid g3">${kpis.map(([v, l]) => html`<div class="kpi" key=${l}><div class="v" style=${{ fontSize: 21, marginTop: 0 }}>${v}</div><div class="s" style=${{ color: 'var(--text-2)' }}>${l}</div></div>`)}</div>
      </div>
    </div>
    ${!camp && campStats.length > 0 && html`<div class="card flush mb16 tbl-wrap"><div class="lgroup"><span>Resultado por campanha</span><span>${bestRoas.length > 1 ? 'melhor ROAS: ' + bestRoas[0].c.name : ''}</span></div>
      <table class="tbl"><thead><tr><th>Campanha</th><th class="r">Investido</th><th class="r">% verba</th><th class="r">Leads</th><th class="r">CPL</th><th class="r">${M.step}</th><th class="r">Custo/${M.stepS}</th>${model === 'venda' && html`<th class="r">Vendas</th>`}<th class="r">CAC</th><th class="r">Faturamento</th><th class="r">ROAS</th></tr></thead><tbody>
      ${campStats.sort((a, b) => b.a.spend - a.a.spend).map((x, i) => html`<tr key=${x.c.id} class="click" onClick=${() => setCamp(x.c.id)}>
        <td><div class="row"><span class="dot" style=${{ background: colorOf(camps.indexOf(x.c) >= 0 ? camps.indexOf(x.c) : i) }}/><div><b class="small">${x.c.name}</b><div class="xs faint">${x.c.platform || ''}</div></div></div></td>
        <td class="r num">${money2(x.a.spend)}</td><td class="r num">${pct(ratio(x.a.spend, spendTot) * 100)}</td><td class="r num">${num(x.a.leads)}</td><td class="r num">${Number.isFinite(x.a.cpl) ? money2(x.a.cpl) : '—'}</td>
        <td class="r num">${num(x.a.appts)}</td><td class="r num">${Number.isFinite(x.a.costStep) ? money2(x.a.costStep) : '—'}</td>${model === 'venda' && html`<td class="r num">${num(x.a.sales)}</td>`}
        <td class="r num">${Number.isFinite(x.a.cac) ? money2(x.a.cac) : '—'}</td><td class="r num">${money2(x.a.trafego)}</td>
        <td class="r num b" style=${{ color: !Number.isFinite(x.a.roas) ? null : x.a.roas >= roasExp ? 'var(--good)' : 'var(--bad)' }}>${Number.isFinite(x.a.roas) ? num(x.a.roas, 1) + 'x' : '—'}</td></tr>`)}
      </tbody></table></div>`}
    <div class="grid g2 mb16">
      <div class="card"><div class="card-h"><h3>Faturamento × Meta</h3><span class="sub">acumulado no mês</span></div>
        <${BarChart} stacked=${true} labels=${cumRows.map(r => r.label)} fmt=${v => (v >= 1000 ? num(v / 1000, 1) + 'k' : num(v))}
          series=${[{ name: 'Via tráfego direto', data: cumRows.map(r => r.t), color: 'var(--s1)' }, { name: 'Via outros canais', data: cumRows.map(r => r.o), color: 'var(--s2)' }]}
          refLine=${goal && !camp ? { v: goal, name: 'Meta', color: 'var(--s3)' } : null}/></div>
      <div class="card"><div class="card-h"><h3>CPL × CAC por semana</h3></div>
        <${LineChart} labels=${byDate.map(w => fdateShort(w.d))} fmt=${v => money(v)}
          series=${[{ name: 'CPL', data: byDate.map(w => (Number.isFinite(w.ad.cpl) ? w.ad.cpl : 0)), color: 'var(--s1)' }, { name: M.cac, data: byDate.map(w => (Number.isFinite(w.ad.cac) ? w.ad.cac : 0)), color: 'var(--s2)' }]}/></div>
    </div>
    ${!camp && campStats.length > 1 && html`<div class="card mb16"><div class="card-h"><h3>Investimento por campanha</h3><span class="sub">por semana</span></div>
      <${BarChart} stacked=${true} labels=${byDate.map(w => fdateShort(w.d))} fmt=${v => money(v)}
        series=${campStats.map((x, i) => ({ name: x.c.name, color: colorOf(camps.indexOf(x.c) >= 0 ? camps.indexOf(x.c) : i), data: byDate.map(w => sum(inR.filter(r => r.date === w.d && r.campaignId === x.c.id), r => r.spend)) }))}/></div>`}
    <div class="card mb16"><div class="card-h"><h3>Benchmark de mercado</h3></div><div class="grid g2">
      <${Bench} l=${M.cac} cur=${t.cac} exp=${cacExp} fmt=${money2} lowerBetter=${true} note=${n0(cl.perfCac) > 0 ? 'CAC esperado definido manualmente.' : 'Regra prática: até ' + num(n0(cl.perfCacShare) || db.S.perfBench.cacShare) + '% do ticket médio.'}/>
      <${Bench} l="ROAS · retorno sobre tráfego" cur=${t.roas} exp=${roasExp} fmt=${v => num(v, 1) + 'x'} note="Referência de mercado definida manualmente."/></div></div>`}
    <div class="card flush tbl-wrap"><div class="lgroup"><span>Histórico semanal${camp ? ' · ' + (camps.find(c => c.id === camp) || {}).name : ''}</span><span>${byDate.length} semana(s)</span></div>
      <table class="tbl"><thead><tr><th>Data</th><th class="r">Gasto</th><th class="r">Leads</th><th class="r">CPL</th><th class="r">${M.step}</th><th class="r">Custo/${M.stepS}</th>${model === 'venda' && html`<th class="r">Fechadas</th><th class="r">Fechamento</th>`}<th class="r">CAC</th><th class="r">Ticket médio</th><th class="r">Via tráfego</th><th class="r">Via outros</th><th class="r">Total</th><th class="r">% meta</th><th class="no-print"/></tr></thead><tbody>
      ${byDate.slice().reverse().map(w => { const a = w.ad; const tot = a.trafego + (camp ? 0 : w.out); const pm = goal ? tot / goal * 100 : NaN;
    return html`<tr key=${w.d}><td class="b">${fdate(w.d)}</td><td class="r num">${money2(a.spend)}</td><td class="r num">${num(a.leads)}</td><td class="r num">${Number.isFinite(a.cpl) ? money2(a.cpl) : '—'}</td><td class="r num">${num(a.appts)}</td>
        <td class="r num">${Number.isFinite(a.costStep) ? money2(a.costStep) : '—'}</td>${model === 'venda' && html`<td class="r num">${num(a.sales)}</td><td class="r num">${pct(a.close)}</td>`}
        <td class="r num">${Number.isFinite(a.cac) ? money2(a.cac) : '—'}</td><td class="r num">${Number.isFinite(a.ticket) ? money2(a.ticket) : '—'}</td><td class="r num">${money2(a.trafego)}</td><td class="r num">${camp ? '—' : money2(w.out)}</td><td class="r num b">${money2(tot)}</td>
        <td class="r">${Number.isFinite(pm) ? html`<${Tag} t=${pm >= 100 / 4 ? 'good' : 'bad'}>${pct(pm)}</${Tag}>` : '—'}</td>
        <td class="r no-print" style=${{ whiteSpace: 'nowrap' }}><${Btn} sz="xs" v="ghost" icon="edit" on=${() => setWeek({ date: w.d })} title="Editar semana"/><${Btn} sz="xs" v="ghost" cls="danger" icon="trash" title="Excluir semana" on=${() => { if (!confirm('Excluir a semana de ' + fdate(w.d) + ' (todas as campanhas)?')) return; const del = recs.filter(r => r.date === w.d).map(r => store.del('perf', r.id)).filter(Boolean); toast('Semana excluída.', { l: 'Desfazer', f: () => del.forEach(o => store.restore('perf', o)) }, 8000); }}/></td></tr>`; })}
      </tbody></table></div>
    ${week && html`<${PerfWeekForm} cl=${cl} date=${week.date} onClose=${() => setWeek(null)}/>`}
    ${edit && html`<${PerfClientForm} cl=${edit.id ? edit : null} onClose=${() => setEdit(null)} onSaved=${setSel}/>`}
  </div>`;
}

/* ============================================================
   IMPORTAÇÃO DO PAINEL ANTIGO (dashboardvisions.netlify.app)
   O painel antigo guarda tudo no localStorage do navegador.
   O usuário copia com um comando no console e cola aqui; o
   importador reconhece clientes e semanas pelo nome dos campos.
   ============================================================ */
const OLD_SNIPPET = 'copy(JSON.stringify(Object.fromEntries(Object.entries(localStorage))))';
const normK = k => String(k).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const brNum = v => {
  if (typeof v === 'number') return v;
  if (v == null || v === '') return 0;
  let s = String(v).replace(/[^\d,.\-]/g, '');
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s); return Number.isFinite(n) ? n : 0;
};
const toISO = v => {
  if (!v) return null; const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return m[1] + '-' + m[2] + '-' + m[3];
  m = s.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (m) { let y = m[3] ? (m[3].length === 2 ? '20' + m[3] : m[3]) : String(new Date().getFullYear() - (Number(m[2]) > new Date().getMonth() + 1 ? 1 : 0)); return y + '-' + pad(m[2]) + '-' + pad(m[1]); }
  if (/^\d{10,13}$/.test(s)) return dstr(new Date(Number(s.length === 10 ? s + '000' : s)));
  return null;
};
const FIELD_RX = [
  ['date', /^(date|data|dia|semana|week|periodo)/],
  ['spend', /(gasto|spend|invest|custo(trafego|midia)?$|valorgasto|cost$|amount)/],
  ['leads', /^(leads?|conversas|contatos|leadsconversas)/],
  ['sales', /(fechad|vendasfechadas|^vendas$|^sales|closed|deals)/],
  ['appts', /(agend|reuni|meeting|appoint|^conversoes$|^conversions?$)/],
  ['ticket', /ticket/],
  ['fatTrafego', /(faturamentotrafego|receitatrafego|viatrafego|trafficrevenue)/],
  ['outros', /(outros|other|organico)/]
];
function mapWeek(o) {
  const w = {}; let hits = 0;
  Object.entries(o).forEach(([k, v]) => {
    const nk = normK(k);
    for (const [f, rx] of FIELD_RX) { if (rx.test(nk) && w[f] === undefined) { w[f] = f === 'date' ? toISO(v) : brNum(v); hits++; if (/reuni|meeting/.test(nk)) w._meet = true; break; } }
  });
  return w.date && hits >= 3 ? w : null;
}
function parseOldDashboard(raw) {
  let root; try { root = JSON.parse(raw); } catch (e) { throw new Error('Não reconheci o conteúdo colado. Copie de novo com o comando do passo 2.'); }
  const parsed = v => { if (typeof v === 'string' && /^\s*[\[{]/.test(v)) { try { return JSON.parse(v); } catch (e) { return v; } } return v; };
  const nameOf = o => { const n = o && (o.name || o.nome || o.cliente || o.client || o.title || o.titulo || o.label || o.razaoSocial || o.empresa); return typeof n === 'string' && n.trim() ? n.trim() : null; };
  const clients = {};      // id -> cliente
  const weeksByOwner = {}; // id (ou nome) -> semanas
  const addWeeks = (owner, ws) => { if (owner == null) return; const k = String(owner); (weeksByOwner[k] = weeksByOwner[k] || []).push(...ws); };
  const clientFields = (c, o) => Object.entries(o).forEach(([k, x]) => {
    if (x == null || typeof x === 'object') return; const nk = normK(k);
    if (/(^meta|goal|target)/.test(nk)) c.goal = brNum(x);
    else if (/roas/.test(nk)) c.roas = brNum(x);
    else if (/cac/.test(nk)) c.cac = brNum(x);
    else if (/(modo|mode|tipo|funil|modelo|model)/.test(nk) && typeof x === 'string') c.mode = x;
  });
  const walk = (v, key, owner, depth) => {
    v = parsed(v); if (!v || typeof v !== 'object' || depth > 10) return;
    if (Array.isArray(v)) {
      const ws = v.map(x => (x && typeof x === 'object' && !Array.isArray(x) ? mapWeek(x) : null));
      const ok = ws.filter(Boolean).length;
      if (ok && ok >= v.length / 2) {
        v.forEach((x, i) => { const w = ws[i]; if (!w) return; const cid = x.clientId ?? x.clienteId ?? x.client_id ?? x.cliente ?? x.clientID; addWeeks(cid != null ? cid : (owner != null ? owner : key), [w]); });
        return;
      }
      v.forEach(x => walk(x, null, owner, depth + 1)); return;
    }
    const nm = nameOf(v);
    if (nm && !mapWeek(v)) {
      const id = v.id != null ? String(v.id) : (key != null ? String(key) : nm);
      const c = clients[id] || { id, name: nm }; clientFields(c, v); clients[id] = c;
      Object.entries(v).forEach(([k, x]) => walk(x, k, id, depth + 1));
      return;
    }
    Object.entries(v).forEach(([k, x]) => walk(x, k, owner, depth + 1));
  };
  walk(root, null, null, 0);
  // semanas cujo cliente não foi encontrado: não descarta, cria "Cliente <código>"
  const known = new Set(Object.values(clients).flatMap(c => [c.id, c.name]));
  Object.keys(weeksByOwner).forEach(k => { if (!known.has(k)) clients[k] = { id: k, name: 'Cliente ' + k + ' (renomear)' }; });
  const byName = {};
  Object.values(clients).forEach(c => {
    const ws = (weeksByOwner[c.id] || []).concat(c.id !== c.name ? (weeksByOwner[c.name] || []) : []);
    const uniq = {}; ws.forEach(w => { uniq[w.date + '|' + w.spend + '|' + w.leads] = w; });
    const weeks = Object.values(uniq).sort((a, b) => a.date.localeCompare(b.date));
    if (!weeks.length && !c.goal) return;
    if (!byName[c.name] || byName[c.name].weeks.length < weeks.length) byName[c.name] = Object.assign({}, c, { weeks });
  });
  return Object.values(byName).map(c => {
    const modeTxt = String(c.mode || '');
    const venda = /venda|fech|reuni|closed|sale/i.test(modeTxt) || (!modeTxt && c.weeks.some(w => w._meet || w.sales > 0));
    const model = venda ? 'venda' : 'agendamento';
    const weeks = c.weeks.map(w => { // se o painel guardou o faturamento pronto, ajusta o ticket para bater exatamente
      const conv = model === 'venda' ? n0(w.sales) : n0(w.appts);
      const t = Object.assign({}, w);
      if (w.fatTrafego != null && conv > 0 && Math.abs(conv * n0(w.ticket) - w.fatTrafego) > 0.01) t.ticket = w.fatTrafego / conv;
      return t;
    });
    return { name: c.name, goal: c.goal || 0, roas: c.roas || 0, cac: c.cac || 0, model, weeks };
  });
}
// Dados transcritos das capturas de tela enviadas em 26/11/2026 (reserva, caso não dê para copiar do navegador)
const SCREENSHOT_DATA = [
  { name: 'Cliente (meta R$ 20 mil) — renomear', goal: 20000, roas: 4, cac: 150, model: 'agendamento', weeks: [
    { date: '2026-08-17', spend: 150, leads: 25, appts: 1, ticket: 800, outros: 5000 },
    { date: '2026-08-24', spend: 150, leads: 15, appts: 1, ticket: 875, outros: 0 },
    { date: '2026-09-28', spend: 175.88, leads: 74, appts: 0, ticket: 0, outros: 0 }] },
  { name: 'Focus Consultoria', goal: 30000, roas: 3, cac: 750, model: 'venda', weeks: [
    { date: '2026-08-17', spend: 250, leads: 4, appts: 2, sales: 1, ticket: 2700 },
    { date: '2026-08-24', spend: 208.29, leads: 10, appts: 0, sales: 0, ticket: 0 },
    { date: '2026-09-18', spend: 250, leads: 9, appts: 2, sales: 0, ticket: 0 },
    { date: '2026-09-28', spend: 219.55, leads: 15, appts: 0, sales: 0, ticket: 0 },
    { date: '2026-10-05', spend: 1000, leads: 19, appts: 0, sales: 2, ticket: 2350 }] },
  { name: 'Life Embalagens', goal: 76000, roas: 0, cac: 0, model: 'agendamento', note: 'Só os totais estavam no print: entra como 1 lançamento consolidado (4 semanas) em 31/10.', weeks: [
    { date: '2026-10-31', spend: 9222.24, leads: 4026, appts: 144, ticket: 588.4119, outros: 50000 }] }
];
function importPerfClients(list) {
  const S = settingsOf(store.data); let nw = 0;
  list.forEach(c => {
    const ex = vals(store.data.clients).find(x => (x.name || '').toLowerCase() === c.name.toLowerCase());
    const camps = ex && Array.isArray(ex.campaigns) && ex.campaigns.length ? ex.campaigns : [{ id: 'geral', name: 'Geral (importado)', platform: 'Meta Ads', active: true }];
    const cl = store.put('clients', Object.assign({}, ex || {}, { name: c.name, perf: true, perfGoal: c.goal || (ex && ex.perfGoal) || '', perfRoas: c.roas || (ex && ex.perfRoas) || S.perfBench.roas, perfCac: c.cac || (ex && ex.perfCac) || '', perfCacShare: (ex && ex.perfCacShare) || S.perfBench.cacShare, perfModel: c.model, campaigns: camps }));
    const cid = camps[0].id;
    c.weeks.forEach(w => {
      store.put('perf', { id: cleanKey(cl.id + '_' + w.date + '_' + cid), clientId: cl.id, campaignId: cid, date: w.date, spend: n0(w.spend), leads: n0(w.leads), appts: n0(w.appts), sales: n0(w.sales), ticket: n0(w.ticket), imported: true });
      if (n0(w.outros)) store.put('perf', { id: cleanKey(cl.id + '_' + w.date + '_' + OUTROS), clientId: cl.id, campaignId: OUTROS, date: w.date, outros: n0(w.outros), imported: true });
      nw++;
    });
  });
  return nw;
}
function ImportOldDashboard() {
  const [raw, setRaw] = useState(''); const [res, setRes] = useState(null); const [err, setErr] = useState(''); const [done, setDone] = useState('');
  const read = () => { setErr(''); setDone(''); try { const r = parseOldDashboard(raw); if (!r.length) throw new Error('Não encontrei clientes com semanas nesse conteúdo. Confira se copiou na página do painel antigo.'); setRes(r); } catch (e) { setErr(e.message); setRes(null); } };
  const preview = list => html`<div class="card flush mt12 tbl-wrap"><table class="tbl"><thead><tr><th>Cliente</th><th>Funil</th><th class="r">Meta</th><th class="r">Semanas</th><th class="r">Gasto total</th><th class="r">Leads</th><th class="r">Faturamento</th></tr></thead><tbody>
    ${list.map(c => { const rows = c.weeks.map(w => perfRow(w, c.model)); return html`<tr key=${c.name}><td><b>${c.name}</b>${c.note && html`<div class="xs faint">${c.note}</div>`}</td><td class="small">${c.model === 'venda' ? 'reunião → venda' : 'agendamento'}</td><td class="r num">${c.goal ? money(c.goal) : '—'}</td><td class="r num">${c.weeks.length}</td>
      <td class="r num">${money2(sum(rows, r => r.spend))}</td><td class="r num">${num(sum(rows, r => r.leads))}</td><td class="r num">${money2(sum(rows, r => r.trafego + r.outros))}</td></tr>`; })}</tbody></table></div>`;
  const apply = list => { const n = importPerfClients(list); setDone(n + ' semana(s) de ' + list.length + ' cliente(s) importadas.'); toast('Painel importado: ' + n + ' semanas.'); setRes(null); };
  return html`<div class="card mt16" style=${{ maxWidth: 900 }}>
    <div class="card-h"><h3>Importar o painel semanal antigo (dashboardvisions.netlify.app)</h3></div>
    <p class="muted small" style=${{ marginTop: 0 }}>O painel antigo guarda os dados <b>só no navegador onde foram lançados</b>. Faça isto no computador e no navegador em que você usa o painel:</p>
    <ol class="small" style=${{ paddingLeft: 18, lineHeight: 1.8 }}>
      <li>Abra <b>dashboardvisions.netlify.app</b> e aperte <kbd>F12</kbd> (ou <kbd>⌥ ⌘ J</kbd> no Mac) → aba <b>Console</b>.</li>
      <li>Cole o comando abaixo e aperte Enter. Se o Chrome pedir, digite <code>allow pasting</code> antes. O comando só <b>copia</b>: não apaga nem altera nada.
        <div class="row mt8"><code class="script" style=${{ flex: 1, padding: '6px 10px' }}>${OLD_SNIPPET}</code><${Btn} sz="sm" icon="copy" on=${() => copyText(OLD_SNIPPET)}>Copiar comando</${Btn}></div></li>
      <li>Volte aqui e cole (<kbd>Ctrl/⌘ V</kbd>) na caixa abaixo.</li>
    </ol>
    <${Textarea} v=${raw} on=${setRaw} rows=${4} ph="Cole aqui o conteúdo copiado…"/>
    <div class="row wrap mt8"><${Btn} v="pri" on=${read} disabled=${!raw.trim()}>Ler dados</${Btn}>
      <${Btn} v="ghost" on=${() => { setRes(SCREENSHOT_DATA); setErr(''); setDone(''); }}>Usar os dados das capturas de tela (reserva)</${Btn}></div>
    ${err && html`<div class="callout bad mt12">${err}</div>`}
    ${res && html`<div>${preview(res)}<div class="callout info mt12"><b class="t">Confira os totais com o painel antigo antes de importar.</b>As semanas entram na campanha "Geral (importado)". Depois você cria as campanhas reais e lança as próximas semanas já divididas. Importar de novo não duplica: atualiza as mesmas semanas.</div>
      <div class="mt12"><${Btn} v="pri" on=${() => apply(res)}>Importar ${res.length} cliente(s)</${Btn}></div></div>`}
    ${done && html`<div class="callout good mt12"><b class="t">${done}</b>Veja em Clientes → Painel semanal. O painel antigo continua intacto: só apague quando conferir tudo aqui.</div>`}
  </div>`;
}
