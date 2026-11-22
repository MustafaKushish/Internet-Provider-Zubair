/**
 * VAPID: هوية الخادم أمام خدمة الإشعارات (FCM وMozilla وApple). JWT موقّع بـ ES256 عبر WebCrypto.
 * نرسل «نبضة» فارغة بلا حمولة مشفّرة، والمتصفح يجلب نص الإشعار من /api/push/digest.
 */

const enc = new TextEncoder();

export const b64u = (data: ArrayBuffer | Uint8Array): string => {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

export interface VapidKeys {
  privateJwk: JsonWebKey;
  publicKey: string; // النقطة غير المضغوطة (65 بايت) بصيغة base64url — هي applicationServerKey
}

export async function generateVapidKeys(): Promise<VapidKeys> {
  const pair = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])) as CryptoKeyPair;
  const privateJwk = (await crypto.subtle.exportKey('jwk', pair.privateKey)) as JsonWebKey;
  const publicKey = b64u((await crypto.subtle.exportKey('raw', pair.publicKey)) as ArrayBuffer);
  return { privateJwk, publicKey };
}

export async function createVapidJwt(privateJwk: JsonWebKey, audience: string, subject: string, now: number = Date.now(), ttlSeconds = 12 * 3600): Promise<string> {
  const header = b64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const payload = b64u(enc.encode(JSON.stringify({ aud: audience, exp: Math.floor(now / 1000) + ttlSeconds, sub: subject })));
  const key = await crypto.subtle.importKey('jwk', privateJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(`${header}.${payload}`));
  return `${header}.${payload}.${b64u(sig)}`; // التوقيع بصيغة r||s كما يطلب JWT
}

export async function vapidAuthorization(keys: VapidKeys, endpoint: string, subject: string, now?: number): Promise<string> {
  const jwt = await createVapidJwt(keys.privateJwk, new URL(endpoint).origin, subject, now);
  return `vapid t=${jwt}, k=${keys.publicKey}`;
}
