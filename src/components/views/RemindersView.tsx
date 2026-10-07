import React, { useState } from 'react';
import { Subscriber, SystemSettings } from '../../types/isp';
import { formatCurrency, getDaysRemaining, generateWhatsAppLink, getWhatsAppTemplates, getRemainingDebt } from '../../utils/storage';
import {
  MessageSquare,
  Send,
  Clock,
  AlertCircle,
  CreditCard,
  RefreshCw,
  CheckCircle2,
  Phone,
  Check
} from 'lucide-react';

interface RemindersViewProps {
  subscribers: Subscriber[];
  settings: SystemSettings;
  onRenew: (sub: Subscriber) => void;
  onOpenMessageModal: (sub: Subscriber, defaultTab: any) => void;
}

export const RemindersView: React.FC<RemindersViewProps> = ({
  subscribers,
  settings,
  onRenew,
  onOpenMessageModal,
}) => {
  const [filterTab, setFilterTab] = useState<'all_alerts' | 'expiring' | 'expired' | 'debts'>('all_alerts');
  const [sentRecords, setSentRecords] = useState<Record<string, boolean>>({});

  const markSent = (id: string) => {
    setSentRecords(prev => ({ ...prev, [id]: true }));
  };

  const expiringSubscribers = subscribers.filter(s => s.status === 'expiring_soon');
  const expiredSubscribers = subscribers.filter(s => s.status === 'expired');
  const debtSubscribers = subscribers.filter(s => getRemainingDebt(s) > 0);

  const getActiveList = () => {
    switch (filterTab) {
      case 'expiring':
        return expiringSubscribers;
      case 'expired':
        return expiredSubscribers;
      case 'debts':
        return debtSubscribers;
      case 'all_alerts':
      default:
        // Unique subscribers that either expired, expiring soon, or have debt
        const set = new Map<string, Subscriber>();
        [...expiredSubscribers, ...expiringSubscribers, ...debtSubscribers].forEach(s => {
          set.set(s.id, s);
        });
        return Array.from(set.values());
    }
  };

  const activeList = getActiveList();

  const handleInstantWhatsApp = (sub: Subscriber, type: 'expiry' | 'expired' | 'debt') => {
    const templates = getWhatsAppTemplates(sub, settings);
    let msg = templates.expiryReminder;
    if (type === 'expired') msg = templates.expiredNotice;
    if (type === 'debt') msg = templates.debtReminder;

    const link = generateWhatsAppLink(sub.phone, msg);
    markSent(`${sub.id}_${type}`);
    window.open(link, '_blank');
  };

  return (
    <div className="space-y-4">
      {/* Overview & Filter Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-emerald-400" />
              <span>مركز تذكيرات الواتساب والمطالبات المالية</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              أرسل تذكيرات التجديد، إشعارات انتهاء الاشتراك، ومطالبات الديون للمشتركين بضغطة زر واحدة
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <button
              onClick={() => setFilterTab('all_alerts')}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                filterTab === 'all_alerts'
                  ? 'bg-cyan-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              جميع التنبيهات ({activeList.length})
            </button>
            <button
              onClick={() => setFilterTab('expiring')}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1 ${
                filterTab === 'expiring'
                  ? 'bg-amber-600 text-white'
                  : 'bg-slate-800 text-amber-400 hover:bg-slate-750'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>ينتهي قريباً ({expiringSubscribers.length})</span>
            </button>
            <button
              onClick={() => setFilterTab('expired')}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1 ${
                filterTab === 'expired'
                  ? 'bg-rose-600 text-white'
                  : 'bg-slate-800 text-rose-400 hover:bg-slate-750'
              }`}
            >
              <AlertCircle className="w-3.5 h-3.5" />
              <span>منتهي ({expiredSubscribers.length})</span>
            </button>
            <button
              onClick={() => setFilterTab('debts')}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1 ${
                filterTab === 'debts'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-800 text-indigo-400 hover:bg-slate-750'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>بذمتهم ديون ({debtSubscribers.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* List of Reminders */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {activeList.length === 0 ? (
          <div className="col-span-full py-16 text-center bg-slate-900 border border-slate-800 rounded-2xl">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-2" />
            <h3 className="text-sm font-bold text-white">لا توجد أي تنبيهات أو ديون معلقة في هذا القسم</h3>
            <p className="text-xs text-slate-500 mt-1">كافة الاشتراكات نشطة ومسددة بالكامل في الوقت الحالي.</p>
          </div>
        ) : (
          activeList.map((sub) => {
            const days = getDaysRemaining(sub.expiryDate);
            const remainingDebt = getRemainingDebt(sub);
            const isExpired = days < 0;
            const isExpiringSoon = days >= 0 && days <= settings.warningDaysBeforeExpiry;
            const hasDebt = remainingDebt > 0;

            const primaryType = isExpired ? 'expired' : hasDebt ? 'debt' : 'expiry';
            const wasSent = sentRecords[`${sub.id}_${primaryType}`];

            return (
              <div
                key={sub.id}
                className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 shadow-xl transition space-y-3"
              >
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-white text-sm">{sub.name}</h3>
                    <p className="text-xs text-slate-400 font-mono mt-0.5" dir="ltr">{sub.phone}</p>
                    <p className="text-[11px] text-cyan-400 mt-0.5">📍 {sub.towerName}</p>
                  </div>

                  {/* Status Badge */}
                  <div>
                    {isExpired ? (
                      <span className="bg-rose-950/80 text-rose-300 border border-rose-800 text-[10px] font-bold px-2 py-0.5 rounded-full block text-center">
                        منتهي منذ {Math.abs(days)} يوم
                      </span>
                    ) : isExpiringSoon ? (
                      <span className="bg-amber-950/80 text-amber-300 border border-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full block text-center">
                        ينتهي خلال {days} يوم
                      </span>
                    ) : (
                      <span className="bg-emerald-950/80 text-emerald-300 border border-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full block text-center">
                        نشط (متبقي {days} يوم)
                      </span>
                    )}
                  </div>
                </div>

                {/* Account info pill */}
                <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800 text-xs space-y-1">
                  <div className="flex justify-between text-slate-400">
                    <span>الباقة والمزود:</span>
                    <span className="text-slate-200 font-semibold">{sub.planName} • {sub.upstreamProvider}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>اليوزر (PPPoE):</span>
                    <span className="font-mono text-indigo-300 font-bold" dir="ltr">{sub.username}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>تاريخ الانتهاء:</span>
                    <span className="font-mono text-slate-300" dir="ltr">{sub.expiryDate}</span>
                  </div>

                  {hasDebt && (
                    <div className="flex justify-between text-rose-400 font-bold border-t border-slate-800 pt-1">
                      <span>المتبقي بذمته (دين):</span>
                      <span>{formatCurrency(remainingDebt, settings.currency)}</span>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => handleInstantWhatsApp(sub, primaryType)}
                    className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-md ${
                      wasSent
                        ? 'bg-slate-800 text-emerald-400 border border-emerald-600/40'
                        : isExpired
                        ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/20'
                        : hasDebt
                        ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20'
                    }`}
                  >
                    {wasSent ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>تم فتح الواتساب</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>{isExpired ? 'إشعار بالقطع' : hasDebt ? 'مطالبة بالدين' : 'تذكير بالتجديد'}</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => onOpenMessageModal(sub, primaryType)}
                    title="تخصيص الرسالة قبل الإرسال"
                    className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700 transition cursor-pointer text-xs"
                  >
                    <MessageSquare className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => onRenew(sub)}
                    title="تجديد الاشتراك فوراً"
                    className="p-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl transition cursor-pointer shadow-md shadow-cyan-600/20 text-xs"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
