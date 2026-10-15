import React, { useState, useEffect } from 'react';
import { api } from '../../services/api.ts';
import { UserCheck, Smartphone, CheckCircle2, XCircle, Clock, AlertCircle, RefreshCw } from 'lucide-react';

export const DeviceManagement: React.FC<{ currentUser: any }> = ({ currentUser }) => {
  const [devices, setDevices] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [devs, usrs] = await Promise.allSettled([api.getUserDevices(), api.getUsers()]);
      setDevices(devs.status === 'fulfilled' ? devs.value || [] : []);
      setUsers(usrs.status === 'fulfilled' ? usrs.value || [] : []);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const getUserName = (id: string) => users.find((u) => u.id === id)?.name || id;

  const handleApprove = async (deviceId: string) => {
    try {
      await api.approveDevice(deviceId, { id: currentUser.id, name: currentUser.name });
      setMessage({ type: 'success', text: 'تم اعتماد الجهاز بنجاح' });
      loadData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'فشل اعتماد الجهاز' });
    }
  };

  const handleRevoke = async (deviceId: string) => {
    if (!window.confirm('هل أنت متأكد من إلغاء اعتماد هذا الجهاز؟')) return;
    try {
      await api.revokeDevice(deviceId, { id: currentUser.id, name: currentUser.name });
      setMessage({ type: 'success', text: 'تم إلغاء اعتماد الجهاز' });
      loadData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'فشل إلغاء الاعتماد' });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-medium flex items-center gap-1 w-fit"><CheckCircle2 className="w-3 h-3" /> معتمد</span>;
      case 'pending':
        return <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[10px] font-medium flex items-center gap-1 w-fit"><Clock className="w-3 h-3" /> بانتظار الاعتماد</span>;
      case 'revoked':
        return <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-700 text-[10px] font-medium flex items-center gap-1 w-fit"><XCircle className="w-3 h-3" /> ملغي</span>;
      default:
        return <span className="text-xs text-slate-500">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">إدارة الأجهزة</h2>
              <p className="text-xs text-slate-500">مراجعة واعتماد الأجهزة المرتبطة بحسابات المستخدمين</p>
            </div>
          </div>
          <button onClick={loadData} className="p-2 rounded-xl hover:bg-slate-100 text-slate-500">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {message && (
          <div className={`mt-4 p-3 rounded-xl text-xs flex items-center gap-2 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
            {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {message.text}
          </div>
        )}

        {isLoading ? (
          <div className="py-12 text-center text-slate-400 text-sm">جاري التحميل...</div>
        ) : devices.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm">لا توجد أجهزة مسجلة</div>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">المستخدم</th>
                  <th className="py-3 px-4">اسم الجهاز</th>
                  <th className="py-3 px-4">الحالة</th>
                  <th className="py-3 px-4">تاريخ التسجيل</th>
                  <th className="py-3 px-4">آخر ظهور</th>
                  <th className="py-3 px-4 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {devices.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-semibold text-slate-900">{getUserName(d.userId)}</td>
                    <td className="py-3 px-4 text-slate-500">{d.deviceName || d.deviceFingerprint?.slice(0, 20) || '-'}</td>
                    <td className="py-3 px-4">{getStatusBadge(d.status)}</td>
                    <td className="py-3 px-4 text-slate-500">{d.createdAt ? new Date(d.createdAt).toLocaleDateString('ar-EG') : '-'}</td>
                    <td className="py-3 px-4 text-slate-500">{d.lastSeenAt ? new Date(d.lastSeenAt).toLocaleDateString('ar-EG') : '-'}</td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {d.status === 'pending' && (
                          <button onClick={() => handleApprove(d.id)} title="اعتماد"
                            className="p-1 text-emerald-600 hover:bg-emerald-50 rounded">
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                        )}
                        {d.status !== 'revoked' && (
                          <button onClick={() => handleRevoke(d.id)} title="إلغاء الاعتماد"
                            className="p-1 text-red-500 hover:bg-red-50 rounded">
                            <XCircle className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
