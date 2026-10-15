import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../services/api.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import {
  Calendar,
  Plus,
  Trash2,
  Clock,
  DoorOpen,
  Users,
  AlertCircle,
  CheckCircle2,
  Filter,
  Layers,
  BookOpen,
  Sparkles,
  Settings,
  X,
} from 'lucide-react';

export const ScheduleManagement: React.FC = () => {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState<any[]>([]);
  const [colleges, setColleges] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [faculty, setFaculty] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [stages, setStages] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [semestersList, setSemestersList] = useState<any[]>([]);
  const [academicYearsList, setAcademicYearsList] = useState<any[]>([]);

  // Filtering
  const [filterSemester, setFilterSemester] = useState<string>('ALL');
  const [filterYear, setFilterYear] = useState<string>('ALL');
  const [filterDay, setFilterDay] = useState<string>('ALL');
  const [filterDepartment, setFilterDepartment] = useState<string>('ALL');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isQuickSemesterModalOpen, setIsQuickSemesterModalOpen] = useState(false);

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

  const [newSemesterName, setNewSemesterName] = useState('');
  const [newSemesterNumber, setNewSemesterNumber] = useState(1);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const daysArabic: Record<string, string> = {
    Saturday: 'السبت',
    Sunday: 'الأحد',
    Monday: 'الإثنين',
    Tuesday: 'الثلاثاء',
    Wednesday: 'الأربعاء',
    Thursday: 'الخميس',
  };

  const semesterArabic: Record<string, string> = {
    FIRST: 'الفصل الأول',
    SECOND: 'الفصل الثاني',
    SUMMER: 'الفصل الصيفي',
    ANNUAL: 'سنوي',
  };

  const loadAll = async () => {
    setIsLoading(true);
    try {
      const scheduleParams: Record<string, string> = {};
      if (user?.role === 'DEPARTMENT_MONITOR' && user.assignedDepartmentId) {
        scheduleParams.departmentId = user.assignedDepartmentId;
      }
      const [schRes, colRes, depRes, rmRes, facRes, subRes, stgRes, secRes, semRes, yrRes] = await Promise.allSettled([
        api.getSchedules(scheduleParams),
        api.getColleges(),
        api.getDepartments(user?.role === 'DEPARTMENT_MONITOR' ? user.assignedDepartmentId : undefined),
        api.getRooms(),
        api.getFaculties(user?.role === 'DEPARTMENT_MONITOR' ? user.assignedDepartmentId : undefined),
        api.getSubjects(user?.role === 'DEPARTMENT_MONITOR' ? user.assignedDepartmentId : undefined),
        api.getStages(),
        api.getSections(),
        api.getSemesters(),
        api.getAcademicYears(),
      ]);

      const sch = schRes.status === 'fulfilled' && Array.isArray(schRes.value) ? schRes.value : [];
      const col = colRes.status === 'fulfilled' && Array.isArray(colRes.value) ? colRes.value : [];
      const dep = depRes.status === 'fulfilled' && Array.isArray(depRes.value) ? depRes.value : [];
      const rm = rmRes.status === 'fulfilled' && Array.isArray(rmRes.value) ? rmRes.value : [];
      const fac = facRes.status === 'fulfilled' && Array.isArray(facRes.value) ? facRes.value : [];
      const sub = subRes.status === 'fulfilled' && Array.isArray(subRes.value) ? subRes.value : [];
      const stg = stgRes.status === 'fulfilled' && Array.isArray(stgRes.value) ? stgRes.value : [];
      const sec = secRes.status === 'fulfilled' && Array.isArray(secRes.value) ? secRes.value : [];
      const sems = semRes.status === 'fulfilled' && Array.isArray(semRes.value) ? semRes.value : [];
      const yrs = yrRes.status === 'fulfilled' && Array.isArray(yrRes.value) ? yrRes.value : [];

      setSchedules(sch);
      setColleges(col);
      setDepartments(dep);
      setRooms(rm);
      setFaculty(fac);
      setSubjects(sub);
      setStages(stg);
      setSections(sec);
      setSemestersList(sems);
      setAcademicYearsList(yrs);

      if (col && col.length > 0 && !formData.collegeId) {
        setFormData((prev) => ({ ...prev, collegeId: col[0].id }));
      }
    } catch {
      // safe fallback
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
      setSuccess('تمت إضافة المحاضرة إلى جدول الفصل الدراسي بنجاح!');
      setIsModalOpen(false);
      loadAll();
    } catch (err: any) {
      setError(err?.message || 'تعذر إضافة المحاضرة. قد يوجد تعارض في القاعة أو التدريسي أو الشعبة.');
    }
  };

  const handleCreateQuickSemester = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSemesterName) return;
    try {
      await api.createSemester({
        nameAr: newSemesterName,
        semesterNumber: newSemesterNumber,
        isCurrent: true,
      });
      setIsQuickSemesterModalOpen(false);
      setNewSemesterName('');
      setSuccess(`تمت إضافة وتفعيل الفصل الدراسي (${newSemesterName}) بنجاح!`);
      loadAll();
    } catch (err: any) {
      setError(err?.message || 'تعذر إضافة الفصل الدراسي');
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

  const getFacultyName = (id?: string) => (Array.isArray(faculty) ? faculty : []).find((f) => f && f.id === id)?.nameAr || 'غير محدد';
  const getSubjectName = (id?: string) => (Array.isArray(subjects) ? subjects : []).find((s) => s && s.id === id)?.nameAr || 'مادة دراسية';
  const getRoomName = (id?: string) => (Array.isArray(rooms) ? rooms : []).find((r) => r && r.id === id)?.nameAr || 'قاعة';
  const getDeptName = (id?: string) => (Array.isArray(departments) ? departments : []).find((d) => d && d.id === id)?.nameAr || '';

  // Filtered schedules list
  const filteredSchedules = useMemo(() => {
    return schedules.filter((item) => {
      if (filterSemester !== 'ALL') {
        const itemSem = item.semester || 'FIRST';
        if (itemSem !== filterSemester) return false;
      }
      if (filterYear !== 'ALL') {
        const itemYr = item.academicYear || '2025-2026';
        if (itemYr !== filterYear) return false;
      }
      if (filterDay !== 'ALL' && item.day !== filterDay) {
        return false;
      }
      if (filterDepartment !== 'ALL' && item.departmentId !== filterDepartment) {
        return false;
      }
      return true;
    });
  }, [schedules, filterSemester, filterYear, filterDay, filterDepartment]);

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
                إدارة أوقات المحاضرات حسب الفصول الدراسية وتوزيع القاعات وفحص التعارض تلقائياً
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsQuickSemesterModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs shadow-2xs"
            >
              <Sparkles className="w-4 h-4 text-emerald-600" />
              إضافة فصل دراسي
            </button>
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs"
            >
              <Plus className="w-4 h-4" />
              إضافة محاضرة جديدة
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="mt-6 p-4 rounded-xl bg-slate-50/80 border border-slate-200 flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-1 text-slate-700 font-bold">
            <Filter className="w-3.5 h-3.5 text-emerald-600" />
            تصفية الجداول:
          </div>

          {/* Filter Semester */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">الفصل الدراسي:</span>
            <select
              value={filterSemester}
              onChange={(e) => setFilterSemester(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 font-medium"
            >
              <option value="ALL">جميع الفصول</option>
              <option value="FIRST">الفصل الأول</option>
              <option value="SECOND">الفصل الثاني</option>
              <option value="SUMMER">الفصل الصيفي</option>
              <option value="ANNUAL">سنوي</option>
            </select>
          </div>

          {/* Filter Year */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">السنة الدراسية:</span>
            <select
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 font-medium"
            >
              <option value="ALL">جميع السنوات</option>
              <option value="2025-2026">2025-2026</option>
              <option value="2026-2027">2026-2027</option>
            </select>
          </div>

          {/* Filter Day */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">اليوم:</span>
            <select
              value={filterDay}
              onChange={(e) => setFilterDay(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 font-medium"
            >
              <option value="ALL">جميع الأيام</option>
              <option value="Saturday">السبت</option>
              <option value="Sunday">الأحد</option>
              <option value="Monday">الإثنين</option>
              <option value="Tuesday">الثلاثاء</option>
              <option value="Wednesday">الأربعاء</option>
              <option value="Thursday">الخميس</option>
            </select>
          </div>

          {/* Filter Department */}
          {departments.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-medium">القسم:</span>
              <select
                value={filterDepartment}
                onChange={(e) => setFilterDepartment(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 font-medium max-w-xs truncate"
              >
                <option value="ALL">جميع الأقسام</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.nameAr}</option>
                ))}
              </select>
            </div>
          )}

          <div className="mr-auto text-[11px] font-bold text-slate-500">
            المعروض: {filteredSchedules.length} من أصل {schedules.length} محاضرة
          </div>
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
        ) : filteredSchedules.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">
            لا توجد محاضرات تطابق التصفية المحددة. انقر على زر إضافة محاضرة للبدء.
          </div>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">اليوم والوقت</th>
                  <th className="py-3 px-4">المادة</th>
                  <th className="py-3 px-4">الفصل الدراسي</th>
                  <th className="py-3 px-4">التدريسي</th>
                  <th className="py-3 px-4">القسم والكلية</th>
                  <th className="py-3 px-4">القاعة</th>
                  <th className="py-3 px-4">النوع</th>
                  <th className="py-3 px-4 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredSchedules.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-slate-900 whitespace-nowrap">
                      <div>{daysArabic[item.day] || item.day}</div>
                      <div className="text-[11px] text-slate-400 font-normal mt-0.5">
                        {item.startTime} - {item.endTime}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-medium">{getSubjectName(item.subjectId)}</td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 font-medium text-[11px] border border-purple-200">
                        {semesterArabic[item.semester] || item.semester || 'الفصل الأول'}
                      </span>
                    </td>
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
              {/* Semester & Academic Year Selection */}
              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-purple-50/60 border border-purple-100">
                <div>
                  <label className="block font-bold text-purple-900 mb-1">الفصل الدراسي</label>
                  <select
                    value={formData.semester}
                    onChange={(e) => setFormData({ ...formData, semester: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-purple-200 bg-white"
                    required
                  >
                    <option value="FIRST">الفصل الأول</option>
                    <option value="SECOND">الفصل الثاني</option>
                    <option value="SUMMER">الفصل الصيفي</option>
                    <option value="ANNUAL">سنوي</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-purple-900 mb-1">السنة الدراسية</label>
                  <input
                    type="text"
                    value={formData.academicYear}
                    onChange={(e) => setFormData({ ...formData, academicYear: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-purple-200 bg-white"
                    placeholder="2025-2026"
                    required
                  />
                </div>
              </div>

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
                    <option value="Saturday">السبت</option>
                    <option value="Sunday">الأحد</option>
                    <option value="Monday">الإثنين</option>
                    <option value="Tuesday">الثلاثاء</option>
                    <option value="Wednesday">الأربعاء</option>
                    <option value="Thursday">الخميس</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">نوع المحاضرة</label>
                  <select
                    value={formData.lectureType}
                    onChange={(e) => setFormData({ ...formData, lectureType: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-300"
                  >
                    <option value="THEORETICAL">نظري</option>
                    <option value="PRACTICAL">عملي (مختبر)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">الشعبة (اختياري)</label>
                  <select
                    value={formData.sectionId}
                    onChange={(e) => setFormData({ ...formData, sectionId: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-300"
                  >
                    <option value="">-- اختر الشعبة --</option>
                    {sections.map((sec) => (
                      <option key={sec.id} value={sec.id}>{sec.name}</option>
                    ))}
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

      {/* Modal Quick Add Semester */}
      {isQuickSemesterModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">إضافة فصل دراسي جديد</h3>
              <button onClick={() => setIsQuickSemesterModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateQuickSemester} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">اسم الفصل الدراسي</label>
                <input
                  type="text"
                  placeholder="مثال: الفصل الثاني 2025-2026"
                  value={newSemesterName}
                  onChange={(e) => setNewSemesterName(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300"
                  required
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">تسلسل الفصل</label>
                <select
                  value={newSemesterNumber}
                  onChange={(e) => setNewSemesterNumber(Number(e.target.value))}
                  className="w-full p-2.5 rounded-xl border border-slate-300"
                >
                  <option value={1}>الفصل الأول</option>
                  <option value={2}>الفصل الثاني</option>
                  <option value={3}>الفصل الصيفي</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsQuickSemesterModalOpen(false)}
                  className="px-3.5 py-2 rounded-xl text-slate-600 hover:bg-slate-100"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700"
                >
                  حفظ وتفعيل
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
