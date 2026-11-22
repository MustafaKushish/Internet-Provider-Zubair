/**
 * ملخص التنبيهات اليومي للإشعارات: أرقام فقط (بدون أسماء) حتى لا تظهر بيانات المشتركين على شاشة القفل.
 * دوال صرفة تعمل في الخادم (cron) وفي الاختبارات. لا تستورد شيئاً من src أو worker.
 */

export interface DigestSubscriber {
  expiryDate?: string;
  archived?: boolean;
  salePrice?: number;
  cycleMonths?: number;
  carriedDebt?: number;
  paidAmount?: number;
}

export interface Digest {
  expiring: number;     // ينتهي اليوم أو خلال أيام التنبيه
  newlyExpired: number; // انتهى قبل يوم أو يومين
  debtors: number;
  debtTotal: number;
}

const dayNum = (s?: string): number => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || '');
  return m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 86400000 : NaN;
};

/** تاريخ اليوم في بغداد (UTC+3) بصيغة YYYY-MM-DD، لأن cron يعمل بتوقيت UTC */
export function baghdadToday(now: number = Date.now()): string {
  return new Date(now + 3 * 3600_000).toISOString().slice(0, 10);
}

export function computeDigest(subs: DigestSubscriber[], warningDays: number, today: string): Digest {
  const d: Digest = { expiring: 0, newlyExpired: 0, debtors: 0, debtTotal: 0 };
  const t = dayNum(today);
  for (const s of subs) {
    if (s.archived) continue;
    const left = dayNum(s.expiryDate) - t;
    if (left >= 0 && left <= warningDays) d.expiring++;
    else if (left < 0 && left >= -2) d.newlyExpired++;
    const debt = Math.max(0, (s.salePrice || 0) * (s.cycleMonths && s.cycleMonths > 0 ? s.cycleMonths : 1) + (s.carriedDebt || 0) - (s.paidAmount || 0));
    if (debt > 0) { d.debtors++; d.debtTotal += debt; }
  }
  return d;
}

/** هل يستحق الملخص إرسال إشعار؟ (الديون وحدها لا تكفي حتى لا يتكرر الإشعار كل يوم) */
export const worthSending = (d: Digest): boolean => d.expiring > 0 || d.newlyExpired > 0;

export function digestText(d: Digest, ispName = 'أولاد كشيش'): { title: string; body: string } {
  const parts: string[] = [];
  if (d.expiring > 0) parts.push(`ينتهي قريباً: ${d.expiring}`);
  if (d.newlyExpired > 0) parts.push(`انتهى مؤخراً: ${d.newlyExpired}`);
  if (d.debtors > 0) parts.push(`ديون: ${d.debtTotal.toLocaleString('en-US')} د.ع (${d.debtors} مدين)`);
  return {
    title: `تنبيهات ${ispName}`,
    body: parts.length ? parts.join(' • ') : 'لا توجد اشتراكات تنتهي قريباً. الإشعارات تعمل ✅',
  };
}
