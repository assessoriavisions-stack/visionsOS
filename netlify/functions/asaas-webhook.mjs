// Webhook do Asaas: a cada evento de cobrança (criada, paga, vencida, estornada...)
// grava uma cópia da cobrança no Firebase (vos7_asaas). O Visions OS concilia a partir disso.
// Configure no Asaas: Integrações → Webhooks → URL = https://SEU-SITE.netlify.app/.netlify/functions/asaas-webhook
// e o "Token de autenticação" igual à variável ASAAS_WEBHOOK_TOKEN.
import { json, saveSnapshot } from './_asaas-shared.mjs';

export async function handler(event, _ctx, fetchImpl) {
  const f = fetchImpl || fetch;
  if (event.httpMethod !== 'POST') return json(405, { error: 'Use POST' });
  const h = event.headers || {};
  const tok = h['asaas-access-token'] || h['Asaas-Access-Token'];
  if (!process.env.ASAAS_WEBHOOK_TOKEN || tok !== process.env.ASAAS_WEBHOOK_TOKEN) return json(401, { error: 'token inválido' });
  let body; try { body = JSON.parse(event.body || '{}'); } catch (e) { return json(200, { ignored: 'json inválido' }); }
  if (body.payment) {
    const p = Object.assign({}, body.payment);
    if (body.event === 'PAYMENT_DELETED') p.deleted = true;
    try { await saveSnapshot(p, f); } catch (e) { console.error('Falha ao gravar no Firebase', e); return json(500, { error: 'firebase' }); }
  }
  return json(200, { received: true }); // responder rápido: o Asaas pausa a fila se receber erros
}
