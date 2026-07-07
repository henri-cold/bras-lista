import { PRODUCT, sendMetaEvent } from './meta-capi.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Metodo nao permitido.' });
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const eventName = String(body.event_name || '').trim();
  if (eventName !== 'ViewContent') {
    return res.status(400).json({ error: 'Evento nao permitido.' });
  }

  await sendMetaEvent('ViewContent', {
    req,
    eventId: body.event_id,
    eventSourceUrl: body.event_source_url,
    userData: {
      fbp: body.fbp,
      fbc: body.fbc,
    },
    customData: {
      currency: PRODUCT.currency,
      value: PRODUCT.value,
      content_ids: [PRODUCT.id],
      content_name: PRODUCT.title,
      content_type: 'product',
    },
  }).catch((error) => console.error('[META_CAPI] ViewContent failed', error?.message || error));

  return res.status(200).json({ received: true });
}