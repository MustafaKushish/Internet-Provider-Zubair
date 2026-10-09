import React, { useMemo, useState } from 'react';
import { PaymentRecord, StaffUser, Subscriber, SupportTicket, SystemSettings } from '../types/isp';
import { formatCurrency, getDaysRemaining, getRemainingDebt } from '../utils/storage';
import { debtInMonths, formatMonthsAr, monthsLate } from '../utils/debt';
import { planProgress } from '../utils/installments';
import { PAYMENT_METHOD_LABELS } from '../utils/expenses';
import { NO_TOWER_LABEL, normTower } from '../utils/towers';
import { diffDays, todayStr } from '../utils/dates';
import { copyText } from './ui/Dialogs';
import { useEscapeKey } from './ui/useEscapeKey';
import {
  X, Phone, MessageSquare, RefreshCw, Wallet, Edit, Wrench, Printer, TowerControl, Copy, Eye, EyeOff,
  Receipt, Scale, UserPlus, CalendarClock, MapPin, StickyNote, Archive,
} from 'lucide-react';

interface SubscriberProfileProps {
  subscriber: Subscriber | null;
  payments: PaymentRecord[];
  tickets: SupportTicket[];
  settings: SystemSettings;
  currentUser: StaffUser;
  onClose: () => void;
  onRenew: (sub: Subscriber) => void;
  onWhatsApp: (sub: Subscriber) => void;
  onDebt: (sub: Subscriber) => void;
  onEdit: (sub: Subscriber) => void;
  onTicket: (sub: Subscriber) => void;
  onPrintReceipt: (sub: Subscriber) => void;
  onArchive?: (ids: string[], archive: boolean, reason?: string) => void;
}

const TICKET_STATUS: Record<string, string> = { open: 'مفتوح', in_progress: 'قيد المتابعة', resolved: 'تم الحل', closed: 'مغلق' };
const PAYMENT_TYPE: Record<string, string> = { renewal: 'تجديد', debt_installment: 'تسديد دين', initial: 'اشتراك جديد', addon: 'إضافة' };

type Event = { at: string; kind: 'payment' | 'debt' | 'ticket' | 'created'; node: React.ReactNode };

/** ملف المشترك: كل بياناته وتاريخه (وصولات، تعديلات الدين، البلاغات) في مكان واحد */
export const SubscriberProfile: React.FC<SubscriberProfileProps> = props =>
  props.subscriber ? <ProfileInner {...props} sub={props.subscriber} /> : null;

const ProfileInner: React.FC<SubscriberProfileProps & { sub: Subscriber }> = ({
  sub, payments, tickets, settings, currentUser, onClose, onRenew, onWhatsApp, onDebt, onEdit, onTicket, onPrintReceipt, onArchive,
}) => {
  useEscapeKey(onClose);
  const [showPass, setShowPass] = useState(false);
  const office = currentUser.role !== 'technician';
  const fmt = (n: number) => formatCurrency(Math.round(n), settings.currency);
  const days = getDaysRemaining(sub.expiryDate);
  const debt = getRemainingDebt(sub);
  const plan = planProgress(sub, payments);

  const subPayments = useMemo(() => payments.filter(p => p.subscriberId === sub.id), [payments, sub.id]);
  const subTickets = useMemo(() => tickets.filter(t => t.subscriberId === sub.id), [tickets, sub.id]);
  const lifetimePaid = subPayments.reduce((a, p) => a + (p.amount || 0), 0);
  const firstDate = [sub.createdAt?.slice(0, 10), sub.startDate, ...subPayments.map(p => p.date)].filter(Boolean).sort()[0] || sub.startDate;
  const customerMonths = firstDate ? Math.max(0, Math.floor(diffDays(firstDate, todayStr()) / 30)) : 0;
  const lastPayment = [...subPayments].sort((a, b) => b.date.localeCompare(a.date))[0];
  const openTickets = subTickets.filter(t => t.status === 'open' || t.status === 'in_progress').length;

  const timeline = useMemo(() => {
    const ev: Event[] = [];
    if (office) {
      subPayments.forEach(p => ev.push({
        at: p.date,
        kind: 'payment',
        node: (
          <>
            <span className="font-bold text-emerald-300">{fmt(p.amount)}</span> • {PAYMENT_TYPE[p.paymentType] || p.paymentType} • {PAYMENT_METHOD_LABELS[p.paymentMethod] || p.paymentMethod}
            <span className="block text-[10px] text-slate-500">وصل <span dir="ltr">{p.receiptNumber}</span>{p.collectedBy && ` • قبضه ${p.collectedBy}`}{p.notes && ` • ${p.notes}`}</span>
          </>
        ),
      }));
      (sub.debtLog || []).forEach(l => ev.push({
        at: l.at,
        kind: 'debt',
        node: (
          <>
            <span className="font-bold text-amber-300">تعديل دين:</span> {fmt(l.from)} ← {fmt(l.to)}
            <span className="block text-[10px] text-slate-500">{l.reason} • {l.by}</span>
          </>
        ),
      }));
    }
    subTickets.forEach(t => ev.push({
      at: t.createdAt,
      kind: 'ticket',
      node: (
        <>
          <span className="font-bold text-amber-200">بلاغ:</span> {t.title || t.issueType} • <span className={t.status === 'open' || t.status === 'in_progress' ? 'text-rose-300' : 'text-emerald-300'}>{TICKET_STATUS[t.status] || t.status}</span>
          <span className="block text-[10px] text-slate-500"><span dir="ltr">{t.ticketNumber}</span>{t.technicianName && ` • ${t.technicianName}`}{t.resolutionNotes && ` • ${t.resolutionNotes}`}</span>
        </>
      ),
    }));
    if (sub.createdAt) ev.push({ at: sub.createdAt, kind: 'created', node: <span className="text-slate-300">{sub.source === 'import' ? 'تم استيراده إلى المنظومة من ملف إكسل' : 'تمت إضافة المشترك إلى المنظومة'}</span> });
    return ev.sort((a, b) => b.at.localeCompare(a.at));
  }, [subPayments, subTickets, sub, office]);

  const ICON = {
    payment: <Receipt className="w-3.5 h-3.5 text-emerald-400" />,
    debt: <Scale className="w-3.5 h-3.5 text-amber-400" />,
    ticket: <Wrench className="w-3.5 h-3.5 text-amber-300" />,
    created: <UserPlus className="w-3.5 h-3.5 text-cyan-400" />,
  };

  const act = (fn: (s: Subscriber) => void) => () => { onClose(); fn(sub); };
  const btn = 'h-9 px-3 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-sm" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`ملف ${sub.name}`}
        onClick={e => e.stopPropagation()}
        className="w-full sm:max-w-3xl max-h-[92vh] sm:max-h-[90vh] flex flex-col bg-slate-900 border border-slate-700 rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* الرأس */}
        <div className="px-5 py-4 bg-slate-800/70 border-b border-slate-700 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-600 to-indigo-600 text-white text-lg font-bold flex items-center justify-center flex-shrink-0">
              {sub.name.charAt(0)}
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-white truncate">{sub.name}</h2>
              <div className="text-xs text-slate-400 flex flex-wrap items-center gap-x-2 gap-y-1 mt-0.5">
                <span>{sub.planName} • {sub.upstreamProvider}</span>
                <span className="flex items-center gap-1"><TowerControl className="w-3 h-3" />{normTower(sub.towerName) || NO_TOWER_LABEL}</span>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1.5 text-[10px] font-bold">
                {sub.archived && <span className="px-2 py-0.5 rounded-full bg-slate-700 border border-slate-500 text-white">مؤرشف (غادر){sub.archivedAt ? ` • ${sub.archivedAt.slice(0, 10)}` : ''}</span>}
                {sub.pendingPrice && <span className="px-2 py-0.5 rounded-full bg-amber-950 border border-amber-800 text-amber-300">سعر جديد {fmt(sub.pendingPrice.salePrice)} من التجديد القادم</span>}
                {days > 3 ? (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-800 text-emerald-300">نشط • متبقي {days} يوم</span>
                ) : days >= 0 ? (
                  <span className="px-2 py-0.5 rounded-full bg-amber-950 border border-amber-800 text-amber-300">{days === 0 ? 'ينتهي اليوم' : `ينتهي خلال ${days} يوم`}</span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-rose-950 border border-rose-800 text-rose-300">متأخر {formatMonthsAr(monthsLate(sub.expiryDate))}</span>
                )}
                <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300">ينتهي <span dir="ltr">{sub.expiryDate}</span></span>
                {office && debt > 0 && <span className="px-2 py-0.5 rounded-full bg-rose-950 border border-rose-800 text-rose-300">دين {fmt(debt)}{sub.salePrice ? ` (×${debtInMonths(sub)})` : ''}</span>}
                {openTickets > 0 && <span className="px-2 py-0.5 rounded-full bg-amber-950 border border-amber-800 text-amber-300">{openTickets} بلاغ مفتوح</span>}
              </div>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="إغلاق" className="text-slate-400 hover:text-white p-1.5 cursor-pointer"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {/* العمليات */}
          <div className="flex flex-wrap gap-2">
            {office && <button type="button" onClick={act(onRenew)} className={`${btn} bg-cyan-600 hover:bg-cyan-500 text-white`}><RefreshCw className="w-4 h-4" />تجديد</button>}
            <button type="button" onClick={act(onWhatsApp)} className={`${btn} bg-emerald-600 hover:bg-emerald-500 text-white`}><MessageSquare className="w-4 h-4" />واتساب</button>
            {office && debt > 0 && <button type="button" onClick={act(onDebt)} className={`${btn} bg-rose-700 hover:bg-rose-600 text-white`}><Wallet className="w-4 h-4" />الدين والتقسيط</button>}
            {office && <button type="button" onClick={act(onPrintReceipt)} className={`${btn} bg-slate-800 border border-slate-700 text-slate-200`}><Printer className="w-4 h-4" />وصل</button>}
            <button type="button" onClick={act(onTicket)} className={`${btn} bg-slate-800 border border-slate-700 text-amber-300`}><Wrench className="w-4 h-4" />بلاغ عطل</button>
            <button type="button" onClick={act(onEdit)} className={`${btn} bg-slate-800 border border-slate-700 text-slate-200`}><Edit className="w-4 h-4" />تعديل</button>
            {onArchive && (
              <button type="button" onClick={() => onArchive([sub.id], !sub.archived, sub.archived ? undefined : 'غادر الشبكة')}
                className={`${btn} bg-slate-800 border border-slate-600 text-slate-300`}>
                <Archive className="w-4 h-4" />{sub.archived ? 'إعادة من الأرشيف' : 'أرشفة (غادر)'}
              </button>
            )}
          </div>

          {/* أرقام */}
          {office && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="rounded-xl p-3 bg-slate-950/60 border border-slate-800">
                <div className="text-slate-400">عميل منذ</div>
                <div className="text-sm font-bold text-white mt-0.5">{customerMonths < 1 ? 'أقل من شهر' : formatMonthsAr(customerMonths)}</div>
                <div className="text-[10px] text-slate-500" dir="ltr">{firstDate}</div>
              </div>
              <div className="rounded-xl p-3 bg-emerald-950/30 border border-emerald-900">
                <div className="text-emerald-300">إجمالي ما دفعه</div>
                <div className="text-sm font-bold text-white mt-0.5">{fmt(lifetimePaid)}</div>
                <div className="text-[10px] text-slate-500">{subPayments.length} وصل</div>
              </div>
              <div className="rounded-xl p-3 bg-slate-950/60 border border-slate-800">
                <div className="text-slate-400">آخر دفعة</div>
                <div className="text-sm font-bold text-white mt-0.5">{lastPayment ? fmt(lastPayment.amount) : '—'}</div>
                <div className="text-[10px] text-slate-500" dir="ltr">{lastPayment?.date || 'لا توجد'}</div>
              </div>
              <div className="rounded-xl p-3 bg-slate-950/60 border border-slate-800">
                <div className="text-slate-400">ربح الشهر منه</div>
                <div className="text-sm font-bold text-white mt-0.5">{fmt((sub.salePrice || 0) - (sub.costPrice || 0))}</div>
                <div className="text-[10px] text-slate-500">بيع {fmt(sub.salePrice || 0)}</div>
              </div>
            </div>
          )}

          {office && plan && (
            <div className="rounded-xl p-3 bg-indigo-950/30 border border-indigo-900 space-y-1.5">
              <div className="flex justify-between gap-2">
                <span className="font-bold text-indigo-200 flex items-center gap-1"><CalendarClock className="w-4 h-4" /> خطة تقسيط {plan.paidInstallments}/{plan.plan.count}</span>
                <span className={plan.status === 'late' ? 'text-rose-300 font-bold' : plan.status === 'done' ? 'text-emerald-300 font-bold' : 'text-indigo-200'}>
                  {plan.status === 'done' ? 'مكتملة' : plan.status === 'late' ? `متأخر ${fmt(plan.arrears)}` : `القادم ${fmt(plan.nextAmount)} • ${plan.nextDate}`}
                </span>
              </div>
              <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-indigo-500" style={{ width: `${Math.min(100, (plan.paid / plan.plan.total) * 100)}%` }} /></div>
            </div>
          )}

          {/* البيانات */}
          <div className="grid sm:grid-cols-2 gap-2">
            <div className="rounded-xl p-3 bg-slate-950/60 border border-slate-800 space-y-1.5">
              <div className="flex justify-between gap-2"><span className="text-slate-400">الهاتف</span>
                {sub.phone ? <a href={`tel:${sub.phone}`} className="font-mono text-cyan-300 flex items-center gap-1" dir="ltr"><Phone className="w-3 h-3" />{sub.phone}</a> : <span className="text-amber-400">غير مسجل</span>}
              </div>
              <div className="flex justify-between gap-2"><span className="text-slate-400">اليوزر</span>
                <button type="button" onClick={() => void copyText(sub.username)} className="font-mono text-indigo-300 flex items-center gap-1 cursor-pointer" dir="ltr">{sub.username}<Copy className="w-3 h-3 text-slate-500" /></button>
              </div>
              {sub.password && (
                <div className="flex justify-between gap-2"><span className="text-slate-400">كلمة المرور</span>
                  <span className="flex items-center gap-1.5">
                    <span className="font-mono text-slate-300" dir="ltr">{showPass ? sub.password : '••••••'}</span>
                    <button type="button" onClick={() => setShowPass(v => !v)} aria-label="إظهار كلمة المرور" className="text-slate-500 cursor-pointer">{showPass ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}</button>
                    <button type="button" onClick={() => void copyText(sub.password || '')} aria-label="نسخ كلمة المرور" className="text-slate-500 cursor-pointer"><Copy className="w-3 h-3" /></button>
                  </span>
                </div>
              )}
            </div>
            <div className="rounded-xl p-3 bg-slate-950/60 border border-slate-800 space-y-1.5">
              <div className="flex justify-between gap-2"><span className="text-slate-400">IP</span><span className="font-mono text-cyan-300" dir="ltr">{sub.ipAddress || '—'}</span></div>
              <div className="flex justify-between gap-2"><span className="text-slate-400">MAC</span><span className="font-mono text-slate-300" dir="ltr">{sub.macAddress || '—'}</span></div>
              <div className="flex justify-between gap-2"><span className="text-slate-400 flex items-center gap-1"><MapPin className="w-3 h-3" />العنوان</span><span className="text-slate-300 text-left">{sub.address || '—'}</span></div>
            </div>
          </div>
          {sub.notes && (
            <div className="rounded-xl p-3 bg-amber-950/20 border border-amber-900/60 text-amber-100 flex gap-2">
              <StickyNote className="w-4 h-4 flex-shrink-0 text-amber-400" /><span className="whitespace-pre-wrap">{sub.notes}</span>
            </div>
          )}

          {/* السجل الزمني */}
          <div>
            <h3 className="text-sm font-bold text-white mb-2">السجل الكامل ({timeline.length})</h3>
            {timeline.length === 0 ? (
              <p className="text-slate-500">لا يوجد سجل بعد.</p>
            ) : (
              <ol className="relative border-r border-slate-800 pr-4 space-y-3">
                {timeline.map((e, i) => (
                  <li key={i} className="relative">
                    <span className="absolute -right-[1.45rem] top-0.5 w-5 h-5 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center">{ICON[e.kind]}</span>
                    <div className="text-[10px] text-slate-500 font-mono" dir="ltr">{e.at.slice(0, 16).replace('T', ' ')}</div>
                    <div className="text-slate-200 leading-relaxed">{e.node}</div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
