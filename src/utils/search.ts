import { Subscriber } from '../types/isp';

/**
 * بحث متسامح بالعربية: يوحّد أشكال الألف والتاء المربوطة والياء، ويحوّل الأرقام العربية-الهندية
 * (٠١٢…) إلى أرقام لاتينية، فيجد «احمد» عند البحث عن «أحمد» والعكس.
 */
export function normalizeSearch(text: string): string {
  return (text || '')
    .toLowerCase()
    .replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 0x06F0))
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[ً-ٟـ]/g, '') // التشكيل والتطويل
    .replace(/\s+/g, ' ')
    .trim();
}

/** أرقام الهاتف بدون رمز الدولة والصفر الأول: 07801234567 و +964 780 123 4567 متطابقان */
function phoneDigits(text: string): string {
  return normalizeSearch(text).replace(/\D/g, '').replace(/^00964|^964/, '').replace(/^0+/, '');
}

/** هل يطابق المشترك نص البحث؟ (الاسم، الهاتف، اليوزر، الآي بي، الماك، البرج، العنوان) */
export function matchesSubscriber(sub: Subscriber, query: string): boolean {
  const q = normalizeSearch(query);
  if (!q) return true;
  const fields = [sub.name, sub.username, sub.ipAddress, sub.macAddress, sub.towerName, sub.address, sub.planName];
  if (fields.some(f => f && normalizeSearch(f).includes(q))) return true;
  const digits = phoneDigits(query);
  return digits.length >= 3 && !!sub.phone && phoneDigits(sub.phone).includes(digits);
}
