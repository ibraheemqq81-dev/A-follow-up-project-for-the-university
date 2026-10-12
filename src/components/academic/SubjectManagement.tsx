import React, { useState, useEffect } from 'react';
import { api } from '../../services/api.ts';
import { BookOpen, Plus, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';

export const SubjectManagement: React.FC = () => {
  const [subjects, setSubjects] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [stages, setStages] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({
    nameAr: '',
    nameEn: '',
    code: '',
    departmentId: '',
    stageId: '',
    type: 'THEORETICAL',
    theoreticalHours: 2,
    practicalHours: 2,
    creditUnits: 3,
  });

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [sub, dep, stg] = await Promise.all([
        api.getSubjects(),
        api.getDepartments(),
        api.getStages(),
      ]);
      setSubjects(sub || []);
      setDepartments(dep || []);
      setStages(stg || []);
      if (dep && dep.length > 0 && !form.departmentId) {
        setForm((prev) => ({ ...prev, departmentId: dep[0].id }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createSubject(form);
      setMessage({ type: 'success', text: 'تمت إضافة المادة الدراسية بنجاح!' });
      setIsModalOpen(false);
      setForm({
        nameAr: '',
        nameEn: '',
        code: '',
        departmentId: departments[0]?.id || '',
        stageId: '',
        type: 'THEORETICAL',
        theoreticalHours: 2,
        practicalHours: 2,
        creditUnits: 3,
      });
      loadData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'تعذر إضافة المادة الدراسية' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذه المادة؟')) return;
    try {
      await api.deleteSubject(id);
      loadData();
    } catch (err: any) {
      alert(err?.message || 'تعذر حذف المادة');
    }
  };

  const getDeptName = (id?: string) => departments.find((d) => d.id === id)?.nameAr || '';

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">المواد والمناهج الدراسية</h2>
              <p className="text-xs text-slate-500">
                إدارة المقررات الدراسية، الساعات النظرية والعملية، والوحدات المعتمدة
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs shadow-xs"
          >
            <Plus className="w-4 h-4" />
            إضافة مادة دراسية
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
        ) : subjects.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">
            لا توجد مواد مسجلة حالياً. أضف مقرراً لربطه بالجداول والأنصبة.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
            {subjects.map((sub) => (
              <div
                key={sub.id}
                className="p-5 rounded-2xl border border-slate-200 bg-white hover:border-emerald-300 transition-all shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 font-semibold">
                      {sub.code || 'SUBJ'}
                    </span>
                    <button
                      onClick={() => handleDelete(sub.id)}
                      className="text-slate-400 hover:text-red-600 p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <h3 className="font-bold text-slate-900 text-base">{sub.nameAr}</h3>
                  {sub.nameEn && <p className="text-xs text-slate-400 mt-0.5">{sub.nameEn}</p>}
                  <p className="text-xs text-slate-500 mt-1">{getDeptName(sub.departmentId)}</p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between text-xs text-slate-600">
                  <span>
                    نظري: <strong>{sub.theoreticalHours || 0}س</strong> | عملي: <strong>{sub.practicalHours || 0}س</strong>
                  </span>
                  <span className="font-semibold text-emerald-700">
                    {sub.creditUnits || 0} وحدات
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <h3 className="font-bold text-slate-900 text-base mb-4">إضافة مادة دراسية جديدة</h3>
            <form onSubmit={handleCreate} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">القسم الأكاديمي</label>
                <select
                  required
                  value={form.departmentId}
                  onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-300"
                >
                  <option value="">-- اختر القسم --</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.nameAr}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">اسم المادة بالعربية</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: هندسة البرمجيات"
                  value={form.nameAr}
                  onChange={(e) => setForm({ ...form, nameAr: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-300"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">رمز المادة</label>
                  <input
                    type="text"
                    placeholder="SE-301"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-300 uppercase"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">عدد الوحدات</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={form.creditUnits}
                    onChange={(e) => setForm({ ...form, creditUnits: Number(e.target.value) })}
                    className="w-full p-2.5 rounded-xl border border-slate-300"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">ساعات النظري الأسبوعية</label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={form.theoreticalHours}
                    onChange={(e) => setForm({ ...form, theoreticalHours: Number(e.target.value) })}
                    className="w-full p-2.5 rounded-xl border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">ساعات العملي الأسبوعية</label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={form.practicalHours}
                    onChange={(e) => setForm({ ...form, practicalHours: Number(e.target.value) })}
                    className="w-full p-2.5 rounded-xl border border-slate-300"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
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
