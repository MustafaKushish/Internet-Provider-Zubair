import React, { useState } from 'react';
import { SupportTicket, Subscriber } from '../../types/isp';
import {
  Wrench,
  Plus,
  AlertCircle,
  CheckCircle2,
  Clock,
  Phone,
  Send,
  Edit,
  Trash2,
  TowerControl,
  WifiOff,
  Lock,
  DollarSign,
  UserCheck
} from 'lucide-react';
import { generateWhatsAppLink } from '../../utils/storage';

interface TicketsViewProps {
  tickets: SupportTicket[];
  subscribers: Subscriber[];
  onOpenCreateModal: () => void;
  onEditTicket: (ticket: SupportTicket) => void;
  onDeleteTicket: (ticketId: string) => void;
  onQuickResolve: (ticketId: string) => void;
  onQuickClose: (ticketId: string) => void;
}

export const TicketsView: React.FC<TicketsViewProps> = ({
  tickets,
  subscribers,
  onOpenCreateModal,
  onEditTicket,
  onDeleteTicket,
  onQuickResolve,
  onQuickClose,
}) => {
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'in_progress' | 'resolved' | 'closed'>('all');
  const [issueFilter, setIssueFilter] = useState('all');

  const filteredTickets = tickets.filter(t => {
    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
    const matchesIssue = issueFilter === 'all' || t.issueType === issueFilter;
    return matchesStatus && matchesIssue;
  });

  const getIssueLabel = (type: string) => {
    switch (type) {
      case 'connection_problem': return 'مشاكل اتصال (انقطاع)';
      case 'billing_dispute': return 'نزاع مالي / مشكلة اشتراك';
      case 'slow_speed': return 'بطء وتصفح سيء';
      case 'router_config': return 'إعدادات راوتر / يوزر';
      case 'nanostation_signal': return 'ضعف إشارة النانو';
      case 'cable_fiber_cut': return 'قطع كيبل / فايبر';
      default: return 'مشكلة فنية أخرى';
    }
  };

  const handleNotifySubscriber = (ticket: SupportTicket) => {
    const statusText = ticket.status === 'resolved'
      ? 'تم حل المشكلة بنجاح والخدمة تعمل الآن بكفاءة عالية ✅'
      : ticket.status === 'closed'
      ? 'تم إغلاق البلاغ بنجاح 🔒'
      : ticket.status === 'in_progress'
      ? 'فريق الدعم الفني يتابع التذكرة حالياً ⏳'
      : 'تم استلام التذكرة وجاري فحصها 📌';

    const message = `مرحباً ${ticket.subscriberName} 🛠️
بخصوص تذكرة الدعم الفني (${ticket.title}):
الحالة: ${statusText}
${ticket.technicianName ? `المسؤول: ${ticket.technicianName}` : ''}
${ticket.resolutionNotes ? `ملاحظات الحل: ${ticket.resolutionNotes}` : ''}

شكراً لصبركم معنا!`;

    const link = generateWhatsAppLink(ticket.phone, message);
    window.open(link, '_blank');
  };

  return (
    <div className="space-y-4">
      {/* Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Wrench className="w-5 h-5 text-amber-400" />
              <span>إدارة تذاكر الدعم الفني ومشاكل المشتركين</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              استقبال البلاغات، مشاكل الاتصال، النزاعات المالية، تعيين موظفي الدعم، وتحديث المشتركين باللغة العربية
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onOpenCreateModal}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-amber-600/30 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>إنشاء تذكرة دعم جديدة</span>
            </button>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 mt-3 border-t border-slate-800/80 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-cyan-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              كافة التذاكر ({tickets.length})
            </button>

            <button
              onClick={() => setStatusFilter('open')}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1 ${
                statusFilter === 'open'
                  ? 'bg-rose-600 text-white'
                  : 'bg-slate-800 text-rose-400 hover:bg-slate-750'
              }`}
            >
              <AlertCircle className="w-3.5 h-3.5" />
              <span>مفتوحة ({tickets.filter(t => t.status === 'open').length})</span>
            </button>

            <button
              onClick={() => setStatusFilter('in_progress')}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1 ${
                statusFilter === 'in_progress'
                  ? 'bg-amber-600 text-white'
                  : 'bg-slate-800 text-amber-400 hover:bg-slate-750'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>قيد المتابعة ({tickets.filter(t => t.status === 'in_progress').length})</span>
            </button>

            <button
              onClick={() => setStatusFilter('resolved')}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1 ${
                statusFilter === 'resolved'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-800 text-emerald-400 hover:bg-slate-750'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>تم الحل ({tickets.filter(t => t.status === 'resolved').length})</span>
            </button>

            <button
              onClick={() => setStatusFilter('closed')}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1 ${
                statusFilter === 'closed'
                  ? 'bg-purple-600 text-white'
                  : 'bg-slate-800 text-purple-400 hover:bg-slate-750'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>مغلقة ({tickets.filter(t => t.status === 'closed').length})</span>
            </button>
          </div>

          {/* Issue filter dropdown */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">تصنيف المشكلة:</span>
            <select
              value={issueFilter}
              onChange={(e) => setIssueFilter(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              <option value="all">كافة التصنيفات</option>
              <option value="connection_problem">مشاكل اتصال</option>
              <option value="billing_dispute">نزاعات مالية</option>
              <option value="slow_speed">بطء السرعة</option>
              <option value="router_config">إعدادات الراوتر</option>
              <option value="nanostation_signal">إشارة النانو</option>
              <option value="cable_fiber_cut">قطع كيبل/فايبر</option>
              <option value="other">أخرى</option>
            </select>
          </div>
        </div>
      </div>

      {/* Ticket Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTickets.length === 0 ? (
          <div className="col-span-full py-16 text-center bg-slate-900 border border-slate-800 rounded-2xl">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-2" />
            <h3 className="text-sm font-bold text-white">لا توجد تذاكر دعم فني في هذا القسم</h3>
            <p className="text-xs text-slate-500 mt-1">كافة مشاكل المشتركين تم حلها أو إغلاقها.</p>
          </div>
        ) : (
          filteredTickets.map((tkt) => {
            const isResolved = tkt.status === 'resolved';
            const isClosed = tkt.status === 'closed';

            return (
              <div
                key={tkt.id}
                className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 shadow-xl transition space-y-3 flex flex-col justify-between"
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] text-cyan-400 font-bold bg-cyan-950/70 px-2 py-0.5 rounded border border-cyan-800">
                          {tkt.ticketNumber}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">{tkt.createdAt}</span>
                      </div>
                      <h3 className="font-bold text-white text-sm mt-1.5">{tkt.title}</h3>
                    </div>

                    {/* Status & Priority badges */}
                    <div className="flex flex-col items-end gap-1">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        tkt.priority === 'urgent'
                          ? 'bg-rose-950 text-rose-300 border-rose-800 animate-pulse'
                          : tkt.priority === 'high'
                          ? 'bg-orange-950 text-orange-300 border-orange-800'
                          : tkt.priority === 'medium'
                          ? 'bg-amber-950 text-amber-300 border-amber-800'
                          : 'bg-slate-800 text-slate-300 border-slate-700'
                      }`}>
                        {tkt.priority === 'urgent' ? 'طارئ' : tkt.priority === 'high' ? 'عالي' : tkt.priority === 'medium' ? 'متوسط' : 'عادي'}
                      </span>

                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        tkt.status === 'open'
                          ? 'bg-rose-950/60 text-rose-400 border border-rose-900'
                          : tkt.status === 'in_progress'
                          ? 'bg-amber-950/60 text-amber-300 border border-amber-900'
                          : tkt.status === 'resolved'
                          ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-900'
                          : 'bg-purple-950/60 text-purple-300 border border-purple-900'
                      }`}>
                        {tkt.status === 'open' ? 'مفتوحة' : tkt.status === 'in_progress' ? 'قيد المتابعة' : tkt.status === 'resolved' ? 'تم الحل' : 'مغلقة'}
                      </span>
                    </div>
                  </div>

                  {/* Subscriber & Issue details */}
                  <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80 text-xs mt-3 space-y-1">
                    <div className="flex justify-between text-slate-400">
                      <span>المشترك:</span>
                      <span className="text-white font-bold">{tkt.subscriberName}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>الهاتف:</span>
                      <span className="font-mono text-cyan-300" dir="ltr">{tkt.phone}</span>
                    </div>
                    {tkt.towerName && (
                      <div className="flex justify-between text-slate-400">
                        <span>البرج / التغذية:</span>
                        <span className="text-slate-300">{tkt.towerName}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-slate-400">
                      <span>تصنيف العطل:</span>
                      <span className="text-indigo-400 font-semibold">{getIssueLabel(tkt.issueType)}</span>
                    </div>
                    {tkt.technicianName && (
                      <div className="flex justify-between text-slate-400">
                        <span>الموظف المكلف:</span>
                        <span className="text-emerald-400 font-semibold">{tkt.technicianName}</span>
                      </div>
                    )}
                  </div>

                  {/* Description */}
                  {tkt.description && (
                    <p className="text-xs text-slate-300 mt-2 bg-slate-850 p-2 rounded-lg border border-slate-800">
                      {tkt.description}
                    </p>
                  )}

                  {/* Resolution Notes */}
                  {tkt.resolutionNotes && (
                    <div className="text-xs text-emerald-300 mt-2 bg-emerald-950/30 p-2 rounded-lg border border-emerald-900/50">
                      <strong className="block text-[10px] text-emerald-400">ملاحظات الحل والإغلاق:</strong>
                      {tkt.resolutionNotes}
                    </div>
                  )}
                </div>

                {/* Footer Actions */}
                <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {!isResolved && !isClosed && (
                      <button
                        onClick={() => onQuickResolve(tkt.id)}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-1 shadow-md shadow-emerald-600/20 cursor-pointer transition"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>تم الحل</span>
                      </button>
                    )}

                    {isResolved && !isClosed && (
                      <button
                        onClick={() => onQuickClose(tkt.id)}
                        className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-1 shadow-md shadow-purple-600/20 cursor-pointer transition"
                      >
                        <Lock className="w-3.5 h-3.5" />
                        <span>إغلاق التذكرة</span>
                      </button>
                    )}

                    <button
                      onClick={() => handleNotifySubscriber(tkt)}
                      title="إشعار المشترك بالواتساب"
                      className="bg-slate-800 hover:bg-slate-700 text-emerald-400 p-2 rounded-lg border border-slate-700 transition cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onEditTicket(tkt)}
                      title="تعديل التذكرة وتعيين الفني"
                      className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 cursor-pointer"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onDeleteTicket(tkt.id)}
                      title="حذف التذكرة"
                      className="text-slate-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-slate-800 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
