import { getBaseUrl, PRODUCT, sendMetaEvent } from './meta-capi.js';

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    res.setHeader('Allow', 'POST, GET');
    return res.status(405).json({ error: 'Metodo nao permitido.' });
  }

  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const query = req.query || {};
  const paymentId = body?.data?.id || body?.id || query['data.id'] || query.id;
  const topic = body?.type || body?.topic || query.type || query.topic;

  if (!paymentId || !accessToken || !String(topic || '').includes('payment')) {
    return res.status(200).json({ received: true, ignored: true });
  }

  try {
    const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const payment = await mpResponse.json();

    if (!mpResponse.ok) {
      console.error('[MP_WEBHOOK] payment fetch error', payment);
      return res.status(200).json({ received: true, fetched: false });
    }

    console.log('[MP_WEBHOOK] payment', {
      id: payment.id,
      status: payment.status,
      status_detail: payment.status_detail,
      external_reference: payment.external_reference,
      amount: payment.transaction_amount,
      email: payment.payer?.email,
    });

    if (payment.status === 'approved') {
      const metadata = payment.metadata || {};
      const eventId = `purchase-${payment.id}`;
      await sendMetaEvent('Purchase', {
        req,
        eventId,
        eventSourceUrl: metadata.meta_event_source_url || getBaseUrl(req),
        userData: {
          email: payment.payer?.email,
          external_id: payment.payer?.id || payment.external_reference,
          fbp: metadata.meta_fbp,
          fbc: metadata.meta_fbc,
          client_ip_address: metadata.meta_client_ip,
          client_user_agent: metadata.meta_client_user_agent,
        },
        customData: {
          currency: payment.currency_id || PRODUCT.currency,
          value: Number(payment.transaction_amount || PRODUCT.value),
          content_ids: [metadata.product_id || PRODUCT.id],
          content_name: PRODUCT.title,
          content_type: 'product',
          num_items: 1,
          order_id: String(payment.id),
        },
      }).catch((error) => console.error('[META_CAPI] Purchase failed', error?.message || error));
    }

    return res.status(200).json({ received: true, status: payment.status });
  } catch (error) {
    console.error('[MP_WEBHOOK] error', error?.message || error);
    return res.status(200).json({ received: true, error: true });
  }
}
