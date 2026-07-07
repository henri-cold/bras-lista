import crypto from 'node:crypto';

function getSecret() {
  const secret = String(process.env.PRODUCT_ACCESS_SECRET || process.env.MERCADOPAGO_ACCESS_TOKEN || '').trim();
  if (!secret) throw new Error('PRODUCT_ACCESS_SECRET nao configurado.');
  return secret;
}

function signPayload(payload) {
  return crypto.createHmac('sha256', getSecret()).update(payload).digest('base64url');
}

export function createAccessToken({ paymentId, externalReference, expiresInSeconds = 60 * 60 * 24 * 7 }) {
  const payload = {
    payment_id: String(paymentId),
    external_reference: externalReference ? String(externalReference) : undefined,
    product_id: 'lista-fornecedores-bras',
    exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return encoded + '.' + signPayload(encoded);
}

export function verifyAccessToken(token) {
  const [encoded, signature] = String(token || '').split('.');
  if (!encoded || !signature) return { valid: false, reason: 'invalid_format' };

  const expected = signPayload(encoded);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(actualBuffer, expectedBuffer)) {
    return { valid: false, reason: 'invalid_signature' };
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  } catch {
    return { valid: false, reason: 'invalid_payload' };
  }

  if (!payload?.payment_id || payload.product_id !== 'lista-fornecedores-bras') {
    return { valid: false, reason: 'invalid_product' };
  }

  if (Number(payload.exp || 0) < Math.floor(Date.now() / 1000)) {
    return { valid: false, reason: 'expired' };
  }

  return { valid: true, payload };
}