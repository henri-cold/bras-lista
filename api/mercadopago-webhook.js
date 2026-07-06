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

    return res.status(200).json({ received: true, status: payment.status });
  } catch (error) {
    console.error('[MP_WEBHOOK] error', error?.message || error);
    return res.status(200).json({ received: true, error: true });
  }
}
