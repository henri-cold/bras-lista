import { createAccessToken } from './access-token.js';
import { getBaseUrl } from './meta-capi.js';

function sendHtml(res, status, html) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(html);
}

function page(title, message, actionHtml = '') {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title><style>body{margin:0;font-family:Arial,sans-serif;background:#0f172a;color:#fff;display:grid;place-items:center;min-height:100vh;padding:24px}main{max-width:560px;background:#111827;border:1px solid rgba(255,255,255,.12);border-radius:12px;padding:28px;box-shadow:0 20px 60px rgba(0,0,0,.35)}h1{margin:0 0 12px;font-size:28px}p{line-height:1.6;color:#d1d5db}.btn{display:inline-block;margin-top:14px;background:#22c55e;color:#04130a;text-decoration:none;font-weight:700;padding:13px 18px;border-radius:8px}</style></head><body><main><h1>${title}</h1><p>${message}</p>${actionHtml}</main></body></html>`;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return sendHtml(res, 405, 'Metodo nao permitido.');
  }

  const accessToken = String(process.env.MERCADOPAGO_ACCESS_TOKEN || '').trim();
  if (!accessToken) {
    return sendHtml(res, 500, page('Acesso indisponivel', 'O checkout ainda nao esta configurado.'));
  }

  const paymentId = req.query?.payment_id || req.query?.collection_id || req.query?.id;
  if (!paymentId) {
    return sendHtml(res, 400, page('Pagamento nao encontrado', 'Nao recebemos o identificador do pagamento. Se voce pagou, fale com o suporte enviando o comprovante.'));
  }

  try {
    const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const payment = await mpResponse.json().catch(() => ({}));

    if (!mpResponse.ok) {
      console.error('[ACCESS] payment fetch error', { paymentId, payment });
      return sendHtml(res, 502, page('Erro ao validar pagamento', 'Nao conseguimos validar seu pagamento agora. Tente atualizar a pagina em alguns instantes.'));
    }

    if (payment.status === 'approved') {
      const token = createAccessToken({ paymentId: payment.id, externalReference: payment.external_reference });
      res.statusCode = 302;
      res.setHeader('Location', `${getBaseUrl(req)}/acesso.html?token=${encodeURIComponent(token)}`);
      return res.end();
    }

    if (payment.status === 'pending' || payment.status === 'in_process') {
      return sendHtml(res, 200, page('Pagamento pendente', 'Seu pagamento ainda esta sendo confirmado pelo Mercado Pago. Se foi Pix, aguarde alguns instantes e atualize esta pagina.'));
    }

    return sendHtml(res, 403, page('Pagamento nao aprovado', 'O Mercado Pago nao confirmou esse pagamento como aprovado. Volte ao checkout e tente novamente.'));
  } catch (error) {
    console.error('[ACCESS] error', error?.message || error);
    return sendHtml(res, 500, page('Erro ao liberar acesso', 'Nao conseguimos liberar seu acesso agora. Tente novamente em alguns instantes.'));
  }
}