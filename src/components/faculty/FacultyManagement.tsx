import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../services/api.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import { Users, Plus, Trash2, Mail, Phone, Award, CheckCircle2, AlertCircle, Search } from 'lucide-react';

export const FacultyManagement: React.FC = () => {
  const { user } = useAuth();
  const [faculty, setFaculty] = useState<any[]>([]);
  const [colleges, setColleges] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Search & Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDepartmentId, setFilterDepartmentId] = useState('');
  const [filterDate, setFilterDate] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({
    nameAr: '',
    nameEn: '',
    academicTitle: 'أستاذ دكتور',
    specialization: '',
    email: '',
    phone: '',
    collegeId: '',
    departmentId: '',
    employeeId: '',
  });

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [facRes, colRes, depRes] = await Promise.allSettled([
        api.getFaculties(user?.role === 'DEPARTMENT_MONITOR' ? user.assignedDepartmentId : undefined),
        api.getColleges(),
        api.getDepartments(user?.role === 'DEPARTMENT_MONITOR' ? user.assignedDepartmentId : undefined),
      ]);
      const fac = facRes.status === 'fulfilled' && Array.isArray(facRes.value) ? facRes.value : [];
      const col = colRes.status === 'fulfilled' && Array.isArray(colRes.value) ? colRes.value : [];
      const dep = depRes.status === 'fulfilled' && Array.isArray(depRes.value) ? depRes.value : [];
      setFaculty(fac);
      setColleges(col);
      setDepartments(dep);
      if (col.length > 0 && !form.collegeId) {
        setForm((prev) => ({ ...prev, collegeId: col[0].id }));
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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createFaculty(form);
      setMessage({ type: 'success', text: 'تمت إضافة عضو الهيئة التدريسية بنجاح!' });
      setIsModalOpen(false);
      setForm({
        nameAr: '',
        nameEn: '',
        academicTitle: 'أستاذ دكتور',
        specialization: '',
        email: '',
        phone: '',
        collegeId: colleges[0]?.id || '',
        departmentId: '',
        employeeId: '',
      });
      loadData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'تعذر إضافة التدريسي' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا التدريسي؟')) return;
    try {
      await api.deleteFaculty(id);
      loadData();
    } catch (err: any) {
      alert(err?.message || 'تعذر حذف التدريسي');
    }
  };

  const getDeptName = (id?: string) => departments.find((d) => d.id === id)?.nameAr || '';
  const getCollegeName = (id?: string) => colleges.find((c) => c.id === id)?.nameAr || '';

  // Filtered Faculty List
  const filteredFaculty = useMemo(() => {
    return faculty.filter((f) => {
      const matchSearch =
        !searchTerm ||
        f.nameAr?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        f.nameEn?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        f.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        f.specialization?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        f.phone?.includes(searchTerm);

      const matchDept = !filterDepartmentId || f.departmentId === filterDepartmentId;

      const matchDate =
        !filterDate ||
        (f.createdAt && f.createdAt.startsWith(filterDate));

      return matchSearch && matchDept && matchDate;
    });
  }, [faculty, searchTerm, filterDepartmentId, filterDate]);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-800 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">إدارة الكادر التدريسي</h2>
              <p className="text-xs text-slate-500">
                سجل أساتذة وتدريسيي جامعة المستقبل والألقاب العلمية
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            إضافة تدريسي جديد
          </button>
        </div>

        {/* Search & Filters Toolbar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6 p-4 rounded-2xl bg-slate-50 border border-slate-200">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3.5" />
            <input
              type="text"
              placeholder="البحث بالاسم، البريد، أو التخصص..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-3 pr-9 py-2.5 rounded-xl border border-slate-300 text-xs bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <select
              value={filterDepartmentId}
              onChange={(e) => setFilterDepartmentId(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-300 text-xs bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500 cursor-pointer"
            >
              <option value="">جميع الأقسام الأكاديمية</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.nameAr}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-300 text-xs bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500 cursor-pointer"
              title="تصفية حسب تاريخ التسجيل"
            />
            {(searchTerm || filterDepartmentId || filterDate) && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setFilterDepartmentId('');
                  setFilterDate('');
                }}
                className="px-3 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-medium shrink-0 cursor-pointer"
                title="إعادة ضبط الفلاتر"
              >
                إعادة ضبط
              </button>
            )}
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
        ) : filteredFaculty.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">
            لا توجد نتائج مطابقة لبحثك أو الفلاتر المحددة.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
            {filteredFaculty.map((f) => (
              <div
                key={f.id}
                className="p-5 rounded-2xl border border-slate-200 bg-white hover:border-emerald-300 transition-all shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start mb-3">
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700">
                      <Award className="w-3 h-3" />
                      {f.academicTitle || 'تدريسي'}
                    </span>
                    <button
                      onClick={() => handleDelete(f.id)}
                      className="text-slate-400 hover:text-red-600 p-1 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <h3 className="font-bold text-slate-900 text-base">{f.nameAr}</h3>
                  {f.specialization && (
                    <p className="text-xs text-slate-500 mt-1">تخصص: {f.specialization}</p>
                  )}
                  <p className="text-xs text-emerald-700 font-medium mt-1">
                    {getCollegeName(f.collegeId)} — {getDeptName(f.departmentId)}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 space-y-1 text-xs text-slate-500">
                  {f.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate font-mono text-[11px]">{f.email}</span>
                    </div>
                  )}
                  {f.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span dir="ltr" className="text-[11px]">{f.phone}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-slate-900 text-base mb-4">إضافة تدريسي جديد</h3>
            <form onSubmit={handleCreate} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">الاسم بالعربية</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: أ.د. حيدر كاظم"
                    value={form.nameAr}
                    onChange={(e) => setForm({ ...form, nameAr: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">اللقب العلمي</label>
                  <select
                    value={form.academicTitle}
                    onChange={(e) => setForm({ ...form, academicTitle: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-300"
                  >
                    <option value="أستاذ دكتور">أستاذ دكتور</option>
                    <option value="أستاذ مساعد دكتور">أستاذ مساعد دكتور</option>
                    <option value="مدرس دكتور">مدرس دكتور</option>
                    <option value="مدرس">مدرس</option>
                    <option value="مدرس مساعد">مدرس مساعد</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">الكلية</label>
                  <select
                    required
                    value={form.collegeId}
                    onChange={(e) => setForm({ ...form, collegeId: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-300"
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
                    value={form.departmentId}
                    onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-300"
                  >
                    <option value="">-- اختر القسم --</option>
                    {departments
                      .filter((d) => !form.collegeId || d.collegeId === form.collegeId)
                      .map((d) => (
                        <option key={d.id} value={d.id}>{d.nameAr}</option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">البريد الإلكتروني</label>
                  <input
                    type="email"
                    dir="ltr"
                    placeholder="haider@uomus.edu.iq"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">رقم الهاتف</label>
                  <input
                    type="tel"
                    dir="ltr"
                    placeholder="+964 780 123 4567"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-300"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">التخصص العلمي الدقيق</label>
                <input
                  type="text"
                  placeholder="مثال: شبكات حاسوب والذكاء الاصطناعي"
                  value={form.specialization}
                  onChange={(e) => setForm({ ...form, specialization: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-300"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700 cursor-pointer"
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
