/* ============================================================
   HOJE, CONFIGURAÇÕES, IMPORTAÇÃO, LOGIN E APP
   ============================================================ */
let CURRENT_USER = { id: '', name: '' };

function HomePage({ nav }) {
  const db = useDB(); const S = db.S; const ym = ymNow();
  const b = followupBuckets(db, CURRENT_USER.id || null);
  const tasks = b.atrasado.concat(b.hoje);
  const pdoc = db.prospect[prospectDocId(today(), CURRENT_USER.id)] || { byCh: {} };
  const goalCh = S.channels.filter(c => S.dailyGoals[c.id] > 0);
  const abHoje = sum(Object.values(pdoc.byCh || {}), m => m.abord);
  const goalDay = sum(Object.values(S.dailyGoals || {}));
  const meetings = vals(db.deals).filter(d => d.stage === 'agendada' && d.meetingAt && d.meetingAt.slice(0, 10) <= addDays(today(), 1) && d.meetingAt.slice(0, 10) >= today()).sort((x, y) => x.meetingAt.localeCompare(y.meetingAt));
  const inv = useMemo(() => allInvoices(db, addMonths(ym, 1)), [db.contracts, db.payments]);
  const late = inv.filter(i => i.status === 'atrasado').sort((a, b2) => a.due.localeCompare(b2.due));
  const soon = inv.filter(i => i.status === 'pendente' && i.due <= addDays(today(), 7)).sort((a, b2) => a.due.localeCompare(b2.due));
  const f = monthFinance(db, ym, inv);
  const act = goalActuals(db, ym); const g = db.goals[ym] || {}; const pace = paceOf(ym);
  const bump = (ch, n) => bumpProspect(ch, 'abord', n);
  const h = new Date().getHours();
  const hi = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
  const mini = [['newMrr', 'Novo MRR', 'money'], ['sales', 'Vendas', 'int'], ['meetings', 'Reuniões realizadas', 'int'], ['approaches', 'Abordagens', 'int'], ['cash', 'Caixa recebido', 'money']];
  return html`<div>
    <${PageH} t=${hi + (CURRENT_USER.name ? ', ' + CURRENT_USER.name.split(' ')[0] : '') + '!'} s=${WEEKD[new Date().getDay()] + ', ' + new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' }) + ' · dia útil ' + bizElapsed(ym) + ' de ' + bizDays(ym)}>
      <${Btn} icon="plus" on=${() => nav.newDeal()}>Novo lead</${Btn}><${Btn} v="pri" icon="dollar" on=${() => nav.newContract()}>Nova venda</${Btn}>
    </${PageH}>
    <div class="grid g5 mb16">
      <${Kpi} l="Follow-ups p/ hoje" v=${tasks.length} s=${b.atrasado.length ? b.atrasado.length + ' atrasados' : 'em dia'} tone=${b.atrasado.length ? 'bad' : null} icon="bell"/>
      <${Kpi} l="Abordagens hoje" v=${abHoje + (goalDay ? ' / ' + goalDay : '')} s=${goalDay ? pct(abHoje / goalDay * 100) + ' da meta diária' : 'defina em Prospecção'} icon="target" tone=${goalDay && abHoje >= goalDay ? 'good' : null}/>
      <${Kpi} l="Reuniões hoje/amanhã" v=${meetings.length} icon="cal"/>
      <${Kpi} l="Novo MRR no mês" v=${money(act.newMrr)} s=${g.newMrr ? 'meta ' + money(g.newMrr) + ' · ' + pct(act.newMrr / g.newMrr * 100) : 'sem meta definida'} icon="up"/>
      <${Kpi} l="Caixa do mês" v=${money(f.caixa)} s=${'faltam ' + money(f.aReceber) + ' a receber'} icon="wallet"/>
    </div>
    <div class="grid g-side">
      <div class="col" style=${{ gap: 14 }}>
        <div class="card flush">
          <div class="lgroup"><span>Seus follow-ups de hoje</span><span><a href="#followups" onClick=${e => { e.preventDefault(); nav.go('followups'); }}>ver todos →</a></span></div>
          ${tasks.slice(0, 10).map(it => html`<${FollowRow} key=${it.d.id} it=${it} db=${db} nav=${nav}/>`)}
          ${!tasks.length && html`<${Empty} t="Tudo em dia ✅" s=${b.proximos.length ? b.proximos.length + ' follow-ups nos próximos dias.' : 'Que tal prospectar novos leads?'}/>`}
          ${b.semAcao.length > 0 && html`<div class="callout warn" style=${{ margin: 12 }}><b class="t">${b.semAcao.length} lead(s) sem próxima ação</b>Abra Follow-ups e defina o próximo passo de cada um.</div>`}
        </div>
        <div class="card"><div class="card-h"><h3>Metas de ${monthLabel(ym)}</h3><a href="#metas" onClick=${e => { e.preventDefault(); nav.go('metas'); }} class="small">editar →</a></div>
          ${mini.map(([k, l, fm]) => html`<div key=${k} class="mb12"><div class="row between small mb8" style=${{ marginBottom: 4 }}><span>${l}</span><span class="num"><b>${fmtBy(fm, act[k])}</b>${g[k] ? html`<span class="faint"> / ${fmtBy(fm, g[k])}</span>` : html`<span class="faint"> · sem meta</span>`}</span></div>
            <${Progress} v=${act[k]} max=${n0(g[k])} pace=${pace}/></div>`)}
        </div>
      </div>
      <div class="col" style=${{ gap: 14 }}>
        <div class="card"><div class="card-h"><h3>Prospecção de hoje</h3><a href="#prospeccao" onClick=${e => { e.preventDefault(); nav.go('prospeccao'); }} class="small">detalhar →</a></div>
          ${(goalCh.length ? goalCh : S.channels.filter(c => c.kind === 'outbound').slice(0, 3)).map(c => { const v = Number(((pdoc.byCh || {})[c.id] || {}).abord) || 0; const gl = S.dailyGoals[c.id] || 0;
    return html`<div key=${c.id} class="mb12"><div class="row between"><div style=${{ minWidth: 0 }}><div class="small b ellipsis">${c.name}</div><div class="xs faint">${v}${gl ? ' de ' + gl : ''} abordagens</div></div>
              <div class="counter"><button onClick=${() => bump(c.id, -1)} aria-label="menos">−</button><span class="cv">${v}</span><button class="plus" onClick=${() => bump(c.id, 1)} aria-label="mais">+</button></div></div>
              ${gl > 0 && html`<div class="mt8"><${Progress} v=${v} max=${gl} tone=${v >= gl ? 'good' : ''}/></div>`}</div>`; })}
        </div>
        ${meetings.length > 0 && html`<div class="card flush"><div class="lgroup"><span>Reuniões</span></div>${meetings.map(d => html`<div class="lrow" key=${d.id} style=${{ cursor: 'pointer' }} onClick=${() => nav.deal(d.id)}><${Icon} n="cal"/><div style=${{ flex: 1 }}><b>${d.name}</b><div class="xs faint">${d.company}</div></div><${Tag} t=${d.meetingAt.slice(0, 10) === today() ? 'warn' : 'info'}>${relDay(d.meetingAt.slice(0, 10))} ${d.meetingAt.slice(11, 16)}</${Tag}></div>`)}</div>`}
        <div class="card flush"><div class=${'lgroup' + (late.length ? ' bad' : '')}><span>${late.length ? 'Cobranças atrasadas' : 'A receber (7 dias)'}</span><span><a href="#recebiveis" onClick=${e => { e.preventDefault(); nav.go('recebiveis'); }}>ver →</a></span></div>
          ${late.concat(soon).slice(0, 6).map(i => html`<${InvRow} key=${i.id} i=${i}/>`)}
          ${!late.length && !soon.length && html`<${Empty} t="Nada vencendo" s="Nenhuma cobrança nos próximos 7 dias."/>`}
        </div>
      </div>
    </div>
  </div>`;
}

/* ---------- configurações ---------- */
function ListEditor({ items, cols, onChange, newItem, addLabel }) {
  const upd = (i, k, v) => onChange(items.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  return html`<div>
    <div class="tbl-wrap"><table class="tbl"><thead><tr>${cols.map(c => html`<th key=${c.k}>${c.l}</th>`)}<th/></tr></thead><tbody>
      ${items.map((it, i) => html`<tr key=${it.id || i}>${cols.map(c => html`<td key=${c.k} style=${{ minWidth: c.w || 120 }}>
        ${c.type === 'select' ? html`<${Select} sm=${true} v=${it[c.k]} on=${v => upd(i, c.k, v)} opts=${c.opts}/>`
      : c.type === 'bool' ? html`<input type="checkbox" checked=${!!it[c.k]} onChange=${e => upd(i, c.k, e.target.checked)}/>`
        : html`<${Input} sm=${true} type=${c.type || 'text'} v=${it[c.k]} on=${v => upd(i, c.k, c.type === 'number' ? n0(v) : v)}/>`}</td>`)}
        <td><${Btn} sz="xs" v="ghost" cls="danger" icon="trash" on=${() => confirm('Remover?') && onChange(items.filter((_, j) => j !== i))}/></td></tr>`)}
    </tbody></table></div>
    <div class="mt12"><${Btn} sz="sm" icon="plus" on=${() => onChange(items.concat(Object.assign({ id: uid().slice(-6) }, newItem)))}>${addLabel || 'Adicionar'}</${Btn}></div>
  </div>`;
}
function SettingsPage() {
  const db = useDB(); const S = db.S;
  const [tab, setTabRaw] = useState(() => { const t = LS.get('vos7_cfgtab', 'geral'); LS.set('vos7_cfgtab', 'geral'); return t; });
  const setTab = setTabRaw;
  const set = patch => store.setSettings(patch);
  const theme = LS.get('vos7_theme', 'system');
  const setTheme = t => { LS.set('vos7_theme', t); applyTheme(); toast('Tema aplicado.'); };
  const retAuto = retentionAuto(db);
  return html`<div>
    <${PageH} t="Configurações" s="Produtos, canais, equipe e parâmetros usados nos cálculos."/>
    <div class="mb16"><${Seg} v=${tab} on=${setTab} opts=${[{ v: 'geral', l: 'Geral' }, { v: 'produtos', l: 'Produtos' }, { v: 'canais', l: 'Canais' }, { v: 'equipe', l: 'Equipe' }, { v: 'despesas', l: 'Categorias' }, { v: 'asaas', l: 'Asaas e exterior' }, { v: 'importar', l: 'Importar dados' }, { v: 'backup', l: 'Backup' }]}/></div>
    ${tab === 'geral' && html`<div class="grid g2" style=${{ alignItems: 'start' }}>
      <div class="card"><div class="card-h"><h3>Financeiro</h3></div><div class="form c2">
        <${Select} cls="span3" label="Receita de projetos (ex: Consultoria 360 parcelada)" v=${S.projectRecognition} on=${v => set({ projectRecognition: v })} opts=${[{ v: 'venda', l: 'Inteira no mês da venda (recomendado)' }, { v: 'parcela', l: 'Conforme cada parcela vence' }]}/>
        <${Input} label="Dias de aviso prévio" type="number" v=${S.noticeDays} on=${v => set({ noticeDays: n0(v) })}/>
        <${Input} label="Taxa do cartão (%)" type="number" v=${S.cardFee} on=${v => set({ cardFee: n0(v) })}/>
        <${Input} label="Alíquota de imposto (%)" type="number" v=${S.taxRate} on=${v => set({ taxRate: n0(v) })}/>
        <${Field} label=" "><${Toggle} v=${S.taxAuto} on=${v => set({ taxAuto: v })} label="Estimar imposto sobre o caixa"/></${Field}>
        <div class="span3 xs faint">Se você já lança o DAS/impostos como despesa, deixe a estimativa desligada para não contar duas vezes.</div>
      </div></div>
      <div class="card"><div class="card-h"><h3>Unit economics</h3></div><div class="form c2">
        <${Input} label="Margem bruta média (%)" type="number" v=${S.grossMargin} on=${v => set({ grossMargin: n0(v) })} hint="Mensalidade − custo de entrega (equipe, ferramentas)"/>
        <${Input} label="Retenção média (meses)" type="number" v=${S.retentionMonths || ''} ph=${retAuto ? num(retAuto, 1) + ' (auto)' : '12 (padrão)'} on=${v => set({ retentionMonths: n0(v) })} hint=${retAuto ? 'Automático: ' + num(retAuto, 1) + ' meses pelos contratos encerrados. Deixe vazio para usar.' : 'Sem contratos encerrados ainda — usando 12.'}/>
      </div></div>
      <div class="card"><div class="card-h"><h3>Motivos de perda</h3></div>
        <${Textarea} v=${S.lossReasons.join('\n')} on=${v => set({ lossReasons: v.split('\n').map(x => x.trim()).filter(Boolean) })} rows=${7} hint="Um por linha"/></div>
      <div class="card"><div class="card-h"><h3>Aparência e acesso</h3></div>
        <${Field} label="Tema"><${Seg} v=${theme} on=${setTheme} opts=${[{ v: 'system', l: 'Automático' }, { v: 'light', l: 'Claro' }, { v: 'dark', l: 'Escuro' }]}/></${Field}>
        <div class="mt16"><${Btn} on=${() => { const p = prompt('Nova senha de acesso:'); if (!p) return; if (prompt('Confirme a senha:') !== p) return alert('As senhas não conferem.'); set({ password: p }); toast('Senha alterada.'); }}>Alterar senha</${Btn}></div>
        <div class="xs faint mt8">Enquanto não alterar, vale a mesma senha do Visions OS atual.</div>
      </div>
    </div>`}
    ${tab === 'produtos' && html`<div class="card"><div class="card-h"><h3>Produtos e preços de tabela</h3><span class="sub">usados para pré-preencher leads e vendas</span></div>
      <${ListEditor} items=${S.products} onChange=${v => set({ products: v })} newItem=${{ name: 'Novo produto', kind: 'recorrente', price: 0, setup: 0 }}
        cols=${[{ k: 'name', l: 'Nome', w: 220 }, { k: 'kind', l: 'Tipo', type: 'select', opts: [{ v: 'recorrente', l: 'Recorrente' }, { v: 'projeto', l: 'Projeto / único' }] }, { k: 'price', l: 'Preço (mensal ou total)', type: 'number' }, { k: 'setup', l: 'Setup', type: 'number' }]}/></div>`}
    ${tab === 'canais' && html`<div class="card"><div class="card-h"><h3>Canais de aquisição</h3><span class="sub">outbound aparece na prospecção diária</span></div>
      <${ListEditor} items=${S.channels} onChange=${v => set({ channels: v })} newItem=${{ name: 'Novo canal', kind: 'outbound' }}
        cols=${[{ k: 'name', l: 'Nome', w: 260 }, { k: 'kind', l: 'Tipo', type: 'select', opts: [{ v: 'outbound', l: 'Outbound (prospecção ativa)' }, { v: 'pago', l: 'Tráfego pago' }, { v: 'inbound', l: 'Inbound / orgânico' }, { v: 'indicacao', l: 'Indicação' }] }]}/></div>`}
    ${tab === 'equipe' && html`<div class="card"><div class="card-h"><h3>Equipe</h3><span class="sub">responsáveis pelos leads e pela prospecção</span></div>
      <${ListEditor} items=${S.team} onChange=${v => set({ team: v })} newItem=${{ name: 'Nome', role: '' }} cols=${[{ k: 'name', l: 'Nome', w: 200 }, { k: 'role', l: 'Função', w: 200 }]}/></div>`}
    ${tab === 'despesas' && html`<div class="card"><div class="card-h"><h3>Categorias de despesa</h3><span class="sub">marque as que entram no cálculo do CAC</span></div>
      <${ListEditor} items=${S.costCategories} onChange=${v => set({ costCategories: v })} newItem=${{ name: 'Nova categoria', cac: false }} cols=${[{ k: 'name', l: 'Nome', w: 280 }, { k: 'cac', l: 'Entra no CAC', type: 'bool', w: 90 }]}/></div>`}
    ${tab === 'asaas' && html`<${AsaasSettings}/>`}
    ${tab === 'importar' && html`<${ImportV6}/>`}
    ${tab === 'backup' && html`<${BackupBox}/>`}
  </div>`;
}

/* ---------- importação do Visions OS atual (vos6) ---------- */
const V6_CANAL = { 'Indicação': 'indicacao', 'Instagram': 'ig_dm', 'WhatsApp': 'wpp', 'Google': 'google', 'LinkedIn': 'linkedin', 'Evento/Networking': 'eventos', 'Site': 'organico' };
const V6_STAGE = { novo: 'novo', qualificado: 'conexao', reuniao: 'agendada', proposta: 'proposta', negociacao: 'negociacao', ganho: 'ganho', perdido: 'perdido' };
const V6_COSTCAT = { fixo: 'outros', variavel: 'outros', investimento: 'marketing', imposto: 'impostos', outro: 'outros' };
const toArr = v => (Array.isArray(v) ? v : v && typeof v === 'object' ? Object.values(v) : []).filter(Boolean);
function guessProduct(service) {
  const s = (service || '').toLowerCase();
  if (s.includes('track')) return 'tracking';
  if (s.includes('consult')) return 'c360';
  if (s.includes('tráfego') || s.includes('trafego') || s.includes('ads')) return 'trafego';
  if (s.includes('site') || s.includes('landing')) return 'site';
  return 'conteudo';
}
function mapV6(src, opts) {
  const out = { clients: [], contracts: [], payments: [], costs: [], deals: [], goals: [], spend: [] };
  const firstOfMonth = ymNow() + '-01';
  const cts = toArr(src.contracts).filter(c => !c._deleted);
  const seenCl = {};
  cts.forEach(c => {
    const cid = 'v6c_' + cleanKey(c.clientId || c.clientName || c.id);
    if (!seenCl[cid]) { seenCl[cid] = 1; out.clients.push({ id: cid, name: c.clientName || 'Cliente', phone: c.telefone || '', email: c.email || '', document: c.cnpj || '', contact: c.nome || '', address: [c.endereco, c.cep].filter(Boolean).join(' · '), since: c.startDate || '' }); }
    const start = c.startDate || dstr(new Date(c.createdAt || Date.now()));
    const payDay = Number(c.payDay) || parseD(start).getDate();
    const base = { id: 'v6_' + cleanKey(c.id), clientId: cid, clientName: c.clientName || 'Cliente', productId: guessProduct(c.service), value: Number(c.value) || 0, startDate: start, method: 'pix', notes: c.service || '', importedFrom: 'v6' };
    let ct;
    if (c.tipo === 'unico') ct = Object.assign(base, { kind: 'projeto', installments: 1, firstDue: start });
    else {
      let endDate = '', noticeDate = '';
      if (c.status === 'aviso' && c.endDate) { noticeDate = c.endDate; endDate = addDays(c.endDate, 30); }
      if (c.status === 'inativo') { endDate = c.endDate || start; noticeDate = c.endDate || ''; }
      ct = Object.assign(base, { kind: 'recorrente', payDay, firstDue: dueIn(ymOf(start), payDay), endDate, noticeDate });
    }
    out.contracts.push(ct);
    if (opts.markPaid) invoicesOf(ct, {}, ymNow()).filter(i => i.due < firstOfMonth).forEach(i => out.payments.push({ id: i.id, contractId: ct.id, status: 'pago', paidAt: i.due, paidAmount: i.amount, note: 'importado (assumido pago)' }));
  });
  toArr(src.costs).forEach(c => {
    const rec = !!(c.recorrente || c.cat === 'fixo');
    out.costs.push({ id: 'v6_' + cleanKey(c.id), desc: c.desc || 'Despesa', amount: Number(c.value) || 0, category: V6_COSTCAT[c.cat] || 'outros', date: rec ? (c.startDate || c.date || today()) : (c.date || today()), recurring: rec, skip: toArr(c.skip), importedFrom: 'v6' });
  });
  toArr(src.leads).filter(l => !l._deleted).forEach(l => {
    const stage = V6_STAGE[l.stage] || 'novo'; const created = l.createdAt || stamp();
    const d = { id: 'v6_' + cleanKey(l.id), name: l.name || 'Lead', company: l.company || '', phone: l.phone || '', email: l.email || '', channelId: V6_CANAL[l.canal] || '', mrr: Number(l.value) || 0, setup: 0, ownerId: CURRENT_USER.id, createdAt: created, nextAction: l.nextAction || '', nextDate: l.nextActionDate || '', importedFrom: 'v6', history: [], activities: toArr(l.notes).map(n => ({ id: n.id || uid(), type: 'nota', text: n.text, at: n.ts || created })) };
    const hist = []; const ti = stage === 'perdido' ? 0 : stageIdx(stage);
    for (let i = 0; i <= ti; i++) hist.push({ s: STAGES[i].id, at: i === 0 ? created : (l.updatedAt || created) });
    if (stage === 'perdido') hist.push({ s: 'perdido', at: l.updatedAt || created });
    Object.assign(d, { stage, history: hist, stageAt: l.updatedAt || created });
    if (stage === 'ganho') d.wonAt = l.updatedAt || created;
    if (stage === 'perdido') { d.lostAt = l.updatedAt || created; d.lostReason = 'Outro'; }
    out.deals.push(d);
  });
  toArr(src.metas).forEach(m => { if (!m.month) return; out.goals.push({ id: m.month, mrr: Number(m.mrrMeta) || '', newMrr: Number(m.novoMrrLiquido) || '', sales: Number(m.vendasBrutas) || '', invest: Number(m.investimentoTrafego) || '' }); });
  toArr(src.comercial).forEach(m => { if (!m.month || !Number(m.adSpend)) return; out.spend.push({ id: m.month, byCh: { meta: Number(m.adSpend) } }); });
  return out;
}
function ImportV6() {
  const [st, setSt] = useState('idle'); const [res, setRes] = useState(null); const [markPaid, setMarkPaid] = useState(true); const [err, setErr] = useState('');
  const fetchV6 = async () => {
    setSt('loading'); setErr('');
    try {
      const keys = { contracts: 'vos6_contracts', costs: 'vos6_costs', leads: 'vos6_leads_comercial', metas: 'vos6_metas', comercial: 'vos6_comercial' };
      const src = {}; for (const [k, v] of Object.entries(keys)) src[k] = await fbGet(v);
      setRes(mapV6(src, { markPaid })); setSt('ready');
    } catch (e) { setErr('Não consegui ler o banco do Visions OS atual (' + e.message + '). Use a opção de arquivo de backup abaixo.'); setSt('idle'); }
  };
  const fromFile = async e => {
    const file = e.target.files[0]; if (!file) return;
    try {
      const j = JSON.parse(await file.text());
      const pick = k => j[k] ?? j['vos6_' + k];
      setRes(mapV6({ contracts: pick('contracts'), costs: pick('costs'), leads: j.vos6_leads_comercial || j.leads_comercial, metas: pick('metas'), comercial: pick('comercial') }, { markPaid })); setSt('ready');
    } catch (x) { setErr('Arquivo inválido: ' + x.message); }
  };
  const apply = () => {
    Object.entries(res).forEach(([coll, list]) => list.forEach(o => store.restore(coll, Object.assign({ createdAt: stamp(), updatedAt: stamp() }, o))));
    toast('Importação concluída!'); setSt('done');
  };
  return html`<div class="card" style=${{ maxWidth: 760 }}>
    <div class="card-h"><h3>Importar do Visions OS atual</h3></div>
    <p class="muted" style=${{ marginTop: 0 }}>Traz <b>contratos, despesas, leads comerciais, metas e investimento em tráfego</b> do sistema antigo. O sistema antigo <b>não é alterado</b> (só leitura) e pode continuar sendo usado para produção de conteúdo e portal do cliente. Pode repetir a importação: os mesmos itens são atualizados, sem duplicar.</p>
    <${Toggle} v=${markPaid} on=${setMarkPaid} label="Considerar pagas as mensalidades anteriores a este mês (o sistema antigo não registrava pagamentos)"/>
    <div class="row wrap mt16"><${Btn} v="pri" icon="cloud" on=${fetchV6} disabled=${st === 'loading'}>${st === 'loading' ? 'Lendo…' : 'Ler dados do banco atual'}</${Btn}>
      <label class="btn"><${Icon} n="file" s=${15}/>Usar arquivo de backup (.json)<input type="file" accept=".json" style=${{ display: 'none' }} onChange=${fromFile}/></label></div>
    ${err && html`<div class="callout bad mt12">${err}</div>`}
    ${res && st !== 'done' && html`<div class="callout info mt16"><b class="t">Pronto para importar</b>
      ${res.contracts.length} contratos (${res.clients.length} clientes) · ${res.payments.length} mensalidades antigas marcadas como pagas · ${res.costs.length} despesas · ${res.deals.length} leads · ${res.goals.length} meses de metas · ${res.spend.length} meses de investimento em tráfego.
      <div class="xs mt8">Confira depois: o produto de cada contrato foi deduzido pelo nome do serviço, e despesas antigas entram na categoria "Outros".</div>
      <div class="mt12"><${Btn} v="pri" on=${apply}>Importar agora</${Btn}></div></div>`}
    ${st === 'done' && html`<div class="callout good mt16"><b class="t">Importado.</b>Revise Contratos (produto e forma de pagamento) e as categorias das Despesas.</div>`}
  </div>`;
}
function BackupBox() {
  const exp = () => {
    const blob = new Blob([JSON.stringify(Object.assign({ exportedAt: stamp(), app: 'visions-os-2' }, store.data), null, 1)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'visions-os-backup-' + today() + '.json'; a.click();
  };
  const imp = async e => {
    const f = e.target.files[0]; if (!f) return;
    try { const j = JSON.parse(await f.text()); if (j.app !== 'visions-os-2') return alert('Este arquivo não é um backup do Visions OS 2. Para dados do sistema antigo use "Importar dados".'); if (!confirm('Substituir TODOS os dados atuais pelo backup?')) return; delete j.app; delete j.exportedAt; store.replaceAll(j); toast('Backup restaurado.'); } catch (x) { alert('Arquivo inválido.'); }
  };
  return html`<div class="card" style=${{ maxWidth: 640 }}><div class="card-h"><h3>Backup</h3></div>
    <p class="muted" style=${{ marginTop: 0 }}>Os dados ficam no banco da Visions (Firebase) e com uma cópia no navegador para funcionar sem internet. Baixe um backup de vez em quando.</p>
    <div class="row wrap"><${Btn} v="pri" icon="down" on=${exp}>Baixar backup (.json)</${Btn}><label class="btn"><${Icon} n="up" s=${15}/>Restaurar backup<input type="file" accept=".json" style=${{ display: 'none' }} onChange=${imp}/></label></div>
    <div class="xs faint mt12">Modo de armazenamento: <b>${MODE === 'local' ? 'somente neste navegador (teste)' : 'nuvem (Firebase) + cópia local'}</b>${store.pending ? ' · ' + store.pending + ' alterações aguardando envio' : ''}</div></div>`;
}

/* ---------- busca rápida (Ctrl+K) ---------- */
function Palette({ onClose, nav, pages }) {
  const db = useDB(); const [q, setQ] = useState(''); const [sel, setSel] = useState(0);
  const ql = q.toLowerCase();
  const actions = [
    { l: '➕ Novo lead', f: () => nav.newDeal() }, { l: '💰 Nova venda / contrato', f: () => nav.newContract() },
    { l: '💸 Nova despesa', f: () => nav.newCost() }, { l: '🎯 Registrar prospecção', f: () => nav.go('prospeccao') }
  ];
  let items = [];
  items = items.concat(actions.filter(a => !q || a.l.toLowerCase().includes(ql)).map(a => ({ k: 'a' + a.l, l: a.l, s: 'Ação', f: a.f })));
  items = items.concat(pages.filter(p => !q || p.l.toLowerCase().includes(ql)).map(p => ({ k: 'p' + p.id, l: p.l, s: 'Página', f: () => nav.go(p.id) })));
  if (q.length > 1) {
    items = items.concat(vals(db.deals).filter(d => (d.name + ' ' + (d.company || '') + ' ' + (d.phone || '')).toLowerCase().includes(ql)).slice(0, 8).map(d => ({ k: 'd' + d.id, l: d.name + (d.company ? ' · ' + d.company : ''), s: 'Lead · ' + stageOf(d.stage).l, f: () => nav.deal(d.id) })));
    items = items.concat(vals(db.contracts).filter(c => (c.clientName || '').toLowerCase().includes(ql)).slice(0, 6).map(c => ({ k: 'c' + c.id, l: c.clientName + ' — ' + prodName(db.S, c.productId), s: 'Contrato', f: () => nav.contract(c.id) })));
  }
  const run = it => { onClose(); setTimeout(it.f, 0); };
  const key = e => { if (e.key === 'ArrowDown') { e.preventDefault(); setSel(s => Math.min(items.length - 1, s + 1)); } if (e.key === 'ArrowUp') { e.preventDefault(); setSel(s => Math.max(0, s - 1)); } if (e.key === 'Enter' && items[sel]) run(items[sel]); if (e.key === 'Escape') onClose(); };
  return html`<div class="ov" onMouseDown=${e => e.target === e.currentTarget && onClose()}><div class="mdl pal">
    <input autoFocus placeholder="Buscar lead, cliente, página ou ação…" value=${q} onChange=${e => { setQ(e.target.value); setSel(0); }} onKeyDown=${key}/>
    <div class="res">${items.map((it, i) => html`<button key=${it.k} class=${i === sel ? 'sel' : ''} onMouseEnter=${() => setSel(i)} onClick=${() => run(it)}><span style=${{ flex: 1 }}>${it.l}</span><span class="xs faint">${it.s}</span></button>`)}
      ${!items.length && html`<div class="empty">Nada encontrado.</div>`}</div></div></div>`;
}

/* ---------- login ---------- */
function Login({ onOk }) {
  const db = useDB();
  const [pwd, setPwd] = useState(''); const [who, setWho] = useState(LS.get('vos7_lastuser', db.S.team[0].id)); const [err, setErr] = useState(''); const [ld, setLd] = useState(false);
  const go = async () => {
    setLd(true); setErr('');
    let ok = false;
    const custom = db.S.password;
    if (custom) ok = pwd === custom;
    else {
      let old = null; if (MODE === 'remote') { try { old = await fbGet('vos6_pwd'); } catch (e) { /* offline */ } }
      ok = pwd === (typeof old === 'string' && old ? old : 'visions2025');
    }
    setLd(false);
    if (!ok) return setErr('Senha incorreta.');
    LS.set('vos7_lastuser', who); LS.set('vos7_session', { user: who, at: stamp() }); onOk(who);
  };
  return html`<div class="login"><div class="card">
    <div style=${{ background: '#fff', borderRadius: 12, padding: 10, display: 'flex', justifyContent: 'center', marginBottom: 18 }}><img src=${window.VOS_LOGO} alt="Visions Marketing" style=${{ height: 48 }}/></div>
    <h2 class="display" style=${{ fontSize: 22, textAlign: 'center' }}>Visions OS</h2>
    <p class="muted small" style=${{ textAlign: 'center', marginTop: 4 }}>Comercial · Financeiro · Metas</p>
    <div class="form mt16">
      <${Select} label="Quem é você?" v=${who} on=${setWho} opts=${db.S.team.map(t => ({ v: t.id, l: t.name }))}/>
      <${Input} label="Senha" type="password" v=${pwd} on=${setPwd} onEnter=${go} autoFocus=${true}/>
      ${err && html`<div class="callout bad">${err}</div>`}
      <${Btn} v="pri" on=${go} disabled=${ld}>${ld ? 'Entrando…' : 'Entrar'}</${Btn}>
      ${MODE === 'local' && html`<div class="xs faint">Modo de teste local: dados ficam só neste navegador. Senha padrão: visions2025.</div>`}
    </div></div></div>`;
}

/* ---------- app shell ---------- */
const PAGES = [
  { id: 'hoje', l: 'Hoje', icon: 'home', g: '' },
  { id: 'pipeline', l: 'Pipeline', icon: 'kanban', g: 'Comercial' },
  { id: 'followups', l: 'Follow-ups', icon: 'bell', g: 'Comercial' },
  { id: 'prospeccao', l: 'Prospecção', icon: 'target', g: 'Comercial' },
  { id: 'cadencias', l: 'Cadências', icon: 'repeat', g: 'Comercial' },
  { id: 'analise', l: 'Análise comercial', icon: 'chart', g: 'Comercial' },
  { id: 'financeiro', l: 'Visão geral', icon: 'wallet', g: 'Financeiro' },
  { id: 'recebiveis', l: 'Recebíveis', icon: 'inbox', g: 'Financeiro' },
  { id: 'cobrancas', l: 'Cobranças', icon: 'alert', g: 'Financeiro' },
  { id: 'contratos', l: 'Contratos', icon: 'file', g: 'Financeiro' },
  { id: 'despesas', l: 'Despesas', icon: 'down', g: 'Financeiro' },
  { id: 'clientes', l: 'Carteira de clientes', icon: 'users', g: 'Clientes' },
  { id: 'performance', l: 'Painel semanal', icon: 'chart', g: 'Clientes' },
  { id: 'metas', l: 'Metas do mês', icon: 'flag', g: 'Metas' },
  { id: 'calc_meta', l: 'Calc. metas & CAC', icon: 'calc', g: 'Metas' },
  { id: 'calc_prosp', l: 'Calc. prospecção', icon: 'calc', g: 'Metas' },
  { id: 'config', l: 'Configurações', icon: 'gear', g: 'Sistema' }
];
function applyTheme() {
  const t = LS.get('vos7_theme', 'system');
  if (t === 'system') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t);
}
function SyncBadge() {
  useStore();
  const st = store.status;
  const m = { online: ['var(--good)', 'Sincronizado'], syncing: ['var(--warn)', 'Sincronizando…'], loading: ['var(--warn)', 'Conectando…'], offline: ['var(--bad)', 'Offline — salvando local' + (store.pending ? ' (' + store.pending + ')' : '')], local: ['var(--info)', 'Modo teste (local)'] }[st] || ['var(--text-3)', st];
  return html`<span class="sync" title=${store.lastSync ? 'Última sincronização: ' + store.lastSync.toLocaleTimeString('pt-BR') : ''}><span class="dot" style=${{ background: m[0] }}/>${m[1]}</span>`;
}
function Shell({ onLogout }) {
  const db = useDB(); const S = db.S;
  const [page, setPage] = useState(() => { const h = location.hash.replace('#', ''); return PAGES.some(p => p.id === h) ? h : 'hoje'; });
  const [dealId, setDealId] = useState(null); const [ctId, setCtId] = useState(null);
  const [modal, setModal] = useState(null); const [pal, setPal] = useState(false); const [fab, setFab] = useState(false); const [menu, setMenu] = useState(false);
  useEffect(() => { const f = () => { const h = location.hash.replace('#', ''); if (PAGES.some(p => p.id === h)) setPage(h); }; window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f); }, []);
  const nav = {
    go: id => { setPage(id); location.hash = id; window.scrollTo(0, 0); setMenu(false); },
    deal: id => setDealId(id), contract: id => setCtId(id),
    newDeal: init => setModal({ t: 'deal', init }), newContract: init => setModal({ t: 'contract', init }), newCost: () => setModal({ t: 'cost' }),
    win: d => setModal({ t: 'win', d }), lose: d => setModal({ t: 'lose', d })
  };
  useEffect(() => {
    const k = e => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPal(true); return; }
      const tag = (e.target.tagName || '').toLowerCase(); if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.metaKey || e.ctrlKey || e.altKey) return;
      if (document.querySelector('.ov,.drawer')) return;
      if (e.key === 'n') { e.preventDefault(); nav.newDeal(); } else if (e.key === 'v') { e.preventDefault(); nav.newContract(); } else if (e.key === '/') { e.preventDefault(); setPal(true); }
    };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, []);
  const fu = followupBuckets(db, CURRENT_USER.id || null);
  const fuN = fu.atrasado.length + fu.hoje.length;
  const invNow = useMemo(() => allInvoices(db, addMonths(ymNow(), 1)), [db.contracts, db.payments, db.asaas, db.settings]);
  const lateN = invNow.filter(i => i.status === 'atrasado').length;
  const issN = useMemo(() => reconcile(db, invNow).filter(x => x.type !== 'atrasada' && ISSUE_TYPES[x.type].t !== 'info').length, [invNow]);
  const badge = { followups: fuN ? [fuN, fu.atrasado.length > 0] : null, recebiveis: lateN ? [lateN, true] : null, cobrancas: issN ? [issN, true] : null };
  const cur = PAGES.find(p => p.id === page) || PAGES[0];
  const P = { hoje: HomePage, pipeline: PipelinePage, followups: FollowupsPage, prospeccao: ProspectPage, cadencias: CadencesPage, analise: AnalyticsPage, financeiro: FinancePage, recebiveis: ReceivablesPage, cobrancas: CobrancasPage, performance: PerformancePage, contratos: ContractsPage, despesas: CostsPage, clientes: ClientsPage, metas: GoalsPage, calc_meta: CalcGoalPage, calc_prosp: CalcProspPage, config: SettingsPage }[page];
  let lastG = null;
  const NavItems = () => PAGES.map(p => {
    const head = p.g !== lastG && p.g ? html`<div class="grp" key=${'g' + p.g}>${p.g}</div>` : null; lastG = p.g;
    const b = badge[p.id];
    return html`<${Fragment} key=${p.id}>${head}<button class=${'it' + (page === p.id ? ' on' : '')} onClick=${() => nav.go(p.id)}><${Icon} n=${p.icon} s=${17}/>${p.l}${b && html`<span class=${'bd' + (b[1] ? ' hot' : '')}>${b[0]}</span>`}</button></${Fragment}>`;
  });
  return html`<div class="shell">
    <aside class="side">
      <div class="brand"><img src=${window.VOS_LOGO} alt="Visions Marketing"/></div>
      <div class="tagline">Visions OS · Performance</div>
      <${NavItems}/>
      <div class="foot"><${SyncBadge}/><div class="row between"><span>👤 ${CURRENT_USER.name}</span><button class="btn ghost xs" onClick=${onLogout}><${Icon} n="logout" s=${14}/>Sair</button></div></div>
    </aside>
    <main class="main">
      <div class="top">
        <span class="ttl">${cur.l}</span><span class="sp"/>
        <button class="search-btn" onClick=${() => setPal(true)}><${Icon} n="search" s=${16}/><span class="t">Buscar ou criar…</span><kbd>Ctrl K</kbd></button>
        <${Btn} v="pri" icon="plus" on=${() => nav.newDeal()} title="Novo lead (N)"><span class="hide-sm">Lead</span></${Btn}>
      </div>
      <div class="content"><${P} nav=${nav}/></div>
    </main>
    <button class="fab" onClick=${() => setFab(!fab)} aria-label="Ações rápidas"><${Icon} n=${fab ? 'x' : 'plus'} s=${24}/></button>
    ${fab && html`<div class="fab-menu" onClick=${() => setFab(false)}>
      <button onClick=${() => nav.newDeal()}>👤 Novo lead<kbd class="k">N</kbd></button>
      <button onClick=${() => nav.go('prospeccao')}>🎯 Registrar prospecção</button>
      <button onClick=${() => nav.newContract()}>💰 Nova venda<kbd class="k">V</kbd></button>
      <button onClick=${() => nav.go('recebiveis')}>✅ Dar baixa em recebimento</button>
      <button onClick=${() => nav.newCost()}>💸 Nova despesa</button></div>`}
    <nav class="mobile-nav">${[['hoje', 'home', 'Hoje'], ['pipeline', 'kanban', 'Pipeline'], ['followups', 'bell', 'Follow-ups'], ['financeiro', 'wallet', 'Financeiro']].map(([id, ic, l]) => html`<button key=${id} class=${page === id ? 'on' : ''} onClick=${() => nav.go(id)}><${Icon} n=${ic} s=${20}/>${l}</button>`)}
      <button onClick=${() => setMenu(true)}><${Icon} n="list" s=${20}/>Menu</button></nav>
    ${menu && html`<${Modal} title="Menu" onClose=${() => setMenu(false)}><div class="col">${PAGES.map(p => html`<${Btn} key=${p.id} v=${page === p.id ? 'pri' : ''} icon=${p.icon} on=${() => nav.go(p.id)}>${p.l}</${Btn}>`)}<div class="row between mt12"><${SyncBadge}/><${Btn} sz="sm" icon="logout" on=${onLogout}>Sair</${Btn}></div></div></${Modal}>`}
    ${dealId && html`<${DealDrawer} id=${dealId} onClose=${() => setDealId(null)} openWin=${d => nav.win(d)}/>`}
    ${ctId && html`<${ContractDrawer} id=${ctId} onClose=${() => setCtId(null)}/>`}
    ${modal && modal.t === 'deal' && html`<${DealForm} deal=${modal.init} onClose=${() => setModal(null)} onSaved=${d => setDealId(d.id)}/>`}
    ${modal && modal.t === 'contract' && html`<${ContractForm} init=${modal.init} onClose=${() => setModal(null)}/>`}
    ${modal && modal.t === 'cost' && html`<${CostForm} onClose=${() => setModal(null)}/>`}
    ${modal && modal.t === 'lose' && html`<${LoseModal} deal=${modal.d} onClose=${() => setModal(null)}/>`}
    ${modal && modal.t === 'win' && html`<${ContractForm} deal=${modal.d} onClose=${() => setModal(null)} init=${(() => { const d = modal.d; const pr = prodOf(S, d.productId) || S.products[0]; return { productId: pr.id, kind: pr.kind, value: d.mrr || pr.price, setupValue: d.setup || '', clientName: d.company || d.name, channelId: d.channelId, ownerId: d.ownerId || CURRENT_USER.id, phone: d.phone, email: d.email, _typing: true }; })()}/>`}
    ${pal && html`<${Palette} onClose=${() => setPal(false)} nav=${nav} pages=${PAGES}/>`}
    <${Toasts}/><${TipLayer}/>
  </div>`;
}
function App() {
  const db = useDB();
  const [user, setUser] = useState(() => { const s = LS.get('vos7_session', null); return s && s.user ? s.user : null; });
  const [ready, setReady] = useState(MODE === 'local' || !!store.data.settings || vals(store.data.deals).length > 0);
  useEffect(() => {
    store.load().then(() => setReady(true));
    const iv = setInterval(() => { if (document.visibilityState === 'visible' && MODE === 'remote') { if (store.pending) store.flush(); else store.load(); } }, 45000);
    return () => clearInterval(iv);
  }, []);
  // semente: cadências padrão (ids fixos = idempotente)
  useEffect(() => {
    if (!ready || store.status === 'offline' || store.status === 'loading') return;
    if (!db.S.seeded) {
      if (!vals(store.data.cadences).length) DEFAULT_CADENCES.forEach(c => store.restore('cadences', Object.assign({ createdAt: stamp(), updatedAt: stamp() }, c)));
      store.setSettings({ seeded: true });
    }
  }, [ready, store.status]);
  if (!ready) return html`<div class="boot">Conectando ao banco da Visions…</div>`;
  const member = user && db.S.team.find(t => t.id === user);
  if (!member) return html`<${Fragment}><${Login} onOk=${setUser}/><${Toasts}/></${Fragment}>`;
  CURRENT_USER = member;
  return html`<${Shell} onLogout=${() => { LS.set('vos7_session', null); setUser(null); }}/>`;
}

applyTheme();
ReactDOM.createRoot(document.getElementById('root')).render(html`<${App}/>`);
