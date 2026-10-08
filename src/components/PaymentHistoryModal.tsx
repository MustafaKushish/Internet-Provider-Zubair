import React, { useState } from 'react';
import { Subscriber, PaymentRecord, SystemSettings, StaffUser } from '../types/isp';
import { formatCurrency, generateWhatsAppLink, getRemainingDebt, getAmountDue } from '../utils/storage';
import { todayStr } from '../utils/dates';
import {
  X,
  History,
  Plus,
  Printer,
  Send,
  DollarSign,
  Calendar,
  Receipt,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  FileText,
  Trash2,
  Lock
} from 'lucide-react';
import { appConfirm } from './ui/Dialogs';

interface PaymentHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  subscriber: Subscriber | null;
  payments: PaymentRecord[];
  settings: SystemSettings;
  currentUser: StaffUser;
  onAddPayment: (payment: Partial<PaymentRecord>) => void;
  onPrintReceipt: (subscriber: Subscriber, customAmount?: number) => void;
  onDeletePayment?: (paymentId: string) => void;
}

// الغلاف يضمن استدعاء الـ hooks دائماً بنفس الترتيب (قواعد React)، ويعيد ضبط الحقول عند كل فتح
export const PaymentHistoryModal: React.FC<PaymentHistoryModalProps> = (props) =>
  props.isOpen && props.subscriber ? <PaymentHistoryModalInner {...props} subscriber={props.subscriber} /> : null;

const PaymentHistoryModalInner: React.FC<PaymentHistoryModalProps & { subscriber: Subscriber }> = ({
  isOpen,
  onClose,
  subscriber,
  payments,
  settings,
  currentUser,
  onAddPayment,
  onPrintReceipt,
  onDeletePayment,
}) => {

  const [showAddForm, setShowAddForm] = useState(false);
  const [newAmount, setNewAmount] = useState<number>(getRemainingDebt(subscriber) > 0 ? getRemainingDebt(subscriber) : subscriber.salePrice);
  const [newMethod, setNewMethod] = useState<'cash' | 'zain_cash' | 'qi_card' | 'transfer'>('cash');
  const [newPaymentType, setNewPaymentType] = useState<'renewal' | 'debt_installment' | 'addon'>('debt_installment');
  const [newNotes, setNewNotes] = useState('تسديد دفعة / قسط من الحساب');

  // Filter payments for this subscriber
  const subscriberPayments = payments
    .filter(p => p.subscriberId === subscriber.id)
    .sort((a, b) => b.date.localeCompare(a.date) || (b.receiptNumber || '').localeCompare(a.receiptNumber || ''));

  const totalLifetimePaid = subscriberPayments.reduce((acc, p) => acc + p.amount, 0);
  const remainingDebt = getRemainingDebt(subscriber);
  const amountDue = getAmountDue(subscriber);

  const handleRecordPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (newAmount <= 0) return;

    // رقم الوصل والمتبقي يُحسبان في App بشكل تسلسلي وموحّد
    onAddPayment({
      subscriberId: subscriber.id,
      subscriberName: subscriber.name,
      amount: Number(newAmount),
      date: todayStr(),
      paymentMethod: newMethod,
      paymentType: newPaymentType,
      notes: newNotes,
    });

    setShowAddForm(false);
    setNewNotes('تسديد دفعة / قسط من الحساب');
  };

  const handleSendPaymentReceiptWhatsApp = (p: PaymentRecord) => {
    const message = `وصل استلام مالي 🧾
عزيزي المشترك ${subscriber.name}،
تم استلام دفعة مالية لحسابك:
▫️ رقم الوصل: ${p.receiptNumber}
▫️ المبلغ: ${formatCurrency(p.amount, settings.currency)}
▫️ التاريخ: ${p.date}
▫️ طريقة الدفع: ${p.paymentMethod === 'cash' ? 'نقداً (كاش)' : p.paymentMethod === 'zain_cash' ? 'زين كاش' : p.paymentMethod === 'qi_card' ? 'كي كارد' : 'تحويل'}
▫️ البيان: ${p.notes || 'تسديد اشتراك'}

شكراً لتعاملكم معنا،
${settings.ispName} - ${settings.contactPhone}`;

    const link = generateWhatsAppLink(subscriber.phone, message);
    window.open(link, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-3xl w-full shadow-2xl overflow-hidden my-6">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-800/80 border-b border-slate-700/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-600/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                سجل المدفوعات والوصولات السابقة
              </h2>
              <p className="text-xs text-slate-400">
                المشترك: <span className="text-white font-bold">{subscriber.name}</span> ({subscriber.username})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-700/50 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Financial Summary Top Bar */}
        <div className="p-6 bg-slate-850 border-b border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700">
            <span className="text-slate-400 block text-[11px]">المستحق للدورة الحالية</span>
            <span className="text-sm font-bold text-cyan-400 font-mono">
              {formatCurrency(amountDue, settings.currency)}
            </span>
            {(subscriber.cycleMonths || 1) > 1 || (subscriber.carriedDebt || 0) > 0 ? (
              <span className="text-[10px] text-slate-400 block mt-0.5">
                {formatCurrency(subscriber.salePrice, settings.currency)} × {subscriber.cycleMonths || 1}
                {(subscriber.carriedDebt || 0) > 0 ? ` + دين سابق ${formatCurrency(subscriber.carriedDebt || 0, settings.currency)}` : ''}
              </span>
            ) : null}
          </div>

          <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700">
            <span className="text-slate-400 block text-[11px]">المسدد لهذه الدورة / الحالة</span>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-sm font-bold text-emerald-400 font-mono">
                {formatCurrency(subscriber.paidAmount, settings.currency)}
              </span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                subscriber.paymentStatus === 'paid'
                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                  : subscriber.paymentStatus === 'pending'
                  ? 'bg-amber-950 text-amber-300 border border-amber-800'
                  : 'bg-rose-950 text-rose-300 border border-rose-800'
              }`}>
                {subscriber.paymentStatus === 'paid' ? 'مدفوع' : subscriber.paymentStatus === 'pending' ? 'قيد الدفع' : 'متأخر (Overdue)'}
              </span>
            </div>
          </div>

          <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700">
            <span className="text-slate-400 block text-[11px]">المتبقي بذمته (المتأخر/الدين)</span>
            <span className={`text-sm font-bold font-mono ${remainingDebt > 0 ? 'text-rose-400' : 'text-slate-300'}`}>
              {remainingDebt > 0 ? formatCurrency(remainingDebt, settings.currency) : '0 د.ع (خالص)'}
            </span>
          </div>
        </div>

        {/* Action Button & New Payment Toggle */}
        <div className="px-6 pt-4 flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
            <Receipt className="w-4 h-4 text-cyan-400" />
            <span>كشف الحركات والوصولات ({subscriberPayments.length} حركة مسجلة)</span>
          </h3>

          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-md shadow-cyan-600/20 transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{showAddForm ? 'إلغاء الإدخال' : 'تسجيل دفعة / قسط جديد'}</span>
          </button>
        </div>

        {/* Add Payment Inline Form */}
        {showAddForm && (
          <form onSubmit={handleRecordPayment} className="m-6 p-4 bg-slate-950 border border-cyan-500/40 rounded-xl space-y-3 animate-in fade-in duration-150">
            <h4 className="text-xs font-bold text-cyan-400 flex items-center gap-1">
              <DollarSign className="w-3.5 h-3.5" />
              <span>تسجيل دفعة نقدية / تسديد قسط للمشترك</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">المبلغ المسدد</label>
                <input
                  type="number"
                  step="1000"
                  required
                  value={newAmount}
                  onChange={(e) => setNewAmount(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-bold font-mono focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">طريقة الدفع</label>
                <select
                  value={newMethod}
                  onChange={(e) => setNewMethod(e.target.value as any)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-cyan-500"
                >
                  <option value="cash">نقداً (كاش)</option>
                  <option value="zain_cash">زين كاش</option>
                  <option value="qi_card">كي كارد / ماستر</option>
                  <option value="transfer">تحويل مكتب</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">نوع الدفعة</label>
                <select
                  value={newPaymentType}
                  onChange={(e) => setNewPaymentType(e.target.value as any)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-cyan-500"
                >
                  <option value="debt_installment">تسديد قسط / دين متأخر</option>
                  <option value="renewal">تجديد دورة اشتراك</option>
                  <option value="addon">إضافة رصيد / خدمة إضافية</option>
                </select>
              </div>

              <div className="sm:col-span-3">
                <label className="block text-slate-400 mb-1 font-semibold">ملاحظات الوصل</label>
                <input
                  type="text"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="مثال: تسديد نقدي للدفعة الثانية، متبقي 10 آلاف"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-cyan-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white text-xs cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold shadow-md shadow-emerald-600/30 cursor-pointer"
              >
                تأكيد وحفظ الدفعة
              </button>
            </div>
          </form>
        )}

        {/* Transactions Table */}
        <div className="p-6">
          <div className="max-h-80 overflow-y-auto border border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-800 text-slate-300 font-bold sticky top-0">
                <tr>
                  <th className="p-3">رقم الوصل</th>
                  <th className="p-3">التاريخ</th>
                  <th className="p-3">المبلغ المسدد</th>
                  <th className="p-3">طريقة الدفع</th>
                  <th className="p-3">البيان / الملاحظات</th>
                  <th className="p-3 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-200">
                {subscriberPayments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500">
                      <FileText className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                      <span>لا توجد دفعات مسجلة سابقة لهذا المشترك حتى الآن.</span>
                    </td>
                  </tr>
                ) : (
                  subscriberPayments.map((pay) => (
                    <tr key={pay.id} className="hover:bg-slate-800/40">
                      <td className="p-3 font-mono font-bold text-cyan-400" dir="ltr">
                        {pay.receiptNumber}
                      </td>
                      <td className="p-3 font-mono text-slate-400" dir="ltr">
                        {pay.date}
                      </td>
                      <td className="p-3 font-bold text-emerald-400 text-sm font-mono">
                        {formatCurrency(pay.amount, settings.currency)}
                      </td>
                      <td className="p-3 text-slate-300">
                        {pay.paymentMethod === 'cash' ? 'نقداً (كاش)' : pay.paymentMethod === 'zain_cash' ? 'زين كاش' : pay.paymentMethod === 'qi_card' ? 'كي كارد' : 'تحويل'}
                      </td>
                      <td className="p-3 text-slate-400 max-w-xs truncate">
                        {pay.notes || 'تسديد اشتراك'}
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => onPrintReceipt(subscriber, pay.amount)}
                            title="طباعة وصل هذه الدفعة"
                            className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white p-1.5 rounded-lg border border-slate-700 transition cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleSendPaymentReceiptWhatsApp(pay)}
                            title="إرسال وصل بالواتساب"
                            className="bg-emerald-600 hover:bg-emerald-500 text-white p-1.5 rounded-lg transition cursor-pointer"
                          >
                            <Send className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete Invoice Button - Strictly for Admin only */}
                          {currentUser.role === 'admin' ? (
                            <button
                              onClick={async () => {
                                if (onDeletePayment && await appConfirm(`تنبيه أمني للمدير العام: هل أنت متأكد من حذف الوصل رقم (${pay.receiptNumber}) بمبلغ (${formatCurrency(pay.amount, settings.currency)})؟ سيتم خصمه من رصيد المشترك.`)) {
                                  onDeletePayment(pay.id);
                                }
                              }}
                              title="حذف هذا الوصل (صلاحية المدير العام فقط)"
                              className="bg-slate-800 hover:bg-rose-950/80 text-slate-400 hover:text-rose-400 p-1.5 rounded-lg border border-slate-700 hover:border-rose-800 transition cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <span
                              title="حذف وصولات الدفع مخصص للمدير العام فقط"
                              className="text-slate-600 p-1.5 cursor-not-allowed"
                            >
                              <Lock className="w-3.5 h-3.5" />
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>إجمالي المبالغ المسددة تاريخياً: <strong className="text-emerald-400">{formatCurrency(totalLifetimePaid, settings.currency)}</strong></span>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg cursor-pointer"
            >
              إغلاق
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
