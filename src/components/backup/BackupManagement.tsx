import React, { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../../services/api.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import {
  Database, Server, Users, Building2, Activity, FileSpreadsheet,
  Download, Upload, Eye, RotateCcw, ShieldCheck, Trash2,
  Clock, Info, AlertTriangle, History, CheckCircle2, AlertCircle,
  X, RefreshCw, Plus, FileJson,
} from 'lucide-react';

type BackupStatus =
  | 'creating' | 'completed' | 'failed' | 'verifying'
  | 'valid' | 'invalid' | 'restoring' | 'restored' | 'restore_failed';

interface BackupRow {
  id: string;
  name: string;
  type: string;
  status: BackupStatus;
  formatVersion: string;
  sizeBytes: number;
  totalRecords: number;
  tablesCount: number;
  tablesIncluded: string[];
  checksum: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  verifiedAt: string | null;
  verifiedBy: string | null;
  verificationResult: any;
  restoredAt: string | null;
  restoredBy: string | null;
  restoreResult: any;
  notes: string | null;
}

interface Props {
  stats: Record<string, number>;
  health: any;
  auditLogsCount: number;
}

const statusLabels: Record<BackupStatus, string> = {
  creating: 'قيد الإنشاء',
  completed: 'مكتملة',
  failed: 'فشلت',
  verifying: 'قيد التحقق',
  valid: 'صالحة للاستعادة',
  invalid: 'غير صالحة',
  restoring: 'قيد الاستعادة',
  restored: 'تمت الاستعادة',
  restore_failed: 'فشلت الاستعادة',
};

const statusColors: Record<BackupStatus, string> = {
  creating: 'bg-blue-100 text-blue-700',
  completed: 'bg-emerald-100 text-emerald-700',
  failed: 'bg-red-100 text-red-700',
  verifying: 'bg-amber-100 text-amber-700',
  valid: 'bg-emerald-100 text-emerald-700',
  invalid: 'bg-red-100 text-red-700',
  restoring: 'bg-blue-100 text-blue-700',
  restored: 'bg-teal-100 text-teal-700',
  restore_failed: 'bg-red-100 text-red-700',
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export const BackupManagement: React.FC<Props> = ({ stats, health, auditLogsCount }) => {
  const { user: currentUser } = useAuth();
  const isOwner = currentUser?.role === 'OWNER';

  const [backups, setBackups] = useState<BackupRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [detailsBackup, setDetailsBackup] = useState<BackupRow | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const [restoreConfirm, setRestoreConfirm] = useState<BackupRow | null>(null);
  const [restoreResult, setRestoreResult] = useState<any>(null);

  const [uploadConfirm, setUploadConfirm] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showAuditLog, setShowAuditLog] = useState(false);
  const [auditLogEntries, setAuditLogEntries] = useState<any[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  const showAlert = (type: 'success' | 'error', msg: string) => {
    if (type === 'success') setSuccessMsg(msg);
    else setErrorMsg(msg);
    setTimeout(() => { setSuccessMsg(null); setErrorMsg(null); }, 6000);
  };

  const loadBackups = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.getBackups();
      setBackups(data as BackupRow[]);
    } catch (err: any) {
      showAlert('error', err?.message || 'فشل تحميل النسخ الاحتياطية');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { if (isOwner) loadBackups(); }, [isOwner, loadBackups]);

  const handleCreateBackup = async () => {
    setActionLoading('create');
    try {
      const res = await api.createBackup();
      showAlert('success', res.message || 'تم إنشاء النسخة بنجاح');
      await loadBackups();
    } catch (err: any) {
      showAlert('error', err?.message || 'فشل إنشاء النسخة');
    } finally {
      setActionLoading(null);
    }
  };

  const handleVerify = async (backup: BackupRow) => {
    setActionLoading(`verify-${backup.id}`);
    try {
      const res = await api.verifyBackup(backup.id);
      showAlert(res.valid ? 'success' : 'error', res.message);
      await loadBackups();
    } catch (err: any) {
      showAlert('error', err?.message || 'فشل التحقق');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDownload = async (backup: BackupRow) => {
    setActionLoading(`download-${backup.id}`);
    try {
      await api.downloadBackup(backup.id);
      showAlert('success', 'تم تنزيل النسخة الاحتياطية');
    } catch (err: any) {
      showAlert('error', err?.message || 'فشل التنزيل');
    } finally {
      setActionLoading(null);
    }
  };

  const handleViewDetails = async (backup: BackupRow) => {
    setDetailsLoading(true);
    setDetailsBackup(backup);
    try {
      const full = await api.getBackupDetails(backup.id);
      setDetailsBackup(full as BackupRow);
    } catch (err: any) {
      showAlert('error', err?.message || 'فشل تحميل التفاصيل');
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleRestoreClick = (backup: BackupRow) => {
    if (backup.status !== 'valid' && backup.status !== 'completed') {
      showAlert('error', 'يجب التحقق من سلامة النسخة أولاً قبل الاستعادة');
      return;
    }
    setRestoreConfirm(backup);
    setRestoreResult(null);
  };

  const handleRestoreConfirm = async () => {
    if (!restoreConfirm) return;
    setActionLoading(`restore-${restoreConfirm.id}`);
    try {
      const res = await api.restoreBackup(restoreConfirm.id);
      setRestoreResult(res);
      showAlert('success', res.message);
      await loadBackups();
    } catch (err: any) {
      setRestoreResult({ success: false, error: err?.message });
      showAlert('error', err?.message || 'فشلت الاستعادة');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (backup: BackupRow) => {
    if (!window.confirm(`هل أنت متأكد من حذف النسخة الاحتياطية "${backup.name}"؟`)) return;
    setActionLoading(`delete-${backup.id}`);
    try {
      await api.deleteBackup(backup.id);
      showAlert('success', 'تم حذف النسخة');
      await loadBackups();
    } catch (err: any) {
      showAlert('error', err?.message || 'فشل الحذف');
    } finally {
      setActionLoading(null);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadConfirm(file);
    setUploadPreview(null);

    file.text().then((text) => {
      try {
        const parsed = JSON.parse(text);
        if (!parsed?.data || !parsed?.version) {
          setUploadPreview({ valid: false, error: 'الملف لا يحتوي على بنية نسخة احتياطية صالحة' });
          return;
        }
        const tables = Object.keys(parsed.data);
        let total = 0;
        for (const t of tables) total += (parsed.data[t] as any[]).length;
        setUploadPreview({
          valid: true,
          version: parsed.version,
          createdAt: parsed.createdAt,
          createdBy: parsed.createdBy,
          tablesCount: tables.length,
          totalRecords: total,
          tables: tables,
          sizeBytes: file.size,
          fileName: file.name,
        });
      } catch {
        setUploadPreview({ valid: false, error: 'الملف ليس JSON صالح' });
      }
    }).catch(() => setUploadPreview({ valid: false, error: 'تعذر قراءة الملف' }));
  };

  const handleUploadConfirm = async () => {
    if (!uploadConfirm) return;
    setActionLoading('upload');
    try {
      const res = await api.uploadBackup(uploadConfirm);
      showAlert('success', res.message);
      setUploadConfirm(null);
      setUploadPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await loadBackups();
    } catch (err: any) {
      showAlert('error', err?.message || 'فشل رفع النسخة');
    } finally {
      setActionLoading(null);
    }
  };

  const handleShowAuditLog = async () => {
    setShowAuditLog(true);
    setAuditLoading(true);
    try {
      const data = await api.getBackupAuditLog();
      setAuditLogEntries(data);
    } catch {
      setAuditLogEntries([]);
    } finally {
      setAuditLoading(false);
    }
  };

  const canRestore = (status: BackupStatus) => status === 'valid' || status === 'completed';

  const StatCard: React.FC<{ label: string; value: string; sub?: string; icon: React.ComponentType<{ className?: string }>; color: string }> = ({ label, value, sub, icon: Icon, color }) => (
    <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs">
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 mb-1">
        <Icon className={`w-4 h-4 ${color}`} />
        {label}
      </div>
      <div className="text-base font-bold text-slate-900 mt-1">{value}</div>
      {sub && <div className="text-[11px] text-slate-500 mt-0.5">{sub}</div>}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Alerts */}
      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2 font-medium"><CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />{successMsg}</div>
          <button onClick={() => setSuccessMsg(null)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
        </div>
      )}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2 font-medium"><AlertCircle className="w-4 h-4 text-red-600 shrink-0" />{errorMsg}</div>
          <button onClick={() => setErrorMsg(null)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="المستخدمون" value={String(stats.users ?? '—')} icon={Users} color="text-emerald-600" />
        <StatCard label="الكليات" value={String(stats.colleges ?? '—')} icon={Building2} color="text-blue-600" />
        <StatCard label="التدريسيون" value={String(stats.faculties ?? '—')} icon={Users} color="text-amber-600" />
        <StatCard label="سجلات الحضور" value={String(stats.attendance_records ?? '—')} icon={Activity} color="text-purple-600" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="حالة الخادم" value={health?.status === 'online' ? 'متصل' : 'غير متصل'} icon={Server} color={health?.status === 'online' ? 'text-emerald-600' : 'text-red-500'} />
        <StatCard label="قاعدة البيانات" value={health?.database || 'غير متصل'} sub={health?.dbLatency != null ? `${health.dbLatency}ms` : ''} icon={Database} color="text-blue-600" />
        <StatCard label="سجلات التدقيق" value={String(stats.audit_logs ?? auditLogsCount)} icon={FileSpreadsheet} color="text-slate-600" />
      </div>

      {/* Action Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-slate-900 text-base">النسخ الاحتياطي الشامل</h3>
            <p className="text-xs text-slate-500 mt-0.5">إنشاء واستعادة وإدارة النسخ الاحتياطية الكاملة لقاعدة البيانات</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => loadBackups()}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />تحديث
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium text-xs cursor-pointer"
            >
              <Upload className="w-4 h-4" />رفع نسخة
            </button>
            <button
              onClick={handleShowAuditLog}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs cursor-pointer"
            >
              <History className="w-4 h-4" />سجل العمليات
            </button>
            <button
              onClick={handleCreateBackup}
              disabled={actionLoading === 'create'}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {actionLoading === 'create' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {actionLoading === 'create' ? 'جاري الإنشاء...' : 'إنشاء نسخة احتياطية'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        </div>
      </div>

      {/* Backups Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-900 text-sm">النسخ الاحتياطية المتاحة</h3>
        </div>
        {isLoading ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-slate-300" />
            جاري التحميل...
          </div>
        ) : backups.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            <Database className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            لا توجد نسخ احتياطية. اضغط "إنشاء نسخة احتياطية" للبدء.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3">اسم النسخة</th>
                  <th className="py-3 px-3">المعرّف</th>
                  <th className="py-3 px-3">التاريخ</th>
                  <th className="py-3 px-3">أنشأها</th>
                  <th className="py-3 px-3">النوع</th>
                  <th className="py-3 px-3">الحجم</th>
                  <th className="py-3 px-3">السجلات</th>
                  <th className="py-3 px-3">الحالة</th>
                  <th className="py-3 px-3">السلامة</th>
                  <th className="py-3 px-3 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {backups.map((backup) => (
                  <tr key={backup.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-3 font-bold text-slate-900 max-w-xs truncate">{backup.name}</td>
                    <td className="py-3 px-3 text-slate-400 font-mono text-[10px]">{backup.id.slice(0, 12)}...</td>
                    <td className="py-3 px-3 text-slate-500 whitespace-nowrap">{backup.createdAt ? new Date(backup.createdAt).toLocaleString('ar-IQ') : '—'}</td>
                    <td className="py-3 px-3">{backup.createdByName || '—'}</td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[11px] font-medium">
                        {backup.type === 'full' ? 'شاملة' : 'جزئية'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-500">{formatSize(backup.sizeBytes || 0)}</td>
                    <td className="py-3 px-3 text-slate-500">{backup.totalRecords || 0}</td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${statusColors[backup.status] || 'bg-slate-100 text-slate-600'}`}>
                        {statusLabels[backup.status] || backup.status}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      {backup.verificationResult ? (
                        <span className={`inline-flex items-center gap-1 text-[11px] font-bold ${backup.verificationResult.valid ? 'text-emerald-700' : 'text-red-700'}`}>
                          {backup.verificationResult.valid ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                          {backup.verificationResult.valid ? 'سليمة' : 'غير سليمة'}
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400">لم يتم التحقق</span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleViewDetails(backup)}
                          title="عرض التفاصيل"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 cursor-pointer"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleVerify(backup)}
                          title="التحقق من السلامة"
                          disabled={actionLoading === `verify-${backup.id}`}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 cursor-pointer disabled:opacity-50"
                        >
                          {actionLoading === `verify-${backup.id}` ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => handleDownload(backup)}
                          title="تنزيل"
                          disabled={actionLoading === `download-${backup.id}`}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer disabled:opacity-50"
                        >
                          {actionLoading === `download-${backup.id}` ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => handleRestoreClick(backup)}
                          title="استعادة"
                          disabled={!canRestore(backup.status) || actionLoading === `restore-${backup.id}`}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          {actionLoading === `restore-${backup.id}` ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => handleDelete(backup)}
                          title="حذف"
                          disabled={actionLoading === `delete-${backup.id}`}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer disabled:opacity-50"
                        >
                          <Trash2 className="w-4 h-4" />
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

      {/* Security notice */}
      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-start gap-3">
        <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
        <div>
          <strong className="text-slate-700">ملاحظات أمنية:</strong>
          <ul className="mt-1 space-y-0.5 text-[11px] text-slate-500">
            <li>- عملية الاستعادة تستبدل البيانات الحالية بالكامل. يُنصح بإنشاء نسخة احتياطية قبل الاستعادة.</li>
            <li>- صلاحية الإنشاء منفصلة عن صلاحية الاستعادة - كلاهما يتطلب صلاحية مالك النظام.</li>
            <li>- استعادة البيانات لا تستعيد الأسرار الخارجية (كلمات مرور الخدمات، إعدادات الاستضافة، مفاتيح API).</li>
            <li>- جميع عمليات النسخ والاستعادة مسجلة في سجل تدقيق مستقل.</li>
          </ul>
        </div>
      </div>

      {/* ===== DETAILS MODAL ===== */}
      {detailsBackup && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 sticky top-0 bg-white">
              <div className="flex items-center gap-2">
                <FileJson className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-bold text-slate-900">تفاصيل النسخة الاحتياطية</h3>
              </div>
              <button onClick={() => setDetailsBackup(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>

            {detailsLoading ? (
              <div className="py-8 text-center text-xs text-slate-400"><RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />جاري التحميل...</div>
            ) : (
              <div className="space-y-3 pt-3">
                <DetailRow label="المعرّف" value={detailsBackup.id} mono />
                <DetailRow label="اسم النسخة" value={detailsBackup.name} />
                <DetailRow label="تاريخ الإنشاء" value={detailsBackup.createdAt ? new Date(detailsBackup.createdAt).toLocaleString('ar-IQ') : 'غير متوفرة'} />
                <DetailRow label="الحجم" value={formatSize(detailsBackup.sizeBytes || 0)} />
                <DetailRow label="المستخدم الذي أنشأها" value={detailsBackup.createdByName || 'غير متوفرة'} />
                <DetailRow label="نوع النسخة" value={detailsBackup.type === 'full' ? 'شاملة' : 'جزئية'} />
                <DetailRow label="إصدار التنسيق" value={detailsBackup.formatVersion || 'غير متوفرة'} />
                <DetailRow label="عدد السجلات" value={String(detailsBackup.totalRecords || 0)} />
                <DetailRow label="عدد الجداول" value={String(detailsBackup.tablesCount || 0)} />

                <div className="pt-2">
                  <div className="text-xs font-bold text-slate-700 mb-2">الجداول المشمولة</div>
                  {detailsBackup.tablesIncluded && detailsBackup.tablesIncluded.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {detailsBackup.tablesIncluded.map((t) => (
                        <span key={t} className="px-2 py-1 rounded-lg bg-slate-100 text-slate-600 text-[10px] font-mono">{t}</span>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-400">غير متوفرة</div>
                  )}
                </div>

                <div className="pt-2">
                  <div className="text-xs font-bold text-slate-700 mb-2">التحقق من السلامة</div>
                  {detailsBackup.verificationResult ? (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                      <div className="flex items-center gap-2 text-xs">
                        {detailsBackup.verificationResult.valid ? (
                          <><CheckCircle2 className="w-4 h-4 text-emerald-600" /><span className="text-emerald-700 font-bold">النسخة سليمة</span></>
                        ) : (
                          <><AlertCircle className="w-4 h-4 text-red-600" /><span className="text-red-700 font-bold">النسخة غير سليمة</span></>
                        )}
                      </div>
                      {detailsBackup.verificationResult.verifiedAt && (
                        <div className="text-[11px] text-slate-500">تاريخ التحقق: {new Date(detailsBackup.verificationResult.verifiedAt).toLocaleString('ar-IQ')}</div>
                      )}
                      {detailsBackup.verificationResult.issues && detailsBackup.verificationResult.issues.length > 0 && (
                        <div className="text-[11px] text-red-600 mt-1">المشاكل: {detailsBackup.verificationResult.issues.join('، ')}</div>
                      )}
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-400">لم يتم التحقق من هذه النسخة بعد</div>
                  )}
                </div>

                <div className="pt-2">
                  <div className="text-xs font-bold text-slate-700 mb-2">آخر عملية استعادة</div>
                  {detailsBackup.restoreResult ? (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                      <div className="text-[11px] text-slate-600">تاريخ الاستعادة: {detailsBackup.restoredAt ? new Date(detailsBackup.restoredAt).toLocaleString('ar-IQ') : 'غير متوفرة'}</div>
                      {detailsBackup.restoreResult.totalInserted != null && (
                        <div className="text-[11px] text-slate-600">السجلات المستعادة: {detailsBackup.restoreResult.totalInserted}</div>
                      )}
                      {detailsBackup.restoreResult.tablesRestored != null && (
                        <div className="text-[11px] text-slate-600">الجداول المستعادة: {detailsBackup.restoreResult.tablesRestored}</div>
                      )}
                      {detailsBackup.restoreResult.errors && detailsBackup.restoreResult.errors.length > 0 && (
                        <div className="text-[11px] text-amber-600 mt-1">أخطاء: {detailsBackup.restoreResult.errors.join('، ')}</div>
                      )}
                      {detailsBackup.restoreResult.error && (
                        <div className="text-[11px] text-red-600 mt-1">خطأ: {detailsBackup.restoreResult.error}</div>
                      )}
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-400">لم يتم استعادة هذه النسخة</div>
                  )}
                </div>

                {detailsBackup.notes && (
                  <DetailRow label="ملاحظات" value={detailsBackup.notes} />
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== RESTORE CONFIRMATION MODAL ===== */}
      {restoreConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                <h3 className="text-base font-bold text-slate-900">تأكيد الاستعادة</h3>
              </div>
              <button onClick={() => { setRestoreConfirm(null); setRestoreResult(null); }} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>

            {!restoreResult ? (
              <div className="space-y-4 pt-4">
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div className="text-xs text-amber-800 space-y-2">
                      <p><strong>تحذير: عملية الاستعادة ستستبدل جميع البيانات الحالية!</strong></p>
                      <p>النسخة: <strong>{restoreConfirm.name}</strong></p>
                      <p>التاريخ: {restoreConfirm.createdAt ? new Date(restoreConfirm.createdAt).toLocaleString('ar-IQ') : '—'}</p>
                      <p>السجلات: {restoreConfirm.totalRecords || 0} | الجداول: {restoreConfirm.tablesCount || 0}</p>
                    </div>
                  </div>
                </div>

                <div className="text-xs text-slate-600 space-y-1.5">
                  <p className="font-bold text-slate-700">البيانات التي ستتأثر:</p>
                  <ul className="list-disc list-inside space-y-0.5 text-[11px] text-slate-500 mr-3">
                    <li>جميع الكليات والأقسام والمراحل والشعب</li>
                    <li>جميع التدريسيين والمواد والجداول</li>
                    <li>جميع سجلات الحضور والأدلة</li>
                    <li>المستخدمون والصلاحيات والإعدادات</li>
                    <li>سجلات التدقيق والإشعارات</li>
                  </ul>
                  <p className="text-[11px] text-red-600 mt-2 font-medium">سيتم فقدان أي تغييرات أحدث من تاريخ هذه النسخة.</p>
                </div>

                <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-[11px] text-blue-700">
                  ملاحظة: لا يمكن استعادة الأسرار الخارجية (كلمات مرور الخدمات، مفاتيح API، إعدادات الاستضافة) من النسخة الاحتياطية.
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button onClick={() => { setRestoreConfirm(null); setRestoreResult(null); }} className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-medium cursor-pointer">إلغاء</button>
                  <button
                    onClick={handleRestoreConfirm}
                    disabled={actionLoading === `restore-${restoreConfirm.id}`}
                    className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs cursor-pointer disabled:opacity-50"
                  >
                    {actionLoading === `restore-${restoreConfirm.id}` ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                    {actionLoading === `restore-${restoreConfirm.id}` ? 'جاري الاستعادة...' : 'تأكيد الاستعادة'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 pt-4">
                {restoreResult.success ? (
                  <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                      <div className="text-xs text-emerald-800 space-y-1">
                        <p className="font-bold">تمت الاستعادة بنجاح</p>
                        <p>{restoreResult.message}</p>
                        {restoreResult.errors && restoreResult.errors.length > 0 && (
                          <p className="text-amber-700 mt-1">أخطاء جزئية: {restoreResult.errors.join('، ')}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-red-50 border border-red-200">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                      <div className="text-xs text-red-800 space-y-1">
                        <p className="font-bold">فشلت الاستعادة</p>
                        <p>{restoreResult.error || 'حدث خطأ غير متوقع'}</p>
                        <p className="text-[11px] text-slate-500 mt-1">لم تتأثر البيانات الحالية. يمكن إعادة المحاولة بعد معالجة الخطأ.</p>
                      </div>
                    </div>
                  </div>
                )}
                <div className="flex justify-end">
                  <button onClick={() => { setRestoreConfirm(null); setRestoreResult(null); }} className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium cursor-pointer">إغلاق</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== UPLOAD CONFIRMATION MODAL ===== */}
      {uploadConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold text-slate-900">مراجعة النسخة المرفوعة</h3>
              </div>
              <button onClick={() => { setUploadConfirm(null); setUploadPreview(null); if (fileInputRef.current) fileInputRef.current.value = ''; }} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>

            <div className="space-y-4 pt-4">
              {!uploadPreview ? (
                <div className="py-6 text-center text-xs text-slate-400"><RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />جاري فحص الملف...</div>
              ) : !uploadPreview.valid ? (
                <div className="p-4 rounded-xl bg-red-50 border border-red-200">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                    <div className="text-xs text-red-800">
                      <p className="font-bold">الملف غير صالح</p>
                      <p className="mt-1">{uploadPreview.error}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 space-y-2">
                    <div className="text-xs font-bold text-blue-900">معلومات النسخة:</div>
                    <div className="grid grid-cols-2 gap-2 text-[11px] text-blue-700">
                      <div>الملف: {uploadPreview.fileName}</div>
                      <div>الحجم: {formatSize(uploadPreview.sizeBytes)}</div>
                      <div>الإصدار: {uploadPreview.version}</div>
                      <div>السجلات: {uploadPreview.totalRecords}</div>
                      <div>الجداول: {uploadPreview.tablesCount}</div>
                      <div>أنشأها: {uploadPreview.createdBy || 'غير متوفرة'}</div>
                      <div className="col-span-2">تاريخ الإنشاء: {uploadPreview.createdAt ? new Date(uploadPreview.createdAt).toLocaleString('ar-IQ') : 'غير متوفرة'}</div>
                    </div>
                  </div>

                  <div className="text-xs text-slate-600">
                    <p className="font-bold text-slate-700 mb-1">الجداول المشمولة:</p>
                    <div className="flex flex-wrap gap-1">
                      {uploadPreview.tables.map((t: string) => (
                        <span key={t} className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600 text-[10px] font-mono">{t}</span>
                      ))}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-800">
                    تنبيه: يجب التحقق من سلامة النسخة المرفوعة قبل استخدامها للاستعادة.
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                    <button onClick={() => { setUploadConfirm(null); setUploadPreview(null); if (fileInputRef.current) fileInputRef.current.value = ''; }} className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-medium cursor-pointer">إلغاء</button>
                    <button
                      onClick={handleUploadConfirm}
                      disabled={actionLoading === 'upload'}
                      className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs cursor-pointer disabled:opacity-50"
                    >
                      {actionLoading === 'upload' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      {actionLoading === 'upload' ? 'جاري الرفع...' : 'تأكيد الرفع'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== AUDIT LOG MODAL ===== */}
      {showAuditLog && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 shadow-2xl border border-slate-100 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 sticky top-0 bg-white">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-slate-600" />
                <h3 className="text-base font-bold text-slate-900">سجل عمليات النسخ والاستعادة</h3>
              </div>
              <button onClick={() => setShowAuditLog(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>

            {auditLoading ? (
              <div className="py-8 text-center text-xs text-slate-400"><RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />جاري التحميل...</div>
            ) : auditLogEntries.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">لا توجد سجلات.</div>
            ) : (
              <div className="overflow-x-auto mt-3">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">العملية</th>
                      <th className="py-2.5 px-3">المستخدم</th>
                      <th className="py-2.5 px-3">النسخة</th>
                      <th className="py-2.5 px-3">النتيجة</th>
                      <th className="py-2.5 px-3">الخطأ</th>
                      <th className="py-2.5 px-3">الوقت</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {auditLogEntries.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-semibold text-slate-900">{log.action || '—'}</td>
                        <td className="py-2.5 px-3">{log.userName || '—'}</td>
                        <td className="py-2.5 px-3 text-slate-400 font-mono text-[10px]">{log.backupId?.slice(0, 12) || '—'}...</td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${log.result === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                            {log.result === 'success' ? 'نجاح' : 'فشل'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 max-w-xs truncate">{log.errorMessage || '—'}</td>
                        <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">{log.createdAt ? new Date(log.createdAt).toLocaleString('ar-IQ') : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="mt-3 p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-500">
              سجل عمليات النسخ الاحتياطي مستقل عن سجل التدقيق العام. لا يتم تسجيل كلمات المرور أو الأسرار الحساسة.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const DetailRow: React.FC<{ label: string; value: string; mono?: boolean }> = ({ label, value, mono }) => (
  <div className="flex items-start justify-between gap-4 py-1.5 border-b border-slate-50">
    <span className="text-xs font-medium text-slate-500 shrink-0">{label}</span>
    <span className={`text-xs text-slate-900 text-left ${mono ? 'font-mono text-[10px]' : ''}`}>{value || 'غير متوفرة'}</span>
  </div>
);
