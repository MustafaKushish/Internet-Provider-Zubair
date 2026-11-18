import { PaymentRecord, Subscriber, SystemSettings } from '../types/isp';
import { installmentMessage, planProgress } from './installments';
import { formatCurrency, getRemainingDebt, getWhatsAppTemplates } from './storage';

export type ReminderType = 'expiry' | 'expired' | 'debt';

/**
 * نص رسالة التذكير: من عنده خطة تقسيط تُرسل له رسالة القسط، ومن أخلف وعداً يُذكَّر به،
 * ومن ديونه كبيرة يُعرض عليه التسديد على دفعات (suggested = المبلغ المقترح الآن).
 */
export function reminderMessage(
  sub: Subscriber, type: ReminderType, settings: SystemSettings, payments: PaymentRecord[],
  extra: { suggested?: number; brokenPromise?: string | null } = {},
): string {
  const pr = type === 'debt' ? planProgress(sub, payments) : null;
  if (pr && pr.status !== 'done') return installmentMessage(sub, pr, settings);
  const t = getWhatsAppTemplates(sub, settings);
  if (type !== 'debt') return type === 'expired' ? t.expiredNotice : t.expiryReminder;
  const debt = getRemainingDebt(sub);
  const lines = [t.debtReminder];
  const tail: string[] = [];
  if (extra.brokenPromise) tail.push(`نذكّرك بوعدك بالتسديد بتاريخ ${extra.brokenPromise}.`);
  if (extra.suggested && extra.suggested < debt) tail.push(`يمكنك التسديد على دفعات، ونكتفي الآن بـ ${formatCurrency(extra.suggested, settings.currency)}.`);
  if (tail.length) lines.splice(1, 0, tail.join('\n'));
  return lines.join('\n\n');
}
