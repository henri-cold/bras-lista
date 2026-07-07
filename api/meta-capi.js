import crypto from 'node:crypto';

export const META_PIXEL_ID = '1059139081966059';
export const PRODUCT = {
  id: 'lista-fornecedores-bras',
  title: 'Lista de Fornecedores do Bras',
  value: 19.9,
  currency: 'BRL',
};

function sha256(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return undefined;
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

function clean(value, maxLength = 512) {
  const text = String(value || '').trim();
  if (!text) return undefined;
  return text.slice(0, maxLength);
}

export function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || undefined;
}

export function getCookie(req, name) {
  const cookie = String(req.headers.cookie || '');
  const part = cookie.split(';').map((item) => item.trim()).find((item) => item.startsWith(name + '='));
  return part ? decodeURIComponent(part.slice(name.length + 1)) : undefined;
}

export function getBaseUrl(req) {
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}`;
}

export async function sendMetaEvent(eventName, { req, eventId, eventSourceUrl, userData = {}, customData = {}, eventTime } = {}) {
  const accessToken = String(process.env.META_ACCESS_TOKEN || '').trim();
  if (!accessToken) {
    console.warn('[META_CAPI] skipped: META_ACCESS_TOKEN is not configured');
    return { skipped: true };
  }

  const payload = {
    data: [
      {
        event_name: eventName,
        event_time: eventTime || Math.floor(Date.now() / 1000),
        event_id: clean(eventId, 128),
        action_source: 'website',
        event_source_url: clean(eventSourceUrl, 1000),
        user_data: {
          client_ip_address: clean(userData.client_ip_address || (req ? getClientIp(req) : undefined), 128),
          client_user_agent: clean(userData.client_user_agent || req?.headers?.['user-agent'], 512),
          fbp: clean(userData.fbp || (req ? getCookie(req, '_fbp') : undefined), 255),
          fbc: clean(userData.fbc || (req ? getCookie(req, '_fbc') : undefined), 255),
          em: userData.email ? [sha256(userData.email)] : undefined,
          ph: userData.phone ? [sha256(userData.phone)] : undefined,
          external_id: userData.external_id ? [sha256(userData.external_id)] : undefined,
        },
        custom_data: customData,
      },
    ],
  };

  if (process.env.META_TEST_EVENT_CODE) {
    payload.test_event_code = String(process.env.META_TEST_EVENT_CODE).trim();
  }

  for (const event of payload.data) {
    Object.keys(event).forEach((key) => event[key] === undefined && delete event[key]);
    Object.keys(event.user_data).forEach((key) => event.user_data[key] === undefined && delete event.user_data[key]);
    Object.keys(event.custom_data || {}).forEach((key) => event.custom_data[key] === undefined && delete event.custom_data[key]);
  }

  const apiVersion = String(process.env.META_GRAPH_API_VERSION || 'v22.0').trim();
  const response = await fetch(`https://graph.facebook.com/${apiVersion}/${META_PIXEL_ID}/events?access_token=${encodeURIComponent(accessToken)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error('[META_CAPI] event error', { eventName, status: response.status, data });
    return { ok: false, status: response.status, data };
  }

  console.log('[META_CAPI] event sent', { eventName, eventId, events_received: data.events_received, test_event_code: data.test_event_code });
  return { ok: true, data };
}