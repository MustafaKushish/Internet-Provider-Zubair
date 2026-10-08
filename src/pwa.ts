import { PREVIEW_MODE } from './sync/api';

/**
 * تثبيت المنظومة كتطبيق (PWA) على أندرويد وآيفون وويندوز
 * - أندرويد/ويندوز (Chrome وEdge): نافذة التثبيت الرسمية عبر beforeinstallprompt
 * - آيفون/آيباد (Safari): لا توجد نافذة تثبيت؛ نعرض خطوات "إضافة إلى الشاشة الرئيسية"
 */

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());

export function isStandalone(): boolean {
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true;
}

export function isIOS(): boolean {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes('Macintosh') && 'ontouchend' in document);
}

export function canPromptInstall(): boolean {
  return !!deferred;
}

export function onInstallAvailabilityChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** يعيد: 'installed' | 'dismissed' | 'ios' (يجب عرض الخطوات) | 'manual' (من قائمة المتصفح) */
export async function requestInstall(): Promise<'installed' | 'dismissed' | 'ios' | 'manual'> {
  if (deferred) {
    const ev = deferred;
    deferred = null;
    emit();
    await ev.prompt();
    const { outcome } = await ev.userChoice;
    return outcome === 'accepted' ? 'installed' : 'dismissed';
  }
  return isIOS() ? 'ios' : 'manual';
}

export function setupPwa(): void {
  if (PREVIEW_MODE || !(import.meta as any).env?.PROD) return;
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    emit();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    emit();
  });
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    });
  }
}
