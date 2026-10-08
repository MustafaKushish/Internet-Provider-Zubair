import React, { useState, useEffect } from 'react';
import { useEscapeKey } from './ui/useEscapeKey';
import { TowerPoint, Subscriber } from '../types/isp';
import { TowerControl, X, Save, AlertCircle, MapPin, Network, FileText, CheckCircle2 } from 'lucide-react';

interface TowerModalProps {
  isOpen: boolean;
  onClose: () => void;
  towerToEdit?: TowerPoint | null;
  subscribers: Subscriber[];
  onSave: (tower: TowerPoint, oldName?: string) => void;
}

// الغلاف يضمن استدعاء الـ hooks دائماً بنفس الترتيب (قواعد React)، ويعيد ضبط الحقول عند كل فتح
export const TowerModal: React.FC<TowerModalProps> = (props) =>
  props.isOpen ? <TowerModalInner {...props} /> : null;

const TowerModalInner: React.FC<TowerModalProps> = ({
  isOpen,
  onClose,
  towerToEdit,
  subscribers,
  onSave,
}) => {
  useEscapeKey(onClose);

  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [ipRange, setIpRange] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (towerToEdit) {
      setName(towerToEdit.name);
      setLocation(towerToEdit.location || '');
      setIpRange(towerToEdit.ipRange || '');
      setNotes(towerToEdit.notes || '');
    } else {
      setName('');
      setLocation('الزبير - البصرة');
      setIpRange('');
      setNotes('');
    }
    setError(null);
  }, [towerToEdit, isOpen]);

  // Count how many subscribers are on this tower
  const linkedSubscribersCount = towerToEdit
    ? subscribers.filter(s => s.towerName?.trim() === towerToEdit.name.trim()).length
    : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('يرجى إدخال اسم البرج أو نقطة البث أو الكابينة.');
      return;
    }

    const updatedTower: TowerPoint = {
      id: towerToEdit ? towerToEdit.id : `tower_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: name.trim(),
      location: location.trim() || undefined,
      ipRange: ipRange.trim() || undefined,
      notes: notes.trim() || undefined,
    };

    onSave(updatedTower, towerToEdit ? towerToEdit.name : undefined);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-800/80 border-b border-slate-700/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-600/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center">
              <TowerControl className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                {towerToEdit ? `تعديل بيانات البرج: ${towerToEdit.name}` : 'إضافة برج أو نقطة توزيع جديدة'}
              </h2>
              <p className="text-xs text-slate-400">
                شبكة الزبير والبصرة • تنظيم توزيع المشتركين والسكترات
              </p>
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
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto text-xs flex-1">
          {error && (
            <div className="bg-rose-950/60 border border-rose-800 p-3 rounded-xl text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {towerToEdit && (
            <div className="bg-cyan-950/40 border border-cyan-800/60 rounded-xl p-3 text-cyan-200 space-y-1">
              <div className="flex items-center gap-2 font-bold text-cyan-300">
                <CheckCircle2 className="w-4 h-4" />
                <span>ملاحظة الربط التلقائي للمشتركين:</span>
              </div>
              <p className="text-[11px] text-cyan-300/80 leading-relaxed">
                يوجد حالياً <strong className="text-white font-bold">{linkedSubscribersCount} مشترك</strong> مربوطين بهذا البرج. عند تغيير اسم البرج سيتم تحديث وتعديل اسم البرج تلقائياً في سجلات جميع هؤلاء المشتركين بدون أي خلل!
              </p>
            </div>
          )}

          {/* Tower Name */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1">
              اسم البرج / النقطة / الكابينة <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <TowerControl className="w-4 h-4 text-slate-500 absolute right-3 top-2.5" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثال: برج الزبير الرئيسي - سكتر 1"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pr-9 pl-3 py-2 text-white focus:outline-none focus:border-cyan-500 text-xs"
              />
            </div>
            <span className="text-[10px] text-slate-500 mt-0.5 block">
              الاسم الذي يظهر في قائمة المشتركين واختيار النقطة
            </span>
          </div>

          {/* Location */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1">
              الموقع الجغرافي / المنطقة في الزبير
            </label>
            <div className="relative">
              <MapPin className="w-4 h-4 text-slate-500 absolute right-3 top-2.5" />
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="مثال: سوق الزبير - شارع الجمهورية أو محلة الكوت"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pr-9 pl-3 py-2 text-white focus:outline-none focus:border-cyan-500 text-xs"
              />
            </div>
          </div>

          {/* IP Range / Device info */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1">
              نطاق الآي بي أو جهاز التوزيع (IP Range / Routerboard)
            </label>
            <div className="relative">
              <Network className="w-4 h-4 text-slate-500 absolute right-3 top-2.5" />
              <input
                type="text"
                value={ipRange}
                onChange={(e) => setIpRange(e.target.value)}
                placeholder="مثال: 10.10.5.0/24 أو MikroTik CCR1009"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pr-9 pl-3 py-2 text-white font-mono focus:outline-none focus:border-cyan-500 text-xs"
                dir="ltr"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1">
              ملاحظات وتفاصيل التغطية أو الصيانة
            </label>
            <div className="relative">
              <FileText className="w-4 h-4 text-slate-500 absolute right-3 top-2.5" />
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="ملاحظات حول سكترات البث، ارتفاع البرج، أو الكابينات الضوئية الموصولة..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pr-9 pl-3 py-2 text-white focus:outline-none focus:border-cyan-500 text-xs leading-relaxed"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl flex items-center gap-2 shadow-lg shadow-cyan-600/30 transition cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{towerToEdit ? 'حفظ التعديلات' : 'إضافة البرج'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
