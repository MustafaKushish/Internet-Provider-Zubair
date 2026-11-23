import React, { useEffect, useState } from 'react';
import { Share, X as CloseIcon } from 'lucide-react';
import { getNotificationPermission, requestNotificationPermission } from '../utils/notifications';
import { enablePush, sendTestPush } from '../utils/push';
import { PREVIEW_MODE } from '../sync/api';
import { canPromptInstall, isStandalone, onInstallAvailabilityChange, requestInstall } from '../pwa';
import { notify } from '../components/ui/Dialogs';
import type { StaffUser } from '../types/isp';

/** الجرس (إشعارات الخلفية) وتثبيت التطبيق: نفس السلوك في الرأس وفي صفحة «المزيد» */
export function useDeviceActions(currentUser: StaffUser, onCheckNow: () => void) {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [canInstall, setCanInstall] = useState(() => !isStandalone());
  const [iosHelpOpen, setIosHelpOpen] = useState(false);

  useEffect(() => { setPermission(getNotificationPermission()); }, []);
  useEffect(() => onInstallAvailabilityChange(() => setCanInstall(!isStandalone())), []);

  const enableNotifications = async () => {
    let granted = permission === 'granted';
    if (!granted) {
      granted = await requestNotificationPermission();
      setPermission(granted ? 'granted' : 'denied');
    }
    if (!granted) {
      notify('الإشعارات محظورة لهذا الموقع. فعّلها من إعدادات المتصفح (رمز القفل بجانب العنوان) ثم اضغط الجرس.', 'warning');
      return;
    }
    onCheckNow();
    if (PREVIEW_MODE || currentUser.role === 'technician') return;
    const r = await enablePush();
    if (!r.ok) { notify(r.reason, 'warning'); return; }
    try {
      const n = await sendTestPush();
      notify(n > 0 ? 'تم تفعيل إشعارات الخلفية ✅ أرسلنا لك إشعاراً تجريبياً الآن.' : 'تم تسجيل هذا الجهاز. ستصلك التنبيهات كل صباح الساعة 7.', 'success');
    } catch {
      notify('تم تسجيل هذا الجهاز. ستصلك التنبيهات كل صباح الساعة 7.', 'success');
    }
  };

  const install = async () => {
    const result = await requestInstall();
    if (result === 'installed') {
      setCanInstall(false);
      notify('تم تثبيت التطبيق. ستجده في قائمة التطبيقات وعلى الشاشة الرئيسية.', 'success');
    } else if (result === 'ios') {
      setIosHelpOpen(true);
    } else if (result === 'manual') {
      notify(canPromptInstall()
        ? 'اضغط زر التثبيت مرة أخرى.'
        : 'للتثبيت: افتح قائمة المتصفح (⋮ أو …) واختر "تثبيت التطبيق" أو "إضافة إلى الشاشة الرئيسية". في ويندوز استخدم Edge أو Chrome.', 'info');
    }
  };

  const iosHelp = iosHelpOpen ? <IosInstallHelp onClose={() => setIosHelpOpen(false)} /> : null;
  return { permission, enableNotifications, canInstall, install, iosHelp };
}

const IosInstallHelp: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <div className="app-overlay fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm" onClick={onClose}>
    <div role="dialog" aria-modal="true" className="bg-slate-900 border border-slate-700 rounded-2xl max-w-sm w-full p-5 space-y-3 shadow-2xl text-sm" onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-white">تثبيت التطبيق على آيفون / آيباد</h2>
        <button type="button" onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer" aria-label="إغلاق">
          <CloseIcon className="w-4 h-4" />
        </button>
      </div>
      <ol className="space-y-2.5 text-slate-300 text-xs leading-relaxed list-decimal pr-4">
        <li>افتح المنظومة في متصفح <strong className="text-white">Safari</strong>.</li>
        <li>اضغط زر المشاركة <Share className="w-3.5 h-3.5 inline text-cyan-400" /> أسفل الشاشة.</li>
        <li>اختر <strong className="text-white">«إضافة إلى الشاشة الرئيسية»</strong> ثم <strong className="text-white">«إضافة»</strong>.</li>
        <li>افتح التطبيق من أيقونة <strong className="text-white">أولاد كشيش</strong> على الشاشة الرئيسية.</li>
      </ol>
    </div>
  </div>
);
