import React, { useState } from 'react';
import { api } from '../../services/api.ts';
import { Building2, Mail, Lock, ArrowLeft, ArrowRight, KeyRound, CheckCircle2, AlertCircle, Clock } from 'lucide-react';

type Step = 'form' | 'verify' | 'done';

export const RegistrationRequestModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [step, setStep] = useState<Step>('form');
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    requestedRole: 'FACULTY',
    collegeId: '',
    departmentId: '',
  });
  const [colleges, setColleges] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [verificationCode, setVerificationCode] = useState('');
  const [requestId, setRequestId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [resendTimer, setResendTimer] = useState(0);

  React.useEffect(() => {
    api.getColleges().then(setColleges).catch(() => {});
    api.getDepartments().then(setDepartments).catch(() => {});
  }, []);

  React.useEffect(() => {
    if (resendTimer > 0) {
      const t = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [resendTimer]);

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (form.password.length < 12) {
      setError('كلمة المرور يجب أن لا تقل عن 12 خانة');
      return;
    }
    setIsLoading(true);
    try {
      const res = await api.createRegistrationRequest(form);
      setRequestId(res.requestId);
      setInfo('تم إرسال رمز التحقق إلى بريدك الإلكتروني. يرجى إدخاله أدناه.');
      setStep('verify');
      setResendTimer(120);
    } catch (err: any) {
      setError(err?.message || 'فشل إنشاء طلب التسجيل');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      await api.verifyEmailCode(form.email, verificationCode, requestId);
      setStep('done');
    } catch (err: any) {
      setError(err?.message || 'فشل التحقق من الرمز');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendTimer > 0) return;
    setError(null);
    try {
      await api.resendVerificationCode(form.email);
      setInfo('تم إرسال رمز جديد إلى بريدك الإلكتروني.');
      setResendTimer(120);
    } catch (err: any) {
      setError(err?.message || 'فشل إعادة إرسال الرمز');
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 border border-slate-100">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-600 text-white shadow-lg mb-3">
            <Building2 className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">طلب إنشاء حساب جديد</h2>
          <p className="text-xs text-slate-500 mt-1">نظام متابعة الحضور - جامعة المستقبل</p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2 text-red-800 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
            <div>{error}</div>
          </div>
        )}

        {info && (
          <div className="mb-4 p-3 rounded-xl bg-blue-50 border border-blue-200 flex items-start gap-2 text-blue-800 text-xs">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-blue-600 mt-0.5" />
            <div>{info}</div>
          </div>
        )}

        {step === 'form' && (
          <form onSubmit={handleSubmitRequest} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">الاسم الكامل</label>
              <input type="text" required placeholder="د. أحمد عبد الله" value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full p-2.5 rounded-xl border border-slate-300 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">البريد الإلكتروني</label>
              <input type="email" required dir="ltr" placeholder="name@uomus.edu.iq" value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full p-2.5 rounded-xl border border-slate-300 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">كلمة المرور (12 خانة على الأقل)</label>
              <input type="password" required dir="ltr" placeholder="••••••••••••" value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full p-2.5 rounded-xl border border-slate-300 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">الدور المطلوب</label>
              <select value={form.requestedRole}
                onChange={(e) => setForm({ ...form, requestedRole: e.target.value })}
                className="w-full p-2.5 rounded-xl border border-slate-300 text-sm">
                <option value="FACULTY">عضو هيئة تدريس</option>
                <option value="DEPARTMENT_MONITOR">مسؤول قسم</option>
                <option value="COLLEGE_MONITOR">مسؤول كلية</option>
              </select>
            </div>
            {form.requestedRole !== 'FACULTY' && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">الكلية</label>
                  <select value={form.collegeId}
                    onChange={(e) => setForm({ ...form, collegeId: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-sm">
                    <option value="">-- اختر --</option>
                    {colleges.map((c) => <option key={c.id} value={c.id}>{c.nameAr}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">القسم</label>
                  <select value={form.departmentId}
                    onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-sm">
                    <option value="">-- اختر --</option>
                    {departments.filter((d) => !form.collegeId || d.collegeId === form.collegeId)
                      .map((d) => <option key={d.id} value={d.id}>{d.nameAr}</option>)}
                  </select>
                </div>
              </div>
            )}
            <div className="flex justify-between items-center pt-3 border-t border-slate-100">
              <button type="button" onClick={onClose}
                className="text-xs text-slate-600 hover:text-slate-900 flex items-center gap-1">
                <ArrowRight className="w-3.5 h-3.5" /> العودة لتسجيل الدخول
              </button>
              <button type="submit" disabled={isLoading}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-medium text-sm hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2">
                {isLoading ? 'جاري الإرسال...' : 'تقديم الطلب'} <ArrowLeft className="w-4 h-4" />
              </button>
            </div>
          </form>
        )}

        {step === 'verify' && (
          <form onSubmit={handleVerify} className="space-y-4">
            <div className="text-center">
              <KeyRound className="w-10 h-10 text-emerald-600 mx-auto mb-2" />
              <p className="text-sm text-slate-700">أدخل رمز التحقق المرسل إلى بريدك</p>
            </div>
            <input type="text" required dir="ltr" maxLength={6} placeholder="000000" value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
              className="w-full p-3 rounded-xl border border-slate-300 text-center text-2xl tracking-[0.5em] font-bold" />
            <div className="flex items-center justify-between">
              <button type="button" onClick={handleResend} disabled={resendTimer > 0}
                className="text-xs text-emerald-600 hover:text-emerald-700 disabled:text-slate-400 disabled:cursor-not-allowed">
                {resendTimer > 0 ? `إعادة الإرسال بعد ${resendTimer}ث` : 'إعادة إرسال الرمز'}
              </button>
            </div>
            <button type="submit" disabled={isLoading}
              className="w-full py-3 rounded-xl bg-emerald-600 text-white font-medium text-sm hover:bg-emerald-700 disabled:opacity-50">
              {isLoading ? 'جاري التحقق...' : 'تأكيد الرمز'}
            </button>
          </form>
        )}

        {step === 'done' && (
          <div className="text-center py-6">
            <Clock className="w-12 h-12 text-emerald-600 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-900 mb-2">تم تأكيد بريدك الإلكتروني</h3>
            <p className="text-sm text-slate-600 mb-4">
              أصبح طلبك بانتظار موافقة الإدارة. سيتم تفعيل حسابك بعد مراجعة الطلب من قبل مسؤول النظام.
            </p>
            <button onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-medium text-sm hover:bg-emerald-700">
              العودة لتسجيل الدخول
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
