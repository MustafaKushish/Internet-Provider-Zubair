import React, { useState } from 'react';
import { StaffUser, UserRole } from '../../types/isp';
import {
  Users,
  ShieldCheck,
  Plus,
  Edit,
  Trash2,
  Key,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  Lock,
  UserCheck,
  Sparkles,
  Phone,
  ShieldAlert
} from 'lucide-react';

interface UsersManagementViewProps {
  currentUser: StaffUser;
  users: StaffUser[];
  onSaveUser: (user: Partial<StaffUser>) => void;
  onDeleteUser: (userId: string) => void;
  onSwitchUser: (user: StaffUser) => void;
  forceOpenAddModal?: boolean;
  onResetForceOpenAddModal?: () => void;
}

export const UsersManagementView: React.FC<UsersManagementViewProps> = ({
  currentUser,
  users,
  onSaveUser,
  onDeleteUser,
  onSwitchUser,
  forceOpenAddModal,
  onResetForceOpenAddModal,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<StaffUser | null>(null);

  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('accountant');
  const [phone, setPhone] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  const handleOpenAdd = () => {
    setEditingUser(null);
    setName('');
    setUsername(`user_${Math.floor(100 + Math.random() * 900)}`);
    setPassword(generatePassword());
    setRole('accountant');
    setPhone('');
    setIsActive(true);
    setIsModalOpen(true);
  };

  React.useEffect(() => {
    if (forceOpenAddModal) {
      handleOpenAdd();
      if (onResetForceOpenAddModal) {
        onResetForceOpenAddModal();
      }
    }
  }, [forceOpenAddModal]);

  const handleOpenEdit = (user: StaffUser) => {
    setEditingUser(user);
    setName(user.name);
    setUsername(user.username);
    // كلمات المرور محفوظة مشفرة على الخادم؛ الحقل الفارغ يعني عدم التغيير
    setPassword('');
    setRole(user.role);
    setPhone(user.phone || '');
    setIsActive(user.isActive);
    setIsModalOpen(true);
  };

  const generatePassword = () => {
    const chars = 'abcdefghjkmnpqrstuvwxyz23456789@#';
    let res = '';
    for (let i = 0; i < 8; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return res;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !username.trim()) return;
    if (!editingUser && !password.trim()) return;
    if (password.trim() && password.trim().length < 8) {
      alert('يجب أن تتكون كلمة المرور من 8 خانات على الأقل.');
      return;
    }

    onSaveUser({
      id: editingUser ? editingUser.id : undefined,
      name: name.trim(),
      username: username.trim(),
      password: password.trim() || undefined,
      role,
      phone: phone.trim(),
      isActive,
      createdAt: editingUser ? editingUser.createdAt : undefined,
    });

    setIsModalOpen(false);
  };

  const getRoleBadge = (r: UserRole) => {
    switch (r) {
      case 'admin':
        return (
          <span className="bg-rose-950/70 text-rose-300 border border-rose-800 text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 w-fit">
            <ShieldCheck className="w-3 h-3 text-rose-400" />
            <span>مدير عام (Admin)</span>
          </span>
        );
      case 'accountant':
        return (
          <span className="bg-cyan-950/70 text-cyan-300 border border-cyan-800 text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 w-fit">
            <UserCheck className="w-3 h-3 text-cyan-400" />
            <span>محاسب / جباية (Accountant)</span>
          </span>
        );
      case 'technician':
        return (
          <span className="bg-amber-950/70 text-amber-300 border border-amber-800 text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 w-fit">
            <span>فني شبكة وصيانة (Technician)</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>إدارة المستخدمين والمشرفين (Admin & Staff)</span>
                <span className="text-xs bg-rose-950 text-rose-300 border border-rose-800 px-2 py-0.2 rounded font-bold">
                  صلاحيات الإدارة
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                يمكن للمدير العام إنشاء حسابات جديدة للموظفين، تعيين الصلاحيات، ومتابعة تسجيل الدخول
              </p>
            </div>
          </div>
        </div>

        {currentUser.role === 'admin' ? (
          <button
            onClick={handleOpenAdd}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-indigo-600/30 transition cursor-pointer self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>إنشاء مستخدم جديد (موظف أو مدير)</span>
          </button>
        ) : (
          <span className="px-3 py-2 bg-slate-800 text-slate-500 rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-slate-700 cursor-not-allowed">
            <Lock className="w-4 h-4" />
            <span>إنشاء الحسابات للمدير فقط</span>
          </span>
        )}
      </div>

      {/* Non-Admin Notice if switched to sub-account */}
      {currentUser.role !== 'admin' && (
        <div className="bg-amber-950/60 border border-amber-800/80 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-400 flex-shrink-0" />
            <p className="text-amber-200">
              أنت مسجل حالياً بحساب ({currentUser.name} - {currentUser.role === 'accountant' ? 'محاسب' : 'فني'}). صلاحية إنشاء وتعديل المستخدمين مخصصة لحساب المدير العام.
            </p>
          </div>
          {users.find(u => u.role === 'admin') && (
            <button
              onClick={() => onSwitchUser(users.find(u => u.role === 'admin')!)}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-bold flex-shrink-0 cursor-pointer shadow-md"
            >
              تسجيل الدخول بحساب المدير (يتطلب كلمة المرور)
            </button>
          )}
        </div>
      )}

      {/* Current User Card */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-cyan-600/30 text-cyan-300 border border-cyan-500/40 flex items-center justify-center font-bold text-sm">
            {currentUser.name.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">الحساب النشط حالياً:</span>
              <strong className="text-sm text-white">{currentUser.name}</strong>
              <span className="text-xs font-mono text-cyan-400 font-bold bg-slate-950 px-2 py-0.5 rounded border border-slate-800" dir="ltr">
                @{currentUser.username}
              </span>
            </div>
            <div className="mt-1">
              {getRoleBadge(currentUser.role)}
            </div>
          </div>
        </div>

        <div className="text-xs text-slate-400 text-left">
          <span className="block text-emerald-400 font-semibold flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>جلسة نشطة ومصرح بها</span>
          </span>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
            <span>قائمة مستخدمي وموظفي المنظومة ({users.length})</span>
          </h3>
          <span className="text-xs text-slate-400">
            يمكنك تبديل الحساب النشط بالضغط على زر "تسجيل الدخول بهذا الحساب"
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-800 text-slate-300 font-bold">
              <tr>
                <th className="p-3">اسم الموظف</th>
                <th className="p-3">اسم الدخول (Username)</th>
                <th className="p-3">كلمة المرور</th>
                <th className="p-3">الدور / الصلاحية</th>
                <th className="p-3">الهاتف</th>
                <th className="p-3">الحالة</th>
                <th className="p-3 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-200">
              {users.map((user) => {
                const isCurrent = user.id === currentUser.id;

                return (
                  <tr key={user.id} className="hover:bg-slate-800/40">
                    <td className="p-3 font-bold text-white flex items-center gap-2">
                      <span>{user.name}</span>
                      {isCurrent && (
                        <span className="bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] px-1.5 py-0.2 rounded font-normal">
                          أنت حالياً
                        </span>
                      )}
                    </td>
                    <td className="p-3 font-mono font-bold text-cyan-400" dir="ltr">
                      {user.username}
                    </td>
                    <td className="p-3 font-mono text-slate-500" dir="ltr" title="كلمة المرور مخفية، يمكن تغييرها من زر التعديل">
                      ••••••••
                    </td>
                    <td className="p-3">
                      {getRoleBadge(user.role)}
                    </td>
                    <td className="p-3 font-mono text-slate-400" dir="ltr">
                      {user.phone || '-'}
                    </td>
                    <td className="p-3">
                      {currentUser.role === 'admin' ? (
                        <button
                          type="button"
                          onClick={() => {
                            if (user.id === 'user_admin_1') {
                              alert('لا يمكن تعطيل حساب المدير الأساسي للمنظومة!');
                              return;
                            }
                            onSaveUser({ id: user.id, isActive: !user.isActive });
                          }}
                          title={user.isActive ? 'اضغط لتعطيل الحساب' : 'اضغط لتفعيل الحساب'}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition cursor-pointer border ${
                            user.isActive
                              ? 'bg-emerald-950/70 hover:bg-rose-950/70 text-emerald-300 hover:text-rose-300 border-emerald-800 hover:border-rose-800'
                              : 'bg-rose-950/70 hover:bg-emerald-950/70 text-rose-300 hover:text-emerald-300 border-rose-800 hover:border-emerald-800'
                          }`}
                        >
                          {user.isActive ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                              <span>مفعل (نشط)</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3.5 h-3.5 text-rose-400" />
                              <span>معطل</span>
                            </>
                          )}
                        </button>
                      ) : (
                        <span
                          title="صلاحية تفعيل وتعطيل الحسابات مخصصة للمدير العام فقط"
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold ${
                            user.isActive ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {user.isActive ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                          <span>{user.isActive ? 'مفعل' : 'معطل'}</span>
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {!isCurrent && (
                          <button
                            onClick={() => onSwitchUser(user)}
                            title="تسجيل الدخول بهذا الحساب (يتطلب كلمة المرور)"
                            className="bg-indigo-600 hover:bg-indigo-500 text-white px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer"
                          >
                            دخول بهذا الحساب
                          </button>
                        )}
                        <button
                          onClick={() => handleOpenEdit(user)}
                          title="تعديل المستخدم"
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg border border-slate-700 cursor-pointer"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        {user.id !== 'user_admin_1' && (
                          <button
                            onClick={() => {
                              if (confirm(`هل أنت متأكد من حذف حساب (${user.name})؟`)) {
                                onDeleteUser(user.id);
                              }
                            }}
                            title="حذف المستخدم"
                            className="p-1.5 bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-300 rounded-lg border border-slate-700 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Permissions Breakdown Guide */}
      <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-5 space-y-3 text-xs text-slate-300">
        <h4 className="font-bold text-white flex items-center gap-2 text-sm text-cyan-400">
          <ShieldAlert className="w-4 h-4" />
          <span>جدول الصلاحيات والأدوار في المنظومة</span>
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 space-y-1">
            <strong className="text-rose-400 block">1. المدير العام (Admin):</strong>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              صلاحية كاملة لإدارة المشتركين، إنشاء وحذف الموظفين، ضبط أسعار المزودين، الوصول للتقارير المالية، والنسخ الاحتياطي.
            </p>
          </div>
          <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 space-y-1">
            <strong className="text-cyan-400 block">2. المحاسب والجباية (Accountant):</strong>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              تسجيل وصولات الدفع، تجديد اشتراكات المشتركين، وإرسال تذكيرات الواتساب ومتابعة الديون دون صلاحية لحذف السجلات أو تعديل المستخدمين.
            </p>
          </div>
          <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 space-y-1">
            <strong className="text-amber-400 block">3. فني الصيانة والشبكة (Technician):</strong>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              استقبال ومتابعة تذاكر الأعطال الفنية، تحديث حالة الصيانة، الاطلاع على بيانات اليوزر والراوتر لمعالجة مشاكل المشتركين.
            </p>
          </div>
        </div>
      </div>

      {/* Create / Edit User Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="font-bold text-white text-base">
              {editingUser ? 'تعديل بيانات المستخدم' : 'إنشاء حساب موظف / مشرف جديد'}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  اسم الموظف الكامل <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثال: علي محمد فني الصيانة"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  اسم تسجيل الدخول (Username) <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="ali_tech"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-cyan-300 font-mono text-left focus:outline-none focus:border-indigo-500"
                  dir="ltr"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-slate-300 font-semibold">
                    {editingUser ? 'كلمة مرور جديدة (اتركها فارغة لعدم التغيير)' : 'كلمة المرور المؤقتة (Password)'}
                    {!editingUser && <span className="text-rose-400"> *</span>}
                  </label>
                  <button
                    type="button"
                    onClick={() => setPassword(generatePassword())}
                    className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>توليد باسورد</span>
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required={!editingUser}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg pr-3 pl-9 py-2 text-white font-mono text-left focus:outline-none focus:border-indigo-500"
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-2.5 top-2 text-slate-400 hover:text-white cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  الدور والصلاحية في المنظومة <span className="text-rose-400">*</span>
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500 font-semibold"
                >
                  <option value="admin">مدير عام (Admin) - صلاحيات كاملة</option>
                  <option value="accountant">محاسب / جباية (Accountant) - وصولات وتجديد</option>
                  <option value="technician">فني صيانة (Technician) - بلاغات وأبراج</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">رقم الهاتف (الواتساب)</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0771xxxxxxx"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono text-left focus:outline-none focus:border-indigo-500"
                  dir="ltr"
                />
              </div>

              <div className="pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="rounded bg-slate-800 border-slate-700 text-indigo-600"
                  />
                  <span className="text-slate-300 font-semibold">حساب نشط ومفعل لتسجيل الدخول</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-slate-400 hover:text-white cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold shadow-md shadow-indigo-600/30 cursor-pointer"
                >
                  {editingUser ? 'حفظ التعديلات' : 'إنشاء المستخدم'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
