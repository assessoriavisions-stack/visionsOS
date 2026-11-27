/* ============================================================
   Componentes de interface
   ============================================================ */
const ICONS = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  kanban: 'M4 4h4v16H4zM10 4h4v10h-4zM16 4h4v6h-4z',
  bell: 'M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8M10 20a2 2 0 0 0 4 0',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 12h.01',
  repeat: 'M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3',
  chart: 'M3 3v18h18M7 15l4-4 3 3 5-6',
  wallet: 'M3 7a2 2 0 0 1 2-2h13v4M3 7v11a2 2 0 0 0 2 2h15V9H5a2 2 0 0 1-2-2zM16 14h.01',
  inbox: 'M22 12h-6l-2 3h-4l-2-3H2M5.5 5h13L22 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6z',
  file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h6',
  down: 'M12 5v14M5 12l7 7 7-7',
  calc: 'M5 2h14a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zM8 6h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 19h.01M12 19h4',
  flag: 'M4 22V4M4 4h13l-2 4 2 4H4',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
  plus: 'M12 5v14M5 12h14',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.35-4.35',
  x: 'M18 6 6 18M6 6l12 12',
  check: 'M20 6 9 17l-5-5',
  left: 'M15 18l-6-6 6-6', right: 'M9 18l6-6-6-6',
  phone: 'M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.18 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.1 9.9a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z',
  msg: 'M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z',
  copy: 'M20 9h-9a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2zM5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2',
  cal: 'M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zM16 2v4M8 2v4M3 10h18',
  trash: 'M3 6h18M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2',
  edit: 'M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z',
  up: 'M12 19V5M5 12l7-7 7 7',
  zap: 'M13 2 3 14h9l-1 8 10-12h-9z',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  moon: 'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z',
  cloud: 'M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z',
  alert: 'M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01',
  dollar: 'M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  external: 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3',
  pause: 'M6 4h4v16H6zM14 4h4v16h-4z', play: 'M5 3l14 9-14 9z',
  film: 'M4 4h16v16H4zM8 4v16M16 4v16M4 9h4M4 15h4M16 9h4M16 15h4',
  map: 'M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4zM8 2v16M16 6v16',
  key: 'M21 2l-2 2m-7.6 7.6a5.5 5.5 0 1 1-7.78 7.78 5.5 5.5 0 0 1 7.78-7.78zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4',
  camera: 'M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  checksq: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
  grid: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',
  image: 'M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zM8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM21 15l-5-5L5 21',
  archive: 'M21 8v13H3V8M1 3h22v5H1zM10 12h4',
  folder: 'M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z',
  eye: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  eyeoff: 'M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19M1 1l22 22',
  mic: 'M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3zM19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8',
  trophy: 'M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3',
  arrow: 'M5 12h14M12 5l7 7-7 7',
  star: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z'
};
function Icon({ n, s = 18, w = 2, style }) {
  return html`<svg width=${s} height=${s} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width=${w} stroke-linecap="round" stroke-linejoin="round" style=${style} aria-hidden="true"><path d=${ICONS[n] || ''}/></svg>`;
}

function Btn({ children, v, sz, on, icon, title, disabled, type, cls, href }) {
  const c = ['btn', v, sz, cls].filter(Boolean).join(' ');
  if (href) return html`<a class=${c} href=${href} target="_blank" rel="noopener" title=${title} onClick=${on}>${icon && html`<${Icon} n=${icon} s=${15}/>`}${children}</a>`;
  return html`<button type=${type || 'button'} class=${c} onClick=${on} title=${title} disabled=${disabled}>${icon && html`<${Icon} n=${icon} s=${15}/>`}${children}</button>`;
}

function Field({ label, hint, children, cls }) {
  return html`<div class=${'fld ' + (cls || '')}>${label && html`<label>${label}</label>`}${children}${hint && html`<div class="hint">${hint}</div>`}</div>`;
}
function Input({ label, hint, v, on, type, ph, cls, pre, min, max, step, autoFocus, onEnter, sm }) {
  const inp = html`<input class=${'inp' + (sm ? ' sm' : '')} type=${type || 'text'} value=${v ?? ''} placeholder=${ph} min=${min} max=${max} step=${step} autoFocus=${autoFocus}
    inputMode=${type === 'number' ? 'decimal' : undefined}
    onChange=${e => on && on(e.target.value)} onKeyDown=${e => { if (e.key === 'Enter' && onEnter) onEnter(); }}/>`;
  const body = pre ? html`<div class="inp-pre"><span>${pre}</span>${inp}</div>` : inp;
  return label || hint ? html`<${Field} label=${label} hint=${hint} cls=${cls}>${body}</${Field}>` : body;
}
function Money(p) { return html`<${Input} ...${p} type="number" pre="R$" step="0.01"/>`; }
function Select({ label, hint, v, on, opts, cls, sm, ph }) {
  const el = html`<select class=${'inp' + (sm ? ' sm' : '')} value=${v ?? ''} onChange=${e => on(e.target.value)}>
    ${ph != null && html`<option value="">${ph}</option>`}
    ${opts.map(o => typeof o === 'string' ? html`<option key=${o} value=${o}>${o}</option>` : html`<option key=${o.v} value=${o.v}>${o.l}</option>`)}
  </select>`;
  return label || hint ? html`<${Field} label=${label} hint=${hint} cls=${cls}>${el}</${Field}>` : el;
}
function Textarea({ label, hint, v, on, ph, rows, cls }) {
  return html`<${Field} label=${label} hint=${hint} cls=${cls}><textarea class="inp" rows=${rows || 3} value=${v ?? ''} placeholder=${ph} onChange=${e => on(e.target.value)}/></${Field}>`;
}
function Seg({ v, on, opts }) {
  return html`<div class="seg">${opts.map(o => html`<button key=${o.v} class=${v === o.v ? 'on' : ''} onClick=${() => on(o.v)}>${o.icon && html`<${Icon} n=${o.icon} s=${14}/>`}${o.l}${o.n != null && html`<span class="cnt">${o.n}</span>`}</button>`)}</div>`;
}
/* abas de página (linha embaixo da aba ativa) */
function Tabs({ v, on, opts }) {
  return html`<div class="tabs">${opts.map(o => html`<button key=${o.v} class=${v === o.v ? 'on' : ''} onClick=${() => on(o.v)}>${o.icon && html`<${Icon} n=${o.icon} s=${16}/>`}<span>${o.l}</span>${o.n != null && o.n !== '' && html`<span class=${'cnt' + (o.hot ? ' hot' : '')}>${o.n}</span>`}</button>`)}</div>`;
}
/* etapa / status como pílula com ponto colorido */
function Pill({ c, children, title }) {
  return html`<span class="pill" title=${title} style=${{ '--pc': c || 'var(--text-3)' }}><i/>${children}</span>`;
}
function Chips({ v, on, opts, multi }) {
  const isOn = x => (multi ? (v || []).includes(x) : v === x);
  const click = x => { if (!multi) return on(v === x ? '' : x); on(isOn(x) ? v.filter(y => y !== x) : (v || []).concat(x)); };
  return html`<div class="chips">${opts.map(o => html`<button key=${o.v} type="button" class=${'chip' + (isOn(o.v) ? ' on' : '')} onClick=${() => click(o.v)}>${o.l}</button>`)}</div>`;
}
function Toggle({ v, on, label }) {
  return html`<label class="row" style=${{ cursor: 'pointer', gap: 8 }}><input type="checkbox" checked=${!!v} onChange=${e => on(e.target.checked)} style=${{ width: 16, height: 16, accentColor: 'var(--primary-2)' }}/><span>${label}</span></label>`;
}

function Modal({ title, onClose, children, footer, size }) {
  useEffect(() => { const k = e => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, []);
  return html`<div class="ov" onMouseDown=${e => e.target === e.currentTarget && onClose()}>
    <div class=${'mdl ' + (size || '')} role="dialog" aria-label=${title}>
      <div class="mdl-h"><h3>${title}</h3><button class="btn ghost icon" onClick=${onClose} aria-label="Fechar"><${Icon} n="x"/></button></div>
      <div class="mdl-b">${children}</div>
      ${footer && html`<div class="mdl-f">${footer}</div>`}
    </div></div>`;
}
function Drawer({ onClose, head, children }) {
  useEffect(() => { const k = e => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, []);
  return html`<${Fragment}><div class="drawer-ov" onClick=${onClose}/><aside class="drawer"><div class="drawer-h">${head}</div><div class="drawer-b">${children}</div></aside></${Fragment}>`;
}

function Kpi({ l, v, s, accent, icon, tone }) {
  return html`<div class=${'kpi' + (accent ? ' accent' : '')}><div class="l">${icon && html`<${Icon} n=${icon} s=${14}/>`}${l}</div><div class="v" style=${tone ? { color: `var(--${tone})` } : null}>${v}</div>${s && html`<div class="s">${s}</div>`}</div>`;
}
function Progress({ v, max, pace, tone, lowerBetter }) {
  const p = max > 0 ? clamp((v / max) * 100, 0, 100) : 0;
  let t = tone;
  if (!t) {
    if (lowerBetter) t = !max ? '' : v <= max ? 'good' : 'bad';
    else { const exp = pace != null ? pace : 1; const r = max > 0 ? v / (max * exp || 1) : 0; t = !max ? '' : r >= 1 ? 'good' : r >= 0.8 ? 'warn' : 'bad'; }
  }
  return html`<div class=${'bar ' + (t || '')}><i style=${{ width: p + '%' }}/>${pace != null && pace < 1 && !lowerBetter && html`<span class="pace" style=${{ left: (pace * 100) + '%' }} title="Ritmo esperado até hoje"/>`}</div>`;
}
function Tag({ children, t, style }) { return html`<span class=${'tag ' + (t || '')} style=${style}>${children}</span>`; }
function Empty({ t, s, children }) { return html`<div class="empty"><b>${t}</b>${s}${children && html`<div class="mt12">${children}</div>`}</div>`; }
function PageH({ t, s, children }) {
  return html`<div class="page-h"><div><h1>${t}</h1>${s && html`<p>${s}</p>`}</div>${children && html`<div class="row wrap">${children}</div>`}</div>`;
}
function MonthNav({ v, on }) {
  return html`<div class="month-nav">
    <button class="btn ghost icon" onClick=${() => on(addMonths(v, -1))} aria-label="Mês anterior"><${Icon} n="left" s=${16}/></button>
    <b>${monthLabel(v)}</b>
    <button class="btn ghost icon" onClick=${() => on(addMonths(v, 1))} aria-label="Próximo mês"><${Icon} n="right" s=${16}/></button>
    ${v !== ymNow() && html`<button class="btn ghost sm" onClick=${() => on(ymNow())}>Hoje</button>`}
  </div>`;
}
function Toasts() {
  const [l, setL] = useState(toastBus.list);
  useEffect(() => { toastBus.subs.add(setL); return () => toastBus.subs.delete(setL); }, []);
  return html`<div class="toasts">${l.map(t => html`<div class="toast" key=${t.id}><span>${t.msg}</span>${t.action && html`<button onClick=${() => { t.action.f(); toastBus.list = toastBus.list.filter(x => x.id !== t.id); toastBus.subs.forEach(f => f(toastBus.list)); }}>${t.action.l}</button>`}</div>`)}</div>`;
}

/* ---------- tooltip ---------- */
const tipBus = { set: null };
function TipLayer() {
  const [t, setT] = useState(null);
  useEffect(() => { tipBus.set = setT; return () => (tipBus.set = null); }, []);
  if (!t) return null;
  const x = Math.min(t.x + 14, window.innerWidth - 220);
  return html`<div class="tip" style=${{ left: x, top: t.y + 14 }}>${t.c}</div>`;
}
const showTip = (e, c) => tipBus.set && tipBus.set({ x: e.clientX, y: e.clientY, c });
const hideTip = () => tipBus.set && tipBus.set(null);

/* ---------- gráfico de barras agrupadas (eixo único, base zero) ---------- */
function BarChart({ labels, series, h = 200, fmt, line, highlight, stacked, refLine }) {
  const W = 640, H = h, padL = 54, padB = 24, padT = 10;
  const all = (stacked ? labels.map((_, i) => sum(series, s => s.data[i])) : series.flatMap(s => s.data)).concat(line ? line.data : []).concat(refLine ? [refLine.v] : []);
  const maxV = Math.max(1, ...all.map(v => Math.abs(v || 0)));
  const minV = Math.min(0, ...all);
  const nice = v => { const p = Math.pow(10, Math.floor(Math.log10(v))); return Math.ceil(v / p) * p; };
  const top = nice(maxV), bot = minV < 0 ? -nice(-minV) : 0;
  const y = v => padT + (H - padT - padB) * (1 - (v - bot) / (top - bot));
  const n = labels.length, gw = (W - padL) / n, bw = Math.max(4, Math.min(22, (gw - 10) / series.length - 2));
  const ticks = [bot, (top + bot) / 2, top].filter((v, i, a) => a.indexOf(v) === i);
  const f = fmt || (v => num(v));
  return html`<div>
    <svg class="chart" viewBox=${`0 0 ${W} ${H}`} role="img" aria-label=${series.map(s => s.name).join(', ')}>
      ${ticks.map(t => html`<g key=${t}><line class=${t === 0 ? 'axis-0' : 'grid-l'} x1=${padL} x2=${W} y1=${y(t)} y2=${y(t)}/><text x=${padL - 8} y=${y(t) + 4} text-anchor="end">${f(t)}</text></g>`)}
      ${bot < 0 && html`<line class="axis-0" x1=${padL} x2=${W} y1=${y(0)} y2=${y(0)}/>`}
      ${labels.map((lb, i) => {
    const gx = padL + i * gw + (gw - series.length * (bw + 2)) / 2;
    return html`<g key=${lb}>
          ${highlight === i && html`<rect x=${padL + i * gw + 2} y=${padT} width=${gw - 4} height=${H - padT - padB} fill="var(--primary-soft)" rx="6"/>`}
          ${stacked ? (() => { let acc = 0; const sw = Math.min(36, gw - 14); const x = padL + i * gw + (gw - sw) / 2; const lastK = series.reduce((t, s2, k) => (s2.data[i] > 0 ? k : t), -1);
      return series.map((s, k) => { const v = Math.max(0, s.data[i] || 0); if (!v) return null; const yb = y(acc) - (acc > 0 ? 2 : 0); acc += v; const yt = y(acc); const hh = Math.max(0, yb - yt); const r = k === lastK ? Math.min(4, sw / 2, hh) : 0;
        return html`<path key=${k} d=${`M${x},${yb} V${yt + r} Q${x},${yt} ${x + r},${yt} H${x + sw - r} Q${x + sw},${yt} ${x + sw},${yt + r} V${yb} Z`} fill=${s.color}/>`; }); })() : series.map((s, k) => {
      const v = s.data[i] || 0; const y0 = y(0), y1 = y(v); const hh = Math.abs(y0 - y1);
      const x = gx + k * (bw + 2);
      const r = Math.min(4, bw / 2, hh);
      const d = v >= 0
        ? `M${x},${y0} V${y1 + r} Q${x},${y1} ${x + r},${y1} H${x + bw - r} Q${x + bw},${y1} ${x + bw},${y1 + r} V${y0} Z`
        : `M${x},${y0} V${y1 - r} Q${x},${y1} ${x + r},${y1} H${x + bw - r} Q${x + bw},${y1} ${x + bw},${y1 - r} V${y0} Z`;
      return html`<path key=${k} d=${d} fill=${s.color}/>`;
    })}
          <text x=${padL + i * gw + gw / 2} y=${H - 6} text-anchor="middle">${lb}</text>
          <rect x=${padL + i * gw} y=${padT} width=${gw} height=${H - padT - padB} fill="transparent"
            onMouseMove=${e => showTip(e, html`<div><b>${lb}</b>${series.map(s => html`<div key=${s.name}><span class="dot" style=${{ background: s.color, marginRight: 6 }}/>${s.name}: <b>${f(s.data[i] || 0)}</b></div>`)}${line && html`<div>${line.name}: <b>${f(line.data[i] || 0)}</b></div>`}</div>`)}
            onMouseLeave=${hideTip}/>
        </g>`;
  })}
      ${refLine && html`<g pointer-events="none"><line x1=${padL} x2=${W} y1=${y(refLine.v)} y2=${y(refLine.v)} stroke=${refLine.color} stroke-width="2" stroke-dasharray="6 4"/><text x=${W} y=${y(refLine.v) - 5} text-anchor="end" style=${{ fill: refLine.color, fontWeight: 700 }}>${refLine.name}</text></g>`}
      ${line && html`<g pointer-events="none"><polyline fill="none" stroke=${line.color} stroke-width="2" points=${line.data.map((v, i) => (padL + i * gw + gw / 2) + ',' + y(v || 0)).join(' ')}/>
        ${line.data.map((v, i) => html`<circle key=${i} cx=${padL + i * gw + gw / 2} cy=${y(v || 0)} r="4" fill=${line.color} stroke="var(--surface)" stroke-width="2"/>`)}</g>`}
    </svg>
    ${(series.length > 1 || line || refLine) && html`<div class="legend">${series.map(s => html`<span key=${s.name}><i style=${{ background: s.color }}/>${s.name}</span>`)}${line && html`<span><i style=${{ background: line.color, height: 3 }}/>${line.name}</span>`}${refLine && html`<span><i style=${{ background: refLine.color, height: 3 }}/>${refLine.name}</span>`}</div>`}
  </div>`;
}

/* barras horizontais de funil (como a calculadora de prospecção) */
function FunnelBars({ rows, fmt }) {
  const max = Math.max(1, ...rows.map(r => r.v || 0));
  const f = fmt || (v => num(v, v > 0 && v < 10 && v % 1 ? 1 : 0));
  return html`<div>${rows.map((r, i) => html`<div class="fun-row" key=${r.l}>
    <div class="lb">${r.l}</div>
    <div class=${'fun-bar' + ((r.v || 0) / max > 0.25 ? ' first' : '')} onMouseMove=${e => showTip(e, html`<div><b>${r.l}</b>: ${f(r.v || 0)}${r.rate != null ? ' · ' + pct(r.rate) + ' da etapa anterior' : ''}</div>`)} onMouseLeave=${hideTip}>
      <i style=${{ width: clamp(((r.v || 0) / max) * 100, 0, 100) + '%', background: r.c || 'var(--primary-2)' }}/>
      <span>${f(r.v || 0)}${r.rate != null && html`<span style=${{ opacity: .85, fontWeight: 600 }}> · ${pct(r.rate)}</span>`}</span>
    </div></div>`)}</div>`;
}

/* lista de seleção rápida de pessoa/cliente */
function Avatar({ name, size = 30 }) {
  const h = Array.from(name || '?').reduce((a, c) => a + c.charCodeAt(0), 0) % 8 + 1;
  return html`<span style=${{ width: size, height: size, borderRadius: '50%', background: `var(--s${h})`, color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.38, fontWeight: 700, flex: 'none' }}>${initials(name)}</span>`;
}
function copyText(t) {
  (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => toast('Copiado!'), () => { window.prompt('Copie o texto:', t); });
}

/* ---------- gráfico de linhas (eixo único, base zero) ---------- */
function LineChart({ labels, series, h = 200, fmt }) {
  const W = 640, H = h, padL = 54, padB = 24, padT = 12, padR = 14;
  const maxV = Math.max(1, ...series.flatMap(s => s.data.map(v => v || 0)));
  const p10 = Math.pow(10, Math.floor(Math.log10(maxV))); const top = Math.ceil(maxV / p10) * p10;
  const n = labels.length;
  const x = i => (n <= 1 ? padL + (W - padL - padR) / 2 : padL + i * (W - padL - padR) / (n - 1));
  const y = v => padT + (H - padT - padB) * (1 - (v || 0) / top);
  const f = fmt || (v => num(v));
  const [hov, setHov] = useState(null);
  return html`<div>
    <svg class="chart" viewBox=${`0 0 ${W} ${H}`} role="img" aria-label=${series.map(s => s.name).join(', ')} onMouseLeave=${() => { setHov(null); hideTip(); }}>
      ${[0, top / 2, top].map(t => html`<g key=${t}><line class=${t === 0 ? 'axis-0' : 'grid-l'} x1=${padL} x2=${W - padR} y1=${y(t)} y2=${y(t)}/><text x=${padL - 8} y=${y(t) + 4} text-anchor="end">${f(t)}</text></g>`)}
      ${labels.map((lb, i) => (n <= 8 || i % Math.ceil(n / 8) === 0 || i === n - 1) && html`<text key=${'l' + i} x=${x(i)} y=${H - 6} text-anchor="middle">${lb}</text>`)}
      ${hov != null && html`<line x1=${x(hov)} x2=${x(hov)} y1=${padT} y2=${H - padB} stroke="var(--border-strong)" stroke-width="1"/>`}
      ${series.map(s => html`<g key=${s.name}><polyline fill="none" stroke=${s.color} stroke-width="2" stroke-linejoin="round" points=${s.data.map((v, i) => x(i) + ',' + y(v)).join(' ')}/>
        ${s.data.map((v, i) => html`<circle key=${i} cx=${x(i)} cy=${y(v)} r=${hov === i ? 5 : 3.5} fill=${s.color} stroke="var(--surface)" stroke-width="2"/>`)}</g>`)}
      ${labels.map((lb, i) => html`<rect key=${'h' + i} x=${x(i) - (W - padL) / Math.max(1, n) / 2} y=${padT} width=${(W - padL) / Math.max(1, n)} height=${H - padT - padB} fill="transparent"
        onMouseMove=${e => { setHov(i); showTip(e, html`<div><b>${lb}</b>${series.map(s => html`<div key=${s.name}><span class="dot" style=${{ background: s.color, marginRight: 6 }}/>${s.name}: <b>${f(s.data[i] || 0)}</b></div>`)}</div>`); }}/>`)}
    </svg>
    ${series.length > 1 && html`<div class="legend">${series.map(s => html`<span key=${s.name}><i style=${{ background: s.color }}/>${s.name}</span>`)}</div>`}
  </div>`;
}
