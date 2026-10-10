import React from 'react';

/** شاشة انتظار أثناء تحميل قسم (هيكل بطاقات متلألئ بدل سطر نصي) */
export const ViewLoader: React.FC<{ label?: string }> = ({ label = 'جارٍ التحميل…' }) => (
  <div className="space-y-4 py-2" role="status" aria-live="polite">
    <div className="flex items-center gap-3 text-xs text-slate-400">
      <span className="relative w-5 h-5">
        <span className="absolute inset-0 rounded-full border-2 border-slate-700" />
        <span className="absolute inset-0 rounded-full border-2 border-transparent border-t-cyan-400 border-l-indigo-400 spin-slow" />
      </span>
      {label}
    </div>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {[0, 1, 2, 3].map(i => (
        <div key={i} className="skeleton h-24 rounded-2xl" />
      ))}
    </div>
    <div className="skeleton h-64 rounded-2xl" />
  </div>
);
