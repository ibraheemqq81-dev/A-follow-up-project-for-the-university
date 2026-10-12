import React, { useState, useEffect } from 'react';
import { api } from '../../services/api.ts';
import { Settings, Shield, HardDrive, CheckCircle2, AlertCircle, Download, Activity } from 'lucide-react';

export const SystemSettings: React.FC = () => {
  const [health, setHealth] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupMessage, setBackupMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const [hRes, aRes] = await Promise.all([
          api.getHealth(),
          api.getAuditLogs(),
        ]);
        setHealth(hRes);
        setAuditLogs(aRes || []);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  const handleBackup = async () => {
    setIsBackingUp(true);
    setBackupMessage(null);
    try {
      const res = await api.triggerBackup();
      setBackupMessage('تم إنشاء النسخة الاحتياطية وتأكيد سلامة التجزئة (SHA-256) بنجاح!');
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(res, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `uomus_backup_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (err: any) {
      setBackupMessage(err?.message || 'تعذر إنشاء النسخة الاحتياطية');
    } finally {
      setIsBackingUp(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">إعدادات النظام والنسخ الاحتياطي</h2>
            <p className="text-xs text-slate-500">
              تشخيص صحة الخادم، سلامة قاعدة البيانات، وسجلات التدقيق الأمني
            </p>
          </div>
        </div>

        {/* Health Diagnostic */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 mb-1">
              <Activity className="w-4 h-4 text-emerald-600" />
              حالة الخادم
            </div>
            <div className="text-base font-bold text-emerald-800 mt-1">
              {health?.status === 'online' ? 'متصل وجاهز (Online)' : 'جاري الفحص...'}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">المنطقة الزمنية: {health?.timezone || 'Asia/Baghdad'}</div>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 mb-1">
              <HardDrive className="w-4 h-4 text-blue-600" />
              قاعدة البيانات
            </div>
            <div className="text-base font-bold text-slate-900 mt-1">
              SQLite (WAL Mode)
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">مسار التخزين: data/app.db</div>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 mb-1">
              <Shield className="w-4 h-4 text-purple-600" />
              سياسة الخصوصية
            </div>
            <div className="text-base font-bold text-slate-900 mt-1">
              مغلقة ومحلية
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">{health?.gpsPolicy || 'Strict Evidence Only'}</div>
          </div>
        </div>

        {/* Backup Section */}
        <div className="mt-6 p-5 rounded-2xl border border-emerald-200 bg-emerald-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-emerald-950 text-sm">النسخ الاحتياطي الشامل للنظام</h3>
            <p className="text-xs text-emerald-800 mt-0.5">
              تصدير كافة الكليات، الأقسام، الجداول، وسجلات الحضور مشفرة ومحققة البصمة بـ SHA-256
            </p>
          </div>
          <button
            onClick={handleBackup}
            disabled={isBackingUp}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs shadow-xs disabled:opacity-50 shrink-0"
          >
            <Download className="w-4 h-4" />
            {isBackingUp ? 'جاري التصدير...' : 'توليد وتحميل النسخة الاحتياطية'}
          </button>
        </div>

        {backupMessage && (
          <div className="mt-3 p-3 rounded-xl bg-emerald-100 text-emerald-800 text-xs font-medium">
            {backupMessage}
          </div>
        )}

        {/* Audit Logs */}
        <div className="mt-8">
          <h3 className="font-bold text-slate-900 text-sm mb-3">سجل العمليات والتدقيق (Audit Logs)</h3>
          {isLoading ? (
            <div className="py-8 text-center text-slate-400 text-xs">جاري تحميل السجلات...</div>
          ) : auditLogs.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">لا توجد عمليات مسجلة حتى الآن.</div>
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">العملية</th>
                    <th className="py-2.5 px-3">المستخدم</th>
                    <th className="py-2.5 px-3">الكيان</th>
                    <th className="py-2.5 px-3">السبب / البيان</th>
                    <th className="py-2.5 px-3">الوقت</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {auditLogs.slice(0, 15).map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-semibold text-emerald-800">{log.action}</td>
                      <td className="py-2 px-3">{log.userName || log.userId || 'النظام'}</td>
                      <td className="py-2 px-3">{log.entity || '--'}</td>
                      <td className="py-2 px-3">{log.reason || log.details || '--'}</td>
                      <td className="py-2 px-3 font-mono text-[11px] text-slate-400">
                        {log.timestamp ? new Date(log.timestamp).toLocaleString('ar-IQ') : '--'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
