import React, { useState, useEffect } from 'react';
import { copyText } from './ui/Dialogs';
import { useEscapeKey } from './ui/useEscapeKey';
import { Subscriber, SystemSettings } from '../types/isp';
import { getWhatsAppTemplates, generateWhatsAppLink } from '../utils/storage';
import { X, Send, Copy, Check, MessageSquare, Key, AlertCircle, Clock, Receipt, UserCheck } from 'lucide-react';

interface WhatsAppReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  subscriber: Subscriber | null;
  settings: SystemSettings;
  defaultTab?: 'expiry' | 'expired' | 'debt' | 'credentials' | 'receipt';
}

// الغلاف يضمن استدعاء الـ hooks دائماً بنفس الترتيب (قواعد React)، ويعيد ضبط الحقول عند كل فتح
export const WhatsAppReminderModal: React.FC<WhatsAppReminderModalProps> = (props) =>
  props.isOpen && props.subscriber ? <WhatsAppReminderModalInner {...props} subscriber={props.subscriber} /> : null;

const WhatsAppReminderModalInner: React.FC<WhatsAppReminderModalProps & { subscriber: Subscriber }> = ({
  isOpen,
  onClose,
  subscriber,
  settings,
  defaultTab = 'expiry',
}) => {
  useEscapeKey(onClose);

  const [activeTab, setActiveTab] = useState<'expiry' | 'expired' | 'debt' | 'credentials' | 'receipt'>(defaultTab);
  const [customMessage, setCustomMessage] = useState('');
  const [copied, setCopied] = useState(false);

  const templates = getWhatsAppTemplates(subscriber, settings);

  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab, subscriber]);

  useEffect(() => {
    switch (activeTab) {
      case 'expiry':
        setCustomMessage(templates.expiryReminder);
        break;
      case 'expired':
        setCustomMessage(templates.expiredNotice);
        break;
      case 'debt':
        setCustomMessage(templates.debtReminder);
        break;
      case 'credentials':
        setCustomMessage(templates.credentialsMessage);
        break;
      case 'receipt':
        setCustomMessage(templates.paymentReceipt);
        break;
    }
  }, [activeTab, subscriber]);

  const handleCopy = () => {
    void copyText(customMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendWhatsApp = () => {
    const link = generateWhatsAppLink(subscriber.phone, customMessage);
    window.open(link, '_blank');
  };

  return (
    <div className="app-overlay fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-800/80 border-b border-slate-700/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">إرسال رسالة وتذكير واتساب</h2>
              <p className="text-xs text-slate-400">
                إلى المشترك: <span className="text-white font-semibold">{subscriber.name}</span> ({subscriber.phone})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Template Type Tabs */}
        <div className="p-4 bg-slate-850 border-b border-slate-800">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 text-xs">
            <button
              onClick={() => setActiveTab('expiry')}
              className={`p-2 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                activeTab === 'expiry'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>قرب الانتهاء</span>
            </button>

            <button
              onClick={() => setActiveTab('expired')}
              className={`p-2 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                activeTab === 'expired'
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <AlertCircle className="w-3.5 h-3.5" />
              <span>منتهي الصلاحية</span>
            </button>

            <button
              onClick={() => setActiveTab('debt')}
              className={`p-2 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                activeTab === 'debt'
                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>مطالبة بالدين</span>
            </button>

            <button
              onClick={() => setActiveTab('credentials')}
              className={`p-2 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                activeTab === 'credentials'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Key className="w-3.5 h-3.5" />
              <span>اليوزر والباسورد</span>
            </button>

            <button
              onClick={() => setActiveTab('receipt')}
              className={`p-2 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                activeTab === 'receipt'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>وصل استلام</span>
            </button>
          </div>
        </div>

        {/* Message Content Preview & Edit */}
        <div className="p-6 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <span>نص رسالة الواتساب (يمكنك التعديل عليها قبل الإرسال):</span>
              </label>
              <span className="text-[11px] text-emerald-400 font-mono">
                WhatsApp: +{subscriber.phone}
              </span>
            </div>

            <div className="relative">
              <textarea
                rows={7}
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 leading-relaxed font-sans"
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleCopy}
              className="px-4 py-2.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-400">تم نسخ النص للحافظة!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>نسخ النص فقط</span>
                </>
              )}
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-lg border border-slate-700 text-slate-400 hover:text-white text-xs font-semibold cursor-pointer"
              >
                إغلاق
              </button>

              <button
                type="button"
                onClick={handleSendWhatsApp}
                className="px-6 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/30 flex items-center gap-2 transition cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>إرسال عبر الواتساب مباشرة</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
