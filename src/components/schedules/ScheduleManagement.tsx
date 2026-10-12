import React, { useState, useEffect } from 'react';
import { api } from '../../services/api.ts';
import { Calendar, Plus, Trash2, Clock, DoorOpen, Users, AlertCircle, CheckCircle2 } from 'lucide-react';

export const ScheduleManagement: React.FC = () => {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [colleges, setColleges] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [faculty, setFaculty] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [stages, setStages] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    collegeId: '',
    departmentId: '',
    stageId: '',
    subjectId: '',
    facultyId: '',
    sectionId: '',
    roomId: '',
    day: 'Sunday',
    startTime: '08:30',
    endTime: '10:30',
    lectureType: 'THEORETICAL',
    academicYear: '2025-2026',
    semester: 'FIRST',
  });

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const daysArabic: Record<string, string> = {
    Sunday: 'الأحد',
    Monday: 'الإثنين',
    Tuesday: 'الثلاثاء',
    Wednesday: 'الأربعاء',
    Thursday: 'الخميس',
    Saturday: 'السبت',
  };

  const loadAll = async () => {
    setIsLoading(true);
    try {
      const [sch, col, dep, rm, fac, sub, stg, sec] = await Promise.all([
        api.getSchedules(),
        api.getColleges(),
        api.getDepartments(),
        api.getRooms(),
        api.getFaculties(),
        api.getSubjects(),
        api.getStages(),
        api.getSections(),
      ]);
      setSchedules(sch || []);
      setColleges(col || []);
      setDepartments(dep || []);
      setRooms(rm || []);
      setFaculty(fac || []);
      setSubjects(sub || []);
      setStages(stg || []);
      setSections(sec || []);

      if (col && col.length > 0 && !formData.collegeId) {
        setFormData((prev) => ({ ...prev, collegeId: col[0].id }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      await api.createSchedule({
        ...formData,
        sectionIds: formData.sectionId ? [formData.sectionId] : [],
      });
      setSuccess('تمت إضافة المحاضرة إلى الجدول بنجاح!');
      setIsModalOpen(false);
      loadAll();
    } catch (err: any) {
      setError(err?.message || 'تعذر إضافة المحاضرة. قد يوجد تعارض في القاعة أو التدريسي أو الشعبة.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذه المحاضرة من الجدول؟')) return;
    try {
      await api.deleteSchedule(id);
      loadAll();
    } catch (err: any) {
      alert(err?.message || 'فشل حذف المحاضرة');
    }
  };

  const getFacultyName = (id?: string) => faculty.find((f) => f.id === id)?.nameAr || 'غير محدد';
  const getSubjectName = (id?: string) => subjects.find((s) => s.id === id)?.nameAr || 'مادة دراسية';
  const getRoomName = (id?: string) => rooms.find((r) => r.id === id)?.nameAr || 'قاعة';
  const getDeptName = (id?: string) => departments.find((d) => d.id === id)?.nameAr || '';

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">الجداول الدراسية الأسبوعية</h2>
              <p className="text-xs text-slate-500">
                إدارة أوقات المحاضرات، توزيع القاعات، وفحص التعارض الثلاثي تلقائياً
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs shadow-xs"
          >
            <Plus className="w-4 h-4" />
            إضافة محاضرة جديدة
          </button>
        </div>

        {error && (
          <div className="mt-4 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            {error}
          </div>
        )}

        {success && (
          <div className="mt-4 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            {success}
          </div>
        )}

        {isLoading ? (
          <div className="py-16 text-center text-slate-400 text-sm">جاري تحميل الجداول...</div>
        ) : schedules.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">
            لا توجد محاضرات مضافة حتى الآن. انقر على زر إضافة محاضرة للبدء.
          </div>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">اليوم والوقت</th>
                  <th className="py-3 px-4">المادة</th>
                  <th className="py-3 px-4">التدريسي</th>
                  <th className="py-3 px-4">القسم والكلية</th>
                  <th className="py-3 px-4">القاعة</th>
                  <th className="py-3 px-4">النوع</th>
                  <th className="py-3 px-4 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {schedules.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-slate-900 whitespace-nowrap">
                      <div>{daysArabic[item.day] || item.day}</div>
                      <div className="text-[11px] text-slate-400 font-normal mt-0.5">
                        {item.startTime} - {item.endTime}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-medium">{getSubjectName(item.subjectId)}</td>
                    <td className="py-3.5 px-4">{getFacultyName(item.facultyId)}</td>
                    <td className="py-3.5 px-4">{getDeptName(item.departmentId)}</td>
                    <td className="py-3.5 px-4 font-medium text-emerald-700">{getRoomName(item.roomId)}</td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[11px]">
                        {item.lectureType === 'PRACTICAL' ? 'عملي' : 'نظري'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
                        title="حذف"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Add Schedule */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-slate-900 text-lg mb-4">إضافة محاضرة جديدة إلى الجدول</h3>
            <form onSubmit={handleCreate} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">الكلية</label>
                  <select
                    value={formData.collegeId}
                    onChange={(e) => setFormData({ ...formData, collegeId: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-300"
                    required
                  >
                    <option value="">-- اختر الكلية --</option>
                    {colleges.map((c) => (
                      <option key={c.id} value={c.id}>{c.nameAr}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">القسم</label>
                  <select
                    value={formData.departmentId}
                    onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-300"
                    required
                  >
                    <option value="">-- اختر القسم --</option>
                    {departments
                      .filter((d) => !formData.collegeId || d.collegeId === formData.collegeId)
                      .map((d) => (
                        <option key={d.id} value={d.id}>{d.nameAr}</option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">المادة الدراسية</label>
                  <select
                    value={formData.subjectId}
                    onChange={(e) => setFormData({ ...formData, subjectId: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-300"
                    required
                  >
                    <option value="">-- اختر المادة --</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>{s.nameAr}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">التدريسي</label>
                  <select
                    value={formData.facultyId}
                    onChange={(e) => setFormData({ ...formData, facultyId: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-300"
                    required
                  >
                    <option value="">-- اختر التدريسي --</option>
                    {faculty.map((f) => (
                      <option key={f.id} value={f.id}>{f.nameAr}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">القاعة الدراسية</label>
                  <select
                    value={formData.roomId}
                    onChange={(e) => setFormData({ ...formData, roomId: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-300"
                    required
                  >
                    <option value="">-- اختر القاعة --</option>
                    {rooms.map((r) => (
                      <option key={r.id} value={r.id}>{r.nameAr} ({r.code || ''})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">اليوم</label>
                  <select
                    value={formData.day}
                    onChange={(e) => setFormData({ ...formData, day: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-300"
                  >
                    <option value="Sunday">الأحد</option>
                    <option value="Monday">الإثنين</option>
                    <option value="Tuesday">الثلاثاء</option>
                    <option value="Wednesday">الأربعاء</option>
                    <option value="Thursday">الخميس</option>
                    <option value="Saturday">السبت</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">وقت البدء</label>
                  <input
                    type="time"
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-300"
                    required
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">وقت الانتهاء</label>
                  <input
                    type="time"
                    value={formData.endTime}
                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-300"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700 shadow-xs"
                >
                  حفظ المحاضرة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
