import React, { useState, useEffect } from 'react';
import { api } from '../../services/api.ts';
import { GraduationCap, Plus, Trash2, Edit2, Building, CheckCircle2, AlertCircle } from 'lucide-react';

export const CollegeDepartmentView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'colleges' | 'departments'>('colleges');
  const [colleges, setColleges] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // College Modal State
  const [isCollegeModalOpen, setIsCollegeModalOpen] = useState(false);
  const [collegeForm, setCollegeForm] = useState({ nameAr: '', nameEn: '', code: '' });

  // Dept Modal State
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [deptForm, setDeptForm] = useState({ collegeId: '', nameAr: '', nameEn: '', code: '' });

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [colRes, depRes] = await Promise.allSettled([
        api.getColleges(),
        api.getDepartments(),
      ]);
      const col = colRes.status === 'fulfilled' ? colRes.value || [] : [];
      const dep = depRes.status === 'fulfilled' ? depRes.value || [] : [];
      setColleges(col);
      setDepartments(dep);
      if (col.length > 0 && !deptForm.collegeId) {
        setDeptForm((prev) => ({ ...prev, collegeId: col[0].id }));
      }
    } catch {
      // safe fallback
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateCollege = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createCollege(collegeForm);
      setMessage({ type: 'success', text: 'تمت إضافة الكلية بنجاح!' });
      setIsCollegeModalOpen(false);
      setCollegeForm({ nameAr: '', nameEn: '', code: '' });
      loadData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'تعذر إضافة الكلية' });
    }
  };

  const handleDeleteCollege = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذه الكلية؟')) return;
    try {
      await api.deleteCollege(id);
      loadData();
    } catch (err: any) {
      alert(err?.message || 'تعذر حذف الكلية');
    }
  };

  const handleCreateDept = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createDepartment(deptForm);
      setMessage({ type: 'success', text: 'تمت إضافة القسم الأكاديمي بنجاح!' });
      setIsDeptModalOpen(false);
      setDeptForm({ collegeId: colleges[0]?.id || '', nameAr: '', nameEn: '', code: '' });
      loadData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'تعذر إضافة القسم' });
    }
  };

  const handleDeleteDept = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا القسم؟')) return;
    try {
      await api.deleteDepartment(id);
      loadData();
    } catch (err: any) {
      alert(err?.message || 'تعذر حذف القسم');
    }
  };

  const getCollegeName = (id: string) => colleges.find((c) => c.id === id)?.nameAr || 'كلية عامة';

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">الكليات والأقسام العلمية</h2>
              <p className="text-xs text-slate-500">
                إدارة البنية الأكاديمية وكليات وأقسام جامعة المستقبل
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            {activeTab === 'colleges' ? (
              <button
                onClick={() => setIsCollegeModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs shadow-xs"
              >
                <Plus className="w-4 h-4" />
                إضافة كلية جديدة
              </button>
            ) : (
              <button
                onClick={() => setIsDeptModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs shadow-xs"
              >
                <Plus className="w-4 h-4" />
                إضافة قسم أكاديمي
              </button>
            )}
          </div>
        </div>

        {/* Tab selection */}
        <div className="flex border-b border-slate-200 mt-6 gap-6 text-sm">
          <button
            onClick={() => setActiveTab('colleges')}
            className={`pb-3 font-semibold transition-colors border-b-2 ${
              activeTab === 'colleges'
                ? 'border-emerald-600 text-emerald-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            الكليات الأكاديمية ({colleges.length})
          </button>
          <button
            onClick={() => setActiveTab('departments')}
            className={`pb-3 font-semibold transition-colors border-b-2 ${
              activeTab === 'departments'
                ? 'border-emerald-600 text-emerald-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            الأقسام العلمية ({departments.length})
          </button>
        </div>

        {message && (
          <div
            className={`mt-4 p-3.5 rounded-xl text-xs flex items-center gap-2 ${
              message.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600" />
            )}
            {message.text}
          </div>
        )}

        {isLoading ? (
          <div className="py-16 text-center text-slate-400 text-sm">جاري التحميل...</div>
        ) : activeTab === 'colleges' ? (
          colleges.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-sm">
              لم تُضف كليات بعد. أضف كلية للبدء في ربط الأقسام والجداول.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
              {colleges.map((c) => (
                <div
                  key={c.id}
                  className="p-5 rounded-2xl border border-slate-200 bg-white hover:border-emerald-300 transition-all shadow-xs flex flex-col justify-between"
                >
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-semibold">
                        {c.code || 'COL'}
                      </span>
                      <button
                        onClick={() => handleDeleteCollege(c.id)}
                        className="text-slate-400 hover:text-red-600 p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <h3 className="font-bold text-slate-900 text-base">{c.nameAr}</h3>
                    {c.nameEn && <p className="text-xs text-slate-400 mt-0.5">{c.nameEn}</p>}
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500">
                    عدد الأقسام التابعة:{' '}
                    <span className="font-semibold text-slate-800">
                      {departments.filter((d) => d.collegeId === c.id).length}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : departments.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">
            لم تُضف أقسام بعد. أضف قسماً واربطه بكليته.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
            {departments.map((d) => (
              <div
                key={d.id}
                className="p-5 rounded-2xl border border-slate-200 bg-white hover:border-emerald-300 transition-all shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 font-semibold">
                      {d.code || 'DEPT'}
                    </span>
                    <button
                      onClick={() => handleDeleteDept(d.id)}
                      className="text-slate-400 hover:text-red-600 p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <h3 className="font-bold text-slate-900 text-base">{d.nameAr}</h3>
                  <p className="text-xs text-emerald-700 font-medium mt-1">
                    {getCollegeName(d.collegeId)}
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-400 font-mono">
                  ID: {d.id.slice(0, 8)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* College Modal */}
      {isCollegeModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <h3 className="font-bold text-slate-900 text-base mb-4">إضافة كلية جديدة</h3>
            <form onSubmit={handleCreateCollege} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">اسم الكلية بالعربية</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: كلية الهندسة والتقنيات الهندسية"
                  value={collegeForm.nameAr}
                  onChange={(e) => setCollegeForm({ ...collegeForm, nameAr: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-300"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">الاسم بالإنجليزية</label>
                <input
                  type="text"
                  placeholder="College of Engineering"
                  value={collegeForm.nameEn}
                  onChange={(e) => setCollegeForm({ ...collegeForm, nameEn: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-300"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">رمز الكلية المختصر</label>
                <input
                  type="text"
                  placeholder="ENG"
                  value={collegeForm.code}
                  onChange={(e) => setCollegeForm({ ...collegeForm, code: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-300 uppercase"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCollegeModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700"
                >
                  إضافة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dept Modal */}
      {isDeptModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <h3 className="font-bold text-slate-900 text-base mb-4">إضافة قسم أكاديمي جديد</h3>
            <form onSubmit={handleCreateDept} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">الكلية التابع لها</label>
                <select
                  required
                  value={deptForm.collegeId}
                  onChange={(e) => setDeptForm({ ...deptForm, collegeId: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-300"
                >
                  <option value="">-- اختر الكلية --</option>
                  {colleges.map((c) => (
                    <option key={c.id} value={c.id}>{c.nameAr}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">اسم القسم بالعربية</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: هندسة تقنيات الحاسوب"
                  value={deptForm.nameAr}
                  onChange={(e) => setDeptForm({ ...deptForm, nameAr: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-300"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">رمز القسم المختصر</label>
                <input
                  type="text"
                  placeholder="CPE"
                  value={deptForm.code}
                  onChange={(e) => setDeptForm({ ...deptForm, code: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-300 uppercase"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsDeptModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700"
                >
                  إضافة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
