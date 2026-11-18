import React, { useMemo, useState } from 'react';
import { useEscapeKey } from './ui/useEscapeKey';
import { appConfirm } from './ui/Dialogs';
import { InstallmentPlan, PaymentRecord, StaffUser, Subscriber, SystemSettings } from '../types/isp';
import { createPlan, planProgress, suggestInstallment } from '../utils/installments';
import { todayStr } from '../utils/dates';
import { formatCurrency, generateWhatsAppLink, getAmountDue, getRemainingDebt } from '../utils/storage';
import { debtInMonths, formatMonthsAr, monthsLate } from '../utils/debt';
import { X, Wallet, Lock, Minus, Plus, History, Trash2, Save, CreditCard, AlertTriangle, CalendarClock } from 'lucide-react';
import { BackButton } from './ui/BackButton';

interface DebtModalProps {
  subscriber: Subscriber | null;
  payments: PaymentRecord[];
  settings: SystemSettings;
  currentUser: StaffUser;
  onClose: () => void;
  onAddPayment: (subscriberId: string, data: { amount: number; paymentMethod: PaymentRecord['paymentMethod']; notes: string }) => void;
  onAdjustDebt: (subscriberId: string, newDebt: number, reason: string) => void;
  /** إنشاء خطة تقسيط أو إلغاؤها (null) — للمدير فقط */
  onSetPlan?: (subscriberId: string, plan: InstallmentPlan | null) => void;
}

const METHODS: { value: PaymentRecord['paymentMethod']; label: string }[] = [
  { value: 'cash', label: 'نقداً' },
  { value: 'zain_cash', label: 'زين كاش' },
  { value: 'qi_card', label: 'كي كارد' },
  { value: 'transfer', label: 'تحويل' },
];

export const DebtModal: React.FC<DebtModalProps> = (props) =>
  props.subscriber ? <DebtModalInner {...props} subscriber={props.subscriber} /> : null;

const DebtModalInner: React.FC<DebtModalProps & { subscriber: Subscriber }> = ({
  subscriber: sub,
  payments,
  settings,
  currentUser,
  onClose,
  onAddPayment,
  onAdjustDebt,
  onSetPlan,
}) => {
  useEscapeKey(onClose);
  const isAdmin = currentUser.role === 'admin';
  const money = (n: number) => formatCurrency(Math.round(n), settings.currency);
  const price = sub.salePrice || 0;
  const debt = getRemainingDebt(sub);
  const months = debtInMonths(sub);
  const late = monthsLate(sub.expiryDate);
  const cycleDue = getAmountDue({ ...sub, carriedDebt: 0 });

  // ---- تسديد (متاح لكل من يسجل الوصولات) ----
  const [payAmount, setPayAmount] = useState<number>(Math.min(debt, price || debt));
  const [method, setMethod] = useState<PaymentRecord['paymentMethod']>('cash');
  const [payNote, setPayNote] = useState('');
  const [sendWhatsApp, setSendWhatsApp] = useState(!!sub.phone);
  const payRounded = Math.max(0, Math.round(payAmount || 0));
  const leftAfter = Math.max(0, debt - payRounded);
  const isPartial = payRounded > 0 && payRounded < debt;

  // ---- تعديل الدين (للمدير فقط) ----
  const [targetMonths, setTargetMonths] = useState<number>(months);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const targetDebt = customAmount.trim() !== '' ? Math.max(0, Number(customAmount) || 0) : Math.round(targetMonths * price);

  // ---- خطة التقسيط ----
  const progress = useMemo(() => planProgress(sub, payments), [sub, payments]);
  const [planCount, setPlanCount] = useState(3);
  const [planStart, setPlanStart] = useState(todayStr());
  const [planNote, setPlanNote] = useState('');
  const planAmount = suggestInstallment(debt, planCount);

  const subPayments = useMemo(
    () => payments.filter(p => p.subscriberId === sub.id).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6),
    [payments, sub.id],
  );

  const pay = () => {
    setError(null);
    const amount = Math.round(payAmount);
    if (!amount || amount <= 0) { setError('أدخل مبلغ التسديد.'); return; }
    if (amount > debt) { setError(`المبلغ أكبر من الدين (${money(debt)}).`); return; }
    const planNoteText = progress && progress.status !== 'done'
      ? `قسط ${Math.min(progress.plan.count, progress.paidInstallments + 1)} من ${progress.plan.count}`
      : `تسديد دين (${formatMonthsAr(amount / (price || amount))})`;
    onAddPayment(sub.id, { amount, paymentMethod: method, notes: payNote.trim() || (amount < debt ? `تسديد جزئي • ${planNoteText}` : planNoteText) });
    // إشعار المشترك بالمبلغ المستلم وما تبقى عليه (يُفتح من ضغطة الزر نفسها حتى لا يحجبه المتصفح)
    if (sendWhatsApp && sub.phone) {
      const rest = debt - amount;
      const msg = `السلام عليكم ${sub.name}\nتم استلام ${money(amount)} من دينك لدى ${settings.ispName}.\n`
        + (rest > 0 ? `المتبقي عليك: ${money(rest)}.` : 'تم تسديد الدين بالكامل، شكراً لك.');
      window.open(generateWhatsAppLink(sub.phone, msg), '_blank', 'noopener');
    }
    onClose();
  };

  const saveAdjustment = async () => {
    setError(null);
    if (!reason.trim()) { setError('اكتب سبب التعديل (يُحفظ في سجل المشترك).'); return; }
    if (targetDebt === debt) { setError('الدين الجديد مساوٍ للدين الحالي.'); return; }
    const ok = await appConfirm(
      `تعديل دين ${sub.name}\nمن ${money(debt)} إلى ${money(targetDebt)}${price ? ` (×${Math.round((targetDebt / price) * 10) / 10} ${sub.planName})` : ''}\nالسبب: ${reason.trim()}`,
      { title: 'تأكيد تعديل الدين', confirmLabel: 'حفظ التعديل', danger: targetDebt < debt },
    );
    if (!ok) return;
    onAdjustDebt(sub.id, targetDebt, reason.trim());
    onClose();
  };

  const forgive = async () => {
    setError(null);
    if (!reason.trim()) { setError('اكتب سبب الإعفاء/حذف الدين أولاً.'); return; }
    const ok = await appConfirm(`حذف كامل دين ${sub.name} (${money(debt)})؟\nالسبب: ${reason.trim()}`, { title: 'حذف الدين (إعفاء)', confirmLabel: 'حذف الدين' });
    if (!ok) return;
    onAdjustDebt(sub.id, 0, reason.trim());
    onClose();
  };

  const quick = [1, 2, 3, 4, 6];
  // مبالغ جزئية جاهزة: نصف الدين وأرقام مدورة أصغر من الدين
  const partialQuick = Array.from(new Set([
    Math.round(debt / 2 / 1000) * 1000,
    5000, 10000, 25000, 50000,
  ])).filter(a => a > 0 && a < debt).sort((a, b) => a - b).slice(0, 4);

  return (
    <div className="app-overlay fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="debt-title" className="bg-slate-900 border border-slate-700 rounded-2xl max-w-xl w-full shadow-2xl my-6" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-5 py-4 bg-slate-800/80 border-b border-slate-700 flex items-center justify-between rounded-t-2xl">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-rose-600/20 text-rose-400 border border-rose-500/30 flex items-center justify-center flex-shrink-0">
              <Wallet className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 id="debt-title" className="text-base font-bold text-white truncate">ديون {sub.name}</h2>
              <p className="text-xs text-slate-400">{sub.planName} • {sub.upstreamProvider} • الشهر بـ {money(price)}</p>
            </div>
          </div>
          <BackButton onClick={onClose} />
        </div>

        <div className="p-5 space-y-5 text-xs" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {/* Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <div className="bg-rose-950/40 border border-rose-900 rounded-xl p-3 col-span-2 sm:col-span-1">
              <span className="text-rose-300 block text-[10px] font-semibold">الدين الحالي</span>
              <span className="text-lg font-bold text-rose-300">{money(debt)}</span>
              {price > 0 && debt > 0 && <span className="block text-[11px] text-rose-200 mt-0.5">= ×{months} {sub.planName}</span>}
            </div>
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
              <span className="text-slate-400 block text-[10px] font-semibold">التأخير</span>
              <span className={`text-sm font-bold ${late ? 'text-amber-300' : 'text-emerald-400'}`}>{late ? `متأخر ${formatMonthsAr(late)}` : 'غير متأخر'}</span>
              <span className="block text-[10px] text-slate-500 mt-0.5" dir="ltr">انتهاء: {sub.expiryDate}</span>
            </div>
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
              <span className="text-slate-400 block text-[10px] font-semibold">تفصيل الحساب</span>
              <span className="block text-slate-300">الدورة الحالية: {money(cycleDue)}</span>
              <span className="block text-slate-300">مدفوع فيها: {money(sub.paidAmount || 0)}</span>
              <span className="block text-slate-300">دين سابق مرحّل: {money(sub.carriedDebt || 0)}</span>
            </div>
          </div>

          {/* خطة التقسيط */}
          {(progress || (debt > 0 && onSetPlan)) && (
            <section className="space-y-2.5 border border-indigo-900/70 bg-indigo-950/20 rounded-xl p-3.5">
              <h3 className="font-bold text-white text-sm flex items-center gap-1.5">
                <CalendarClock className="w-4 h-4 text-indigo-300" /> تقسيط الدين
                {!isAdmin && !progress && <span className="text-[10px] font-normal text-slate-500">(ينشئه المدير)</span>}
              </h3>
              {progress ? (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-slate-300">
                      {progress.plan.count} أقساط × {money(progress.plan.amount)} • من {progress.plan.startDate}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${progress.status === 'done' ? 'bg-emerald-950 border-emerald-800 text-emerald-300' : progress.status === 'late' ? 'bg-rose-950 border-rose-800 text-rose-300' : 'bg-indigo-950 border-indigo-800 text-indigo-300'}`}>
                      {progress.status === 'done' ? 'مكتملة' : progress.status === 'late' ? `متأخر ${money(progress.arrears)}` : 'منتظم'}
                    </span>
                  </div>
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500" style={{ width: `${Math.min(100, (progress.paid / progress.plan.total) * 100)}%` }} />
                  </div>
                  <div className="flex flex-wrap justify-between gap-2 text-slate-400">
                    <span>مسدد {money(progress.paid)} من {money(progress.plan.total)} ({progress.paidInstallments}/{progress.plan.count})</span>
                    {progress.nextDate && <span>القسط القادم: <b className="text-white">{money(progress.nextAmount)}</b> بتاريخ <span dir="ltr">{progress.nextDate}</span></span>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {progress.status !== 'done' && debt > 0 && (
                      <button type="button" onClick={() => setPayAmount(Math.min(debt, progress.nextAmount))}
                        className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold cursor-pointer">
                        تسديد القسط ({money(Math.min(debt, progress.nextAmount))})
                      </button>
                    )}
                    {isAdmin && onSetPlan && (
                      <button type="button"
                        onClick={async () => { if (await appConfirm(`إلغاء خطة تقسيط ${sub.name}؟ (الدين نفسه لا يتغير)`, { confirmLabel: 'إلغاء الخطة' })) onSetPlan(sub.id, null); }}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 cursor-pointer">
                        {progress.status === 'done' ? 'إزالة الخطة' : 'إلغاء الخطة'}
                      </button>
                    )}
                  </div>
                </div>
              ) : isAdmin && onSetPlan ? (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-slate-400">عدد الأقساط:</span>
                    {[2, 3, 4, 6, 10, 12].map(n => (
                      <button key={n} type="button" onClick={() => setPlanCount(n)} aria-pressed={planCount === n}
                        className={`px-2.5 py-1 rounded-md font-bold cursor-pointer ${planCount === n ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-indigo-300 hover:bg-slate-700'}`}>
                        {n}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <label className="block">
                      <span className="block text-slate-400 mb-1">تاريخ أول قسط</span>
                      <input id="plan-start" type="date" value={planStart} onChange={e => setPlanStart(e.target.value || todayStr())}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-indigo-500" />
                    </label>
                    <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-2.5">
                      <span className="block text-slate-400">القسط الشهري</span>
                      <span className="text-base font-bold text-indigo-300">{money(planAmount)}</span>
                      <span className="block text-[10px] text-slate-500">{planCount} أشهر لدين {money(debt)}</span>
                    </div>
                  </div>
                  <input id="plan-note" type="text" value={planNote} onChange={e => setPlanNote(e.target.value)} placeholder="ملاحظة الاتفاق (اختياري)"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500" />
                  <button type="button" onClick={() => onSetPlan(sub.id, createPlan(debt, planCount, planStart, currentUser.name, planNote))}
                    className="w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold cursor-pointer">
                    إنشاء خطة تقسيط ({planCount} × {money(planAmount)})
                  </button>
                </div>
              ) : (
                <p className="text-slate-400 flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" /> لا توجد خطة تقسيط. المدير العام ينشئ الخطط.</p>
              )}
            </section>
          )}

          {/* Pay: كامل الدين أو جزء منه */}
          {debt > 0 && (
            <section className="space-y-3 border border-emerald-900/70 bg-emerald-950/10 rounded-xl p-3.5 text-sm">
              <div>
                <h3 className="font-bold text-white text-base flex items-center gap-1.5"><CreditCard className="w-5 h-5 text-emerald-400" /> تسديد الدين (كله أو جزء منه)</h3>
                <p className="text-slate-400 mt-0.5">يمكن للمشترك دفع أي مبلغ الآن، والباقي يبقى ديناً عليه.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {partialQuick.map(a => (
                  <button key={`p${a}`} type="button" onClick={() => setPayAmount(a)} aria-pressed={payRounded === a}
                    className={`h-10 px-3 rounded-lg font-semibold cursor-pointer ${payRounded === a ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-emerald-300 hover:bg-slate-700'}`}>
                    {a === Math.round(debt / 2 / 1000) * 1000 ? `نصف الدين (${money(a)})` : money(a)}
                  </button>
                ))}
                {price > 0 && quick.filter(m => m * price < debt && !partialQuick.includes(m * price)).map(m => (
                  <button key={m} type="button" onClick={() => setPayAmount(m * price)} aria-pressed={payRounded === m * price}
                    className={`h-10 px-3 rounded-lg font-semibold cursor-pointer ${payRounded === m * price ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-emerald-300 hover:bg-slate-700'}`}>
                    {formatMonthsAr(m)} ({money(m * price)})
                  </button>
                ))}
                <button type="button" onClick={() => setPayAmount(debt)} aria-pressed={payRounded === debt}
                  className={`h-10 px-3 rounded-lg font-semibold cursor-pointer ${payRounded === debt ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-emerald-300 hover:bg-slate-700'}`}>
                  كل الدين ({money(debt)})
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="block text-slate-300 font-semibold mb-1">المبلغ المستلم الآن</span>
                  <input id="debt-pay-amount" type="number" inputMode="numeric" min={0} max={debt} step={1000} value={payAmount || ''}
                    onChange={e => { setError(null); setPayAmount(Number(e.target.value)); }}
                    className="w-full h-12 bg-slate-950 border-2 border-slate-700 rounded-lg px-3 text-lg text-white font-mono focus:outline-none focus:border-emerald-500" />
                </label>
                <div className={`rounded-lg p-3 border-2 ${leftAfter === 0 && payRounded > 0 ? 'border-emerald-700 bg-emerald-950/30' : 'border-amber-800/70 bg-amber-950/20'}`} aria-live="polite">
                  <span className="block text-slate-300 font-semibold">يبقى عليه بعد التسديد</span>
                  <span className={`text-lg font-bold ${leftAfter === 0 && payRounded > 0 ? 'text-emerald-300' : 'text-amber-300'}`}>
                    {payRounded > debt ? '—' : leftAfter === 0 && payRounded > 0 ? 'لا شيء، سُدِّد بالكامل' : money(leftAfter)}
                  </span>
                  {isPartial && price > 0 && leftAfter >= price && <span className="block text-slate-400">= {formatMonthsAr(Math.round((leftAfter / price) * 10) / 10)}</span>}
                </div>
              </div>
              <div>
                <span className="block text-slate-300 font-semibold mb-1">طريقة الدفع</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" role="group" aria-label="طريقة الدفع">
                  {METHODS.map(m => (
                    <button key={m.value} type="button" onClick={() => setMethod(m.value)} aria-pressed={method === m.value}
                      className={`h-10 rounded-lg font-semibold cursor-pointer border ${method === m.value ? 'bg-emerald-600/20 border-emerald-500 text-emerald-200' : 'bg-slate-950 border-slate-700 text-slate-300 hover:border-slate-500'}`}>
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
              <label className="block">
                <span className="block text-slate-300 font-semibold mb-1">ملاحظة (اختياري)</span>
                <input id="debt-pay-note" type="text" value={payNote} onChange={e => setPayNote(e.target.value)}
                  className="w-full h-10 bg-slate-950 border border-slate-700 rounded-lg px-3 text-white focus:outline-none focus:border-emerald-500" />
              </label>
              {sub.phone && (
                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                  <input type="checkbox" checked={sendWhatsApp} onChange={e => setSendWhatsApp(e.target.checked)} className="w-5 h-5 accent-emerald-500" />
                  إرسال رسالة واتساب للمشترك بالمبلغ المستلم والمتبقي
                </label>
              )}
              <button type="button" onClick={pay} disabled={payRounded <= 0 || payRounded > debt}
                className="w-full h-12 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-base font-bold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
                {payRounded <= 0 ? 'أدخل المبلغ المستلم' : payRounded > debt ? `المبلغ أكبر من الدين (${money(debt)})` : isPartial ? `تسجيل دفعة جزئية ${money(payRounded)}` : `تسديد كامل الدين ${money(payRounded)}`}
              </button>
            </section>
          )}

          {/* Adjust (admin only) */}
          <section className="space-y-2.5 border border-slate-800 rounded-xl p-3.5">
            <h3 className="font-bold text-white text-sm flex items-center gap-1.5">
              {isAdmin ? <Wallet className="w-4 h-4 text-amber-400" /> : <Lock className="w-4 h-4 text-slate-500" />}
              تعديل أو حذف الدين
              <span className="text-[10px] font-normal text-slate-500">(للمدير فقط)</span>
            </h3>
            {!isAdmin ? (
              <p className="text-slate-400 flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" /> لا تملك صلاحية تعديل الديون. اطلب ذلك من المدير العام.</p>
            ) : (
              <>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-slate-400">عدد الأشهر المستحقة:</span>
                  <button type="button" aria-label="إنقاص شهر" onClick={() => { setCustomAmount(''); setTargetMonths(m => Math.max(0, Math.round((m - 1) * 10) / 10)); }}
                    className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center cursor-pointer"><Minus className="w-4 h-4" /></button>
                  <span className="min-w-[3rem] text-center text-base font-bold text-amber-300">×{customAmount ? '—' : targetMonths}</span>
                  <button type="button" aria-label="إضافة شهر" onClick={() => { setCustomAmount(''); setTargetMonths(m => Math.round((m + 1) * 10) / 10); }}
                    className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center cursor-pointer"><Plus className="w-4 h-4" /></button>
                  <div className="flex gap-1">
                    {[0, 1, 2, 3, 6].map(m => (
                      <button key={m} type="button" onClick={() => { setCustomAmount(''); setTargetMonths(m); }}
                        className={`px-2 py-1 rounded-md font-bold cursor-pointer ${!customAmount && targetMonths === m ? 'bg-amber-600 text-white' : 'bg-slate-800 text-amber-300 hover:bg-slate-700'}`}>
                        ×{m}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label className="block">
                    <span className="block text-slate-400 mb-1">أو مبلغ محدد (اختياري)</span>
                    <input id="debt-custom-amount" type="number" min={0} step={1000} value={customAmount} onChange={e => setCustomAmount(e.target.value)} placeholder={String(Math.round(targetMonths * price))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-500" />
                  </label>
                  <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-2.5">
                    <span className="block text-slate-400">الدين بعد التعديل</span>
                    <span className="text-base font-bold text-amber-300">{money(targetDebt)}</span>
                    {price > 0 && <span className="block text-[10px] text-slate-500">= ×{Math.round((targetDebt / price) * 10) / 10} × {money(price)}</span>}
                  </div>
                </div>
                <input id="debt-reason" type="text" value={reason} onChange={e => setReason(e.target.value)} placeholder="سبب التعديل (إلزامي): مثلاً اتفاق، خطأ في الحساب، عطل طويل…"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500" />
                <div className="flex flex-col sm:flex-row gap-2">
                  <button type="button" onClick={saveAdjustment} className="flex-1 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold flex items-center justify-center gap-1.5 cursor-pointer">
                    <Save className="w-4 h-4" /> حفظ الدين الجديد
                  </button>
                  {debt > 0 && (
                    <button type="button" onClick={forgive} className="flex-1 py-2 rounded-lg bg-rose-700 hover:bg-rose-600 text-white font-bold flex items-center justify-center gap-1.5 cursor-pointer">
                      <Trash2 className="w-4 h-4" /> حذف الدين بالكامل (إعفاء)
                    </button>
                  )}
                </div>
              </>
            )}
          </section>

          {error && (
            <div role="alert" className="bg-rose-950/50 border border-rose-800 rounded-lg p-2.5 text-rose-200 flex gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
            </div>
          )}

          {/* History */}
          {((sub.debtLog && sub.debtLog.length > 0) || subPayments.length > 0) && (
            <section className="space-y-2">
              <h3 className="font-bold text-white text-sm flex items-center gap-1.5"><History className="w-4 h-4 text-cyan-400" /> السجل</h3>
              <ul className="space-y-1.5">
                {(sub.debtLog || []).slice(-5).reverse().map((l, i) => (
                  <li key={`l${i}`} className="bg-amber-950/20 border border-amber-900/50 rounded-lg px-2.5 py-1.5 text-amber-100">
                    <span className="font-bold">تعديل دين:</span> {money(l.from)} ← {money(l.to)} • {l.reason}
                    <span className="block text-[10px] text-amber-300/70">{l.by} • {l.at.slice(0, 16).replace('T', ' ')}</span>
                  </li>
                ))}
                {subPayments.map(p => (
                  <li key={p.id} className="bg-slate-950/60 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-300 flex justify-between gap-2">
                    <span>وصل {p.receiptNumber} • {p.date}</span>
                    <span className="font-bold text-emerald-400">{money(p.amount)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};
