// Ponte segura Visions OS -> Asaas. A chave fica em variável de ambiente do Netlify (ASAAS_API_KEY),
// nunca no navegador. Toda chamada exige o segredo VOS_SECRET no cabeçalho x-vos-secret.
import { ASAAS_BASE, json, snapshot, saveSnapshot, getFetch } from '../shared/asaas-shared.mjs';

async function asaas(path, opts = {}, fetchImpl) {
  const r = await (fetchImpl || getFetch())(ASAAS_BASE() + path, {
    method: opts.method || 'GET',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'VisionsOS', access_token: process.env.ASAAS_API_KEY },
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  const txt = await r.text(); let data = null; try { data = txt ? JSON.parse(txt) : null; } catch (e) { data = { raw: txt }; }
  if (!r.ok) {
    const msg = data && data.errors ? data.errors.map(e => e.description).join(' · ') : 'Erro HTTP ' + r.status;
    const err = new Error(msg); err.status = r.status; throw err;
  }
  return data;
}
const q = o => Object.entries(o).filter(([, v]) => v !== undefined && v !== '' && v !== null).map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v)).join('&');

export const ACTIONS = {
  async ping(_, f) { const b = await asaas('/finance/balance', {}, f); return { ok: true, balance: b.balance, env: process.env.ASAAS_ENV || 'production' }; },
  async findOrCreateCustomer(p, f) {
    const doc = String(p.cpfCnpj || '').replace(/\D/g, '');
    if (!doc) throw Object.assign(new Error('CPF/CNPJ obrigatório para cobrar pelo Asaas.'), { status: 400 });
    const found = await asaas('/customers?' + q({ cpfCnpj: doc }), {}, f);
    if (found.data && found.data.length) return { id: found.data[0].id, created: false };
    const c = await asaas('/customers', { method: 'POST', body: { name: p.name, cpfCnpj: doc, email: p.email || undefined, mobilePhone: (p.phone || '').replace(/\D/g, '') || undefined, externalReference: p.externalReference, notificationDisabled: false } }, f);
    return { id: c.id, created: true };
  },
  async createPayment(p, f) {
    const body = { customer: p.customer, billingType: p.billingType || 'UNDEFINED', value: Number(p.value), dueDate: p.dueDate, description: p.description, externalReference: p.externalReference };
    if (p.fine) body.fine = { value: Number(p.fine) };
    if (p.interest) body.interest = { value: Number(p.interest) };
    const pay = await asaas('/payments', { method: 'POST', body }, f);
    await saveSnapshot(pay, f);
    return snapshot(pay);
  },
  async listPayments(p, f) {
    const out = []; let offset = 0; let more = true; let guard = 0;
    while (more && guard++ < 30) {
      const r = await asaas('/payments?' + q({ 'dueDate[ge]': p.dueFrom, 'dueDate[le]': p.dueTo, offset, limit: 100 }), {}, f);
      (r.data || []).forEach(x => out.push(snapshot(x)));
      more = !!r.hasMore; offset += 100;
    }
    return { payments: out };
  },
  async getPayment(p, f) { return snapshot(await asaas('/payments/' + encodeURIComponent(p.id), {}, f)); },
  async updatePayment(p, f) {
    const body = {}; if (p.value != null) body.value = Number(p.value); if (p.dueDate) body.dueDate = p.dueDate; if (p.description) body.description = p.description;
    const pay = await asaas('/payments/' + encodeURIComponent(p.id), { method: 'PUT', body }, f); await saveSnapshot(pay, f); return snapshot(pay);
  },
  async deletePayment(p, f) { await asaas('/payments/' + encodeURIComponent(p.id), { method: 'DELETE' }, f); const pay = await asaas('/payments/' + encodeURIComponent(p.id), {}, f).catch(() => null); if (pay) await saveSnapshot(pay, f); return { ok: true }; },
  async receiveInCash(p, f) {
    const pay = await asaas('/payments/' + encodeURIComponent(p.id) + '/receiveInCash', { method: 'POST', body: { paymentDate: p.paymentDate, value: Number(p.value), notifyCustomer: false } }, f);
    await saveSnapshot(pay, f); return snapshot(pay);
  }
};

export async function handler(event) {
  // Atenção: o Netlify passa (event, context, callback) — não usar o 3º parâmetro como fetch.
  const f = getFetch();
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, body: '' };
  if (event.httpMethod !== 'POST') return json(405, { error: 'Use POST' });
  if (!process.env.ASAAS_API_KEY || !process.env.VOS_SECRET) return json(500, { error: 'Configure ASAAS_API_KEY e VOS_SECRET nas variáveis de ambiente do Netlify.' });
  const h = event.headers || {};
  if ((h['x-vos-secret'] || h['X-Vos-Secret']) !== process.env.VOS_SECRET) return json(401, { error: 'Segredo inválido. Confira em Configurações → Asaas.' });
  let body; try { body = JSON.parse(event.body || '{}'); } catch (e) { return json(400, { error: 'JSON inválido' }); }
  const fn = ACTIONS[body.action];
  if (!fn) return json(400, { error: 'Ação desconhecida: ' + body.action });
  try { return json(200, await fn(body.params || {}, f)); }
  catch (e) { return json(e.status && e.status < 500 ? e.status : 502, { error: e.message }); }
}
