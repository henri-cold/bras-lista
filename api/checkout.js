const PRODUCT = {
  id: 'lista-fornecedores-bras',
  title: 'Lista de Fornecedores do Bras',
  description: 'Acesso a lista premium de fornecedores de moda feminina do Bras',
  unit_price: 19.9,
  currency_id: 'BRL',
};

function getBaseUrl(req) {
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}`;
}

function sendHtml(res, status, html) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(html);
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return sendHtml(res, 405, 'Metodo nao permitido.');
  }

  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!accessToken) {
    return sendHtml(res, 500, '<h1>Checkout nao configurado</h1><p>Configure a variavel MERCADOPAGO_ACCESS_TOKEN na Vercel.</p>');
  }

  const baseUrl = getBaseUrl(req);
  const externalReference = `bras-lista-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const preference = {
    items: [PRODUCT],
    external_reference: externalReference,
    notification_url: `${baseUrl}/api/mercadopago-webhook`,
    back_urls: {
      success: `${baseUrl}/checkout-retorno.html?status=success`,
      pending: `${baseUrl}/checkout-retorno.html?status=pending`,
      failure: `${baseUrl}/checkout-retorno.html?status=failure`,
    },
    auto_return: 'approved',
    statement_descriptor: 'BRAS LISTA',
    metadata: {
      product_id: PRODUCT.id,
      source: 'site_bras_lista',
    },
  };

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
    return sendHtml(res, 502, '<h1>Falha ao iniciar checkout</h1><p>Tente novamente em alguns instantes.</p>');
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
