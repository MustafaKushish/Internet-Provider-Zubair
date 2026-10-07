import React, { useState, useEffect } from 'react';
import { todayStr } from '../utils/dates';
import { SupportTicket, Subscriber, IssueType, TicketPriority, TicketStatus } from '../types/isp';
import { X, Wrench, AlertTriangle, CheckCircle2, User, Phone, TowerControl, Send, ShieldAlert, FileText } from 'lucide-react';
import { generateWhatsAppLink } from '../utils/storage';

interface TicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticketToEdit?: SupportTicket | null;
  subscribers: Subscriber[];
  onSaveTicket: (ticket: Partial<SupportTicket>) => void;
}

// الغلاف يضمن استدعاء الـ hooks دائماً بنفس الترتيب (قواعد React)، ويعيد ضبط الحقول عند كل فتح
export const TicketModal: React.FC<TicketModalProps> = (props) =>
  props.isOpen ? <TicketModalInner {...props} /> : null;

const TicketModalInner: React.FC<TicketModalProps> = ({
  isOpen,
  onClose,
  ticketToEdit,
  subscribers,
  onSaveTicket,
}) => {

  const [subscriberId, setSubscriberId] = useState('');
  const [subscriberName, setSubscriberName] = useState('');
  const [phone, setPhone] = useState('');
  const [towerName, setTowerName] = useState('');
  const [issueType, setIssueType] = useState<IssueType>('connection_problem');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TicketPriority>('medium');
  const [status, setStatus] = useState<TicketStatus>('open');
  const [technicianName, setTechnicianName] = useState('علي مهندس الشبكة');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [reportedBy, setReportedBy] = useState<'user' | 'support_staff'>('user');

  useEffect(() => {
    if (ticketToEdit) {
      setSubscriberId(ticketToEdit.subscriberId);
      setSubscriberName(ticketToEdit.subscriberName);
      setPhone(ticketToEdit.phone);
      setTowerName(ticketToEdit.towerName || '');
      setIssueType(ticketToEdit.issueType);
      setTitle(ticketToEdit.title);
      setDescription(ticketToEdit.description);
      setPriority(ticketToEdit.priority);
      setStatus(ticketToEdit.status);
      setTechnicianName(ticketToEdit.technicianName || '');
      setResolutionNotes(ticketToEdit.resolutionNotes || '');
      setReportedBy(ticketToEdit.reportedBy || 'user');
    } else {
      if (subscribers.length > 0) {
        const first = subscribers[0];
        setSubscriberId(first.id);
        setSubscriberName(first.name);
        setPhone(first.phone);
        setTowerName(first.towerName);
      }
      setIssueType('connection_problem');
      setTitle('');
      setDescription('');
      setPriority('medium');
      setStatus('open');
      setTechnicianName('فريق الصيانة والدعم');
      setResolutionNotes('');
      setReportedBy('user');
    }
  }, [ticketToEdit, subscribers, isOpen]);

  const handleSubscriberSelect = (subId: string) => {
    const sub = subscribers.find((s) => s.id === subId);
    if (sub) {
      setSubscriberId(sub.id);
      setSubscriberName(sub.name);
      setPhone(sub.phone);
      setTowerName(sub.towerName);
    }
  };

  const handleSendWhatsAppUpdate = () => {
    const statusArabic = status === 'resolved'
      ? 'تم حل المشكلة بنجاح والخدمة تعمل الآن بكفاءة عالية ✅'
      : status === 'in_progress'
      ? 'قيد المتابعة من قبل فريق الصيانة ⏳'
      : status === 'closed'
      ? 'تم إغلاق البلاغ بعد التأكد من رضاكم 🔒'
      : 'تم استلام البلاغ وسيتم الفحص فوراً 📌';

    const message = `مرحباً ${subscriberName} 🛠️
بخصوص بلاغ الصيانة والدعم الفني (${title}):
الحالة الحالية: ${statusArabic}
${technicianName ? `الفني المسؤول: ${technicianName}` : ''}
${resolutionNotes ? `ملاحظات الحل: ${resolutionNotes}` : ''}

شكراً لصبركم معنا!`;

    const link = generateWhatsAppLink(phone, message);
    window.open(link, '_blank');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    onSaveTicket({
      id: ticketToEdit ? ticketToEdit.id : undefined,
      // رقم التذكرة الجديدة يُولَّد تسلسلياً في App
      ticketNumber: ticketToEdit ? ticketToEdit.ticketNumber : undefined,
      subscriberId,
      subscriberName,
      phone,
      towerName,
      issueType,
      title: title.trim(),
      description: description.trim(),
      priority,
      status,
      technicianName: technicianName.trim(),
      resolutionNotes: resolutionNotes.trim(),
      reportedBy,
      resolvedAt: (status === 'resolved' || status === 'closed') ? (ticketToEdit?.resolvedAt || todayStr()) : undefined,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden my-6">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-800/80 border-b border-slate-700/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-600/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                {ticketToEdit ? `تعديل تذكرة الدعم (${ticketToEdit.ticketNumber})` : 'إنشاء تذكرة دعم فني / بلاغ مشكلة'}
              </h2>
              <p className="text-xs text-slate-400">إدارة ومتابعة مشاكل المشتركين وانقطاعات الخدمة والنزاعات المالية</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-700/50 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Select Subscriber */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                المشترك صاحب الشكوى <span className="text-rose-400">*</span>
              </label>
              <select
                value={subscriberId}
                onChange={(e) => handleSubscriberSelect(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
              >
                {subscribers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.username}) - {s.phone}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">البرج / الموقع</label>
              <div className="relative">
                <TowerControl className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                <input
                  type="text"
                  value={towerName}
                  onChange={(e) => setTowerName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg pr-9 pl-3 py-2 text-sm text-slate-300"
                />
              </div>
            </div>
          </div>

          {/* Issue Type & Priority & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">نوع المشكلة / البلاغ</label>
              <select
                value={issueType}
                onChange={(e) => setIssueType(e.target.value as IssueType)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-semibold"
              >
                <option value="connection_problem">مشاكل اتصال (انقطاع تام)</option>
                <option value="billing_dispute">نزاع مالي أو مشكلة بالاشتراك</option>
                <option value="slow_speed">بطء في السرعة والتصفح</option>
                <option value="router_config">إعدادات وبرمجة الراوتر</option>
                <option value="nanostation_signal">ضعف إشارة النانو / تشويش</option>
                <option value="cable_fiber_cut">قطع كيبل LAN / فايبر ضوئي</option>
                <option value="other">مشكلة أخرى</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">درجة الأهمية / الأولوية</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TicketPriority)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-bold"
              >
                <option value="urgent">🔴 طارئ وعاجل جداً</option>
                <option value="high">🟠 مرتفع</option>
                <option value="medium">🟡 متوسط</option>
                <option value="low">🟢 عادي / منخفض</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">حالة التذكرة (Status)</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TicketStatus)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-bold"
              >
                <option value="open">مفتوحة (Open)</option>
                <option value="in_progress">قيد المتابعة والعمل (In Progress)</option>
                <option value="resolved">تم الحل بنجاح (Resolved)</option>
                <option value="closed">مغلقة نهائياً (Closed)</option>
              </select>
            </div>
          </div>

          {/* Ticket Title & Technician Assignment */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                عنوان التذكرة / الملخص <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="مثال: انقطاع الإنترنت أو تدقيق دفعة سابقة"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                الموظف / الفني المسند له التذكرة
              </label>
              <input
                type="text"
                value={technicianName}
                onChange={(e) => setTechnicianName(e.target.value)}
                placeholder="مثال: علي مهندس الشبكة / موظف الدعم"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">تفاصيل المشكلة / البلاغ</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="وصف المشكلة من المشترك بالتفصيل..."
              className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Resolution Notes */}
          <div>
            <label className="block text-xs font-semibold text-emerald-400 mb-1">
              إجراءات الصيانة وملاحظات الحل والإغلاق
            </label>
            <textarea
              rows={2}
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              placeholder="مثال: تم تدقيق السجلات والتأكد من استقرار الخط وإبلاغ المشترك بالحل."
              className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* WhatsApp Notify Button */}
          {phone && (
            <div className="p-2.5 bg-emerald-950/30 border border-emerald-800/40 rounded-xl flex items-center justify-between">
              <span className="text-xs text-emerald-300 font-semibold">
                إرسال تحديث بحالة التذكرة للمشترك ({phone}) عبر الواتساب:
              </span>
              <button
                type="button"
                onClick={handleSendWhatsAppUpdate}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>إرسال واتساب</span>
              </button>
            </div>
          )}

          {/* Actions */}
          <div className="pt-2 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-700 text-slate-300 hover:text-white text-xs font-semibold cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="px-6 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-lg shadow-cyan-600/30 transition cursor-pointer"
            >
              {ticketToEdit ? 'تحديث التذكرة' : 'حفظ التذكرة'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
