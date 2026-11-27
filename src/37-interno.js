/* ============================================================
   INTERNO — gestão operacional da agência
   Overview semanal, cronograma, pendências (com as automações dos
   posts), membros, acessos e reuniões. Mesmas chaves do sistema
   antigo: vos6_internal (colabs, ac, re, insights), vos6_manpend,
   vos6_c<id>_posts e os lembretes vos6_day15_/boletos_/relcamp_.
   ============================================================ */
const INT_TABS = [
  { v: 'pendencias', l: 'Pendências', icon: 'zap' }, { v: 'overview', l: 'Overview semanal', icon: 'grid' }, { v: 'cronograma', l: 'Cronograma', icon: 'cal' },
  { v: 'reunioes', l: 'Reuniões', icon: 'mic' }, { v: 'acessos', l: 'Acessos', icon: 'key' }, { v: 'membros', l: 'Membros', icon: 'users' }
];
const activePost = p => p && !p.archived && p.stage !== 'Arquivado';
const StagePill = ({ p }) => html`<${Pill} c=${stageColor(p.stage)}>${p.stage}</${Pill}>`;
const DateBox = ({ d, late }) => (d ? html`<div class=${'datebox' + (late ? ' late' : '')}><b>${parseD(d).getDate()}</b><span>${MSHORT[parseD(d).getMonth()]}</span></div>` : html`<div class="datebox"><b>–</b><span>s/data</span></div>`);
const typeLabel = t => (POST_TYPES.find(x => x.v === t) || {}).l || t || '';
const stageResp = p => STAGE_RESP[p.stage] || p.responsible || '';
const weekStart = d => { const dt = parseD(d); const dow = dt.getDay(); return addDays(d, dow === 0 ? -6 : 1 - dow); };
const longDay = d => { const s = parseD(d).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'short' }); return s.charAt(0).toUpperCase() + s.slice(1); };

/* grava só uma parte de vos6_internal, relendo antes para não apagar o que outra pessoa mudou */
async function saveInternal(k, val) {
  const cur = await docLoad(V6('internal'), true);
  if (MODE === 'remote' && !docs.ok[V6('internal')]) { toast('Sem conexão com o banco: nada foi salvo.', null, 8000); return false; }
  return docSave(V6('internal'), Object.assign({}, cur || {}, { [k]: val }));
}

/* posts de todos os clientes ativos (mesma fonte do workspace) */
function useAllPosts() {
  const [clients0, , loadingC] = useDoc(V6('clients'), []);
  const clients = asArr(clients0).filter(c => !c.archived);
  const [, setV] = useState(0);
  useEffect(() => { const f = () => setV(v => v + 1); docs.subs.add(f); return () => docs.subs.delete(f); }, []);
  const ids = clients.map(c => c.id).join(',');
  useEffect(() => {
    clients.forEach(c => docLoad(V6C(c.id, 'posts')));
    const iv = setInterval(() => { if (document.visibilityState === 'visible') clients.forEach(c => docLoad(V6C(c.id, 'posts'), true)); }, 60000);
    return () => clearInterval(iv);
  }, [ids]);
  const loading = loadingC || clients.some(c => !(V6C(c.id, 'posts') in docs.cache));
  const posts = [];
  clients.forEach(c => asArr(docs.cache[V6C(c.id, 'posts')]).forEach(p => posts.push(Object.assign({}, p, { _clId: c.id, _clName: c.name }))));
  return { clients, posts, loading };
}
async function stepPost(clId, postId, dir) {
  const posts = asArr(await docLoad(V6C(clId, 'posts'), true));
  const todos = await docLoad(V6C(clId, 'todos'), true);
  await movePost(clId, posts, todos, postId, dir);
}
async function patchPost(clId, postId, patch) {
  const posts = asArr(await docLoad(V6C(clId, 'posts'), true));
  return docSave(V6C(clId, 'posts'), posts.map(x => (x.id === postId ? Object.assign({}, x, patch) : x)));
}

function InternoPage({ nav }) {
  const [tab, setTab] = useState(LS.get('vos7_inttab', 'pendencias'));
  useEffect(() => LS.set('vos7_inttab', tab), [tab]);
  const [internal] = useDoc(V6('internal'), {});
  const cs = colabsOf(internal);
  const tabs = INT_TABS.filter(t => t.v !== 'acessos' || CURRENT_USER.role !== 'team');
  if (!tabs.some(t2 => t2.v === tab)) setTimeout(() => setTab('pendencias'), 0);
  const P = { pendencias: IntPendencias, overview: IntOverview, cronograma: IntCronograma, reunioes: IntReunioes, acessos: IntAcessos, membros: IntMembros }[tab];
  return html`<div>
    <div class="page-h"><div><h1>Interno</h1><p class="sub">Gestão operacional da agência: pendências de cada pessoa, posts da semana, reuniões e acessos.</p></div></div>
    <${Tabs} v=${tab} on=${setTab} opts=${tabs}/>
    <${P} nav=${nav} cs=${cs} internal=${internal || {}}/>
  </div>`;
}

/* ---------- detalhe de um post (usado no overview, cronograma e pendências) ---------- */
function PostPeek({ p, cs, nav, onClose }) {
  const st = postStages(p.postType, p.captacao); const i = st.indexOf(p.stage);
  const [cap, setCap] = useState(p.caption || ''); const [busy, setBusy] = useState(false);
  const run = async fn => { setBusy(true); try { await fn(); } finally { setBusy(false); } onClose(); };
  const dl = postDeadline(p);
  return html`<${Modal} title=${p.theme || '(sem tema)'} onClose=${onClose} footer=${html`
      <${Btn} v="ghost" icon="external" on=${() => { onClose(); nav.client(p._clId); }}>Abrir ${p._clName}</${Btn}><span style=${{ flex: 1 }}/>
      ${i > 0 && html`<${Btn} icon="left" disabled=${busy} on=${() => run(() => stepPost(p._clId, p.id, -1))}>Voltar etapa</${Btn}>`}
      ${i >= 0 && i < st.length - 1 && html`<${Btn} v="pri" icon="arrow" disabled=${busy} on=${() => run(() => stepPost(p._clId, p.id, 1).then(() => toast('Post avançou para ' + st[i + 1] + '.')))}>${st[i + 1]}</${Btn}>`}
      ${p.stage === 'Postagem' && html`<${Btn} v="pri" icon="check" disabled=${busy} on=${() => run(() => patchPost(p._clId, p.id, { archived: true, stage: 'Arquivado', stageDate: today() }).then(() => toast('Marcado como postado.')))}>Marcar como postado</${Btn}>`}`}>
    <div class="row wrap mb12" style=${{ gap: 8 }}>
      <${StagePill} p=${p}/>
      <span class="meta" style=${{ marginTop: 0 }}><b>${p._clName}</b><i class="sep"/>${p.platform || 'Instagram'}<i class="sep"/>${typeLabel(p.postType)}</span>
      ${postLate(p) && html`<${Pill} c="var(--bad)">Etapa atrasada</${Pill}>`}
    </div>
    ${i >= 0 && html`<div class="row mb12" style=${{ gap: 4 }}>${st.map((s, k) => html`<span key=${k} title=${s} style=${{ height: 5, flex: 1, borderRadius: 5, background: k <= i ? stageColor(p.stage) : 'var(--surface-3)' }}/>`)}</div>`}
    <div class="kv mb12">
      <div><span>Data do post</span><b>${p.postDate ? fdate(p.postDate) : '—'}</b></div>
      <div><span>Prazo da etapa</span><b style=${{ color: postLate(p) ? 'var(--bad)' : null }}>${dl ? fdate(dl) : '—'}</b></div>
      <div><span>Responsável</span><b>${isClientStage(p.stage) ? 'Cliente' : colabName(cs, stageResp(p))}</b></div>
      <div><span>Captação</span><b>${p.captacao === 'cliente' ? 'Cliente' : 'Agência'}</b></div>
    </div>
    ${p.rejected && html`<div class="callout bad mb12"><${Icon} n="alert" s=${18}/><div><b class="t">Cliente pediu ajuste</b>${p.rejectionNote || 'Sem observação.'}</div></div>`}
    <${Textarea} label="Roteiro / legenda" v=${cap} on=${setCap} rows=${6}/>
    <div class="row wrap mt8">
      ${cap !== (p.caption || '') && html`<${Btn} sz="sm" v="pri" on=${() => run(() => patchPost(p._clId, p.id, { caption: cap }).then(() => toast('Legenda salva.')))}>Salvar legenda</${Btn}>`}
      ${p.rejected && html`<${Btn} sz="sm" icon="check" on=${() => run(() => patchPost(p._clId, p.id, { caption: cap, rejected: false }).then(() => toast('Ajuste marcado como resolvido.')))}>Ajuste resolvido</${Btn}>`}
      ${p.driveLink && html`<${Btn} sz="sm" icon="folder" href=${p.driveLink}>Drive</${Btn}>`}${p.artLink && html`<${Btn} sz="sm" icon="image" href=${p.artLink}>Arte</${Btn}>`}
    </div>
  </${Modal}>`;
}
function PostChip({ p, cs, showClient, late, onClick, noDate }) {
  const resp = !isClientStage(p.stage) && p.stage !== 'Arquivado' && stageResp(p);
  return html`<div class="lrow" style=${{ cursor: 'pointer' }} onClick=${onClick}>
    ${!noDate && html`<${DateBox} d=${p.postDate} late=${late}/>`}
    <div style=${{ flex: 1, minWidth: 0 }}>
      <div class="main-t ellipsis">${p.theme || '(sem tema)'}</div>
      <div class="meta">
        ${showClient && html`<b>${p._clName}</b><i class="sep"/>`}
        <span>${typeLabel(p.postType)}</span><i class="sep"/><span>${p.platform || 'Instagram'}</span>
        ${p.rejected && html`<${Pill} c="var(--bad)">Ajuste pedido</${Pill}>`}
      </div>
    </div>
    <div class="row hide-sm" style=${{ gap: 10 }}>
      ${late && html`<${Pill} c="var(--bad)">Atrasado</${Pill}>`}
      <${StagePill} p=${p}/>
      ${resp ? html`<span title=${colabName(cs, resp)}><${Avatar} name=${colabName(cs, resp)} size=${24}/></span>` : html`<span style=${{ width: 24 }}/>`}
    </div>
  </div>`;
}

/* ---------- overview semanal ---------- */
function IntOverview({ cs, nav }) {
  const { clients, posts, loading } = useAllPosts();
  const [group, setGroup] = useState('semana'); const [type, setType] = useState(''); const [cli, setCli] = useState('');
  const [by, setBy] = useState('cliente'); const [date, setDate] = useState(today()); const [peek, setPeek] = useState(null);
  const inPeriod = d => (group === 'semana' ? weekStart(d) === weekStart(date) : d.slice(0, 7) === date.slice(0, 7));
  const list = posts.filter(p => activePost(p) && p.postDate && inPeriod(p.postDate) && (!type || p.postType === type) && (!cli || p._clId === cli))
    .sort((a, b) => a.postDate.localeCompare(b.postDate));
  const isLate = p => p.postDate < today() && p.stage !== 'Postagem';
  const late = list.filter(isLate).length;
  const groups = {};
  list.forEach(p => { const k = by === 'cliente' ? p._clName : p.postDate; (groups[k] = groups[k] || []).push(p); });
  const keys = Object.keys(groups).sort();
  const ws = weekStart(date);
  const label = group === 'semana' ? fdate(ws) + ' – ' + fdate(addDays(ws, 6)) : MONTHS[parseD(date).getMonth()] + ' ' + date.slice(0, 4);
  const shift = n => setDate(group === 'semana' ? addDays(date, 7 * n) : (() => { const d = parseD(date); d.setDate(1); d.setMonth(d.getMonth() + n); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-01'; })());
  return html`<div>
    <div class="card mb12"><div class="row wrap" style=${{ gap: 10 }}>
      <${Seg} v=${group} on=${setGroup} opts=${[{ v: 'semana', l: 'Por semana' }, { v: 'mes', l: 'Por mês' }]}/>
      <div class="month-nav"><${Btn} sz="xs" v="ghost" icon="left" on=${() => shift(-1)}/><b>${label}</b><${Btn} sz="xs" v="ghost" icon="right" on=${() => shift(1)}/></div>
      <input class="inp sm" type="date" value=${date} onChange=${e => e.target.value && setDate(e.target.value)} style=${{ width: 150 }}/><${Btn} sz="sm" v="ghost" on=${() => setDate(today())}>Hoje</${Btn}>
      <span style=${{ flex: 1 }}/>
      <select class="inp sm" style=${{ width: 200 }} value=${cli} onChange=${e => setCli(e.target.value)}><option value="">Todos os clientes</option>${clients.map(c => html`<option key=${c.id} value=${c.id}>${c.name}</option>`)}</select>
    </div>
    <div class="row wrap mt12" style=${{ gap: 10 }}>
      <${Seg} v=${type} on=${setType} opts=${[{ v: '', l: 'Todos' }].concat(POST_TYPES)}/>
      <${Seg} v=${by} on=${setBy} opts=${[{ v: 'cliente', l: 'Por cliente', icon: 'users' }, { v: 'dia', l: 'Por dia', icon: 'cal' }]}/>
      <span style=${{ flex: 1 }}/>
      <span class="small muted">${list.length} post${list.length !== 1 ? 's' : ''}</span>${late > 0 && html`<${Pill} c="var(--bad)">${late} atrasado${late > 1 ? 's' : ''}</${Pill}>`}
    </div></div>
    ${loading && !posts.length ? html`<div class="card"><${Empty} t="Carregando posts…" s=""/></div>`
      : !list.length ? html`<div class="card"><${Empty} t="Nenhum post neste período" s="Os posts aparecem aqui pela data de postagem."/></div>`
      : html`<div class=${by === 'cliente' ? 'grid g2' : ''}>${keys.map(k => html`<div class="card flush mb12" key=${k}>
          <div class="lgroup"><span>${by === 'dia' ? longDay(k) : k}</span><span>${groups[k].length}</span></div>
          ${groups[k].map(p => html`<${PostChip} key=${p.id} p=${p} cs=${cs} showClient=${by === 'dia'} late=${isLate(p)} noDate=${by === 'dia'} onClick=${() => setPeek(p)}/>`)}
        </div>`)}</div>`}
    ${peek && html`<${PostPeek} p=${peek} cs=${cs} nav=${nav} onClose=${() => setPeek(null)}/>`}
  </div>`;
}

/* ---------- cronograma mensal ---------- */
function IntCronograma({ cs, nav }) {
  const { clients, posts, loading } = useAllPosts();
  const [ym, setYm] = useState(ymNow()); const [cli, setCli] = useState(''); const [peek, setPeek] = useState(null);
  const list = posts.filter(p => activePost(p) && p.postDate && p.postDate.startsWith(ym) && (!cli || p._clId === cli));
  const byDay = {}; list.forEach(p => (byDay[p.postDate] = byDay[p.postDate] || []).push(p));
  const days = Object.keys(byDay).sort();
  return html`<div>
    <div class="card mb12"><div class="row wrap" style=${{ gap: 10 }}>
      <div class="month-nav"><${Btn} sz="xs" v="ghost" icon="left" on=${() => setYm(addMonths(ym, -1))}/><b>${monthLabel(ym)}</b><${Btn} sz="xs" v="ghost" icon="right" on=${() => setYm(addMonths(ym, 1))}/></div>
      <select class="inp sm" style=${{ width: 200 }} value=${cli} onChange=${e => setCli(e.target.value)}><option value="">Todos os clientes</option>${clients.map(c => html`<option key=${c.id} value=${c.id}>${c.name}</option>`)}</select>
      <span class="small muted">${list.length} post${list.length !== 1 ? 's' : ''} no mês</span>
    </div></div>
    ${loading && !posts.length ? html`<div class="card"><${Empty} t="Carregando posts…" s=""/></div>`
      : !days.length ? html`<div class="card"><${Empty} t="Nenhum post com data neste mês" s="Adicione posts no espaço de cada cliente com a data de postagem."/></div>`
      : days.map(d => { const dt = parseD(d); const we = dt.getDay() === 0 || dt.getDay() === 6;
        return html`<div class="row mb8" key=${d} style=${{ alignItems: 'flex-start', gap: 12 }}>
          <div class=${'datebox' + (d === today() ? ' today' : '')} style=${{ width: 56, padding: '8px 0', background: we ? 'var(--surface-3)' : null }}>
            <span>${['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'][dt.getDay()]}</span><b style=${{ fontSize: 20 }}>${dt.getDate()}</b></div>
          <div class="card flush" style=${{ flex: 1, minWidth: 0 }}>${byDay[d].map(p => html`<${PostChip} key=${p.id} p=${p} cs=${cs} showClient=${true} noDate=${true} late=${postLate(p)} onClick=${() => setPeek(p)}/>`)}</div>
        </div>`; })}
    ${peek && html`<${PostPeek} p=${peek} cs=${cs} nav=${nav} onClose=${() => setPeek(null)}/>`}
  </div>`;
}

/* ---------- pendências ---------- */
function useFlag(key) {
  const [v, save, loading] = useDoc(key, null);
  return [!!v, () => save(true), loading];
}
function IntPendencias({ cs, nav }) {
  const { posts, loading } = useAllPosts();
  const [man0, saveMan, loadingMan] = useDoc(V6('manpend'), []);
  const man = asArr(man0);
  const me = (cs.find(c => CURRENT_USER.name && c.name.toLowerCase().startsWith(String(CURRENT_USER.name).toLowerCase().split(' ')[0])) || {}).id;
  const [who, setWho] = useState(LS.get('vos7_pendwho', me || cs[0].id));
  useEffect(() => LS.set('vos7_pendwho', who), [who]);
  const [sub, setSub] = useState('tudo'); const [peek, setPeek] = useState(null); const [edit, setEdit] = useState(null);
  const t = today(); const ym = ymNow(); const dow = parseD(t).getDay();
  const [d15, ok15] = useFlag(V6('day15_' + ym));
  const [bol, okBol] = useFlag(V6('boletos_' + t));
  const [rel, okRel] = useFlag(V6('relcamp_' + t));
  const act = posts.filter(activePost);
  const mine = act.filter(p => !isClientStage(p.stage) && p.stage !== 'Aprovação Final (Cliente)' && stageResp(p) === who);
  const myMan = man.filter(m => m.assigned === who);
  const rejected = act.filter(p => p.rejected);
  const waitingClient = act.filter(p => isClientStage(p.stage) || p.stage === 'Aprovação Final (Cliente)').sort((a, b) => (a.postDate || '9').localeCompare(b.postDate || '9'));
  const saveManList = async list => { if (MODE === 'remote' && !docs.ok[V6('manpend')]) return toast('As pendências ainda não carregaram do banco. Nada foi alterado.'); return saveMan(list); };
  const toggle = m => saveManList(man.map(x => (x.id === m.id ? { ...x, done: !x.done, doneAt: !x.done ? stamp() : '' } : x)));
  const del = m => confirm('Excluir a pendência "' + m.title + '"?') && saveManList(man.filter(x => x.id !== m.id));

  // agrupamento: atrasado / esta semana / semana que vem / futuro / sem data
  const items = mine.map(p => ({ k: 'p' + p.id, type: 'post', date: postDeadline(p) || p.postDate || '', p }))
    .concat(myMan.filter(m => !m.done).map(m => ({ k: 'm' + m.id, type: 'man', date: m.deadline || '', m })))
    .sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'));
  const mon = weekStart(t), sun = addDays(mon, 6), nsun = addDays(mon, 13);
  const BUCKETS = [{ k: 'late', l: 'Atrasado', c: 'var(--bad)' }, { k: 'week', l: 'Esta semana', c: 'var(--warn)' }, { k: 'next', l: 'Semana que vem', c: 'var(--s1)' }, { k: 'later', l: 'Mais pra frente', c: 'var(--text-3)' }, { k: 'none', l: 'Sem data', c: 'var(--text-3)' }];
  const bucket = d => (!d ? 'none' : d < t ? 'late' : d <= sun ? 'week' : d <= nsun ? 'next' : 'later');
  const dayLbl = d => (!d ? 'Sem data' : d === t ? 'Hoje · ' + fdate(d) : d === addDays(t, 1) ? 'Amanhã · ' + fdate(d) : longDay(d));
  const lateCount = items.filter(x => bucket(x.date) === 'late').length;
  const weekCount = items.filter(x => bucket(x.date) === 'week').length;

  const Item = ({ x }) => {
    const late = bucket(x.date) === 'late';
    if (x.type === 'post') { const p = x.p; const st = postStages(p.postType, p.captacao); const i = st.indexOf(p.stage); const dl = postDeadline(p);
      return html`<div class="lrow" style=${{ flexWrap: 'wrap' }}>
        <span class="status-bar" style=${{ background: late ? 'var(--bad)' : stageColor(p.stage) }}/>
        <div style=${{ flex: '1 1 260px', minWidth: 0, cursor: 'pointer' }} onClick=${() => setPeek(p)}>
          <div class="main-t">${p.theme || '(sem tema)'}</div>
          <div class="meta"><b>${p._clName}</b><i class="sep"/><span>${typeLabel(p.postType)}</span>
            ${p.postDate && html`<i class="sep"/><span>post ${fdate(p.postDate)}</span>`}
            ${dl && html`<i class="sep"/><span style=${{ color: late ? 'var(--bad)' : null, fontWeight: late ? 600 : null }}>prazo ${fdate(dl)}</span>`}
            ${p.rejected && html`<${Pill} c="var(--bad)">Ajuste pedido</${Pill}>`}</div>
        </div>
        <div class="row" style=${{ gap: 8 }}>
          <${StagePill} p=${p}/>
          ${i >= 0 && i < st.length - 1 && html`<${Btn} sz="sm" v="good" icon="check" on=${() => stepPost(p._clId, p.id, 1).then(() => toast('Avançou para ' + st[i + 1] + '.'))} title=${'Concluir e mandar para ' + st[i + 1]}>${st[i + 1].replace(' (Cliente)', ' do cliente').replace('Aprovação de Roteiro', 'Aprovação')}</${Btn}>`}
          ${p.stage === 'Postagem' && html`<${Btn} sz="sm" v="pri" icon="check" on=${() => patchPost(p._clId, p.id, { archived: true, stage: 'Arquivado', stageDate: today() }).then(() => toast('Marcado como postado.'))}>Postado</${Btn}>`}
        </div></div>`; }
    const m = x.m;
    return html`<div class="lrow">
      <span class="status-bar" style=${{ background: late ? 'var(--bad)' : 'var(--border-strong)' }}/>
      <input class="ck" type="checkbox" checked=${!!m.done} onChange=${() => toggle(m)}/>
      <div style=${{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick=${() => setEdit(m)}><div class="main-t">${m.title}</div>
        <div class="meta"><span>Pendência manual</span>${m.deadline && html`<i class="sep"/><span style=${{ color: late ? 'var(--bad)' : null, fontWeight: late ? 600 : null }}>prazo ${fdate(m.deadline)}</span>`}${m.notes && html`<i class="sep"/><span class="ellipsis" style=${{ maxWidth: 380 }}>${m.notes}</span>`}</div></div>
    </div>`;
  };
  const countOf = c => act.filter(p => !isClientStage(p.stage) && p.stage !== 'Aprovação Final (Cliente)' && stageResp(p) === c.id).length + man.filter(m => m.assigned === c.id && !m.done).length;
  const role = { consultora: 'Criação e roteiros', leonardo: 'Gravação, edição e tráfego', designer: 'Artes' };

  return html`<div>
    ${parseD(t).getDate() === 15 && !d15 && html`<div class="callout warn mb12"><${Icon} n="cal" s=${18}/><div style=${{ flex: 1 }}><b class="t">Hoje é dia 15: começa a criação de conteúdo</b>${colabName(cs, 'consultora')} tem até o dia 25 para criar todos os roteiros e cronogramas do mês seguinte. Todos os clientes precisam ter os posts planejados.</div><${Btn} sz="sm" on=${ok15}>Ciente</${Btn}></div>`}

    <div class="row wrap mb16" style=${{ gap: 10 }}>
      <div class="people">${cs.map(c => html`<button key=${c.id} class=${'person' + (who === c.id ? ' on' : '')} onClick=${() => setWho(c.id)}>
        <${Avatar} name=${c.name} size=${32}/><span style=${{ textAlign: 'left' }}>${c.name}<small>${role[c.id] || 'Equipe'}</small></span><span class="tag" style=${{ marginLeft: 4 }}>${countOf(c)}</span></button>`)}</div>
      <span style=${{ flex: 1 }}/>
      <${Btn} v="pri" icon="plus" on=${() => setEdit({ assigned: who })}>Pendência manual</${Btn}>
    </div>

    <div class="grid g4 mb16">
      <${Kpi} l="Atrasadas" v=${lateCount} s=${colabName(cs, who)} tone=${lateCount ? 'bad' : ''}/>
      <${Kpi} l="Para esta semana" v=${weekCount} s="prazo até domingo"/>
      <${Kpi} l="Aguardando clientes" v=${waitingClient.length} s="aprovações e materiais"/>
      <${Kpi} l="Ajustes pedidos" v=${rejected.length} s="voltaram para Criação" tone=${rejected.length ? 'warn' : ''}/>
    </div>

    ${rejected.length > 0 && html`<div class="card flush mb16">
      <div class="lgroup"><span class="row" style=${{ gap: 8 }}><span class="dot" style=${{ background: 'var(--bad)' }}/>Ajustes pedidos pelos clientes</span><span>${rejected.length}</span></div>
      ${rejected.map(p => html`<div class="lrow" key=${p.id} style=${{ flexWrap: 'wrap' }}><div style=${{ flex: '1 1 240px', minWidth: 0, cursor: 'pointer' }} onClick=${() => setPeek(p)}><div class="main-t">${p.theme}</div><div class="meta"><b>${p._clName}</b>${p.rejectionNote && html`<i class="sep"/><span style=${{ color: 'var(--bad)' }}>"${p.rejectionNote}"</span>`}</div></div>
        <${Btn} sz="sm" icon="edit" on=${() => setPeek(p)}>Editar legenda</${Btn}><${Btn} sz="sm" v="good" icon="check" on=${() => patchPost(p._clId, p.id, { rejected: false }).then(() => toast('Resolvido.'))}>Resolvido</${Btn}></div>`)}
    </div>`}

    ${who === 'leonardo' && (dow === 1 || dow === 3 || dow === 5) && html`<div class="card flush mb16">
      <div class="lgroup"><span class="row" style=${{ gap: 8 }}><${Icon} n="repeat" s=${15}/>Rotina de hoje</span></div>
      <div class="lrow"><input class="ck" type="checkbox" checked=${bol} disabled=${bol} onChange=${okBol}/><div style=${{ flex: 1 }}><div class=${bol ? 'faint' : 'main-t'} style=${{ textDecoration: bol ? 'line-through' : null }}>Gerar boletos para os clientes</div><div class="meta">Toda segunda, quarta e sexta</div></div><${Btn} sz="sm" v="ghost" icon="arrow" on=${() => nav.go('cobrancas')}>Cobranças</${Btn}></div>
      ${dow === 1 && html`<div class="lrow"><input class="ck" type="checkbox" checked=${rel} disabled=${rel} onChange=${okRel}/><div style=${{ flex: 1 }}><div class=${rel ? 'faint' : 'main-t'} style=${{ textDecoration: rel ? 'line-through' : null }}>Alimentar os relatórios das campanhas</div><div class="meta">Toda segunda-feira</div></div><${Btn} sz="sm" v="ghost" icon="arrow" on=${() => nav.go('performance')}>Painel semanal</${Btn}></div>`}
    </div>`}

    <div class="row wrap mb12"><${Seg} v=${sub} on=${setSub} opts=${[{ v: 'tudo', l: 'Fila de ' + colabName(cs, who), n: items.length }, { v: 'manual', l: 'Manuais', n: myMan.filter(m => !m.done).length }, { v: 'cliente', l: 'Aguardando cliente', n: waitingClient.length }]}/></div>

    ${sub === 'tudo' && ((loading && !posts.length) || loadingMan ? html`<div class="card"><${Empty} t="Carregando pendências…" s=""/></div>`
      : !items.length ? html`<div class="card"><${Empty} t="Tudo em dia" s="Os posts entram aqui sozinhos quando chegam numa etapa desta pessoa."/></div>`
      : BUCKETS.filter(b => items.some(x => bucket(x.date) === b.k)).map(b => { const inB = items.filter(x => bucket(x.date) === b.k); const days = [...new Set(inB.map(x => x.date))];
        return html`<div class="card flush mb12" key=${b.k}>
          <div class="lgroup"><span class="row" style=${{ gap: 8, color: b.k === 'late' ? 'var(--bad)' : null }}><span class="dot" style=${{ background: b.c }}/>${b.l}</span><span>${inB.length}</span></div>
          ${days.map(d => html`<div key=${d || 'x'}>${b.k !== 'none' && html`<div class="subday">${dayLbl(d)}</div>`}${inB.filter(x => x.date === d).map(x => html`<${Item} key=${x.k} x=${x}/>`)}</div>`)}
        </div>`; }))}

    ${sub === 'manual' && html`<div class="card flush">
      ${myMan.slice().sort((a, b) => (a.done !== b.done ? (a.done ? 1 : -1) : (a.deadline || '9999').localeCompare(b.deadline || '9999'))).map(m => { const over = !m.done && m.deadline && m.deadline < t; const urg = !m.done && m.deadline && !over && m.deadline <= addDays(t, 1);
        return html`<div class="lrow" key=${m.id} style=${{ opacity: m.done ? 0.55 : 1 }}>
          <span class="status-bar" style=${{ background: m.done ? 'var(--good)' : over ? 'var(--bad)' : urg ? 'var(--warn)' : 'var(--border-strong)' }}/>
          <input class="ck" type="checkbox" checked=${!!m.done} onChange=${() => toggle(m)}/>
          <div style=${{ flex: 1, minWidth: 0 }}><div class="main-t" style=${{ textDecoration: m.done ? 'line-through' : null }}>${m.title}</div>
            <div class="meta">${m.deadline ? html`<span>prazo ${fdate(m.deadline)}</span>` : html`<span>sem prazo</span>`}${m.notes && html`<i class="sep"/><span style=${{ whiteSpace: 'pre-wrap' }}>${m.notes}</span>`}</div></div>
          ${over && html`<${Pill} c="var(--bad)">Atrasada</${Pill}>`}${urg && html`<${Pill} c="var(--warn)">Urgente</${Pill}>`}
          <${Btn} sz="xs" v="ghost" icon="edit" on=${() => setEdit(m)}/><${Btn} sz="xs" v="ghost" cls="danger" icon="trash" on=${() => del(m)}/>
        </div>`; })}
      ${!myMan.length && html`<${Empty} t="Nenhuma pendência manual para esta pessoa" s=""/>`}
    </div>`}

    ${sub === 'cliente' && html`<div class="card flush">
      ${waitingClient.map(p => html`<${PostChip} key=${p.id} p=${p} cs=${cs} showClient=${true} late=${postLate(p)} onClick=${() => setPeek(p)}/>`)}
      ${!waitingClient.length && html`<${Empty} t="Nada esperando os clientes" s=""/>`}
    </div>`}

    ${peek && html`<${PostPeek} p=${peek} cs=${cs} nav=${nav} onClose=${() => setPeek(null)}/>`}
    ${edit && html`<${ManPendForm} m=${edit} cs=${cs} onClose=${() => setEdit(null)} onSave=${async f => { const list = f.id ? man.map(x => (x.id === f.id ? { ...x, ...f } : x)) : [{ ...f, id: uid(), done: false, createdAt: stamp() }].concat(man); if (await saveManList(list)) { toast('Pendência salva.'); setEdit(null); } }}/>`}
  </div>`;
}
function ManPendForm({ m, cs, onClose, onSave }) {
  const [f, setF] = useState(() => Object.assign({ title: '', assigned: cs[0].id, deadline: '', notes: '' }, m));
  const F = k => v => setF(p => ({ ...p, [k]: v }));
  return html`<${Modal} title=${m.id ? 'Editar pendência' : 'Nova pendência manual'} onClose=${onClose} footer=${html`<span style=${{ flex: 1 }}/><${Btn} on=${onClose}>Cancelar</${Btn}><${Btn} v="pri" on=${() => (f.title.trim() ? onSave(f) : toast('Escreva a tarefa.'))}>Salvar</${Btn}>`}>
    <div class="form c2">
      <${Input} cls="span3" label="Tarefa" v=${f.title} on=${F('title')} ph="O que precisa ser feito?" autoFocus=${true}/>
      <${Select} label="Responsável" v=${f.assigned} on=${F('assigned')} opts=${cs.map(c => ({ v: c.id, l: c.name }))}/>
      <${Input} label="Prazo" type="date" v=${f.deadline} on=${F('deadline')}/>
      <${Textarea} cls="span3" label="Observações" v=${f.notes} on=${F('notes')} rows=${3}/>
    </div></${Modal}>`;
}

/* ---------- reuniões (com transcrição) ---------- */
const RE_TYPES = [{ v: 'interna', l: 'Interna' }, { v: 'cliente', l: 'Cliente' }, { v: 'parceiro', l: 'Parceiro' }];
function IntReunioes({ internal }) {
  const items = asArr(internal.re).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const [clients0] = useDoc(V6('clients'), []); const clients = asArr(clients0).filter(c => !c.archived);
  const [open, setOpen] = useState(null); const [edit, setEdit] = useState(null); const [q, setQ] = useState('');
  const save = list => saveInternal('re', list);
  const shown = items.filter(x => !q || JSON.stringify(x).toLowerCase().includes(q.toLowerCase()));
  return html`<div>
    <div class="row wrap mb12"><div style=${{ width: 280 }}><${Input} sm=${true} v=${q} on=${setQ} ph="Buscar nas reuniões e transcrições…"/></div><span style=${{ flex: 1 }}/><${Btn} v="pri" icon="plus" on=${() => setEdit({})}>Nova reunião</${Btn}></div>
    <div class="card flush">
      ${shown.map(x => html`<div key=${x.id} style=${{ borderBottom: '1px solid var(--border)' }}>
        <div class="lrow" style=${{ cursor: 'pointer', borderBottom: 0 }} onClick=${() => setOpen(open === x.id ? null : x.id)}>
          <${Tag} t=${x.type === 'cliente' ? 'warn' : x.type === 'parceiro' ? '' : 'pri'}>${x.type || 'interna'}</${Tag}>
          <b>${x.date ? fdate(x.date) : '—'}</b>
          <div style=${{ flex: 1, minWidth: 0 }} class="small"><span class="b">${x.title || (x.clientId && (clients.find(c => c.id === x.clientId) || {}).name) || ''}</span> <span class="muted">${x.participants || ''}</span>${x.transcript && html` <${Pill} c="var(--s7)">Transcrição</${Pill}>`}</div>
          <${Btn} sz="xs" v="ghost" icon="edit" on=${e => { e.stopPropagation(); setEdit(x); }}/>
          <span class="xs faint">${open === x.id ? '▲' : '▼'}</span>
        </div>
        ${open === x.id && html`<div style=${{ padding: '0 14px 14px' }}>
          <div class="grid g3">${[['Pauta', x.agenda], ['Decisões', x.decisions], ['Próximos passos', x.next]].map(([l, v]) => html`<div key=${l}><div class="xs b faint mb8" style=${{ textTransform: 'uppercase', letterSpacing: '.06em' }}>${l}</div><div class="small" style=${{ whiteSpace: 'pre-wrap' }}>${v || '—'}</div></div>`)}</div>
          ${x.transcript && html`<div class="mt12"><div class="row mb8"><div class="xs b faint" style=${{ textTransform: 'uppercase', letterSpacing: '.06em', flex: 1 }}>Transcrição</div><${Btn} sz="xs" on=${() => navigator.clipboard && navigator.clipboard.writeText(x.transcript).then(() => toast('Transcrição copiada.'))}>Copiar</${Btn}></div>
            <div class="small" style=${{ whiteSpace: 'pre-wrap', maxHeight: 360, overflowY: 'auto', background: 'var(--surface-2)', borderRadius: 8, padding: 12 }}>${x.transcript}</div></div>`}
        </div>`}
      </div>`)}
      ${!shown.length && html`<${Empty} t=${q ? 'Nada encontrado' : 'Nenhuma reunião registrada'} s=${q ? '' : 'Registre a pauta e cole a transcrição da reunião.'}/>`}
    </div>
    ${edit && html`<${ReForm} x=${edit} clients=${clients} onClose=${() => setEdit(null)}
      onDel=${edit.id ? async () => { if (!confirm('Excluir esta reunião?')) return; if (await save(items.filter(i => i.id !== edit.id))) setEdit(null); } : null}
      onSave=${async f => { const list = f.id ? items.map(i => (i.id === f.id ? { ...i, ...f } : i)) : [{ ...f, id: uid() }].concat(items); if (await save(list)) { toast('Reunião salva.'); setEdit(null); setOpen(f.id || list[0].id); } }}/>`}
  </div>`;
}
function ReForm({ x, clients, onClose, onSave, onDel }) {
  const [f, setF] = useState(() => Object.assign({ date: today(), type: 'interna', title: '', clientId: '', participants: '', agenda: '', decisions: '', next: '', transcript: '' }, x));
  const F = k => v => setF(p => ({ ...p, [k]: v }));
  return html`<${Modal} size="lg" title=${x.id ? 'Editar reunião' : 'Nova reunião'} onClose=${onClose} footer=${html`${onDel && html`<${Btn} v="ghost" cls="danger" on=${onDel}>Excluir</${Btn}>`}<span style=${{ flex: 1 }}/><${Btn} on=${onClose}>Cancelar</${Btn}><${Btn} v="pri" on=${() => onSave(f)}>Salvar</${Btn}>`}>
    <div class="form c2">
      <${Input} label="Data" type="date" v=${f.date} on=${F('date')}/>
      <${Select} label="Tipo" v=${f.type} on=${F('type')} opts=${RE_TYPES}/>
      <${Input} label="Assunto" v=${f.title} on=${F('title')} ph="Ex: Alinhamento semanal"/>
      <${Select} label="Cliente (opcional)" v=${f.clientId} on=${F('clientId')} ph="—" opts=${clients.map(c => ({ v: c.id, l: c.name }))}/>
      <${Input} cls="span3" label="Participantes" v=${f.participants} on=${F('participants')}/>
      <${Textarea} label="Pauta" v=${f.agenda} on=${F('agenda')} rows=${3}/>
      <${Textarea} label="Decisões" v=${f.decisions} on=${F('decisions')} rows=${3}/>
      <${Textarea} cls="span3" label="Próximos passos" v=${f.next} on=${F('next')} rows=${3}/>
      <${Textarea} cls="span3" label="Transcrição (cole aqui)" v=${f.transcript} on=${F('transcript')} rows=${10} ph="Cole a transcrição completa da reunião (Meet, Zoom, tl;dv, Fireflies…)"/>
    </div></${Modal}>`;
}

/* ---------- acessos ---------- */
function IntAcessos({ internal }) {
  const items = asArr(internal.ac);
  const [vis, setVis] = useState({}); const [edit, setEdit] = useState(null);
  const save = list => saveInternal('ac', list);
  const copy = v => navigator.clipboard && navigator.clipboard.writeText(v || '').then(() => toast('Copiado.'));
  return html`<div>
    <div class="row mb12"><span class="small muted">Logins internos da agência. Visível só no login da agência (não aparece no login da equipe nem para clientes).</span><span style=${{ flex: 1 }}/><${Btn} v="pri" icon="plus" on=${() => setEdit({})}>Novo acesso</${Btn}></div>
    <div class="grid g3">${items.map(x => html`<div class="card" key=${x.id}>
      <div class="row mb8"><b style=${{ flex: 1 }}>${x.platform}</b>${x.url && html`<a class="small" href=${x.url} target="_blank" rel="noopener">Abrir ↗</a>`}<${Btn} sz="xs" v="ghost" icon="edit" on=${() => setEdit(x)}/></div>
      <div class="small row"><span class="muted" style=${{ width: 48 }}>Login</span><b style=${{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>${x.login || '—'}</b>${x.login && html`<button class="btn xs ghost" onClick=${() => copy(x.login)}>copiar</button>`}</div>
      <div class="small row"><span class="muted" style=${{ width: 48 }}>Senha</span><span class="num" style=${{ flex: 1 }}>${vis[x.id] ? x.password : '••••••••'}</span><button class="btn xs ghost" onClick=${() => setVis(v => ({ ...v, [x.id]: !v[x.id] }))}>${vis[x.id] ? 'ocultar' : 'ver'}</button>${x.password && html`<button class="btn xs ghost" onClick=${() => copy(x.password)}>copiar</button>`}</div>
      ${x.notes && html`<div class="xs muted mt8" style=${{ fontStyle: 'italic' }}>${x.notes}</div>`}
    </div>`)}</div>
    ${!items.length && html`<div class="card"><${Empty} t="Nenhum acesso cadastrado" s=""/></div>`}
    ${edit && html`<${AcForm} x=${edit} onClose=${() => setEdit(null)}
      onDel=${edit.id ? async () => { if (confirm('Excluir o acesso ' + edit.platform + '?') && (await save(items.filter(i => i.id !== edit.id)))) setEdit(null); } : null}
      onSave=${async f => { const list = f.id ? items.map(i => (i.id === f.id ? { ...i, ...f } : i)) : [{ ...f, id: uid() }].concat(items); if (await save(list)) { toast('Acesso salvo.'); setEdit(null); } }}/>`}
  </div>`;
}
function AcForm({ x, onClose, onSave, onDel }) {
  const [f, setF] = useState(() => Object.assign({ platform: '', url: '', login: '', password: '', notes: '' }, x));
  const F = k => v => setF(p => ({ ...p, [k]: v }));
  return html`<${Modal} title=${x.id ? 'Editar acesso' : 'Novo acesso'} onClose=${onClose} footer=${html`${onDel && html`<${Btn} v="ghost" cls="danger" on=${onDel}>Excluir</${Btn}>`}<span style=${{ flex: 1 }}/><${Btn} on=${onClose}>Cancelar</${Btn}><${Btn} v="pri" on=${() => (f.platform.trim() ? onSave(f) : toast('Informe a plataforma.'))}>Salvar</${Btn}>`}>
    <div class="form c2">
      <${Input} label="Plataforma" v=${f.platform} on=${F('platform')} ph="Ex: Meta Business" autoFocus=${true}/>
      <${Input} label="URL" v=${f.url} on=${F('url')} ph="https://…"/>
      <${Input} label="Login / e-mail" v=${f.login} on=${F('login')}/>
      <${Input} label="Senha" type="password" v=${f.password} on=${F('password')}/>
      <${Textarea} cls="span3" label="Observações" v=${f.notes} on=${F('notes')} rows=${2}/>
    </div></${Modal}>`;
}

/* ---------- membros ---------- */
function IntMembros({ cs }) {
  const [name, setName] = useState('');
  const FIXED = ['consultora', 'leonardo', ''];
  const save = list => saveInternal('colabs', list);
  const ren = (c, n) => n && n !== c.name && save(cs.map(x => (x.id === c.id ? { ...x, name: n } : x)));
  return html`<div>
    <div class="callout mb12"><b class="t">Quem recebe as pendências dos posts</b>Criação → ${colabName(cs, 'consultora')} · Gravação, Edição e Postagem → ${colabName(cs, 'leonardo')} · Edição de Arte → ${colabName(cs, 'designer')}. As etapas "(Cliente)" vão para o portal do cliente.</div>
    <div class="card flush">
      ${cs.map(c => html`<div class="lrow" key=${c.id}>
        <div class="av" style=${{ background: c.color || 'var(--s1)', color: '#fff', width: 32, height: 32, borderRadius: 99, display: 'grid', placeItems: 'center', fontWeight: 700 }}>${(c.name || '?')[0]}</div>
        <div style=${{ flex: 1 }}><input class="inp sm" defaultValue=${c.name} onBlur=${e => ren(c, e.target.value.trim())} style=${{ maxWidth: 320 }}/><div class="xs faint mt8">ID: ${c.id}${FIXED.includes(c.id) ? ' · recebe etapas dos posts' : ''}</div></div>
        ${!FIXED.includes(c.id) && html`<${Btn} sz="xs" v="ghost" cls="danger" icon="trash" on=${() => confirm('Remover ' + c.name + '?') && save(cs.filter(x => x.id !== c.id))}/>`}
      </div>`)}
      <div class="row" style=${{ padding: 12 }}><${Input} sm=${true} v=${name} on=${setName} ph="Nome do novo membro (Enter)" onEnter=${() => { if (name.trim()) { save(cs.concat({ id: uid(), name: name.trim(), color: 'var(--s3)' })); setName(''); } }}/><${Btn} sz="sm" on=${() => { if (name.trim()) { save(cs.concat({ id: uid(), name: name.trim(), color: 'var(--s3)' })); setName(''); } }}>Adicionar</${Btn}></div>
    </div>
  </div>`;
}

/* ---------- Instagram (no espaço do cliente) ---------- */
const INS_FIELDS = [['alcance', 'Alcance total', ''], ['impressoes', 'Impressões', ''], ['seguidores', 'Seguidores', ''], ['segNovos', 'Novos seguidores', ''], ['curtidas', 'Curtidas', ''], ['comentarios', 'Comentários', ''], ['salvamentos', 'Salvamentos', ''], ['visitas', 'Visitas ao perfil', ''], ['cliquesLink', 'Cliques no link', '']];
function WsInstagram({ cl }) {
  const [internal, , loading] = useDoc(V6('internal'), {});
  const all = asArr((internal || {}).insights);
  const list = all.filter(x => x.clientId === cl.id).sort((a, b) => (b.month || '').localeCompare(a.month || ''));
  const [edit, setEdit] = useState(null);
  if (loading) return html`<div class="card"><${Empty} t="Carregando…" s=""/></div>`;
  const save = l => saveInternal('insights', l);
  return html`<div>
    <div class="row mb12"><span class="small muted">Métricas mensais do Instagram, inseridas à mão.</span><span style=${{ flex: 1 }}/><${Btn} v="pri" icon="plus" on=${() => setEdit({ month: ymNow() })}>Registrar mês</${Btn}></div>
    ${list.map((x, k) => { const prev = list[k + 1];
      return html`<div class="card mb12" key=${x.id}>
        <div class="card-h"><h3>${/^\d{4}-\d{2}$/.test(x.month || '') ? monthLabel(x.month) : x.month}</h3><div class="row"><${Btn} sz="xs" v="ghost" icon="edit" on=${() => setEdit(x)}/></div></div>
        <div class="grid g3">${INS_FIELDS.map(([k2, l, ic]) => { const v = Number(x[k2] || 0); const pv = prev ? Number(prev[k2] || 0) : 0; const d = prev && pv ? (v - pv) / pv : null;
          return html`<div key=${k2} class="card tight" style=${{ background: 'var(--surface-2)' }}><div class="xs faint">${l}</div><div class="b num" style=${{ fontSize: 18 }}>${v.toLocaleString('pt-BR')}</div>${d !== null && html`<div class="xs" style=${{ color: d >= 0 ? 'var(--good)' : 'var(--bad)' }}>${d >= 0 ? '▲' : '▼'} ${Math.abs(d * 100).toFixed(0)}% vs mês anterior</div>`}</div>`; })}</div>
        ${x.melhorPost && html`<div class="callout good mt12"><b class="t">Melhor publicação</b>${x.melhorPost}${Number(x.melhorPostAlcance) > 0 ? ' · alcance ' + Number(x.melhorPostAlcance).toLocaleString('pt-BR') : ''}</div>`}
        ${x.notes && html`<div class="small muted mt8" style=${{ fontStyle: 'italic' }}>${x.notes}</div>`}
      </div>`; })}
    ${!list.length && html`<div class="card"><${Empty} t="Nenhum mês registrado" s="Registre alcance, seguidores e engajamento do mês."/></div>`}
    ${edit && html`<${InsForm} x=${edit} onClose=${() => setEdit(null)}
      onDel=${edit.id ? async () => { if (confirm('Excluir este mês?') && (await save(all.filter(i => i.id !== edit.id)))) setEdit(null); } : null}
      onSave=${async f => { const l = f.id ? all.map(i => (i.id === f.id ? { ...i, ...f } : i)) : [{ ...f, id: uid(), clientId: cl.id, createdAt: stamp() }].concat(all); if (await save(l)) { toast('Insights salvos.'); setEdit(null); } }}/>`}
  </div>`;
}
function InsForm({ x, onClose, onSave, onDel }) {
  const [f, setF] = useState(() => Object.assign({ month: ymNow(), melhorPost: '', melhorPostAlcance: '', notes: '' }, x));
  const F = k => v => setF(p => ({ ...p, [k]: v }));
  return html`<${Modal} title="Insights do Instagram" onClose=${onClose} footer=${html`${onDel && html`<${Btn} v="ghost" cls="danger" on=${onDel}>Excluir</${Btn}>`}<span style=${{ flex: 1 }}/><${Btn} on=${onClose}>Cancelar</${Btn}><${Btn} v="pri" on=${() => onSave(f)}>Salvar</${Btn}>`}>
    <div class="form c3">
      <${Input} label="Mês" type="month" v=${f.month} on=${F('month')}/>
      ${INS_FIELDS.map(([k, l]) => html`<${Input} key=${k} label=${l} type="number" v=${f[k] || ''} on=${F(k)}/>`)}
      <${Input} cls="span2" label="Melhor publicação" v=${f.melhorPost} on=${F('melhorPost')}/>
      <${Input} label="Alcance dela" type="number" v=${f.melhorPostAlcance} on=${F('melhorPostAlcance')}/>
      <${Textarea} cls="span3" label="Observações" v=${f.notes} on=${F('notes')} rows=${2}/>
    </div></${Modal}>`;
}
