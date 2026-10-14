import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { Building2, Lock, Mail, AlertCircle, ArrowLeft } from 'lucide-react';

export const LoginModal: React.FC = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      await login({ email, password });
    } catch (err: any) {
      setError(err?.message || 'فشل تسجيل الدخول. تحقق من صحة البريد وكلمة المرور.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickLogin = async (quickEmail: string, quickPass: string) => {
    setEmail(quickEmail);
    setPassword(quickPass);
    setError(null);
    setIsLoading(true);
    try {
      await login({ email: quickEmail, password: quickPass });
    } catch (err: any) {
      setError(err?.message || 'تعذر تسجيل الدخول بالحساب المحدد');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 border border-slate-100">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 mb-4">
            <Building2 className="w-9 h-9" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900">جامعة المستقبل</h2>
          <p className="text-sm text-slate-500 mt-1">
            نظام متابعة حضور التدريسيين والمحاضرات الأكاديمية
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3 text-red-800 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0 text-red-600 mt-0.5" />
            <div>{error}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              البريد الإلكتروني الأكاديمي
            </label>
            <div className="relative">
              <input
                type="email"
                required
                dir="ltr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@uomus.edu.iq"
                className="w-full px-4 py-2.5 pl-10 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm placeholder:text-slate-400"
              />
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              كلمة المرور
            </label>
            <div className="relative">
              <input
                type="password"
                required
                dir="ltr"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-4 py-2.5 pl-10 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm placeholder:text-slate-400"
              />
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm transition-colors shadow-md shadow-emerald-600/20 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <span>جاري تسجيل الدخول...</span>
            ) : (
              <>
                <span>دخول إلى النظام</span>
                <ArrowLeft className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-100">
          <p className="text-xs text-center text-slate-400 mb-3">
            حسابات تجريبية سريعة للاختبار والتشغيل
          </p>
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => handleQuickLogin('admin@uomus.edu.iq', 'Admin@12345678')}
              disabled={isLoading}
              className="w-full text-xs text-right py-2 px-3 rounded-lg bg-emerald-50/60 hover:bg-emerald-100/70 border border-emerald-200 text-slate-800 flex justify-between items-center transition-colors"
            >
              <span className="font-semibold text-emerald-900">مالك النظام (الجامعة)</span>
              <span className="text-emerald-700 font-mono text-[11px]">admin@uomus.edu.iq</span>
            </button>
            <button
              type="button"
              onClick={() => handleQuickLogin('eng.dean@uomus.edu.iq', 'Admin@12345678')}
              disabled={isLoading}
              className="w-full text-xs text-right py-2 px-3 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 flex justify-between items-center transition-colors"
            >
              <span className="font-semibold text-slate-800">مراقب كلية الهندسة</span>
              <span className="text-slate-500 font-mono text-[11px]">eng.dean@uomus.edu.iq</span>
            </button>
            <button
              type="button"
              onClick={() => handleQuickLogin('cs.head@uomus.edu.iq', 'Admin@12345678')}
              disabled={isLoading}
              className="w-full text-xs text-right py-2 px-3 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 flex justify-between items-center transition-colors"
            >
              <span className="font-semibold text-slate-800">مراقب قسم هندسة الحاسوب</span>
              <span className="text-slate-500 font-mono text-[11px]">cs.head@uomus.edu.iq</span>
            </button>
            <button
              type="button"
              onClick={() => handleQuickLogin('faculty.ibraheem@uomus.edu.iq', 'Admin@12345678')}
              disabled={isLoading}
              className="w-full text-xs text-right py-2 px-3 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 flex justify-between items-center transition-colors"
            >
              <span className="font-semibold text-slate-800">أ.د. إبراهيم (عضو هيئة تدريسية)</span>
              <span className="text-slate-500 font-mono text-[11px]">faculty.ibraheem@uomus.edu.iq</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
