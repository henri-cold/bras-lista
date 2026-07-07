import { createAccessToken } from './access-token.js';
import { getBaseUrl } from './meta-capi.js';

function getSecret(req) {
  const querySecret = typeof req.query?.secret === 'string' ? req.query.secret : '';
  const headerSecret = typeof req.headers['x-preview-secret'] === 'string' ? req.headers['x-preview-secret'] : '';
  return querySecret || headerSecret;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Metodo nao permitido.' });
  }

  const expectedSecret = String(process.env.PREVIEW_ACCESS_SECRET || '').trim();
  if (!expectedSecret) {
    return res.status(404).json({ error: 'Preview desativado.' });
  }

  if (getSecret(req) !== expectedSecret) {
    return res.status(403).json({ error: 'Segredo invalido.' });
  }

  const token = createAccessToken({
    paymentId: `preview-${Date.now()}`,
    externalReference: 'preview-access',
    expiresInSeconds: 60 * 60,
  });

  res.statusCode = 302;
  res.setHeader('Location', `${getBaseUrl(req)}/acesso.html?token=${encodeURIComponent(token)}`);
  res.end();
}