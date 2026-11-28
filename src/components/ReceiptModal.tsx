import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Printer, Wifi } from 'lucide-react';
import { useEscapeKey } from './ui/useEscapeKey';
import { BackButton } from './ui/BackButton';
import type { PaymentRecord, Subscriber, SystemSettings } from '../types/isp';
import { todayStr } from '../utils/dates';
import { buildReceipt, type ReceiptData } from '../utils/receipt';

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  subscriber: Subscriber | null;
  settings: SystemSettings;
  /** سجل الدفعة (المصدر الأساسي: المبلغ والطريقة والعرض والمتبقي) */
  payment?: PaymentRecord;
  customAmount?: number;
}

type Paper = 80 | 58;
interface Prefs { paper: Paper; ads: boolean }
const PREFS_KEY = 'sas_plus_receipt_prefs_v1';
const loadPrefs = (): Prefs => {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
    return { paper: p.paper === 58 ? 58 : 80, ads: p.ads !== false };
  } catch { return { paper: 80, ads: true }; }
};

// الغلاف يضمن استدعاء الـ hooks دائماً بنفس الترتيب (قواعد React)
export const ReceiptModal: React.FC<ReceiptModalProps> = (props) =>
  props.isOpen && props.subscriber ? <ReceiptModalInner {...props} subscriber={props.subscriber} /> : null;

const ReceiptModalInner: React.FC<ReceiptModalProps & { subscriber: Subscriber }> = ({ onClose, subscriber, settings, payment, customAmount }) => {
  useEscapeKey(onClose);
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const setPref = (p: Partial<Prefs>) => setPrefs(prev => {
    const next = { ...prev, ...p };
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(next)); } catch { /* التخزين غير متاح */ }
    return next;
  });
  const data = useMemo(
    () => buildReceipt(subscriber, payment, settings, { today: todayStr(), customAmount, showAds: prefs.ads }),
    [subscriber, payment, settings, customAmount, prefs.ads],
  );

  // الطباعة: يُطبع البون وحده بعرض ورق الطابعة الحرارية
  const handlePrint = () => {
    const style = document.createElement('style');
    style.textContent = `@page { size: ${prefs.paper}mm auto; margin: 0; }`;
    document.head.appendChild(style);
    document.body.classList.add('receipt-printing');
    const done = () => {
      document.body.classList.remove('receipt-printing');
      style.remove();
      window.removeEventListener('afterprint', done);
    };
    window.addEventListener('afterprint', done);
    window.print();
  };
  useEffect(() => () => document.body.classList.remove('receipt-printing'), []);

  const chip = (on: boolean) => `h-10 px-3 rounded-xl text-sm font-semibold cursor-pointer ${on ? 'bg-cyan-500/20 text-cyan-100 ring-1 ring-cyan-400/50' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`;

  return (
    <div className="app-overlay fixed inset-0 z-50 flex items-start sm:items-center justify-center p-3 sm:p-4 overflow-y-auto" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="طباعة بون القبض" className="bg-slate-900 rounded-2xl w-full max-w-md overflow-hidden my-4" onClick={e => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between gap-2">
          <h2 className="text-base font-bold text-white">بون القبض</h2>
          <BackButton onClick={onClose} />
        </div>

        <div className="px-4 py-3 border-b border-slate-700 flex flex-wrap items-center gap-2">
          <span className="text-sm text-slate-400">عرض الورق:</span>
          <button type="button" onClick={() => setPref({ paper: 80 })} className={chip(prefs.paper === 80)} aria-pressed={prefs.paper === 80}>80 مم</button>
          <button type="button" onClick={() => setPref({ paper: 58 })} className={chip(prefs.paper === 58)} aria-pressed={prefs.paper === 58}>58 مم</button>
          <label className="ms-auto flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
            <input type="checkbox" checked={prefs.ads} onChange={e => setPref({ ads: e.target.checked })} className="w-4 h-4 accent-cyan-500" />
            العروض والإعلان
          </label>
        </div>

        {/* معاينة بحجم الورق الحقيقي */}
        <div className="bg-slate-950 px-3 py-6 flex justify-center overflow-x-auto">
          <div className="receipt-paper-preview">
            <ThermalReceipt data={data} settings={settings} paper={prefs.paper} />
          </div>
        </div>

        <div className="p-3 border-t border-slate-700">
          <button type="button" onClick={handlePrint} className="w-full h-12 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-base font-bold flex items-center justify-center gap-2 cursor-pointer">
            <Printer className="w-5 h-5" /> اطبع البون
          </button>
          <p className="text-xs text-slate-400 text-center mt-2">في نافذة الطباعة اختر الطابعة الحرارية، وأوقف «الرأس والتذييل» إن ظهرا.</p>
        </div>
      </div>

      {/* نسخة الطباعة: خارج النافذة حتى لا يُطبع غيرها */}
      {createPortal(
        <div className="receipt-print" dir="rtl">
          <ThermalReceipt data={data} settings={settings} paper={prefs.paper} />
        </div>,
        document.body,
      )}
    </div>
  );
};

const Row: React.FC<{ label: string; children: React.ReactNode; strong?: boolean; ltr?: boolean }> = ({ label, children, strong, ltr }) => (
  <div className={`thermal-row ${strong ? 'thermal-strong' : ''}`}>
    <span>{label}</span>
    <span dir={ltr ? 'ltr' : undefined} className="thermal-val">{children}</span>
  </div>
);

/** البون نفسه: أسود على أبيض، خطوط عريضة، فواصل متقطعة (مناسب للطابعات الحرارية) */
export const ThermalReceipt: React.FC<{ data: ReceiptData; settings: SystemSettings; paper: Paper }> = ({ data: d, settings, paper }) => (
  <div className={`thermal ${paper === 58 ? 'thermal-58' : 'thermal-80'}`}>
    <div className="thermal-center">
      <div className="thermal-logo"><Wifi /></div>
      <div className="thermal-brand">{settings.ispName}</div>
      <div className="thermal-sub">خدمات الإنترنت اللاسلكي</div>
      {settings.address && <div className="thermal-sub">{settings.address}</div>}
      {settings.contactPhone && <div className="thermal-sub">هاتف وواتساب: <span dir="ltr" className="thermal-num">{settings.contactPhone}</span></div>}
    </div>

    <div className="thermal-title">وصل قبض</div>
    <Row label="رقم الوصل" ltr><span className="thermal-num">{d.number}</span></Row>
    <Row label="التاريخ" ltr><span className="thermal-num">{d.date} {d.time}</span></Row>

    <hr className="thermal-hr" />
    <Row label="المشترك">{d.customer.name}</Row>
    {d.customer.phone && <Row label="الهاتف" ltr><span className="thermal-num">{d.customer.phone}</span></Row>}
    <Row label="اسم المستخدم" ltr><span className="thermal-num">{d.customer.username}</span></Row>
    {d.customer.tower && <Row label="البرج">{d.customer.tower}</Row>}

    <hr className="thermal-hr" />
    <Row label="البيان" strong>{d.purpose}</Row>
    <Row label="الباقة">{d.plan}{d.provider ? ` • ${d.provider}` : ''}</Row>
    <Row label="سعر الشهر">{d.unitPrice}</Row>
    {d.months && <Row label="المدة">{d.months}</Row>}
    {d.freeMonths && <Row label="أشهر مجانية (هدية)">{d.freeMonths}</Row>}
    {d.bonusDays && <Row label="أيام مكافأة الدعوة">{d.bonusDays}</Row>}
    {d.promoName && <Row label="العرض">{d.promoName}</Row>}
    {d.discount && <Row label="قيمة الخصم">{d.discount}</Row>}

    <div className="thermal-total">
      <span>المبلغ المستلم</span>
      <span className="thermal-num">{d.paid}</span>
    </div>
    {d.method && <Row label="طريقة الدفع">{d.method}</Row>}
    <Row label="المتبقي بذمتك" strong>{d.remainingText}</Row>
    <Row label="صالح لغاية" strong ltr><span className="thermal-num">{d.validUntil}</span></Row>
    {d.collectedBy && <Row label="المستلم">{d.collectedBy}</Row>}
    {d.notes && <div className="thermal-note">ملاحظة: {d.notes}</div>}

    <div className="thermal-box">
      جدّد قبل <span dir="ltr" className="thermal-num">{d.validUntil}</span> لتبقى متصلاً بلا انقطاع.
      {settings.contactPhone && <> للتجديد والدعم الفني راسلنا على واتساب.</>}
    </div>

    {d.ads.length > 0 && (
      <>
        <div className="thermal-ad-head">★ عروضنا لك ★</div>
        <ul className="thermal-ads">
          {d.ads.map(a => <li key={a}>{a}</li>)}
        </ul>
      </>
    )}

    <hr className="thermal-hr" />
    <div className="thermal-center thermal-foot">
      {settings.whatsappFooter && <div>{settings.whatsappFooter}</div>}
      <div className="thermal-strong">شكراً لثقتكم بنا</div>
      <div>احتفظ بهذا الوصل لحين انتهاء الاشتراك</div>
    </div>
    <div className="thermal-cut" aria-hidden="true">✂ - - - - - - - - - - - - - -</div>
  </div>
);
