import React, { useState, useEffect } from 'react';
import { SystemSettings, Subscriber, PaymentRecord, SupportTicket, UpstreamProvider, StaffUser, TowerPoint } from '../../types/isp';
import { todayStr } from '../../utils/dates';
import {
  Settings,
  Save,
  Download,
  Upload,
  RotateCcw,
  Check,
  ShieldCheck,
  Database,
  HelpCircle,
  Bell,
  BellRing,
  Send,
  AlertCircle,
  Key,
  Eye,
  EyeOff,
  Lock,
  Server,
  Users
} from 'lucide-react';
import {
  isNotificationSupported,
  getNotificationPermission,
  requestNotificationPermission,
  sendTestNotification,
  checkAndTriggerExpiryNotifications
} from '../../utils/notifications';

interface SettingsViewProps {
  settings: SystemSettings;
  subscribers: Subscriber[];
  payments: PaymentRecord[];
  tickets: SupportTicket[];
  providers: UpstreamProvider[];
  currentUser?: StaffUser;
  adminUser?: StaffUser;
  onSaveSettings: (settings: SystemSettings) => void;
  onRestoreFullBackup: (data: {
    subscribers: Subscriber[];
    payments: PaymentRecord[];
    tickets: SupportTicket[];
    providers: UpstreamProvider[];
    settings: SystemSettings;
    staffUsers?: StaffUser[];
    towers?: TowerPoint[];
  }) => void;
  onResetToDemoData: () => void;
  onUpdateAdminPassword?: (newPassword: string) => void;
  onNavigateToProviders?: () => void;
  staffUsers?: StaffUser[];
  towers?: TowerPoint[];
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  subscribers,
  payments,
  tickets,
  providers,
  currentUser,
  adminUser,
  onSaveSettings,
  onRestoreFullBackup,
  onResetToDemoData,
  onUpdateAdminPassword,
  onNavigateToProviders,
  staffUsers,
  towers,
}) => {
  const [formData, setFormData] = useState<SystemSettings>({ ...settings });
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>('default');
  const [notifMessage, setNotifMessage] = useState<string | null>(null);

  // Admin password change state
  const [currentAdminPassword, setCurrentAdminPassword] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [confirmAdminPassword, setConfirmAdminPassword] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    // Verify current admin password if known
    if (adminUser && currentAdminPassword !== adminUser.password) {
      setPasswordError('كلمة المرور الحالية غير صحيحة.');
      return;
    }

    if (newAdminPassword.length < 8) {
      setPasswordError('يجب أن تتكون كلمة المرور الجديدة من 8 خانات على الأقل.');
      return;
    }

    if (newAdminPassword !== confirmAdminPassword) {
      setPasswordError('كلمتا المرور الجديدتان غير متطابقتين.');
      return;
    }

    if (onUpdateAdminPassword) {
      onUpdateAdminPassword(newAdminPassword);
      setPasswordSuccess('تم تغيير كلمة مرور المدير العام بنجاح!');
      setCurrentAdminPassword('');
      setNewAdminPassword('');
      setConfirmAdminPassword('');
      setTimeout(() => setPasswordSuccess(null), 3500);
    }
  };

  useEffect(() => {
    setNotifPermission(getNotificationPermission());
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings(formData);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleRequestNotifPermission = async () => {
    const granted = await requestNotificationPermission();
    setNotifPermission(granted ? 'granted' : 'denied');
    setNotifMessage(granted ? 'تم تفعيل إشعارات المتصفح بنجاح!' : 'تم رفض الإذن أو تم حظر الإشعارات في المتصفح.');
    setTimeout(() => setNotifMessage(null), 3000);
  };

  const handleSendTestNotif = () => {
    const ok = sendTestNotification(formData);
    if (ok) {
      setNotifMessage('تم إرسال إشعار تجريبي للمتصفح الآن!');
    } else {
      setNotifMessage('يرجى تفعيل إذن الإشعارات أولاً.');
    }
    setTimeout(() => setNotifMessage(null), 3000);
  };

  const handleManualCheckNotif = () => {
    const { notifiedCount, expiringList } = checkAndTriggerExpiryNotifications(subscribers, formData, true);
    if (notifiedCount > 0) {
      setNotifMessage(`تم إرسال ${notifiedCount} إشعار للمتصفح للمشتركين الذين تنتهي اشتراكاتهم قريباً!`);
    } else {
      setNotifMessage(`يوجد ${expiringList.length} مشتركين قرب الانتهاء (أو تم تنبيههم بالفعل اليوم).`);
    }
    setTimeout(() => setNotifMessage(null), 4000);
  };

  // Export full JSON backup
  const handleExportBackup = () => {
    const backupData = {
      version: '1.1',
      exportedAt: new Date().toISOString(),
      settings,
      subscribers,
      payments,
      tickets,
      providers,
      staffUsers: staffUsers || [],
      towers: towers || [],
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `منظومة_إنترنت_نسخة_احتياطية_${todayStr()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Restore JSON backup
  const handleRestoreFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.subscribers && Array.isArray(parsed.subscribers)) {
          onRestoreFullBackup({
            subscribers: parsed.subscribers,
            payments: parsed.payments || [],
            tickets: parsed.tickets || [],
            providers: parsed.providers || providers,
            settings: parsed.settings || settings,
            staffUsers: Array.isArray(parsed.staffUsers) ? parsed.staffUsers : undefined,
            towers: Array.isArray(parsed.towers) ? parsed.towers : undefined,
          });
          alert('تم استعادة النسخة الاحتياطية بنجاح!');
        } else {
          alert('الملف غير صالح أو لا يحتوي على بنية البيانات الصحيحة.');
        }
      } catch (err) {
        alert('حدث خطأ أثناء قراءة ملف النسخة الاحتياطية.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <Settings className="w-5 h-5 text-cyan-400" />
          <span>إعدادات المنظومة والنسخ الاحتياطي</span>
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          خصص بيانات شبكتك، أرقام الدعم، إشعارات المتصفح التلقائية، وقم بحفظ واسترجاع بيانات المشتركين
        </p>
      </div>

      {/* Main Settings Form */}
      <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
        <h3 className="text-sm font-bold text-cyan-400 pb-2 border-b border-slate-800 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4" />
          <span>بيانات الشبكة والوكيل</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-300 mb-1">اسم المنظومة / الشبكة</label>
            <input
              type="text"
              required
              value={formData.ispName}
              onChange={(e) => setFormData({ ...formData, ispName: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-300 mb-1">اسم الوكيل / المسؤول</label>
            <input
              type="text"
              required
              value={formData.agentName}
              onChange={(e) => setFormData({ ...formData, agentName: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-300 mb-1">رقم هاتف الدعم والاستفسارات</label>
            <input
              type="text"
              required
              value={formData.contactPhone}
              onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-white font-mono focus:outline-none focus:border-cyan-500"
              dir="ltr"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-300 mb-1">عنوان البرج / المكتب الرئيسي</label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-300 mb-1">العملة الأساسية</label>
            <select
              value={formData.currency}
              onChange={(e) => setFormData({ ...formData, currency: e.target.value as any })}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-cyan-500"
            >
              <option value="IQD">الدينار العراقي (د.ع)</option>
              <option value="USD">الدولار الأمريكي ($)</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-300 mb-1">
              عدد الأيام للتنبيه قبل انتهاء الاشتراك (warningDaysBeforeExpiry)
            </label>
            <input
              type="number"
              min="1"
              max="15"
              value={formData.warningDaysBeforeExpiry}
              onChange={(e) => setFormData({ ...formData, warningDaysBeforeExpiry: Number(e.target.value) })}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-cyan-500 font-bold font-mono"
            />
            <span className="text-[10px] text-slate-400 mt-1 block">
              سيتم إطلاق إشعار المتصفح عندما يتبقى هذا العدد من الأيام أو أقل لانتهاء اشتراك المشترك.
            </span>
          </div>
        </div>

        <div>
          <label className="block font-semibold text-slate-300 mb-1 text-xs">
            تذييل رسائل الواتساب والتوقيع التلقائي
          </label>
          <textarea
            rows={2}
            value={formData.whatsappFooter}
            onChange={(e) => setFormData({ ...formData, whatsappFooter: e.target.value })}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-cyan-500"
          />
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-slate-800">
          {savedSuccess && (
            <span className="text-emerald-400 text-xs font-semibold flex items-center gap-1">
              <Check className="w-4 h-4" />
              <span>تم حفظ الإعدادات بنجاح!</span>
            </span>
          )}
          <button
            type="submit"
            className="ms-auto px-6 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-cyan-600/30 transition cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>حفظ الإعدادات</span>
          </button>
        </div>
      </form>

      {/* Provider Management Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center flex-shrink-0">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>إدارة وتعديل وتسمية المزودين (الزبير)</span>
                <span className="text-[11px] bg-indigo-950 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-800 font-semibold">
                  {providers.length} مزودين
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                تعديل وإعادة تسمية المزودين وباقاتهم (إيرثلنك، ساس 4، فاست ليد، فايبر الزبير...) وتحديث المشتركين تلقائياً
              </p>
            </div>
          </div>

          {onNavigateToProviders && (
            <button
              type="button"
              onClick={onNavigateToProviders}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition cursor-pointer self-start sm:self-auto"
            >
              <Server className="w-4 h-4" />
              <span>فتح نافذة المزودين والباقات</span>
            </button>
          )}
        </div>
      </div>

      {/* Admin Password Change Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-sm font-bold text-cyan-400 flex items-center gap-2">
            <Key className="w-4 h-4 text-cyan-400" />
            <span>تغيير كلمة مرور المدير العام (Admin Password)</span>
          </h3>
          <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800">
            صلاحية أمنية للمدير
          </span>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          يمكنك من هنا تغيير كلمة المرور لحساب المدير العام (<span className="text-cyan-300 font-mono" dir="ltr">admin</span>) المستخدم في فتح وقفل المنظومة.
        </p>

        {currentUser?.role === 'admin' ? (
          <form onSubmit={handlePasswordSubmit} className="space-y-3.5 max-w-xl text-xs pt-1">
            {passwordError && (
              <div className="bg-rose-950/70 border border-rose-800 p-2.5 rounded-xl text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{passwordError}</span>
              </div>
            )}

            {passwordSuccess && (
              <div className="bg-emerald-950/70 border border-emerald-800 p-2.5 rounded-xl text-emerald-300 flex items-center gap-2">
                <Check className="w-4 h-4 flex-shrink-0" />
                <span>{passwordSuccess}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  كلمة المرور الحالية للمدير
                </label>
                <input
                  type="password"
                  required
                  value={currentAdminPassword}
                  onChange={(e) => setCurrentAdminPassword(e.target.value)}
                  placeholder="أدخل كلمة المرور الحالية"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono text-left focus:outline-none focus:border-cyan-500"
                  dir="ltr"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="font-semibold text-slate-300">
                    كلمة المرور الجديدة
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowAdminPassword(!showAdminPassword)}
                    className="text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
                  >
                    {showAdminPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span className="text-[10px]">{showAdminPassword ? 'إخفاء' : 'إظهار'}</span>
                  </button>
                </div>
                <input
                  type={showAdminPassword ? 'text' : 'password'}
                  required
                  value={newAdminPassword}
                  onChange={(e) => setNewAdminPassword(e.target.value)}
                  placeholder="كلمة مرور جديدة (8 خانات فأكثر)"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono text-left focus:outline-none focus:border-cyan-500"
                  dir="ltr"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-300 mb-1">
                  تأكيد كلمة المرور الجديدة
                </label>
                <input
                  type={showAdminPassword ? 'text' : 'password'}
                  required
                  value={confirmAdminPassword}
                  onChange={(e) => setConfirmAdminPassword(e.target.value)}
                  placeholder="أعد كتابة كلمة المرور الجديدة للتأكيد"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono text-left focus:outline-none focus:border-cyan-500"
                  dir="ltr"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>حفظ كلمة مرور المدير الجديدة</span>
              </button>
            </div>
          </form>
        ) : (
          <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-xl text-xs text-slate-400 flex items-center gap-2">
            <Lock className="w-4 h-4 text-slate-500 flex-shrink-0" />
            <span>أنت مسجل حالياً بحساب موظف. تغيير كلمة مرور المدير متاح فقط عند تسجيل الدخول بحساب المدير العام.</span>
          </div>
        )}
      </div>

      {/* Browser Expiry Notification Management Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-sm font-bold text-amber-400 flex items-center gap-2">
            <BellRing className="w-4 h-4" />
            <span>إشعارات المتصفح التلقائية لانتهاء الاشتراكات (Browser Notifications)</span>
          </h3>

          <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
            notifPermission === 'granted'
              ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
              : notifPermission === 'denied'
              ? 'bg-rose-950 text-rose-300 border-rose-800'
              : 'bg-slate-800 text-slate-400 border-slate-700'
          }`}>
            الحالة: {notifPermission === 'granted' ? 'مفعلة بالكامل' : notifPermission === 'denied' ? 'محظورة' : 'غير مفعلة بعد'}
          </span>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          تقوم المنظومة بإطلاق إشعارات منبثقة على سطح المكتب أو المتصفح تلقائياً عند اقتراب موعد انتهاء أي اشتراك استناداً إلى إعداد (<strong>{formData.warningDaysBeforeExpiry} أيام</strong> قبل الانتهاء).
        </p>

        {notifMessage && (
          <div className="bg-cyan-950/60 border border-cyan-800 p-2.5 rounded-xl text-xs text-cyan-300 flex items-center gap-2 animate-in fade-in">
            <Check className="w-4 h-4 flex-shrink-0" />
            <span>{notifMessage}</span>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 pt-2">
          {notifPermission !== 'granted' && (
            <button
              type="button"
              onClick={handleRequestNotifPermission}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-lg shadow-amber-600/20"
            >
              <Bell className="w-4 h-4" />
              <span>طلب إذن وتفعيل إشعارات المتصفح</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleSendTestNotif}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-200 rounded-xl text-xs font-semibold border border-slate-700 flex items-center gap-1.5 transition cursor-pointer"
          >
            <Send className="w-3.5 h-3.5 text-cyan-400" />
            <span>إرسال إشعار تجريبي الآن</span>
          </button>

          <button
            type="button"
            onClick={handleManualCheckNotif}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-lg shadow-cyan-600/20"
          >
            <BellRing className="w-3.5 h-3.5" />
            <span>فحص وإطلاق إشعارات الاشتراكات القريبة الآن</span>
          </button>
        </div>
      </div>

      {/* Backup and Restore Cards */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <h3 className="text-sm font-bold text-indigo-400 pb-2 border-b border-slate-800 flex items-center gap-2">
          <Database className="w-4 h-4" />
          <span>النسخ الاحتياطي واستعادة البيانات</span>
        </h3>
        <p className="text-xs text-slate-400">
          احفظ نسخة احتياطية من كافة المشتركين والحسابات على جهازك أو انقلها إلى حاسوب آخر. البيانات محفوظة في هذا المتصفح فقط، لذلك خذ نسخة احتياطية بشكل دوري.
          تنبيه: ملف النسخة يحتوي على كلمات مرور المشتركين والموظفين، فاحفظه في مكان آمن.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
          {/* Download JSON Backup */}
          <button
            type="button"
            onClick={handleExportBackup}
            className="p-4 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 flex flex-col items-center text-center gap-2 transition cursor-pointer"
          >
            <Download className="w-6 h-6 text-cyan-400" />
            <span className="text-xs font-bold text-white">تحميل نسخة احتياطية (JSON)</span>
            <span className="text-[11px] text-slate-400">تحميل كافة البيانات في ملف واحد</span>
          </button>

          {/* Restore JSON Backup */}
          <label className="p-4 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 flex flex-col items-center text-center gap-2 transition cursor-pointer">
            <Upload className="w-6 h-6 text-indigo-400" />
            <span className="text-xs font-bold text-white">استعادة نسخة احتياطية</span>
            <span className="text-[11px] text-slate-400">رفع ملف JSON محفوظ سابقاً</span>
            <input
              type="file"
              accept=".json"
              onChange={handleRestoreFile}
              className="hidden"
            />
          </label>

          {/* Clear All Data */}
          <button
            type="button"
            onClick={() => {
              if (confirm('تنبيه: هل أنت متأكد من تفريغ كافة بيانات المشتركين والوصولات للبدء من الصفر؟')) {
                onResetToDemoData();
              }
            }}
            className="p-4 rounded-xl bg-slate-800/80 hover:bg-rose-950/80 border border-slate-700 hover:border-rose-800 flex flex-col items-center text-center gap-2 transition cursor-pointer"
          >
            <RotateCcw className="w-6 h-6 text-rose-400" />
            <span className="text-xs font-bold text-rose-300">تفريغ كافة البيانات</span>
            <span className="text-[11px] text-slate-400">مسح كافة المشتركين والوصولات</span>
          </button>
        </div>
      </div>

      {/* Guide: How to migrate from Excel */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-6 text-xs text-slate-300 space-y-3">
        <h4 className="font-bold text-white flex items-center gap-2 text-sm text-cyan-400">
          <HelpCircle className="w-4 h-4" />
          <span>كيف تنتقل من فوضى ملفات الإكسل القديمة إلى هذا النظام؟</span>
        </h4>
        <ol className="list-decimal list-inside space-y-1.5 text-slate-400 leading-relaxed">
          <li>اضغط على زر <strong>استيراد من إكسل</strong> في أعلى الشاشة واختر ملفك القديم (.xlsx أو .csv).</li>
          <li>سيقوم النظام تلقائياً بقراءة أسماء المشتركين، أرقام الهواتف، واليوزرات وتوزيعهم في جداول مرتبة.</li>
          <li>يمكنك تعديل كلفة الشراء من المزود وسعر البيع لحساب أرباحك الصافية تلقائياً كل شهر.</li>
          <li>عند اقتراب موعد الدفع، اضغط على زر <strong>واتساب</strong> لإرسال رسالة تذكير احترافية للمشترك دون كتابة أي حرف يدوياً.</li>
          <li>عند استلام المبلغ، اضغط على <strong>تجديد فوري</strong> بنقرة واحدة لطباعة وصل قبض وتمديد الاشتراك لشهر جديد.</li>
        </ol>
      </div>
    </div>
  );
};
