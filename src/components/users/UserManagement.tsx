import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../services/api.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import { UserCheck, Plus, Trash2, Shield, Mail, CheckCircle2, AlertCircle, Search, Clock, XCircle, UserPlus } from 'lucide-react';

export const UserManagement: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [colleges, setColleges] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'users' | 'pending'>('users');
  const [isLoading, setIsLoading] = useState(true);

  // Search & Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDepartmentId, setFilterDepartmentId] = useState('');
  const [filterDate, setFilterDate] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'COLLEGE_MONITOR',
    assignedCollegeId: '',
    assignedDepartmentId: '',
  });

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [uRes, colRes, depRes, reqRes] = await Promise.allSettled([
        api.getUsers(),
        api.getColleges(),
        api.getDepartments(),
        api.getRegistrationRequests('pending_approval'),
      ]);
      setUsers(uRes.status === 'fulfilled' ? uRes.value || [] : []);
      setColleges(colRes.status === 'fulfilled' ? colRes.value || [] : []);
      setDepartments(depRes.status === 'fulfilled' ? depRes.value || [] : []);
      setPendingRequests(reqRes.status === 'fulfilled' ? reqRes.value || [] : []);
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
    if (form.password.length < 12) {
      setMessage({ type: 'error', text: 'كلمة المرور يجب أن لا تقل عن 12 خانة وفقاً لمعايير الأمان' });
      return;
    }

    try {
      await api.createUser({
        name: form.name,
        email: form.email,
        password: form.password,
        role: form.role,
        assignedCollegeId: form.assignedCollegeId || null,
        assignedDepartmentId: form.assignedDepartmentId || null,
      });

      setMessage({ type: 'success', text: 'تم إنشاء المستخدم وحفظه في قاعدة البيانات بنجاح!' });
      setIsModalOpen(false);
      setForm({
        name: '',
        email: '',
        password: '',
        role: 'COLLEGE_MONITOR',
        assignedCollegeId: '',
        assignedDepartmentId: '',
      });
      loadData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'تعذر إنشاء المستخدم' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا الحساب؟')) return;
    try {
      await api.deleteUser(id);
      loadData();
    } catch (err: any) {
      alert(err?.message || 'تعذر حذف الحساب');
    }
  };

  const handleApproveRequest = async (requestId: string) => {
    if (!currentUser) return;
    const role = window.prompt('الدور (COLLEGE_MONITOR / DEPARTMENT_MONITOR / FACULTY):', 'FACULTY');
    if (!role) return;
    try {
      await api.approveRegistration(requestId, { id: currentUser.id, name: currentUser.name }, { role });
      setMessage({ type: 'success', text: 'تمت الموافقة على الحساب وتفعيله بنجاح' });
      loadData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'فشل الموافقة على الطلب' });
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    if (!currentUser) return;
    const reason = window.prompt('سبب الرفض:', '');
    if (!reason) return;
    try {
      await api.rejectRegistration(requestId, { id: currentUser.id, name: currentUser.name }, reason);
      setMessage({ type: 'success', text: 'تم رفض طلب التسجيل' });
      loadData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'فشل رفض الطلب' });
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'OWNER':
        return <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full text-[11px] font-semibold">مالك الجامعة (OWNER)</span>;
      case 'COLLEGE_DEAN':
        return <span className="bg-teal-100 text-teal-800 px-2 py-0.5 rounded-full text-[11px] font-semibold">عميد كلية</span>;
      case 'COLLEGE_MONITOR':
        return <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-[11px] font-semibold">مسؤول كلية</span>;
      case 'DEPARTMENT_MONITOR':
        return <span className="bg-slate-200 text-slate-800 px-2 py-0.5 rounded-full text-[11px] font-semibold">مسؤول قسم</span>;
      case 'FACULTY':
        return <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full text-[11px] font-semibold">تدريسي</span>;
      default:
        return role;
    }
  };

  const getCollegeName = (id?: string) => (Array.isArray(colleges) ? colleges : []).find((c) => c && c.id === id)?.nameAr || '';
  const getDeptName = (id?: string) => (Array.isArray(departments) ? departments : []).find((d) => d && d.id === id)?.nameAr || '';

  // Filtered Users List
  const filteredUsers = useMemo(() => {
    return (Array.isArray(users) ? users : []).filter((u) => {
      const matchSearch =
        !searchTerm ||
        u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.role?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchDept = !filterDepartmentId || u.assignedDepartmentId === filterDepartmentId;

      const matchDate =
        !filterDate ||
        (u.createdAt && u.createdAt.startsWith(filterDate));

      return matchSearch && matchDept && matchDate;
    });
  }, [users, searchTerm, filterDepartmentId, filterDate]);

  if (currentUser?.role !== 'OWNER') {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
        <Shield className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-slate-700">غير مصرح</h2>
        <p className="text-sm text-slate-500 mt-1">هذه الصفحة متاحة فقط لمالك النظام</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">إدارة الحسابات والصلاحيات</h2>
              <p className="text-xs text-slate-500">
                تعيين مسؤولي الكليات والأقسام وتحديد النطاق الأكاديمي الصارم
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            إنشاء حساب جديد
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mt-6 border-b border-slate-200">
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors cursor-pointer ${
              activeTab === 'users' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            الحسابات الحالية
          </button>
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'pending' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            طلبات التسجيل المعلقة
            {pendingRequests.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold">{pendingRequests.length}</span>
            )}
          </button>
        </div>

        {/* Search & Filters Toolbar */}
        {activeTab === 'users' && (
        <>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6 p-4 rounded-2xl bg-slate-50 border border-slate-200">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3.5" />
            <input
              type="text"
              placeholder="البحث بالاسم، البريد، أو الصلاحية..."
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
              title="تصفية حسب تاريخ الإنشاء"
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
        ) : filteredUsers.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">
            لا توجد نتائج مطابقة لبحثك أو الفلاتر المحددة.
          </div>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">اسم المستخدم</th>
                  <th className="py-3 px-4">البريد الإلكتروني</th>
                  <th className="py-3 px-4">الدور والصلاحية</th>
                  <th className="py-3 px-4">نطاق الكلية والقسم</th>
                  <th className="py-3 px-4">الحالة</th>
                  <th className="py-3 px-4 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/70">
                    <td className="py-3.5 px-4 font-semibold text-slate-900">{u.name}</td>
                    <td className="py-3.5 px-4 font-mono text-slate-500">{u.email}</td>
                    <td className="py-3.5 px-4">{getRoleLabel(u.role)}</td>
                    <td className="py-3.5 px-4 text-slate-500">
                      {u.role === 'OWNER'
                        ? 'الجامعة كاملة'
                        : `${getCollegeName(u.assignedCollegeId) || 'عام'} ${u.assignedDepartmentId ? `— ${getDeptName(u.assignedDepartmentId)}` : ''}`}
                    </td>
                    <td className="py-3.5 px-4">
                      {u.status === 'inactive' || u.accountStatus === 'suspended' ? (
                        <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-700 font-medium text-[10px]">معطل</span>
                      ) : u.accountStatus === 'pending_approval' ? (
                        <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium text-[10px]">بانتظار الموافقة</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium text-[10px]">نشط</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {u.role !== 'OWNER' && (
                        <button
                          onClick={() => handleDelete(u.id)}
                          className="text-slate-400 hover:text-red-600 p-1 cursor-pointer"
                          title="حذف الحساب"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        </>
        )}

        {activeTab === 'pending' && (
          <div className="mt-6">
            {isLoading ? (
              <div className="py-16 text-center text-slate-400 text-sm">جاري التحميل...</div>
            ) : pendingRequests.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-sm">
                لا توجد طلبات تسجيل معلقة حالياً.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-600 uppercase font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">الاسم</th>
                      <th className="py-3 px-4">البريد الإلكتروني</th>
                      <th className="py-3 px-4">الدور المطلوب</th>
                      <th className="py-3 px-4">تاريخ الطلب</th>
                      <th className="py-3 px-4 text-center">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {pendingRequests.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/70">
                        <td className="py-3.5 px-4 font-semibold text-slate-900">{r.name}</td>
                        <td className="py-3.5 px-4 font-mono text-slate-500" dir="ltr">{r.email}</td>
                        <td className="py-3.5 px-4">{getRoleLabel(r.requestedRole)}</td>
                        <td className="py-3.5 px-4 text-slate-500">{r.createdAt ? new Date(r.createdAt).toLocaleDateString('ar-EG') : '-'}</td>
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => handleApproveRequest(r.id)}
                              className="text-emerald-600 hover:bg-emerald-50 p-1 rounded cursor-pointer"
                              title="الموافقة وإنشاء الحساب"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleRejectRequest(r.id)}
                              className="text-red-500 hover:bg-red-50 p-1 rounded cursor-pointer"
                              title="رفض الطلب"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100">
            <h3 className="font-bold text-slate-900 text-base mb-4">إنشاء حساب جديد والصلاحيات</h3>
            <form onSubmit={handleCreate} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">اسم المستخدم الكامل</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: د. أحمد عبد الله"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-300"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">البريد الإلكتروني</label>
                  <input
                    type="email"
                    required
                    dir="ltr"
                    placeholder="ahmed@uomus.edu.iq"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">كلمة المرور (12 خانة على الأقل)</label>
                  <input
                    type="password"
                    required
                    dir="ltr"
                    placeholder="••••••••••••"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-300"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">الدور والصلاحية الأكاديمية</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-300"
                >
                  <option value="COLLEGE_DEAN">عميد كلية (College Dean)</option>
                  <option value="COLLEGE_MONITOR">مسؤول كلية (College Monitor)</option>
                  <option value="DEPARTMENT_MONITOR">مسؤول قسم (Department Monitor)</option>
                  <option value="FACULTY">عضو هيئة تدريس (Faculty Member)</option>
                </select>
              </div>

              {form.role !== 'OWNER' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">الكلية المعينة</label>
                    <select
                      value={form.assignedCollegeId}
                      onChange={(e) => setForm({ ...form, assignedCollegeId: e.target.value })}
                      className="w-full p-2.5 rounded-xl border border-slate-300"
                    >
                      <option value="">-- اختر الكلية --</option>
                      {colleges.map((c) => (
                        <option key={c.id} value={c.id}>{c.nameAr}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">القسم المعين</label>
                    <select
                      value={form.assignedDepartmentId}
                      onChange={(e) => setForm({ ...form, assignedDepartmentId: e.target.value })}
                      className="w-full p-2.5 rounded-xl border border-slate-300"
                    >
                      <option value="">-- اختر القسم --</option>
                      {departments
                        .filter((d) => !form.assignedCollegeId || d.collegeId === form.assignedCollegeId)
                        .map((d) => (
                          <option key={d.id} value={d.id}>{d.nameAr}</option>
                        ))}
                    </select>
                  </div>
                </div>
              )}

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
                  إنشاء الحساب
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
