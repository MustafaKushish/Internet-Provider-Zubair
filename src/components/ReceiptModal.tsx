import React from 'react';
import { Subscriber, SystemSettings } from '../types/isp';
import { formatCurrency, getRemainingDebt } from '../utils/storage';
import { todayStr } from '../utils/dates';
import { X, Printer, Wifi, ShieldCheck, CheckCircle } from 'lucide-react';

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  subscriber: Subscriber | null;
  settings: SystemSettings;
  customAmount?: number;
  receiptNumber?: string;
  receiptDate?: string;
}

// الغلاف يضمن استدعاء الـ hooks دائماً بنفس الترتيب (قواعد React)، ويعيد ضبط الحقول عند كل فتح
export const ReceiptModal: React.FC<ReceiptModalProps> = (props) =>
  props.isOpen && props.subscriber ? <ReceiptModalInner {...props} subscriber={props.subscriber} /> : null;

const ReceiptModalInner: React.FC<ReceiptModalProps & { subscriber: Subscriber }> = ({
  isOpen,
  onClose,
  subscriber,
  settings,
  customAmount,
  receiptNumber: receiptNumberProp,
  receiptDate,
}) => {

  // رقم الوصل الحقيقي من سجل الدفعات (وليس رقماً مشتقاً من معرّف المشترك)
  const receiptNumber = receiptNumberProp || '—';
  const today = receiptDate || todayStr();
  const paid = customAmount !== undefined ? customAmount : subscriber.paidAmount;
  // المتبقي الفعلي بذمة المشترك
  const remainingDebt = getRemainingDebt(subscriber);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden my-6">
        {/* Top Controls (Hidden on print) */}
        <div className="px-6 py-3 bg-slate-800/80 border-b border-slate-700/80 flex items-center justify-between no-print">
          <span className="text-sm font-bold text-slate-200">معاينة وطباعة وصل القبض</span>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة الوصل</span>
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-700/50 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* The Printable Receipt Document */}
        <div className="p-8 bg-white text-slate-900 font-sans print:p-0 print:m-0" id="printable-receipt">
          {/* Header */}
          <div className="border-b-2 border-slate-800 pb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center">
                <Wifi className="w-7 h-7 text-cyan-400" />
              </div>
              <div>
                <h1 className="text-xl font-black text-slate-900">{settings.ispName}</h1>
                <p className="text-xs text-slate-600 font-semibold">{settings.agentName} • {settings.contactPhone}</p>
                <p className="text-[11px] text-slate-500">{settings.address}</p>
              </div>
            </div>
            <div className="text-left" dir="ltr">
              <span className="inline-block bg-slate-100 text-slate-800 border border-slate-300 text-xs px-2.5 py-1 rounded font-mono font-bold">
                {receiptNumber}
              </span>
              <p className="text-xs text-slate-500 mt-1">التاريخ: {today}</p>
            </div>
          </div>

          {/* Receipt Title */}
          <div className="text-center py-4">
            <h2 className="text-lg font-black tracking-wide text-slate-900 border-b inline-block px-4 pb-1">
              وصل استلام وتسديد اشتراك إنترنت
            </h2>
          </div>

          {/* Subscriber Data Grid */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 grid grid-cols-2 gap-3 text-xs mb-4">
            <div>
              <span className="text-slate-500 block">اسم المشترك:</span>
              <span className="text-sm font-bold text-slate-900">{subscriber.name}</span>
            </div>
            <div>
              <span className="text-slate-500 block">رقم الهاتف:</span>
              <span className="text-sm font-bold text-slate-900 font-mono" dir="ltr">{subscriber.phone}</span>
            </div>
            <div>
              <span className="text-slate-500 block">اسم المستخدم (User):</span>
              <span className="text-sm font-bold text-indigo-700 font-mono" dir="ltr">{subscriber.username}</span>
            </div>
            <div>
              <span className="text-slate-500 block">البرج / التغذية:</span>
              <span className="text-sm font-semibold text-slate-800">{subscriber.towerName}</span>
            </div>
          </div>

          {/* Plan & Payment Table */}
          <table className="w-full text-xs text-right border border-slate-300 rounded-lg overflow-hidden mb-4">
            <thead className="bg-slate-800 text-white font-bold">
              <tr>
                <th className="p-2.5">البيان / نوع الباقة</th>
                <th className="p-2.5">المزود</th>
                <th className="p-2.5">صالح لغاية</th>
                <th className="p-2.5 text-left" dir="ltr">المبلغ المسدد</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              <tr>
                <td className="p-2.5 font-bold text-slate-900">{subscriber.planName}</td>
                <td className="p-2.5 text-slate-600">{subscriber.upstreamProvider}</td>
                <td className="p-2.5 font-bold text-emerald-700 font-mono" dir="ltr">{subscriber.expiryDate}</td>
                <td className="p-2.5 font-black text-slate-900 text-sm text-left" dir="ltr">
                  {formatCurrency(paid, settings.currency)}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Financial summary breakdown */}
          <div className="flex justify-end mb-6">
            <div className="w-64 bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>سعر الاشتراك:</span>
                <span className="font-bold">{formatCurrency(subscriber.salePrice, settings.currency)}</span>
              </div>
              <div className="flex justify-between text-emerald-700 font-bold border-t pt-1">
                <span>المبلغ المدفوع:</span>
                <span>{formatCurrency(paid, settings.currency)}</span>
              </div>
              <div className="flex justify-between text-rose-600 font-bold border-t pt-1">
                <span>المتبقي بذمة المشترك:</span>
                <span>{remainingDebt > 0 ? formatCurrency(remainingDebt, settings.currency) : '0 د.ع (خالص)'}</span>
              </div>
            </div>
          </div>

          {/* Footer & Signature */}
          <div className="border-t border-slate-200 pt-4 flex items-center justify-between text-[11px] text-slate-500">
            <div>
              <p className="font-semibold text-slate-700">توقيع المستلم / الوكيل:</p>
              <p className="mt-4 italic">.......................................</p>
            </div>
            <div className="text-left text-slate-400">
              <p className="flex items-center gap-1 font-semibold text-emerald-600">
                <CheckCircle className="w-3.5 h-3.5" />
                <span>إيصال معتمد من المنظومة</span>
              </p>
              <p className="text-[10px] mt-1">{settings.whatsappFooter}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
