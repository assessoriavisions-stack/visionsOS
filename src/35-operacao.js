/* ============================================================
   OPERAÇÃO — pipeline de clientes e espaço de cada cliente
   (briefing, posts, relatório, CRM, checklist, roteiro, mapas)
   Lê e grava nas MESMAS chaves do sistema antigo (vos6_*), para
   os dois funcionarem juntos durante a transição.
   ============================================================ */
const asArr = v => (Array.isArray(v) ? v : v && typeof v === 'object' ? Object.values(v) : []).filter(Boolean);
const V6 = k => 'vos6_' + k;
const V6C = (id, k) => 'vos6_c' + id + '_' + k;

/* ---------- documentos do sistema antigo (valor inteiro por chave) ---------- */
const docs = { cache: {}, ok: {}, at: {}, subs: new Set(), inflight: {} };
const docEmit = () => docs.subs.forEach(f => f());
async function docLoad(key, force) {
  if (!force && docs.inflight[key]) return docs.inflight[key];
  if (!force && docs.ok[key] && Date.now() - docs.at[key] < 20000) return docs.cache[key];
  const run = (async () => {
    try {
      let v;
      if (MODE === 'local') v = LS.get('vos7_doc_' + key, null);
      else v = await fbGet(key);
      docs.cache[key] = v; docs.ok[key] = true; docs.at[key] = Date.now();
      if (MODE === 'remote') LS.set('vos7_doc_' + key, v);
    } catch (e) {
      if (!(key in docs.cache)) docs.cache[key] = LS.get('vos7_doc_' + key, null);
      docs.ok[key] = false;
    }
    delete docs.inflight[key]; docEmit(); return docs.cache[key];
  })();
  docs.inflight[key] = run; return run;
}
async function docSave(key, value) {
  if (MODE === 'remote' && !docs.ok[key]) { toast('Sem conexão com o banco para "' + key + '": nada foi salvo para não sobrescrever dados. Tente de novo.', null, 8000); return false; }
  docs.cache[key] = value; docs.at[key] = Date.now(); docEmit();
  if (MODE === 'local') { LS.set('vos7_doc_' + key, value); return true; }
  LS.set('vos7_doc_' + key, value);
  for (let i = 0; i < 3; i++) {
    try { await fbPut(key, value); return true; } catch (e) { await new Promise(r => setTimeout(r, 800 * (i + 1))); }
  }
  toast('Não consegui salvar agora. Verifique a internet e tente de novo.', null, 8000);
  return false;
}
function useDoc(key, fallback) {
  const [, setV] = useState(0);
  useEffect(() => { const f = () => setV(v => v + 1); docs.subs.add(f); return () => docs.subs.delete(f); }, []);
  useEffect(() => {
    if (!key) return;
    docLoad(key);
    const iv = setInterval(() => { if (document.visibilityState === 'visible') docLoad(key, true); }, 30000);
    return () => clearInterval(iv);
  }, [key]);
  const v = key in docs.cache ? docs.cache[key] : undefined;
  return [v === undefined || v === null ? fallback : v, val => docSave(key, val), v === undefined];
}
function logAct(clId, action, who) {
  const key = V6C(clId, 'activity');
  docLoad(key).then(cur => { docSave(key, [{ id: uid(), ts: stamp(), action, who: who || (CURRENT_USER.role === 'cl' ? 'Cliente' : CURRENT_USER.name || 'Equipe') }].concat(asArr(cur)).slice(0, 300)); });
}

/* ---------- constantes de posts (iguais ao sistema antigo) ---------- */
const PIPE = [
  { id: 'kickoff', l: 'Kick-off', c: 'var(--s8)' }, { id: 'diagnostico', l: 'Diagnóstico', c: 'var(--s1)' },
  { id: 'plano', l: 'Plano de Ação', c: 'var(--s3)' }, { id: 'roadmap', l: 'Roadmap', c: 'var(--s4)' },
  { id: 'implementacao', l: 'Implementação', c: 'var(--s6)' }, { id: 'gestao', l: 'Gestão', c: 'var(--s7)' }
];
function postStages(type, capt) {
  if (type === 'video') return capt === 'cliente'
    ? ['Criação', 'Aprovação de Roteiro (Cliente)', 'Upload Drive (Cliente)', 'Edição', 'Aprovação (Cliente)', 'Postagem']
    : ['Criação', 'Aprovação de Roteiro (Cliente)', 'Gravação', 'Edição', 'Aprovação (Cliente)', 'Postagem'];
  if (type === 'arte') return ['Criação', 'Aprovação de Roteiro (Cliente)', 'Edição de Arte', 'Aprovação Final (Cliente)', 'Postagem'];
  if (type === 'foto') return ['Upload Drive (Cliente)', 'Postagem'];
  return ['Criação', 'Postagem'];
}
const CLIENT_STAGES = ['Upload Drive (Cliente)', 'Aprovação (Cliente)', 'Aprovação de Roteiro (Cliente)'];
const STAGE_DAYS = { 'Edição': 3, 'Edição de Arte': 3, 'Aprovação (Cliente)': 2, 'Aprovação Final (Cliente)': 2, 'Aprovação de Roteiro (Cliente)': 2 };
const STAGE_RESP = { 'Criação': 'consultora', 'Gravação': 'leonardo', 'Edição': 'leonardo', 'Edição de Arte': 'designer', 'Postagem': 'leonardo' };
const POST_TYPES = [{ v: 'video', l: '🎬 Vídeo' }, { v: 'arte', l: '🎨 Arte' }, { v: 'foto', l: '📸 Foto' }];
const POST_PLATFORMS = ['Instagram', 'TikTok', 'YouTube', 'Site/Blog', 'LinkedIn'];
const addBiz = (s, n) => { let d = s; let k = 0; while (k < n) { d = addDays(d, 1); if (!isWeekend(d)) k++; } return d; };
const subBiz = (s, n) => { let d = s; let k = 0; while (k < n) { d = addDays(d, -1); if (!isWeekend(d)) k++; } return d; };
const postDeadline = p => (!p.stageDate || ['Postagem', 'Arquivado'].includes(p.stage) ? null : addBiz(p.stageDate, STAGE_DAYS[p.stage] || 1));
const postLate = p => { const dl = postDeadline(p); return !!dl && today() > dl; };
const isClientStage = s => CLIENT_STAGES.includes(s);
const stageColor = s => (s === 'Postagem' ? 'var(--good)' : isClientStage(s) || s === 'Aprovação Final (Cliente)' ? 'var(--warn)' : s === 'Arquivado' ? 'var(--text-3)' : 'var(--s1)');
const CK_CATS = [{ v: 'conteudo', l: 'Conteúdo' }, { v: 'trafego', l: 'Tráfego' }, { v: 'crm', l: 'CRM' }, { v: 'site', l: 'Site' }, { v: 'estrategia', l: 'Estratégia' }, { v: 'outros', l: 'Outros' }];
const BRIEF_FIELDS = [
  { k: 'negocio', l: 'Negócio / Produto', ph: 'Descreva o negócio do cliente…', rows: 3 },
  { k: 'publico', l: 'Público-alvo', ph: 'Quem é o cliente ideal? Idade, perfil, dores…', rows: 3 },
  { k: 'diferencial', l: 'Diferenciais', ph: 'O que torna esse negócio único?', rows: 3 },
  { k: 'objetivos', l: 'Objetivos', ph: 'O que o cliente quer alcançar com o marketing?', rows: 3 },
  { k: 'tom', l: 'Tom de voz e identidade', ph: 'Formal, descontraído, inspirador…', rows: 2 },
  { k: 'concorrentes', l: 'Concorrentes', ph: 'Principais concorrentes e referências…', rows: 2 },
  { k: 'canais', l: 'Canais e plataformas', ph: 'Instagram, TikTok, Site, YouTube…', rows: 2 },
  { k: 'obs', l: 'Observações gerais', ph: 'Informações adicionais do kick-off…', rows: 3 }
];
const genCode = () => Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
const colabsOf = internal => (internal && Array.isArray(internal.colabs) && internal.colabs.length ? internal.colabs : [{ id: 'consultora', name: 'Júlia' }, { id: 'leonardo', name: 'Leonardo' }, { id: 'designer', name: 'Amanda' }]);
const colabName = (cs, id) => (cs.find(c => c.id === id) || {}).name || id || '—';

/* ---------- movimentação de posts (mesma regra do sistema antigo) ---------- */
function postTodoFor(p, newStage) {
  const labels = {
    'Upload Drive (Cliente)': `Enviar material gravado para o Drive: "${p.theme}"`,
    'Aprovação de Roteiro (Cliente)': `Aprovar roteiro: "${p.theme}"`,
    'Aprovação (Cliente)': `Aprovar vídeo: "${p.theme}" — verifique o grupo do WhatsApp`
  };
  let dl = '';
  if (p.postDate) dl = newStage === 'Aprovação (Cliente)' ? subBiz(p.postDate, 1) : p.postDate;
  return { id: uid(), title: labels[newStage] || `Pendência: "${p.theme}"`, cat: 'conteudo', notes: '', done: false, deadline: dl, _postId: p.id, _stage: newStage, createdAt: stamp() };
}
async function movePost(clId, posts, todos, id, dir) {
  const p = posts.find(x => x.id === id); if (!p) return;
  const st = postStages(p.postType, p.captacao); const ni = st.indexOf(p.stage) + dir;
  if (ni < 0 || ni >= st.length) return;
  const ns = st[ni];
  await docSave(V6C(clId, 'posts'), posts.map(x => (x.id === id ? { ...x, stage: ns, stageDate: today() } : x)));
  let td = asArr(todos).map(t => (t._postId === id && !t.done && t._stage === p.stage ? { ...t, done: true } : t));
  if (isClientStage(ns) && !td.some(t => t._postId === id && !t.done)) td = [postTodoFor(p, ns)].concat(td);
  await docSave(V6C(clId, 'todos'), td);
}
async function clientDecision(clId, posts, todos, p, ok, note) {
  const st = postStages(p.postType, p.captacao);
  if (ok) {
    const ns = st[Math.min(st.length - 1, st.indexOf(p.stage) + 1)];
    await docSave(V6C(clId, 'posts'), posts.map(x => (x.id === p.id ? { ...x, stage: ns, stageDate: today(), rejected: false, rejectionNote: '' } : x)));
    logAct(clId, (p.stage === 'Upload Drive (Cliente)' ? 'Enviou material: ' : 'Aprovou: ') + p.theme);
  } else {
    await docSave(V6C(clId, 'posts'), posts.map(x => (x.id === p.id ? { ...x, stage: 'Criação', stageDate: today(), rejected: true, rejectionNote: note || '' } : x)));
    logAct(clId, 'Pediu ajuste: ' + p.theme + (note ? ' — ' + note : ''));
  }
  await docSave(V6C(clId, 'todos'), asArr(todos).map(t => (t._postId === p.id ? { ...t, done: true } : t)));
}

/* ---------- pipeline de clientes ---------- */
function OperacaoPage({ nav }) {
  const db = useDB();
  const [clients, saveClients, loading] = useDoc(V6('clients'), []);
  const [internal] = useDoc(V6('internal'), {});
  const cs = colabsOf(internal);
  const [showArch, setShowArch] = useState(false); const [edit, setEdit] = useState(null); const [drag, setDrag] = useState(null); const [over, setOver] = useState(null); const [q, setQ] = useState('');
  const list = asArr(clients);
  const act = list.filter(c => !c.archived && (!q || (c.name + ' ' + (c.segment || '')).toLowerCase().includes(q.toLowerCase())));
  const mrrOf = c => sum(vals(db.contracts).filter(k => k.clientId === 'v6c_' + c.id && contractActiveIn(k, ymNow())), brlValue);
  const move = (id, stage) => { saveClients(list.map(c => (c.id === id ? { ...c, stage, updatedAt: stamp() } : c))); };
  return html`<div>
    <${PageH} t="Clientes — operação" s=${act.length + ' ativos · arraste entre as etapas · clique para abrir o espaço do cliente'}>
      <div style=${{ width: 220 }}><${Input} v=${q} on=${setQ} ph="Buscar cliente…"/></div>
      <${Toggle} v=${showArch} on=${setShowArch} label="Arquivados"/>
      <${Btn} v="pri" icon="plus" on=${() => setEdit({})}>Novo cliente</${Btn}>
    </${PageH}>
    ${loading ? html`<div class="card"><${Empty} t="Carregando clientes…" s=""/></div>` : showArch ? html`<div class="card flush">${list.filter(c => c.archived).map(c => html`<div class="lrow" key=${c.id}><div style=${{ flex: 1 }}><b>${c.name}</b><div class="xs faint">${c.segment || ''} · arquivado ${c.archivedAt ? fdate(dOfStamp(c.archivedAt)) : ''}</div></div><${Btn} sz="xs" on=${() => saveClients(list.map(x => (x.id === c.id ? { ...x, archived: false } : x)))}>Reativar</${Btn}><${Btn} sz="xs" v="ghost" on=${() => nav.client(c.id)}>Abrir</${Btn}></div>`)}${!list.some(c => c.archived) && html`<${Empty} t="Nenhum arquivado" s=""/>`}</div>`
      : html`<div class="kanban">${PIPE.map(s => {
        const col = act.filter(c => (c.stage || 'kickoff') === s.id).sort((a, b) => a.name.localeCompare(b.name));
        return html`<div key=${s.id} class=${'kcol' + (over === s.id ? ' drop' : '')} onDragOver=${e => { e.preventDefault(); setOver(s.id); }} onDragLeave=${() => setOver(null)} onDrop=${() => { setOver(null); if (drag) move(drag, s.id); setDrag(null); }}>
          <div class="kcol-h"><span class="dot" style=${{ background: s.c }}/>${s.l}<span class="faint">${col.length}</span></div>
          ${col.map(c => { const m = mrrOf(c); const days = c.updatedAt ? diffDays(dOfStamp(c.updatedAt), today()) : null;
            return html`<div key=${c.id} class="kcard" draggable="true" onDragStart=${() => setDrag(c.id)} onClick=${() => nav.client(c.id)}>
              <div class="row between"><div class="nm ellipsis">${c.name}</div>${m > 0 && html`<span class="xs b num" style=${{ color: 'var(--good)' }}>${money(m)}</span>`}</div>
              <div class="co ellipsis">${c.segment || '—'}</div>
              <div class="meta"><${Tag}>👤 ${colabName(cs, c.responsible)}</${Tag}>${c.code && html`<${Tag} t="pri">${c.code}</${Tag}>`}${days != null && html`<span class="xs faint" style=${{ marginLeft: 'auto' }}>${days}d</span>`}</div>
            </div>`; })}
          ${!col.length && html`<div class="xs faint" style=${{ textAlign: 'center', padding: 12 }}>—</div>`}
        </div>`; })}</div>`}
    ${edit && html`<${ClientOpsForm} c=${edit.id ? edit : null} list=${list} save=${saveClients} cs=${cs} onClose=${() => setEdit(null)} onCreated=${id => nav.client(id)}/>`}
  </div>`;
}
function ClientOpsForm({ c, list, save, cs, onClose, onCreated }) {
  const [f, setF] = useState(() => Object.assign({ name: '', segment: '', stage: 'kickoff', responsible: cs[0].id, responsible2: '', onedrive: '', notes: '', code: genCode(), modulos: ['gestao'], funnel: 'consultivo' }, c || {}));
  const F = k => v => setF(p => ({ ...p, [k]: v }));
  const ok = async () => {
    if (!f.name.trim()) return toast('Informe o nome.');
    if (list.some(x => x.code === f.code && x.id !== f.id)) return toast('Esse código já existe, gere outro.');
    if (f.id) { await save(list.map(x => (x.id === f.id ? { ...x, ...f, updatedAt: stamp() } : x))); toast('Cliente salvo.'); onClose(); return; }
    const id = uid(); const novo = { ...f, id, createdAt: stamp(), updatedAt: stamp() };
    if (!(await save([novo].concat(list)))) return;
    const items = ['Briefing / Kick-off realizado', 'Acesso às redes sociais concedido', 'Identidade visual recebida', 'Fotos/materiais recebidos', 'Estratégia de conteúdo definida', 'Calendário editorial aprovado', 'Contrato assinado e arquivado', 'Cliente cadastrado na plataforma']
      .map(t => ({ id: uid(), text: t, category: 'outros', deadline: '', notes: '', visivel: true, done: false }));
    await docSave(V6C(id, 'ck'), [{ id: uid(), month: 'Kick-off', items }]);
    toast('Cliente criado com o checklist de kick-off.'); onClose(); onCreated && onCreated(id);
  };
  const arch = async () => { if (!confirm('Arquivar ' + f.name + '?')) return; await save(list.map(x => (x.id === f.id ? { ...x, archived: true, archivedAt: stamp() } : x))); toast('Arquivado.'); onClose(); };
  return html`<${Modal} title=${f.id ? 'Editar cliente' : 'Novo cliente'} onClose=${onClose} footer=${html`${f.id && html`<${Btn} v="ghost" cls="danger" on=${arch}>Arquivar</${Btn}>`}<span style=${{ flex: 1 }}/><${Btn} on=${onClose}>Cancelar</${Btn}><${Btn} v="pri" on=${ok}>Salvar</${Btn}>`}>
    <div class="form c2">
      <${Input} cls="span3" label="Nome do cliente" v=${f.name} on=${F('name')} autoFocus=${true}/>
      <${Input} label="Segmento" v=${f.segment} on=${F('segment')} ph="Ex: Estética"/>
      <${Select} label="Etapa" v=${f.stage} on=${F('stage')} opts=${PIPE.map(s => ({ v: s.id, l: s.l }))}/>
      <${Select} label="Responsável" v=${f.responsible} on=${F('responsible')} opts=${cs.map(x => ({ v: x.id, l: x.name }))}/>
      <${Select} label="2º responsável" v=${f.responsible2} on=${F('responsible2')} ph="—" opts=${cs.map(x => ({ v: x.id, l: x.name }))}/>
      <${Field} label="Código do portal do cliente"><div class="row"><input class="inp" value=${f.code} onChange=${e => F('code')(e.target.value.toUpperCase())}/><${Btn} sz="sm" on=${() => F('code')(genCode())}>Gerar</${Btn}></div></${Field}>
      <${Input} label="Pasta do Drive / OneDrive" v=${f.onedrive} on=${F('onedrive')} ph="https://…"/>
      <${Textarea} cls="span3" label="Observações" v=${f.notes} on=${F('notes')} rows=${2}/>
    </div></${Modal}>`;
}

/* ---------- espaço do cliente ---------- */
const WS_TABS = [{ v: 'briefing', l: '📝 Briefing' }, { v: 'posts', l: '📋 Posts' }, { v: 'relatorio', l: '📊 Relatório' }, { v: 'crm', l: '🤝 CRM' }, { v: 'ck', l: '✅ Checklist' }, { v: 'rot', l: '🎬 Roteiro' }, { v: 'mapas', l: '🧠 Mapas mentais' }, { v: 'instagram', l: '📈 Instagram', agency: true }];
function ClientWorkspace({ id, nav, portal }) {
  const db = useDB();
  const [clients, saveClients, loading] = useDoc(V6('clients'), []);
  const cl = asArr(clients).find(c => c.id === id);
  const [tab, setTab] = useState(LS.get('vos7_wstab', 'posts'));
  useEffect(() => LS.set('vos7_wstab', tab), [tab]);
  const [edit, setEdit] = useState(false);
  const [internal] = useDoc(V6('internal'), {});
  const cs = colabsOf(internal);
  if (loading) return html`<div class="card"><${Empty} t="Carregando…" s=""/></div>`;
  if (!cl) return html`<div class="card"><${Empty} t="Cliente não encontrado" s=""><${Btn} on=${() => nav.go('operacao')}>Voltar</${Btn}></${Empty}></div>`;
  const stg = PIPE.find(s => s.id === (cl.stage || 'kickoff')) || PIPE[0];
  const cts = vals(db.contracts).filter(k => k.clientId === 'v6c_' + cl.id && contractStatus(k) !== 'encerrado');
  const P = { briefing: WsBriefing, posts: WsPosts, relatorio: WsReport, crm: WsCRM, ck: WsChecklist, rot: WsRoteiro, mapas: WsMapas, instagram: WsInstagram }[portal && tab === 'instagram' ? 'posts' : tab];
  return html`<div>
    ${!portal && html`<div class="row wrap mb12" style=${{ gap: 10 }}>
      <${Btn} sz="sm" v="ghost" icon="left" on=${() => nav.go('operacao')}>Clientes</${Btn}>
      <h1 style=${{ fontSize: 22 }}>${cl.name}</h1>
      <${Tag} style=${{ background: 'var(--surface-3)' }}><span class="dot" style=${{ background: stg.c }}/> ${stg.l}</${Tag}>
      ${cl.segment && html`<span class="muted small">${cl.segment}</span>`}
      <span style=${{ flex: 1 }}/>
      ${cts.length > 0 && html`<span class="small muted">${cts.map(k => prodName(db.S, k.productId).split(' (')[0]).join(' · ')} · <b>${money(sum(cts.filter(k => contractActiveIn(k, ymNow())), brlValue))}/mês</b></span>`}
      ${cl.onedrive && html`<${Btn} sz="sm" icon="external" href=${cl.onedrive}>Drive</${Btn}>`}
      <${Btn} sz="sm" icon="users" on=${() => nav.preview(cl.id)} title="Ver o que o cliente vê no portal">Portal · ${cl.code || 'sem código'}</${Btn}>
      <${Btn} sz="sm" icon="edit" on=${() => setEdit(true)}>Editar</${Btn}>
    </div>`}
    <div class="seg mb16" style=${{ display: 'flex', overflowX: 'auto' }}>${WS_TABS.filter(t => !(portal && t.agency)).map(t => html`<button key=${t.v} class=${tab === t.v ? 'on' : ''} onClick=${() => setTab(t.v)}>${t.l}</button>`)}</div>
    <${P} cl=${cl} cs=${cs} portal=${portal} nav=${nav}/>
    ${edit && html`<${ClientOpsForm} c=${cl} list=${asArr(clients)} save=${saveClients} cs=${cs} onClose=${() => setEdit(false)}/>`}
  </div>`;
}

/* ---------- briefing ---------- */
function WsBriefing({ cl, portal }) {
  const [b, save, loading] = useDoc(V6C(cl.id, 'briefing'), {});
  const [f, setF] = useState(null);
  useEffect(() => { if (!loading && f === null) setF(b || {}); }, [loading]);
  if (loading || f === null) return html`<div class="card"><${Empty} t="Carregando…" s=""/></div>`;
  if (portal) return html`<div class="grid g2">${BRIEF_FIELDS.filter(x => f[x.k]).map(x => html`<div class="card" key=${x.k}><div class="xs b faint mb8" style=${{ letterSpacing: '.08em', textTransform: 'uppercase' }}>${x.l}</div><div class="small" style=${{ whiteSpace: 'pre-wrap' }}>${f[x.k]}</div></div>`)}${!BRIEF_FIELDS.some(x => f[x.k]) && html`<div class="card"><${Empty} t="Briefing ainda não preenchido" s=""/></div>`}</div>`;
  const dirty = JSON.stringify(f) !== JSON.stringify(b || {});
  return html`<div class="card">
    <div class="card-h"><h3>Briefing</h3><${Btn} v="pri" disabled=${!dirty} on=${async () => { if (await save({ ...f, updatedAt: stamp() })) toast('Briefing salvo.'); }}>${dirty ? 'Salvar briefing' : 'Salvo'}</${Btn}></div>
    <div class="form c2">${BRIEF_FIELDS.map(x => html`<${Textarea} key=${x.k} label=${x.l} v=${f[x.k] || ''} on=${v => setF(p => ({ ...p, [x.k]: v }))} ph=${x.ph} rows=${x.rows}/>`)}</div>
  </div>`;
}

/* ---------- posts ---------- */
function WsPosts({ cl, cs, portal }) {
  const [posts0, , loading] = useDoc(V6C(cl.id, 'posts'), []);
  const [todos0] = useDoc(V6C(cl.id, 'todos'), []);
  const posts = asArr(posts0), todos = asArr(todos0);
  const [view, setView] = useState('ativos'); const [plat, setPlat] = useState(''); const [edit, setEdit] = useState(null); const [dec, setDec] = useState(null);
  if (loading) return html`<div class="card"><${Empty} t="Carregando posts…" s=""/></div>`;
  const act = posts.filter(p => !p.archived && p.stage !== 'Arquivado');
  let list = view === 'arquivados' ? posts.filter(p => p.archived || p.stage === 'Arquivado') : act.filter(p => view === 'ativos' || p.postType === view);
  if (plat) list = list.filter(p => p.platform === plat);
  if (portal) list = list.filter(p => !(p.archived || p.stage === 'Arquivado'));
  list = list.sort((a, b) => (a.postDate || '9999').localeCompare(b.postDate || '9999'));
  const lateOf = p => postLate(p) && (!portal || isClientStage(p.stage)); // no portal: só o que depende do cliente
  const late = act.filter(lateOf).length;
  const mine = act.filter(p => isClientStage(p.stage));
  const arch = async id => { await docSave(V6C(cl.id, 'posts'), posts.map(x => (x.id === id ? { ...x, stage: 'Arquivado', archived: true, stageDate: today() } : x))); toast('Post arquivado.'); };
  const del = async id => { if (!confirm('Excluir este post de vez?')) return; await docSave(V6C(cl.id, 'posts'), posts.filter(x => x.id !== id)); };
  return html`<div>
    <div class="row wrap mb12">
      <span class="small muted">${act.length} ativos${late ? html` · <b style=${{ color: 'var(--bad)' }}>⚠ ${late} ${portal ? 'esperando você há mais tempo que o combinado' : 'atrasados'}</b>` : ''}${mine.length ? html` · <b style=${{ color: 'var(--warn)' }}>${mine.length} aguardando ${portal ? 'você' : 'o cliente'}</b>` : ''}</span>
      <span style=${{ flex: 1 }}/>
      ${!portal && html`<${Btn} v="pri" icon="plus" on=${() => setEdit({})}>Novo post</${Btn}>`}
    </div>
    ${portal && mine.length > 0 && html`<div class="callout warn mb12"><b class="t">${mine.length} post(s) esperando você</b>Aprove os roteiros e vídeos ou envie o material. Se algo precisar mudar, clique em "Pedir ajuste" e explique.</div>`}
    ${!portal && html`<div class="row wrap mb12"><${Seg} v=${view} on=${setView} opts=${[{ v: 'ativos', l: 'Todos ativos' }].concat(POST_TYPES).concat([{ v: 'arquivados', l: '📦 Arquivados' }])}/><${Seg} v=${plat} on=${setPlat} opts=${[{ v: '', l: 'Todas' }].concat(POST_PLATFORMS.map(p => ({ v: p, l: p })))}/></div>`}
    <div class="card flush">
      ${list.map(p => { const st = postStages(p.postType, p.captacao); const i = st.indexOf(p.stage); const lateP = lateOf(p); const resp = STAGE_RESP[p.stage];
        return html`<div class="lrow" key=${p.id} style=${{ alignItems: 'flex-start', flexWrap: 'wrap', borderLeft: '3px solid ' + (lateP ? 'var(--bad)' : stageColor(p.stage)) }}>
          <div style=${{ width: 54, textAlign: 'center' }}><div class="b num">${p.postDate ? pad(parseD(p.postDate).getDate()) : '—'}</div><div class="xs faint">${p.postDate ? MSHORT[parseD(p.postDate).getMonth()] : ''}</div></div>
          <div style=${{ flex: '1 1 280px', minWidth: 0, cursor: portal ? null : 'pointer' }} onClick=${() => !portal && setEdit(p)}>
            <div class="main-t">${p.theme || '(sem tema)'}</div>
            <div class="row wrap mt8" style=${{ gap: 6, marginTop: 4 }}>
              <${Tag}>${p.platform || 'Instagram'}</${Tag}><${Tag}>${(POST_TYPES.find(t => t.v === p.postType) || {}).l || p.postType}</${Tag}>
              <${Tag} style=${{ color: stageColor(p.stage), background: 'var(--surface-3)', fontWeight: 700 }}>${portal && !isClientStage(p.stage) && p.stage !== 'Postagem' ? 'Em produção · ' + p.stage : p.stage}</${Tag}>
              ${lateP && html`<${Tag} t="bad">⚠ atrasado</${Tag}>`}${p.rejected && html`<${Tag} t="bad" style=${{ whiteSpace: 'normal' }}>ajuste pedido${p.rejectionNote ? ': ' + p.rejectionNote : ''}</${Tag}>`}
              ${!portal && resp && html`<span class="xs faint">· ${colabName(cs, resp)}</span>`}
              ${!portal && postDeadline(p) && html`<span class="xs faint">· prazo ${fdate(postDeadline(p))}</span>`}
            </div>
            ${i >= 0 && html`<div class="row mt8" style=${{ gap: 3 }}>${st.map((s, k) => html`<span key=${k} title=${s} style=${{ height: 4, flex: 1, maxWidth: 40, borderRadius: 4, background: k <= i ? stageColor(p.stage) : 'var(--surface-3)' }}/>`)}</div>`}
            ${(p.driveLink || p.artLink) && html`<div class="xs mt8">${p.driveLink && html`<a href=${p.driveLink} target="_blank" rel="noopener">📁 Drive</a>`} ${p.artLink && html`<a href=${p.artLink} target="_blank" rel="noopener">🎨 Arte</a>`}</div>`}
          </div>
          <div class="row wrap" style=${{ justifyContent: 'flex-end' }}>
            ${portal ? (isClientStage(p.stage) && html`
              <${Btn} sz="sm" v="good" icon="check" on=${() => clientDecision(cl.id, posts, todos, p, true).then(() => toast('Obrigado! A equipe Visions já foi avisada.'))}>${p.stage === 'Upload Drive (Cliente)' ? 'Material enviado' : 'Aprovar'}</${Btn}>
              ${p.stage !== 'Upload Drive (Cliente)' && html`<${Btn} sz="sm" on=${() => setDec(p)}>Pedir ajuste</${Btn}>`}`)
            : html`
              <${Btn} sz="xs" icon="left" on=${() => movePost(cl.id, posts, todos, p.id, -1)} disabled=${i <= 0}>Voltar</${Btn}>
              ${i >= 0 && i < st.length - 1 && html`<${Btn} sz="xs" v="good" on=${() => movePost(cl.id, posts, todos, p.id, 1)}>→ ${st[i + 1].replace(' (Cliente)', '')}</${Btn}>`}
              ${!p.archived && html`<${Btn} sz="xs" v="ghost" on=${() => arch(p.id)} title="Arquivar">📦</${Btn}>`}
              <${Btn} sz="xs" v="ghost" cls="danger" icon="trash" on=${() => del(p.id)}/>`}
          </div>
        </div>`; })}
      ${!list.length && html`<${Empty} t="Nenhum post aqui" s=${portal ? '' : 'Crie o primeiro com "Novo post".'}/>`}
    </div>
    ${edit && html`<${PostForm} cl=${cl} cs=${cs} post=${edit.id ? edit : null} posts=${posts} onClose=${() => setEdit(null)}/>`}
    ${dec && html`<${RejectModal} p=${dec} onClose=${() => setDec(null)} onOk=${note => clientDecision(cl.id, posts, todos, dec, false, note).then(() => { setDec(null); toast('Pedido de ajuste enviado para a equipe.'); })}/>`}
  </div>`;
}
function RejectModal({ p, onClose, onOk }) {
  const [n, setN] = useState('');
  return html`<${Modal} title=${'Pedir ajuste — ' + p.theme} onClose=${onClose} footer=${html`<${Btn} on=${onClose}>Cancelar</${Btn}><${Btn} v="pri" on=${() => { if (!n.trim()) return toast('Explique o que precisa mudar.'); onOk(n.trim()); }}>Enviar</${Btn}>`}>
    <${Textarea} label="O que precisa mudar?" v=${n} on=${setN} rows=${4} ph="Ex: trocar a música, deixar mais curto, mudar a frase inicial…"/></${Modal}>`;
}
function PostForm({ cl, cs, post, posts, onClose }) {
  const [f, setF] = useState(() => Object.assign({ theme: '', postType: 'video', captacao: 'leonardo', platform: 'Instagram', postDate: '', responsible: 'consultora', driveLink: '', artLink: '', caption: '', notes: '' }, post || {}));
  const F = k => v => setF(p => ({ ...p, [k]: v }));
  const save = async () => {
    if (!f.theme.trim()) return toast('Informe o tema do post.');
    if (post) {
      const upd = { ...post, ...f };
      if (f.postType !== post.postType || f.captacao !== post.captacao) { upd.stage = postStages(f.postType, f.captacao)[0]; upd.stageDate = today(); }
      await docSave(V6C(cl.id, 'posts'), posts.map(x => (x.id === post.id ? upd : x)));
    } else {
      const st = postStages(f.postType, f.captacao);
      await docSave(V6C(cl.id, 'posts'), [{ ...f, id: uid(), stage: st[0], stageDate: today(), createdAt: stamp() }].concat(posts));
    }
    toast('Post salvo.'); onClose();
  };
  return html`<${Modal} title=${post ? 'Editar post' : 'Novo post'} size="lg" onClose=${onClose} footer=${html`<${Btn} on=${onClose}>Cancelar</${Btn}><${Btn} v="pri" on=${save}>Salvar</${Btn}>`}>
    <div class="form c2">
      <${Input} cls="span3" label="Tema" v=${f.theme} on=${F('theme')} autoFocus=${true}/>
      <${Field} label="Tipo"><${Seg} v=${f.postType} on=${F('postType')} opts=${POST_TYPES}/></${Field}>
      ${f.postType === 'video' && html`<${Field} label="Quem grava"><${Seg} v=${f.captacao} on=${F('captacao')} opts=${[{ v: 'leonardo', l: 'Visions grava' }, { v: 'cliente', l: 'Cliente grava' }]}/></${Field}>`}
      <${Select} label="Plataforma" v=${f.platform} on=${F('platform')} opts=${POST_PLATFORMS}/>
      <${Input} label="Data de postagem" type="date" v=${f.postDate} on=${F('postDate')}/>
      <${Select} label="Responsável" v=${f.responsible} on=${F('responsible')} opts=${cs.map(x => ({ v: x.id, l: x.name }))}/>
      <${Input} label="Link do Drive" v=${f.driveLink} on=${F('driveLink')}/>
      <${Input} label="Link da arte" v=${f.artLink} on=${F('artLink')}/>
      <${Textarea} cls="span3" label="Legenda" v=${f.caption} on=${F('caption')} rows=${3}/>
      <${Textarea} cls="span3" label="Observações / roteiro" v=${f.notes} on=${F('notes')} rows=${3}/>
    </div>
    <div class="xs faint mt12">Etapas: ${postStages(f.postType, f.captacao).join(' → ')}</div>
  </${Modal}>`;
}

/* ---------- CRM do cliente ---------- */
const CRM_DEFAULT_STAGES = [
  { id: 'prospeccao', l: 'Prospecção' }, { id: 'contato', l: 'Primeiro Contato' }, { id: 'qualificado', l: 'Qualificado' },
  { id: 'proposta', l: 'Proposta Enviada' }, { id: 'negociacao', l: 'Negociação' }, { id: 'venda', l: 'Venda Realizada' }, { id: 'perdido', l: 'Perdido' }
];
const CRM_COMPAT = { 'Prospecção': 'prospeccao', 'Pré-qualificação': 'qualificado', 'Reunião Agendada': 'proposta', 'Proposta Enviada': 'proposta', 'Negociação': 'negociacao', 'Venda Realizada': 'venda', 'cliente': 'venda', 'Follow-up': 'contato' };
function crmSetup(crm) {
  const all = asArr(crm); const cfg = all.find(x => x._isConfig) || {};
  const stages = Array.isArray(cfg.stages) && cfg.stages.length ? cfg.stages : CRM_DEFAULT_STAGES;
  const sid = l => { const s = CRM_COMPAT[l.stage] || l.stage; return stages.some(x => x.id === s) ? s : stages[0].id; };
  const leads = all.filter(x => !x._isConfig).map(l => ({ ...l, _s: sid(l) }));
  return { all, cfg, stages, leads };
}
const isWon = s => s === 'venda';
function WsCRM({ cl, portal }) {
  const [crm, save, loading] = useDoc(V6C(cl.id, 'crm'), []);
  const [edit, setEdit] = useState(null); const [q, setQ] = useState(''); const [drag, setDrag] = useState(null); const [over, setOver] = useState(null);
  if (loading) return html`<div class="card"><${Empty} t="Carregando CRM…" s=""/></div>`;
  const { all, stages, leads } = crmSetup(crm);
  const vis = leads.filter(l => !q || (l.name + ' ' + (l.phone || '') + ' ' + (l.campanha || '')).toLowerCase().includes(q.toLowerCase()));
  const moveL = (id, s) => { save(all.map(x => (x.id === id ? { ...x, stage: s, updatedAt: stamp(), saleDate: isWon(s) && !x.saleDate ? today() : x.saleDate, history: asArr(x.history).concat({ ts: stamp(), to: s }) } : x))); if (portal) logAct(cl.id, 'Moveu lead: ' + (leads.find(l => l.id === id) || {}).name); };
  const ym = ymNow();
  const won = leads.filter(l => l._s === 'venda' && ymOf(l.saleDate || dOfStamp(l.updatedAt)) === ym);
  return html`<div>
    <div class="grid g4 mb12">
      <${Kpi} l="Leads no CRM" v=${num(leads.length)} s=${leads.filter(l => ymOf(dOfStamp(l.createdAt)) === ym).length + ' novos este mês'}/>
      <${Kpi} l="Em negociação" v=${num(leads.filter(l => !['venda', 'perdido'].includes(l._s)).length)}/>
      <${Kpi} l="Vendas no mês" v=${num(won.length)} tone="good" s=${money(sum(won, l => l.value)) + ' em valor'}/>
      <${Kpi} l="Conversão total" v=${pct(ratio(leads.filter(l => l._s === 'venda').length, leads.length) * 100)} s="vendas ÷ leads"/>
    </div>
    <div class="row wrap mb12"><div style=${{ flex: '1 1 220px', maxWidth: 320 }}><${Input} v=${q} on=${setQ} ph="Buscar lead, telefone, campanha…"/></div><span style=${{ flex: 1 }}/><${Btn} v="pri" icon="plus" on=${() => setEdit({})}>Novo lead</${Btn}></div>
    <div class="kanban">${stages.map(s => { const col = vis.filter(l => l._s === s.id);
      return html`<div key=${s.id} class=${'kcol' + (over === s.id ? ' drop' : '')} onDragOver=${e => { e.preventDefault(); setOver(s.id); }} onDragLeave=${() => setOver(null)} onDrop=${() => { setOver(null); if (drag) moveL(drag, s.id); setDrag(null); }}>
        <div class="kcol-h">${s.l}<span class="faint">${col.length}</span>${col.some(l => l.value) && html`<span class="sum">${money(sum(col, l => l.value))}</span>`}</div>
        ${col.slice(0, 80).map(l => html`<div key=${l.id} class="kcard" draggable="true" onDragStart=${() => setDrag(l.id)} onClick=${() => setEdit(l)}>
          <div class="nm ellipsis">${l.name}</div>${l.phone && html`<div class="co">${l.phone}</div>`}
          <div class="meta">${l.canal && html`<${Tag}>${l.canal}</${Tag}>`}${l.campanha && html`<${Tag} t="pri">${l.campanha}</${Tag}>`}${asArr(l.tags).slice(0, 2).map(t => html`<${Tag} key=${t}>${t}</${Tag}>`)}${l.value > 0 && html`<span class="xs b" style=${{ color: 'var(--good)' }}>${money(l.value)}</span>`}</div>
        </div>`)}
        ${col.length > 80 && html`<div class="xs faint" style=${{ textAlign: 'center' }}>+${col.length - 80} (use a busca)</div>`}
      </div>`; })}</div>
    ${edit && html`<${LeadForm} cl=${cl} lead=${edit.id ? edit : null} all=${all} stages=${stages} save=${save} portal=${portal} onClose=${() => setEdit(null)}/>`}
  </div>`;
}
function LeadForm({ cl, lead, all, stages, save, portal, onClose }) {
  const [f, setF] = useState(() => Object.assign({ name: '', phone: '', email: '', canal: '', campanha: '', value: '', saleDate: '', notes: '', responsavel: '', stage: stages[0].id, tags: [] }, lead ? { ...lead, stage: lead._s } : {}));
  const F = k => v => setF(p => ({ ...p, [k]: v }));
  const ok = async () => {
    if (!f.name.trim()) return toast('Informe o nome.');
    const o = { ...f, value: n0(f.value), tags: typeof f.tags === 'string' ? f.tags.split(',').map(x => x.trim()).filter(Boolean) : asArr(f.tags), updatedAt: stamp() }; delete o._s;
    if (isWon(o.stage) && !o.saleDate) o.saleDate = today();
    if (lead) await save(all.map(x => (x.id === lead.id ? { ...x, ...o } : x)));
    else { await save([{ ...o, id: uid(), createdAt: stamp(), contactDate: today() }].concat(all)); logAct(cl.id, 'Criou lead: ' + o.name); }
    toast('Lead salvo.'); onClose();
  };
  const del = async () => { if (!confirm('Excluir ' + f.name + '?')) return; await save(all.filter(x => x.id !== lead.id)); onClose(); };
  return html`<${Modal} title=${lead ? lead.name : 'Novo lead'} onClose=${onClose} footer=${html`${lead && html`<${Btn} v="ghost" cls="danger" on=${del}>Excluir</${Btn}>`}<span style=${{ flex: 1 }}/>${f.phone && html`<${Btn} cls="wa" icon="msg" href=${waLink(f.phone, '')}>WhatsApp</${Btn}>`}<${Btn} on=${onClose}>Cancelar</${Btn}><${Btn} v="pri" on=${ok}>Salvar</${Btn}>`}>
    <div class="form c2">
      <${Input} cls="span3" label="Nome" v=${f.name} on=${F('name')} autoFocus=${!lead}/>
      <${Input} label="Telefone / WhatsApp" v=${f.phone} on=${F('phone')}/><${Input} label="E-mail" v=${f.email} on=${F('email')}/>
      <${Select} label="Etapa" v=${f.stage} on=${F('stage')} opts=${stages.map(s => ({ v: s.id, l: s.l }))}/>
      <${Input} label="Canal" v=${f.canal} on=${F('canal')} ph="Instagram, Indicação, Google…"/>
      <${Input} label="Campanha" v=${f.campanha} on=${F('campanha')} ph="Ex: Captação WhatsApp"/>
      <${Money} label="Valor" v=${f.value} on=${F('value')}/>
      ${isWon(f.stage) && html`<${Input} label="Data da venda" type="date" v=${f.saleDate} on=${F('saleDate')}/>`}
      <${Input} label="Etiquetas (separe por vírgula)" v=${Array.isArray(f.tags) ? f.tags.join(', ') : f.tags} on=${F('tags')}/>
      <${Textarea} cls="span3" label="Observações" v=${f.notes} on=${F('notes')} rows=${3}/>
    </div></${Modal}>`;
}

/* ---------- relatório (CRM + painel de tráfego do cliente) ---------- */
function WsReport({ cl, portal }) {
  const db = useDB();
  const [crm, , loading] = useDoc(V6C(cl.id, 'crm'), []);
  const [pPerf] = useDoc(portal ? 'vos7_perf' : null, {});
  const [pClients] = useDoc(portal ? 'vos7_clients' : null, {});
  const [ym, setYm] = useState(ymNow());
  if (loading) return html`<div class="card"><${Empty} t="Carregando…" s=""/></div>`;
  const { leads, stages } = crmSetup(crm);
  const inM = d => d && ymOf(d) === ym;
  const novos = leads.filter(l => inM(dOfStamp(l.createdAt) || l.contactDate));
  const vendas = leads.filter(l => l._s === 'venda' && inM(l.saleDate || dOfStamp(l.updatedAt)));
  const fat = sum(vendas, l => l.value);
  const byCanal = groupBy(novos, l => l.canal || l.campanha || 'Não informado');
  const months = Array.from({ length: 6 }, (_, i) => addMonths(ym, i - 5));
  const hist = months.map(m => ({ m, n: leads.filter(l => ymOf(dOfStamp(l.createdAt) || l.contactDate) === m).length, v: leads.filter(l => l._s === 'venda' && ymOf(l.saleDate || dOfStamp(l.updatedAt)) === m).length }));
  const v7 = 'v6c_' + cl.id;
  const clientsMap = portal ? (pClients || {}) : db.clients; const perfMap = portal ? (pPerf || {}) : db.perf;
  const perfCl = clientsMap[v7] || vals(clientsMap).find(c => (c.name || '').trim().toLowerCase() === (cl.name || '').trim().toLowerCase());
  const perf = perfCl ? vals(perfMap).filter(r => r.clientId === perfCl.id) : [];
  const pm = perfModel(perfCl || {});
  const prows = perf.filter(r => inM(r.date)).map(r => perfRow(r, pm)); const pa = perfAgg(prows, pm);
  return html`<div>
    <div class="row wrap mb12"><${MonthNav} v=${ym} on=${setYm}/>${!portal && html`<span class="xs faint">É isso que o cliente vê na aba Relatório do portal.</span>`}</div>
    ${perf.length > 0 && html`<div class="card mb16"><div class="card-h"><h3>Tráfego pago — ${monthLabel(ym)}</h3><span class="sub">${prows.length} semana(s) registradas</span></div>
      ${prows.length ? html`<div class="grid g5">
        <${Kpi} l="Investimento" v=${money2(pa.spend)}/><${Kpi} l="Leads" v=${num(pa.leads)} s=${'CPL ' + (Number.isFinite(pa.cpl) ? money2(pa.cpl) : '—')}/>
        <${Kpi} l=${pm === 'venda' ? 'Reuniões' : 'Agendamentos'} v=${num(pa.appts)} s=${pct(pa.convStep) + ' dos leads'}/>
        <${Kpi} l="Faturamento via tráfego" v=${money(pa.trafego)} tone="good"/><${Kpi} l="ROAS" v=${Number.isFinite(pa.roas) ? num(pa.roas, 1) + 'x' : '—'} s="retorno sobre o investido" tone=${pa.roas >= 3 ? 'good' : null}/></div>` : html`<div class="small muted">Nenhuma semana registrada neste mês.</div>`}</div>`}
    <div class="grid g4 mb16">
      <${Kpi} l="Novos leads" v=${num(novos.length)}/><${Kpi} l="Vendas" v=${num(vendas.length)} tone="good"/>
      <${Kpi} l="Faturamento (CRM)" v=${money(fat)} s=${vendas.length ? 'ticket ' + money(fat / vendas.length) : ''}/><${Kpi} l="Conversão do mês" v=${pct(ratio(vendas.length, novos.length) * 100)} s="vendas ÷ novos leads"/>
    </div>
    <div class="grid g2">
      <div class="card"><div class="card-h"><h3>Leads e vendas — 6 meses</h3></div>
        <${BarChart} labels=${hist.map(h => monthShort(h.m))} highlight=${5} series=${[{ name: 'Novos leads', data: hist.map(h => h.n), color: 'var(--s1)' }, { name: 'Vendas', data: hist.map(h => h.v), color: 'var(--s3)' }]}/></div>
      <div class="card"><div class="card-h"><h3>De onde vieram os leads</h3><span class="sub">${monthLabel(ym)}</span></div>
        ${novos.length ? html`<${FunnelBars} rows=${Object.entries(byCanal).sort((a, b) => b[1].length - a[1].length).slice(0, 8).map(([k, l]) => ({ l: k, v: l.length }))}/>` : html`<div class="small muted">Sem leads novos no mês.</div>`}
        <div class="hr"/><div class="xs b faint mb8">FUNIL ATUAL</div>
        <${FunnelBars} rows=${stages.filter(s => s.id !== 'perdido').map(s => ({ l: s.l, v: leads.filter(l => l._s === s.id).length, c: s.id === 'venda' ? 'var(--good)' : null }))}/></div>
    </div>
  </div>`;
}

/* ---------- checklist ---------- */
function WsChecklist({ cl, portal }) {
  const [ck0, save, loading] = useDoc(V6C(cl.id, 'ck'), []);
  const [newG, setNewG] = useState(''); const [add, setAdd] = useState({});
  if (loading) return html`<div class="card"><${Empty} t="Carregando…" s=""/></div>`;
  const groups = asArr(ck0).map(g => ({ ...g, items: asArr(g.items) }));
  const upd = (gid, fn) => save(groups.map(g => (g.id === gid ? fn(g) : g)));
  const tog = (gid, iid) => upd(gid, g => ({ ...g, items: g.items.map(i => (i.id === iid ? { ...i, done: !i.done, doneAt: !i.done ? stamp() : '' } : i)) }));
  const addItem = gid => { const t = (add[gid] || '').trim(); if (!t) return; upd(gid, g => ({ ...g, items: g.items.concat({ id: uid(), text: t, category: 'conteudo', deadline: '', notes: '', visivel: true, done: false, createdAt: stamp() }) })); setAdd(a => ({ ...a, [gid]: '' })); };
  return html`<div>
    ${!portal && html`<div class="row mb12"><div style=${{ width: 260 }}><${Input} v=${newG} on=${setNewG} ph="Novo grupo (ex: Dezembro)" onEnter=${() => { if (newG.trim()) { save([{ id: uid(), month: newG.trim(), items: [] }].concat(groups)); setNewG(''); } }}/></div><${Btn} on=${() => { if (newG.trim()) { save([{ id: uid(), month: newG.trim(), items: [] }].concat(groups)); setNewG(''); } }}>Criar grupo</${Btn}></div>`}
    ${groups.map(g => { const items = portal ? g.items.filter(i => i.visivel !== false) : g.items; const done = items.filter(i => i.done).length;
      return html`<div class="card flush mb12" key=${g.id}>
        <div class="lgroup"><span>${g.month}</span><span>${done}/${items.length} ${!portal ? html`<button class="btn xs ghost" onClick=${() => confirm('Excluir o grupo ' + g.month + '?') && save(groups.filter(x => x.id !== g.id))}>excluir</button>` : ''}</span></div>
        <div style=${{ padding: '0 14px' }}><div class="bar mt8 mb8"><i style=${{ width: (items.length ? done / items.length * 100 : 0) + '%', background: 'var(--good)' }}/></div></div>
        ${items.map(i => html`<div class="lrow" key=${i.id}>
          <input type="checkbox" checked=${!!i.done} disabled=${portal} onChange=${() => tog(g.id, i.id)} style=${{ width: 18, height: 18, accentColor: 'var(--good)' }}/>
          <div style=${{ flex: 1, minWidth: 0 }}><div class=${i.done ? 'faint' : ''} style=${{ textDecoration: i.done ? 'line-through' : null }}>${i.text}</div>
            <div class="xs faint">${(CK_CATS.find(c => c.v === i.category) || {}).l || i.category || ''}${i.deadline ? ' · prazo ' + fdate(i.deadline) : ''}${!portal && i.visivel === false ? ' · oculto do cliente' : ''}</div></div>
          ${!portal && html`<input class="inp sm" type="date" value=${i.deadline || ''} style=${{ width: 140 }} onChange=${e => upd(g.id, gg => ({ ...gg, items: gg.items.map(x => (x.id === i.id ? { ...x, deadline: e.target.value } : x)) }))}/>
            <button class="btn xs ghost" title="Mostrar/ocultar no portal" onClick=${() => upd(g.id, gg => ({ ...gg, items: gg.items.map(x => (x.id === i.id ? { ...x, visivel: x.visivel === false } : x)) }))}>${i.visivel === false ? '🙈' : '👁'}</button>
            <button class="btn xs ghost danger" onClick=${() => upd(g.id, gg => ({ ...gg, items: gg.items.filter(x => x.id !== i.id) }))}>×</button>`}
        </div>`)}
        ${!portal && html`<div class="row" style=${{ padding: 10 }}><${Input} sm=${true} v=${add[g.id] || ''} on=${v => setAdd(a => ({ ...a, [g.id]: v }))} ph="Nova tarefa… (Enter)" onEnter=${() => addItem(g.id)}/><${Btn} sz="sm" on=${() => addItem(g.id)}>Adicionar</${Btn}></div>`}
      </div>`; })}
    ${!groups.length && html`<div class="card"><${Empty} t="Nenhum checklist" s=${portal ? '' : 'Crie um grupo acima.'}/></div>`}
  </div>`;
}

/* ---------- roteiro ---------- */
function WsRoteiro({ cl, portal }) {
  const [rot0, save, loading] = useDoc(V6C(cl.id, 'rot'), []);
  const [edit, setEdit] = useState(null); const [open, setOpen] = useState(null);
  if (loading) return html`<div class="card"><${Empty} t="Carregando…" s=""/></div>`;
  const rot = asArr(rot0);
  return html`<div>
    ${!portal && html`<div class="row mb12"><span style=${{ flex: 1 }}/><${Btn} v="pri" icon="plus" on=${() => setEdit({})}>Novo roteiro</${Btn}></div>`}
    <div class="card flush">${rot.map(r => html`<div key=${r.id} style=${{ borderBottom: '1px solid var(--border)' }}>
      <div class="lrow" style=${{ cursor: 'pointer', borderBottom: 0 }} onClick=${() => setOpen(open === r.id ? null : r.id)}>
        <div style=${{ flex: 1 }}><b>${r.week || 'Roteiro'}</b><div class="xs faint">${(r.content || '').slice(0, 110)}${(r.content || '').length > 110 ? '…' : ''}</div></div>
        ${!portal && html`<${Btn} sz="xs" v="ghost" icon="edit" on=${e => { e.stopPropagation(); setEdit(r); }}/>`}<span class="faint">${open === r.id ? '▴' : '▾'}</span></div>
      ${open === r.id && html`<div style=${{ padding: '0 14px 14px' }}><div class="script">${r.content}</div>${r.notes && html`<div class="small muted mt8">${r.notes}</div>`}</div>`}
    </div>`)}${!rot.length && html`<${Empty} t="Nenhum roteiro ainda" s=""/>`}</div>
    ${edit && html`<${Modal} title=${edit.id ? 'Editar roteiro' : 'Novo roteiro'} size="lg" onClose=${() => setEdit(null)} footer=${html`${edit.id && html`<${Btn} v="ghost" cls="danger" on=${() => { save(rot.filter(x => x.id !== edit.id)); setEdit(null); }}>Excluir</${Btn}>`}<span style=${{ flex: 1 }}/><${Btn} on=${() => setEdit(null)}>Cancelar</${Btn}><${Btn} v="pri" on=${() => { if (!edit.content) return toast('Escreva o roteiro.'); save(edit.id ? rot.map(x => (x.id === edit.id ? edit : x)) : [{ ...edit, id: uid(), createdAt: stamp() }].concat(rot)); setEdit(null); toast('Roteiro salvo.'); }}>Salvar</${Btn}>`}>
      <div class="form"><${Input} label="Semana / título" v=${edit.week} on=${v => setEdit({ ...edit, week: v })} ph="Ex: Semana 1 — Dezembro"/>
        <${Textarea} label="Roteiro" v=${edit.content} on=${v => setEdit({ ...edit, content: v })} rows=${12}/>
        <${Textarea} label="Observações" v=${edit.notes} on=${v => setEdit({ ...edit, notes: v })} rows=${2}/></div></${Modal}>`}
  </div>`;
}

/* ---------- mapas mentais ---------- */
function WsMapas({ cl, portal }) {
  const [m0, save, loading] = useDoc(V6C(cl.id, 'mapas'), []);
  const [edit, setEdit] = useState(null);
  if (loading) return html`<div class="card"><${Empty} t="Carregando…" s=""/></div>`;
  const maps = asArr(m0).filter(m => !portal || m.visible !== false);
  return html`<div>
    ${!portal && html`<div class="row mb12"><span style=${{ flex: 1 }}/><${Btn} v="pri" icon="plus" on=${() => setEdit({ visible: true })}>Novo mapa</${Btn}></div>`}
    <div class="grid g3">${maps.map(m => html`<div class="card" key=${m.id}>
      <div class="row between"><b>🧠 ${m.title}</b>${!portal && html`<${Btn} sz="xs" v="ghost" icon="edit" on=${() => setEdit(m)}/>`}</div>
      ${m.desc && html`<div class="small muted mt8">${m.desc}</div>`}
      ${!portal && m.visible === false && html`<div class="xs faint mt8">oculto do cliente</div>`}
      ${m.link && html`<div class="mt12"><${Btn} sz="sm" icon="external" href=${m.link}>Abrir mapa</${Btn}></div>`}</div>`)}</div>
    ${!maps.length && html`<div class="card"><${Empty} t="Nenhum mapa mental" s=${portal ? '' : 'Cole o link do Miro, Whimsical, etc.'}/></div>`}
    ${edit && html`<${Modal} title=${edit.id ? 'Editar mapa' : 'Novo mapa'} onClose=${() => setEdit(null)} footer=${html`${edit.id && html`<${Btn} v="ghost" cls="danger" on=${() => { save(asArr(m0).filter(x => x.id !== edit.id)); setEdit(null); }}>Excluir</${Btn}>`}<span style=${{ flex: 1 }}/><${Btn} on=${() => setEdit(null)}>Cancelar</${Btn}><${Btn} v="pri" on=${() => { if (!edit.title) return toast('Dê um título.'); const all = asArr(m0); save(edit.id ? all.map(x => (x.id === edit.id ? edit : x)) : [{ ...edit, id: uid(), createdAt: stamp() }].concat(all)); setEdit(null); }}>Salvar</${Btn}>`}>
      <div class="form"><${Input} label="Título" v=${edit.title} on=${v => setEdit({ ...edit, title: v })}/><${Input} label="Link (Miro, Whimsical…)" v=${edit.link} on=${v => setEdit({ ...edit, link: v })}/>
        <${Textarea} label="Descrição" v=${edit.desc} on=${v => setEdit({ ...edit, desc: v })} rows=${2}/><${Toggle} v=${edit.visible !== false} on=${v => setEdit({ ...edit, visible: v })} label="Visível no portal do cliente"/></div></${Modal}>`}
  </div>`;
}
