import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, CalendarDays, ChevronDown, ClipboardList, Gift, HeartHandshake, Megaphone, Pencil, Plus, Rocket, Send, Trash2, TowerControl, Trophy, UserX, Users } from 'lucide-react';
import { PaymentRecord, PlanItem, StaffUser, Subscriber, SystemSettings, UpstreamProvider } from '../../types/isp';
import { ACTION_IDEAS, KIND_LABEL, STATUS_LABEL, buildPlanItem, daysBetween, groupPlan, ideaById, planAlertCount, planResults, planStatus, upcomingOccasions, validatePlanInput, type ActionIdea, type SegmentKey } from '../../utils/marketingPlan';
import { describePromotion, isPromotionApplicable, type PromoKind, type Promotion } from '../../../shared/promotions';
import { fillTemplate, higherPlan, referralBoard, segmentMembers, type SegmentId } from '../../utils/marketing';
import { formatCurrency, generateWhatsAppLink } from '../../utils/storage';
import { todayStr, uid } from '../../utils/dates';
import { NO_TOWER_LABEL, normTower } from '../../utils/towers';
import { ReminderQueue } from '../ReminderQueue';
import { BackButton } from '../ui/BackButton';
import { appConfirm, notify } from '../ui/Dialogs';
import { useEscapeKey } from '../ui/useEscapeKey';

/**
 * العروض والتسويق (المدير والمحاسب): العروض تُطبَّق عند التجديد، حملات واتساب حسب الفئة،
 * ودعوة الأصدقاء. المدير وحده يعدّل العروض والإعدادات (الإعدادات على الخادم للمدير فقط).
 */

type Tab = 'plan' | 'offers' | 'campaigns' | 'referrals';

const SENT_KEY = 'sas_plus_campaign_sent_v1';      // { segment: { subId: date } } — على هذا الجهاز
const TPL_KEY = 'sas_plus_campaign_tpl_v1';
const COOLDOWN_DAYS = 7;                            // لا نكرر رسالة نفس الحملة لنفس المشترك قبل أسبوع
const DEFAULT_DAILY_LIMIT = 30;
const DEFAULT_REWARD_DAYS = 10;

const DEFAULT_TEMPLATES: Record<SegmentId, string> = {
  lost: 'السلام عليكم {الاسم} 🌹\nاشتقنا لك في {الشبكة}! اشتراكك متوقف منذ فترة، ويسعدنا رجوعك.\n{العرض}\nللتجديد ردّ على هذه الرسالة.',
  loyal: 'شكراً {الاسم} لثقتك بـ {الشبكة} طوال هذه المدة 💙\n{العرض}\nوإذا دعوت صديقاً يشترك عندنا تحصل على أيام مجانية 🎁',
  upgrade: 'مرحباً {الاسم} 👋\nيمكنك الترقية من {الباقة} إلى باقة {الباقة_الأعلى} بسرعة أعلى وفرق بسيط في السعر.\nهل تحب أن نفعّلها لك؟',
  tower: 'تنبيه من {الشبكة}: نعمل اليوم على صيانة البرج، وقد يحدث انقطاع قصير. نعتذر عن الإزعاج 🙏',
};

const SEGMENTS: Array<{ id: SegmentId; title: string; hint: string; icon: React.ComponentType<{ className?: string }>; marketing: boolean }> = [
  { id: 'lost', title: 'استرجاع المنقطعين', hint: 'انتهى اشتراكهم منذ أكثر من 30 يوماً', icon: UserX, marketing: true },
  { id: 'loyal', title: 'شكر العملاء الأوفياء', hint: 'جدّدوا 6 أشهر أو أكثر خلال السنة بلا ديون', icon: HeartHandshake, marketing: true },
  { id: 'upgrade', title: 'عرض الترقية', hint: 'منتظمون في الدفع ولهم باقة أعلى متاحة', icon: Rocket, marketing: true },
  { id: 'tower', title: 'إشعار حسب البرج', hint: 'صيانة أو عطل أو خبر لمشتركي برج (رسالة خدمة)', icon: TowerControl, marketing: false },
];

const QUICK_PROMOS: Array<Omit<Promotion, 'id' | 'active'>> = [
  { name: '3 أشهر + شهر مجاناً', kind: 'free_months', minMonths: 3, value: 1 },
  { name: '6 أشهر + شهرين مجاناً', kind: 'free_months', minMonths: 6, value: 2 },
  { name: 'خصم 10% لستة أشهر', kind: 'discount_percent', minMonths: 6, value: 10 },
  { name: 'تجديد مبكر: خصم 5,000', kind: 'discount_amount', minMonths: 1, value: 5000, earlyOnly: true },
];

function readJson<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) || '') ?? fallback; } catch { return fallback; }
}

interface MarketingViewProps {
  subscribers: Subscriber[];
  payments: PaymentRecord[];
  providers: UpstreamProvider[];
  settings: SystemSettings;
  currentUser: StaffUser;
  onSaveSettings: (patch: Partial<SystemSettings>) => void;
  onOpenProfile: (sub: Subscriber) => void;
}

export const MarketingView: React.FC<MarketingViewProps> = props => {
  const [tab, setTab] = useState<Tab>('plan');
  const [focusSegment, setFocusSegment] = useState<SegmentId | undefined>(undefined);
  const tabs: Array<{ id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'plan', label: 'التخطيط', icon: ClipboardList },
    { id: 'offers', label: 'العروض', icon: Gift },
    { id: 'campaigns', label: 'حملات واتساب', icon: Megaphone },
    { id: 'referrals', label: 'ادعُ صديقاً', icon: Users },
  ];
  return (
    <div className="space-y-5 max-w-5xl mx-auto text-base leading-relaxed">
      <div>
        <h2 className="text-xl font-semibold text-white">العروض والتسويق</h2>
        <p className="text-sm text-slate-400">عروض تُطبَّق عند التجديد، رسائل واتساب لكل فئة، ومكافأة لمن يدعو أصدقاءه.</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" role="group" aria-label="أقسام التسويق">
        {tabs.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.id} type="button" onClick={() => setTab(t.id)} aria-pressed={tab === t.id}
              className={`min-h-14 rounded-xl border-2 px-2 text-base font-semibold flex items-center justify-center gap-2 cursor-pointer ${tab === t.id ? 'bg-cyan-500/15 border-cyan-500 text-cyan-100' : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'}`}>
              <Icon className="w-5 h-5" /> {t.label}
            </button>
          );
        })}
      </div>
      {tab === 'plan' && <PlanTab {...props} onOpenOffers={() => setTab('offers')} onOpenCampaign={seg => { setFocusSegment(seg); setTab('campaigns'); }} />}
      {tab === 'offers' && <OffersTab {...props} />}
      {tab === 'campaigns' && <CampaignsTab {...props} initialSegment={focusSegment} />}
      {tab === 'referrals' && <ReferralsTab {...props} />}
    </div>
  );
};

// ---------------- التخطيط ----------------

interface PlanDraft { idea: ActionIdea | null; title: string; start: string; end?: string; note?: string }

const addDaysStr = (date: string, n: number) => { const d = new Date(`${date}T12:00:00`); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

const PlanTab: React.FC<MarketingViewProps & { onOpenOffers: () => void; onOpenCampaign: (s: SegmentKey) => void }> = ({ settings, payments, currentUser, onSaveSettings, onOpenOffers, onOpenCampaign }) => {
  const isAdmin = currentUser.role === 'admin';
  const today = todayStr();
  const plan = settings.marketingPlan || [];
  const promos = settings.promotions || [];
  const groups = useMemo(() => groupPlan(plan, today), [plan, today]);
  const occasions = useMemo(() => upcomingOccasions(today).slice(0, 4), [today]);
  const soon = plan.filter(i => !i.skipped && i.startDate > today && i.startDate <= addDaysStr(today, 3));
  const [draft, setDraft] = useState<PlanDraft | null>(null);
  const [openIdea, setOpenIdea] = useState<string | null>(null);
  const money = (n: number) => formatCurrency(Math.round(n), settings.currency);

  const startFromIdea = (idea: ActionIdea, over: Partial<PlanDraft> = {}) => {
    const start = over.start || today;
    setDraft({ idea, title: over.title || idea.title, start, end: over.end ?? (idea.defaultDays > 0 ? addDaysStr(start, idea.defaultDays) : undefined), note: over.note });
  };
  const fromOccasion = (idea: ActionIdea, o: ReturnType<typeof upcomingOccasions>[number]) => {
    const start = addDaysStr(o.start, -o.leadDays) > today ? addDaysStr(o.start, -o.leadDays) : today;
    startFromIdea(idea, { start, end: o.end, title: `${idea.title} — ${o.name}`, note: o.approx ? `${o.name}: التاريخ تقريبي وقد يختلف يوماً حسب رؤية الهلال.` : undefined });
  };

  const patchPlan = (next: PlanItem[], msg: string) => { onSaveSettings({ marketingPlan: next }); notify(msg, 'success'); };

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-400">اقرأ الأفكار، اختر ما يناسبك وحدّد موعده، وسيذكّرك التطبيق قبل البدء. الخطة يضعها المدير ويراها المكتب.</p>

      {soon.length > 0 && (
        <div role="status" className="bg-amber-950/40 border border-amber-700 rounded-2xl px-4 py-3 text-amber-100">
          <p className="font-semibold">تذكير: تبدأ قريباً</p>
          <ul className="text-sm mt-1 space-y-0.5">
            {soon.map(i => <li key={i.id}>{i.title}: بعد {daysBetween(today, i.startDate)} {daysBetween(today, i.startDate) === 1 ? 'يوم' : 'أيام'} (<span dir="ltr">{i.startDate}</span>)</li>)}
          </ul>
        </div>
      )}

      {/* المناسبات القادمة */}
      <section className="space-y-3" aria-label="المناسبات القادمة">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2"><CalendarDays className="w-5 h-5 text-cyan-300" /> المناسبات القادمة</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {occasions.map(o => {
            const left = daysBetween(today, o.start);
            return (
              <div key={o.id} className="bg-slate-900 border border-slate-700 rounded-2xl p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-lg font-semibold text-white">{o.name}</p>
                  <span className="text-sm px-3 py-1 rounded-full bg-cyan-500/15 text-cyan-200 whitespace-nowrap">{left > 0 ? `بعد ${left} يوماً` : 'الآن'}</span>
                </div>
                <p className="text-sm text-slate-300">من <span dir="ltr">{o.start}</span> إلى <span dir="ltr">{o.end}</span>{o.approx ? ' (تقريبي)' : ''}</p>
                {isAdmin ? (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {o.suggested.map(id => {
                      const idea = ideaById(id)!;
                      return <button key={id} type="button" onClick={() => fromOccasion(idea, o)} className="min-h-11 px-3 rounded-xl bg-slate-800 border border-slate-700 text-sm text-slate-100 hover:bg-slate-700 cursor-pointer text-right">+ {idea.title}</button>;
                    })}
                  </div>
                ) : <p className="text-xs text-slate-400">اقتراحات: {o.suggested.map(id => ideaById(id)!.title).join(' • ')}</p>}
              </div>
            );
          })}
        </div>
      </section>

      {/* خطتي */}
      <section className="space-y-3" aria-label="خطتي">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2"><ClipboardList className="w-5 h-5 text-cyan-300" /> خطتي ({plan.filter(i => !i.skipped).length})</h3>
          {isAdmin && <button type="button" onClick={() => setDraft({ idea: null, title: '', start: today })} className="min-h-11 px-4 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white cursor-pointer flex items-center gap-1.5"><Plus className="w-4 h-4" /> بند خاص</button>}
        </div>
        {plan.length === 0 ? (
          <div className="py-10 px-4 text-center bg-slate-900 border border-slate-700 rounded-2xl space-y-2">
            <ClipboardList className="w-12 h-12 text-slate-500 mx-auto" />
            <p className="text-lg text-white">خطتك فارغة.</p>
            <p className="text-sm text-slate-400">{isAdmin ? 'اختر فكرة من المكتبة بالأسفل أو من المناسبات القادمة بالأعلى.' : 'المدير العام يضع خطة التسويق.'}</p>
          </div>
        ) : (
          (['running', 'upcoming', 'done', 'skipped'] as const).filter(k => groups[k].length > 0).map(k => (
            <div key={k} className="space-y-2">
              <p className="text-sm font-semibold text-slate-300">{STATUS_LABEL[k]} ({groups[k].length})</p>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {groups[k].map(it => {
                  const status = planStatus(it, today);
                  const promo = promos.find(p => p.id === it.promotionId);
                  const res = planResults(it, payments);
                  const left = status === 'upcoming' ? daysBetween(today, it.startDate) : it.endDate ? daysBetween(today, it.endDate) : null;
                  return (
                    <li key={it.id} className={`bg-slate-900 border rounded-2xl p-4 space-y-2 ${status === 'running' ? 'border-emerald-600/70' : 'border-slate-700'} ${status === 'skipped' || status === 'done' ? 'opacity-80' : ''}`}>
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-lg font-semibold text-white">{it.title}</p>
                        <span className={`text-sm px-3 py-1 rounded-full whitespace-nowrap ${status === 'running' ? 'bg-emerald-500/15 text-emerald-200' : status === 'upcoming' ? 'bg-amber-500/15 text-amber-200' : 'bg-white/10 text-slate-300'}`}>{STATUS_LABEL[status]}</span>
                      </div>
                      <p className="text-sm text-slate-300">من <span dir="ltr">{it.startDate}</span>{it.endDate ? <> إلى <span dir="ltr">{it.endDate}</span></> : ' (بدون نهاية)'}
                        {left !== null && status === 'upcoming' && ` • يبدأ بعد ${left} ${left === 1 ? 'يوم' : 'أيام'}`}
                        {left !== null && status === 'running' && it.endDate && ` • ينتهي بعد ${left} ${left === 1 ? 'يوم' : 'أيام'}`}</p>
                      {it.note && <p className="text-sm text-slate-400">{it.note}</p>}
                      {it.promotionId && (
                        <p className="text-sm text-emerald-200">{promo ? `العرض مرتبط ${promo.active ? 'وفعّال في هذه الفترة' : '(موقوف حالياً)'}` : 'العرض المرتبط حُذف من تبويب العروض.'}</p>
                      )}
                      {res && res.uses > 0 && (
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="bg-slate-950/50 rounded-xl p-2"><p className="text-xs text-slate-400">استُخدم</p><p className="font-semibold text-white tabular-nums">{res.uses}</p></div>
                          <div className="bg-slate-950/50 rounded-xl p-2"><p className="text-xs text-slate-400">دخل منه</p><p className="font-semibold text-emerald-300 tabular-nums text-sm">{money(res.revenue)}</p></div>
                          <div className="bg-slate-950/50 rounded-xl p-2"><p className="text-xs text-slate-400">كلّفنا</p><p className="font-semibold text-amber-200 tabular-nums text-sm">{money(res.cost)}</p></div>
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2 pt-1">
                        {it.segment && status !== 'skipped' && <button type="button" onClick={() => onOpenCampaign(it.segment!)} className="min-h-11 px-3 rounded-xl bg-emerald-700 text-white text-sm font-semibold cursor-pointer flex items-center gap-1.5"><Send className="w-4 h-4" /> افتح الحملة</button>}
                        {it.promotionId && <button type="button" onClick={onOpenOffers} className="min-h-11 px-3 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white cursor-pointer">العرض</button>}
                        {isAdmin && <button type="button" onClick={() => patchPlan(plan.map(x => (x.id === it.id ? { ...x, skipped: !x.skipped } : x)), it.skipped ? 'أُعيد البند إلى الخطة.' : 'أُلغي البند.')} className="min-h-11 px-3 rounded-xl bg-slate-800 border border-slate-700 text-sm text-slate-200 cursor-pointer">{it.skipped ? 'استعادة' : 'إلغاء البند'}</button>}
                        {isAdmin && <button type="button" onClick={async () => { if (await appConfirm(`حذف «${it.title}» من الخطة؟${it.promotionId ? '\nالعرض المرتبط يبقى في تبويب العروض.' : ''}`, { confirmLabel: 'حذف البند' })) patchPlan(plan.filter(x => x.id !== it.id), 'تم حذف البند.'); }} className="min-h-11 px-3 rounded-xl bg-slate-800 border border-slate-700 text-sm text-rose-200 cursor-pointer flex items-center gap-1.5"><Trash2 className="w-4 h-4" /> حذف</button>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </section>

      {/* مكتبة الأفكار (للقراءة) */}
      <section className="space-y-3" aria-label="مكتبة الأفكار">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2"><BookOpen className="w-5 h-5 text-cyan-300" /> مكتبة الأفكار</h3>
        <ul className="space-y-2">
          {ACTION_IDEAS.map(idea => {
            const open = openIdea === idea.id;
            return (
              <li key={idea.id} className="bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden">
                <button type="button" onClick={() => setOpenIdea(open ? null : idea.id)} aria-expanded={open} className="w-full min-h-14 px-4 py-3 flex items-center justify-between gap-3 text-right cursor-pointer">
                  <span className="min-w-0">
                    <span className="block text-base font-semibold text-white">{idea.title}</span>
                    <span className="block text-sm text-slate-400">{idea.goal}</span>
                  </span>
                  <span className="flex items-center gap-2 flex-shrink-0">
                    <span className="hidden sm:inline text-xs px-2 py-1 rounded-full bg-white/10 text-slate-200">{KIND_LABEL[idea.kind]}</span>
                    <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
                  </span>
                </button>
                {open && (
                  <div className="px-4 pb-4 space-y-3 border-t border-slate-800 pt-3 text-base leading-relaxed">
                    {([['متى تستعملها', idea.whenToUse], ['ماذا يفعل التطبيق', idea.howInApp], ['الأثر المتوقع', idea.effect]] as const).map(([label, text]) => (
                      <div key={label}><p className="text-sm font-semibold text-cyan-200">{label}</p><p className="text-slate-200">{text}</p></div>
                    ))}
                    <p className="text-sm text-slate-400">{KIND_LABEL[idea.kind]} • الجهد: {idea.effort} • {idea.defaultDays > 0 ? `مدة مقترحة: ${idea.defaultDays} يوماً` : 'يعمل بشكل دائم'}</p>
                    {isAdmin && <button type="button" onClick={() => startFromIdea(idea)} className="min-h-12 px-5 rounded-xl bg-cyan-600 text-white font-semibold cursor-pointer flex items-center gap-2"><Plus className="w-5 h-5" /> أضف إلى خطتي</button>}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {draft && (
        <PlanDialog
          draft={draft}
          onClose={() => setDraft(null)}
          onSave={input => {
            const { item, promotion } = buildPlanItem(draft.idea, input);
            onSaveSettings({ marketingPlan: [...plan, item], ...(promotion ? { promotions: [...promos, promotion] } : {}) });
            notify(promotion ? 'أُضيف البند، وأُنشئ العرض وسيظهر في نافذة التجديد خلال الفترة.' : 'أُضيف البند إلى خطتك.', 'success');
            setDraft(null);
          }}
        />
      )}
    </div>
  );
};

const PlanDialog: React.FC<{ draft: PlanDraft; onClose: () => void; onSave: (i: { title: string; startDate: string; endDate?: string; note?: string; createOffer?: boolean }) => void }> = ({ draft, onClose, onSave }) => {
  useEscapeKey(onClose);
  const [title, setTitle] = useState(draft.title);
  const [start, setStart] = useState(draft.start);
  const [end, setEnd] = useState(draft.end || '');
  const [note, setNote] = useState(draft.note || '');
  const [createOffer, setCreateOffer] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const idea = draft.idea;
  const submit = () => {
    const input = { title, startDate: start, endDate: end || undefined, note, createOffer: !!idea?.offer && createOffer };
    const err = validatePlanInput(input);
    if (err) { setError(err); return; }
    onSave(input);
  };
  return (
    <div className="app-overlay fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-sm" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="بند في الخطة" onClick={e => e.stopPropagation()}
        className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto bg-slate-900 border border-slate-700 rounded-t-3xl sm:rounded-2xl p-5 space-y-4 text-base"
        style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))' }}>
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-white">{idea ? 'أضف إلى الخطة' : 'بند خاص'}</h3>
          <BackButton onClick={onClose} />
        </div>
        {idea && <p className="text-sm text-slate-400">{idea.goal}</p>}
        <label className="block">
          <span className="block text-sm font-semibold text-slate-300 mb-1">اسم البند</span>
          <input value={title} onChange={e => { setTitle(e.target.value); setError(null); }} className="w-full h-12 bg-slate-950 border border-slate-700 rounded-xl px-3 text-white focus:outline-none focus:border-cyan-500" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-sm font-semibold text-slate-300 mb-1">يبدأ</span>
            <input type="date" value={start} onChange={e => { setStart(e.target.value); setError(null); }} className="w-full h-12 bg-slate-950 border border-slate-700 rounded-xl px-3 text-white" />
          </label>
          <label className="block">
            <span className="block text-sm font-semibold text-slate-300 mb-1">ينتهي (اختياري)</span>
            <input type="date" value={end} onChange={e => { setEnd(e.target.value); setError(null); }} className="w-full h-12 bg-slate-950 border border-slate-700 rounded-xl px-3 text-white" />
          </label>
        </div>
        <label className="block">
          <span className="block text-sm font-semibold text-slate-300 mb-1">ملاحظة (اختياري)</span>
          <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white focus:outline-none focus:border-cyan-500" />
        </label>
        {idea?.offer && (
          <label className="flex items-start gap-3 cursor-pointer bg-emerald-950/30 border border-emerald-900/60 rounded-xl p-3">
            <input type="checkbox" checked={createOffer} onChange={e => setCreateOffer(e.target.checked)} className="w-5 h-5 mt-0.5 accent-emerald-500 flex-shrink-0" />
            <span className="text-sm text-emerald-100">أنشئ العرض تلقائياً وفعّله خلال هذه الفترة فقط
              <span className="block text-xs text-emerald-200/70">يظهر في نافذة التجديد من تاريخ البدء، ويختفي بعد الانتهاء.</span></span>
          </label>
        )}
        {idea?.segment && <p className="text-sm text-slate-300 bg-slate-800/60 rounded-xl p-3">هذه حملة: عند الموعد اضغط «افتح الحملة» في بند الخطة لإرسال الرسائل بالدور.</p>}
        {error && <p role="alert" className="text-sm text-rose-200 bg-rose-950/50 border border-rose-800 rounded-xl px-3 py-2">{error}</p>}
        <button type="button" onClick={submit} className="w-full min-h-12 rounded-xl bg-cyan-600 text-white font-semibold cursor-pointer">حفظ في الخطة</button>
      </div>
    </div>
  );
};

// ---------------- العروض ----------------

function promoStatus(p: Promotion, today: string): { text: string; cls: string } {
  if (!p.active) return { text: 'موقوف', cls: 'bg-white/10 text-slate-300' };
  if (p.endDate && today > p.endDate) return { text: 'منتهي', cls: 'bg-white/10 text-slate-300' };
  if (p.startDate && today < p.startDate) return { text: `يبدأ ${p.startDate}`, cls: 'bg-amber-500/15 text-amber-200' };
  return { text: 'فعّال', cls: 'bg-emerald-500/15 text-emerald-200' };
}

const OffersTab: React.FC<MarketingViewProps> = ({ settings, payments, currentUser, onSaveSettings }) => {
  const isAdmin = currentUser.role === 'admin';
  const promos = settings.promotions || [];
  const today = todayStr();
  const [editing, setEditing] = useState<Promotion | null>(null);
  const money = (n: number) => formatCurrency(Math.round(n), settings.currency);
  const save = (list: Promotion[], msg: string) => { onSaveSettings({ promotions: list }); notify(msg, 'success'); };

  const statsFor = (id: string) => {
    const used = payments.filter(p => p.promotionId === id);
    return { uses: used.length, revenue: used.reduce((a, p) => a + (p.amount || 0), 0), saved: used.reduce((a, p) => a + (p.discount || 0), 0) };
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">العرض الفعّال يظهر تلقائياً في نافذة التجديد، والموظف يختاره بضغطة. الأشهر المجانية تمدّد الاشتراك ولا تُحسب ديناً.</p>
      {isAdmin && (
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 space-y-3">
          <p className="text-sm font-semibold text-slate-200">أضف عرضاً بسرعة</p>
          <div className="flex flex-wrap gap-2">
            {QUICK_PROMOS.map(q => (
              <button key={q.name} type="button" onClick={() => setEditing({ ...q, id: '', active: true, startDate: today })}
                className="min-h-11 px-3 rounded-xl bg-slate-800 border border-slate-700 text-sm text-slate-100 hover:bg-slate-700 cursor-pointer">{q.name}</button>
            ))}
            <button type="button" onClick={() => setEditing({ id: '', name: '', kind: 'free_months', minMonths: 3, value: 1, active: true, startDate: today })}
              className="min-h-11 px-4 rounded-xl bg-cyan-600 text-white text-sm font-semibold flex items-center gap-1.5 cursor-pointer"><Plus className="w-4 h-4" /> عرض جديد</button>
          </div>
        </div>
      )}

      {promos.length === 0 ? (
        <div className="py-12 text-center bg-slate-900 border border-slate-700 rounded-2xl space-y-2">
          <Gift className="w-12 h-12 text-slate-500 mx-auto" />
          <p className="text-lg text-white">لا توجد عروض بعد.</p>
          <p className="text-sm text-slate-400">{isAdmin ? 'اختر عرضاً جاهزاً من الأعلى أو أنشئ عرضاً جديداً.' : 'المدير العام يضيف العروض.'}</p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {promos.map(p => {
            const st = promoStatus(p, today);
            const s = statsFor(p.id);
            return (
              <li key={p.id} className="bg-slate-900 border border-slate-700 rounded-2xl p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-lg font-semibold text-white">{p.name}</p>
                    <p className="text-sm text-slate-300">{describePromotion(p, n => n.toLocaleString('en-US'))}</p>
                    <p className="text-xs text-slate-400 mt-1">{p.startDate ? `من ${p.startDate}` : 'من الآن'} {p.endDate ? `إلى ${p.endDate}` : '• بدون تاريخ انتهاء'}</p>
                  </div>
                  <span className={`text-sm px-3 py-1 rounded-full whitespace-nowrap ${st.cls}`}>{st.text}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-slate-950/50 rounded-xl p-2"><p className="text-xs text-slate-400">استُخدم</p><p className="font-semibold text-white tabular-nums">{s.uses}</p></div>
                  <div className="bg-slate-950/50 rounded-xl p-2"><p className="text-xs text-slate-400">دخل منه</p><p className="font-semibold text-emerald-300 tabular-nums text-sm">{money(s.revenue)}</p></div>
                  <div className="bg-slate-950/50 rounded-xl p-2"><p className="text-xs text-slate-400">كلّفنا</p><p className="font-semibold text-amber-200 tabular-nums text-sm">{money(s.saved)}</p></div>
                </div>
                {isAdmin && (
                  <div className="grid grid-cols-3 gap-2">
                    <button type="button" onClick={() => setEditing(p)} className="min-h-11 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white flex items-center justify-center gap-1.5 cursor-pointer"><Pencil className="w-4 h-4" /> تعديل</button>
                    <button type="button" onClick={() => save(promos.map(x => (x.id === p.id ? { ...x, active: !x.active } : x)), p.active ? 'تم إيقاف العرض.' : 'تم تفعيل العرض.')}
                      className="min-h-11 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white cursor-pointer">{p.active ? 'إيقاف' : 'تفعيل'}</button>
                    <button type="button" onClick={async () => { if (await appConfirm(`حذف العرض «${p.name}»؟ تبقى الوصولات التي استخدمته كما هي.`, { confirmLabel: 'حذف العرض' })) save(promos.filter(x => x.id !== p.id), 'تم حذف العرض.'); }}
                      className="min-h-11 rounded-xl bg-slate-800 border border-slate-700 text-sm text-rose-200 flex items-center justify-center gap-1.5 cursor-pointer"><Trash2 className="w-4 h-4" /> حذف</button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {editing && (
        <PromoEditor
          initial={editing}
          onClose={() => setEditing(null)}
          onSave={p => {
            const exists = promos.some(x => x.id === p.id);
            save(exists ? promos.map(x => (x.id === p.id ? p : x)) : [...promos, p], exists ? 'تم حفظ العرض.' : 'تمت إضافة العرض، وسيظهر في نافذة التجديد.');
            setEditing(null);
          }}
        />
      )}
    </div>
  );
};

const PromoEditor: React.FC<{ initial: Promotion; onClose: () => void; onSave: (p: Promotion) => void }> = ({ initial, onClose, onSave }) => {
  useEscapeKey(onClose);
  const [p, setP] = useState<Promotion>(initial);
  const set = <K extends keyof Promotion>(k: K, v: Promotion[K]) => setP(prev => ({ ...prev, [k]: v }));
  const valueLabel = p.kind === 'free_months' ? 'عدد الأشهر المجانية' : p.kind === 'discount_amount' ? 'قيمة الخصم (دينار)' : 'نسبة الخصم (%)';
  const valid = p.name.trim() && p.value > 0 && (!p.endDate || !p.startDate || p.endDate >= p.startDate) && (p.kind !== 'discount_percent' || p.value <= 100);
  const kinds: Array<{ id: PromoKind; label: string }> = [
    { id: 'free_months', label: 'أشهر مجانية' },
    { id: 'discount_amount', label: 'خصم بالدينار' },
    { id: 'discount_percent', label: 'خصم بالنسبة' },
  ];
  return (
    <div className="app-overlay fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-sm" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="العرض" onClick={e => e.stopPropagation()}
        className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto bg-slate-900 border border-slate-700 rounded-t-3xl sm:rounded-2xl p-5 space-y-4 text-base"
        style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))' }}>
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-white">{initial.id ? 'تعديل العرض' : 'عرض جديد'}</h3>
          <BackButton onClick={onClose} />
        </div>
        <label className="block">
          <span className="block text-sm font-semibold text-slate-300 mb-1">اسم العرض (يظهر للموظف وفي الوصل)</span>
          <input value={p.name} onChange={e => set('name', e.target.value)} className="w-full h-12 bg-slate-950 border border-slate-700 rounded-xl px-3 text-white focus:outline-none focus:border-cyan-500" />
        </label>
        <div>
          <span className="block text-sm font-semibold text-slate-300 mb-1">نوع العرض</span>
          <div className="grid grid-cols-3 gap-2">
            {kinds.map(k => (
              <button key={k.id} type="button" onClick={() => set('kind', k.id)} aria-pressed={p.kind === k.id}
                className={`min-h-12 rounded-xl border-2 text-sm font-semibold cursor-pointer ${p.kind === k.id ? 'bg-cyan-500/15 border-cyan-500 text-cyan-100' : 'bg-slate-950 border-slate-700 text-slate-300'}`}>{k.label}</button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-sm font-semibold text-slate-300 mb-1">أقل مدة تجديد</span>
            <select value={p.minMonths} onChange={e => set('minMonths', Number(e.target.value))} className="w-full h-12 bg-slate-950 border border-slate-700 rounded-xl px-3 text-white">
              {[1, 2, 3, 6, 12].map(m => <option key={m} value={m}>{m === 1 ? 'شهر' : m === 2 ? 'شهران' : `${m} أشهر`}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="block text-sm font-semibold text-slate-300 mb-1">{valueLabel}</span>
            <input type="number" inputMode="numeric" min={1} max={p.kind === 'discount_percent' ? 100 : undefined} value={p.value || ''} onChange={e => set('value', Number(e.target.value))}
              className="w-full h-12 bg-slate-950 border border-slate-700 rounded-xl px-3 text-white font-mono focus:outline-none focus:border-cyan-500" />
          </label>
          <label className="block">
            <span className="block text-sm font-semibold text-slate-300 mb-1">يبدأ</span>
            <input type="date" value={p.startDate || ''} onChange={e => set('startDate', e.target.value || undefined)} className="w-full h-12 bg-slate-950 border border-slate-700 rounded-xl px-3 text-white" />
          </label>
          <label className="block">
            <span className="block text-sm font-semibold text-slate-300 mb-1">ينتهي (اختياري)</span>
            <input type="date" value={p.endDate || ''} onChange={e => set('endDate', e.target.value || undefined)} className="w-full h-12 bg-slate-950 border border-slate-700 rounded-xl px-3 text-white" />
          </label>
        </div>
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={!!p.earlyOnly} onChange={e => set('earlyOnly', e.target.checked)} className="w-5 h-5 accent-cyan-500" />
          <span className="text-sm text-slate-200">فقط لمن يجدد قبل انتهاء اشتراكه (تشجيع التجديد المبكر)</span>
        </label>
        <p className="text-sm text-emerald-200 bg-emerald-950/30 border border-emerald-900/60 rounded-xl px-3 py-2">{p.value > 0 ? describePromotion(p) : 'أدخل قيمة العرض'}</p>
        <button type="button" disabled={!valid} onClick={() => onSave({ ...p, name: p.name.trim(), id: p.id || uid('promo'), createdAt: p.createdAt || new Date().toISOString() })}
          className="w-full min-h-12 rounded-xl bg-cyan-600 text-white font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
          حفظ العرض
        </button>
      </div>
    </div>
  );
};

// ---------------- حملات واتساب ----------------

const CampaignsTab: React.FC<MarketingViewProps & { initialSegment?: SegmentId }> = ({ subscribers, payments, providers, settings, currentUser, onSaveSettings, onOpenProfile, initialSegment }) => {
  const isAdmin = currentUser.role === 'admin';
  const today = todayStr();
  const [segment, setSegment] = useState<SegmentId>(initialSegment ?? 'lost');
  const [tower, setTower] = useState('all');
  const [sent, setSent] = useState<Record<string, Record<string, string>>>(() => readJson(SENT_KEY, {}));
  const [templates, setTemplates] = useState<Record<string, string>>(() => readJson(TPL_KEY, {}));
  const [queue, setQueue] = useState<Subscriber[] | null>(null);
  const [queueIndex, setQueueIndex] = useState(0);
  const [limitDraft, setLimitDraft] = useState(String(settings.marketingDailyLimit ?? DEFAULT_DAILY_LIMIT));
  useEffect(() => { try { localStorage.setItem(SENT_KEY, JSON.stringify(sent)); } catch { /* */ } }, [sent]);
  useEffect(() => { try { localStorage.setItem(TPL_KEY, JSON.stringify(templates)); } catch { /* */ } }, [templates]);

  const dailyLimit = settings.marketingDailyLimit ?? DEFAULT_DAILY_LIMIT;
  const sentToday = Object.entries(sent).filter(([seg]) => seg !== 'tower').reduce((a, [, m]) => a + Object.values(m).filter(d => d === today).length, 0);
  const remainingToday = Math.max(0, dailyLimit - sentToday);
  const towers = useMemo(() => [...new Set(subscribers.map(s => normTower(s.towerName) || NO_TOWER_LABEL))].sort((a, b) => a.localeCompare(b, 'ar')), [subscribers]);
  const counts = useMemo(() => Object.fromEntries(SEGMENTS.map(s => [s.id, segmentMembers(s.id, subscribers, payments, providers, today, 'all').length])) as Record<SegmentId, number>,
    [subscribers, payments, providers, today]);
  const members = useMemo(() => segmentMembers(segment, subscribers, payments, providers, today, tower), [segment, subscribers, payments, providers, today, tower]);
  const meta = SEGMENTS.find(s => s.id === segment)!;
  const template = templates[segment] ?? DEFAULT_TEMPLATES[segment];

  // أفضل عرض فعّال اليوم (يُذكر في رسائل الاسترجاع والشكر)
  const bestOffer = (settings.promotions || []).find(p => isPromotionApplicable(p, { months: Math.max(1, p.minMonths), salePrice: 40000, today, expiryDate: today }));
  const offerLine = bestOffer ? `🎁 عرض خاص: ${bestOffer.name} (${describePromotion(bestOffer)})` : '';
  const messageFor = (s: Subscriber) => fillTemplate(template, {
    'الاسم': s.name.split(' ')[0] || s.name,
    'الشبكة': settings.ispName,
    'الباقة': s.planName,
    'الباقة_الأعلى': higherPlan(s, providers)?.name || 'أعلى',
    'العرض': offerLine,
    'الهاتف': settings.contactPhone,
  });

  const segSent = sent[segment] || {};
  const cooldown = segment === 'tower' ? 1 : COOLDOWN_DAYS;
  const cutoff = new Date(Date.now() - cooldown * 86400000).toISOString().slice(0, 10);
  const eligible = members.filter(s => s.phone && !(segSent[s.id] && segSent[s.id] > cutoff));
  const batch = meta.marketing ? eligible.slice(0, remainingToday) : eligible;
  const returned = segment === 'lost'
    ? Object.entries(segSent).filter(([id, d]) => payments.some(p => p.subscriberId === id && p.paymentType === 'renewal' && p.date >= d)).length
    : 0;

  const send = (s: Subscriber) => {
    setSent(prev => ({ ...prev, [segment]: { ...(prev[segment] || {}), [s.id]: today } }));
    window.open(generateWhatsAppLink(s.phone, messageFor(s)), '_blank');
  };

  return (
    <div className="space-y-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-300">رسائل العروض اليوم: <b className="text-white tabular-nums">{sentToday}</b> من <b className="text-white tabular-nums">{dailyLimit}</b>
          <span className="block text-xs text-slate-400">حدّ يومي يحمي رقم الواتساب من الحظر. من اختار «لا يرغب بالعروض» لا تصله رسائل العروض.</span></p>
        {isAdmin && (
          <div className="flex items-end gap-2">
            <label className="block">
              <span className="block text-xs text-slate-400 mb-1">الحد اليومي</span>
              <input type="number" min={5} max={200} value={limitDraft} onChange={e => setLimitDraft(e.target.value)} className="w-24 h-11 bg-slate-950 border border-slate-700 rounded-xl px-3 text-white font-mono" />
            </label>
            <button type="button" onClick={() => { const n = Math.min(200, Math.max(5, Number(limitDraft) || DEFAULT_DAILY_LIMIT)); onSaveSettings({ marketingDailyLimit: n }); setLimitDraft(String(n)); notify(`الحد اليومي: ${n} رسالة.`, 'success'); }}
              className="h-11 px-4 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm cursor-pointer">حفظ</button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" role="group" aria-label="الفئة">
        {SEGMENTS.map(s => {
          const Icon = s.icon;
          return (
            <button key={s.id} type="button" onClick={() => setSegment(s.id)} aria-pressed={segment === s.id}
              className={`rounded-2xl border-2 p-3 text-right cursor-pointer ${segment === s.id ? 'bg-cyan-500/15 border-cyan-400' : 'bg-slate-900 border-slate-700 hover:border-slate-500'}`}>
              <span className="flex items-center gap-2 text-white font-semibold"><Icon className="w-5 h-5 text-cyan-300" /> {s.title}</span>
              <span className="block text-2xl font-bold text-white tabular-nums mt-1">{counts[s.id]}</span>
              <span className="block text-xs text-slate-400 leading-snug">{s.hint}</span>
            </button>
          );
        })}
      </div>

      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 space-y-3">
        {segment === 'tower' && (
          <label className="block">
            <span className="block text-sm font-semibold text-slate-300 mb-1">البرج</span>
            <select value={tower} onChange={e => setTower(e.target.value)} className="w-full sm:w-64 h-12 bg-slate-950 border border-slate-700 rounded-xl px-3 text-white">
              <option value="all">كل الأبراج</option>
              {towers.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
        )}
        <label className="block">
          <span className="block text-sm font-semibold text-slate-300 mb-1">نص الرسالة</span>
          <textarea value={template} onChange={e => setTemplates(prev => ({ ...prev, [segment]: e.target.value }))} rows={5}
            className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white leading-relaxed focus:outline-none focus:border-cyan-500" />
          <span className="block text-xs text-slate-400 mt-1">يمكنك استخدام: {'{الاسم}'} {'{الشبكة}'} {'{الباقة}'} {'{الباقة_الأعلى}'} {'{العرض}'} {'{الهاتف}'}
            {templates[segment] !== undefined && <button type="button" onClick={() => setTemplates(prev => { const n = { ...prev }; delete n[segment]; return n; })} className="mr-2 text-cyan-300 underline cursor-pointer">استرجاع النص الأصلي</button>}</span>
        </label>
        {members[0] && (
          <div className="text-sm">
            <span className="text-slate-400">معاينة ({members[0].name}):</span>
            <pre className="mt-1 whitespace-pre-wrap font-sans text-slate-200 bg-slate-950/60 border border-slate-800 rounded-xl p-3">{messageFor(members[0])}</pre>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" disabled={batch.length === 0} onClick={() => { setQueue(batch); setQueueIndex(0); }}
            className="min-h-12 px-5 rounded-xl bg-emerald-700 text-white font-semibold flex items-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
            <Send className="w-5 h-5" /> أرسل واحداً بعد الآخر ({batch.length})
          </button>
          <span className="text-sm text-slate-400">
            {members.length} في الفئة • {members.length - members.filter(s => s.phone).length} بلا رقم • {members.length - eligible.length - (members.length - members.filter(s => s.phone).length)} أُرسل لهم مؤخراً
            {meta.marketing && eligible.length > batch.length && ` • الباقي غداً (الحد اليومي)`}
          </span>
        </div>
        {segment === 'lost' && Object.keys(segSent).length > 0 && (
          <p className="text-sm text-emerald-200">أُرسل لـ {Object.keys(segSent).length} منقطعاً، وعاد منهم <b>{returned}</b> وجدّدوا.</p>
        )}
        {members.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {members.slice(0, 12).map(s => (
              <button key={s.id} type="button" onClick={() => onOpenProfile(s)} className="min-h-10 px-3 rounded-xl bg-slate-800 border border-slate-700 text-sm text-slate-200 cursor-pointer">
                {s.name}{segSent[s.id] ? ' ✓' : ''}
              </button>
            ))}
            {members.length > 12 && <span className="self-center text-sm text-slate-400">و{members.length - 12} آخرون</span>}
          </div>
        )}
      </div>

      {queue && (
        <ReminderQueue
          title={`حملة: ${meta.title}`}
          queue={queue}
          index={queueIndex}
          settings={settings}
          typeFor={() => 'expiry'}
          messageFor={s => messageFor(s)}
          badgeFor={() => meta.title}
          onSend={s => { send(s); setQueueIndex(i => i + 1); }}
          onSkip={() => setQueueIndex(i => i + 1)}
          onClose={() => setQueue(null)}
        />
      )}
    </div>
  );
};

// ---------------- ادعُ صديقاً ----------------

const ReferralsTab: React.FC<MarketingViewProps> = ({ subscribers, settings, currentUser, onSaveSettings, onOpenProfile }) => {
  const isAdmin = currentUser.role === 'admin';
  const days = settings.referralRewardDays ?? DEFAULT_REWARD_DAYS;
  const [draft, setDraft] = useState(String(days));
  const board = useMemo(() => referralBoard(subscribers), [subscribers]);
  const total = board.reduce((a, r) => a + r.total, 0);
  const rewarded = board.reduce((a, r) => a + r.rewarded, 0);
  const pending = board.reduce((a, r) => a + r.pending, 0);
  return (
    <div className="space-y-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 space-y-3">
        <p className="text-sm text-slate-300">عند إضافة مشترك جديد اختر <b className="text-white">«جاء عن طريق»</b>. بعد أن يدفع المشترك الجديد يحصل الداعي على <b className="text-emerald-300">{days} يوماً مجاناً</b> تُضاف تلقائياً في تجديده القادم.</p>
        {isAdmin && (
          <div className="flex items-end gap-2">
            <label className="block">
              <span className="block text-xs text-slate-400 mb-1">أيام المكافأة لكل صديق</span>
              <input type="number" min={0} max={90} value={draft} onChange={e => setDraft(e.target.value)} className="w-24 h-11 bg-slate-950 border border-slate-700 rounded-xl px-3 text-white font-mono" />
            </label>
            <button type="button" onClick={() => { const n = Math.min(90, Math.max(0, Number(draft) || 0)); onSaveSettings({ referralRewardDays: n }); setDraft(String(n)); notify(`المكافأة: ${n} يوماً لكل صديق.`, 'success'); }}
              className="h-11 px-4 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm cursor-pointer">حفظ</button>
          </div>
        )}
      </div>
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-3"><p className="text-sm text-slate-400">مشتركون بالدعوة</p><p className="text-2xl font-bold text-white tabular-nums">{total}</p></div>
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-3"><p className="text-sm text-slate-400">مكافآت مُنحت</p><p className="text-2xl font-bold text-emerald-300 tabular-nums">{rewarded}</p></div>
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-3"><p className="text-sm text-slate-400">بانتظار التجديد</p><p className="text-2xl font-bold text-amber-200 tabular-nums">{pending}</p></div>
      </div>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden">
        <p className="px-4 py-3 border-b border-slate-800 font-semibold text-white flex items-center gap-2"><Trophy className="w-5 h-5 text-amber-300" /> أفضل الداعين</p>
        {board.length === 0 ? (
          <p className="px-4 py-10 text-center text-slate-400">لا توجد دعوات بعد. اختر «جاء عن طريق» عند إضافة مشترك جديد.</p>
        ) : (
          <ul className="divide-y divide-slate-800">
            {board.slice(0, 15).map((r, i) => (
              <li key={r.sub.id} className="px-4 py-3 flex items-center gap-3">
                <span className="w-8 text-center text-lg font-bold text-slate-400 tabular-nums">{i + 1}</span>
                <button type="button" onClick={() => onOpenProfile(r.sub)} className="flex-1 min-h-11 text-right text-white font-semibold hover:text-cyan-200 cursor-pointer">{r.sub.name}</button>
                <span className="text-sm text-slate-300 tabular-nums">{r.total} أصدقاء</span>
                {r.pending > 0 && <span className="text-xs px-2 py-1 rounded-full bg-amber-500/15 text-amber-200">{r.pending} مكافأة قادمة</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
