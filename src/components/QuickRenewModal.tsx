import React, { useState } from 'react';
import { useEscapeKey } from './ui/useEscapeKey';
import { Subscriber } from '../types/isp';
import { X, RefreshCw, Calendar, DollarSign, CreditCard, Send, CheckCircle2, Gift, Sparkles } from 'lucide-react';
import { applicablePromotions, isPromotionApplicable, promotionEffect, type Promotion } from '../../shared/promotions';
import confetti from 'canvas-confetti';
import { getRemainingDebt } from '../utils/storage';
import { todayStr, parseLocalDate, addMonthsToDateStr } from '../utils/dates';
import { BackButton } from './ui/BackButton';

interface QuickRenewModalProps {
  isOpen: boolean;
  onClose: () => void;
  subscriber: Subscriber | null;
  onConfirmRenewal: (subId: string, renewalData: {
    durationMonths: number;
    amountPaid: number;
    paymentMethod: 'cash' | 'zain_cash' | 'qi_card' | 'transfer';
    sendWhatsAppReceipt: boolean;
    notes: string;
    promotion?: Promotion | null;
    bonusDays?: number;
  }) => void;
  /** العروض المعرّفة في الإعدادات */
  promotions?: Promotion[];
  /** مكافأة دعوة الأصدقاء المستحقة لهذا المشترك (تُطبَّق تلقائياً) */
  referralBonus?: { days: number; names: string[] } | null;
}

const MONTH_OPTIONS = [1, 2, 3, 6, 12];
const monthsLabel = (m: number) => (m === 1 ? 'شهر واحد' : m === 2 ? 'شهران' : m <= 10 ? `${m} أشهر` : `${m} شهراً`);

// الغلاف يضمن استدعاء الـ hooks دائماً بنفس الترتيب (قواعد React)، ويعيد ضبط الحقول عند كل فتح
export const QuickRenewModal: React.FC<QuickRenewModalProps> = (props) =>
  props.isOpen && props.subscriber ? <QuickRenewModalInner {...props} subscriber={props.subscriber} /> : null;

const QuickRenewModalInner: React.FC<QuickRenewModalProps & { subscriber: Subscriber }> = ({
  isOpen,
  onClose,
  subscriber,
  onConfirmRenewal,
  promotions,
  referralBonus,
}) => {
  useEscapeKey(onClose);

  // دين الدورة الحالية غير المسدد يُرحَّل إلى الدورة الجديدة
  const previousDebt = getRemainingDebt(subscriber);
  // سعر جديد مجدول للباقة يبدأ مع هذا التجديد
  const price = subscriber.pendingPrice?.salePrice ?? subscriber.salePrice;
  const [months, setMonths] = useState<number>(1);
  // المبلغ المقترح يشمل أفضل عرض صالح لشهر واحد (إن وُجد)
  const [amountPaid, setAmountPaid] = useState<number>(() => {
    const e = applicablePromotions(promotions, { months: 1, salePrice: price, today: todayStr(), expiryDate: subscriber.expiryDate })[0]?.effect;
    return price * (1 + (e?.freeMonths || 0)) - (e?.discount || 0) + previousDebt;
  });
  const [declined, setDeclined] = useState(false); // اختار «بدون عرض» صراحة
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'zain_cash' | 'qi_card' | 'transfer'>('cash');
  const [sendReceipt, setSendReceipt] = useState<boolean>(true);
  const [notes, setNotes] = useState<string>('تجديد اشتراك دورة جديدة');

  // العروض: الصالحة لهذه المدة، و«تلميح» بعرض يتحقق بمدة أطول
  const today = todayStr();
  const ctxFor = (m: number) => ({ months: m, salePrice: price, today, expiryDate: subscriber.expiryDate });
  const offers = applicablePromotions(promotions, ctxFor(months));
  const [promoId, setPromoId] = useState<string | null>(() => applicablePromotions(promotions, ctxFor(1))[0]?.promo.id ?? null);
  const selected = offers.find(o => o.promo.id === promoId) || null;
  const effect = selected?.effect ?? { freeMonths: 0, discount: 0 };
  const nudge = (promotions || [])
    .filter(p => p.minMonths > months && MONTH_OPTIONS.includes(p.minMonths) && isPromotionApplicable(p, ctxFor(p.minMonths)))
    .sort((a, b) => a.minMonths - b.minMonths)[0];
  const bonusDays = referralBonus?.days || 0;

  // نفس معادلة الدين: الأشهر المجانية داخلة في المدة وقيمتها تُطرح، فيبقى المطلوب = سعر الأشهر المدفوعة
  const dueFor = (m: number, e: { freeMonths: number; discount: number }) => price * (m + e.freeMonths) - e.discount + previousDebt;

  // Calculate new proposed expiry date
  const computeNewExpiry = () => {
    // If expired, start from today. If still active, extend from current expiry date.
    const base = parseLocalDate(subscriber.expiryDate) > parseLocalDate(today) ? subscriber.expiryDate : today;
    const d = parseLocalDate(addMonthsToDateStr(base, months + effect.freeMonths));
    d.setDate(d.getDate() + bonusDays);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const choose = (m: number, id: string | null, explicit = false) => {
    if (explicit) setDeclined(id === null);
    const list = applicablePromotions(promotions, ctxFor(m));
    const keep = list.find(o => o.promo.id === id) || null;
    setMonths(m);
    setPromoId(keep?.promo.id ?? null);
    setAmountPaid(dueFor(m, keep ? promotionEffect(keep.promo, ctxFor(m)) : { freeMonths: 0, discount: 0 }));
  };
  const handleMonthsChange = (m: number) => choose(m, declined ? null : (promoId ?? applicablePromotions(promotions, ctxFor(m))[0]?.promo.id ?? null));

  const expectedTotal = dueFor(months, effect);
  const remainingDebt = Math.max(0, expectedTotal - amountPaid);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Trigger celebration confetti
    try {
      confetti({
        particleCount: 60,
        spread: 70,
        origin: { y: 0.6 },
      });
    } catch (e) {
      // ignore
    }

    onConfirmRenewal(subscriber.id, {
      durationMonths: months,
      amountPaid: Number(amountPaid) || 0,
      paymentMethod,
      sendWhatsAppReceipt: sendReceipt,
      notes: selected ? `${notes} • عرض: ${selected.promo.name}` : notes,
      promotion: selected?.promo ?? null,
      bonusDays,
    });

    onClose();
  };

  return (
    <div className="app-overlay fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-cyan-500/30 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-cyan-900/40 via-slate-800 to-slate-900 border-b border-cyan-500/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 flex items-center justify-center shadow-lg shadow-cyan-500/10">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">تجديد اشتراك المشترك</h2>
              <p className="text-xs text-cyan-300 font-semibold">{subscriber.name} ({subscriber.username})</p>
            </div>
          </div>
          <BackButton onClick={onClose} />
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Subscriber info preview badge */}
          <div className="bg-slate-800/80 rounded-xl p-3 border border-slate-700 flex items-center justify-between text-xs">
            <div>
              <span className="text-slate-400 block">الباقة والمزود:</span>
              <span className="text-white font-bold">{subscriber.planName} • {subscriber.upstreamProvider}</span>
            </div>
            <div className="text-left" dir="ltr">
              <span className="text-slate-400 block text-right">سعر الباقة الشهري:</span>
              <span className="text-cyan-400 font-bold">{price.toLocaleString()} د.ع</span>
              {subscriber.pendingPrice && <span className="block text-[10px] text-amber-300">سعر جديد (كان {subscriber.salePrice.toLocaleString()})</span>}
            </div>
          </div>

          {/* Renewal Duration Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              مدة التجديد المطلوبة
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {MONTH_OPTIONS.map((m) => (
                <button
                  type="button"
                  key={m}
                  onClick={() => handleMonthsChange(m)}
                  className={`py-2 px-3 rounded-lg text-xs font-bold border transition cursor-pointer flex flex-col items-center gap-0.5 ${
                    months === m
                      ? 'bg-cyan-600 text-white border-cyan-400 shadow-md shadow-cyan-600/30'
                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750'
                  }`}
                >
                  <span>{monthsLabel(m)}</span>
                  <span className="text-[10px] opacity-80">{(price * m).toLocaleString()} د.ع</span>
                </button>
              ))}
            </div>
          </div>

          {/* العروض */}
          {(offers.length > 0 || nudge) && (
            <div className="space-y-2">
              <span className="block text-sm font-semibold text-slate-200 flex items-center gap-1.5"><Gift className="w-4 h-4 text-emerald-300" /> العروض</span>
              {offers.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {offers.map(o => (
                    <button key={o.promo.id} type="button" onClick={() => choose(months, o.promo.id, true)} aria-pressed={promoId === o.promo.id}
                      className={`min-h-11 px-3 py-1.5 rounded-xl border-2 text-sm font-semibold cursor-pointer text-right ${promoId === o.promo.id ? 'bg-emerald-500/15 border-emerald-400 text-emerald-100' : 'bg-slate-800 border-slate-700 text-slate-200'}`}>
                      {o.promo.name}
                      <span className="block text-xs font-normal opacity-80">{o.effect.freeMonths ? `+${monthsLabel(o.effect.freeMonths)} مجاناً` : `توفير ${o.effect.discount.toLocaleString()} د.ع`}</span>
                    </button>
                  ))}
                  <button type="button" onClick={() => choose(months, null, true)} aria-pressed={promoId === null}
                    className={`min-h-11 px-3 rounded-xl border-2 text-sm cursor-pointer ${promoId === null ? 'bg-white/10 border-slate-300 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
                    بدون عرض
                  </button>
                </div>
              )}
              {nudge && (
                <button type="button" onClick={() => choose(nudge.minMonths, nudge.id, true)}
                  className="w-full min-h-11 rounded-xl border border-dashed border-emerald-600/70 bg-emerald-950/30 text-emerald-200 text-sm px-3 py-2 flex items-center gap-2 cursor-pointer text-right">
                  <Sparkles className="w-4 h-4 flex-shrink-0" />
                  جدّد {monthsLabel(nudge.minMonths)} واحصل على «{nudge.name}»
                </button>
              )}
            </div>
          )}

          {bonusDays > 0 && (
            <div className="bg-emerald-950/30 border border-emerald-800/60 rounded-xl p-3 text-sm text-emerald-100 flex items-start gap-2">
              <Gift className="w-4 h-4 text-emerald-300 mt-0.5 flex-shrink-0" />
              <span>مكافأة دعوة الأصدقاء: <b>+{bonusDays} يوماً</b> مجاناً (عن: {referralBonus!.names.join('، ')}) — تُضاف تلقائياً.</span>
            </div>
          )}

          {previousDebt > 0 && (
            <div className="bg-amber-950/40 border border-amber-800/70 rounded-xl p-3 text-xs text-amber-200 flex items-center justify-between">
              <span>دين سابق غير مسدد (يُضاف للمستحق):</span>
              <span className="font-bold text-amber-300">{previousDebt.toLocaleString()} د.ع</span>
            </div>
          )}

          <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-3 text-xs text-slate-300 flex items-center justify-between">
            <span>إجمالي المستحق الآن:{effect.discount > 0 && <span className="block text-emerald-300">بعد توفير {effect.discount.toLocaleString()} د.ع</span>}</span>
            <span className="font-bold text-white">{expectedTotal.toLocaleString()} د.ع</span>
          </div>

          {/* Amount Paid vs Debt */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              المبلغ المستلم نقداً / إلكترونياً
            </label>
            <div className="relative">
              <DollarSign className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
              <input
                type="number"
                step="250"
                min="0"
                required
                value={amountPaid}
                onChange={(e) => setAmountPaid(Number(e.target.value))}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg pr-9 pl-12 py-2.5 text-base font-bold text-cyan-300 focus:outline-none focus:border-cyan-500"
              />
              <span className="text-xs text-slate-400 absolute left-3 top-3">د.ع</span>
            </div>

            {remainingDebt > 0 ? (
              <p className="mt-1 text-xs text-rose-400 font-semibold bg-rose-950/40 p-2 rounded border border-rose-900/60">
                ⚠️ سيتم تسجيل متبقي بذمة المشترك كدين: {remainingDebt.toLocaleString()} د.ع
              </p>
            ) : (
              <p className="mt-1 text-xs text-emerald-400 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>تم تسديد كامل المبلغ المطلوب</span>
              </p>
            )}
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              طريقة الاستلام والدفع
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'cash', label: 'كاش يد بيد', icon: DollarSign },
                { id: 'zain_cash', label: 'زين كاش', icon: CreditCard },
                { id: 'qi_card', label: 'كي كارد / ماستر', icon: CreditCard },
                { id: 'transfer', label: 'حوالة مكتب', icon: CreditCard },
              ].map((method) => {
                const Icon = method.icon;
                return (
                  <button
                    key={method.id}
                    type="button"
                    onClick={() => setPaymentMethod(method.id as any)}
                    className={`py-2 px-2 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1.5 transition cursor-pointer ${
                      paymentMethod === method.id
                        ? 'bg-indigo-600/30 border-indigo-500 text-indigo-300'
                        : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{method.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* New Expiry Date Info */}
          <div className="bg-slate-800/60 p-3 rounded-lg border border-slate-700/80 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-cyan-400" />
              <span className="text-slate-300">تاريخ الانتهاء الجديد:</span>
            </div>
            <span className="text-emerald-400 font-bold font-mono text-sm" dir="ltr">
              {computeNewExpiry()}
            </span>
          </div>

          {/* WhatsApp Receipt Toggle */}
          <div className="pt-1">
            <label className="flex items-center gap-2.5 p-2 rounded-lg bg-emerald-950/30 border border-emerald-800/40 cursor-pointer">
              <input
                type="checkbox"
                checked={sendReceipt}
                onChange={(e) => setSendReceipt(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-500 bg-slate-900 border-slate-700"
              />
              <div className="text-xs">
                <span className="font-bold text-emerald-300 flex items-center gap-1">
                  <Send className="w-3.5 h-3.5" />
                  <span>فتح واتساب لإرسال وصل التجديد للمشترك فوراً</span>
                </span>
                <span className="text-slate-400 text-[11px] block">
                  سيتم تجهيز رسالة إشعار الدفع وتاريخ التجديد برقم هاتفه: {subscriber.phone}
                </span>
              </div>
            </label>
          </div>

          {/* Submit Actions */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-semibold cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-lg shadow-cyan-600/30 transition cursor-pointer flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              <span>تأكيد التجديد وتحديث الحساب</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
