/* ============================================================
   MARKETING VISIONS — performance do nosso tráfego e dos nossos posts
   Coleções: vos7_mkposts (posts das nossas redes) e vos7_mkads
   (campanhas de tráfego da Visions, por semana). O investimento lançado
   aqui alimenta o CAC do Comercial quando o mês não tem valor manual.
   ============================================================ */
const MK_FORMATS = [{ v: 'reels', l: 'Reels' }, { v: 'carrossel', l: 'Carrossel' }, { v: 'estatico', l: 'Estático' }, { v: 'story', l: 'Story' }, { v: 'video', l: 'Vídeo longo' }];
const MK_PILLARS = ['Educativo', 'Autoridade', 'Prova social / case', 'Bastidores', 'Oferta / venda', 'Opinião / polêmica', 'Entretenimento'];
const MK_PLATS = ['Instagram', 'TikTok', 'LinkedIn', 'YouTube'];
const fmtName = v => (MK_FORMATS.find(f => f.v === v) || {}).l || v || '—';
const WD = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

/* ---------- métricas de post ---------- */
function mkPostCalc(p) {
  const reach = n0(p.reach), views = n0(p.views);
  const eng = n0(p.likes) + n0(p.comments) + n0(p.shares) + n0(p.saves);
  const base = reach || views;
  return { ...p, reach, views, eng, engRate: base ? eng / base : NaN, keepRate: base ? (n0(p.saves) + n0(p.shares)) / base : NaN, follows: n0(p.follows), leads: n0(p.leads), base };
}
/* índice de desempenho: 100 = média do período (alcance, engajamento, salvar+compartilhar, seguidores+leads) */
function mkScore(list) {
  const avg = f => { const v = list.map(f).filter(Number.isFinite); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN; };
  const aR = avg(p => p.base), aE = avg(p => p.engRate), aK = avg(p => p.keepRate), aC = avg(p => p.follows + p.leads * 3);
  const r = (v, a) => (Number.isFinite(v) && a > 0 ? Math.min(v / a, 4) : null);
  return list.map(p => { const parts = [r(p.base, aR), r(p.engRate, aE), r(p.keepRate, aK), r(p.follows + p.leads * 3, aC)].filter(x => x != null); return { ...p, score: parts.length ? Math.round(parts.reduce((a, b) => a + b, 0) / parts.length * 100) : null }; });
}
function mkGroup(list, key) {
  const g = groupBy(list, key);
  return Object.entries(g).map(([k, ps]) => ({
    k, n: ps.length, reach: sum(ps, p => p.base) / ps.length, engRate: sum(ps, p => p.eng) / (sum(ps, p => p.base) || 1),
    keep: sum(ps, p => n0(p.saves) + n0(p.shares)) / ps.length, follows: sum(ps, p => p.follows), leads: sum(ps, p => p.leads),
    score: Math.round(sum(ps.filter(p => p.score != null), p => p.score) / (ps.filter(p => p.score != null).length || 1))
  })).sort((a, b) => b.score - a.score);
}
function mkPostInsights(list, byFmt, byPil, byDay) {
  const out = [];
  if (list.length < 4) { out.push({ t: 'info', m: 'Registre pelo menos 4 posts no período para o sistema começar a comparar formatos, pilares e dias.' }); return out; }
  const best = arr => arr.filter(x => x.n >= 2)[0], worst = arr => arr.filter(x => x.n >= 2).slice(-1)[0];
  const bf = best(byFmt), wf = worst(byFmt);
  if (bf && wf && bf.k !== wf.k) out.push({ t: 'good', m: `${bf.l} é o formato que mais performa (índice ${bf.score}, ${bf.n} posts). ${wf.l} está abaixo (índice ${wf.score}). Teste fazer mais ${bf.l.toLowerCase()}.` });
  const bp = best(byPil), wp = worst(byPil);
  if (bp) out.push({ t: 'good', m: `O pilar "${bp.k}" é o que mais funciona agora (índice ${bp.score}${bp.leads ? ', ' + bp.leads + ' lead(s)' : ''}).` });
  if (wp && bp && wp.k !== bp.k) out.push({ t: 'warn', m: `O pilar "${wp.k}" está com o pior resultado (índice ${wp.score}). Revise o gancho ou o formato desse tipo de conteúdo.` });
  const lp = byPil.filter(x => x.leads > 0 && x.n >= 2).sort((a, b) => b.leads / b.n - a.leads / a.n)[0];
  if (lp && (!bp || lp.k !== bp.k)) out.push({ t: 'good', m: `Para gerar leads, o pilar "${lp.k}" é o melhor: ${num(lp.leads / lp.n, 1)} lead(s) por post.` });
  const bd = best(byDay);
  if (bd) out.push({ t: 'info', m: `Melhor dia para postar até aqui: ${bd.k} (índice ${bd.score}).` });
  const kAvg = sum(list, p => n0(p.saves) + n0(p.shares)) / (sum(list, p => p.base) || 1);
  if (kAvg < 0.01) out.push({ t: 'warn', m: `Poucos salvamentos e compartilhamentos (${pct(kAvg * 100, 1)} do alcance). Conteúdos mais práticos (checklists, passo a passo) costumam aumentar isso.` });
  return out;
}

function MarketingPage({ nav }) {
  const [tab, setTab] = useState(LS.get('vos7_mktab', 'posts'));
  useEffect(() => LS.set('vos7_mktab', tab), [tab]);
  return html`<div>
    <div class="page-h"><div><h1>Marketing Visions</h1><p class="sub">Performance das nossas redes sociais e do nosso tráfego pago, para ver o que funciona e melhorar o conteúdo.</p></div></div>
    <${Tabs} v=${tab} on=${setTab} opts=${[{ v: 'posts', l: 'Conteúdo (redes sociais)', icon: 'camera' }, { v: 'ads', l: 'Tráfego pago', icon: 'target' }]}/>
    ${tab === 'posts' ? html`<${MkPosts}/>` : html`<${MkAds} nav=${nav}/>`}
  </div>`;
}

/* ---------- conteúdo ---------- */
function MkPosts() {
  const db = useDB();
  const [period, setPeriod] = useState('90'); const [plat, setPlat] = useState(''); const [edit, setEdit] = useState(null); const [sort, setSort] = useState('date');
  const all = vals(db.mkposts).map(mkPostCalc);
  const from = period === 'all' ? '' : addDays(today(), -Number(period));
  const list = mkScore(all.filter(p => (!from || p.date >= from) && (!plat || p.platform === plat)));
  const byFmt = mkGroup(list, p => p.format).map(x => ({ ...x, l: fmtName(x.k) }));
  const byPil = mkGroup(list, p => p.pillar || 'Sem pilar');
  const byDay = mkGroup(list.filter(p => p.date), p => WD[parseD(p.date).getDay()]);
  const ins = mkPostInsights(list, byFmt, byPil, byDay);
  const top = list.filter(p => p.score != null).sort((a, b) => b.score - a.score);
  const sorted = list.slice().sort((a, b) => (sort === 'score' ? (b.score || 0) - (a.score || 0) : (b.date || '').localeCompare(a.date || '')));
  // série semanal (últimas 12 semanas)
  const weeks = Array.from({ length: 12 }, (_, i) => weekStart(addDays(today(), -7 * (11 - i))));
  const wk = weeks.map(w => { const ps = all.filter(p => p.date && weekStart(p.date) === w && (!plat || p.platform === plat)); return { w, n: ps.length, reach: sum(ps, p => p.base), follows: sum(ps, p => p.follows) }; });
  const last4 = wk.slice(-4).reduce((a, b) => a + b.n, 0);
  const tot = { reach: sum(list, p => p.base), eng: sum(list, p => p.eng), follows: sum(list, p => p.follows), leads: sum(list, p => p.leads), keep: sum(list, p => n0(p.saves) + n0(p.shares)) };
  const GroupTable = ({ rows, label }) => html`<div class="card flush"><div class="lgroup"><span>${label}</span></div><div class="tbl-wrap"><table class="tbl"><thead><tr><th></th><th class="r">Posts</th><th class="r">Alcance médio</th><th class="r">Engaj.</th><th class="r">Salv.+comp./post</th><th class="r">Seguidores</th><th class="r">Leads</th><th class="r">Índice</th></tr></thead>
    <tbody>${rows.map((r, i) => html`<tr key=${r.k}><td class="b">${r.l || r.k}</td><td class="r num">${r.n}</td><td class="r num">${num(r.reach)}</td><td class="r num">${pct(r.engRate * 100, 1)}</td><td class="r num">${num(r.keep, 1)}</td><td class="r num">${num(r.follows)}</td><td class="r num">${num(r.leads)}</td>
      <td class="r"><${Pill} c=${r.score >= 110 ? 'var(--good)' : r.score < 90 ? 'var(--bad)' : 'var(--text-3)'}>${r.score}</${Pill}></td></tr>`)}</tbody></table></div></div>`;
  return html`<div>
    <div class="row wrap mb16" style=${{ gap: 10 }}>
      <${Seg} v=${period} on=${setPeriod} opts=${[{ v: '30', l: '30 dias' }, { v: '90', l: '90 dias' }, { v: '180', l: '6 meses' }, { v: 'all', l: 'Tudo' }]}/>
      <${Seg} v=${plat} on=${setPlat} opts=${[{ v: '', l: 'Todas' }].concat(MK_PLATS.map(p => ({ v: p, l: p })))}/>
      <span style=${{ flex: 1 }}/>
      <${Btn} v="pri" icon="plus" on=${() => setEdit({})}>Registrar post</${Btn}>
    </div>
    <div class="grid g5 mb16">
      <${Kpi} l="Posts no período" v=${num(list.length)} s=${last4 + ' nas últimas 4 semanas'}/>
      <${Kpi} l="Alcance médio por post" v=${num(list.length ? tot.reach / list.length : 0)}/>
      <${Kpi} l="Engajamento" v=${pct(tot.reach ? tot.eng / tot.reach * 100 : 0, 1)} s="curtidas, coment., salv. e compart. ÷ alcance"/>
      <${Kpi} l="Seguidores ganhos" v=${num(tot.follows)} tone="good"/>
      <${Kpi} l="Leads / DMs gerados" v=${num(tot.leads)} tone=${tot.leads ? 'good' : ''}/>
    </div>
    ${ins.length > 0 && html`<div class="card mb16"><div class="card-h"><h3>O que os números estão dizendo</h3><span class="sub">o índice 100 é a média do período</span></div>
      <div class="col" style=${{ gap: 8 }}>${ins.map((x, i) => html`<div key=${i} class=${'callout ' + x.t}><${Icon} n=${x.t === 'good' ? 'up' : x.t === 'warn' ? 'alert' : 'zap'} s=${16}/><div>${x.m}</div></div>`)}</div></div>`}
    <div class="grid g-side mb16">
      <div class="card"><div class="card-h"><h3>Alcance por semana</h3><span class="sub">últimas 12 semanas</span></div>
        <${BarChart} labels=${wk.map(w => fdate(w.w).slice(0, 5))} series=${[{ name: 'Alcance', data: wk.map(w => w.reach), color: 'var(--s1)' }]} highlight=${11}/></div>
      <div class="card flush"><div class="lgroup"><span>Melhores posts do período</span></div>
        ${top.slice(0, 5).map((p, i) => html`<div class="lrow" key=${p.id} style=${{ cursor: 'pointer' }} onClick=${() => setEdit(p)}>
          <b class="num" style=${{ width: 18, color: 'var(--text-3)' }}>${i + 1}</b>
          <div style=${{ flex: 1, minWidth: 0 }}><div class="main-t ellipsis">${p.title || p.hook || '(sem tema)'}</div><div class="meta"><span>${fmtName(p.format)}</span><i class="sep"/><span>${p.pillar || '—'}</span><i class="sep"/><span>${num(p.base)} alcance</span></div></div>
          <${Pill} c="var(--good)">${p.score}</${Pill}></div>`)}
        ${!top.length && html`<${Empty} t="Nenhum post registrado" s=""/>`}</div>
    </div>
    ${list.length > 0 && html`<div class="grid g2 mb16"><${GroupTable} rows=${byFmt} label="Por formato"/><${GroupTable} rows=${byPil} label="Por pilar de conteúdo"/></div>`}
    <div class="card flush">
      <div class="lgroup"><span class="row" style=${{ gap: 10 }}>Todos os posts <${Seg} v=${sort} on=${setSort} opts=${[{ v: 'date', l: 'Recentes' }, { v: 'score', l: 'Melhor índice' }]}/></span><span>${list.length}</span></div>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Data</th><th>Post</th><th>Formato</th><th>Pilar</th><th class="r">Alcance</th><th class="r">Engaj.</th><th class="r">Salv.</th><th class="r">Comp.</th><th class="r">Seg.</th><th class="r">Leads</th><th class="r">Índice</th></tr></thead>
        <tbody>${sorted.map(p => html`<tr key=${p.id} class="click" onClick=${() => setEdit(p)}>
          <td class="num">${p.date ? fdate(p.date) : '—'}</td><td style=${{ maxWidth: 320 }}><div class="ellipsis b">${p.title || '(sem tema)'}</div>${p.hook && html`<div class="xs faint ellipsis">"${p.hook}"</div>`}</td>
          <td>${fmtName(p.format)}</td><td class="small">${p.pillar || '—'}</td><td class="r num">${num(p.base)}</td><td class="r num">${Number.isFinite(p.engRate) ? pct(p.engRate * 100, 1) : '—'}</td>
          <td class="r num">${num(n0(p.saves))}</td><td class="r num">${num(n0(p.shares))}</td><td class="r num">${num(p.follows)}</td><td class="r num">${num(p.leads)}</td>
          <td class="r">${p.score != null ? html`<${Pill} c=${p.score >= 110 ? 'var(--good)' : p.score < 90 ? 'var(--bad)' : 'var(--text-3)'}>${p.score}</${Pill}>` : '—'}</td></tr>`)}</tbody></table></div>
      ${!list.length && html`<${Empty} t="Nenhum post registrado ainda" s="Registre cada post uns 7 dias depois de publicado, com os números do Instagram (Insights do post)."/>`}
    </div>
    ${edit && html`<${MkPostForm} p=${edit} onClose=${() => setEdit(null)}/>`}
  </div>`;
}
function MkPostForm({ p, onClose }) {
  const [f, setF] = useState(() => Object.assign({ date: today(), platform: 'Instagram', format: 'reels', pillar: MK_PILLARS[0], title: '', hook: '', cta: '', link: '', reach: '', views: '', likes: '', comments: '', shares: '', saves: '', follows: '', profileVisits: '', linkClicks: '', leads: '', notes: '' }, p));
  const F = k => v => setF(x => ({ ...x, [k]: v }));
  const c = mkPostCalc(f);
  const save = () => { if (!f.title.trim() && !f.hook.trim()) return toast('Escreva o tema ou o gancho do post.'); const o = { ...f }; ['reach', 'views', 'likes', 'comments', 'shares', 'saves', 'follows', 'profileVisits', 'linkClicks', 'leads'].forEach(k => (o[k] = o[k] === '' ? '' : n0(o[k]))); store.put('mkposts', { ...o, id: o.id || uid(), by: o.by || CURRENT_USER.name || '', updatedAt: stamp() }); toast('Post salvo.'); onClose(); };
  const N = (k, l) => html`<${Input} label=${l} type="number" v=${f[k]} on=${F(k)}/>`;
  return html`<${Modal} size="lg" title=${p.id ? 'Editar post' : 'Registrar post'} onClose=${onClose} footer=${html`${p.id && html`<${Btn} v="ghost" cls="danger" icon="trash" on=${() => { delWithUndo('mkposts', p.id, 'Post'); onClose(); }}>Excluir</${Btn}>`}<span style=${{ flex: 1 }}/><${Btn} on=${onClose}>Cancelar</${Btn}><${Btn} v="pri" on=${save}>Salvar</${Btn}>`}>
    <div class="form c3">
      <${Input} label="Data da publicação" type="date" v=${f.date} on=${F('date')}/>
      <${Select} label="Rede" v=${f.platform} on=${F('platform')} opts=${MK_PLATS.map(x => ({ v: x, l: x }))}/>
      <${Select} label="Formato" v=${f.format} on=${F('format')} opts=${MK_FORMATS}/>
      <${Input} cls="span2" label="Tema do post" v=${f.title} on=${F('title')} ph="Ex: 3 erros que fazem seu tráfego não vender"/>
      <${Select} label="Pilar" v=${f.pillar} on=${F('pillar')} opts=${MK_PILLARS.map(x => ({ v: x, l: x }))}/>
      <${Input} cls="span3" label="Gancho (primeira frase / capa)" v=${f.hook} on=${F('hook')} ph="O que aparece nos primeiros 3 segundos"/>
      <${Input} label="Chamada (CTA)" v=${f.cta} on=${F('cta')} ph="Ex: comenta EU QUERO"/>
      <${Input} cls="span2" label="Link do post" v=${f.link} on=${F('link')} ph="https://instagram.com/p/…"/>
    </div>
    <div class="hr"/>
    <div class="xs b faint mb8">NÚMEROS (Insights do post, de preferência 7 dias depois)</div>
    <div class="form c3" style=${{ gridTemplateColumns: 'repeat(5,minmax(0,1fr))' }}>
      ${N('reach', 'Alcance')}${N('views', 'Visualizações')}${N('likes', 'Curtidas')}${N('comments', 'Comentários')}${N('shares', 'Compartilhamentos')}
      ${N('saves', 'Salvamentos')}${N('follows', 'Seguidores ganhos')}${N('profileVisits', 'Visitas ao perfil')}${N('linkClicks', 'Cliques no link')}${N('leads', 'Leads / DMs')}
    </div>
    <div class="row wrap mt12" style=${{ gap: 8 }}><${Pill} c="var(--s1)">Engajamento ${Number.isFinite(c.engRate) ? pct(c.engRate * 100, 1) : '—'}</${Pill}><${Pill} c="var(--s3)">Salvar + compartilhar ${Number.isFinite(c.keepRate) ? pct(c.keepRate * 100, 1) : '—'}</${Pill}></div>
    <${Textarea} cls="mt12" label="Aprendizado / observações" v=${f.notes} on=${F('notes')} rows=${2} ph="O que você acha que fez esse post ir bem ou mal?"/>
  </${Modal}>`;
}

/* ---------- tráfego pago da Visions ---------- */
const adsCalc = a => ({ ...a, spend: n0(a.spend), impressions: n0(a.impressions), clicks: n0(a.clicks), leads: n0(a.leads), meetings: n0(a.meetings), sales: n0(a.sales), revenue: n0(a.revenue) });
function adsAgg(list) {
  const t = { spend: sum(list, a => a.spend), impressions: sum(list, a => a.impressions), clicks: sum(list, a => a.clicks), leads: sum(list, a => a.leads), meetings: sum(list, a => a.meetings), sales: sum(list, a => a.sales), revenue: sum(list, a => a.revenue) };
  return { ...t, ctr: t.impressions ? t.clicks / t.impressions : NaN, cpc: t.clicks ? t.spend / t.clicks : NaN, cpl: t.leads ? t.spend / t.leads : NaN, cpm: t.impressions ? t.spend / t.impressions * 1000 : NaN, cpr: t.meetings ? t.spend / t.meetings : NaN, cac: t.sales ? t.spend / t.sales : NaN, conv: t.clicks ? t.leads / t.clicks : NaN };
}
const mf = v => (Number.isFinite(v) ? money2(v) : '—');
function MkAds({ nav }) {
  const db = useDB();
  const [ym, setYm] = useState(ymNow()); const [edit, setEdit] = useState(null);
  const all = vals(db.mkads).map(adsCalc);
  const list = all.filter(a => a.date && ymOf(a.date) === ym);
  const prev = adsAgg(all.filter(a => a.date && ymOf(a.date) === addMonths(ym, -1)));
  const t = adsAgg(list);
  const camps = Object.entries(groupBy(list, a => a.campaign || 'Sem nome')).map(([k, l]) => ({ k, ch: l[0].channel, ...adsAgg(l) })).sort((a, b) => (a.cpl || 1e9) - (b.cpl || 1e9));
  const cm = commercialMonth(db, ym);
  const paid = cm.byCh.filter(r => r.ch.kind === 'pago');
  const crm = { leads: sum(paid, r => r.leads), ganhos: sum(paid, r => r.ganhos), mrr: sum(paid, r => r.mrrGanho) };
  const months = Array.from({ length: 6 }, (_, i) => addMonths(ym, i - 5));
  const hist = months.map(m => adsAgg(all.filter(a => a.date && ymOf(a.date) === m)));
  const ins = [];
  if (camps.length >= 2 && camps[0].leads) ins.push({ t: 'good', m: `"${camps[0].k}" tem o menor custo por lead (${mf(camps[0].cpl)}). Vale colocar mais verba nela.` });
  camps.filter(c => c.spend > 0 && !c.leads).forEach(c => ins.push({ t: 'bad', m: `"${c.k}" gastou ${money(c.spend)} e não gerou lead. Revise criativo, público ou pause.` }));
  if (Number.isFinite(t.ctr) && t.ctr < 0.01) ins.push({ t: 'warn', m: `CTR de ${pct(t.ctr * 100, 2)}: os anúncios estão chamando pouca atenção. Teste novos criativos e ganchos (use os posts que mais performaram no orgânico).` });
  if (Number.isFinite(t.cpl) && Number.isFinite(prev.cpl)) ins.push({ t: t.cpl <= prev.cpl ? 'good' : 'warn', m: `Custo por lead ${t.cpl <= prev.cpl ? 'caiu' : 'subiu'} de ${mf(prev.cpl)} para ${mf(t.cpl)} em relação ao mês anterior.` });
  if (t.leads && crm.leads && Math.abs(crm.leads - t.leads) / t.leads > 0.3) ins.push({ t: 'info', m: `As plataformas mostram ${t.leads} leads e o CRM tem ${crm.leads} leads de tráfego no mês. Confira se os leads estão sendo cadastrados no Pipeline com o canal certo.` });
  return html`<div>
    <div class="row wrap mb16" style=${{ gap: 10 }}><${MonthNav} v=${ym} on=${setYm}/><span class="xs faint">O investimento lançado aqui entra no CAC do Comercial (quando o mês não tem investimento digitado à mão).</span><span style=${{ flex: 1 }}/><${Btn} v="pri" icon="plus" on=${() => setEdit({})}>Registrar semana</${Btn}></div>
    <div class="grid g4 mb12">
      <${Kpi} l="Investimento" v=${money(t.spend)} s=${Number.isFinite(t.cpm) ? 'CPM ' + mf(t.cpm) : ''}/>
      <${Kpi} l="Leads (plataforma)" v=${num(t.leads)} s=${'CPL ' + mf(t.cpl)}/>
      <${Kpi} l="Reuniões" v=${num(t.meetings)} s=${'custo por reunião ' + mf(t.cpr)}/>
      <${Kpi} l="Vendas" v=${num(t.sales)} s=${'CAC ' + mf(t.cac)} tone=${t.sales ? 'good' : ''}/>
    </div>
    <div class="grid g4 mb16">
      <${Kpi} l="CTR" v=${Number.isFinite(t.ctr) ? pct(t.ctr * 100, 2) : '—'} s=${'CPC ' + mf(t.cpc)}/>
      <${Kpi} l="Clique → lead" v=${Number.isFinite(t.conv) ? pct(t.conv * 100, 1) : '—'} s="conversão da página/formulário"/>
      <${Kpi} l="No CRM: leads de tráfego" v=${num(crm.leads)} s=${crm.ganhos + ' venda(s) · ' + money(crm.mrr) + ' MRR'}/>
      <${Kpi} l="CAC real (CRM)" v=${crm.ganhos && t.spend ? money(t.spend / crm.ganhos) : '—'} s="investimento ÷ vendas do CRM"/>
    </div>
    ${ins.length > 0 && html`<div class="card mb16"><div class="card-h"><h3>O que os números estão dizendo</h3></div><div class="col" style=${{ gap: 8 }}>${ins.map((x, i) => html`<div key=${i} class=${'callout ' + x.t}><${Icon} n=${x.t === 'good' ? 'up' : x.t === 'info' ? 'zap' : 'alert'} s=${16}/><div>${x.m}</div></div>`)}</div></div>`}
    <div class="grid g-side mb16">
      <div class="card flush"><div class="lgroup"><span>Campanhas do mês (do menor CPL para o maior)</span><span>${camps.length}</span></div>
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Campanha</th><th class="r">Invest.</th><th class="r">CTR</th><th class="r">Leads</th><th class="r">CPL</th><th class="r">Reuniões</th><th class="r">Vendas</th><th class="r">CAC</th></tr></thead>
          <tbody>${camps.map(c => html`<tr key=${c.k}><td><div class="b">${c.k}</div><div class="xs faint">${(db.S.channels.find(x => x.id === c.ch) || {}).name || c.ch || ''}</div></td><td class="r num">${money(c.spend)}</td><td class="r num">${Number.isFinite(c.ctr) ? pct(c.ctr * 100, 2) : '—'}</td><td class="r num">${num(c.leads)}</td><td class="r num b">${mf(c.cpl)}</td><td class="r num">${num(c.meetings)}</td><td class="r num">${num(c.sales)}</td><td class="r num">${mf(c.cac)}</td></tr>`)}</tbody></table></div>
        ${!camps.length && html`<${Empty} t="Nenhuma semana registrada neste mês" s="Registre semanalmente os números do Gerenciador de Anúncios."/>`}</div>
      <div class="card"><div class="card-h"><h3>Custo por lead</h3><span class="sub">6 meses</span></div>
        <${BarChart} labels=${months.map(monthShort)} series=${[{ name: 'CPL', data: hist.map(h => (Number.isFinite(h.cpl) ? h.cpl : 0)), color: 'var(--s1)' }]} highlight=${5} fmt=${money}/>
        <div class="legend">${months.map((m, i) => html`<span key=${m}>${monthShort(m)}: <b>${num(hist[i].leads)}</b> leads</span>`)}</div></div>
    </div>
    <div class="card flush"><div class="lgroup"><span>Lançamentos do mês</span><span>${list.length}</span></div>
      ${list.sort((a, b) => b.date.localeCompare(a.date)).map(a => html`<div class="lrow" key=${a.id} style=${{ cursor: 'pointer' }} onClick=${() => setEdit(a)}>
        <${DateBox} d=${a.date}/><div style=${{ flex: 1, minWidth: 0 }}><div class="main-t">${a.campaign || 'Sem nome'}</div><div class="meta"><span>${money(a.spend)}</span><i class="sep"/><span>${num(a.leads)} leads</span><i class="sep"/><span>${num(a.meetings)} reuniões</span><i class="sep"/><span>${num(a.sales)} vendas</span></div></div></div>`)}
      ${!list.length && html`<${Empty} t="Sem lançamentos" s=""/>`}</div>
    ${edit && html`<${MkAdsForm} a=${edit} camps=${[...new Set(all.map(x => x.campaign).filter(Boolean))]} onClose=${() => setEdit(null)}/>`}
  </div>`;
}
function MkAdsForm({ a, camps, onClose }) {
  const db = useDB();
  const [f, setF] = useState(() => Object.assign({ date: weekStart(today()), channel: 'meta', campaign: '', objective: 'leads', spend: '', impressions: '', clicks: '', leads: '', meetings: '', sales: '', revenue: '', notes: '' }, a));
  const F = k => v => setF(x => ({ ...x, [k]: v }));
  const c = adsAgg([adsCalc(f)]);
  const save = () => { if (!f.campaign.trim()) return toast('Informe o nome da campanha.'); store.put('mkads', { ...f, id: f.id || uid(), by: f.by || CURRENT_USER.name || '', updatedAt: stamp() }); toast('Semana registrada.'); onClose(); };
  const N = (k, l, pre) => html`<${Input} label=${l} type="number" v=${f[k]} on=${F(k)} pre=${pre}/>`;
  return html`<${Modal} title=${a.id ? 'Editar lançamento' : 'Registrar semana de tráfego'} onClose=${onClose} footer=${html`${a.id && html`<${Btn} v="ghost" cls="danger" icon="trash" on=${() => { delWithUndo('mkads', a.id, 'Lançamento'); onClose(); }}>Excluir</${Btn}>`}<span style=${{ flex: 1 }}/><${Btn} on=${onClose}>Cancelar</${Btn}><${Btn} v="pri" on=${save}>Salvar</${Btn}>`}>
    <div class="form c2">
      <${Input} label="Semana de (início)" type="date" v=${f.date} on=${F('date')}/>
      <${Select} label="Canal" v=${f.channel} on=${F('channel')} opts=${db.S.channels.filter(x => x.kind === 'pago').map(x => ({ v: x.id, l: x.name }))}/>
      <${Field} cls="span3" label="Campanha"><input class="inp" list="mk-camps" value=${f.campaign} onInput=${e => F('campaign')(e.target.value)} placeholder="Ex: Captação Consultoria 360 — vídeo depoimento"/><datalist id="mk-camps">${camps.map(x => html`<option key=${x} value=${x}/>`)}</datalist></${Field}>
      ${N('spend', 'Investimento', 'R$')}${N('impressions', 'Impressões')}${N('clicks', 'Cliques no link')}${N('leads', 'Leads (formulário/mensagens)')}${N('meetings', 'Reuniões agendadas')}${N('sales', 'Vendas fechadas')}
      <${Textarea} cls="span3" label="Observações (criativo, público, teste)" v=${f.notes} on=${F('notes')} rows=${2}/>
    </div>
    <div class="row wrap mt12" style=${{ gap: 8 }}><${Pill} c="var(--s1)">CTR ${Number.isFinite(c.ctr) ? pct(c.ctr * 100, 2) : '—'}</${Pill}><${Pill} c="var(--s3)">CPL ${mf(c.cpl)}</${Pill}><${Pill} c="var(--s2)">Custo por reunião ${mf(c.cpr)}</${Pill}></div>
  </${Modal}>`;
}
