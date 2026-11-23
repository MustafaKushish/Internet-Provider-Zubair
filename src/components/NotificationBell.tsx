import React, { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Bell, BellOff, BellRing, CalendarClock, CheckCheck, CheckCircle2, ChevronLeft, HandCoins, Info, Megaphone, Trash2, Wrench, X } from 'lucide-react';
import type { AlertGroup, AlertKind } from '../utils/alerts';
import { clearNotices, getNoticeState, markAllSeen, removeNotice, subscribeNotices, timeAgoAr, unseenCount, type NoticeTone } from '../utils/notificationCenter';
import { useEscapeKey } from './ui/useEscapeKey';

interface Props {
  alerts: AlertGroup[];
  onOpenTab: (tab: string) => void;
  /** إشعارات الجهاز (الهاتف/الحاسوب) */
  deviceOn: boolean;
  onEnableDevice: () => void;
  /** زر كبير بنص (الوضع البسيط) */
  big?: boolean;
}

const ALERT_ICON: Record<AlertKind, React.ElementType> = {
  expired: AlertTriangle,
  expiring: CalendarClock,
  promise: HandCoins,
  ticket: Wrench,
  plan: Megaphone,
};
const TONE_CHIP = {
  danger: 'bg-rose-500/15 text-rose-300',
  warning: 'bg-amber-500/15 text-amber-300',
  info: 'bg-cyan-500/15 text-cyan-300',
} as const;
const NOTICE_ICON: Record<NoticeTone, React.ReactNode> = {
  info: <Info className="w-4 h-4 text-cyan-300" />,
  success: <CheckCircle2 className="w-4 h-4 text-emerald-300" />,
  error: <AlertTriangle className="w-4 h-4 text-rose-300" />,
  warning: <AlertTriangle className="w-4 h-4 text-amber-300" />,
};

/** الجرس: نافذة إشعارات صغيرة (تنبيهات الآن + آخر الإشعارات + إشعارات الجهاز) */
export const NotificationBell: React.FC<Props> = ({ alerts, onOpenTab, deviceOn, onEnableDevice, big }) => {
  const [open, setOpen] = useState(false);
  const store = useSyncExternalStore(subscribeNotices, getNoticeState, getNoticeState);
  const [, tick] = useState(0);
  const wrap = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  // موضع النافذة تحت الجرس (تُرسم في body حتى يعمل التمويه الزجاجي ولا تختفي مع التمرير)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const keys = alerts.map(a => a.key);
  const unseen = unseenCount(store, keys);

  // الجديد يبقى مميزاً طوال فتح النافذة، ويُعلَّم مقروءاً عند الإغلاق
  const close = () => {
    setOpen(false);
    markAllSeen(keys);
  };
  const toggle = () => {
    if (open) { close(); return; }
    tick(x => x + 1); // تحديث «قبل … د»
    setOpen(true);
  };
  useEscapeKey(close, open);

  // نقرة خارج النافذة تغلقها
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!wrap.current?.contains(t) && !panel.current?.contains(t)) close();
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, keys.join('|')]);

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const r = wrap.current?.getBoundingClientRect();
      if (!r) return;
      const w = Math.min(384, window.innerWidth - 24);
      setPos({ top: Math.max(8, r.bottom + 8), left: Math.min(Math.max(12, r.left), window.innerWidth - w - 12) });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, { passive: true });
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place); };
  }, [open]);

  const go = (tab: string) => { close(); onOpenTab(tab); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const label = unseen > 0 ? `الإشعارات: ${unseen} جديد` : 'الإشعارات';
  const BellIcon = !deviceOn ? BellOff : unseen > 0 ? BellRing : Bell;

  return (
    <div ref={wrap} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="dialog"
        title={label}
        className={`relative ${big ? 'h-12 px-3 sm:px-4 gap-2 text-base font-semibold' : 'w-11 h-11 justify-center'} rounded-xl bg-slate-800 border border-slate-700 text-slate-100 flex items-center cursor-pointer hover:bg-slate-700 ${open ? 'ring-2 ring-cyan-400/50' : ''}`}
      >
        <BellIcon className={`w-5 h-5 ${unseen > 0 ? 'text-cyan-200 bell-ring' : deviceOn ? 'text-slate-200' : 'text-slate-400'}`} />
        {big && 'الإشعارات'}
        {unseen > 0 && (
          <span className="absolute -top-1.5 -left-1.5 min-w-5 h-5 px-1 rounded-full bg-rose-500 text-white text-[11px] font-bold leading-5 text-center shadow-lg shadow-rose-900/50">
            {unseen > 9 ? '9+' : unseen}
          </span>
        )}
      </button>

      {open && pos && createPortal(
        <div
          ref={panel}
          role="dialog"
          aria-label="الإشعارات"
          dir="rtl"
          style={{ top: pos.top, left: pos.left, maxHeight: `min(34rem, calc(100dvh - ${pos.top + 16}px))` }}
          className="glass-popover popover-enter fixed z-[65] w-[min(24rem,calc(100vw-1.5rem))] rounded-2xl flex flex-col text-right no-print"
        >
          <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-700">
            <h2 className="font-bold text-white text-base">الإشعارات</h2>
            {unseen > 0 && <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-200">{unseen} جديد</span>}
            <div className="flex-1" />
            {store.notices.some(n => !n.read) && (
              <button type="button" onClick={() => markAllSeen(keys)} className="h-9 px-2.5 rounded-lg text-xs text-slate-300 hover:text-white hover:bg-slate-800 flex items-center gap-1 cursor-pointer">
                <CheckCheck className="w-4 h-4" /> علّم الكل مقروءاً
              </button>
            )}
            <button type="button" onClick={close} aria-label="إغلاق" className="w-9 h-9 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 flex items-center justify-center cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="overflow-y-auto overscroll-contain flex-1 p-2 space-y-3">
            {alerts.length > 0 && (
              <section aria-label="يحتاج انتباهك الآن">
                <h3 className="px-2 pt-1 pb-1.5 text-xs font-semibold text-slate-400">يحتاج انتباهك الآن</h3>
                <ul className="space-y-1">
                  {alerts.map(a => {
                    const Icon = ALERT_ICON[a.kind];
                    return (
                      <li key={a.kind}>
                        <button type="button" onClick={() => go(a.tab)} className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-800 text-right cursor-pointer">
                          <span className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${TONE_CHIP[a.tone]}`}>
                            <Icon className="w-[18px] h-[18px]" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-1.5 text-sm font-semibold text-white">
                              {a.title}
                              {!store.seenAlerts.includes(a.key) && <span className="w-2 h-2 rounded-full bg-cyan-400 flex-shrink-0" aria-label="جديد" />}
                            </span>
                            {a.detail && <span className="block text-xs text-slate-400 truncate mt-0.5">{a.detail}</span>}
                          </span>
                          <ChevronLeft className="w-4 h-4 text-slate-500 flex-shrink-0" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            <section aria-label="آخر الإشعارات">
              <div className="flex items-center px-2 pt-1 pb-1.5">
                <h3 className="text-xs font-semibold text-slate-400 flex-1">آخر الإشعارات</h3>
                {store.notices.length > 0 && (
                  <button type="button" onClick={clearNotices} className="text-xs text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer">
                    <Trash2 className="w-3.5 h-3.5" /> امسح السجل
                  </button>
                )}
              </div>
              {store.notices.length === 0 ? (
                <p className="px-2 py-6 text-center text-sm text-slate-400">
                  {alerts.length ? 'لا رسائل جديدة.' : 'كل شيء على ما يرام. لا إشعارات الآن.'}
                </p>
              ) : (
                <ul className="space-y-0.5">
                  {store.notices.map(n => (
                    <li key={n.id} className={`group flex items-start gap-2.5 px-2.5 py-2 rounded-xl ${!n.read ? 'bg-cyan-500/[0.07]' : ''}`}>
                      <span className="mt-0.5 flex-shrink-0">{NOTICE_ICON[n.tone]}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm text-slate-100 leading-relaxed line-clamp-2 whitespace-pre-line">{n.message}</span>
                        <span className="block text-[11px] text-slate-400 mt-0.5">
                          {timeAgoAr(n.at)}{n.times && n.times > 1 ? ` • ${n.times} مرات` : ''}
                        </span>
                      </span>
                      <button type="button" onClick={() => removeNotice(n.id)} aria-label="احذف الإشعار" className="w-7 h-7 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 flex items-center justify-center flex-shrink-0 cursor-pointer sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <div className="border-t border-slate-700 p-2">
            <button type="button" onClick={onEnableDevice} className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-800 text-right cursor-pointer">
              <span className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${deviceOn ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300'}`}>
                {deviceOn ? <Bell className="w-[18px] h-[18px]" /> : <BellOff className="w-[18px] h-[18px]" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-white">{deviceOn ? 'إشعارات الهاتف والحاسوب مفعلة' : 'فعّل إشعارات الهاتف والحاسوب'}</span>
                <span className="block text-xs text-slate-400 mt-0.5">{deviceOn ? 'اضغط لإرسال إشعار تجريبي وفحص التنبيهات الآن' : 'تصلك التنبيهات حتى والمنظومة مغلقة'}</span>
              </span>
            </button>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
};
