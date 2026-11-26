// Utilidades compartilhadas pelas funções do Asaas (Netlify Functions).
// fetch usado pelas funções (testes podem trocar por globalThis.__vosFetch)
export const getFetch = () => globalThis.__vosFetch || globalThis.fetch;
export const ASAAS_BASE = () => (process.env.ASAAS_ENV === 'sandbox' ? 'https://api-sandbox.asaas.com/v3' : 'https://api.asaas.com/v3');
export const FIREBASE_URL = () => (process.env.FIREBASE_URL || 'https://visions-os2-default-rtdb.firebaseio.com').replace(/\/$/, '');

// Só os campos que o Visions OS usa (não guarda dados de cartão etc.)
export function snapshot(p) {
  if (!p || !p.id) return null;
  const keep = ['id', 'customer', 'value', 'netValue', 'status', 'dueDate', 'originalDueDate', 'paymentDate', 'clientPaymentDate', 'confirmedDate',
    'billingType', 'invoiceUrl', 'bankSlipUrl', 'externalReference', 'description', 'deleted', 'subscription', 'installment', 'invoiceNumber'];
  const o = {};
  keep.forEach(k => { if (p[k] !== undefined && p[k] !== null) o[k] = p[k]; });
  o.syncedAt = new Date().toISOString();
  return o;
}
export const json = (status, body) => ({ statusCode: status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(body) });
const fkey = id => String(id).replace(/[.$#\[\]\/]/g, '_');
export async function saveSnapshot(p, fetchImpl) {
  fetchImpl = fetchImpl || getFetch();
  const s = snapshot(p); if (!s) return null;
  await fetchImpl(FIREBASE_URL() + '/vos/vos7_asaas/' + fkey(s.id) + '.json', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(s) });
  return s;
}
