import { verifyAccessToken } from './access-token.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Metodo nao permitido.' });
  }

  const token = typeof req.query?.token === 'string' ? req.query.token : '';
  const verification = verifyAccessToken(token);
  if (!verification.valid) {
    return res.status(403).json({ valid: false, reason: verification.reason });
  }

  return res.status(200).json({ valid: true, payment_id: verification.payload.payment_id, expires_at: verification.payload.exp });
}