import React, { useEffect, useState } from 'react';
import { authApi, loginAndStore, setToken } from '../sync/api';
import { StaffUser } from '../types/isp';
import {
  Lock,
  Key,
  User,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Wifi,
  Eye,
  EyeOff,
  Clock,
  ShieldAlert,
  Sparkles
} from 'lucide-react';

interface LockScreenProps {
  currentUser: StaffUser;
  lockReason: 'manual' | 'inactivity' | 'auth_required' | 'session_expired' | null;
  ispName: string;
  onUnlock: (user: StaffUser) => void;
}

export const LockScreen: React.FC<LockScreenProps> = ({
  currentUser,
  lockReason,
  ispName,
  onUnlock,
}) => {
  const [selectedUsername, setSelectedUsername] = useState<string>(currentUser.username || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  // null = جارٍ الفحص؛ true = لا يوجد أي حساب بعد (أول تشغيل على الخادم)
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);
  const [setupName, setSetupName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    authApi.status()
      .then(r => setNeedsSetup(r.needsSetup))
      .catch(e => {
        setNeedsSetup(false);
        setError(e.message);
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const username = selectedUsername.trim();
    const pwd = password.trim();

    if (needsSetup) {
      if (pwd.length < 8) {
        setError('يجب أن تتكون كلمة المرور من 8 خانات على الأقل.');
        return;
      }
      if (pwd !== confirmPassword.trim()) {
        setError('كلمتا المرور غير متطابقتين.');
        return;
      }
    }

    setBusy(true);
    try {
      if (needsSetup) {
        const res = await authApi.setup(setupName.trim(), username, pwd);
        setToken(res.token);
        onUnlock(res.user);
      } else {
        onUnlock(await loginAndStore(username, pwd));
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950 font-sans selection:bg-cyan-500 selection:text-white overflow-y-auto">
      {/* Background Decorative Glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div className="app-grid-bg" />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-cyan-500/15 rounded-full blur-3xl float-slow"></div>
        <div className="absolute bottom-1/4 left-1/3 w-80 h-80 bg-indigo-500/15 rounded-full blur-3xl float-slow-delayed"></div>
        <div className="absolute top-10 right-10 w-56 h-56 bg-sky-500/10 rounded-full blur-3xl float-slow-delayed"></div>
      </div>

      <div className="animate-rise relative max-w-md w-full bg-slate-900/80 backdrop-blur-xl border border-slate-700/60 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/50 space-y-6">
        <div className="gradient-line absolute top-0 inset-x-8" aria-hidden="true" />
        {/* Brand & Security Header */}
        <div className="text-center space-y-2">
          <div className="logo-glow w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-600 via-blue-600 to-indigo-600 mx-auto flex items-center justify-center ring-4 ring-slate-800">
            <Lock className="w-8 h-8 text-white" />
          </div>

          <div>
            <div className="flex items-center justify-center gap-2">
              <h1 className="text-xl font-bold gradient-text tracking-tight">{ispName}</h1>
              <span className="bg-cyan-500/10 text-cyan-400 text-xs px-2 py-0.5 rounded-full border border-cyan-500/20 font-semibold">
                الزبير
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              تسجيل الدخول الأمني والتحقق من الصلاحيات
            </p>
          </div>
        </div>

        {/* Security / Inactivity Notice */}
        {needsSetup ? (
          <div className="bg-emerald-950/60 border border-emerald-800/80 rounded-2xl p-3.5 text-xs text-emerald-200 flex items-start gap-2.5">
            <Sparkles className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div>
              <strong className="block text-emerald-300 font-bold mb-0.5">الإعداد الأول للمنظومة</strong>
              <p className="text-emerald-200/90 leading-relaxed text-[11px]">
                لا يوجد أي حساب على الخادم بعد. أنشئ الآن حساب المدير العام؛ ستُحفظ كلمة المرور مشفرة على الخادم.
              </p>
            </div>
          </div>
        ) : lockReason === 'session_expired' ? (
          <div className="bg-amber-950/60 border border-amber-700/80 rounded-2xl p-3 text-xs text-amber-200 flex items-center gap-2.5">
            <Clock className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span>انتهت الجلسة على الخادم. سجّل الدخول من جديد؛ التغييرات غير المرفوعة محفوظة على هذا الجهاز.</span>
          </div>
        ) : lockReason === 'inactivity' ? (
          <div className="bg-amber-950/60 border border-amber-700/80 rounded-2xl p-3.5 text-xs text-amber-200 flex items-start gap-2.5">
            <Clock className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5 animate-pulse" />
            <div>
              <strong className="block text-amber-300 font-bold mb-0.5">
                قفل أمني تلقائي (بعد 60 دقيقة من الخمول)
              </strong>
              <p className="text-amber-200/90 leading-relaxed text-[11px]">
                تم قفل المنظومة وتسجيل الخروج تلقائياً لعدم تحريك الماوس أو الضغط على الأزرار لمدة 60 دقيقة لحماية البيانات.
              </p>
            </div>
          </div>
        ) : lockReason === 'manual' ? (
          <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-3 text-xs text-slate-300 flex items-center gap-2.5">
            <ShieldCheck className="w-4 h-4 text-cyan-400 flex-shrink-0" />
            <span>تم تسجيل الخروج بنجاح. يرجى إدخال اسم المستخدم وكلمة المرور للمتابعة.</span>
          </div>
        ) : (
          <div className="bg-indigo-950/50 border border-indigo-800/60 rounded-2xl p-3 text-xs text-indigo-200 flex items-center gap-2.5">
            <ShieldCheck className="w-4 h-4 text-indigo-400 flex-shrink-0" />
            <span>يرجى تسجيل الدخول باسم المستخدم وكلمة المرور لفتح المنظومة.</span>
          </div>
        )}

        {/* Form: Username and Password */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {needsSetup && (
            <div>
              <label htmlFor="setup-name" className="block text-slate-300 font-semibold mb-1.5">
                اسم المدير الظاهر في المنظومة
              </label>
              <input
                id="setup-name"
                type="text"
                required
                value={setupName}
                onChange={(e) => setSetupName(e.target.value)}
                placeholder="مثال: المدير العام (أولاد كشيش)"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-cyan-500 text-sm"
              />
            </div>
          )}
          <div>
            <label className="block text-slate-300 font-semibold mb-1.5">
              اسم المستخدم (Username)
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-500 absolute right-3 top-2.5" />
              <input
                type="text"
                required
                value={selectedUsername}
                onChange={(e) => setSelectedUsername(e.target.value)}
                placeholder="أدخل اسم المستخدم..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pr-9 pl-3 py-2.5 text-white font-mono text-left focus:outline-none focus:border-cyan-500 text-sm"
                dir="ltr"
                autoComplete="username"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1.5">
              كلمة المرور (Password)
            </label>
            <div className="relative">
              <Key className="w-4 h-4 text-slate-500 absolute right-3 top-2.5" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="أدخل كلمة المرور..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pr-9 pl-10 py-2.5 text-white font-mono text-left focus:outline-none focus:border-cyan-500 text-sm"
                dir="ltr"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute left-3 top-2.5 text-slate-500 hover:text-slate-300 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {needsSetup && (
            <div>
              <label htmlFor="setup-confirm" className="block text-slate-300 font-semibold mb-1.5">
                تأكيد كلمة المرور (8 خانات على الأقل)
              </label>
              <input
                id="setup-confirm"
                type={showPassword ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-white font-mono text-left focus:outline-none focus:border-cyan-500 text-sm"
                dir="ltr"
                autoComplete="new-password"
              />
            </div>
          )}

          {error && (
            <div className="bg-rose-950/70 border border-rose-800 p-2.5 rounded-xl text-rose-300 flex items-center gap-2 text-xs">
              <ShieldAlert className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={busy || needsSetup === null}
            className="w-full disabled:opacity-60 disabled:cursor-wait py-3 bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white rounded-xl font-bold shadow-lg shadow-cyan-600/30 transition cursor-pointer flex items-center justify-center gap-2 text-sm"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>{busy ? 'جارٍ التحقق…' : needsSetup ? 'إنشاء حساب المدير والدخول' : 'تسجيل الدخول وفتح المنظومة'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
