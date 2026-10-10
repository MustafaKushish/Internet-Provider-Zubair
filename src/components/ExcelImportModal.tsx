import React, { useState } from 'react';
import { useEscapeKey } from './ui/useEscapeKey';
import { Subscriber } from '../types/isp';
import { parseExcelSubscribers } from '../utils/storage';
import { X, Upload, FileSpreadsheet, Check, AlertCircle, RefreshCw } from 'lucide-react';

interface ExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: (subscribers: Partial<Subscriber>[], replaceAll: boolean) => void;
}

// الغلاف يضمن استدعاء الـ hooks دائماً بنفس الترتيب (قواعد React)، ويعيد ضبط الحقول عند كل فتح
export const ExcelImportModal: React.FC<ExcelImportModalProps> = (props) =>
  props.isOpen ? <ExcelImportModalInner {...props} /> : null;

const ExcelImportModalInner: React.FC<ExcelImportModalProps> = ({
  isOpen,
  onClose,
  onImportComplete,
}) => {
  useEscapeKey(onClose);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsedRows, setParsedRows] = useState<Partial<Subscriber>[]>([]);
  const [replaceAll, setReplaceAll] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    try {
      const rows = await parseExcelSubscribers(file);
      if (rows.length === 0) {
        setError('الملف لا يحتوي على بيانات أو الصفوف فارغة.');
      } else {
        setParsedRows(rows);
      }
    } catch (err: any) {
      console.error(err);
      setError('حدث خطأ أثناء قراءة ملف الإكسل. يرجى التأكد من صيغة الملف (.xlsx أو .xls أو .csv)');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    if (parsedRows.length === 0) return;
    onImportComplete(parsedRows, replaceAll);
    onClose();
  };

  return (
    <div className="app-overlay fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-3xl w-full shadow-2xl overflow-hidden my-6">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-800/80 border-b border-slate-700/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">استيراد المشتركين من ملف إكسل (Excel / CSV)</h2>
              <p className="text-xs text-slate-400">انقل بياناتك القديمة بسهولة دون الحاجة لكتابة كل مشترك يدوياً</p>
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
        <div className="p-6 space-y-4">
          {parsedRows.length === 0 ? (
            <div className="border-2 border-dashed border-slate-700 hover:border-cyan-500 rounded-2xl p-8 text-center transition bg-slate-950/50">
              <input
                type="file"
                id="excel-file-input"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileUpload}
                className="hidden"
              />
              <label htmlFor="excel-file-input" className="cursor-pointer flex flex-col items-center">
                <div className="w-16 h-16 rounded-2xl bg-cyan-950/60 text-cyan-400 border border-cyan-800 flex items-center justify-center mb-3">
                  <Upload className="w-8 h-8" />
                </div>
                <span className="text-sm font-bold text-white mb-1">
                  اختر ملف إكسل أو قم بسحبه هنا
                </span>
                <span className="text-xs text-slate-400 mb-4">
                  يدعم صيغ .xlsx و .xls و .csv (قوائم الإكسل الشائعة لأصحاب الأبراج)
                </span>
                <span className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition">
                  تصفح الملفات من جهازك
                </span>
              </label>

              {loading && (
                <div className="mt-4 flex items-center justify-center gap-2 text-cyan-400 text-xs">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>جاري قراءة ومعالجة الملف...</span>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-emerald-950/30 border border-emerald-800/40 p-3 rounded-xl flex items-center justify-between text-xs">
                <span className="text-emerald-300 font-bold flex items-center gap-1.5">
                  <Check className="w-4 h-4" />
                  <span>تم استخراج {parsedRows.length} مشترك بنجاح من الملف!</span>
                </span>
                <button
                  type="button"
                  onClick={() => setParsedRows([])}
                  className="text-slate-400 hover:text-white underline text-[11px]"
                >
                  اختيار ملف آخر
                </button>
              </div>

              {/* Preview table */}
              <div className="max-h-60 overflow-y-auto border border-slate-800 rounded-xl">
                <table className="w-full text-xs text-right">
                  <thead className="bg-slate-800 text-slate-300 sticky top-0">
                    <tr>
                      <th className="p-2">الاسم</th>
                      <th className="p-2">الهاتف</th>
                      <th className="p-2">اليوزر</th>
                      <th className="p-2">الباقة والمزود</th>
                      <th className="p-2">البيع</th>
                      <th className="p-2">الانتهاء</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-200">
                    {parsedRows.slice(0, 15).map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/40">
                        <td className="p-2 font-bold">{row.name}</td>
                        <td className="p-2 font-mono" dir="ltr">{row.phone}</td>
                        <td className="p-2 font-mono text-cyan-400">{row.username}</td>
                        <td className="p-2">{row.planName} • {row.upstreamProvider}</td>
                        <td className="p-2 font-bold">{row.salePrice?.toLocaleString()} د.ع</td>
                        <td className="p-2 text-slate-400">{row.expiryDate}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {parsedRows.length > 15 && (
                <p className="text-[11px] text-slate-500 text-center">
                  يتم عرض أول 15 مشتركاً للمعاينة فقط. سيتم استيراد كافة المشتركين ({parsedRows.length}).
                </p>
              )}

              {/* Options */}
              <div className="pt-2">
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={replaceAll}
                    onChange={(e) => setReplaceAll(e.target.checked)}
                    className="rounded bg-slate-900 border-slate-700 text-rose-500"
                  />
                  <span>استبدال كافة المشتركين الحاليين (مسح القائمة القديمة واستبدالها بهذا الملف)</span>
                </label>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-rose-950/40 border border-rose-800 p-3 rounded-xl flex items-center gap-2 text-xs text-rose-300">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Actions */}
          <div className="pt-2 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-700 text-slate-300 hover:text-white text-xs font-semibold cursor-pointer"
            >
              إلغاء
            </button>
            {parsedRows.length > 0 && (
              <button
                type="button"
                onClick={handleConfirm}
                className="px-6 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/30 transition cursor-pointer"
              >
                تأكيد استيراد {parsedRows.length} مشترك
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
