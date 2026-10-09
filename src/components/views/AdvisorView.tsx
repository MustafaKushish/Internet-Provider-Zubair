import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Expense, PaymentRecord, Subscriber, SupportTicket, SystemSettings, TowerPoint, UpstreamProvider } from '../../types/isp';
import { buildBusinessSnapshot, ADVISOR_NOTES_MAX } from '../../ai/businessSnapshot';
import { NO_TOWER_LABEL, normTower } from '../../utils/towers';
import { askAdvisor, AdvisorMessage, AdvisorProvider, PROVIDER_LABELS } from '../../ai/advisorApi';
import { PREVIEW_MODE, apiRequest } from '../../sync/api';
import { StaffUser } from '../../types/isp';
import { Sparkles, Send, Square, Trash2, Brain, ShieldCheck, Eye, X, AlertTriangle, Rocket, NotebookPen } from 'lucide-react';

interface AdvisorViewProps {
  subscribers: Subscriber[];
  payments: PaymentRecord[];
  tickets: SupportTicket[];
  providers: UpstreamProvider[];
  towers: TowerPoint[];
  settings: SystemSettings;
  expenses?: Expense[];
  currentUser: StaffUser;
  onChangeProvider: (provider: AdvisorProvider) => void;
  onSaveNotes: (notes: string) => void;
}

const ENGINE_OPTIONS: { value: AdvisorProvider; label: string }[] = [
  { value: 'auto', label: 'تلقائي مجاني (Gemini ثم Cloudflare AI)' },
  { value: 'gemini', label: 'Google Gemini (مجاني ضمن حدود)' },
  { value: 'workers', label: 'Cloudflare AI (مجاني ضمن حصة يومية)' },
  { value: 'claude', label: 'Claude (مدفوع، أعلى جودة)' },
];

const HISTORY_KEY = 'sas_plus_advisor_chat_v1';

const SUGGESTIONS = [
  'حلل وضع الشبكة الحالي: ما أهم 5 قرارات ترفع صافي الربح هذا الشهر؟ رتبها حسب الأثر بالدينار.',
  'قارن الأبراج: أي برج يستحق التوسعة أو سكتر إضافي، وأي برج خاسر يجب إصلاحه أو دمجه؟',
  'لدي مشتركون منتهون حديثاً: خطة استرجاع خلال أسبوعين مع عرض ورسالة واتساب جاهزة.',
  'هل أسعار الباقات مناسبة؟ اقترح زيادة أو رسوم أو دفع مقدم لـ3 أشهر بدون خسارة مشتركين، واحسب الأثر.',
  'خطة تسويق عملية لجذب 30 مشتركاً جديداً في الزبير خلال شهر، بميزانية صغيرة.',
  'كيف أحصّل الديون المتأخرة دون خسارة المشترك؟ خطة حسب عدد أشهر التأخير.',
  'برنامج «جيب جارك» للإحالة: صممه لي بالأرقام وهل يربح؟',
  'ما الذي يجب أن أكتبه في «معلومات عملي» حتى تصبح نصائحك أدق؟',
];

/** طلب «خطة رفع البرج»: تحليل عميق لبرج واحد مقارنة ببقية الشبكة */
function towerGrowthPrompt(tower: string): string {
  return `أريد خطة كاملة لرفع برج «${tower}» إلى أقصى ربح ممكن.
1. شخّص البرج بالأرقام مقارنة بمتوسط الشبكة وأفضل برج: الربح، ARPU، نسبة التجديد، مجمع الاسترجاع، الديون، البلاغات.
2. ما أكبر 3 روافع لهذا البرج تحديداً؟ واحسب لكل واحدة الربح الشهري الإضافي المتوقع.
3. خطة أسبوع بأسبوع لمدة شهر: استرجاع المنتهين، التحصيل، الترقية لباقة أعلى، التسويق في محيط البرج، وأي إصلاح فني مطلوب قبل التسويق.
4. هدف واقعي بعد 3 أشهر: عدد المشتركين والربح الشهري.
5. هل يستحق سكتراً إضافياً أو استثماراً؟ احسب فترة الاسترداد إن أمكن.
6. رسالة واتساب جاهزة لمشتركي هذا البرج المنتهين، وأخرى للتسويق في الحي.`;
}

// ---------- عرض Markdown بسيط وآمن (النص يُهرَّب أولاً) ----------
function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function inline(s: string) {
  return escapeHtml(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white">$1</strong>')
    .replace(/`([^`]+)`/g, '<code class="px-1 rounded bg-slate-800 text-cyan-300 font-mono text-[0.85em]">$1</code>');
}
function renderMarkdown(md: string): string {
  const out: string[] = [];
  let list: 'ul' | 'ol' | null = null;
  let table: string[][] | null = null;
  const closeList = () => { if (list) { out.push(`</${list}>`); list = null; } };
  const flushTable = () => {
    if (!table) return;
    const rows = table.filter(r => !r.every(c => /^:?-{2,}:?$/.test(c.trim())));
    out.push('<div class="overflow-x-auto my-2"><table class="w-full text-xs border border-slate-700">');
    rows.forEach((r, i) => {
      const tag = i === 0 ? 'th' : 'td';
      out.push(`<tr class="${i === 0 ? 'bg-slate-800' : 'border-t border-slate-800'}">${r.map(c => `<${tag} class="px-2 py-1 text-right">${inline(c.trim())}</${tag}>`).join('')}</tr>`);
    });
    out.push('</table></div>');
    table = null;
  };
  for (const raw of md.split('\n')) {
    const line = raw.trimEnd();
    if (/^\s*\|.*\|\s*$/.test(line)) {
      closeList();
      (table ||= []).push(line.trim().slice(1, -1).split('|'));
      continue;
    }
    flushTable();
    let m: RegExpMatchArray | null;
    if ((m = line.match(/^(#{1,4})\s+(.*)$/))) {
      closeList();
      const size = m[1].length <= 2 ? 'text-base' : 'text-sm';
      out.push(`<h3 class="${size} font-bold text-cyan-300 mt-3 mb-1">${inline(m[2])}</h3>`);
    } else if ((m = line.match(/^\s*[-*•]\s+(.*)$/))) {
      if (list !== 'ul') { closeList(); out.push('<ul class="list-disc pr-5 space-y-1 my-1">'); list = 'ul'; }
      out.push(`<li>${inline(m[1])}</li>`);
    } else if ((m = line.match(/^\s*\d+[.)]\s+(.*)$/))) {
      if (list !== 'ol') { closeList(); out.push('<ol class="list-decimal pr-5 space-y-1 my-1">'); list = 'ol'; }
      out.push(`<li>${inline(m[1])}</li>`);
    } else if (!line.trim()) {
      closeList();
    } else if (/^-{3,}$/.test(line.trim())) {
      closeList();
      out.push('<hr class="border-slate-700 my-3" />');
    } else {
      closeList();
      out.push(`<p class="my-1.5">${inline(line)}</p>`);
    }
  }
  closeList();
  flushTable();
  return out.join('');
}

function loadHistory(): AdvisorMessage[] {
  try {
    const v = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    return Array.isArray(v) ? v.filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string') : [];
  } catch {
    return [];
  }
}

export const AdvisorView: React.FC<AdvisorViewProps> = (props) => {
  const [messages, setMessages] = useState<AdvisorMessage[]>(loadHistory);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [thinking, setThinking] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [showData, setShowData] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState('');
  const towerNames = useMemo(() => {
    const names = new Set<string>();
    props.towers.forEach(t => normTower(t.name) && names.add(normTower(t.name)));
    props.subscribers.forEach(s => normTower(s.towerName) && names.add(normTower(s.towerName)));
    return [...names].filter(n => n !== NO_TOWER_LABEL).sort((a, b) => a.localeCompare(b, 'ar'));
  }, [props.towers, props.subscribers]);
  const [growthTower, setGrowthTower] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const provider: AdvisorProvider = props.settings.advisorProvider || 'auto';
  const isAdmin = props.currentUser.role === 'admin';
  const [engineStatus, setEngineStatus] = useState<{ gemini: boolean; workers: boolean; claude: boolean } | null>(null);
  useEffect(() => {
    if (PREVIEW_MODE) return;
    apiRequest<{ gemini: boolean; workers: boolean; claude: boolean }>('/api/ai/status').then(setEngineStatus).catch(() => undefined);
  }, []);

  const snapshot = useMemo(() => buildBusinessSnapshot(props), [props.subscribers, props.payments, props.tickets, props.providers, props.towers, props.settings, props.expenses]);

  useEffect(() => {
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(messages.slice(-40))); } catch { /* التخزين غير متاح */ }
  }, [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, thinking]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    setError(null);
    setInput('');
    const history: AdvisorMessage[] = [...messages, { role: 'user', content: q }];
    setMessages([...history, { role: 'assistant', content: '' }]);
    setBusy(true);
    setThinking('');
    const controller = new AbortController();
    abortRef.current = controller;
    let answer = '';
    try {
      const res = await askAdvisor(history, snapshot, {
        onThinking: t => setThinking(prev => (prev + t).slice(-600)),
        onText: t => {
          answer += t;
          setThinking('');
          setMessages([...history, { role: 'assistant', content: answer }]);
        },
      }, controller.signal, provider);
      if (res.remaining !== null) setRemaining(res.remaining);
      const via = res.provider ? `${PROVIDER_LABELS[res.provider] || res.provider}${res.model ? ` • ${res.model}` : ''}` : undefined;
      if (answer) setMessages([...history, { role: 'assistant', content: answer, via }]);
      if (res.stopReason === 'refusal' && !answer) {
        setError('لم يتمكن المستشار من الإجابة على هذا السؤال. أعد صياغته.');
      } else if (res.stopReason === 'max_tokens') {
        setError('الإجابة طويلة جداً وتوقفت قبل النهاية. اطلب «أكمل» أو اسأل بشكل أدق.');
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError((e as Error).message);
    } finally {
      setBusy(false);
      setThinking('');
      abortRef.current = null;
      // لا نترك فقاعة إجابة فارغة في المحادثة
      setMessages(prev => (prev.length && prev[prev.length - 1].role === 'assistant' && !prev[prev.length - 1].content.trim())
        ? prev.slice(0, -2)
        : prev);
      if (!answer) setInput(q);
    }
  };

  const stop = () => abortRef.current?.abort();

  return (
    <div className="space-y-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-cyan-600 to-indigo-600 text-white flex items-center justify-center">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">المستشار الذكي</h1>
            <p className="text-xs text-slate-400 mt-0.5">خبير تسويق وتسعير وتطوير أبراج، يقرأ أرقام شبكتك ويفكر بعمق قبل الإجابة</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <label className="flex items-center gap-1.5 bg-slate-800 rounded-lg px-2 py-1 text-slate-300">
            <span>المحرك:</span>
            <select
              id="advisor-engine"
              value={provider}
              disabled={!isAdmin || busy}
              title={isAdmin ? 'اختيار محرك الذكاء الاصطناعي' : 'المدير فقط يغيّر المحرك'}
              onChange={e => props.onChangeProvider(e.target.value as AdvisorProvider)}
              className="bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-white focus:outline-none focus:border-cyan-500 disabled:opacity-70"
            >
              {ENGINE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          {engineStatus && (
            <span className="flex items-center gap-2 text-slate-400" title="المحركات المضبوطة على الخادم">
              {(['gemini', 'workers', 'claude'] as const).map(k => (
                <span key={k} className="flex items-center gap-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${engineStatus[k] ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                  {PROVIDER_LABELS[k]}
                </span>
              ))}
            </span>
          )}
          <button type="button" onClick={() => { setNotesDraft(props.settings.advisorNotes || ''); setShowNotes(true); }} className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer ${props.settings.advisorNotes?.trim() ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-amber-900/50 hover:bg-amber-900 text-amber-200 border border-amber-800'}`}>
            <NotebookPen className="w-3.5 h-3.5" /> معلومات عملي
          </button>
          <button type="button" onClick={() => setShowData(true)} className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center gap-1 cursor-pointer">
            <Eye className="w-3.5 h-3.5" /> البيانات المرسلة
          </button>
          {messages.length > 0 && !busy && (
            <button type="button" onClick={() => { setMessages([]); setError(null); }} className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center gap-1 cursor-pointer">
              <Trash2 className="w-3.5 h-3.5" /> محادثة جديدة
            </button>
          )}
        </div>
      </div>

      {PREVIEW_MODE && (
        <div className="bg-amber-950/40 border border-amber-800 rounded-2xl p-3 text-xs text-amber-200 flex gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" /> المستشار يعمل فقط في النسخة المنشورة على الخادم، وليس في وضع المعاينة.
        </div>
      )}

      {towerNames.length > 0 && (
        <div className="bg-gradient-to-l from-indigo-950/60 to-slate-900 border border-indigo-900/60 rounded-2xl p-3 flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="flex items-center gap-2 text-sm font-bold text-indigo-200 flex-shrink-0">
            <Rocket className="w-4 h-4" /> خطة رفع برج
          </div>
          <select
            id="advisor-growth-tower"
            value={growthTower}
            onChange={e => setGrowthTower(e.target.value)}
            className="flex-1 min-w-0 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
          >
            <option value="">اختر البرج…</option>
            {towerNames.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <button
            type="button"
            disabled={!growthTower || busy || PREVIEW_MODE}
            onClick={() => send(towerGrowthPrompt(growthTower))}
            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-bold cursor-pointer"
          >
            حلّل وارفع هذا البرج
          </button>
        </div>
      )}

      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl flex flex-col min-h-[55vh]">
        <div className="flex-1 p-4 sm:p-5 space-y-4 overflow-y-auto">
          {messages.length === 0 && (
            <div className="space-y-4">
              <div className="flex items-start gap-2 text-xs text-slate-400 bg-slate-950/60 border border-slate-800 rounded-xl p-3">
                <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                <span>يُرسَل للمستشار ملخص أرقام فقط (أبراج، باقات، أسعار، ديون، مقبوضات). لا تُرسل أسماء المشتركين أو هواتفهم أو كلمات المرور.</span>
              </div>
              <p className="text-sm text-slate-300 font-semibold">اقتراحات للبدء:</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {SUGGESTIONS.map(s => (
                  <button key={s} type="button" onClick={() => send(s)} disabled={busy || PREVIEW_MODE}
                    className="text-right text-xs leading-relaxed p-3 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-cyan-700 hover:bg-slate-800/60 text-slate-200 cursor-pointer disabled:opacity-50">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            m.role === 'user' ? (
              <div key={i} className="flex justify-start">
                <div className="max-w-[85%] bg-cyan-700/30 border border-cyan-800 text-cyan-50 rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm whitespace-pre-wrap">{m.content}</div>
              </div>
            ) : (
              <div key={i} className="flex justify-end">
                <div className="w-full max-w-[95%] bg-slate-950/70 border border-slate-800 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-slate-200 leading-relaxed">
                  {m.content
                    ? (
                      <>
                        <div dangerouslySetInnerHTML={{ __html: renderMarkdown(m.content) }} />
                        {m.via && <div className="mt-2 pt-1.5 border-t border-slate-800 text-[10px] text-slate-500">أجاب: {m.via}</div>}
                      </>
                    )
                    : (
                      <div className="flex items-start gap-2 text-slate-400 text-xs">
                        <Brain className="w-4 h-4 text-indigo-400 animate-pulse flex-shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <div className="font-semibold text-indigo-300">المستشار يفكر ويحلل أرقامك…</div>
                          {thinking && <div className="mt-1 text-[11px] text-slate-500 line-clamp-3 whitespace-pre-wrap">{thinking}</div>}
                        </div>
                      </div>
                    )}
                </div>
              </div>
            )
          ))}
          {error && (
            <div role="alert" className="bg-rose-950/50 border border-rose-800 rounded-xl p-3 text-xs text-rose-200 flex gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <form
          onSubmit={e => { e.preventDefault(); void send(input); }}
          className="border-t border-slate-800 p-3 flex items-end gap-2"
        >
          <textarea
            id="advisor-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(input); } }}
            rows={2}
            placeholder="اسأل عن التسويق، الأسعار، الأبراج، التحصيل… (Enter للإرسال، Shift+Enter لسطر جديد)"
            disabled={PREVIEW_MODE}
            className="flex-1 resize-none bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
          {busy ? (
            <button type="button" onClick={stop} className="h-10 px-4 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer">
              <Square className="w-3.5 h-3.5" /> إيقاف
            </button>
          ) : (
            <button type="submit" disabled={!input.trim() || PREVIEW_MODE} className="h-10 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer">
              <Send className="w-3.5 h-3.5" /> إرسال
            </button>
          )}
        </form>
        {remaining !== null && (
          <p className="px-4 pb-2 text-[10px] text-slate-500">متبقٍ لك اليوم: {remaining} سؤالاً</p>
        )}
      </div>

      {showNotes && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm" onClick={() => setShowNotes(false)}>
          <div role="dialog" aria-modal="true" className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800">
              <h2 className="text-sm font-bold text-white">معلومات عملي (يقرأها المستشار مع كل سؤال)</h2>
              <button type="button" onClick={() => setShowNotes(false)} className="text-slate-400 hover:text-white cursor-pointer" aria-label="إغلاق"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-3 overflow-auto">
              <p className="text-xs text-slate-400 leading-relaxed">
                كلما عرف المستشار أكثر عن عملك، صارت نصائحه أدق. اكتب مثلاً: كلفة كل برج شهرياً (إيجار، مولد، كهرباء، صيانة)،
                سعة كل برج وعدد السكترات، أسعار المنافسين والفايبر في المنطقة، عدد العاملين ورواتبهم، ميزانية التسويق، وأهدافك
                (مثلاً: 250 مشتركاً نهاية السنة). <span className="text-amber-300">لا تكتب أسماء أو هواتف مشتركين.</span>
              </p>
              <textarea
                id="advisor-notes"
                value={notesDraft}
                onChange={e => setNotesDraft(e.target.value.slice(0, ADVISOR_NOTES_MAX))}
                readOnly={!isAdmin}
                rows={12}
                placeholder={'برج الرينج: إيجار 50,000 + مولد 75,000 شهرياً، سكترين، السعة تقريباً 60 مشترك\nالفايبر وصل حي الشهداء بسعر 35,000\nالهدف: 250 مشترك و 3 ملايين ربح شهري نهاية السنة'}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-white leading-relaxed focus:outline-none focus:border-cyan-500"
              />
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span>{notesDraft.length} / {ADVISOR_NOTES_MAX}</span>
                {isAdmin
                  ? (
                    <button type="button" onClick={() => { props.onSaveNotes(notesDraft.trim()); setShowNotes(false); }} className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold cursor-pointer">
                      حفظ
                    </button>
                  )
                  : <span>المدير فقط يعدّل هذه المعلومات</span>}
              </div>
            </div>
          </div>
        </div>
      )}

      {showData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm" onClick={() => setShowData(false)}>
          <div role="dialog" aria-modal="true" className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800">
              <h2 className="text-sm font-bold text-white">ما يراه المستشار (بدون بيانات شخصية)</h2>
              <button type="button" onClick={() => setShowData(false)} className="text-slate-400 hover:text-white cursor-pointer" aria-label="إغلاق"><X className="w-4 h-4" /></button>
            </div>
            <pre className="p-5 overflow-auto text-[11px] leading-relaxed text-slate-300 whitespace-pre-wrap font-sans">{snapshot}</pre>
          </div>
        </div>
      )}
    </div>
  );
};
