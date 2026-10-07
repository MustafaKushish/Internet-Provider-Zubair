// أدوات التواريخ بالتوقيت المحلي (العراق UTC+3)
// ملاحظة: toISOString() يحوّل إلى UTC فيُرجع اليوم السابق بعد منتصف الليل محلياً،
// لذلك نبني التاريخ دائماً من مكوّنات التوقيت المحلي.

const pad = (n: number) => String(n).padStart(2, '0');

/** يحوّل كائن Date إلى نص YYYY-MM-DD حسب التوقيت المحلي */
export function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** تاريخ اليوم المحلي بصيغة YYYY-MM-DD */
export function todayStr(): string {
  return toLocalDateStr(new Date());
}

/** يقرأ نص YYYY-MM-DD كتاريخ محلي (منتصف الليل المحلي) */
export function parseLocalDate(str: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(str || '');
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(str);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** يضيف أشهراً تقويمية مع تثبيت اليوم عند نهاية الشهر (31 يناير + شهر = 28/29 فبراير) */
export function addMonthsToDateStr(dateStr: string, months: number): string {
  const d = parseLocalDate(dateStr);
  const day = d.getDate();
  const target = new Date(d.getFullYear(), d.getMonth() + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(day, lastDay));
  return toLocalDateStr(target);
}

/** فرق الأيام بين تاريخين (b - a) */
export function diffDays(a: string, b: string): number {
  return Math.round((parseLocalDate(b).getTime() - parseLocalDate(a).getTime()) / 86400000);
}

/** معرّف فريد آمن من التكرار */
export function uid(prefix: string): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
      : Math.random().toString(36).slice(2, 14);
  return `${prefix}_${Date.now().toString(36)}_${rand}`;
}
