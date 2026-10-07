import { todayStr as localToday } from './dates';
import { Subscriber, SystemSettings } from '../types/isp';
import { getDaysRemaining, formatCurrency } from './storage';

const NOTIFIED_CACHE_KEY = 'sas_notified_subscribers_cache_v1';

export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getNotificationPermission(): NotificationPermission {
  if (!isNotificationSupported()) return 'denied';
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!isNotificationSupported()) return false;
  try {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  } catch (e) {
    console.error('Error requesting notification permission:', e);
    return false;
  }
}

// Get cache of already notified subscribers today to prevent notification spamming
function getNotifiedCache(): Record<string, string> {
  try {
    const raw = localStorage.getItem(NOTIFIED_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function markSubscriberNotified(id: string): void {
  try {
    const cache = getNotifiedCache();
    const today = localToday();
    cache[id] = today;
    localStorage.setItem(NOTIFIED_CACHE_KEY, JSON.stringify(cache));
  } catch (e) {
    console.error(e);
  }
}

export function checkAndTriggerExpiryNotifications(
  subscribers: Subscriber[],
  settings: SystemSettings,
  forceAll: boolean = false
): { notifiedCount: number; expiringList: Subscriber[] } {
  if (!isNotificationSupported() || Notification.permission !== 'granted') {
    return { notifiedCount: 0, expiringList: [] };
  }

  const todayStr = localToday();
  const cache = getNotifiedCache();

  // Find subscribers about to expire based on warningDaysBeforeExpiry
  const warningDays = settings.warningDaysBeforeExpiry || 3;
  const expiringSubscribers = subscribers.filter(sub => {
    const days = getDaysRemaining(sub.expiryDate);
    // Include subscriptions expiring between today and warningDays, or expired today
    return days >= 0 && days <= warningDays;
  });

  let count = 0;

  expiringSubscribers.forEach(sub => {
    const days = getDaysRemaining(sub.expiryDate);
    const lastNotifiedDate = cache[sub.id];

    // Trigger notification if not already notified today or if forced
    if (forceAll || lastNotifiedDate !== todayStr) {
      const daysText = days === 0 ? 'اليوم!' : `خلال ${days} ${days === 1 ? 'يوم' : 'أيام'}`;
      const title = `⚠️ تنبيه قرب انتهاء اشتراك: ${sub.name}`;
      const body = `اشتراك (${sub.planName}) للمشترك ${sub.name} ينتهي ${daysText} بتاريخ ${sub.expiryDate}.\nرسوم التجديد: ${formatCurrency(sub.salePrice, settings.currency)}`;

      try {
        const notif = new Notification(title, {
          body,
          icon: '/favicon.ico',
          tag: `expiry_${sub.id}_${todayStr}`,
          dir: 'rtl',
          lang: 'ar',
        });

        notif.onclick = () => {
          window.focus();
          notif.close();
        };

        markSubscriberNotified(sub.id);
        count++;
      } catch (err) {
        console.error('Error triggering notification:', err);
      }
    }
  });

  return {
    notifiedCount: count,
    expiringList: expiringSubscribers,
  };
}

export function sendTestNotification(settings: SystemSettings): boolean {
  if (!isNotificationSupported() || Notification.permission !== 'granted') {
    return false;
  }

  try {
    const notif = new Notification(`🔔 تجربة إشعارات ${settings.ispName}`, {
      body: `إشعارات المتصفح مفعلة بنجاح! سيتم تنبيهك تلقائياً قبل ${settings.warningDaysBeforeExpiry} أيام من انتهاء اشتراك أي مشترك.`,
      dir: 'rtl',
      lang: 'ar',
    });

    notif.onclick = () => {
      window.focus();
      notif.close();
    };

    return true;
  } catch (err) {
    console.error('Test notification failed:', err);
    return false;
  }
}
