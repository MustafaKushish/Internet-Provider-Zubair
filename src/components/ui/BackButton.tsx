import React from 'react';
import { ArrowRight } from 'lucide-react';

/** زر «رجوع» واضح في رأس كل نافذة (بدل علامة × الصغيرة) */
export const BackButton: React.FC<{ onClick: () => void; className?: string }> = ({ onClick, className = '' }) => (
  <button
    type="button"
    onClick={onClick}
    className={`h-10 px-3 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-200 hover:text-white hover:bg-slate-700 text-sm font-semibold flex items-center gap-1.5 flex-shrink-0 cursor-pointer no-print ${className}`}
  >
    <ArrowRight className="w-5 h-5" />
    رجوع
  </button>
);
