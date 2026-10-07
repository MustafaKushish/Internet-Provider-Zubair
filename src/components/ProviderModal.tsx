import React, { useState, useEffect } from 'react';
import { UpstreamProvider, ProviderPlan, Subscriber } from '../types/isp';
import { Server, X, Plus, Edit2, Trash2, Check, AlertCircle, Phone, FileText, Gauge, DollarSign } from 'lucide-react';

interface ProviderModalProps {
  isOpen: boolean;
  onClose: () => void;
  providerToEdit: UpstreamProvider | null;
  subscribers: Subscriber[];
  onSave: (provider: UpstreamProvider, oldName?: string) => void;
}

// الغلاف يضمن استدعاء الـ hooks دائماً بنفس الترتيب (قواعد React)، ويعيد ضبط الحقول عند كل فتح
export const ProviderModal: React.FC<ProviderModalProps> = (props) =>
  props.isOpen ? <ProviderModalInner {...props} /> : null;

const ProviderModalInner: React.FC<ProviderModalProps> = ({
  isOpen,
  onClose,
  providerToEdit,
  subscribers,
  onSave,
}) => {

  const isEditing = Boolean(providerToEdit);
  const oldName = providerToEdit?.name;

  const [name, setName] = useState(providerToEdit?.name || '');
  const [contact, setContact] = useState(providerToEdit?.contact || '');
  const [plans, setPlans] = useState<ProviderPlan[]>(
    providerToEdit?.plans ? JSON.parse(JSON.stringify(providerToEdit.plans)) : [
      { id: `plan_${Date.now()}_1`, name: 'ستاندرد (Standard)', defaultCost: 24000, defaultSalePrice: 35000, speed: '25 Mbps' },
      { id: `plan_${Date.now()}_2`, name: 'أكتف (Active)', defaultCost: 31000, defaultSalePrice: 45000, speed: '40 Mbps' },
    ]
  );

  // New or editing plan state
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [planName, setPlanName] = useState('');
  const [planSpeed, setPlanSpeed] = useState('');
  const [planCost, setPlanCost] = useState<number>(24000);
  const [planSale, setPlanSale] = useState<number>(35000);
  const [showPlanForm, setShowPlanForm] = useState(false);

  const [error, setError] = useState<string | null>(null);

  // Number of Zubair subscribers currently linked to this provider
  const affectedSubscribers = oldName
    ? subscribers.filter(s => s.upstreamProvider === oldName)
    : [];

  useEffect(() => {
    if (providerToEdit) {
      setName(providerToEdit.name);
      setContact(providerToEdit.contact || '');
      setPlans(JSON.parse(JSON.stringify(providerToEdit.plans || [])));
    } else {
      setName('');
      setContact('');
      setPlans([
        { id: `plan_${Date.now()}_1`, name: 'ستاندرد (Standard)', defaultCost: 24000, defaultSalePrice: 35000, speed: '25 Mbps' },
        { id: `plan_${Date.now()}_2`, name: 'أكتف (Active)', defaultCost: 31000, defaultSalePrice: 45000, speed: '40 Mbps' },
      ]);
    }
    setShowPlanForm(false);
    setEditingPlanId(null);
    setError(null);
  }, [providerToEdit, isOpen]);

  const handleStartEditPlan = (plan: ProviderPlan) => {
    setEditingPlanId(plan.id);
    setPlanName(plan.name);
    setPlanSpeed(plan.speed || '');
    setPlanCost(plan.defaultCost);
    setPlanSale(plan.defaultSalePrice);
    setShowPlanForm(true);
  };

  const handleStartAddPlan = () => {
    setEditingPlanId(null);
    setPlanName('');
    setPlanSpeed('30 Mbps');
    setPlanCost(25000);
    setPlanSale(35000);
    setShowPlanForm(true);
  };

  const handleSavePlanItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!planName.trim()) return;

    if (editingPlanId) {
      setPlans(prev => prev.map(p => {
        if (p.id === editingPlanId) {
          return {
            ...p,
            name: planName.trim(),
            speed: planSpeed.trim(),
            defaultCost: Number(planCost) || 0,
            defaultSalePrice: Number(planSale) || 0,
          };
        }
        return p;
      }));
    } else {
      const newPlan: ProviderPlan = {
        id: `plan_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name: planName.trim(),
        speed: planSpeed.trim(),
        defaultCost: Number(planCost) || 0,
        defaultSalePrice: Number(planSale) || 0,
      };
      setPlans(prev => [...prev, newPlan]);
    }

    setShowPlanForm(false);
    setEditingPlanId(null);
  };

  const handleDeletePlanItem = (id: string) => {
    if (plans.length <= 1) {
      alert('يجب الإبقاء على باقة واحدة على الأقل لهذا المزود.');
      return;
    }
    setPlans(prev => prev.filter(p => p.id !== id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('يرجى إدخال اسم المزود الرئيسي.');
      return;
    }

    if (plans.length === 0) {
      setError('يرجى إضافة باقة اشتراك واحدة على الأقل لهذا المزود.');
      return;
    }

    const updatedProvider: UpstreamProvider = {
      id: providerToEdit ? providerToEdit.id : `prov_${Date.now()}`,
      name: trimmedName,
      contact: contact.trim() || undefined,
      plans,
    };

    onSave(updatedProvider, isEditing ? oldName : undefined);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden my-6">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-850 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                {isEditing ? `تعديل وإعادة تسمية المزود: ${oldName}` : 'إضافة مزود رئيسي جديد في الزبير'}
              </h2>
              <p className="text-xs text-slate-400">
                إدارة بيانات الشركة المزودة، باقات الأسعار، وهوامش الربح
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Renaming notice if subscribers are affected */}
          {isEditing && affectedSubscribers.length > 0 && (
            <div className="bg-cyan-950/50 border border-cyan-800/80 rounded-2xl p-3.5 text-xs text-cyan-200 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
              <div>
                <strong className="block text-cyan-300 font-bold mb-0.5">
                  مرتبط بـ {affectedSubscribers.length} مشترك حالياً في قضاء الزبير
                </strong>
                <p className="text-cyan-200/90 leading-relaxed text-[11px]">
                  في حال قمت بتغيير اسم المزود أعلاه، سيتم تحديث وتعديل اسم المزود تلقائياً لجميع المشتركين الـ ({affectedSubscribers.length}) المسجلين دون أي مساس ببياناتهم أو تواريخهم.
                </p>
              </div>
            </div>
          )}

          {/* Provider Name and Contact */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                اسم المزود الرئيسي (الشركة أو المصدر) *
              </label>
              <div className="relative">
                <Server className="w-4 h-4 text-slate-500 absolute right-3 top-2.5" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثال: فاست ليد، ساس 4، إيرثلنك، فايبر الزبير..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pr-9 pl-3 py-2 text-white text-xs focus:outline-none focus:border-indigo-500 font-semibold"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                رقم هاتف المزود أو الدعم الفني
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-500 absolute right-3 top-2.5" />
                <input
                  type="text"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  placeholder="مثال: 07700000000"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pr-9 pl-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-indigo-500 text-left"
                  dir="ltr"
                />
              </div>
            </div>
          </div>

          {/* Plans Section */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Gauge className="w-4 h-4 text-indigo-400" />
                  <span>باقات الإنترنت التابعة لهذا المزود ({plans.length})</span>
                </h3>
                <span className="text-[10px] text-slate-400">
                  حدد سعر الشراء (الجملة) وسعر البيع لحساب الأرباح الصافية تلقائياً
                </span>
              </div>

              {!showPlanForm && (
                <button
                  type="button"
                  onClick={handleStartAddPlan}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition cursor-pointer shadow-md"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ باقة جديدة</span>
                </button>
              )}
            </div>

            {/* Inline Plan Add / Edit Form */}
            {showPlanForm && (
              <div className="bg-slate-900 border border-indigo-700/60 rounded-xl p-3.5 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-xs font-bold text-indigo-300">
                    {editingPlanId ? 'تعديل بيانات الباقة' : 'إضافة باقة جديدة'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowPlanForm(false)}
                    className="text-slate-400 hover:text-white text-xs"
                  >
                    إلغاء
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">اسم الباقة</label>
                    <input
                      type="text"
                      required
                      value={planName}
                      onChange={(e) => setPlanName(e.target.value)}
                      placeholder="مثال: توربو (Turbo) أو VIP"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">السرعة التقديرية</label>
                    <input
                      type="text"
                      value={planSpeed}
                      onChange={(e) => setPlanSpeed(e.target.value)}
                      placeholder="مثال: 50 Mbps"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono"
                      dir="ltr"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">سعر الجملة (كلفة المزود د.ع)</label>
                    <input
                      type="number"
                      step="1000"
                      required
                      value={planCost}
                      onChange={(e) => setPlanCost(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-amber-300 font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">سعر البيع للمشترك (د.ع)</label>
                    <input
                      type="number"
                      step="1000"
                      required
                      value={planSale}
                      onChange={(e) => setPlanSale(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-cyan-300 font-bold"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div className="text-xs text-emerald-400 font-bold">
                    الربح الصافي للباقة: +{(planSale - planCost).toLocaleString()} د.ع
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowPlanForm(false)}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs cursor-pointer"
                    >
                      إلغاء
                    </button>
                    <button
                      type="button"
                      onClick={handleSavePlanItem}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold cursor-pointer"
                    >
                      حفظ الباقة
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Plans List Table */}
            <div className="overflow-x-auto max-h-52 border border-slate-800 rounded-xl">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-800/80 text-slate-300 sticky top-0">
                  <tr>
                    <th className="p-2">الباقة</th>
                    <th className="p-2">السرعة</th>
                    <th className="p-2">الجملة (الكلفة)</th>
                    <th className="p-2">البيع للمشترك</th>
                    <th className="p-2">صافي الربح</th>
                    <th className="p-2 text-center">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-200">
                  {plans.map((pl) => {
                    const profit = pl.defaultSalePrice - pl.defaultCost;
                    return (
                      <tr key={pl.id} className="hover:bg-slate-900/60">
                        <td className="p-2 font-bold text-white">{pl.name}</td>
                        <td className="p-2 font-mono text-slate-300" dir="ltr">{pl.speed || '-'}</td>
                        <td className="p-2 text-amber-300 font-mono">{pl.defaultCost.toLocaleString()} د.ع</td>
                        <td className="p-2 text-cyan-300 font-mono font-bold">{pl.defaultSalePrice.toLocaleString()} د.ع</td>
                        <td className="p-2 text-emerald-400 font-mono font-bold">+{profit.toLocaleString()} د.ع</td>
                        <td className="p-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleStartEditPlan(pl)}
                              title="تعديل الباقة"
                              className="text-slate-400 hover:text-indigo-300 p-1 rounded hover:bg-slate-800 transition cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeletePlanItem(pl.id)}
                              title="حذف الباقة"
                              className="text-slate-400 hover:text-rose-400 p-1 rounded hover:bg-slate-800 transition cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {error && (
            <div className="bg-rose-950/70 border border-rose-800 p-3 rounded-xl text-rose-300 flex items-center gap-2 text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
            >
              إلغاء
            </button>

            <button
              type="submit"
              className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/30 transition cursor-pointer flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>{isEditing ? 'حفظ وتحديث المزود في الزبير' : 'إضافة المزود الجديد'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
