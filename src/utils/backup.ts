import { todayStr } from './dates';

const LAST_BACKUP_KEY = 'sas_plus_last_backup_at_v1';
const SNOOZE_KEY = 'sas_plus_backup_snooze_until_v1';
/** تذكير المدير بأخذ نسخة احتياطية إذا مرّ أسبوع على آخر نسخة */
export const BACKUP_REMINDER_DAYS = 7;

/** تنزيل نسخة احتياطية كاملة (JSON) وتسجيل وقتها */
export function downloadFullBackup(data: Record<string, unknown>): void {
  const backup = { version: '1.2', exportedAt: new Date().toISOString(), ...data };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `منظومة_إنترنت_نسخة_احتياطية_${todayStr()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  try { localStorage.setItem(LAST_BACKUP_KEY, String(Date.now())); } catch { /* التخزين غير متاح */ }
}

/** عدد الأيام منذ آخر نسخة على هذا الجهاز (null = لم تُؤخذ نسخة بعد) */
export function daysSinceBackup(): number | null {
  try {
    const v = Number(localStorage.getItem(LAST_BACKUP_KEY));
    return v ? Math.floor((Date.now() - v) / 86_400_000) : null;
  } catch {
    return null;
  }
}

export function backupReminderDue(): boolean {
  try {
    if (Number(localStorage.getItem(SNOOZE_KEY)) > Date.now()) return false;
  } catch { /* ignore */ }
  const d = daysSinceBackup();
  return d === null || d >= BACKUP_REMINDER_DAYS;
}

export function snoozeBackupReminder(days = 3): void {
  try { localStorage.setItem(SNOOZE_KEY, String(Date.now() + days * 86_400_000)); } catch { /* ignore */ }
}
