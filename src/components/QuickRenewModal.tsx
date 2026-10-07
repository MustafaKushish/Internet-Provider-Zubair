import React, { useState } from 'react';
import { Subscriber } from '../types/isp';
import { X, RefreshCw, Calendar, DollarSign, CreditCard, Send, CheckCircle2 } from 'lucide-react';
import confetti from 'canvas-confetti';
import { getRemainingDebt } from '../utils/storage';
import { todayStr, parseLocalDate, addMonthsToDateStr } from '../utils/dates';

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
  }) => void;
}

// الغلاف يضمن استدعاء الـ hooks دائماً بنفس الترتيب (قواعد React)، ويعيد ضبط الحقول عند كل فتح
export const QuickRenewModal: React.FC<QuickRenewModalProps> = (props) =>
  props.isOpen && props.subscriber ? <QuickRenewModalInner {...props} subscriber={props.subscriber} /> : null;

const QuickRenewModalInner: React.FC<QuickRenewModalProps & { subscriber: Subscriber }> = ({
  isOpen,
  onClose,
  subscriber,
  onConfirmRenewal,
}) => {

  // دين الدورة الحالية غير المسدد يُرحَّل إلى الدورة الجديدة
  const previousDebt = getRemainingDebt(subscriber);
  const [months, setMonths] = useState<number>(1);
  const [amountPaid, setAmountPaid] = useState<number>(subscriber.salePrice + previousDebt);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'zain_cash' | 'qi_card' | 'transfer'>('cash');
  const [sendReceipt, setSendReceipt] = useState<boolean>(true);
  const [notes, setNotes] = useState<string>('تجديد اشتراك دورة جديدة');

  // Calculate new proposed expiry date
  const computeNewExpiry = () => {
    // If expired, start from today. If still active, extend from current expiry date.
    const today = todayStr();
    const base = parseLocalDate(subscriber.expiryDate) > parseLocalDate(today) ? subscriber.expiryDate : today;
    return addMonthsToDateStr(base, months);
  };

  const handleMonthsChange = (m: number) => {
    setMonths(m);
    setAmountPaid(subscriber.salePrice * m + previousDebt);
  };

  const expectedTotal = subscriber.salePrice * months + previousDebt;
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
      notes,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-cyan-500/30 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
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
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
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
              <span className="text-cyan-400 font-bold">{subscriber.salePrice.toLocaleString()} د.ع</span>
            </div>
          </div>

          {/* Renewal Duration Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              مدة التجديد المطلوبة
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3].map((m) => (
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
                  <span>{m === 1 ? 'شهر واحد' : m === 2 ? 'شهران' : '3 أشهر'}</span>
                  <span className="text-[10px] opacity-80">{(subscriber.salePrice * m).toLocaleString()} د.ع</span>
                </button>
              ))}
            </div>
          </div>

          {previousDebt > 0 && (
            <div className="bg-amber-950/40 border border-amber-800/70 rounded-xl p-3 text-xs text-amber-200 flex items-center justify-between">
              <span>دين سابق غير مسدد (يُضاف للمستحق):</span>
              <span className="font-bold text-amber-300">{previousDebt.toLocaleString()} د.ع</span>
            </div>
          )}

          <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-3 text-xs text-slate-300 flex items-center justify-between">
            <span>إجمالي المستحق الآن:</span>
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
