import React, { useMemo, useState } from 'react';
import { useEscapeKey } from './ui/useEscapeKey';
import { appConfirm } from './ui/Dialogs';
import { PaymentRecord, StaffUser, Subscriber, SystemSettings } from '../types/isp';
import { formatCurrency, getAmountDue, getRemainingDebt } from '../utils/storage';
import { debtInMonths, formatMonthsAr, monthsLate } from '../utils/debt';
import { X, Wallet, Lock, Minus, Plus, History, Trash2, Save, CreditCard, AlertTriangle } from 'lucide-react';

interface DebtModalProps {
  subscriber: Subscriber | null;
  payments: PaymentRecord[];
  settings: SystemSettings;
  currentUser: StaffUser;
  onClose: () => void;
  onAddPayment: (subscriberId: string, data: { amount: number; paymentMethod: PaymentRecord['paymentMethod']; notes: string }) => void;
  onAdjustDebt: (subscriberId: string, newDebt: number, reason: string) => void;
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

  // ---- تعديل الدين (للمدير فقط) ----
  const [targetMonths, setTargetMonths] = useState<number>(months);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const targetDebt = customAmount.trim() !== '' ? Math.max(0, Number(customAmount) || 0) : Math.round(targetMonths * price);

  const subPayments = useMemo(
    () => payments.filter(p => p.subscriberId === sub.id).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6),
    [payments, sub.id],
  );

  const pay = () => {
    setError(null);
    const amount = Math.round(payAmount);
    if (!amount || amount <= 0) { setError('أدخل مبلغ التسديد.'); return; }
    if (amount > debt) { setError(`المبلغ أكبر من الدين (${money(debt)}).`); return; }
    onAddPayment(sub.id, { amount, paymentMethod: method, notes: payNote.trim() || `تسديد دين (${formatMonthsAr(amount / (price || amount))})` });
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto" onClick={onClose}>
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
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white p-2 rounded-lg cursor-pointer" aria-label="إغلاق">
            <X className="w-5 h-5" />
          </button>
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

          {/* Pay */}
          {debt > 0 && (
            <section className="space-y-2.5 border border-slate-800 rounded-xl p-3.5">
              <h3 className="font-bold text-white text-sm flex items-center gap-1.5"><CreditCard className="w-4 h-4 text-emerald-400" /> تسديد الدين</h3>
              <div className="flex flex-wrap gap-1.5">
                {price > 0 && quick.filter(m => m * price <= debt).map(m => (
                  <button key={m} type="button" onClick={() => setPayAmount(m * price)}
                    className={`px-2.5 py-1.5 rounded-lg font-bold cursor-pointer ${payAmount === m * price ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-emerald-300 hover:bg-slate-700'}`}>
                    ×{m} ({money(m * price)})
                  </button>
                ))}
                <button type="button" onClick={() => setPayAmount(debt)}
                  className={`px-2.5 py-1.5 rounded-lg font-bold cursor-pointer ${payAmount === debt ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-emerald-300 hover:bg-slate-700'}`}>
                  كل الدين ({money(debt)})
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input id="debt-pay-amount" type="number" min={0} step={1000} value={payAmount || ''} onChange={e => setPayAmount(Number(e.target.value))}
                  className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-emerald-500" aria-label="مبلغ التسديد" />
                <select id="debt-pay-method" value={method} onChange={e => setMethod(e.target.value as PaymentRecord['paymentMethod'])}
                  className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500" aria-label="طريقة الدفع">
                  {METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
                <input id="debt-pay-note" type="text" value={payNote} onChange={e => setPayNote(e.target.value)} placeholder="ملاحظة (اختياري)"
                  className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500" />
              </div>
              <button type="button" onClick={pay} className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer">
                تسجيل وصل تسديد {payAmount > 0 ? money(payAmount) : ''}
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
