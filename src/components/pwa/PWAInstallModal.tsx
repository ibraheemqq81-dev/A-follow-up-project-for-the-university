import React from 'react';
import { Download, Smartphone, Monitor, Share2, PlusSquare, X, CheckCircle2 } from 'lucide-react';

interface PWAInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  isIOS: boolean;
  onInstallClick?: () => Promise<boolean>;
}

export const PWAInstallModal: React.FC<PWAInstallModalProps> = ({
  isOpen,
  onClose,
  isIOS,
  onInstallClick,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in" dir="rtl">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-6 relative">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-5 left-5 p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          aria-label="إغلاق"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header with App Logo & Title */}
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center text-white shadow-md shrink-0">
            <Download className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
              تثبيت تطبيق جامعة المستقبل
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              نظام متابعة حضور التدريسيين والمحاضرات الأكاديمية (PWA)
            </p>
          </div>
        </div>

        {/* Key Features */}
        <div className="grid grid-cols-2 gap-3 bg-emerald-50/70 dark:bg-emerald-950/30 p-3.5 rounded-2xl border border-emerald-100 dark:border-emerald-900/40 text-xs text-emerald-900 dark:text-emerald-300 font-medium">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>تشغيل فوري وسريع من الشاشة الرئيسية</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>يعمل مثل تطبيق أصيل بدون شريط المتصفح</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>التقاط سريع لصور المحاضرات بالكاميرا</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>حفظ محلي آمن عند انقطاع الإنترنت</span>
          </div>
        </div>

        {/* Step-by-step instructions based on device */}
        {isIOS ? (
          <div className="space-y-3 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 text-sm">
            <h3 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-emerald-600" />
              <span>خطوات التثبيت على أجهزة iPhone و iPad (Safari):</span>
            </h3>
            <ol className="space-y-2.5 text-slate-600 dark:text-slate-300 list-decimal list-inside pr-1">
              <li className="leading-relaxed">
                اضغط على زر <strong className="text-emerald-600 dark:text-emerald-400 font-semibold inline-flex items-center gap-1">المشاركة <Share2 className="w-3.5 h-3.5 inline" /></strong> في أسفل شريط Safari.
              </li>
              <li className="leading-relaxed">
                مرّر للأسفل واختر <strong className="text-emerald-600 dark:text-emerald-400 font-semibold inline-flex items-center gap-1">إضافة إلى الصفحة الرئيسية <PlusSquare className="w-3.5 h-3.5 inline" /></strong>.
              </li>
              <li className="leading-relaxed">
                اضغط على <strong>إضافة (Add)</strong> في أعلى الزاوية ليظهر التطبيق فوراً على شاشتك.
              </li>
            </ol>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 text-sm space-y-2 text-slate-600 dark:text-slate-300">
              <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200">
                <Smartphone className="w-4 h-4 text-emerald-600" />
                <span>أندرويد / الحواسيب الشخصية (Chrome / Edge):</span>
              </div>
              <p className="text-xs leading-relaxed">
                يمكنك تثبيت النظام بنقرة واحدة ليعمل كتطبيق مستقل على هاتفك الذكي أو سطح المكتب.
              </p>
            </div>

            {onInstallClick && (
              <button
                type="button"
                onClick={async () => {
                  const success = await onInstallClick();
                  if (success) {
                    onClose();
                  }
                }}
                className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-base shadow-lg shadow-emerald-700/25 flex items-center justify-center gap-2.5 transition-all cursor-pointer"
              >
                <Download className="w-5 h-5" />
                <span>تثبيت التطبيق على الجهاز الآن</span>
              </button>
            )}
          </div>
        )}

        <div className="pt-2 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
