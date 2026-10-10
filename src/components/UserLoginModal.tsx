import React, { useState } from 'react';
import { useEscapeKey } from './ui/useEscapeKey';
import { StaffUser } from '../types/isp';
import { loginAndStore } from '../sync/api';
import { X, Lock, Key, User, AlertCircle, Eye, EyeOff } from 'lucide-react';

interface UserLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: StaffUser[];
  currentUser: StaffUser;
  onLoginSuccess: (user: StaffUser) => void;
}

// الغلاف يضمن استدعاء الـ hooks دائماً بنفس الترتيب (قواعد React)، ويعيد ضبط الحقول عند كل فتح
export const UserLoginModal: React.FC<UserLoginModalProps> = (props) =>
  props.isOpen ? <UserLoginModalInner {...props} /> : null;

const UserLoginModalInner: React.FC<UserLoginModalProps> = ({
  isOpen,
  onClose,
  users,
  currentUser,
  onLoginSuccess,
}) => {
  useEscapeKey(onClose);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // التحقق يتم على الخادم؛ عند النجاح تُستبدل جلسة هذا الجهاز بجلسة الحساب الجديد
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const user = await loginAndStore(username.trim(), password.trim());
      onLoginSuccess(user);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // اختيار الحساب يملأ اسم المستخدم فقط؛ الدخول يتطلب كلمة المرور دائماً
  const handleQuickSwitch = (u: StaffUser) => {
    setUsername(u.username);
    setPassword('');
    setError(null);
  };

  return (
    <div className="app-overlay fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-800/80 border-b border-slate-700/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">تسجيل الدخول / تبديل المستخدم</h2>
              <p className="text-xs text-slate-400">حسابك الحالي: {currentUser.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-700/50 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 text-xs">
          {/* Quick Select from existing active users */}
          <div>
            <label className="block text-slate-300 font-semibold mb-2">
              اختر الحساب ثم أدخل كلمة المرور:
            </label>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {users.filter(u => u.isActive).map(u => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => handleQuickSwitch(u)}
                  className={`w-full p-2.5 rounded-xl border flex items-center justify-between transition cursor-pointer text-right ${
                    u.username === username
                      ? 'bg-indigo-950/60 border-indigo-500/60 text-white'
                      : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-slate-700 flex items-center justify-center text-xs font-bold text-white">
                      {u.name.charAt(0)}
                    </div>
                    <div>
                      <span className="font-bold block text-white">{u.name}</span>
                      <span className="text-[10px] text-slate-400 font-mono" dir="ltr">@{u.username}</span>
                    </div>
                  </div>

                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-900 border border-slate-700">
                    {u.role === 'admin' ? 'مدير' : u.role === 'accountant' ? 'محاسب' : 'فني'}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-slate-800"></div>
            <span className="flex-shrink mx-4 text-slate-500 text-[11px]">تسجيل الدخول</span>
            <div className="flex-grow border-t border-slate-800"></div>
          </div>

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">اسم المستخدم (Username)</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  placeholder="اسم المستخدم"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg pr-9 pl-3 py-2 text-white font-mono text-left focus:border-indigo-500"
                  dir="ltr"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">كلمة المرور (Password)</label>
              <div className="relative">
                <Key className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg pr-9 pl-10 py-2 text-white font-mono text-left focus:border-indigo-500"
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                  className="absolute left-3 top-2.5 text-slate-500 hover:text-slate-300 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-rose-950/60 border border-rose-800 p-2.5 rounded-xl text-rose-300 flex items-center gap-1.5 text-xs">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-wait text-white rounded-xl font-bold transition shadow-md shadow-indigo-600/30 cursor-pointer mt-1"
            >
              {busy ? 'جارٍ التحقق…' : 'تسجيل الدخول'}
            </button>

          </form>
        </div>
      </div>
    </div>
  );
};
