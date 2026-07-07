import { getBaseUrl, PRODUCT, sendMetaEvent } from './meta-capi.js';

function getSecret(req) {
  const querySecret = typeof req.query?.secret === 'string' ? req.query.secret : '';
  const headerSecret = typeof req.headers['x-test-secret'] === 'string' ? req.headers['x-test-secret'] : '';
  return querySecret || headerSecret;
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Metodo nao permitido.' });
  }

  const expectedSecret = String(process.env.META_TEST_PURCHASE_SECRET || '').trim();
  if (!expectedSecret) {
    return res.status(404).json({ error: 'Rota de teste desativada.' });
  }

  if (getSecret(req) !== expectedSecret) {
    return res.status(403).json({ error: 'Segredo invalido.' });
  }

  const eventId = `test-purchase-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const result = await sendMetaEvent('Purchase', {
    req,
    eventId,
    eventSourceUrl: getBaseUrl(req),
    userData: {
      external_id: eventId,
    },
    customData: {
      currency: PRODUCT.currency,
      value: PRODUCT.value,
      content_ids: [PRODUCT.id],
      content_name: PRODUCT.title,
      content_type: 'product',
      num_items: 1,
      order_id: eventId,
    },
  });

  return res.status(result?.ok ? 200 : 502).json({
    success: Boolean(result?.ok),
    event_name: 'Purchase',
    event_id: eventId,
    meta: result,
  });
}
