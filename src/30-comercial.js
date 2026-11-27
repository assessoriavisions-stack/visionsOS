/* ============================================================
   COMERCIAL — CRM, follow-up/cadências, prospecção, análise
   ============================================================ */
const chName = (S, id) => (S.channels.find(c => c.id === id) || {}).name || '—';
const prodName = (S, id) => (S.products.find(p => p.id === id) || {}).name || '—';
const prodOf = (S, id) => S.products.find(p => p.id === id);
const memberName = (S, id) => (S.team.find(t => t.id === id) || {}).name || '';
const cadFor = (S, chId) => { const k = (S.channels.find(c => c.id === chId) || {}).kind; return k === 'outbound' ? 'cad_outbound' : (k === 'pago' || k === 'inbound' || k === 'indicacao') ? 'cad_inbound' : ''; };
const scriptVars = (d, me) => ({ nome: (d.name || '').split(' ')[0], empresa: d.company || 'sua empresa', eu: me || '' });

/* ---------- ações sobre leads ---------- */
function logActivity(d, type, text, extra) {
  const a = Object.assign({ id: uid(), type, text, at: stamp(), by: CURRENT_USER.id }, extra || {});
  return { activities: [a].concat(d.activities || []), lastTouch: a.at };
}
function bumpProspect(chId, metric, n = 1) {
  if (!chId) return;
  const id = prospectDocId(today(), CURRENT_USER.id);
  const cur = store.data.prospect[id] || { id, date: today(), user: CURRENT_USER.id, byCh: {} };
  const byCh = Object.assign({}, cur.byCh); const m = Object.assign({}, byCh[chId] || {});
  m[metric] = Math.max(0, (Number(m[metric]) || 0) + n); byCh[chId] = m;
  store.put('prospect', Object.assign({}, cur, { byCh }));
}
function startCadence(d, cadId) {
  const cad = store.data.cadences[cadId]; if (!cad) return {};
  const st = (cad.steps || [])[0];
  return { cadenceId: cadId, cadenceStep: 0, cadenceStart: today(), cadenceDue: nextBiz(addDays(today(), st ? st.day || 0 : 0)), cadencePaused: false };
}
function moveDeal(d, to, extra) {
  const patch = Object.assign(stagePatch(d, to), extra || {});
  const add = logActivity(d, 'nota', 'Etapa: ' + stageOf(d.stage).l + ' → ' + stageOf(to).l, { sys: true });
  Object.assign(patch, add);
  if (to === 'conexao' && d.cadenceId === 'cad_outbound') { patch.cadenceId = null; patch.nextAction = 'Qualificar e agendar reunião'; patch.nextDate = addDays(today(), 1); }
  if (to === 'agendada' || to === 'realizada') { patch.cadenceId = null; }
  if (to === 'realizada') { patch.nextAction = d.nextAction && d.stage === 'realizada' ? d.nextAction : 'Enviar proposta'; patch.nextDate = addDays(today(), 1); }
  if (to === 'proposta' && store.data.cadences.cad_proposta && d.cadenceId !== 'cad_proposta') Object.assign(patch, startCadence(d, 'cad_proposta'));
  store.put('deals', Object.assign({}, d, patch));
  if (to === 'proposta') toast('Cadência "Pós-reunião / Proposta" iniciada para ' + d.name + '.');
}
function completeStep(d, outcome) {
  const db = { ...store.data, S: settingsOf(store.data) };
  const t = nextTask(db, d);
  if (!t || t.kind === 'none') return;
  let patch = {};
  if (t.kind === 'cad') {
    const st = t.step;
    Object.assign(patch, logActivity(d, st.ch, 'Passo ' + (t.i + 1) + '/' + t.total + ' — ' + st.title + (outcome === 'respondeu' ? ' · respondeu ✅' : '')));
    bumpProspect(d.channelId, t.i === 0 && (d.stage === 'novo' || d.stage === 'contato') && !d.firstTouch ? 'abord' : 'fup');
    if (t.i === 0) patch.firstTouch = true;
    if (outcome === 'respondeu') {
      bumpProspect(d.channelId, 'resp');
      Object.assign(patch, { cadenceId: null, nextAction: 'Qualificar e agendar reunião', nextDate: today() });
      if (stageIdx(d.stage) < stageIdx('conexao')) Object.assign(patch, stagePatch(Object.assign({}, d, patch), 'conexao'));
      toast(d.name + ' respondeu! Movido para "Conectado".');
    } else {
      const nx = t.cad.steps[t.i + 1];
      if (nx) {
        const gap = Math.max(0, (nx.day || 0) - (st.day || 0));
        Object.assign(patch, { cadenceStep: t.i + 1, cadenceDue: nextBiz(addDays(today(), gap)) });
      } else {
        Object.assign(patch, { cadenceId: null, nextAction: 'Cadência concluída sem resposta — perder ou nutrir?', nextDate: today() });
      }
      if (d.stage === 'novo') Object.assign(patch, stagePatch(Object.assign({}, d, patch), 'contato'));
    }
  } else {
    Object.assign(patch, logActivity(d, 'nota', 'Feito: ' + (t.title || 'próxima ação')), { nextAction: '', nextDate: '' });
    if (d.stage === 'perdido') patch.reactivateAt = '';
  }
  store.put('deals', Object.assign({}, d, patch));
}
function snooze(d, days) {
  const db = { ...store.data, S: settingsOf(store.data) };
  const t = nextTask(db, d); if (!t) return;
  const nd = nextBiz(addDays(today(), days));
  if (t.kind === 'cad') store.put('deals', Object.assign({}, d, { cadenceDue: nd }));
  else if (d.stage === 'perdido') store.put('deals', Object.assign({}, d, { reactivateAt: nd }));
  else store.put('deals', Object.assign({}, d, { nextDate: nd }));
  toast('Adiado para ' + fdateShort(nd) + '.');
}

/* ---------- formulário de lead ---------- */
function DealForm({ deal, onClose, onSaved }) {
  const db = useDB(); const S = db.S;
  const isNew = !deal || !deal.id;
  const [f, setF] = useState(() => Object.assign({ name: '', company: '', phone: '', instagram: '', email: '', segment: '', channelId: '', productId: '', mrr: '', setup: '', ownerId: CURRENT_USER.id, stage: 'novo', notes: '', cadenceOn: true, cadencePick: '', nextAction: '', nextDate: '', meetingAt: '' }, deal || {}));
  const F = k => v => setF(p => ({ ...p, [k]: v }));
  const cadOpts = vals(db.cadences).map(c => ({ v: c.id, l: c.name }));
  const suggested = f.cadencePick || cadFor(S, f.channelId);
  const pickProduct = v => setF(p => { const pr = prodOf(S, v); return { ...p, productId: v, mrr: p.mrr || (pr ? pr.price : ''), setup: p.setup || (pr && pr.setup ? pr.setup : '') }; });
  const save = () => {
    if (!f.name.trim()) { toast('Informe o nome do lead.'); return; }
    let obj = Object.assign({}, f, { mrr: n0(f.mrr), setup: n0(f.setup) });
    delete obj.cadenceOn; delete obj.cadencePick;
    if (isNew) {
      obj.id = uid(); obj.history = []; obj.activities = [];
      Object.assign(obj, stagePatch(obj, f.stage || 'novo'));
      obj.activities = [{ id: uid(), type: 'nota', text: 'Lead criado (' + chName(S, f.channelId) + ')', at: stamp(), by: CURRENT_USER.id, sys: true }];
      if (f.cadenceOn && suggested && ['novo', 'contato', 'conexao'].includes(f.stage)) Object.assign(obj, startCadence(obj, suggested));
      if (f.notes) obj.activities.unshift({ id: uid(), type: 'nota', text: f.notes, at: stamp(), by: CURRENT_USER.id });
    }
    const saved = store.put('deals', obj);
    toast(isNew ? 'Lead criado.' : 'Lead atualizado.');
    onSaved && onSaved(saved); onClose();
  };
  return html`<${Modal} title=${isNew ? 'Novo lead' : 'Editar lead'} onClose=${onClose} size="lg"
    footer=${html`<${Btn} on=${onClose}>Cancelar</${Btn}><${Btn} v="pri" on=${save}>${isNew ? 'Criar lead' : 'Salvar'}</${Btn}>`}>
    <div class="form c2">
      <${Input} label="Nome do contato *" v=${f.name} on=${F('name')} ph="Ex: Maria Silva" autoFocus=${true}/>
      <${Input} label="Empresa" v=${f.company} on=${F('company')} ph="Ex: Clínica Sorriso"/>
      <${Input} label="WhatsApp" v=${f.phone} on=${F('phone')} ph="(11) 99999-9999"/>
      <${Input} label="Instagram" v=${f.instagram} on=${F('instagram')} ph="@perfil"/>
      <${Field} label="Canal de origem" cls="span3"><${Chips} v=${f.channelId} on=${F('channelId')} opts=${S.channels.map(c => ({ v: c.id, l: c.name }))}/></${Field}>
      <${Field} label="Produto de interesse" cls="span3"><${Chips} v=${f.productId} on=${pickProduct} opts=${S.products.filter(p => !p.legacy || p.id === f.productId).map(p => ({ v: p.id, l: p.name }))}/></${Field}>
      <${Money} label=${(prodOf(S, f.productId) || {}).kind === 'projeto' ? 'Valor do projeto' : 'Mensalidade (MRR)'} v=${f.mrr} on=${F('mrr')}/>
      <${Money} label="Setup / implantação" v=${f.setup} on=${F('setup')}/>
      <${Select} label="Responsável" v=${f.ownerId} on=${F('ownerId')} opts=${S.team.map(t => ({ v: t.id, l: t.name }))}/>
      <${Select} label="Etapa" v=${f.stage} on=${F('stage')} opts=${STAGES.filter(s => s.id !== 'perdido' && s.id !== 'ganho').map(s => ({ v: s.id, l: s.l }))}/>
      <${Input} label="Segmento" v=${f.segment} on=${F('segment')} ph="Ex: Odontologia"/>
      <${Input} label="E-mail" v=${f.email} on=${F('email')}/>
      ${f.stage === 'agendada' && html`<${Input} label="Data/hora da reunião" type="datetime-local" v=${f.meetingAt} on=${F('meetingAt')}/>`}
      ${isNew && html`<${Textarea} label="Observação inicial" cls="span3" v=${f.notes} on=${F('notes')} ph="Contexto, dor, como chegou…" rows=${2}/>`}
      ${isNew && html`<div class="span3 card tight" style=${{ background: 'var(--surface-2)' }}>
        <${Toggle} v=${f.cadenceOn} on=${F('cadenceOn')} label=${html`<b>Iniciar cadência de follow-up agora</b>`}/>
        ${f.cadenceOn && html`<div class="mt8"><${Select} v=${suggested} on=${F('cadencePick')} opts=${cadOpts} ph="Escolha a cadência…"/>
          <div class="xs faint mt8">As tarefas aparecem em <b>Follow-ups</b> e na tela <b>Hoje</b> no dia certo, com o script pronto.</div></div>`}
      </div>`}
    </div>
  </${Modal}>`;
}

/* ---------- ganhar / perder ---------- */
function LoseModal({ deal, onClose }) {
  const db = useDB();
  const [reason, setReason] = useState(''); const [note, setNote] = useState(''); const [nurture, setNurture] = useState(true);
  const save = () => {
    if (!reason) { toast('Escolha o motivo da perda.'); return; }
    const patch = Object.assign(stagePatch(deal, 'perdido'), { lostReason: reason, lostNote: note, reactivateAt: nurture ? addDays(today(), 90) : '' },
      logActivity(deal, 'nota', 'Perdido: ' + reason + (note ? ' — ' + note : '')));
    store.put('deals', Object.assign({}, deal, patch)); toast('Lead marcado como perdido.'); onClose();
  };
  return html`<${Modal} title=${'Perdido — ' + deal.name} onClose=${onClose}
    footer=${html`<${Btn} on=${onClose}>Cancelar</${Btn}><${Btn} v="pri" cls="danger" on=${save}>Marcar como perdido</${Btn}>`}>
    <div class="form">
      <${Field} label="Motivo"><${Chips} v=${reason} on=${setReason} opts=${db.S.lossReasons.map(r => ({ v: r, l: r }))}/></${Field}>
      <${Textarea} label="Detalhe (opcional)" v=${note} on=${setNote} rows=${2}/>
      <${Toggle} v=${nurture} on=${setNurture} label="Lembrar de reativar em 90 dias (entra nos Follow-ups)"/>
    </div></${Modal}>`;
}

/* ---------- ficha do lead (drawer) ---------- */
function DealDrawer({ id, onClose, openWin }) {
  const db = useDB(); const S = db.S;
  const d = db.deals[id];
  const [edit, setEdit] = useState(false); const [lose, setLose] = useState(false);
  const [atype, setAtype] = useState('whatsapp'); const [atext, setAtext] = useState('');
  const [nextA, setNextA] = useState(''); const [nextD, setNextD] = useState('');
  if (!d) return null;
  const t = nextTask(db, d);
  const vars = scriptVars(d, CURRENT_USER.name);
  const scr = t && t.kind === 'cad' ? fill(t.step.script, vars) : '';
  const addAct = () => {
    if (!atext.trim()) return;
    store.put('deals', Object.assign({}, d, logActivity(d, atype, atext.trim()))); setAtext('');
  };
  const setNext = () => { if (!nextD) { toast('Escolha a data.'); return; } store.put('deals', Object.assign({}, d, { nextAction: nextA || 'Follow-up', nextDate: nextD })); setNextA(''); setNextD(''); toast('Próxima ação agendada.'); };
  const days = diffDays(dOfStamp(d.stageAt || d.createdAt), today());
  const open = d.stage !== 'ganho' && d.stage !== 'perdido';
  const head = html`<div>
    <div class="row between">
      <div class="row" style=${{ gap: 12 }}><${Avatar} name=${d.name} size=${42}/><div><h3 style=${{ fontSize: 18 }}>${d.name}</h3><div class="muted small">${[d.company, d.segment].filter(Boolean).join(' · ') || 'Sem empresa'}</div></div></div>
      <button class="btn ghost icon" onClick=${onClose} aria-label="Fechar"><${Icon} n="x"/></button>
    </div>
    <div class="row wrap mt12">
      <${Tag} t="pri">${stageOf(d.stage).l}</${Tag}>
      ${d.channelId && html`<${Tag}>${chName(S, d.channelId)}</${Tag}>`}
      ${d.productId && html`<${Tag}>${prodName(S, d.productId)}</${Tag}>`}
      ${d.mrr > 0 && html`<${Tag} t="good">${money(d.mrr)}${(prodOf(S, d.productId) || {}).kind === 'projeto' ? '' : '/mês'}</${Tag}>`}
      ${d.setup > 0 && html`<${Tag}>+ ${money(d.setup)} setup</${Tag}>`}
      ${d.ownerId && html`<${Tag}>👤 ${memberName(S, d.ownerId)}</${Tag}>`}
      ${open && html`<${Tag} t=${days > 14 ? 'warn' : ''}>${days}d nesta etapa</${Tag}>`}
    </div>
    <div class="row wrap mt12">
      ${d.phone && html`<${Btn} sz="sm" cls="wa" icon="msg" href=${waLink(d.phone, scr || '')}>WhatsApp</${Btn}>`}
      ${d.phone && html`<${Btn} sz="sm" icon="phone" href=${'tel:' + onlyDigits(d.phone)}>Ligar</${Btn}>`}
      ${d.instagram && html`<${Btn} sz="sm" icon="external" href=${'https://instagram.com/' + d.instagram.replace('@', '')}>Instagram</${Btn}>`}
      <span style=${{ flex: 1 }}/>
      <${Btn} sz="sm" icon="edit" on=${() => setEdit(true)}>Editar</${Btn}>
      ${open && html`<${Btn} sz="sm" v="good" icon="check" on=${() => openWin(d)}>Ganho</${Btn}>`}
      ${open && html`<${Btn} sz="sm" cls="danger" on=${() => setLose(true)}>Perdido</${Btn}>`}
      ${!open && html`<${Btn} sz="sm" on=${() => moveDeal(d, 'negociacao')}>Reabrir</${Btn}>`}
    </div>
  </div>`;
  return html`<${Drawer} onClose=${onClose} head=${head}>
    <div class="stepper mb16">${STAGES.filter(s => s.id !== 'perdido').map(s => html`<button key=${s.id} class=${d.stage === s.id ? 'cur' : reached(d, s.id) ? 'done' : ''} onClick=${() => s.id === 'ganho' ? openWin(d) : moveDeal(d, s.id)} title=${s.l}>${s.l}</button>`)}</div>

    ${d.stage === 'perdido' && html`<div class="callout bad mb16"><b class="t">Perdido: ${d.lostReason || '—'}</b>${d.lostNote}${d.reactivateAt && html`<div class="small mt8">Reativar em ${fdate(d.reactivateAt)}</div>`}</div>`}

    ${t && t.kind === 'cad' && html`<div class="card mb16" style=${{ borderColor: 'var(--primary-2)' }}>
      <div class="row between mb8"><div><div class="xs faint b">PRÓXIMO PASSO · ${t.cad.name}</div><div class="b">${actType(t.step.ch).e} ${t.i + 1}/${t.total} · ${t.step.title}</div></div>
        <${Tag} t=${t.due < today() ? 'bad' : t.due === today() ? 'warn' : ''}>${relDay(t.due)}</${Tag}></div>
      <div class="script">${scr}</div>
      <div class="row wrap mt12">
        <${Btn} sz="sm" v="pri" icon="check" on=${() => completeStep(d)}>Feito, sem resposta</${Btn}>
        <${Btn} sz="sm" v="good" on=${() => completeStep(d, 'respondeu')}>Respondeu!</${Btn}>
        <${Btn} sz="sm" icon="copy" on=${() => copyText(scr)}>Copiar</${Btn}>
        <${Btn} sz="sm" on=${() => snooze(d, 1)}>Adiar 1d</${Btn}>
        <${Btn} sz="sm" v="ghost" icon="pause" on=${() => store.put('deals', Object.assign({}, d, { cadenceId: null }))}>Parar cadência</${Btn}>
      </div></div>`}
    ${t && t.kind === 'manual' && html`<div class="card mb16"><div class="row between"><div><div class="xs faint b">PRÓXIMA AÇÃO</div><div class="b">${t.title}</div></div><${Tag} t=${t.due < today() ? 'bad' : t.due === today() ? 'warn' : ''}>${fdate(t.due)} · ${relDay(t.due)}</${Tag}></div>
      <div class="row mt12"><${Btn} sz="sm" v="pri" icon="check" on=${() => completeStep(d)}>Concluir</${Btn}><${Btn} sz="sm" on=${() => snooze(d, 1)}>Adiar 1d</${Btn}><${Btn} sz="sm" on=${() => snooze(d, 7)}>+7d</${Btn}></div></div>`}
    ${t && t.kind === 'none' && html`<div class="callout warn mb16"><b class="t">Lead sem próxima ação</b>Todo lead aberto precisa de um próximo passo com data. Inicie uma cadência ou agende abaixo.</div>`}

    ${open && html`<div class="card tight mb16">
      <div class="xs faint b mb8">AGENDAR / CADÊNCIA</div>
      <div class="form c2">
        <${Input} sm=${true} v=${nextA} on=${setNextA} ph="Próxima ação (ex: ligar p/ decisão)"/>
        <div class="row"><${Input} sm=${true} type="date" v=${nextD} on=${setNextD}/><${Btn} sz="sm" on=${setNext}>Agendar</${Btn}></div>
        <div class="span3 row wrap">${vals(db.cadences).map(c => html`<${Btn} key=${c.id} sz="xs" v=${d.cadenceId === c.id ? 'pri' : ''} icon="repeat" on=${() => { store.put('deals', Object.assign({}, d, startCadence(d, c.id))); toast('Cadência iniciada: ' + c.name); }}>${c.name.split('—')[0].trim()}</${Btn}>`)}</div>
      </div>
      ${d.stage === 'agendada' && html`<div class="mt12"><${Input} label="Data/hora da reunião" type="datetime-local" v=${d.meetingAt} on=${v => store.put('deals', Object.assign({}, d, { meetingAt: v }))}/></div>`}
    </div>`}

    <div class="xs faint b mb8">REGISTRAR INTERAÇÃO</div>
    <div class="chips mb8">${ACT_TYPES.map(a => html`<button key=${a.id} class=${'chip' + (atype === a.id ? ' on' : '')} onClick=${() => setAtype(a.id)}>${a.e} ${a.l}</button>`)}</div>
    <div class="row mb16"><${Input} v=${atext} on=${setAtext} ph="O que aconteceu? (Enter para salvar)" onEnter=${addAct}/><${Btn} v="pri" on=${addAct}>Salvar</${Btn}></div>

    <div class="xs faint b mb8">HISTÓRICO</div>
    <div class="tl">${(d.activities || []).map(a => html`<div class="tl-i" key=${a.id}>
      <div class="w">${actType(a.type).e} ${actType(a.type).l} · ${new Date(a.at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}${a.by ? ' · ' + memberName(S, a.by) : ''}</div>
      <div class=${a.sys ? 'muted small' : ''}>${a.text}</div></div>`)}</div>
    <div class="row mt24"><${Btn} sz="sm" v="ghost" cls="danger" icon="trash" on=${() => { onClose(); delWithUndo('deals', d.id, 'Lead'); }}>Excluir lead</${Btn}></div>
    ${edit && html`<${DealForm} deal=${d} onClose=${() => setEdit(false)}/>`}
    ${lose && html`<${LoseModal} deal=${d} onClose=${() => setLose(false)}/>`}
  </${Drawer}>`;
}

/* ---------- pipeline ---------- */
function PipelinePage({ nav }) {
  const db = useDB(); const S = db.S;
  const [q, setQ] = useState(''); const [ch, setCh] = useState(''); const [pr, setPr] = useState(''); const [ow, setOw] = useState('');
  const [view, setView] = useState(LS.get('vos7_pipeview', 'kanban'));
  const [showClosed, setShowClosed] = useState(false);
  const [dragId, setDragId] = useState(null); const [over, setOver] = useState(null);
  const [schedule, setSchedule] = useState(null);
  useEffect(() => LS.set('vos7_pipeview', view), [view]);
  const deals = vals(db.deals).filter(d => {
    if (ch && d.channelId !== ch) return false; if (pr && d.productId !== pr) return false; if (ow && d.ownerId !== ow) return false;
    if (q) { const s = (d.name + ' ' + (d.company || '') + ' ' + (d.phone || '') + ' ' + (d.instagram || '')).toLowerCase(); if (!s.includes(q.toLowerCase())) return false; }
    return true;
  });
  const cols = showClosed ? STAGES : OPEN_STAGES;
  const drop = (stg) => {
    const d = db.deals[dragId]; setOver(null); setDragId(null);
    if (!d || d.stage === stg) return;
    if (stg === 'ganho') return nav.win(d);
    if (stg === 'perdido') return nav.lose(d);
    if (stg === 'agendada') return setSchedule(d);
    moveDeal(d, stg);
  };
  const openN = deals.filter(d => d.stage !== 'ganho' && d.stage !== 'perdido');
  return html`<div>
    <${PageH} t="Pipeline" s=${openN.length + ' leads abertos · ' + money(sum(openN, d => d.mrr)) + ' em MRR potencial'}>
      <${Seg} v=${view} on=${setView} opts=${[{ v: 'kanban', l: 'Kanban' }, { v: 'lista', l: 'Lista' }]}/>
      <${Btn} v="pri" icon="plus" on=${() => nav.newDeal()}>Novo lead</${Btn}>
    </${PageH}>
    <div class="row wrap mb16">
      <div style=${{ flex: '1 1 220px' }}><${Input} v=${q} on=${setQ} ph="Buscar nome, empresa, telefone…"/></div>
      <div style=${{ width: 210 }}><${Select} v=${ch} on=${setCh} ph="Todos os canais" opts=${S.channels.map(c => ({ v: c.id, l: c.name }))}/></div>
      <div style=${{ width: 190 }}><${Select} v=${pr} on=${setPr} ph="Todos os produtos" opts=${S.products.map(c => ({ v: c.id, l: c.name }))}/></div>
      <div style=${{ width: 160 }}><${Select} v=${ow} on=${setOw} ph="Todos" opts=${S.team.map(c => ({ v: c.id, l: c.name }))}/></div>
      <${Toggle} v=${showClosed} on=${setShowClosed} label="Mostrar ganhos/perdidos"/>
    </div>
    ${view === 'kanban' ? html`<div class="kanban">${cols.map(s => {
    const list = deals.filter(d => d.stage === s.id).sort((a, b) => (a.stageAt || '').localeCompare(b.stageAt || ''));
    return html`<div key=${s.id} class=${'kcol' + (over === s.id ? ' drop' : '')}
          onDragOver=${e => { e.preventDefault(); setOver(s.id); }} onDragLeave=${() => setOver(null)} onDrop=${() => drop(s.id)}>
          <div class="kcol-h"><span class="dot" style=${{ background: s.c }}/>${s.l}<span class="faint">${list.length}</span><span class="sum">${money(sum(list, d => d.mrr))}</span></div>
          ${list.map(d => html`<${DealCard} key=${d.id} d=${d} db=${db} onOpen=${() => nav.deal(d.id)} onDrag=${() => setDragId(d.id)} dragging=${dragId === d.id}/>`)}
          ${!list.length && html`<div class="xs faint" style=${{ textAlign: 'center', padding: 12 }}>Arraste leads para cá</div>`}
        </div>`;
  })}</div>` : html`<div class="card flush tbl-wrap"><table class="tbl"><thead><tr><th>Lead</th><th>Etapa</th><th>Canal</th><th>Produto</th><th class="r">Valor</th><th>Próxima ação</th><th>Resp.</th></tr></thead><tbody>
      ${deals.filter(d => showClosed || (d.stage !== 'ganho' && d.stage !== 'perdido')).sort((a, b) => stageIdx(b.stage) - stageIdx(a.stage)).map(d => {
    const t = nextTask(db, d);
    return html`<tr key=${d.id} class="click" onClick=${() => nav.deal(d.id)}>
          <td><div class="b">${d.name}</div><div class="xs faint">${d.company}</div></td>
          <td><span class="row" style=${{ gap: 6 }}><span class="dot" style=${{ background: stageOf(d.stage).c }}/>${stageOf(d.stage).l}</span></td>
          <td class="small">${chName(S, d.channelId)}</td><td class="small">${prodName(S, d.productId)}</td>
          <td class="r num b">${d.mrr ? money(d.mrr) : '—'}</td>
          <td class="small">${t && t.kind !== 'none' ? html`<${Tag} t=${t.due < today() ? 'bad' : t.due === today() ? 'warn' : ''}>${fdateShort(t.due)}</${Tag}>` : t ? html`<${Tag} t="warn">sem ação</${Tag}>` : '—'}</td>
          <td class="small">${memberName(S, d.ownerId)}</td></tr>`;
  })}</tbody></table>${!deals.length && html`<${Empty} t="Nenhum lead" s="Crie seu primeiro lead com o botão acima."/>`}</div>`}
    ${schedule && html`<${ScheduleModal} deal=${schedule} onClose=${() => setSchedule(null)}/>`}
  </div>`;
}
function DealCard({ d, db, onOpen, onDrag, dragging }) {
  const S = db.S; const t = nextTask(db, d);
  const days = diffDays(dOfStamp(d.stageAt || d.createdAt), today());
  return html`<div class=${'kcard' + (dragging ? ' dragging' : '')} draggable="true" onDragStart=${onDrag} onClick=${onOpen}>
    <div class="row between"><div class="nm ellipsis">${d.name}</div>${d.mrr > 0 && html`<span class="xs b num" style=${{ color: 'var(--good)' }}>${money(d.mrr)}</span>`}</div>
    ${d.company && html`<div class="co ellipsis">${d.company}</div>`}
    <div class="meta">${d.channelId && html`<${Tag}>${chName(S, d.channelId).replace('Prospecção — ', '').replace('Tráfego — ', '')}</${Tag}>`}${d.productId && html`<${Tag} t="pri">${prodName(S, d.productId)}</${Tag}>`}</div>
    <div class="na">
      ${t && t.kind === 'none' && html`<span style=${{ color: 'var(--warn)' }}>⚠ sem próxima ação</span>`}
      ${t && t.kind !== 'none' && html`<span style=${{ color: t.due < today() ? 'var(--bad)' : t.due === today() ? 'var(--warn)' : 'var(--text-3)' }}><${Icon} n="clock" s=${12}/> ${t.kind === 'cad' ? actType(t.step.ch).e + ' ' + t.step.title : t.title} · ${relDay(t.due)}</span>`}
      ${d.stage === 'agendada' && d.meetingAt && html`<span class="faint">📅 ${fdateShort(d.meetingAt)} ${d.meetingAt.slice(11, 16)}</span>`}
      ${(d.stage === 'ganho' || d.stage === 'perdido') ? null : html`<span class="faint" style=${{ marginLeft: 'auto' }}>${days}d</span>`}
    </div>
  </div>`;
}
function ScheduleModal({ deal, onClose }) {
  const [dt, setDt] = useState(addDays(today(), 1) + 'T10:00');
  const save = () => { moveDeal(deal, 'agendada', { meetingAt: dt, nextAction: 'Reunião de diagnóstico', nextDate: dt.slice(0, 10) }); onClose(); };
  return html`<${Modal} title=${'Reunião com ' + deal.name} onClose=${onClose} footer=${html`<${Btn} on=${onClose}>Cancelar</${Btn}><${Btn} v="pri" on=${save}>Agendar</${Btn}>`}>
    <${Input} label="Data e hora" type="datetime-local" v=${dt} on=${setDt}/>
    <div class="xs faint mt8">A reunião vira a próxima ação do lead e aparece na tela Hoje.</div></${Modal}>`;
}

/* ---------- follow-ups ---------- */
function FollowRow({ it, db, nav }) {
  const { d, tk } = it; const S = db.S;
  const scr = tk.kind === 'cad' ? fill(tk.step.script, scriptVars(d, CURRENT_USER.name)) : '';
  const [show, setShow] = useState(false);
  return html`<div class="lrow" style=${{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
    <${Avatar} name=${d.name}/>
    <div style=${{ flex: '1 1 260px', minWidth: 0, cursor: 'pointer' }} onClick=${() => nav.deal(d.id)}>
      <div class="row wrap"><span class="main-t">${d.name}</span>${d.company && html`<span class="faint small">· ${d.company}</span>`}<${Tag}>${stageOf(d.stage).l}</${Tag}></div>
      <div class="small muted mt8" style=${{ marginTop: 3 }}>
        ${tk.kind === 'cad' && html`<span>${actType(tk.step.ch).e} <b>${tk.step.title}</b> · passo ${tk.i + 1}/${tk.total} · ${tk.cad.name.split('—')[0].trim()}</span>`}
        ${tk.kind === 'manual' && html`<span>📌 <b>${tk.title}</b></span>`}
        ${tk.kind === 'none' && html`<span style=${{ color: 'var(--warn)' }}>Sem próxima ação definida</span>`}
        ${tk.due && html`<span class=${tk.due < today() ? '' : 'faint'} style=${{ color: tk.due < today() ? 'var(--bad)' : null }}> · ${fdateShort(tk.due)} (${relDay(tk.due)})</span>`}
      </div>
      ${show && scr && html`<div class="script mt8" onClick=${e => e.stopPropagation()}>${scr}</div>`}
    </div>
    <div class="row wrap" style=${{ justifyContent: 'flex-end' }}>
      ${scr && html`<${Btn} sz="xs" v="ghost" on=${() => setShow(!show)}>${show ? 'Ocultar' : 'Script'}</${Btn}>`}
      ${d.phone && html`<${Btn} sz="xs" cls="wa" icon="msg" href=${waLink(d.phone, scr)} title="Abrir WhatsApp com o script"/>`}
      ${tk.kind === 'none' ? html`<${Btn} sz="xs" v="pri" on=${() => nav.deal(d.id)}>Definir</${Btn}>` : html`
        <${Btn} sz="xs" v="pri" icon="check" on=${() => completeStep(d)} title="Feito (sem resposta)">Feito</${Btn}>
        ${tk.kind === 'cad' && html`<${Btn} sz="xs" v="good" on=${() => completeStep(d, 'respondeu')}>Respondeu</${Btn}>`}
        <${Btn} sz="xs" on=${() => snooze(d, 1)}>+1d</${Btn}>`}
    </div>
  </div>`;
}
function FollowupsPage({ nav }) {
  const db = useDB();
  const [who, setWho] = useState(CURRENT_USER.id);
  const b = followupBuckets(db, who || null);
  const meetings = vals(db.deals).filter(d => d.stage === 'agendada' && d.meetingAt && d.meetingAt.slice(0, 10) >= today()).sort((x, y) => x.meetingAt.localeCompare(y.meetingAt));
  const Group = ({ t, list, tone }) => list.length ? html`<div class="card flush mb16"><div class=${'lgroup ' + (tone || '')}><span>${t}</span><span>${list.length}</span></div>${list.map(it => html`<${FollowRow} key=${it.d.id} it=${it} db=${db} nav=${nav}/>`)}</div>` : null;
  const total = b.atrasado.length + b.hoje.length;
  return html`<div>
    <${PageH} t="Follow-ups" s=${total ? total + ' tarefas para hoje (incluindo atrasadas)' : 'Nada pendente para hoje 🎉'}>
      <${Select} v=${who} on=${setWho} ph="Toda a equipe" opts=${db.S.team.map(t => ({ v: t.id, l: t.name }))}/>
      <${Btn} icon="repeat" on=${() => nav.go('cadencias')}>Cadências</${Btn}>
    </${PageH}>
    <div class="grid g4 mb16">
      <${Kpi} l="Atrasados" v=${b.atrasado.length} tone=${b.atrasado.length ? 'bad' : null} icon="alert"/>
      <${Kpi} l="Para hoje" v=${b.hoje.length} icon="bell"/>
      <${Kpi} l="Próximos 7 dias" v=${b.proximos.length} icon="cal"/>
      <${Kpi} l="Leads sem próxima ação" v=${b.semAcao.length} tone=${b.semAcao.length ? 'warn' : null} s="Regra: nenhum lead aberto sem data"/>
    </div>
    ${meetings.length > 0 && html`<div class="card flush mb16"><div class="lgroup"><span>Reuniões agendadas</span><span>${meetings.length}</span></div>
      ${meetings.slice(0, 8).map(d => html`<div class="lrow" key=${d.id} style=${{ cursor: 'pointer' }} onClick=${() => nav.deal(d.id)}><${Icon} n="cal"/><div style=${{ flex: 1 }}><b>${d.name}</b> <span class="faint small">${d.company}</span></div><${Tag} t=${d.meetingAt.slice(0, 10) === today() ? 'warn' : 'info'}>${fdateShort(d.meetingAt)} · ${d.meetingAt.slice(11, 16)}</${Tag}>
        <${Btn} sz="xs" v="pri" on=${e => { e.stopPropagation(); moveDeal(d, 'realizada'); }}>Aconteceu</${Btn}></div>`)}</div>`}
    <${Group} t="Atrasados" list=${b.atrasado} tone="bad"/>
    <${Group} t="Hoje" list=${b.hoje}/>
    <${Group} t="Próximos 7 dias" list=${b.proximos}/>
    <${Group} t="Sem próxima ação — defina agora" list=${b.semAcao}/>
    ${!b.atrasado.length && !b.hoje.length && !b.proximos.length && !b.semAcao.length && html`<div class="card"><${Empty} t="Nenhum follow-up pendente" s="Crie leads com cadência para que as tarefas apareçam aqui automaticamente."><${Btn} v="pri" icon="plus" on=${() => nav.newDeal()}>Novo lead</${Btn}></${Empty}></div>`}
  </div>`;
}

/* ---------- cadências ---------- */
function CadencesPage() {
  const db = useDB();
  const [edit, setEdit] = useState(null);
  const cads = vals(db.cadences);
  const usage = id => vals(db.deals).filter(d => d.cadenceId === id).length;
  return html`<div>
    <${PageH} t="Cadências de follow-up" s="Sequências de toques com dia, canal e script. O sistema agenda cada passo e mostra na tela Hoje.">
      <${Btn} v="pri" icon="plus" on=${() => setEdit({ name: '', desc: '', steps: [{ day: 0, ch: 'whatsapp', title: '', script: '' }] })}>Nova cadência</${Btn}>
    </${PageH}>
    <div class="grid g2">${cads.map(c => html`<div class="card" key=${c.id}>
      <div class="card-h"><div><h3>${c.name}</h3><div class="sub">${c.desc}</div></div><${Tag} t="pri">${usage(c.id)} em uso</${Tag}></div>
      <div class="row wrap">${(c.steps || []).map((s, i) => html`<${Tag} key=${i}>D+${s.day} ${actType(s.ch).e} ${s.title}</${Tag}>`)}</div>
      <div class="row mt12"><${Btn} sz="sm" icon="edit" on=${() => setEdit(c)}>Editar</${Btn}><${Btn} sz="sm" v="ghost" cls="danger" on=${() => delWithUndo('cadences', c.id, 'Cadência')}>Excluir</${Btn}></div>
    </div>`)}</div>
    ${edit && html`<${CadenceEditor} c=${edit} onClose=${() => setEdit(null)}/>`}
  </div>`;
}
function CadenceEditor({ c, onClose }) {
  const [f, setF] = useState(JSON.parse(JSON.stringify(c)));
  const setStep = (i, k, v) => setF(p => ({ ...p, steps: p.steps.map((s, j) => j === i ? { ...s, [k]: k === 'day' ? n0(v) : v } : s) }));
  const save = () => { if (!f.name.trim()) return toast('Dê um nome.'); f.steps.sort((a, b) => a.day - b.day); store.put('cadences', f); onClose(); toast('Cadência salva.'); };
  return html`<${Modal} title=${c.id ? 'Editar cadência' : 'Nova cadência'} size="lg" onClose=${onClose} footer=${html`<${Btn} on=${onClose}>Cancelar</${Btn}><${Btn} v="pri" on=${save}>Salvar</${Btn}>`}>
    <div class="form"><${Input} label="Nome" v=${f.name} on=${v => setF({ ...f, name: v })}/><${Input} label="Quando usar" v=${f.desc} on=${v => setF({ ...f, desc: v })}/></div>
    <div class="xs faint mt12 mb8">Variáveis no script: {nome}, {empresa}, {eu}</div>
    ${f.steps.map((s, i) => html`<div class="card tight mb8" key=${i}>
      <div class="form c3"><${Input} label="Dia (D+)" type="number" v=${s.day} on=${v => setStep(i, 'day', v)}/>
        <${Select} label="Canal" v=${s.ch} on=${v => setStep(i, 'ch', v)} opts=${ACT_TYPES.map(a => ({ v: a.id, l: a.e + ' ' + a.l }))}/>
        <${Input} label="Título" v=${s.title} on=${v => setStep(i, 'title', v)}/>
        <${Textarea} cls="span3" label="Script" v=${s.script} on=${v => setStep(i, 'script', v)} rows=${2}/></div>
      <${Btn} sz="xs" v="ghost" cls="danger" on=${() => setF({ ...f, steps: f.steps.filter((_, j) => j !== i) })}>Remover passo</${Btn}></div>`)}
    <${Btn} sz="sm" icon="plus" on=${() => setF({ ...f, steps: f.steps.concat({ day: (f.steps[f.steps.length - 1] || { day: 0 }).day + 2, ch: 'whatsapp', title: '', script: '' }) })}>Adicionar passo</${Btn}>
  </${Modal}>`;
}

/* ---------- prospecção diária ---------- */
function ProspectPage({ nav }) {
  const db = useDB(); const S = db.S;
  const [date, setDate] = useState(today());
  const [who, setWho] = useState(CURRENT_USER.id);
  const [allCh, setAllCh] = useState(false);
  const docId = prospectDocId(date, who);
  const doc = db.prospect[docId] || { id: docId, date, user: who, byCh: {} };
  const chs = S.channels.filter(c => allCh || c.kind === 'outbound' || (S.dailyGoals[c.id] > 0));
  const setVal = (ch, m, v) => {
    const byCh = Object.assign({}, doc.byCh); byCh[ch] = Object.assign({}, byCh[ch] || {}, { [m]: Math.max(0, n0(v)) });
    store.put('prospect', Object.assign({}, doc, { byCh }));
  };
  const get = (ch, m) => Number(((doc.byCh || {})[ch] || {})[m]) || 0;
  const goalDay = sum(Object.values(S.dailyGoals || {}));
  const doneDay = sum(chs, c => get(c.id, 'abord'));
  const ym = ymOf(date);
  const monthT = prospectTotals(db, ym + '-01', ym + '-31', null, who);
  const goalMonth = goalDay * bizDays(ym);
  // semana
  const wd = parseD(date).getDay(); const mon = addDays(date, -(wd === 0 ? 6 : wd - 1));
  const week = Array.from({ length: 5 }, (_, i) => addDays(mon, i)).map(dd => ({ dd, t: prospectTotals(db, dd, dd, null, who) }));
  // mapa do mês
  const first = ym + '-01'; const off = (parseD(first).getDay() + 6) % 7;
  const cells = Array(off).fill(null).concat(Array.from({ length: daysInMonth(ym) }, (_, i) => dueIn(ym, i + 1)));
  const ev = funnelEvents(db, ym + '-01', ym + '-31', d => !who || d.ownerId === who);
  return html`<div>
    <${PageH} t="Prospecção" s="Registre sua atividade do dia com um toque. Os números alimentam metas e taxas de conversão.">
      <div style=${{ width: 170 }}><${Select} v=${who} on=${setWho} opts=${S.team.map(t => ({ v: t.id, l: t.name }))}/></div>
      <div class="row"><${Btn} v="ghost" icon="left" on=${() => setDate(addDays(date, -1))}/><input class="inp" type="date" value=${date} onChange=${e => setDate(e.target.value)} style=${{ width: 150 }}/><${Btn} v="ghost" icon="right" on=${() => setDate(addDays(date, 1))}/></div>
    </${PageH}>
    <div class="grid g4 mb16">
      <div class="kpi accent"><div class="l">Abordagens ${date === today() ? 'hoje' : 'no dia'}</div><div class="v">${doneDay} <span style=${{ fontSize: 15, opacity: .7 }}>/ ${goalDay || '—'}</span></div><div class="mt8"><${Progress} v=${doneDay} max=${goalDay} tone="good"/></div></div>
      <${Kpi} l="Abordagens no mês" v=${num(monthT.abord)} s=${goalMonth ? 'meta ' + num(goalMonth) + ' · ' + pct(monthT.abord / goalMonth * 100) : 'defina a meta diária abaixo'}/>
      <${Kpi} l="Taxa de resposta (mês)" v=${pct(ratio(monthT.resp, monthT.abord) * 100, 1)} s=${monthT.resp + ' respostas'}/>
      <${Kpi} l="Reuniões agendadas (mês)" v=${ev.agendada} s=${'conversa → reunião: ' + pct(ratio(ev.agendada, monthT.conv) * 100)}/>
    </div>
    <div class="grid g-side">
      <div class="card flush">
        <div class="lgroup"><span>${WEEKD[parseD(date).getDay()]}, ${fdate(date)}</span><span><label class="row" style=${{ gap: 6, textTransform: 'none', letterSpacing: 0, fontWeight: 600 }}><input type="checkbox" checked=${allCh} onChange=${e => setAllCh(e.target.checked)}/> todos os canais</label></span></div>
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Canal</th>${PROSP_METRICS.map(m => html`<th key=${m.id} title=${m.h} style=${{ textAlign: 'center' }}>${m.l}</th>`)}<th class="r">Meta/dia</th></tr></thead><tbody>
          ${chs.map(c => html`<tr key=${c.id}><td class="b small" style=${{ minWidth: 150 }}>${c.name}</td>
            ${PROSP_METRICS.map(m => html`<td key=${m.id}><div class="counter" style=${{ justifyContent: 'center' }}>
              <button onClick=${() => setVal(c.id, m.id, get(c.id, m.id) - 1)} aria-label="menos">−</button>
              <input class="cv inp sm" style=${{ width: 42, textAlign: 'center', padding: '5px 2px' }} value=${get(c.id, m.id)} onChange=${e => setVal(c.id, m.id, e.target.value)} inputMode="numeric"/>
              <button class="plus" onClick=${() => setVal(c.id, m.id, get(c.id, m.id) + 1)} aria-label="mais">+</button></div></td>`)}
            <td class="r"><input class="inp sm" style=${{ width: 64, textAlign: 'right' }} value=${S.dailyGoals[c.id] || ''} placeholder="0" inputMode="numeric" onChange=${e => store.setSettings({ dailyGoals: Object.assign({}, S.dailyGoals, { [c.id]: n0(e.target.value) }) })}/></td></tr>`)}
        </tbody></table></div>
        <div class="small faint" style=${{ padding: '10px 14px' }}>Dica: ao concluir passos de cadência em Follow-ups, os contadores de abordagem/follow-up sobem sozinhos.</div>
      </div>
      <div class="col" style=${{ gap: 14 }}>
        <div class="card"><div class="card-h"><h3>Semana</h3><span class="sub">abordagens</span></div>
          ${week.map(w => html`<div key=${w.dd} class="mb8"><div class="row between small"><span class=${w.dd === today() ? 'b' : 'muted'}>${WEEKD[parseD(w.dd).getDay()]} ${fdateShort(w.dd)}</span><span class="num b">${w.t.abord}${goalDay ? ' / ' + goalDay : ''}</span></div><${Progress} v=${w.t.abord} max=${goalDay} /></div>`)}
        </div>
        <div class="card"><div class="card-h"><h3>Consistência — ${monthLabel(ym)}</h3></div>
          <div class="heat">${['S', 'T', 'Q', 'Q', 'S', 'S', 'D'].map((x, i) => html`<div key=${'h' + i} style=${{ background: 'none', fontWeight: 700 }}>${x}</div>`)}
          ${cells.map((c, i) => { if (!c) return html`<div key=${i} style=${{ background: 'none' }}/>`; const v = prospectTotals(db, c, c, null, who).abord; const r = goalDay ? v / goalDay : v > 0 ? 1 : 0;
    const bg = v === 0 ? 'var(--surface-3)' : r >= 1 ? 'var(--good)' : r >= .5 ? 'color-mix(in srgb,var(--good) 55%,var(--surface-3))' : 'color-mix(in srgb,var(--good) 25%,var(--surface-3))';
    return html`<div key=${i} style=${{ background: bg, color: r >= .5 ? '#fff' : null, outline: c === date ? '2px solid var(--primary-2)' : null, cursor: 'pointer' }} onClick=${() => setDate(c)} title=${fdate(c) + ': ' + v + ' abordagens'}>${parseD(c).getDate()}</div>`; })}</div>
          <div class="legend"><span><i style=${{ background: 'var(--good)' }}/>bateu a meta</span><span><i style=${{ background: 'color-mix(in srgb,var(--good) 25%,var(--surface-3))' }}/>parcial</span></div>
        </div>
        <${Btn} icon="calc" on=${() => nav.go('calc_prosp')}>Calcular minha meta diária</${Btn}>
      </div>
    </div>
  </div>`;
}

/* ---------- análise comercial ---------- */
function AnalyticsPage({ nav }) {
  const db = useDB(); const S = db.S;
  const [ym, setYm] = useState(ymNow());
  const [spendEdit, setSpendEdit] = useState(false);
  const cm = commercialMonth(db, ym); const ev = cm.ev;
  const months = Array.from({ length: 6 }, (_, i) => addMonths(ym, i - 5));
  const hist = months.map(m => funnelEvents(db, m + '-01', m + '-31'));
  const lossG = groupBy(ev.lost, d => d.lostReason || 'Sem motivo');
  const lossRows = Object.entries(lossG).sort((a, b) => b[1].length - a[1].length);
  const byOwner = S.team.map(t => ({ t, e: funnelEvents(db, cm.a, cm.b, d => d.ownerId === t.id), p: prospectTotals(db, cm.a, cm.b, null, t.id) })).filter(x => x.e.leads || x.e.ganhos || x.p.abord);
  const winRate = ratio(ev.ganhos, ev.ganhos + ev.perdidos) * 100;
  return html`<div>
    <${PageH} t="Análise comercial" s="Funil por canal, conversões, CAC e motivos de perda.">
      <${MonthNav} v=${ym} on=${setYm}/>
      <${Btn} icon="dollar" on=${() => setSpendEdit(true)}>Investimento por canal</${Btn}>
    </${PageH}>
    <div class="grid g5 mb16">
      <${Kpi} l="Novos leads" v=${ev.leads}/>
      <${Kpi} l="Reuniões realizadas" v=${ev.realizada} s=${ev.agendada + ' agendadas · show ' + pct(ratio(ev.realizada, ev.agendada) * 100)}/>
      <${Kpi} l="Vendas" v=${ev.ganhos} s=${'win rate ' + pct(winRate)}/>
      <${Kpi} l="Ticket médio (MRR)" v=${Number.isFinite(cm.ticket) ? money(cm.ticket) : '—'} s=${Number.isFinite(ev.ciclo) ? 'ciclo médio ' + num(ev.ciclo) + ' dias' : ''}/>
      <${Kpi} l="CAC" v=${Number.isFinite(cm.cac) ? money(cm.cac) : '—'} s=${'LTV:CAC ' + (Number.isFinite(cm.ltvCac) ? num(cm.ltvCac, 1) + 'x' : '—')} tone=${Number.isFinite(cm.ltvCac) ? (cm.ltvCac >= 3 ? 'good' : 'bad') : null}/>
    </div>
    <div class="grid g2 mb16">
      <div class="card"><div class="card-h"><h3>Funil do mês</h3><span class="sub">entradas em cada etapa</span></div>
        <${FunnelBars} rows=${[
      { l: 'Abordagens', v: cm.pros.abord },
      { l: 'Respostas', v: cm.pros.resp, rate: ratio(cm.pros.resp, cm.pros.abord) * 100 },
      { l: 'Leads no CRM', v: ev.leads },
      { l: 'Reuniões agendadas', v: ev.agendada, rate: ratio(ev.agendada, ev.leads) * 100 },
      { l: 'Reuniões realizadas', v: ev.realizada, rate: ratio(ev.realizada, ev.agendada) * 100 },
      { l: 'Propostas', v: ev.proposta, rate: ratio(ev.proposta, ev.realizada) * 100 },
      { l: 'Vendas', v: ev.ganhos, rate: ratio(ev.ganhos, ev.proposta) * 100, c: 'var(--good)' }]}/>
      </div>
      <div class="card"><div class="card-h"><h3>Últimos 6 meses</h3></div>
        <${BarChart} labels=${months.map(monthShort)} highlight=${5} series=${[
      { name: 'Leads', data: hist.map(h => h.leads), color: 'var(--s1)' },
      { name: 'Reuniões realizadas', data: hist.map(h => h.realizada), color: 'var(--s2)' },
      { name: 'Vendas', data: hist.map(h => h.ganhos), color: 'var(--s3)' }]}/>
      </div>
    </div>
    <div class="card flush mb16"><div class="lgroup"><span>Por canal de aquisição — ${monthLabel(ym)}</span><span>CAC = investimento do canal ÷ vendas do canal</span></div>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Canal</th><th class="r">Abord.</th><th class="r">Leads</th><th class="r">Reuniões</th><th class="r">Vendas</th><th class="r">Lead→Venda</th><th class="r">MRR vendido</th><th class="r">Investido</th><th class="r">CPL</th><th class="r">CAC</th></tr></thead><tbody>
      ${cm.byCh.filter(r => r.leads || r.ganhos || r.spend || r.pros.abord || r.realizada).map(r => html`<tr key=${r.ch.id}>
        <td class="b small">${r.ch.name}</td><td class="r num">${r.pros.abord || '—'}</td><td class="r num">${r.leads}</td><td class="r num">${r.realizada}</td><td class="r num b">${r.ganhos}</td>
        <td class="r num">${pct(ratio(r.ganhos, r.leads) * 100, 1)}</td><td class="r num">${money(r.mrrGanho)}</td><td class="r num">${r.spend ? money(r.spend) : '—'}</td>
        <td class="r num">${Number.isFinite(r.cpl) && r.spend ? money(r.cpl) : '—'}</td><td class="r num b">${Number.isFinite(r.cac) && r.spend ? money(r.cac) : '—'}</td></tr>`)}
      </tbody><tfoot><tr><td>Total</td><td class="r">${cm.pros.abord}</td><td class="r">${ev.leads}</td><td class="r">${ev.realizada}</td><td class="r">${ev.ganhos}</td><td class="r">${pct(ratio(ev.ganhos, ev.leads) * 100, 1)}</td><td class="r">${money(ev.mrrGanho)}</td><td class="r">${money(cm.midia)}</td><td class="r">${ev.leads && cm.midia ? money(cm.midia / ev.leads) : '—'}</td><td class="r">${Number.isFinite(cm.cacMidia) ? money(cm.cacMidia) : '—'}</td></tr></tfoot></table></div>
      <div class="small faint" style=${{ padding: '10px 14px' }}>CAC completo (mídia + despesas marcadas como "entra no CAC" em Configurações): <b>${Number.isFinite(cm.cac) ? money(cm.cac) : '—'}</b> · LTV estimado ${Number.isFinite(cm.ltv) ? money(cm.ltv) : '—'} (ticket × ${num(cm.ret, 1)} meses × ${S.grossMargin}% margem)</div>
    </div>
    <div class="grid g2">
      <div class="card"><div class="card-h"><h3>Motivos de perda</h3><span class="sub">${ev.perdidos} perdidos no mês</span></div>
        ${lossRows.length ? html`<${FunnelBars} rows=${lossRows.map(([k, l]) => ({ l: k, v: l.length, c: 'var(--s8)' }))}/>` : html`<${Empty} t="Nenhuma perda registrada" s="Quando marcar um lead como perdido, o motivo aparece aqui."/>`}
      </div>
      <div class="card flush"><div class="lgroup"><span>Por responsável</span></div>
        ${byOwner.length ? html`<table class="tbl"><thead><tr><th>Pessoa</th><th class="r">Abord.</th><th class="r">Leads</th><th class="r">Reuniões</th><th class="r">Vendas</th><th class="r">MRR</th></tr></thead><tbody>
        ${byOwner.map(x => html`<tr key=${x.t.id}><td class="b">${x.t.name}</td><td class="r">${x.p.abord}</td><td class="r">${x.e.leads}</td><td class="r">${x.e.realizada}</td><td class="r b">${x.e.ganhos}</td><td class="r">${money(x.e.mrrGanho)}</td></tr>`)}</tbody></table>` : html`<${Empty} t="Sem dados no mês" s=""/>`}
      </div>
    </div>
    ${spendEdit && html`<${SpendModal} ym=${ym} onClose=${() => setSpendEdit(false)}/>`}
  </div>`;
}
function SpendModal({ ym, onClose }) {
  const db = useDB();
  const cur = db.spend[ym] || { id: ym, byCh: {} };
  const [f, setF] = useState(Object.assign({}, cur.byCh));
  const save = () => { const byCh = {}; Object.entries(f).forEach(([k, v]) => { if (n0(v)) byCh[k] = n0(v); }); store.put('spend', { id: ym, byCh }); onClose(); toast('Investimento salvo.'); };
  return html`<${Modal} title=${'Investimento por canal — ' + monthLabel(ym)} onClose=${onClose} footer=${html`<${Btn} on=${onClose}>Cancelar</${Btn}><${Btn} v="pri" on=${save}>Salvar</${Btn}>`}>
    <p class="small muted" style=${{ marginTop: 0 }}>Quanto a Visions investiu para gerar clientes em cada canal (mídia paga, ferramentas de prospecção, eventos…). Usado no CPL e no CAC por canal.</p>
    <div class="form c2">${db.S.channels.map(c => html`<${Money} key=${c.id} label=${c.name} v=${f[c.id] || ''} on=${v => setF({ ...f, [c.id]: v })}/>`)}</div>
  </${Modal}>`;
}
