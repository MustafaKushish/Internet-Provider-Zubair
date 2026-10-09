import React, { useEffect, useMemo, useState } from 'react';
import { apiRequest, PREVIEW_MODE } from '../../sync/api';
import { categoryLabel } from '../../utils/expenses';
import { History, RefreshCw, Search } from 'lucide-react';

interface AuditEntry {
  id: number;
  at: number;
  user_name: string | null;
  collection: string;
  record_id: string;
  action: 'create' | 'update' | 'delete';
  summary: string | null;
  fields: string | null;
}

const COLLECTION_LABEL: Record<string, string> = {
  subscribers: 'مشترك', payments: 'وصل', tickets: 'بلاغ', providers: 'مزود', towers: 'برج', settings: 'الإعدادات', expenses: 'مصروف',
};
const ACTION: Record<string, { label: string; cls: string }> = {
  create: { label: 'أضاف', cls: 'bg-emerald-950 border-emerald-800 text-emerald-300' },
  update: { label: 'عدّل', cls: 'bg-cyan-950 border-cyan-800 text-cyan-300' },
  delete: { label: 'حذف', cls: 'bg-rose-950 border-rose-800 text-rose-300' },
};
const FIELD_LABEL: Record<string, string> = {
  name: 'الاسم', phone: 'الهاتف', username: 'اليوزر', password: 'كلمة المرور', planName: 'الباقة', upstreamProvider: 'المزود',
  towerName: 'البرج', salePrice: 'سعر البيع', costPrice: 'الكلفة', paidAmount: 'المدفوع', carriedDebt: 'الدين المرحّل',
  cycleMonths: 'أشهر الدورة', startDate: 'البداية', expiryDate: 'الانتهاء', archived: 'الأرشفة', amount: 'المبلغ', date: 'التاريخ',
  paymentMethod: 'طريقة الدفع', category: 'النوع', status: 'الحالة', priority: 'الأولوية', technicianName: 'الفني',
  ipAddress: 'IP', macAddress: 'MAC', notes: 'ملاحظات', address: 'العنوان', debtLog: 'سجل الدين', installmentPlan: 'خطة التقسيط',
  currentCycleId: 'دورة جديدة', lastPaymentDate: 'آخر دفعة', pendingPrice: 'سعر مجدول', archivedAt: 'تاريخ الأرشفة',
  archivedBy: 'أرشفه', archiveReason: 'سبب الأرشفة', plans: 'الباقات', description: 'الوصف', resolutionNotes: 'ملاحظات الحل',
};

const translateFields = (f: string) =>
  f.split(' | ').map(part => {
    const [k, ...rest] = part.split(': ');
    return `${FIELD_LABEL[k] || k}${rest.length ? `: ${rest.join(': ')}` : ''}`;
  });

/** سجل العمليات للمدير: من أضاف أو عدّل أو حذف ماذا ومتى (يحفظه الخادم لسنة) */
export const AuditLogView: React.FC = () => {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState('all');
  const [kind, setKind] = useState('all');
  const [action, setAction] = useState('all');
  const [q, setQ] = useState('');

  const load = async (before?: number) => {
    if (PREVIEW_MODE) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest<{ entries: AuditEntry[]; hasMore: boolean }>(`/api/audit?limit=150${before ? `&before=${before}` : ''}`);
      setEntries(prev => (before ? [...prev, ...res.entries] : res.entries));
      setHasMore(res.hasMore);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, []);

  const users = useMemo(() => [...new Set(entries.map(e => e.user_name || '—'))], [entries]);
  const shown = entries.filter(e =>
    (user === 'all' || (e.user_name || '—') === user)
    && (kind === 'all' || e.collection === kind)
    && (action === 'all' || e.action === action)
    && (!q.trim() || `${e.summary || ''} ${e.fields || ''}`.includes(q.trim())));

  const sel = 'bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-200';

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl mt-6 max-w-5xl mx-auto">
      <div className="p-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2"><History className="w-5 h-5 text-indigo-400" /> سجل العمليات</h2>
          <p className="text-xs text-slate-400 mt-0.5">كل إضافة وتعديل وحذف: من قام به ومتى وماذا تغيّر (يُحفظ على الخادم لمدة سنة)</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading}
          className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1 disabled:opacity-50 cursor-pointer">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> تحديث
        </button>
      </div>
      <div className="p-4 space-y-3 text-xs">
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[10rem]">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-2.5" />
            <input id="audit-search" value={q} onChange={e => setQ(e.target.value)} placeholder="بحث: اسم مشترك، رقم وصل…"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg pr-8 pl-2 py-1.5 text-white" />
          </div>
          <select aria-label="الموظف" value={user} onChange={e => setUser(e.target.value)} className={sel}>
            <option value="all">كل الموظفين</option>
            {users.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
          <select aria-label="النوع" value={kind} onChange={e => setKind(e.target.value)} className={sel}>
            <option value="all">كل الأنواع</option>
            {Object.entries(COLLECTION_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select aria-label="العملية" value={action} onChange={e => setAction(e.target.value)} className={sel}>
            <option value="all">كل العمليات</option>
            <option value="create">إضافة</option>
            <option value="update">تعديل</option>
            <option value="delete">حذف</option>
          </select>
        </div>
        {error && <p className="text-rose-300">{error}</p>}
        {!loading && !error && shown.length === 0 && <p className="text-slate-500 py-6 text-center">لا توجد عمليات مسجلة بعد{entries.length ? ' تطابق الفلتر' : ''}.</p>}
        <ul className="divide-y divide-slate-800">
          {shown.map(e => {
            const act = ACTION[e.action] || ACTION.update;
            const summary = e.collection === 'expenses' && e.summary ? e.summary.replace(/^(\w+)/, m => categoryLabel(m)) : e.summary;
            return (
              <li key={e.id} className="py-2.5 flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3">
                <span className="text-[11px] text-slate-500 font-mono whitespace-nowrap sm:w-32 flex-shrink-0" dir="ltr">
                  {new Date(e.at).toLocaleString('en-GB', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <b className="text-white">{e.user_name || '—'}</b>
                    <span className={`px-1.5 py-0.5 rounded border text-[10px] font-bold ${act.cls}`}>{act.label}</span>
                    <span className="text-slate-400">{COLLECTION_LABEL[e.collection] || e.collection}</span>
                    <span className="text-slate-200">{summary}</span>
                  </div>
                  {e.fields && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {translateFields(e.fields).map((f, i) => (
                        <span key={i} className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]">{f}</span>
                      ))}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        {hasMore && (
          <div className="text-center">
            <button type="button" disabled={loading} onClick={() => void load(entries[entries.length - 1]?.id)}
              className="px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 font-bold disabled:opacity-50 cursor-pointer">
              عرض الأقدم
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
