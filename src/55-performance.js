/* ============================================================
   PAINEL SEMANAL DE CLIENTES — tráfego, aquisição e metas por cliente
   (o antigo dashboardvisions.netlify.app, agora salvo na nuvem)
   ============================================================ */
const perfCalc = r => {
  const spend = n0(r.spend), leads = n0(r.leads), appts = n0(r.appts), ticket = n0(r.ticket), outros = n0(r.outros);
  const trafego = appts * ticket;
  return { ...r, spend, leads, appts, ticket, outros, trafego, total: trafego + outros };
};
function perfAgg(rows) {
  const t = { spend: sum(rows, r => r.spend), leads: sum(rows, r => r.leads), appts: sum(rows, r => r.appts), trafego: sum(rows, r => r.trafego), outros: sum(rows, r => r.outros) };
  t.total = t.trafego + t.outros;
  t.roas = t.spend ? t.trafego / t.spend : NaN;
  t.cpl = t.leads ? t.spend / t.leads : NaN;
  t.conv = t.leads ? t.appts / t.leads * 100 : NaN;
  t.cpa = t.appts ? t.spend / t.appts : NaN;
  t.ticket = t.appts ? t.trafego / t.appts : NaN;
  return t;
}
const PERF_PERIODS = [{ v: 'all', l: 'Tudo' }, { v: '7', l: 'Últimos 7 dias' }, { v: '30', l: 'Últimos 30 dias' }, { v: 'mes', l: 'Este mês' }, { v: 'custom', l: 'Período' }];

function PerfWeekForm({ cl, init, onClose }) {
  const [f, setF] = useState(Object.assign({ date: today(), spend: '', leads: '', appts: '', ticket: (init && init.ticket) || '', outros: '' }, init || {}));
  const F = k => v => setF(p => ({ ...p, [k]: v }));
  const c = perfCalc(f);
  const save = () => {
    if (!f.date) return toast('Informe a data.');
    store.put('perf', Object.assign({}, f, { id: f.id || cl.id + '_' + f.date + '_' + uid().slice(-4), clientId: cl.id, spend: n0(f.spend), leads: n0(f.leads), appts: n0(f.appts), ticket: n0(f.ticket), outros: n0(f.outros), by: CURRENT_USER.id }));
    toast('Semana salva.'); onClose();
  };
  return html`<${Modal} title=${'Registrar semana · ' + cl.name} onClose=${onClose} footer=${html`<${Btn} on=${onClose}>Cancelar</${Btn}><${Btn} v="pri" on=${save}>Salvar semana</${Btn}>`}>
    <div class="form c2">
      <${Input} label="Data" type="date" v=${f.date} on=${F('date')} autoFocus=${true}/>
      <${Money} label="Valor gasto em tráfego" v=${f.spend} on=${F('spend')} ph="200"/>
      <${Input} label="Leads / conversas geradas" type="number" v=${f.leads} on=${F('leads')} ph="23"/>
      <${Input} label="Agendamentos / conversões" type="number" v=${f.appts} on=${F('appts')} ph="4"/>
      <${Money} label="Ticket médio" v=${f.ticket} on=${F('ticket')} ph="138"/>
      <${Money} label="Faturamento via outros canais" v=${f.outros} on=${F('outros')} ph="3000"/>
    </div>
    <div class="callout info mt12"><b class="t">Faturamento via tráfego direto (calculado): ${money2(c.trafego)}</b>
      CPL = gasto ÷ leads · CAC = gasto ÷ agendamentos · Faturamento via tráfego = agendamentos × ticket médio. O total comparado à meta soma tráfego direto + outros canais.</div>
  </${Modal}>`;
}
function PerfClientForm({ cl, onClose, onSaved }) {
  const S = settingsOf(store.data);
  const [f, setF] = useState(Object.assign({ name: '', perfGoal: '', perfRoas: S.perfBench.roas, perfCacShare: S.perfBench.cacShare }, cl || {}));
  const F = k => v => setF(p => ({ ...p, [k]: v }));
  const save = () => { if (!f.name.trim()) return toast('Informe o nome.'); const o = store.put('clients', Object.assign({}, f, { perfGoal: n0(f.perfGoal), perfRoas: n0(f.perfRoas), perfCacShare: n0(f.perfCacShare), perf: true })); onSaved && onSaved(o.id); onClose(); };
  return html`<${Modal} title=${cl && cl.id ? 'Editar cliente' : 'Novo cliente no painel'} onClose=${onClose} footer=${html`<${Btn} on=${onClose}>Cancelar</${Btn}><${Btn} v="pri" on=${save}>Salvar</${Btn}>`}>
    <div class="form c2"><${Input} cls="span3" label="Cliente" v=${f.name} on=${F('name')}/>
      <${Money} label="Meta mensal de faturamento" v=${f.perfGoal} on=${F('perfGoal')}/>
      <${Input} label="ROAS esperado (x)" type="number" v=${f.perfRoas} on=${F('perfRoas')} hint="Referência de mercado definida por você"/>
      <${Input} label="CAC esperado (% do ticket médio)" type="number" v=${f.perfCacShare} on=${F('perfCacShare')} hint="Regra prática: até metade do ticket (50%)"/></div></${Modal}>`;
}
function Bench({ l, cur, exp, fmt, lowerBetter, note }) {
  const ok = Number.isFinite(cur) && (lowerBetter ? cur <= exp : cur >= exp);
  const max = Math.max(cur || 0, exp || 0) * 1.15 || 1;
  return html`<div class="card">
    <div class="row between mb8"><b>${l}</b>${Number.isFinite(cur) && html`<${Tag} t=${ok ? 'good' : 'bad'}>${ok ? 'Dentro do esperado' : lowerBetter ? 'Acima do esperado' : 'Abaixo do esperado'}</${Tag}>`}</div>
    <div class="row between small mb8"><span class="muted">Atual</span><b class="num">${Number.isFinite(cur) ? fmt(cur) : '—'}</b></div>
    <div class="bar ${ok ? 'good' : 'bad'}" style=${{ height: 10 }}><i style=${{ width: clamp((cur || 0) / max * 100, 0, 100) + '%' }}/><span class="pace" style=${{ left: clamp(exp / max * 100, 0, 100) + '%' }} title="Esperado"/></div>
    <div class="row between small mt8"><span class="muted">Esperado</span><b class="num">${fmt(exp)}</b></div>
    <div class="xs faint mt8">${note}</div></div>`;
}
function PerformancePage() {
  const db = useDB();
  const clients = vals(db.clients).filter(c => c.perf || vals(db.perf).some(r => r.clientId === c.id) || vals(db.contracts).some(k => k.clientId === c.id && ['ativo', 'aviso'].includes(contractStatus(k)) && ['trafego', 'tracking'].includes(k.productId)))
    .sort((a, b) => a.name.localeCompare(b.name));
  const [sel, setSel] = useState(LS.get('vos7_perfcl', ''));
  const cl = db.clients[sel] || clients[0];
  useEffect(() => { if (cl) LS.set('vos7_perfcl', cl.id); }, [cl && cl.id]);
  const [per, setPer] = useState('all'); const [from, setFrom] = useState(addDays(today(), -30)); const [to, setTo] = useState(today());
  const [week, setWeek] = useState(null); const [edit, setEdit] = useState(null);
  if (!cl) return html`<div><${PageH} t="Painel semanal de clientes" s="Tráfego, aquisição e metas por cliente"/>
    <div class="card"><${Empty} t="Nenhum cliente no painel" s="Adicione um cliente para começar a registrar as semanas."><${Btn} v="pri" icon="plus" on=${() => setEdit({})}>Novo cliente</${Btn}></${Empty}></div>
    ${edit && html`<${PerfClientForm} cl=${null} onClose=${() => setEdit(null)} onSaved=${setSel}/>`}</div>`;
  const range = per === '7' ? [addDays(today(), -6), today()] : per === '30' ? [addDays(today(), -29), today()] : per === 'mes' ? [ymNow() + '-01', today()] : per === 'custom' ? [from, to] : ['0000', '9999'];
  const all = vals(db.perf).filter(r => r.clientId === cl.id).map(perfCalc).sort((a, b) => a.date.localeCompare(b.date));
  const rows = all.filter(r => r.date >= range[0] && r.date <= range[1]);
  const t = perfAgg(rows);
  const goal = n0(cl.perfGoal); const roasExp = n0(cl.perfRoas) || db.S.perfBench.roas; const cacShare = (n0(cl.perfCacShare) || db.S.perfBench.cacShare) / 100;
  const last = all[all.length - 1];
  const monthRows = last ? all.filter(r => ymOf(r.date) === ymOf(last.date)) : [];
  const monthTot = sum(monthRows, r => r.total);
  const pctMeta = goal ? monthTot / goal * 100 : NaN;
  // acumulado no mês para o gráfico Faturamento x Meta
  const cum = {}; const cumRows = rows.map(r => { const m = ymOf(r.date); cum[m] = cum[m] || { t: 0, o: 0 }; cum[m].t += r.trafego; cum[m].o += r.outros; return { label: fdateShort(r.date), t: cum[m].t, o: cum[m].o }; });
  const cacExp = Number.isFinite(t.ticket) ? t.ticket * cacShare : NaN;
  const setGoal = () => { const v = prompt('Meta mensal de faturamento de ' + cl.name + ' (R$):', goal || ''); if (v == null) return; store.put('clients', Object.assign({}, cl, { perfGoal: n0(v), perf: true })); };
  const exportPdf = () => { document.title = 'Painel semanal — ' + cl.name; window.print(); setTimeout(() => (document.title = 'Visions OS'), 500); };
  return html`<div class="perf-page">
    <${PageH} t="Painel semanal de clientes" s="Tráfego, aquisição e metas por cliente">
      <div style=${{ width: 220 }}><${Select} v=${cl.id} on=${v => (v === '__new' ? setEdit({}) : setSel(v))} opts=${clients.map(c => ({ v: c.id, l: c.name })).concat({ v: '__new', l: '+ Novo cliente' })}/></div>
      <${Btn} v="ghost" icon="edit" on=${() => setEdit(cl)} title="Editar cliente"/>
      <button class="btn" onClick=${setGoal} title="Editar meta">Meta mensal: <b>${goal ? money2(goal) : 'definir'}</b></button>
      <${Btn} icon="down" on=${exportPdf}>Exportar PDF</${Btn}>
      <${Btn} v="pri" icon="plus" on=${() => setWeek({ ticket: last ? last.ticket : '' })}>Registrar semana</${Btn}>
    </${PageH}>
    <div class="row wrap mb16 no-print"><${Seg} v=${per} on=${setPer} opts=${PERF_PERIODS}/>
      ${per === 'custom' && html`<input class="inp sm" type="date" value=${from} onChange=${e => setFrom(e.target.value)} style=${{ width: 150 }}/><span class="faint">até</span><input class="inp sm" type="date" value=${to} onChange=${e => setTo(e.target.value)} style=${{ width: 150 }}/>`}</div>
    ${!all.length ? html`<div class="card"><${Empty} t=${'Nenhuma semana registrada para ' + cl.name} s="Clique em Registrar semana para lançar gasto, leads, agendamentos e faturamento."/></div>` : html`
    <div class="grid g-side mb16">
      <div class="card"><div class="row" style=${{ gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style=${{ width: 120, height: 120, borderRadius: '50%', background: `conic-gradient(var(--primary-2) ${clamp(pctMeta || 0, 0, 100) * 3.6}deg, var(--surface-3) 0)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style=${{ width: 92, height: 92, borderRadius: '50%', background: 'var(--surface)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}><b style=${{ fontSize: 24 }}>${Number.isFinite(pctMeta) ? num(pctMeta) + '%' : '—'}</b><span class="xs faint">da meta</span></div></div>
        <div class="col" style=${{ gap: 4, flex: 1, minWidth: 200 }}>
          <div class="xs faint">${last ? monthLabel(ymOf(last.date)) + ' · última leitura ' + fdateShort(last.date) : ''}</div>
          <div class="row between"><span class="muted">Faturamento no mês</span><b class="num">${money2(monthTot)}</b></div>
          <div class="row between"><span class="muted">Meta do mês</span><b class="num">${goal ? money2(goal) : '—'}</b></div>
          <div class="row between"><span class="muted"><span class="dot" style=${{ background: 'var(--s1)', marginRight: 6 }}/>Via tráfego direto</span><b class="num">${money2(sum(monthRows, r => r.trafego))}</b></div>
          <div class="row between"><span class="muted"><span class="dot" style=${{ background: 'var(--s2)', marginRight: 6 }}/>Via outros canais</span><b class="num">${money2(sum(monthRows, r => r.outros))}</b></div>
        </div></div></div>
      <div class="kpi accent"><div class="l">ROAS · retorno sobre o investimento em tráfego</div><div class="v">${Number.isFinite(t.roas) ? num(t.roas, 1) + 'x' : '—'}</div>
        <div class="s">${Number.isFinite(t.roas) ? 'A cada R$ 1 investido, voltaram ' + money2(t.roas) + ' em faturamento via tráfego.' : 'Registre gasto e agendamentos.'}</div></div>
    </div>
    <div class="grid g5 mb16">
      <${Kpi} l="Faturamento no período" v=${money(t.total)} s=${'tráfego ' + money(t.trafego) + ' · outros ' + money(t.outros)}/>
      <${Kpi} l="Gasto no período" v=${money2(t.spend)}/>
      <${Kpi} l="Leads" v=${num(t.leads)} s=${'CPL ' + (Number.isFinite(t.cpl) ? money2(t.cpl) : '—')}/>
      <${Kpi} l="Leads → agendamento" v=${pct(t.conv)} s=${num(t.appts) + ' agendamentos'}/>
      <${Kpi} l="CAC (por agendamento)" v=${Number.isFinite(t.cpa) ? money2(t.cpa) : '—'} s=${'ticket médio ' + (Number.isFinite(t.ticket) ? money2(t.ticket) : '—') + ' · ' + rows.length + ' semana(s)'}/>
    </div>
    <div class="grid g2 mb16">
      <div class="card"><div class="card-h"><h3>Faturamento × Meta</h3><span class="sub">acumulado no mês</span></div>
        <${BarChart} stacked=${true} labels=${cumRows.map(r => r.label)} fmt=${v => (v >= 1000 ? num(v / 1000, 1) + 'k' : num(v))}
          series=${[{ name: 'Via tráfego direto', data: cumRows.map(r => r.t), color: 'var(--s1)' }, { name: 'Via outros canais', data: cumRows.map(r => r.o), color: 'var(--s2)' }]}
          refLine=${goal ? { v: goal, name: 'Meta', color: 'var(--s3)' } : null}/></div>
      <div class="card"><div class="card-h"><h3>CPL × CAC por semana</h3></div>
        <${BarChart} labels=${rows.map(r => fdateShort(r.date))} fmt=${v => money(v)}
          series=${[{ name: 'CPL', data: rows.map(r => (r.leads ? r.spend / r.leads : 0)), color: 'var(--s1)' }, { name: 'CAC (por agendamento)', data: rows.map(r => (r.appts ? r.spend / r.appts : 0)), color: 'var(--s2)' }]}/></div>
    </div>
    <div class="grid g2 mb16">
      <${Bench} l="CAC (por agendamento)" cur=${t.cpa} exp=${cacExp} fmt=${money2} lowerBetter=${true} note=${'Regra prática: até ' + num(cacShare * 100) + '% do ticket médio.'}/>
      <${Bench} l="ROAS · retorno sobre tráfego" cur=${t.roas} exp=${roasExp} fmt=${v => num(v, 1) + 'x'} note="Referência de mercado definida manualmente."/>
    </div>`}
    <div class="card flush tbl-wrap"><div class="lgroup"><span>Histórico semanal</span><span>${rows.length} registro(s)</span></div>
      <table class="tbl"><thead><tr><th>Data</th><th class="r">Gasto</th><th class="r">Leads</th><th class="r">CPL</th><th class="r">Agend.</th><th class="r">Custo/agend.</th><th class="r">Ticket médio</th><th class="r">Via tráfego</th><th class="r">Via outros</th><th class="r">Total</th><th class="r">% meta</th><th class="no-print"/></tr></thead><tbody>
      ${rows.slice().reverse().map(r => html`<tr key=${r.id}><td class="b">${fdate(r.date)}</td><td class="r num">${money2(r.spend)}</td><td class="r num">${r.leads}</td><td class="r num">${r.leads ? money2(r.spend / r.leads) : '—'}</td><td class="r num">${r.appts}</td>
        <td class="r num">${r.appts ? money2(r.spend / r.appts) : '—'}</td><td class="r num">${money2(r.ticket)}</td><td class="r num">${money2(r.trafego)}</td><td class="r num">${money2(r.outros)}</td><td class="r num b">${money2(r.total)}</td>
        <td class="r num">${goal ? pct(r.total / goal * 100) : '—'}</td>
        <td class="r no-print" style=${{ whiteSpace: 'nowrap' }}><${Btn} sz="xs" v="ghost" icon="edit" on=${() => setWeek(r)}/><${Btn} sz="xs" v="ghost" cls="danger" icon="trash" on=${() => delWithUndo('perf', r.id, 'Semana')}/></td></tr>`)}
      </tbody></table></div>
    ${week && html`<${PerfWeekForm} cl=${cl} init=${week} onClose=${() => setWeek(null)}/>`}
    ${edit && html`<${PerfClientForm} cl=${edit.id ? edit : null} onClose=${() => setEdit(null)} onSaved=${setSel}/>`}
  </div>`;
}
