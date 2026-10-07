import React, { useState } from 'react';
import { UpstreamProvider, ProviderPlan, Subscriber, SystemSettings, TowerPoint } from '../../types/isp';
import { formatCurrency } from '../../utils/storage';
import {
  Server,
  TowerControl,
  Plus,
  Edit2,
  Trash2,
  DollarSign,
  Users,
  Gauge,
  Phone,
  Search,
  MapPin,
  ExternalLink,
  ShieldCheck,
  Network,
  Info
} from 'lucide-react';

interface ProvidersViewProps {
  providers: UpstreamProvider[];
  subscribers: Subscriber[];
  settings: SystemSettings;
  towers: TowerPoint[];
  onSaveProviders: (updated: UpstreamProvider[]) => void;
  onSaveTowers: (updated: TowerPoint[]) => void;
  onOpenEditProviderModal?: (provider: UpstreamProvider) => void;
  onOpenAddProviderModal?: () => void;
  onOpenEditTowerModal?: (tower: TowerPoint) => void;
  onOpenAddTowerModal?: () => void;
  onNavigateToSubscribersWithProvider?: (providerName: string) => void;
  onNavigateToSubscribersWithTower?: (towerName: string) => void;
}

export const ProvidersView: React.FC<ProvidersViewProps> = ({
  providers,
  subscribers,
  settings,
  towers,
  onSaveProviders,
  onSaveTowers,
  onOpenEditProviderModal,
  onOpenAddProviderModal,
  onOpenEditTowerModal,
  onOpenAddTowerModal,
  onNavigateToSubscribersWithProvider,
  onNavigateToSubscribersWithTower,
}) => {
  const [activeSection, setActiveSection] = useState<'providers' | 'towers'>('providers');
  const [search, setSearch] = useState('');

  // Providers plan modal
  const [newPlanModal, setNewPlanModal] = useState<string | null>(null); // providerId
  const [newPlanName, setNewPlanName] = useState('');
  const [newPlanCost, setNewPlanCost] = useState<number>(24000);
  const [newPlanSale, setNewPlanSale] = useState<number>(35000);
  const [newPlanSpeed, setNewPlanSpeed] = useState('30 Mbps');

  const filteredProviders = providers.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.contact && p.contact.includes(search))
  );

  const filteredTowers = towers.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    (t.location && t.location.toLowerCase().includes(search.toLowerCase())) ||
    (t.notes && t.notes.toLowerCase().includes(search.toLowerCase()))
  );

  const handleAddPlan = (provId: string) => {
    if (!newPlanName.trim()) return;

    const updated = providers.map(p => {
      if (p.id === provId) {
        const newPlan: ProviderPlan = {
          id: `plan_${Date.now()}`,
          name: newPlanName.trim(),
          defaultCost: Number(newPlanCost) || 0,
          defaultSalePrice: Number(newPlanSale) || 0,
          speed: newPlanSpeed.trim(),
        };
        return {
          ...p,
          plans: [...p.plans, newPlan],
        };
      }
      return p;
    });

    onSaveProviders(updated);
    setNewPlanModal(null);
    setNewPlanName('');
    setNewPlanCost(24000);
    setNewPlanSale(35000);
    setNewPlanSpeed('');
  };

  const handleDeletePlan = (provId: string, planId: string) => {
    if (!confirm('هل أنت متأكد من حذف هذه الباقة؟')) return;
    const updated = providers.map(p => {
      if (p.id === provId) {
        return {
          ...p,
          plans: p.plans.filter(pl => pl.id !== planId),
        };
      }
      return p;
    });
    onSaveProviders(updated);
  };

  const handleDeleteProvider = (prov: UpstreamProvider) => {
    const subsCount = subscribers.filter(s => s.upstreamProvider === prov.name).length;
    if (subsCount > 0) {
      if (!confirm(`تحذير: يوجد ${subsCount} مشترك مسجل حالياً بهذا المزود في الزبير. هل أنت متأكد من حذف المزود بالكامل؟`)) {
        return;
      }
    } else {
      if (!confirm(`هل أنت متأكد من حذف المزود "${prov.name}"؟`)) {
        return;
      }
    }
    onSaveProviders(providers.filter(p => p.id !== prov.id));
  };

  const handleDeleteTower = (tow: TowerPoint) => {
    const subsCount = subscribers.filter(s => s.towerName === tow.name).length;
    if (subsCount > 0) {
      if (!confirm(`تحذير: يوجد ${subsCount} مشترك مسجل حالياً على هذا البرج (${tow.name}). هل أنت متأكد من حذفه؟`)) {
        return;
      }
    } else {
      if (!confirm(`هل أنت متأكد من حذف البرج "${tow.name}"؟`)) {
        return;
      }
    }
    onSaveTowers(towers.filter(t => t.id !== tow.id));
  };

  // Overall Stats across all providers
  const totalSubscribersCount = subscribers.length;
  const totalWholesaleExpense = subscribers.reduce((acc, s) => acc + s.costPrice, 0);
  const totalGrossRevenue = subscribers.reduce((acc, s) => acc + s.salePrice, 0);
  const totalNetProfit = totalGrossRevenue - totalWholesaleExpense;

  return (
    <div className="space-y-6">
      {/* Top Banner & Section Selector */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
                {activeSection === 'providers' ? <Server className="w-5 h-5" /> : <TowerControl className="w-5 h-5 text-cyan-400" />}
              </div>
              <div>
                <h1 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>إدارة البنية التحتية: المزودون والأبراج (قضاء الزبير)</span>
                </h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  تعديل وتسمية المزودين (شراء/بيع)، وضبط بيانات الأبراج ونقاط البث والكابينات وتحديث المشتركين تلقائياً
                </p>
              </div>
            </div>
          </div>

          {/* Sub-tab Switches */}
          <div className="flex items-center bg-slate-950 p-1.5 rounded-2xl border border-slate-800 self-start lg:self-auto">
            <button
              onClick={() => setActiveSection('providers')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
                activeSection === 'providers'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <Server className="w-4 h-4" />
              <span>المزودون وباقات الجملة ({providers.length})</span>
            </button>

            <button
              onClick={() => setActiveSection('towers')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
                activeSection === 'towers'
                  ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <TowerControl className="w-4 h-4" />
              <span>الأبراج ونقاط البث ({towers.length})</span>
            </button>
          </div>
        </div>

        {/* Global Financial & Infrastructure Metrics */}
        {activeSection === 'providers' ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-800/80">
            <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-3">
              <span className="text-slate-400 block text-[10px] font-semibold">إجمالي المزودين</span>
              <span className="text-sm font-bold text-white">{providers.length} شركات ومصادر</span>
            </div>
            <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-3">
              <span className="text-slate-400 block text-[10px] font-semibold">المشتركين المربوطين</span>
              <span className="text-sm font-bold text-cyan-400">{totalSubscribersCount} مشترك</span>
            </div>
            <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-3">
              <span className="text-slate-400 block text-[10px] font-semibold">كلفة الجملة الإجمالية</span>
              <span className="text-sm font-bold text-amber-300 font-mono">
                {formatCurrency(totalWholesaleExpense, settings.currency)}
              </span>
            </div>
            <div className="bg-slate-950/70 border border-emerald-900/50 rounded-2xl p-3 bg-emerald-950/20">
              <span className="text-emerald-300 block text-[10px] font-semibold">صافي الربح الشهري</span>
              <span className="text-sm font-bold text-emerald-400 font-mono">
                +{formatCurrency(totalNetProfit, settings.currency)}
              </span>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-800/80">
            <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-3">
              <span className="text-slate-400 block text-[10px] font-semibold">إجمالي الأبراج والكابينات</span>
              <span className="text-sm font-bold text-cyan-400">{towers.length} نقطة توزيع</span>
            </div>
            <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-3">
              <span className="text-slate-400 block text-[10px] font-semibold">المشتركين الموزعين على الأبراج</span>
              <span className="text-sm font-bold text-white">{totalSubscribersCount} مشترك مسجل</span>
            </div>
            <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-3">
              <span className="text-slate-400 block text-[10px] font-semibold">نطاق التغطية</span>
              <span className="text-sm font-bold text-indigo-300">قضاء الزبير - البصرة</span>
            </div>
          </div>
        )}

        {/* Action Bar: Search and Add New */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
          <div className="relative max-w-md w-full">
            <Search className="w-4 h-4 text-slate-500 absolute right-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={activeSection === 'providers' ? "ابحث عن مزود بالاسم أو رقم الهاتف..." : "ابحث عن برج، سكتر، أو منطقة في الزبير..."}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pr-9 pl-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            {activeSection === 'providers' ? (
              <button
                onClick={() => onOpenAddProviderModal ? onOpenAddProviderModal() : null}
                className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition cursor-pointer w-full sm:w-auto justify-center"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة مزود رئيسي جديد</span>
              </button>
            ) : (
              <button
                onClick={() => onOpenAddTowerModal ? onOpenAddTowerModal() : null}
                className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-cyan-600/30 transition cursor-pointer w-full sm:w-auto justify-center"
              >
                <Plus className="w-4 h-4" />
                <span>+ إضافة برج / نقطة بث جديدة</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* SECTION 1: PROVIDERS GRID */}
      {activeSection === 'providers' && (
        <div className="space-y-6">
          {filteredProviders.map((prov) => {
            const subsOnThisProvider = subscribers.filter(s => s.upstreamProvider === prov.name);
            const totalCostThisProv = subsOnThisProvider.reduce((acc, s) => acc + s.costPrice, 0);
            const totalRevenueThisProv = subsOnThisProvider.reduce((acc, s) => acc + s.salePrice, 0);
            const netProfitThisProv = totalRevenueThisProv - totalCostThisProv;

            return (
              <div key={prov.id} className="bg-slate-900 border border-slate-800 rounded-3xl shadow-xl overflow-hidden hover:border-slate-700/80 transition">
                {/* Provider Header Bar */}
                <div className="bg-slate-850 p-4 sm:p-5 border-b border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex items-start sm:items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center flex-shrink-0">
                      <Server className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-white text-base">{prov.name}</h3>
                        {prov.contact && (
                          <span className="text-[11px] text-slate-400 font-mono bg-slate-800/80 px-2 py-0.5 rounded-lg border border-slate-700/60" dir="ltr">
                            {prov.contact}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                        <span className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5 text-cyan-400" />
                          <span className="text-white font-semibold">{subsOnThisProvider.length} مشترك مسجل في الزبير</span>
                        </span>
                        {onNavigateToSubscribersWithProvider && subsOnThisProvider.length > 0 && (
                          <button
                            onClick={() => onNavigateToSubscribersWithProvider(prov.name)}
                            className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 text-[11px] hover:underline cursor-pointer"
                          >
                            <span>عرض المشتركين</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Financial Summary & Actions */}
                  <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
                    <div className="bg-slate-950/80 px-3 py-1.5 rounded-xl border border-slate-800 text-xs">
                      <span className="text-slate-400 block text-[10px]">كلفة الجملة الشهرية</span>
                      <span className="font-bold text-amber-300 font-mono">
                        {formatCurrency(totalCostThisProv, settings.currency)}
                      </span>
                    </div>

                    <div className="bg-emerald-950/40 px-3 py-1.5 rounded-xl border border-emerald-800/50 text-xs">
                      <span className="text-emerald-300 block text-[10px]">صافي الربح</span>
                      <span className="font-bold text-emerald-400 font-mono">
                        +{formatCurrency(netProfitThisProv, settings.currency)}
                      </span>
                    </div>

                    {/* Primary Edit / Rename Provider Button */}
                    <button
                      onClick={() => onOpenEditProviderModal ? onOpenEditProviderModal(prov) : null}
                      className="bg-indigo-950 hover:bg-indigo-900 text-indigo-300 hover:text-white border border-indigo-700/80 text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-md"
                      title="تعديل اسم المزود، هاتف الدعم، والباقات"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-indigo-400" />
                      <span>تعديل وإعادة تسمية</span>
                    </button>

                    <button
                      onClick={() => setNewPlanModal(prov.id)}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1 cursor-pointer transition shadow-md shadow-indigo-600/30"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ باقة جديدة</span>
                    </button>

                    <button
                      onClick={() => handleDeleteProvider(prov)}
                      title="حذف هذا المزود"
                      className="text-slate-500 hover:text-rose-400 p-2 rounded-xl hover:bg-slate-800 transition cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Plans Table */}
                <div className="p-4 sm:p-5 overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-800/60 text-slate-400 font-bold">
                      <tr>
                        <th className="p-2.5">اسم الباقة</th>
                        <th className="p-2.5">السرعة التقديرية</th>
                        <th className="p-2.5">سعر الجملة (كلفة المزود)</th>
                        <th className="p-2.5">سعر البيع للمشترك</th>
                        <th className="p-2.5">الربح الصافي لكل خط</th>
                        <th className="p-2.5 text-center">إجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-slate-200">
                      {prov.plans.map((pl) => {
                        const profit = pl.defaultSalePrice - pl.defaultCost;
                        const activeUsersCount = subsOnThisProvider.filter(s => s.planName.includes(pl.name)).length;

                        return (
                          <tr key={pl.id} className="hover:bg-slate-800/40 transition">
                            <td className="p-2.5 font-bold text-white flex items-center gap-2">
                              <span>{pl.name}</span>
                              {activeUsersCount > 0 && (
                                <span className="text-[10px] bg-cyan-950 text-cyan-300 px-1.5 py-0.2 rounded font-normal border border-cyan-800">
                                  {activeUsersCount} خط في الزبير
                                </span>
                              )}
                            </td>
                            <td className="p-2.5 font-mono text-slate-300" dir="ltr">{pl.speed || 'غير محدد'}</td>
                            <td className="p-2.5 text-amber-300 font-semibold font-mono">
                              {formatCurrency(pl.defaultCost, settings.currency)}
                            </td>
                            <td className="p-2.5 text-cyan-300 font-bold font-mono">
                              {formatCurrency(pl.defaultSalePrice, settings.currency)}
                            </td>
                            <td className="p-2.5 text-emerald-400 font-bold font-mono">
                              +{formatCurrency(profit, settings.currency)}
                            </td>
                            <td className="p-2.5 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => onOpenEditProviderModal ? onOpenEditProviderModal(prov) : null}
                                  className="text-slate-400 hover:text-indigo-300 p-1 rounded hover:bg-slate-800 cursor-pointer"
                                  title="تعديل الباقة في نافذة المزود"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeletePlan(prov.id, pl.id)}
                                  className="text-slate-500 hover:text-rose-400 p-1 rounded hover:bg-slate-800 cursor-pointer"
                                  title="حذف الباقة"
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
            );
          })}
        </div>
      )}

      {/* SECTION 2: TOWERS & NETWORK POINTS GRID */}
      {activeSection === 'towers' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTowers.map((tow) => {
              const subsOnThisTower = subscribers.filter(s => s.towerName === tow.name);
              const paidSubs = subsOnThisTower.filter(s => s.paymentStatus === 'paid');
              const overdueSubs = subsOnThisTower.filter(s => s.paymentStatus === 'overdue');

              return (
                <div
                  key={tow.id}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl hover:border-cyan-500/40 transition flex flex-col justify-between space-y-4"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-cyan-600/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center flex-shrink-0">
                          <TowerControl className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-bold text-white text-sm">{tow.name}</h3>
                          {tow.location && (
                            <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-0.5">
                              <MapPin className="w-3 h-3 text-rose-400" />
                              <span>{tow.location}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => onOpenEditTowerModal ? onOpenEditTowerModal(tow) : null}
                          className="text-slate-400 hover:text-cyan-300 p-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer"
                          title="تعديل وإعادة تسمية هذا البرج"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteTower(tow)}
                          className="text-slate-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer"
                          title="حذف هذا البرج"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Tower Details & Specs */}
                    <div className="mt-3 pt-3 border-t border-slate-800/80 space-y-2 text-xs">
                      {tow.ipRange && (
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-400">نطاق الآي بي / الجهاز:</span>
                          <span className="font-mono text-cyan-400" dir="ltr">{tow.ipRange}</span>
                        </div>
                      )}

                      {tow.notes && (
                        <p className="text-[11px] text-slate-400 leading-relaxed bg-slate-950/60 p-2 rounded-lg border border-slate-800">
                          {tow.notes}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Subscribers Stats on this Tower */}
                  <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-cyan-400" />
                        <span>{subsOnThisTower.length} مشترك</span>
                      </span>
                      {subsOnThisTower.length > 0 && (
                        <span className="text-[10px] text-slate-400">
                          ({paidSubs.length} واصل • {overdueSubs.length} متأخر)
                        </span>
                      )}
                    </div>

                    {onNavigateToSubscribersWithTower && subsOnThisTower.length > 0 && (
                      <button
                        onClick={() => onNavigateToSubscribersWithTower(tow.name)}
                        className="text-cyan-400 hover:text-cyan-300 text-[11px] font-semibold flex items-center gap-1 hover:underline cursor-pointer"
                      >
                        <span>عرض القائمة</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {filteredTowers.length === 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center space-y-3">
              <TowerControl className="w-12 h-12 text-slate-600 mx-auto" />
              <h3 className="text-base font-bold text-white">لا يوجد أبراج مطابقة للبحث</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                يمكنك إضافة برج أو نقطة بث جديدة لتنظيم توزيع المشتركين في قضاء الزبير
              </p>
              <button
                onClick={() => onOpenAddTowerModal ? onOpenAddTowerModal() : null}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                + إضافة برج أو كابينة الآن
              </button>
            </div>
          )}
        </div>
      )}

      {/* Quick Add Plan Modal */}
      {newPlanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="font-bold text-white text-base">إضافة باقة جديدة للمزود</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">اسم الباقة</label>
                <input
                  type="text"
                  value={newPlanName}
                  onChange={(e) => setNewPlanName(e.target.value)}
                  placeholder="مثال: توربو بلس (Turbo+)"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">السرعة التقديرية</label>
                <input
                  type="text"
                  value={newPlanSpeed}
                  onChange={(e) => setNewPlanSpeed(e.target.value)}
                  placeholder="مثال: 50 Mbps"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">سعر الجملة (الكلفة)</label>
                  <input
                    type="number"
                    step="1000"
                    value={newPlanCost}
                    onChange={(e) => setNewPlanCost(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-amber-300 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">سعر البيع للمشترك</label>
                  <input
                    type="number"
                    step="1000"
                    value={newPlanSale}
                    onChange={(e) => setNewPlanSale(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-cyan-300 font-bold"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setNewPlanModal(null)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => handleAddPlan(newPlanModal)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold cursor-pointer"
              >
                حفظ الباقة
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
