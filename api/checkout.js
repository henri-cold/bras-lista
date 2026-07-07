import { getBaseUrl, getClientIp, getCookie, PRODUCT as META_PRODUCT, sendMetaEvent } from './meta-capi.js';

const PRODUCT = {
  id: META_PRODUCT.id,
  title: META_PRODUCT.title,
  description: 'Acesso a lista premium de fornecedores de moda feminina do Bras',
  quantity: 1,
  unit_price: META_PRODUCT.value,
  currency_id: META_PRODUCT.currency,
};

function sendHtml(res, status, html) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(html);
}

function getParam(req, name) {
  const value = req.method === 'POST' ? req.body?.[name] : req.query?.[name];
  return typeof value === 'string' ? value.trim() : '';
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return sendHtml(res, 405, 'Metodo nao permitido.');
  }

  const accessToken = String(process.env.MERCADOPAGO_ACCESS_TOKEN || '').trim();
  if (!accessToken) {
    return sendHtml(res, 500, '<h1>Checkout nao configurado</h1><p>Configure a variavel MERCADOPAGO_ACCESS_TOKEN na Vercel.</p>');
  }

  const baseUrl = getBaseUrl(req);
  const externalReference = `bras-lista-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const eventId = getParam(req, 'event_id') || `checkout-${externalReference}`;
  const fbp = getParam(req, 'fbp') || getCookie(req, '_fbp');
  const fbc = getParam(req, 'fbc') || getCookie(req, '_fbc');
  const eventSourceUrl = getParam(req, 'event_source_url') || req.headers.referer || baseUrl;
  const clientIp = getClientIp(req);
  const clientUserAgent = req.headers['user-agent'];

  const preference = {
    items: [PRODUCT],
    external_reference: externalReference,
    notification_url: `${baseUrl}/api/mercadopago-webhook`,
    back_urls: {
      success: `${baseUrl}/api/acesso`,
      pending: `${baseUrl}/checkout-retorno.html?status=pending`,
      failure: `${baseUrl}/checkout-retorno.html?status=failure`,
    },
    auto_return: 'approved',
    statement_descriptor: 'BRAS LISTA',
    metadata: {
      product_id: PRODUCT.id,
      source: 'site_bras_lista',
      meta_checkout_event_id: eventId,
      meta_fbp: fbp,
      meta_fbc: fbc,
      meta_client_ip: clientIp,
      meta_client_user_agent: String(clientUserAgent || '').slice(0, 512),
      meta_event_source_url: eventSourceUrl,
    },
  };

  await sendMetaEvent('InitiateCheckout', {
    req,
    eventId,
    eventSourceUrl,
    userData: { fbp, fbc, client_ip_address: clientIp, client_user_agent: clientUserAgent },
    customData: {
      currency: PRODUCT.currency_id,
      value: PRODUCT.unit_price,
      content_ids: [PRODUCT.id],
      content_name: PRODUCT.title,
      content_type: 'product',
      num_items: PRODUCT.quantity,
    },
  }).catch((error) => console.error('[META_CAPI] InitiateCheckout failed', error?.message || error));

  const mpResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(preference),
  });

  const data = await mpResponse.json().catch(() => ({}));
  if (!mpResponse.ok) {
    console.error('[MP_CHECKOUT] preference error', data);
    const message = data?.message || data?.error || data?.cause?.[0]?.description || 'Erro desconhecido do Mercado Pago.';
    const safeMessage = String(message).replace(/[<>]/g, '');
    return sendHtml(
      res,
      502,
      `<h1>Falha ao iniciar checkout</h1><p>Mercado Pago respondeu: ${safeMessage}</p><p>Status: ${mpResponse.status}</p>`,
    );
  }

  const checkoutUrl = data.init_point || data.sandbox_init_point;
  if (!checkoutUrl) {
    console.error('[MP_CHECKOUT] preference without init_point', data);
    return sendHtml(res, 502, '<h1>Checkout indisponivel</h1><p>Mercado Pago nao retornou o link de pagamento.</p>');
  }

  res.statusCode = 302;
  res.setHeader('Location', checkoutUrl);
  res.end();
}
