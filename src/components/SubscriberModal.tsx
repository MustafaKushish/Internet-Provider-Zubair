import React, { useState, useEffect } from 'react';
import { useEscapeKey } from './ui/useEscapeKey';
import { todayStr, parseLocalDate, toLocalDateStr, addMonthsToDateStr } from '../utils/dates';
import { getRemainingDebt } from '../utils/storage';
import { Subscriber, UpstreamProvider, StaffUser } from '../types/isp';
import { X, Key, Eye, EyeOff, Sparkles, Calendar, DollarSign, TowerControl, Phone, User, ShieldCheck, Wrench } from 'lucide-react';

interface SubscriberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (sub: Partial<Subscriber>) => void;
  subscriberToEdit?: Subscriber | null;
  providers: UpstreamProvider[];
  towers: string[];
  currentUser?: StaffUser;
  onOpenManageProviders?: () => void;
}

export const SubscriberModal: React.FC<SubscriberModalProps> = ({
  isOpen,
  onClose,
  onSave,
  subscriberToEdit,
  providers,
  towers,
  currentUser,
  onOpenManageProviders,
}) => {
  useEscapeKey(onClose, isOpen);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [upstreamProvider, setUpstreamProvider] = useState('');
  const [planName, setPlanName] = useState('');
  const [costPrice, setCostPrice] = useState<number>(24000);
  const [salePrice, setSalePrice] = useState<number>(35000);
  const [paidAmount, setPaidAmount] = useState<number>(35000);
  const [startDate, setStartDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [towerName, setTowerName] = useState('');
  const [ipAddress, setIpAddress] = useState('');
  const [macAddress, setMacAddress] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');

  // Prepopulate when editing or opening
  useEffect(() => {
    if (subscriberToEdit) {
      setName(subscriberToEdit.name);
      setPhone(subscriberToEdit.phone);
      setUsername(subscriberToEdit.username);
      setPassword(subscriberToEdit.password || '');
      setUpstreamProvider(subscriberToEdit.upstreamProvider);
      setPlanName(subscriberToEdit.planName);
      setCostPrice(subscriberToEdit.costPrice);
      setSalePrice(subscriberToEdit.salePrice);
      setPaidAmount(subscriberToEdit.paidAmount);
      setStartDate(subscriberToEdit.startDate);
      setExpiryDate(subscriberToEdit.expiryDate);
      setTowerName(subscriberToEdit.towerName);
      setIpAddress(subscriberToEdit.ipAddress || '');
      setMacAddress(subscriberToEdit.macAddress || '');
      setAddress(subscriberToEdit.address || '');
      setNotes(subscriberToEdit.notes || '');
    } else {
      // Default new subscriber
      setName('');
      setPhone('077');
      const randomUser = `user_${Math.floor(1000 + Math.random() * 9000)}`;
      setUsername(randomUser);
      setPassword(generateRandomPassword());

      const defaultProv = providers[0];
      const provName = defaultProv ? defaultProv.name : 'إيرثلنك (Earthlink)';
      setUpstreamProvider(provName);

      const defaultPlan = defaultProv?.plans[1] || defaultProv?.plans[0];
      if (defaultPlan) {
        setPlanName(defaultPlan.name);
        setCostPrice(defaultPlan.defaultCost);
        setSalePrice(defaultPlan.defaultSalePrice);
        setPaidAmount(defaultPlan.defaultSalePrice);
      } else {
        setPlanName('ستاندرد (Standard)');
        setCostPrice(24000);
        setSalePrice(35000);
        setPaidAmount(35000);
      }

      const today = todayStr();
      setStartDate(today);
      setExpiryDate(addMonthsToDateStr(today, 1));
      setTowerName('');
      setIpAddress('');
      setMacAddress('');
      setAddress('');
      setNotes('');
    }
    // يُملأ النموذج عند الفتح فقط؛ تحديثات المزامنة لا تمسح ما يكتبه المستخدم
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscriberToEdit?.id, isOpen]);

  function generateRandomPassword() {
    const chars = 'abcdefghjkmnpqrstuvwxyz23456789@#';
    let res = '';
    for (let i = 0; i < 8; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return res;
  }

  // Handle provider selection change
  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const pName = e.target.value;
    setUpstreamProvider(pName);
    const selected = providers.find(p => p.name === pName);
    if (selected && selected.plans.length > 0) {
      const plan = selected.plans[0];
      setPlanName(plan.name);
      setCostPrice(plan.defaultCost);
      setSalePrice(plan.defaultSalePrice);
      setPaidAmount(plan.defaultSalePrice);
    }
  };

  // Handle plan selection change
  const handlePlanChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const pName = e.target.value;
    setPlanName(pName);
    const currProv = providers.find(p => p.name === upstreamProvider);
    const selected = currProv?.plans.find(p => p.name === pName);
    if (selected) {
      setCostPrice(selected.defaultCost);
      setSalePrice(selected.defaultSalePrice);
      setPaidAmount(selected.defaultSalePrice);
    }
  };

  const addDaysToExpiry = (days: number) => {
    const base = parseLocalDate(startDate || todayStr());
    base.setDate(base.getDate() + days);
    setExpiryDate(toLocalDateStr(base));
  };

  const netProfit = salePrice - costPrice;
  // عند التعديل نعرض المتبقي الفعلي للدورة (يشمل الأشهر المتعددة والدين المرحّل)
  const remainingDebt = subscriberToEdit
    ? getRemainingDebt({ ...subscriberToEdit, salePrice: Number(salePrice) || 0 })
    : Math.max(0, salePrice - paidAmount);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onSave({
      id: subscriberToEdit ? subscriberToEdit.id : undefined,
      name: name.trim(),
      phone: phone.trim(),
      username: username.trim(),
      password: password.trim(),
      upstreamProvider,
      planName,
      costPrice: Number(costPrice) || 0,
      salePrice: Number(salePrice) || 0,
      paidAmount: Number(paidAmount) || 0,
      startDate,
      expiryDate,
      towerName,
      ipAddress: ipAddress.trim(),
      macAddress: macAddress.trim(),
      address: address.trim(),
      notes: notes.trim(),
      lastPaymentDate: paidAmount > 0 ? (subscriberToEdit?.lastPaymentDate || startDate) : undefined,
    });

    onClose();
  };

  if (!isOpen) return null;

  const currentProviderObj = providers.find(p => p.name === upstreamProvider) || providers[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-3xl w-full shadow-2xl overflow-hidden my-6">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-800/80 border-b border-slate-700/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-600/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>{subscriberToEdit ? (currentUser?.role === 'technician' ? 'تعديل البيانات الفنية للمشترك' : 'تعديل بيانات المشترك والاشتراك') : 'إضافة مشترك جديد للمنظومة'}</span>
                {currentUser?.role === 'technician' && (
                  <span className="bg-amber-950 text-amber-300 border border-amber-800 text-xs px-2 py-0.5 rounded font-bold">
                    صلاحية فني
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400">
                {currentUser?.role === 'technician'
                  ? 'تسجيل المشترك وربطه بالبرج، إعداد الآيبي والماك وبيانات النانو'
                  : 'تسجيل بيانات الحساب، التكاليف، أرباح الخط وتواريخ التفعيل'}
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

        {/* Modal Body Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Section 1: Basic Info */}
          <div>
            <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" />
              <span>البيانات الشخصية والاتصال</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  اسم المشترك الكامل <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثال: حيدر عمار الكناني"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  رقم الهاتف (الواتساب) <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="07701234567"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg pr-9 pl-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 text-left font-mono"
                    dir="ltr"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: ISP Credentials (Username & Password) */}
          <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-800">
            <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>بيانات تسجيل الدخول (SAS / الراوتر / PPPoE)</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  اسم المستخدم (User / PPPoE) <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <Key className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="ahmed_net1"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg pr-9 pl-3.5 py-2.5 text-sm text-cyan-300 font-mono focus:outline-none focus:border-cyan-500 text-left"
                    dir="ltr"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-300">
                    كلمة المرور (Password)
                  </label>
                  <button
                    type="button"
                    onClick={() => setPassword(generateRandomPassword())}
                    className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>توليد باسورد</span>
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="كلمة مرور الراوتر"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg pr-3 pl-10 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-cyan-500 text-left"
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-slate-400 hover:text-white absolute left-3 top-2.5 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Upstream Provider & Pricing (Wholesale vs Retail vs Profit) */}
          <div className="bg-gradient-to-br from-slate-800/80 to-slate-900 p-4 rounded-xl border border-slate-700/80">
            <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5" />
              <span>{currentUser?.role === 'technician' ? 'المزود الرئيسي والباقة المختارة' : 'المزود الرئيسي، التكلفة، البيع والربح الشهري'}</span>
            </h3>

            <div className={`grid grid-cols-1 sm:grid-cols-2 ${currentUser?.role === 'technician' ? 'md:grid-cols-2' : 'md:grid-cols-4'} gap-3`}>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-300">المزود الرئيسي</label>
                  {currentUser?.role !== 'technician' && onOpenManageProviders && (
                    <button
                      type="button"
                      onClick={onOpenManageProviders}
                      className="text-[10px] text-cyan-400 hover:text-cyan-300 hover:underline cursor-pointer"
                    >
                      تعديل المزودين
                    </button>
                  )}
                </div>
                <select
                  value={upstreamProvider}
                  onChange={handleProviderChange}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                >
                  {providers.map(p => (
                    <option key={p.id} value={p.name}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">نوع الباقة / السرعة</label>
                <select
                  value={planName}
                  onChange={handlePlanChange}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                >
                  {currentProviderObj?.plans.map(pl => (
                    <option key={pl.id} value={pl.name}>{pl.name} {pl.speed ? `(${pl.speed})` : ''}</option>
                  ))}
                  {/* Option for custom plan */}
                  <option value="باقة مخصصة">باقة مخصصة أخرى</option>
                </select>
              </div>

              {currentUser?.role !== 'technician' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      كلفة الشراء (سعر الجملة)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="1000"
                        value={costPrice}
                        onChange={(e) => setCostPrice(Number(e.target.value))}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-amber-300 font-semibold focus:outline-none focus:border-amber-500"
                      />
                      <span className="text-[10px] text-slate-400 absolute left-2 top-2.5">د.ع</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      سعر البيع للمشترك
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="1000"
                        value={salePrice}
                        onChange={(e) => setSalePrice(Number(e.target.value))}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-cyan-300 font-bold focus:outline-none focus:border-cyan-500"
                      />
                      <span className="text-[10px] text-slate-400 absolute left-2 top-2.5">د.ع</span>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Profit & Margin Indicator - Hidden for Technician */}
            {currentUser?.role !== 'technician' && (
              <div className="mt-3 pt-3 border-t border-slate-700/60 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">صافي ربحك من هذا المشترك شهرياً:</span>
                  <span className={`font-bold px-2 py-0.5 rounded ${netProfit >= 0 ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-rose-950 text-rose-400'}`}>
                    {netProfit.toLocaleString()} د.ع
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-slate-400">{subscriberToEdit ? 'المسدد لهذه الدورة:' : 'المبلغ المسدد الآن:'}</span>
                  <div className="relative w-32">
                    <input
                      type="number"
                      step="250"
                      min="0"
                      value={paidAmount}
                      onChange={(e) => setPaidAmount(Number(e.target.value))}
                      disabled={!!subscriberToEdit}
                      title={subscriberToEdit ? 'لتسجيل دفعة استخدم سجل الدفعات أو التجديد حتى يُسجَّل وصل' : undefined}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                  </div>
                  {remainingDebt > 0 ? (
                    <span className="text-rose-400 font-bold bg-rose-950/60 px-2 py-0.5 rounded border border-rose-800">
                      متبقي دين: {remainingDebt.toLocaleString()} د.ع
                    </span>
                  ) : (
                    <span className="text-emerald-400 font-semibold bg-emerald-950/60 px-2 py-0.5 rounded">
                      خالص ومسدد بالكامل
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Section 4: Subscription Dates & Towers */}
          <div>
            <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              <span>فترة الاشتراك والبرج / السكتر المغذي</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">تاريخ البدء والتفعيل</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-300">تاريخ انتهاء الاشتراك</label>
                  <div className="flex gap-1 text-[10px]">
                    <button
                      type="button"
                      onClick={() => addDaysToExpiry(30)}
                      className="text-cyan-400 hover:text-cyan-300 bg-cyan-950/50 px-1.5 py-0.5 rounded cursor-pointer"
                    >
                      +30 يوم
                    </button>
                    <button
                      type="button"
                      onClick={() => addDaysToExpiry(60)}
                      className="text-cyan-400 hover:text-cyan-300 bg-cyan-950/50 px-1.5 py-0.5 rounded cursor-pointer"
                    >
                      +60 يوم
                    </button>
                  </div>
                </div>
                <input
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-amber-300 font-semibold focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">البرج أو السكتر المغذي <span className="text-slate-500 font-normal">(الاسم الجديد يُسجَّل كبرج تلقائياً)</span></label>
                <div className="relative">
                  <TowerControl className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                  <input
                    type="text"
                    list="towers-list"
                    value={towerName}
                    onChange={(e) => setTowerName(e.target.value)}
                    placeholder="اختر برجاً من القائمة أو اكتب اسم برج جديد"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg pr-9 pl-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                  <datalist id="towers-list">
                    {towers.map((t, idx) => (
                      <option key={idx} value={t} />
                    ))}
                  </datalist>
                </div>
              </div>
            </div>
          </div>

          {/* Section 5: Technical Details & Notes (Optional) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">عنوان الآي بي (IP)</label>
              <input
                type="text"
                value={ipAddress}
                onChange={(e) => setIpAddress(e.target.value)}
                placeholder="192.168.1.50"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono text-left"
                dir="ltr"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">الماك أدرس (MAC)</label>
              <input
                type="text"
                value={macAddress}
                onChange={(e) => setMacAddress(e.target.value)}
                placeholder="C4:6E:1F:..."
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono text-left"
                dir="ltr"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1">العنوان أو الحي</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="مثال: شارع 14، قرب الصيدلية"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500"
              />
            </div>

            <div className="sm:col-span-4">
              <label className="block text-xs font-semibold text-slate-300 mb-1">ملاحظات إضافية</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="نوع النانو / الراوتر، قوة الإشارة، وعود السداد، إلخ"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500"
              />
            </div>
          </div>

          {/* Modal Actions */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-lg border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 text-sm font-semibold transition cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-bold shadow-lg shadow-cyan-600/30 transition cursor-pointer flex items-center gap-2"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{subscriberToEdit ? 'حفظ التعديلات' : 'تسجيل المشترك'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
