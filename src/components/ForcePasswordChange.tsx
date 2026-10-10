import React, { useState } from 'react';
import { StaffUser } from '../types/isp';
import { KeyRound, AlertTriangle, LogOut } from 'lucide-react';

interface ForcePasswordChangeProps {
  user: StaffUser;
  ispName: string;
  onChangePassword: (newPassword: string) => Promise<string | null>;
  onLogout: () => void;
}

// شاشة إجبارية لتغيير كلمة المرور الافتراضية عند أول دخول
export const ForcePasswordChange: React.FC<ForcePasswordChangeProps> = ({
  user,
  ispName,
  onChangePassword,
  onLogout,
}) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const pwd = newPassword.trim();
    if (pwd.length < 8) {
      setError('يجب أن تتكون كلمة المرور الجديدة من 8 خانات على الأقل.');
      return;
    }
    if (pwd !== confirmPassword.trim()) {
      setError('كلمتا المرور غير متطابقتين.');
      return;
    }
    setBusy(true);
    const err = await onChangePassword(pwd);
    setBusy(false);
    if (err) setError(err);
  };

  return (
    <div dir="rtl" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950 font-sans overflow-y-auto">
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div className="app-grid-bg" />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl float-slow"></div>
        <div className="absolute bottom-1/4 left-1/3 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl float-slow-delayed"></div>
      </div>
      <div className="animate-rise relative max-w-md w-full bg-slate-900/80 backdrop-blur-xl border border-slate-700/60 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/50 space-y-5">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-600 to-orange-600 mx-auto flex items-center justify-center shadow-lg ring-4 ring-slate-800">
            <KeyRound className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-lg font-bold text-white">{ispName}</h1>
          <p className="text-sm text-slate-300">
            مرحباً {user.name}، يجب تغيير كلمة المرور قبل المتابعة.
          </p>
        </div>

        <div className="bg-amber-950/50 border border-amber-800/70 rounded-xl p-3 flex gap-2 text-xs text-amber-200">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-400 mt-0.5" />
          <span>كلمة المرور الحالية افتراضية ومعروفة، لذلك لا يمكن استخدام المنظومة قبل تعيين كلمة مرور جديدة خاصة بك.</span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">كلمة المرور الجديدة</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">تأكيد كلمة المرور</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500"
            />
          </div>

          {error && (
            <div className="bg-rose-950/60 border border-rose-800 rounded-lg p-2.5 text-xs text-rose-300">{error}</div>
          )}

          <button
            type="submit"
            className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2.5 rounded-xl transition cursor-pointer"
          >
            حفظ كلمة المرور والمتابعة
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 text-slate-400 hover:text-white text-xs py-2 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>تسجيل الخروج</span>
          </button>
        </form>
      </div>
    </div>
  );
};
