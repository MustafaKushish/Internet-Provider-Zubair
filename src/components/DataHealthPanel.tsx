import React, { useMemo, useState } from 'react';
import { StaffUser, Subscriber, SystemSettings } from '../types/isp';
import { formatCurrency, getDaysRemaining, getRemainingDebt } from '../utils/storage';
import { normTower } from '../utils/towers';
import { phoneDigits } from '../utils/search';
import { appConfirm } from './ui/Dialogs';
import { ShieldCheck, ChevronDown, ChevronUp, Archive, UserRound, Edit, AlertTriangle } from 'lucide-react';

interface DataHealthPanelProps {
  subscribers: Subscriber[];          // كل المشتركين (يُستبعد المؤرشفون داخلياً)
  settings: SystemSettings;
  currentUser: StaffUser;
  onOpenProfile: (sub: Subscriber) => void;
  onEdit: (sub: Subscriber) => void;
  onArchive?: (ids: string[], archive: boolean, reason?: string) => void;
}

interface Issue {
  key: string;
  title: string;
  hint: string;
  tone: 'rose' | 'amber' | 'slate';
  subs: Subscriber[];
  groups?: Subscriber[][];            // للتكرارات: كل مجموعة مشتركين متشابهين
}

const TONE: Record<Issue['tone'], string> = {
  rose: 'border-rose-800 bg-rose-950/40 text-rose-200',
  amber: 'border-amber-800 bg-amber-950/40 text-amber-200',
  slate: 'border-slate-700 bg-slate-800/60 text-slate-200',
};

/** فحص جودة البيانات: ما ينقص أو يتكرر أو يحتاج قراراً، مع إصلاح مباشر */
export const DataHealthPanel: React.FC<DataHealthPanelProps> = ({ subscribers, settings, currentUser, onOpenProfile, onEdit, onArchive }) => {
  const [open, setOpen] = useState<string | null>(null);
  const [staleMonths, setStaleMonths] = useState(6);
  const live = useMemo(() => subscribers.filter(s => !s.archived), [subscribers]);

  const issues = useMemo<Issue[]>(() => {
    const dupBy = (key: (s: Subscriber) => string) => {
      const m = new Map<string, Subscriber[]>();
      live.forEach(s => { const k = key(s); if (k) m.set(k, [...(m.get(k) || []), s]); });
      return [...m.values()].filter(g => g.length > 1);
    };
    const phoneGroups = dupBy(s => { const d = phoneDigits(s.phone || ''); return d.length >= 9 ? d : ''; });
    const userGroups = dupBy(s => (s.username || '').trim().toLowerCase());
    const staleAfter = (months: number) => live.filter(s => -getDaysRemaining(s.expiryDate) > months * 30 && s.status !== 'suspended');
    const stale = staleAfter(staleMonths);
    const anyStale = staleAfter(3).length > 0;
    const list: Issue[] = [
      { key: 'stale', title: `منتهون منذ أكثر من ${staleMonths} أشهر`, hint: 'غالباً غادروا الشبكة. أرشفتهم تنظف القوائم والإحصائيات والتذكيرات، وتبقى بياناتهم ووصولاتهم.', tone: 'rose', subs: stale },
      { key: 'dupUser', title: 'يوزر مكرر', hint: 'اليوزر يجب أن يكون فريداً في SAS. صحّح أحدهما.', tone: 'rose', subs: userGroups.flat(), groups: userGroups },
      { key: 'dupPhone', title: 'رقم هاتف مكرر', hint: 'قد يكون نفس الشخص مسجلاً مرتين، أو أكثر من خط لعائلة واحدة.', tone: 'amber', subs: phoneGroups.flat(), groups: phoneGroups },
      { key: 'noPhone', title: 'بدون رقم هاتف', hint: 'لا يمكن إرسال تذكير واتساب لهم.', tone: 'amber', subs: live.filter(s => phoneDigits(s.phone || '').length < 9) },
      { key: 'noTower', title: 'بدون برج', hint: 'لا يظهرون في إحصائيات الأبراج.', tone: 'amber', subs: live.filter(s => !normTower(s.towerName)) },
      { key: 'fakeUser', title: 'يوزر غير حقيقي (مولّد تلقائياً)', hint: 'أُنشئ عند الاستيراد أو الإضافة بدون يوزر. ضع يوزر SAS الصحيح.', tone: 'slate', subs: live.filter(s => /^user_[a-z0-9_]+$/i.test(s.username || '')) },
      { key: 'loss', title: 'سعر البيع لا يغطي الكلفة', hint: 'سعر البيع صفر أو أقل من كلفة الجملة.', tone: 'rose', subs: live.filter(s => (s.salePrice || 0) <= (s.costPrice || 0)) },
    ];
    // «المنتهون منذ مدة» يبقى ظاهراً ما دام هناك منتهٍ منذ 3 أشهر، حتى يمكن تغيير المدة
    return list.filter(i => i.subs.length > 0 || (i.key === 'stale' && anyStale));
  }, [live, staleMonths]);

  const affected = new Set(issues.filter(i => i.key !== 'stale').flatMap(i => i.subs.map(s => s.id))).size;
  const score = live.length ? Math.round((1 - affected / live.length) * 100) : 100;
  if (!live.length) return null;

  const fmt = (n: number) => formatCurrency(n, settings.currency);
  const isAdmin = currentUser.role === 'admin';

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <ShieldCheck className={`w-4 h-4 ${score >= 90 ? 'text-emerald-400' : score >= 70 ? 'text-amber-400' : 'text-rose-400'}`} />
          جودة البيانات <span className={`text-xs ${score >= 90 ? 'text-emerald-400' : score >= 70 ? 'text-amber-300' : 'text-rose-300'}`}>{score}%</span>
        </h2>
        {issues.length === 0 && <span className="text-xs text-emerald-400">كل البيانات سليمة 👌</span>}
      </div>
      {issues.length > 0 && (
        <div className="mt-3 space-y-2">
          {issues.map(issue => {
            const expanded = open === issue.key;
            const debt = issue.subs.reduce((a, s) => a + getRemainingDebt(s), 0);
            return (
              <div key={issue.key} className={`rounded-xl border ${TONE[issue.tone]}`}>
                <button type="button" onClick={() => setOpen(expanded ? null : issue.key)} aria-expanded={expanded}
                  className="w-full px-3 py-2.5 flex items-center justify-between gap-2 text-xs text-right cursor-pointer">
                  <span className="flex items-center gap-1.5 font-bold">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                    {issue.title}: {issue.groups ? `${issue.groups.length} مجموعة (${issue.subs.length})` : issue.subs.length}
                    {issue.key === 'stale' && debt > 0 && <span className="font-normal opacity-80">• ديون قديمة {fmt(debt)}</span>}
                  </span>
                  {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {expanded && (
                  <div className="px-3 pb-3 space-y-2 text-xs">
                    <p className="opacity-80">{issue.hint}</p>
                    {issue.key === 'stale' && (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="opacity-80">المدة:</span>
                        {[3, 6, 12].map(m => (
                          <button key={m} type="button" onClick={() => setStaleMonths(m)} aria-pressed={staleMonths === m}
                            className={`px-2 py-1 rounded-md font-bold cursor-pointer ${staleMonths === m ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-300'}`}>
                            +{m} أشهر
                          </button>
                        ))}
                        {isAdmin && onArchive && (
                          <button type="button"
                            onClick={async () => {
                              const ok = await appConfirm(
                                `أرشفة ${issue.subs.length} مشترك منتهٍ منذ أكثر من ${staleMonths} أشهر؟\nيختفون من القوائم والإحصائيات والتذكيرات (ديونهم ${fmt(debt)} تبقى مسجلة في ملفاتهم). التجديد يعيد أي مشترك تلقائياً.`,
                                { title: 'أرشفة المغادرين', confirmLabel: `أرشفة ${issue.subs.length}` },
                              );
                              if (ok) onArchive(issue.subs.map(s => s.id), true, `منتهٍ منذ أكثر من ${staleMonths} أشهر`);
                            }}
                            className="ms-auto px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-bold flex items-center gap-1 cursor-pointer">
                            <Archive className="w-3.5 h-3.5" /> أرشفة الكل ({issue.subs.length})
                          </button>
                        )}
                      </div>
                    )}
                    <ul className="divide-y divide-white/5 max-h-72 overflow-y-auto rounded-lg bg-slate-950/50">
                      {(issue.groups ? issue.groups.flatMap((g, gi) => g.map(s => ({ s, gi }))) : issue.subs.map(s => ({ s, gi: -1 }))).slice(0, 60).map(({ s, gi }) => (
                        <li key={`${s.id}-${gi}`} className="px-2.5 py-2 flex items-center justify-between gap-2">
                          <span className="min-w-0 truncate text-slate-200">
                            {gi >= 0 && <span className="text-slate-500 ml-1">#{gi + 1}</span>}
                            {s.name}
                            <span className="text-slate-500 font-mono mr-1.5" dir="ltr">{issue.key.startsWith('dup') || issue.key === 'fakeUser' ? (issue.key === 'dupPhone' ? s.phone : s.username) : s.expiryDate}</span>
                          </span>
                          <span className="flex gap-1 flex-shrink-0">
                            <button type="button" onClick={() => onOpenProfile(s)} aria-label={`ملف ${s.name}`} className="p-1.5 rounded-lg bg-slate-800 text-indigo-300 cursor-pointer"><UserRound className="w-3.5 h-3.5" /></button>
                            <button type="button" onClick={() => onEdit(s)} aria-label={`تعديل ${s.name}`} className="p-1.5 rounded-lg bg-slate-800 text-slate-200 cursor-pointer"><Edit className="w-3.5 h-3.5" /></button>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
