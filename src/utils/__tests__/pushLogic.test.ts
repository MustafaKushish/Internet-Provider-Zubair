import { describe, expect, it } from 'vitest';
import { baghdadToday, computeDigest, digestText, worthSending } from '../../../shared/digest';
import { b64u, createVapidJwt, generateVapidKeys, vapidAuthorization } from '../../../shared/vapid';

const T = '2026-06-15';
const sub = (expiryDate: string, over: Record<string, unknown> = {}) => ({ expiryDate, salePrice: 40000, paidAmount: 40000, ...over });

describe('daily digest', () => {
  it('counts expiring soon, newly expired and debts; ignores archived and long expired', () => {
    const d = computeDigest([
      sub('2026-06-15'), sub('2026-06-18'), sub('2026-06-19'),        // today, +3 (warn=3), +4
      sub('2026-06-14'), sub('2026-06-13'), sub('2026-06-12'),        // -1, -2, -3
      sub('2026-06-16', { archived: true }),
      sub('2026-08-01', { paidAmount: 10000, carriedDebt: 5000 }),    // debt 35,000
    ], 3, T);
    expect(d.expiring).toBe(2);
    expect(d.newlyExpired).toBe(2);
    expect(d.debtors).toBe(1);
    expect(d.debtTotal).toBe(35000);
  });

  it('only sends when something expires; debts alone are not enough', () => {
    expect(worthSending(computeDigest([sub('2026-09-01', { paidAmount: 0 })], 3, T))).toBe(false);
    expect(worthSending(computeDigest([sub('2026-06-16')], 3, T))).toBe(true);
  });

  it('text has numbers only (no names) and a friendly empty message', () => {
    const t = digestText({ expiring: 3, newlyExpired: 1, debtors: 5, debtTotal: 405000 });
    expect(t.body).toBe('ينتهي قريباً: 3 • انتهى مؤخراً: 1 • ديون: 405,000 د.ع (5 مدين)');
    expect(digestText({ expiring: 0, newlyExpired: 0, debtors: 0, debtTotal: 0 }).body).toContain('تعمل');
  });

  it('uses the Baghdad date (UTC+3) for the cron', () => {
    expect(baghdadToday(Date.UTC(2026, 5, 15, 22, 30))).toBe('2026-06-16'); // 22:30 UTC = 01:30 next day in Baghdad
    expect(baghdadToday(Date.UTC(2026, 5, 15, 4, 0))).toBe('2026-06-15');
  });
});

describe('VAPID', () => {
  it('creates a verifiable ES256 JWT with the right claims', async () => {
    const keys = await generateVapidKeys();
    expect(keys.publicKey.length).toBeGreaterThan(80); // 65 bytes in base64url
    const now = Date.UTC(2026, 5, 15);
    const jwt = await createVapidJwt(keys.privateJwk, 'https://fcm.googleapis.com', 'https://example.workers.dev', now);
    const [h, p, s] = jwt.split('.');
    const fromB64u = (x: string) => Uint8Array.from(atob(x.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
    expect(JSON.parse(new TextDecoder().decode(fromB64u(h)))).toEqual({ typ: 'JWT', alg: 'ES256' });
    const claims = JSON.parse(new TextDecoder().decode(fromB64u(p)));
    expect(claims).toEqual({ aud: 'https://fcm.googleapis.com', exp: Math.floor(now / 1000) + 12 * 3600, sub: 'https://example.workers.dev' });
    expect(fromB64u(s).length).toBe(64); // r||s, not DER
    const pub = await crypto.subtle.importKey('raw', fromB64u(keys.publicKey), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pub, fromB64u(s), new TextEncoder().encode(`${h}.${p}`));
    expect(ok).toBe(true);
  });

  it('builds the Authorization header from the endpoint origin', async () => {
    const keys = await generateVapidKeys();
    const header = await vapidAuthorization(keys, 'https://updates.push.services.mozilla.com/wpush/v2/abc', 'https://x.dev');
    expect(header).toMatch(/^vapid t=[\w-]+\.[\w-]+\.[\w-]+, k=[\w-]+$/);
    expect(header.endsWith(`k=${keys.publicKey}`)).toBe(true);
    expect(b64u(new Uint8Array([251, 255]))).toBe('-_8'); // url-safe, no padding
  });
});
