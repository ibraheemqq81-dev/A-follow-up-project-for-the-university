import React, { useState, useEffect } from 'react';
import { api } from '../../services/api.ts';
import { Layers, Plus, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';

export const StageSectionView: React.FC = () => {
  const [stages, setStages] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isStageModalOpen, setIsStageModalOpen] = useState(false);
  const [stageForm, setStageForm] = useState({ nameAr: '', yearNumber: 1, departmentId: '' });

  const [isSectionModalOpen, setIsSectionModalOpen] = useState(false);
  const [sectionForm, setSectionForm] = useState({ name: '', studentCount: 35, stageId: '', departmentId: '' });

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [stgRes, secRes, depRes] = await Promise.allSettled([
        api.getStages(),
        api.getSections(),
        api.getDepartments(),
      ]);
      const stg = stgRes.status === 'fulfilled' ? stgRes.value || [] : [];
      const sec = secRes.status === 'fulfilled' ? secRes.value || [] : [];
      const dep = depRes.status === 'fulfilled' ? depRes.value || [] : [];
      setStages(stg);
      setSections(sec);
      setDepartments(dep);
      if (dep && dep.length > 0 && !stageForm.departmentId) {
        setStageForm((prev) => ({ ...prev, departmentId: dep[0].id }));
        setSectionForm((prev) => ({ ...prev, departmentId: dep[0].id }));
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

  const handleCreateStage = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createStage(stageForm);
      setMessage({ type: 'success', text: 'تمت إضافة المرحلة الدراسية بنجاح!' });
      setIsStageModalOpen(false);
      setStageForm({ nameAr: '', yearNumber: 1, departmentId: departments[0]?.id || '' });
      loadData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'تعذر إضافة المرحلة' });
    }
  };

  const handleDeleteStage = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذه المرحلة؟')) return;
    try {
      await api.deleteStage(id);
      loadData();
    } catch (err: any) {
      alert(err?.message || 'تعذر حذف المرحلة');
    }
  };

  const handleCreateSection = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createSection(sectionForm);
      setMessage({ type: 'success', text: 'تمت إضافة الشعبة بنجاح!' });
      setIsSectionModalOpen(false);
      setSectionForm({ name: '', studentCount: 35, stageId: '', departmentId: departments[0]?.id || '' });
      loadData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'تعذر إضافة الشعبة' });
    }
  };

  const handleDeleteSection = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذه الشعبة؟')) return;
    try {
      await api.deleteSection(id);
      loadData();
    } catch (err: any) {
      alert(err?.message || 'تعذر حذف الشعبة');
    }
  };

  const getDeptName = (id?: string) => departments.find((d) => d.id === id)?.nameAr || 'قسم أكاديمي';
  const getStageName = (id?: string) => stages.find((s) => s.id === id)?.nameAr || 'مرحلة';

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-800 flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">المراحل والشعب الدراسية</h2>
              <p className="text-xs text-slate-500">
                إدارة المراحل الأكاديمية (الأولى إلى الرابعة) وتوزيع الشعب والطلبة
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setIsStageModalOpen(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium text-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              إضافة مرحلة
            </button>
            <button
              onClick={() => setIsSectionModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs shadow-xs"
            >
              <Plus className="w-4 h-4" />
              إضافة شعبة
            </button>
          </div>
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
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            {/* Stages List */}
            <div className="border border-slate-200 rounded-2xl p-5 bg-white">
              <h3 className="font-bold text-slate-900 text-sm mb-3">المراحل الدراسية ({stages.length})</h3>
              {stages.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">لا توجد مراحل مسجلة.</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {stages.map((s) => (
                    <div key={s.id} className="py-3 flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-slate-900 text-xs">{s.nameAr}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {getDeptName(s.departmentId)} — السنة {s.yearNumber || 1}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteStage(s.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Sections List */}
            <div className="border border-slate-200 rounded-2xl p-5 bg-white">
              <h3 className="font-bold text-slate-900 text-sm mb-3">الشعب وقوائم الطلبة ({sections.length})</h3>
              {sections.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">لا توجد شعب مسجلة.</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {sections.map((sec) => (
                    <div key={sec.id} className="py-3 flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-slate-900 text-xs flex items-center gap-2">
                          <span>الشعبة {sec.name}</span>
                          <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold">
                            {sec.studentCount || 0} طالب
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {getDeptName(sec.departmentId)} — {getStageName(sec.stageId)}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteSection(sec.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Stage Modal */}
      {isStageModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <h3 className="font-bold text-slate-900 text-base mb-4">إضافة مرحلة دراسية</h3>
            <form onSubmit={handleCreateStage} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">القسم التابع له</label>
                <select
                  required
                  value={stageForm.departmentId}
                  onChange={(e) => setStageForm({ ...stageForm, departmentId: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-300"
                >
                  <option value="">-- اختر القسم --</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.nameAr}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">اسم المرحلة</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: المرحلة الأولى"
                  value={stageForm.nameAr}
                  onChange={(e) => setStageForm({ ...stageForm, nameAr: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-300"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">رقم السنة (1-5)</label>
                <input
                  type="number"
                  min="1"
                  max="5"
                  value={stageForm.yearNumber}
                  onChange={(e) => setStageForm({ ...stageForm, yearNumber: Number(e.target.value) })}
                  className="w-full p-2.5 rounded-xl border border-slate-300"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsStageModalOpen(false)}
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

      {/* Section Modal */}
      {isSectionModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <h3 className="font-bold text-slate-900 text-base mb-4">إضافة شعبة جديدة</h3>
            <form onSubmit={handleCreateSection} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">المرحلة الدراسية</label>
                <select
                  required
                  value={sectionForm.stageId}
                  onChange={(e) => {
                    const stg = stages.find((s) => s.id === e.target.value);
                    setSectionForm({
                      ...sectionForm,
                      stageId: e.target.value,
                      departmentId: stg?.departmentId || sectionForm.departmentId,
                    });
                  }}
                  className="w-full p-2.5 rounded-xl border border-slate-300"
                >
                  <option value="">-- اختر المرحلة --</option>
                  {stages.map((s) => (
                    <option key={s.id} value={s.id}>{s.nameAr} ({getDeptName(s.departmentId)})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">اسم أو رمز الشعبة</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: أ أو A"
                  value={sectionForm.name}
                  onChange={(e) => setSectionForm({ ...sectionForm, name: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-300"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">عدد الطلبة</label>
                <input
                  type="number"
                  min="1"
                  max="200"
                  value={sectionForm.studentCount}
                  onChange={(e) => setSectionForm({ ...sectionForm, studentCount: Number(e.target.value) })}
                  className="w-full p-2.5 rounded-xl border border-slate-300"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsSectionModalOpen(false)}
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
