import React, { useState, useEffect } from 'react';
import { api } from '../../services/api.ts';
import { UserCheck, Plus, Trash2, Shield, Mail, CheckCircle2, AlertCircle } from 'lucide-react';

export const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [colleges, setColleges] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
      const [uRes, colRes, depRes] = await Promise.all([
        api.getUsers(),
        api.getColleges(),
        api.getDepartments(),
      ]);
      setUsers(uRes || []);
      setColleges(colRes || []);
      setDepartments(depRes || []);
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

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'OWNER':
        return <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full text-[11px] font-semibold">مالك الجامعة (OWNER)</span>;
      case 'COLLEGE_MONITOR':
        return <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-[11px] font-semibold">مسؤول كلية</span>;
      case 'DEPARTMENT_MONITOR':
        return <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full text-[11px] font-semibold">مسؤول قسم</span>;
      case 'FACULTY':
        return <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full text-[11px] font-semibold">تدريسي</span>;
      default:
        return role;
    }
  };

  const getCollegeName = (id?: string) => colleges.find((c) => c.id === id)?.nameAr || '';
  const getDeptName = (id?: string) => departments.find((d) => d.id === id)?.nameAr || '';

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
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs shadow-xs"
          >
            <Plus className="w-4 h-4" />
            إنشاء حساب جديد
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
                {users.map((u) => (
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
                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium text-[10px]">
                        نشط
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {u.role !== 'OWNER' && (
                        <button
                          onClick={() => handleDelete(u.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
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
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-slate-900 text-base mb-4">إنشاء حساب جديد</h3>
            <form onSubmit={handleCreate} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">الاسم الكامل</label>
                <input
                  type="text"
                  required
                  placeholder="د. أحمد علي السعدي"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-300"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">البريد الإلكتروني</label>
                <input
                  type="email"
                  required
                  dir="ltr"
                  placeholder="user@uomus.edu.iq"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-300"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  كلمة المرور (12 خانة على الأقل)
                </label>
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

              <div>
                <label className="block font-medium text-slate-700 mb-1">الدور والصلاحية</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-300"
                >
                  <option value="COLLEGE_MONITOR">مسؤول متابعة كلية</option>
                  <option value="DEPARTMENT_MONITOR">مسؤول متابعة قسم</option>
                  <option value="FACULTY">أستاذ تدريسي</option>
                  <option value="OWNER">مالك النظام (الجامعة)</option>
                </select>
              </div>

              {form.role !== 'OWNER' && (
                <div>
                  <label className="block font-medium text-slate-700 mb-1">الكلية المعين لها</label>
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
              )}

              {form.role === 'DEPARTMENT_MONITOR' && (
                <div>
                  <label className="block font-medium text-slate-700 mb-1">القسم المعين له</label>
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
              )}

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
