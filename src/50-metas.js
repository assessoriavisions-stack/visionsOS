/* ============================================================
   METAS & CALCULADORAS
   ============================================================ */
function paceOf(ym) { const t = ymNow(); if (ym < t) return 1; if (ym > t) return 0; return bizElapsed(ym) / bizDays(ym); }

function GoalsPage({ nav }) {
  const db = useDB();
  const [ym, setYm] = useState(ymNow());
  const g = db.goals[ym] || { id: ym };
  const act = goalActuals(db, ym);
  const pace = paceOf(ym);
  const setG = (k, v) => store.put('goals', Object.assign({}, g, { id: ym, [k]: v === '' ? '' : n0(v) }));
  const copyPrev = () => { const p = db.goals[addMonths(ym, -1)]; if (!p) return toast('Mês anterior sem metas.'); const o = Object.assign({}, p, { id: ym }); delete o.createdAt; store.put('goals', o); toast('Metas copiadas de ' + monthLabel(addMonths(ym, -1)) + '.'); };
  const restDays = Math.max(0, bizDays(ym) - bizElapsed(ym));
  const fields = GOAL_FIELDS;
  const hist = Array.from({ length: 6 }, (_, i) => addMonths(ym, i - 5));
  return html`<div>
    <${PageH} t="Metas do mês" s=${ym === ymNow() ? `Dia útil ${bizElapsed(ym)} de ${bizDays(ym)} · faltam ${restDays} dias úteis. A marca na barra mostra onde você deveria estar hoje.` : monthLabel(ym)}>
      <${MonthNav} v=${ym} on=${setYm}/>
      <${Btn} on=${copyPrev}>Copiar mês anterior</${Btn}>
      <${Btn} v="pri" icon="calc" on=${() => nav.go('calc_meta')}>Calcular metas</${Btn}>
    </${PageH}>
    <div class="grid g3 mb16">${fields.map(fl => {
    const meta = g[fl.id]; const real = act[fl.id]; const has = meta !== '' && meta != null && Number(meta) > 0;
    const p = has ? real / meta : 0;
    const missing = has && !fl.lower ? Math.max(0, meta - real) : 0;
    const status = !has ? null : fl.lower ? (Number.isFinite(real) && real <= meta ? ['good', 'dentro'] : !Number.isFinite(real) ? ['', 'sem dados'] : ['bad', 'acima']) : p >= 1 ? ['good', 'batida 🎯'] : p >= pace * 0.9 ? ['good', 'no ritmo'] : p >= pace * 0.7 ? ['warn', 'atenção'] : ['bad', 'atrás'];
    return html`<div class="card" key=${fl.id}>
        <div class="row between mb8"><b title=${fl.h}>${fl.l}</b>${status && html`<${Tag} t=${status[0]}>${status[1]}</${Tag}>`}</div>
        <div class="row between" style=${{ alignItems: 'flex-end' }}>
          <div><div class="xs faint">Realizado</div><div class="num" style=${{ fontSize: 24, fontWeight: 800 }}>${Number.isFinite(real) ? fmtBy(fl.fmt, real) : '—'}</div></div>
          <div style=${{ width: 120 }}><div class="xs faint right">Meta</div><input class="inp sm num" style=${{ textAlign: 'right', fontWeight: 700 }} inputMode="decimal" value=${meta ?? ''} placeholder="definir" onChange=${e => setG(fl.id, e.target.value)}/></div>
        </div>
        ${has && html`<div class="mt12"><${Progress} v=${Number.isFinite(real) ? real : 0} max=${meta} pace=${fl.lower ? null : pace} lowerBetter=${fl.lower}/></div>
          <div class="xs faint mt8">${fl.lower ? (fl.id === 'cac' ? 'CAC realizado precisa ficar abaixo da meta' : 'Limite planejado') : missing > 0 ? 'Faltam ' + fmtBy(fl.fmt, missing) + (restDays && ym === ymNow() ? ' · ' + fmtBy(fl.fmt, missing / restDays) + ' por dia útil' : '') : 'Meta atingida'}</div>`}
      </div>`;
  })}</div>
    <div class="card"><div class="card-h"><h3>Novo MRR: meta × realizado</h3><span class="sub">últimos 6 meses</span></div>
      <${BarChart} labels=${hist.map(monthShort)} highlight=${5} fmt=${v => money(v)} series=${[{ name: 'Meta', data: hist.map(m => n0((db.goals[m] || {}).newMrr)), color: 'var(--border-strong)' }, { name: 'Realizado', data: hist.map(m => monthFinance(db, m).novoMrr), color: 'var(--s1)' }]}/>
    </div>
  </div>`;
}

/* --------- calculadora de metas & CAC --------- */
function realBaseline(db, months = 3) {
  const end = today(); const start = addDays(end, -30 * months);
  const ev = funnelEvents(db, start, end);
  const cm = [0, 1, 2].map(i => addMonths(ymNow(), -i));
  const spend = sum(cm, m => spendOf(db, m));
  return {
    ticket: ev.ganhos ? ev.mrrGanho / ev.ganhos : null, setup: ev.ganhos ? ev.setupGanho / ev.ganhos : null,
    rLeadMeet: ev.leads ? ev.agendada / ev.leads * 100 : null, rShow: ev.agendada ? ev.realizada / ev.agendada * 100 : null,
    rClose: ev.realizada ? ev.ganhos / ev.realizada * 100 : null, cpl: ev.leads && spend ? spend / ev.leads : null, ev
  };
}
function CalcGoalPage() {
  const db = useDB(); const S = db.S;
  const def = { mode: 'mrr', meta: 10000, sales: 4, ticket: 2500, setup: 0, rLeadMeet: 30, rShow: 75, rClose: 30, cpl: 25, fixed: 0, ret: Math.round(retentionMonths(db) * 10) / 10, margin: S.grossMargin, days: bizDays(addMonths(ymNow(), 1)) };
  const [p, setP] = useState(() => Object.assign(def, S.calcGoal || {}, LS.get('vos7_calcgoal', {})));
  useEffect(() => LS.set('vos7_calcgoal', p), [p]);
  const P = k => v => setP(x => ({ ...x, [k]: v }));
  const r = calcGoal(p);
  const [target, setTarget] = useState(addMonths(ymNow(), new Date().getDate() > 20 ? 1 : 0));
  const useReal = () => {
    const b = realBaseline(db); const patch = {};
    ['ticket', 'setup', 'rLeadMeet', 'rShow', 'rClose', 'cpl'].forEach(k => { if (b[k] != null && Number.isFinite(b[k]) && b[k] > 0) patch[k] = Math.round(b[k] * 10) / 10; });
    patch.ret = Math.round(retentionMonths(db) * 10) / 10;
    if (!Object.keys(patch).length) return toast('Ainda não há dados suficientes nos últimos 90 dias.');
    setP(x => ({ ...x, ...patch })); toast('Preenchido com seus números reais dos últimos 90 dias (' + b.ev.leads + ' leads, ' + b.ev.ganhos + ' vendas).');
  };
  const saveGoal = () => {
    const g = Object.assign({}, db.goals[target] || {}, { id: target, newMrr: r.newMrr, sales: r.sales, meetings: r.meetings, scheduled: r.scheduled, leads: r.leads, invest: Math.round(r.invest), cac: Math.round(r.cacMax) });
    store.put('goals', g); store.setSettings({ calcGoal: p }); toast('Metas de ' + monthLabel(target) + ' atualizadas.');
  };
  const ok = Number.isFinite(r.cac) && r.cac <= r.cacMax;
  const pb = r.payback;
  return html`<div>
    <${PageH} t="Calculadora de metas & CAC" s="Funil reverso: da meta de faturamento até quantos leads, reuniões e quanto investir — e se o CAC fecha a conta.">
      <${Btn} icon="zap" on=${useReal}>Usar meus números reais</${Btn}>
    </${PageH}>
    <div class="grid g2" style=${{ alignItems: 'start' }}>
      <div class="card">
        <div class="mb12"><${Seg} v=${p.mode} on=${P('mode')} opts=${[{ v: 'mrr', l: 'Meta de novo MRR' }, { v: 'vendas', l: 'Meta de nº de vendas' }]}/></div>
        <div class="form c2">
          ${p.mode === 'mrr' ? html`<${Money} label="Novo MRR desejado no mês" v=${p.meta} on=${P('meta')}/>` : html`<${Input} label="Vendas desejadas no mês" type="number" v=${p.sales} on=${P('sales')}/>`}
          <${Money} label="Ticket médio (mensalidade)" v=${p.ticket} on=${P('ticket')}/>
          <${Money} label="Setup médio por venda" v=${p.setup} on=${P('setup')}/>
          <${Money} label="Custo por lead (CPL)" v=${p.cpl} on=${P('cpl')} hint="Mídia ÷ leads. Para outbound, use o custo da sua hora/ferramentas"/>
          <${Input} label="Lead → reunião agendada (%)" type="number" v=${p.rLeadMeet} on=${P('rLeadMeet')}/>
          <${Input} label="Comparecimento (%)" type="number" v=${p.rShow} on=${P('rShow')}/>
          <${Input} label="Reunião → venda (%)" type="number" v=${p.rClose} on=${P('rClose')}/>
          <${Money} label="Custos comerciais fixos/mês" v=${p.fixed} on=${P('fixed')} hint="SDR, comissões, ferramentas (entra no CAC)"/>
          <${Input} label="Retenção média (meses)" type="number" v=${p.ret} on=${P('ret')}/>
          <${Input} label="Margem bruta (%)" type="number" v=${p.margin} on=${P('margin')} hint="Quanto sobra da mensalidade após custo de entrega"/>
          <${Input} label="Dias úteis no mês" type="number" v=${p.days} on=${P('days')}/>
        </div>
      </div>
      <div class="col" style=${{ gap: 14 }}>
        <div class="card calc-out">
          <div class="grid g2">
            <div><div class="small muted">Vendas necessárias</div><div class="big">${num(r.sales)}</div></div>
            <div><div class="small muted">Novo MRR</div><div class="big">${money(r.newMrr)}</div></div>
            <div><div class="small muted">Investimento em mídia</div><div class="big">${money(r.invest)}</div></div>
            <div><div class="small muted">Leads por dia útil</div><div class="big">${num(r.leadsDay, 1)}</div></div>
          </div>
          <div class="hr"/>
          <${FunnelBars} rows=${[{ l: 'Leads', v: r.leads }, { l: 'Reuniões agendadas', v: r.scheduled, rate: n0(p.rLeadMeet) }, { l: 'Reuniões realizadas', v: r.meetings, rate: n0(p.rShow) }, { l: 'Vendas', v: r.sales, rate: n0(p.rClose), c: 'var(--good)' }]}/>
        </div>
        <div class="card">
          <div class="grid g3 mb12">
            <${Kpi} l="CAC projetado" v=${Number.isFinite(r.cac) ? money(r.cac) : '—'} tone=${ok ? 'good' : 'bad'}/>
            <${Kpi} l="CAC máximo" v=${money(r.cacMax)} s="LTV ÷ 3"/>
            <${Kpi} l="LTV" v=${money(r.ltv)} s=${num(p.ret, 1) + 'm × ' + p.margin + '% + setup'}/>
            <${Kpi} l="LTV : CAC" v=${Number.isFinite(r.ltvCac) ? num(r.ltvCac, 1) + 'x' : '—'} tone=${r.ltvCac >= 3 ? 'good' : 'bad'}/>
            <${Kpi} l="Payback" v=${Number.isFinite(pb) ? num(pb, 1) + ' meses' : '—'} tone=${pb <= 6 ? 'good' : pb <= 12 ? 'warn' : 'bad'}/>
            <${Kpi} l="Custo por reunião" v=${Number.isFinite(r.cpm) ? money(r.cpm) : '—'}/>
          </div>
          <div class=${'callout ' + (ok && pb <= 12 ? 'good' : 'bad')}>
            <b class="t">${ok ? (pb <= 6 ? 'Aquisição saudável.' : 'CAC ok, mas o payback está longo.') : 'CAC acima do limite.'}</b>
            ${ok ? `Cada cliente custa ${money(r.cac)} e se paga em ${num(pb, 1)} meses. Você pode investir até ${money(r.cacMax)} por cliente mantendo LTV:CAC de 3x.`
      : `Para fechar a conta: aumente o ticket/setup, melhore a conversão de reunião → venda, reduza o CPL ou aumente a retenção. Hoje cada cliente custa ${Number.isFinite(r.cac) ? money(r.cac) : '—'} e o máximo saudável é ${money(r.cacMax)}.`}
          </div>
          <div class="row wrap mt12"><span class="small muted">Salvar como meta de</span><input class="inp sm" type="month" value=${target} onChange=${e => setTarget(e.target.value)} style=${{ width: 160 }}/><${Btn} v="pri" icon="flag" on=${saveGoal}>Salvar metas</${Btn}></div>
        </div>
      </div>
    </div>
  </div>`;
}

/* --------- calculadora de prospecção por canal --------- */
function realRates(db, chId, days = 90) {
  const b = today(), a = addDays(b, -days);
  const pr = prospectTotals(db, a, b, chId);
  const ev = funnelEvents(db, a, b, d => d.channelId === chId);
  const r = (x, y) => (y > 0 ? Math.round(x / y * 1000) / 10 : null);
  return { rResp: r(pr.resp, pr.abord), rConv: r(pr.conv, pr.resp), rMeet: r(ev.agendada, pr.conv), rShow: r(ev.realizada, ev.agendada), rClose: r(ev.ganhos, ev.realizada), pr, ev };
}
function CalcProspPage() {
  const db = useDB(); const S = db.S;
  const chs = S.channels;
  const [ch, setCh] = useState((chs.find(c => c.kind === 'outbound') || chs[0]).id);
  const saved = Object.assign({}, S.calcProsp, LS.get('vos7_calcprosp', {}));
  const def = { ticket: 2500, meta: 10000, perDay: 20, days: bizDays(ymNow()), ...PROSP_REF };
  const p = Object.assign({}, def, saved[ch] || {});
  const setP = (k, v) => { const all = Object.assign({}, saved, { [ch]: Object.assign({}, p, { [k]: v }) }); LS.set('vos7_calcprosp', all); force(x => x + 1); };
  const [, force] = useState(0);
  const r = calcProsp(p);
  const rates = [
    { k: 'rResp', l: 'Resposta', s: 'de cada 100 abordagens' }, { k: 'rConv', l: 'Viram conversa/ligação', s: 'de cada 100 respostas' },
    { k: 'rMeet', l: 'Viram reunião', s: 'de cada 100 conversas' }, { k: 'rShow', l: 'Comparecem', s: 'de cada 100 marcadas' }, { k: 'rClose', l: 'Fecham', s: 'de cada 100 reuniões' }];
  const below = rates.filter(x => n0(p[x.k]) < PROSP_REF[x.k]);
  const worst = below.sort((a, b) => n0(p[a.k]) / PROSP_REF[a.k] - n0(p[b.k]) / PROSP_REF[b.k])[0];
  const useReal = () => {
    const rr = realRates(db, ch); const patch = {}; rates.forEach(x => { if (rr[x.k] != null && rr[x.k] > 0) patch[x.k] = rr[x.k]; });
    if (!Object.keys(patch).length) return toast('Sem dados suficientes deste canal nos últimos 90 dias. Registre a prospecção diária.');
    const all = Object.assign({}, saved, { [ch]: Object.assign({}, p, patch) }); LS.set('vos7_calcprosp', all); force(x => x + 1);
    toast('Taxas reais aplicadas (' + rr.pr.abord + ' abordagens, ' + rr.ev.ganhos + ' vendas em 90 dias).');
  };
  const reset = () => { const all = Object.assign({}, saved, { [ch]: Object.assign({}, p, PROSP_REF) }); LS.set('vos7_calcprosp', all); force(x => x + 1); };
  const setDaily = () => { if (!Number.isFinite(r.perDayNeeded)) return; store.setSettings({ dailyGoals: Object.assign({}, S.dailyGoals, { [ch]: r.perDayNeeded }), calcProsp: Object.assign({}, S.calcProsp, { [ch]: p }) }); toast('Meta diária de ' + chName(S, ch) + ': ' + r.perDayNeeded + ' abordagens.'); };
  return html`<div>
    <${PageH} t="Calculadora de prospecção" s="Quantas abordagens por dia, por canal, para bater sua meta. Comece com as taxas de referência e troque pelas suas reais."/>
    <div class="chips mb16">${chs.map(c => html`<button key=${c.id} class=${'chip' + (ch === c.id ? ' on' : '')} onClick=${() => setCh(c.id)}>${c.name}${S.dailyGoals[c.id] ? ' · ' + S.dailyGoals[c.id] + '/dia' : ''}</button>`)}</div>
    <div class="grid g2" style=${{ alignItems: 'start' }}>
      <div class="card">
        <div class="xs faint b mb8" style=${{ letterSpacing: '.12em' }}>SUA META</div>
        <div class="form c2 mb16">
          <${Money} label="Ticket médio (R$)" v=${p.ticket} on=${v => setP('ticket', v)}/>
          <${Money} label="Meta mensal deste canal (R$)" v=${p.meta} on=${v => setP('meta', v)}/>
          <${Input} label="Prospecções por dia" type="number" v=${p.perDay} on=${v => setP('perDay', v)}/>
          <${Input} label="Dias úteis no mês" type="number" v=${p.days} on=${v => setP('days', v)}/>
        </div>
        <div class="xs faint b mb8" style=${{ letterSpacing: '.12em' }}>SUAS TAXAS (%)</div>
        <div class="form c2">${rates.map(x => html`<${Input} key=${x.k} label=${x.l} hint=${x.s + ' · ref. ' + PROSP_REF[x.k] + '%'} type="number" v=${p[x.k]} on=${v => setP(x.k, v)}/>`)}
          <div class="col" style=${{ justifyContent: 'flex-end' }}><${Btn} icon="zap" on=${useReal}>Usar minhas taxas reais</${Btn}><${Btn} v="ghost" on=${reset}>Voltar à referência</${Btn}></div></div>
      </div>
      <div class="card calc-out">
        <div class="grid g2 mb16">
          <div><div class="small muted">Faturamento potencial no mês</div><div class="big">${money(r.fat)}</div></div>
          <div><div class="small muted">Prospecções por dia pra meta</div><div class="big" style=${{ color: 'var(--primary)' }}>${Number.isFinite(r.perDayNeeded) ? num(r.perDayNeeded) : '—'}</div></div>
          <div><div class="small muted">Vendas previstas no mês</div><div class="big">${num(r.vendasPrev, 1)}</div></div>
          <div><div class="small muted">Vendas necessárias pra meta</div><div class="big">${num(r.vendasNec)}</div></div>
        </div>
        <b>Seu funil no mês</b>
        <div class="mt12"><${FunnelBars} rows=${[{ l: 'Prospecções', v: r.steps[0] }, ...rates.map((x, i) => ({ l: ['Respostas', 'Conversas', 'Reuniões marcadas', 'Compareceram', 'Vendas'][i], v: r.steps[i + 1], rate: n0(p[x.k]), c: i === 4 ? 'var(--good)' : null }))]}/></div>
        <div class=${'callout mt12 ' + (below.length ? 'warn' : 'good')}>
          ${below.length ? html`<b class="t">Gargalo: ${worst.l.toLowerCase()} (${p[worst.k]}% vs ${PROSP_REF[worst.k]}% de referência).</b>Melhorar essa etapa rende mais do que aumentar volume. ${worst.k === 'rResp' ? 'Revise a abertura e a lista (ICP).' : worst.k === 'rShow' ? 'Confirme a reunião na véspera e no dia.' : worst.k === 'rClose' ? 'Revise diagnóstico, proposta e follow-up pós-reunião.' : 'Revise o script de qualificação e o convite para reunião.'}`
      : html`<b class="t">Funil saudável.</b>Todas as taxas estão na referência ou acima. O caminho agora é volume com direcionamento.`}
        </div>
        <div class="row wrap mt12"><${Btn} v="pri" icon="target" on=${setDaily} disabled=${!Number.isFinite(r.perDayNeeded)}>Definir ${Number.isFinite(r.perDayNeeded) ? r.perDayNeeded : ''}/dia como meta deste canal</${Btn}></div>
        <div class="xs faint mt12">Referências Visions (ajuste às suas): resposta 9% (lista quente) · 38% viram conversa · 33% viram reunião · 80% comparecem · 30% fecham. Refaça a conta todo mês.</div>
      </div>
    </div>
  </div>`;
}
