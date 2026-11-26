/* ============================================================
   COBRANÇAS — Asaas (emissão, sincronização, conciliação)
   e clientes do exterior (moeda estrangeira + lembretes)
   ============================================================ */
const ASAAS_SECRET_KEY = 'vos7_asaas_secret';
const asaasReady = S => S.asaas && S.asaas.enabled && !!LS.get(ASAAS_SECRET_KEY, '');
async function asaasCall(action, params) {
  const S = settingsOf(store.data);
  const r = await fetch(S.asaas.proxyUrl || '/.netlify/functions/asaas', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-vos-secret': LS.get(ASAAS_SECRET_KEY, '') },
    body: JSON.stringify({ action, params })
  }).catch(() => { throw new Error('Não consegui falar com a função do Asaas. O sistema precisa estar publicado no Netlify (veja Configurações → Asaas).'); });
  let data = null; try { data = await r.json(); } catch (e) { /* vazio */ }
  if (!r.ok) throw new Error((data && data.error) || 'Erro ' + r.status);
  return data;
}
const saveAsaasSnap = s => { if (s && s.id) store.restore('asaas', Object.assign({}, store.data.asaas[s.id] || {}, s)); };

async function emitInvoice(i) {
  const db = { ...store.data, S: settingsOf(store.data) };
  const c = db.contracts[i.contractId]; const cl = db.clients[i.clientId] || {};
  if (!onlyDigits(cl.document)) throw new Error(i.clientName + ': cadastre o CPF/CNPJ do cliente (Clientes → editar).');
  let customer = cl.asaasId;
  if (!customer) {
    const r = await asaasCall('findOrCreateCustomer', { name: cl.name || i.clientName, cpfCnpj: cl.document, email: cl.email, phone: cl.phone, externalReference: cl.id });
    customer = r.id; store.put('clients', Object.assign({}, cl, { asaasId: customer }));
  }
  const due = i.due < today() ? today() : i.due;
  const snap = await asaasCall('createPayment', {
    customer, billingType: (c && c.asaasBilling) || db.S.asaas.billingType || 'UNDEFINED', value: i.amount, dueDate: due,
    description: prodName(db.S, i.productId) + ' — ' + i.label + ' — ' + (db.S.company || 'Visions'), externalReference: i.id
  });
  saveAsaasSnap(snap);
  return snap;
}
async function syncAsaas() {
  const r = await asaasCall('listPayments', { dueFrom: addDays(today(), -200), dueTo: addDays(today(), 120) });
  let changed = 0;
  (r.payments || []).forEach(p => {
    const cur = store.data.asaas[p.id];
    if (!cur || cur.status !== p.status || cur.value !== p.value || cur.dueDate !== p.dueDate || cur.paymentDate !== p.paymentDate || !!cur.deleted !== !!p.deleted) { saveAsaasSnap(p); changed++; }
  });
  store.setSettings({ asaasLastSync: stamp() });
  return { total: (r.payments || []).length, changed };
}
async function runAsaas(label, fn) {
  try { const r = await fn(); return r; } catch (e) { toast('Asaas: ' + e.message, null, 8000); throw e; }
}

/* ---------- lembretes (exterior / manual) ---------- */
const REMIND_TPL = {
  pt: (v) => `Olá ${v.nome}! Tudo bem? Passando para lembrar da ${v.desc} no valor de ${v.valor}, com vencimento em ${v.venc}.${v.link ? '\n\nPagamento: ' + v.link : ''}${v.instr ? '\n\n' + v.instr : ''}\n\nQualquer dúvida, estou à disposição. Obrigado!`,
  en: (v) => `Hi ${v.nome}! Hope you're doing well. This is a friendly reminder that the ${v.desc} of ${v.valor} is due on ${v.venc}.${v.link ? '\n\nPayment link: ' + v.link : ''}${v.instr ? '\n\n' + v.instr : ''}\n\nLet me know if you have any questions. Thank you!`,
  es: (v) => `¡Hola ${v.nome}! Te recordamos que la ${v.desc} por ${v.valor} vence el ${v.venc}.${v.link ? '\n\nPago: ' + v.link : ''}${v.instr ? '\n\n' + v.instr : ''}\n\n¡Cualquier duda, quedo a disposición. Gracias!`
};
const REMIND_LATE = { pt: 'Notamos que ainda não identificamos o pagamento. ', en: "We haven't received this payment yet. ", es: 'Aún no identificamos el pago. ' };
function ReminderModal({ i, onClose }) {
  const db = useDB(); const c = db.contracts[i.contractId] || {}; const cl = db.clients[i.clientId] || {};
  const [lang, setLang] = useState(c.reminderLang || (i.currency !== 'BRL' ? 'en' : 'pt'));
  const nome = (cl.contact || cl.name || i.clientName || '').split(' ')[0];
  const loc = { pt: 'pt-BR', en: 'en-US', es: 'es-ES' }[lang];
  const valor = new Intl.NumberFormat(loc, { style: 'currency', currency: i.amountOrig != null ? i.currency : 'BRL' }).format(i.amountOrig != null ? i.amountOrig : i.amount);
  const descMap = { pt: i.label.toLowerCase(), en: i.kind === 'mensal' ? 'monthly fee (' + monthShort(i.origYm) + ')' : 'invoice (' + i.label + ')', es: i.kind === 'mensal' ? 'mensualidad (' + monthShort(i.origYm) + ')' : 'factura (' + i.label + ')' };
  const venc = lang === 'en' ? parseD(i.due).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : fdate(i.due);
  let txt = REMIND_TPL[lang]({ nome, desc: descMap[lang], valor, venc, link: c.payLink, instr: c.payInstructions });
  if (i.status === 'atrasado') txt = txt.replace(/\n\n/, '\n\n' + REMIND_LATE[lang]);
  const [msg, setMsg] = useState(txt);
  useEffect(() => setMsg(txt), [lang]);
  const log = ch => { const p = db.payments[i.id] || { id: i.id, contractId: i.contractId }; store.put('payments', Object.assign({}, p, { reminders: (p.reminders || []).concat({ at: stamp(), ch, by: CURRENT_USER.id }) })); };
  const phone = cl.phone || c.phone; const email = cl.email || c.email;
  return html`<${Modal} title=${'Lembrete — ' + i.clientName} onClose=${onClose}
    footer=${html`<${Btn} icon="copy" on=${() => { copyText(msg); log('copiado'); }}>Copiar</${Btn}>
      ${email && html`<${Btn} icon="msg" href=${'mailto:' + email + '?subject=' + encodeURIComponent(lang === 'en' ? 'Payment reminder' : lang === 'es' ? 'Recordatorio de pago' : 'Lembrete de pagamento') + '&body=' + encodeURIComponent(msg)} on=${() => log('email')}>E-mail</${Btn}>`}
      ${phone && html`<${Btn} cls="wa" icon="msg" href=${waLink(phone, msg)} on=${() => log('whatsapp')}>WhatsApp</${Btn}>`}`}>
    <div class="row between mb12"><${Seg} v=${lang} on=${setLang} opts=${[{ v: 'pt', l: 'Português' }, { v: 'en', l: 'English' }, { v: 'es', l: 'Español' }]}/>
      <span class="xs faint">${i.reminders.length ? i.reminders.length + ' lembrete(s) enviados · último ' + fdate(dOfStamp(i.reminders[i.reminders.length - 1].at)) : 'nenhum lembrete enviado'}</span></div>
    <${Textarea} v=${msg} on=${setMsg} rows=${9}/>
    ${!c.payLink && html`<div class="xs faint mt8">Dica: cadastre no contrato o link de pagamento (Wise, PayPal, Stripe…) para ele entrar no lembrete automaticamente.</div>`}
  </${Modal}>`;
}

/* ---------- selos e ações nas linhas de cobrança ---------- */
function BillingBadge({ i }) {
  if (i.billing === 'asaas') return html`<span class="tag info" style=${{ fontSize: 10.5, padding: '0 6px' }} title=${i.asaas ? 'Asaas: ' + (ASAAS_LABEL[i.asaas.status] || i.asaas.status) : 'Ainda não emitida no Asaas'}>Asaas${i.asaas ? '' : ' · não emitida'}</span>`;
  if (i.billing === 'exterior') return html`<span class="tag" style=${{ fontSize: 10.5, padding: '0 6px' }}>🌎 ${i.currency}</span>`;
  return null;
}
function InvActions({ i }) {
  const [rem, setRem] = useState(false); const [busy, setBusy] = useState(false);
  const db = useDB();
  const open = i.status !== 'pago' && i.status !== 'cancelado';
  const emit = async () => { setBusy(true); try { await runAsaas('emitir', () => emitInvoice(i)); toast('Cobrança emitida no Asaas.'); } catch (e) { } setBusy(false); };
  return html`<${Fragment}>
    ${i.asaas && (i.asaas.invoiceUrl || i.asaas.bankSlipUrl) && html`<${Btn} sz="xs" v="ghost" icon="external" href=${i.asaas.invoiceUrl || i.asaas.bankSlipUrl} title="Abrir fatura do Asaas"/>`}
    ${open && i.billing === 'asaas' && !i.asaas && asaasReady(db.S) && html`<${Btn} sz="xs" on=${emit} disabled=${busy}>${busy ? '…' : 'Emitir'}</${Btn}>`}
    ${open && i.billing !== 'asaas' && i.due <= addDays(today(), 5) && html`<${Btn} sz="xs" v="ghost" icon="bell" on=${() => setRem(true)} title="Enviar lembrete"/>`}
    ${rem && html`<${ReminderModal} i=${i} onClose=${() => setRem(false)}/>`}
  </${Fragment}>`;
}

/* ---------- página Cobranças ---------- */
function CobrancasPage({ nav }) {
  const db = useDB(); const S = db.S;
  const [busy, setBusy] = useState(''); const [hide, setHide] = useState(LS.get('vos7_hide_issues', []));
  const inv = useMemo(() => allInvoices(db, addMonths(ymNow(), 2)), [db.contracts, db.payments, db.asaas, db.settings]);
  const issues = reconcile(db, inv).filter(x => !hide.includes(x.type + ':' + (x.i ? x.i.id : x.a.id)));
  const ready = asaasReady(S);
  const by = groupBy(issues, x => x.type);
  const order = ['problema', 'pago_aqui_aberto_la', 'valor', 'excluida', 'sem_documento', 'nao_emitida', 'atrasada', 'vencimento', 'orfa'];
  const toEmit = (by.nao_emitida || []).map(x => x.i);
  const ext = inv.filter(i => i.billing === 'exterior' && i.status !== 'pago' && i.status !== 'cancelado' && i.due <= addDays(today(), 30));
  const extByCur = groupBy(ext, i => i.currency);
  const ym = ymNow();
  const viaAsaas = inv.filter(i => i.source === 'asaas' && i.status === 'pago' && ymOf(i.paidAt) === ym);
  const sync = async () => { setBusy('sync'); try { const r = await runAsaas('sync', syncAsaas); toast('Asaas sincronizado: ' + r.total + ' cobranças lidas, ' + r.changed + ' atualizadas.'); } catch (e) { } setBusy(''); };
  const emitAll = async () => {
    if (!confirm('Emitir ' + toEmit.length + ' cobrança(s) no Asaas? O Asaas envia a cobrança ao cliente conforme suas configurações de notificação.')) return;
    setBusy('emit'); let ok = 0, fail = 0;
    for (const i of toEmit) { try { await emitInvoice(i); ok++; } catch (e) { fail++; toast(e.message, null, 8000); } }
    toast(ok + ' emitida(s)' + (fail ? ', ' + fail + ' com erro' : '') + '.'); setBusy('');
  };
  const act = async (fn, msg) => { setBusy('x'); try { await runAsaas('', fn); toast(msg); } catch (e) { } setBusy(''); };
  const ignore = x => { const k = x.type + ':' + (x.i ? x.i.id : x.a.id); const n = hide.concat(k); setHide(n); LS.set('vos7_hide_issues', n); toast('Alerta ocultado.', { l: 'Desfazer', f: () => { setHide(hide); LS.set('vos7_hide_issues', hide); } }); };
  const Actions = ({ x }) => {
    const i = x.i;
    if (x.type === 'nao_emitida') return ready ? html`<${Btn} sz="xs" v="pri" on=${() => act(() => emitInvoice(i), 'Emitida no Asaas.')}>Emitir agora</${Btn}>` : null;
    if (x.type === 'sem_documento') return html`<${Btn} sz="xs" on=${() => nav.go('clientes')}>Cadastrar CPF/CNPJ</${Btn}>`;
    if (x.type === 'valor' && ready) return html`<${Btn} sz="xs" on=${() => act(() => asaasCall('updatePayment', { id: i.asaas.id, value: i.amount }).then(saveAsaasSnap), 'Valor corrigido no Asaas.')}>Corrigir no Asaas</${Btn}>`;
    if (x.type === 'vencimento' && ready) return html`<${Btn} sz="xs" v="ghost" on=${() => act(() => asaasCall('updatePayment', { id: i.asaas.id, dueDate: i.due < today() ? today() : i.due }).then(saveAsaasSnap), 'Vencimento ajustado no Asaas.')}>Ajustar no Asaas</${Btn}>`;
    if (x.type === 'pago_aqui_aberto_la' && ready) return html`<${Btn} sz="xs" v="pri" on=${() => act(() => asaasCall('receiveInCash', { id: i.asaas.id, paymentDate: i.paidAt || today(), value: i.paidAmount || i.amount }).then(saveAsaasSnap), 'Baixa registrada no Asaas — o cliente não será mais cobrado.')}>Dar baixa no Asaas</${Btn}>`;
    if (x.type === 'atrasada' && i.billing !== 'asaas') return html`<${InvActions} i=${i}/>`;
    return null;
  };
  return html`<div>
    <${PageH} t="Cobranças" s="Central de cobrança: Asaas para clientes do Brasil, lembretes para clientes do exterior, e todos os erros e atrasos em um lugar.">
      ${ready && html`<${Btn} icon="repeat" on=${sync} disabled=${!!busy}>${busy === 'sync' ? 'Sincronizando…' : 'Sincronizar com Asaas'}</${Btn}>`}
      ${ready && toEmit.length > 0 && html`<${Btn} v="pri" icon="zap" on=${emitAll} disabled=${!!busy}>${busy === 'emit' ? 'Emitindo…' : 'Emitir ' + toEmit.length + ' pendente(s)'}</${Btn}>`}
    </${PageH}>
    ${!ready && html`<div class="callout info mb16"><b class="t">Asaas ainda não conectado</b>A conciliação abaixo já funciona com os dados manuais. Para emitir cobranças e receber a baixa automática quando o cliente paga, conecte em <a href="#config" onClick=${e => { e.preventDefault(); nav.go('config'); LS.set('vos7_cfgtab', 'asaas'); }}>Configurações → Asaas</a>.</div>`}
    <div class="grid g4 mb16">
      <${Kpi} l="Alertas de cobrança" v=${issues.filter(x => ISSUE_TYPES[x.type].t !== 'info').length} tone=${issues.some(x => ISSUE_TYPES[x.type].t === 'bad') ? 'bad' : null} icon="alert"/>
      <${Kpi} l="Atrasado (total)" v=${money(sum((by.atrasada || []).map(x => x.i), i => i.amount))} s=${(by.atrasada || []).length + ' cobranças'}/>
      <${Kpi} l=${'Recebido via Asaas em ' + monthShort(ym)} v=${money(sum(viaAsaas, i => i.paidAmount))} s=${S.asaasLastSync ? 'sincronizado ' + new Date(S.asaasLastSync).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'baixa automática pelo webhook'} tone="good"/>
      <${Kpi} l="Exterior a receber (30 dias)" v=${Object.entries(extByCur).map(([cur, l]) => moneyCur(sum(l, i => i.amountOrig ?? i.amount), cur)).join(' + ') || '—'} s=${ext.length + ' cobranças · ≈ ' + money(sum(ext, i => i.amount))}/>
    </div>
    ${order.filter(t => by[t]).map(t => html`<div class="card flush mb16" key=${t}>
      <div class=${'lgroup ' + (ISSUE_TYPES[t].t === 'bad' ? 'bad' : '')}><span>${ISSUE_TYPES[t].l} (${by[t].length})</span><span style=${{ textTransform: 'none', letterSpacing: 0, fontWeight: 500 }}>${ISSUE_TYPES[t].h}</span></div>
      ${by[t].slice(0, 50).map(x => html`<div class="lrow" key=${t + (x.i ? x.i.id : x.a.id)}>
        ${x.i ? html`<div style=${{ width: 54, textAlign: 'center' }}><div class="b num">${pad(parseD(x.i.due).getDate())}</div><div class="xs faint">${MSHORT[parseD(x.i.due).getMonth()]}</div></div>
          <div style=${{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick=${() => nav.contract(x.i.contractId)}><div class="main-t ellipsis">${x.i.clientName}</div><div class="xs faint row" style=${{ gap: 6, flexWrap: 'wrap' }}><${BillingBadge} i=${x.i}/><span>${x.i.label}${x.extra ? ' · ' + x.extra : ''}</span></div></div>
          <div class="num b">${x.i.amountOrig != null ? moneyCur(x.i.amountOrig, x.i.currency) : money2(x.i.amount)}</div>`
        : html`<div style=${{ width: 54, textAlign: 'center' }}><div class="b num">${pad(parseD(x.a.dueDate).getDate())}</div><div class="xs faint">${MSHORT[parseD(x.a.dueDate).getMonth()]}</div></div>
          <div style=${{ flex: 1, minWidth: 0 }}><div class="main-t ellipsis">${x.a.description || 'Cobrança ' + x.a.id}</div><div class="xs faint">${ASAAS_LABEL[x.a.status] || x.a.status} · ${x.a.billingType || ''}</div></div><div class="num b">${money2(x.a.value)}</div>
          ${x.a.invoiceUrl && html`<${Btn} sz="xs" v="ghost" icon="external" href=${x.a.invoiceUrl}/>`}`}
        <${Actions} x=${x}/>
        <${Btn} sz="xs" v="ghost" on=${() => ignore(x)} title="Ocultar este alerta">Ignorar</${Btn}>
      </div>`)}
    </div>`)}
    ${!issues.length && html`<div class="card"><${Empty} t="Nenhum erro de cobrança 🎉" s="Tudo emitido, conferido e em dia."/></div>`}
  </div>`;
}

/* ---------- configuração do Asaas ---------- */
function AsaasSettings() {
  const db = useDB(); const S = db.S;
  const [secret, setSecret] = useState(LS.get(ASAAS_SECRET_KEY, '')); const [test, setTest] = useState(null);
  const set = patch => store.setSettings({ asaas: Object.assign({}, S.asaas, patch) });
  const ping = async () => { LS.set(ASAAS_SECRET_KEY, secret); setTest({ l: 'Testando…' }); try { const r = await asaasCall('ping', {}); setTest({ ok: true, l: 'Conectado (' + (r.env === 'sandbox' ? 'sandbox' : 'produção') + '). Saldo: ' + money2(r.balance) }); } catch (e) { setTest({ ok: false, l: e.message }); } };
  const hook = location.origin + '/.netlify/functions/asaas-webhook';
  return html`<div class="grid g2" style=${{ alignItems: 'start' }}>
    <div class="card"><div class="card-h"><h3>Conexão com o Asaas</h3>${S.asaas.enabled ? html`<${Tag} t="good">ativado</${Tag}>` : html`<${Tag}>desativado</${Tag}>`}</div>
      <div class="form">
        <${Toggle} v=${S.asaas.enabled} on=${v => set({ enabled: v })} label="Usar Asaas para cobrar clientes do Brasil"/>
        <${Input} label="Segredo de acesso (VOS_SECRET)" type="password" v=${secret} on=${v => { setSecret(v); LS.set(ASAAS_SECRET_KEY, v); }} hint="Fica salvo só neste navegador. Cada pessoa que for emitir cobranças digita uma vez."/>
        <${Select} label="Forma de pagamento padrão" v=${S.asaas.billingType} on=${v => set({ billingType: v })} opts=${[{ v: 'UNDEFINED', l: 'Cliente escolhe (boleto, Pix ou cartão)' }, { v: 'PIX', l: 'Pix' }, { v: 'BOLETO', l: 'Boleto (com Pix)' }, { v: 'CREDIT_CARD', l: 'Cartão de crédito' }]}/>
        <${Input} label="Alertar cobranças não emitidas com vencimento em até (dias)" type="number" v=${S.asaas.emitDays} on=${v => set({ emitDays: n0(v) })}/>
        <${Input} label="Endereço da função" v=${S.asaas.proxyUrl} on=${v => set({ proxyUrl: v })} hint="Padrão: /.netlify/functions/asaas"/>
        <div class="row"><${Btn} v="pri" on=${ping}>Testar conexão</${Btn}>${test && html`<span class=${'small ' + (test.ok ? 'delta-up' : test.ok === false ? 'delta-down' : 'faint')}>${test.l}</span>`}</div>
      </div></div>
    <div class="card"><div class="card-h"><h3>Como ativar (uma vez)</h3></div>
      <ol class="small" style=${{ paddingLeft: 18, lineHeight: 1.7, margin: 0 }}>
        <li>Publique este repositório no <b>Netlify</b> (Add new site → Import from GitHub). O <code>netlify.toml</code> já está pronto.</li>
        <li>No Netlify, em <b>Site configuration → Environment variables</b>, crie:<br/>
          <code>ASAAS_API_KEY</code> = chave da API do Asaas (Asaas → Integrações → Chave de API)<br/>
          <code>VOS_SECRET</code> = uma senha longa inventada por você (é a que vai no campo ao lado)<br/>
          <code>ASAAS_WEBHOOK_TOKEN</code> = outra senha inventada<br/>
          <code>ASAAS_ENV</code> = <code>sandbox</code> para testar (apague para produção)</li>
        <li>No Asaas: <b>Integrações → Webhooks → Adicionar</b>. URL: <code style=${{ wordBreak: 'break-all' }}>${hook}</code>, token = o mesmo do <code>ASAAS_WEBHOOK_TOKEN</code>, eventos de <b>Cobranças</b>.</li>
        <li>Volte aqui, ative, cole o <code>VOS_SECRET</code> e clique em Testar conexão.</li>
      </ol>
      <div class="callout info mt12">A chave do Asaas nunca fica no navegador: só a função do Netlify a conhece. Quando o cliente paga, o webhook dá baixa sozinho em Recebíveis.</div>
    </div>
    <div class="card span3" style=${{ gridColumn: '1/-1' }}><div class="card-h"><h3>Clientes do exterior</h3></div>
      <p class="small muted" style=${{ marginTop: 0 }}>O Asaas não cobra clientes de fora. Para eles, no contrato escolha <b>Cobrança: Exterior</b>, a moeda e o link de pagamento (Wise, PayPal, Stripe…). O sistema converte para reais nos relatórios pela cotação abaixo, mostra os vencimentos em Cobranças e gera lembretes prontos em português, inglês ou espanhol. Ao dar baixa, informe o valor que caiu em reais (com câmbio e taxas).</p>
      <div class="form c3">${['USD', 'EUR', 'GBP'].map(k => html`<${Input} key=${k} label=${'Cotação ' + k + ' (R$)'} type="number" v=${S.fx[k]} on=${v => store.setSettings({ fx: Object.assign({}, S.fx, { [k]: n0(v) }) })}/>`)}</div>
    </div>
  </div>`;
}
