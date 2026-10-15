import React, { useState, useEffect, useMemo } from 'react';
import ExcelJS from 'exceljs';
import { api } from '../../services/api.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import {
  Settings,
  Shield,
  HardDrive,
  CheckCircle2,
  AlertCircle,
  Download,
  Activity,
  Calendar,
  Plus,
  Trash2,
  Check,
  Sparkles,
  X,
  RefreshCw,
  Building2,
  Users,
  Mail,
  Smartphone,
  Sliders,
  FileSpreadsheet,
  Search,
  Database,
  Server,
} from 'lucide-react';

type SettingsTab = 'general' | 'academic' | 'accounts' | 'email' | 'devices' | 'permissions' | 'attendance' | 'backup' | 'audit';

export const SystemSettings: React.FC = () => {
  const { user: currentUser } = useAuth();
  const isOwner = currentUser?.role === 'OWNER';
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');

  // Academic Calendar Data
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [semesters, setSemesters] = useState<any[]>([]);
  const [currentSettingYear, setCurrentSettingYear] = useState<string>('2025-2026');
  const [currentSettingSemester, setCurrentSettingSemester] = useState<string>('FIRST');

  // University Info
  const [univInfo, setUnivInfo] = useState<any>({});
  const [univForm, setUnivForm] = useState({ name: '', chancellor: '', address: '', phone: '', email: '', website: '' });

  // Account Settings
  const [accountSettings, setAccountSettings] = useState<any>({ selfRegistration: false, emailVerification: true, requireApproval: true, defaultMaxDevices: 1, passwordMinLength: 12 });

  // Email Config
  const [emailConfig, setEmailConfig] = useState<any>({ configured: false, enabled: false, fromName: '', fromEmail: '', codeExpiryMinutes: 10, resendCooldownSeconds: 120 });

  // System Health & Stats
  const [health, setHealth] = useState<any>(null);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupMessage, setBackupMessage] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Audit search/filter
  const [auditSearch, setAuditSearch] = useState('');
  const [auditActionFilter, setAuditActionFilter] = useState('');

  // Modals
  const [isSemesterModalOpen, setIsSemesterModalOpen] = useState(false);
  const [isYearModalOpen, setIsYearModalOpen] = useState(false);
  const [semesterForm, setSemesterForm] = useState({ nameAr: '', nameEn: '', semesterNumber: 1, academicYearId: '', startDate: '', endDate: '', isCurrent: true });
  const [yearForm, setYearForm] = useState({ name: '2025-2026', startDate: '2025-09-15', endDate: '2026-06-30', isCurrent: true });

  const loadData = async () => {
    setIsLoading(true);
    try {
      const results = await Promise.allSettled([
        api.getHealth(),
        api.getAuditLogs(),
        api.getAcademicYears(),
        api.getSemesters(),
        api.getSettings(),
        api.getUniversityInfo(),
        api.getAccountSettings(),
        api.getEmailConfig(),
        api.getSystemStats(),
      ]);

      if (results[0].status === 'fulfilled') setHealth(results[0].value);
      if (results[1].status === 'fulfilled') setAuditLogs(results[1].value || []);
      if (results[2].status === 'fulfilled') setAcademicYears(results[2].value || []);
      if (results[3].status === 'fulfilled') setSemesters(results[3].value || []);

      if (results[4].status === 'fulfilled' && results[4].value) {
        const settings = results[4].value as Record<string, any>;
        const acStruct = settings?.academicStructure;
        if (acStruct?.currentAcademicYear) setCurrentSettingYear(acStruct.currentAcademicYear);
        if (acStruct?.currentSemester) setCurrentSettingSemester(acStruct.currentSemester);
      }

      if (results[5].status === 'fulfilled' && results[5].value) {
        setUnivInfo(results[5].value);
        setUnivForm({
          name: results[5].value.name || '',
          chancellor: results[5].value.chancellor || '',
          address: results[5].value.address || '',
          phone: results[5].value.phone || '',
          email: results[5].value.email || '',
          website: results[5].value.website || '',
        });
      }

      if (results[6].status === 'fulfilled' && results[6].value) {
        setAccountSettings(results[6].value);
      }

      if (results[7].status === 'fulfilled' && results[7].value) {
        setEmailConfig(results[7].value);
      }

      if (results[8].status === 'fulfilled') setStats(results[8].value);

      const yearsResult = results[2];
      if (yearsResult.status === 'fulfilled' && yearsResult.value?.length > 0 && !semesterForm.academicYearId) {
        setSemesterForm((prev) => ({ ...prev, academicYearId: yearsResult.value[0].id }));
      }
    } catch {
      // safe fallback
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const showAlert = (type: 'success' | 'error', msg: string) => {
    if (type === 'success') setActionSuccess(msg);
    else setActionError(msg);
    setTimeout(() => { setActionSuccess(null); setActionError(null); }, 5000);
  };

  // --- Academic handlers ---
  const handleSetActiveSemester = async (sem: any) => {
    try {
      await api.updateSemester(sem.id, { isCurrent: true });
      let semCode = 'FIRST';
      if (sem.nameAr?.includes('ثان') || sem.semesterNumber === 2) semCode = 'SECOND';
      else if (sem.nameAr?.includes('صيف') || sem.semesterNumber === 3) semCode = 'SUMMER';
      else if (sem.nameAr?.includes('سنو')) semCode = 'ANNUAL';
      const yearName = academicYears.find((y) => y.id === sem.academicYearId)?.name || currentSettingYear;
      await api.updateSettings('academicSettings', { academicStructure: { currentAcademicYear: yearName, currentSemester: semCode } });
      setCurrentSettingSemester(semCode);
      setCurrentSettingYear(yearName);
      showAlert('success', `تم تفعيل (${sem.nameAr}) كفصل دراسي نشط`);
      loadData();
    } catch (err: any) { showAlert('error', err?.message || 'تعذر تحديث الفصل النشط'); }
  };

  const handleQuickSwitchTerm = async (semesterCode: string) => {
    try {
      await api.updateSettings('academicSettings', { academicStructure: { currentAcademicYear: currentSettingYear, currentSemester: semesterCode } });
      setCurrentSettingSemester(semesterCode);
      const name = semesterCode === 'FIRST' ? 'الفصل الأول' : semesterCode === 'SECOND' ? 'الفصل الثاني' : 'الفصل الصيفي';
      showAlert('success', `تم تعيين (${name}) كفصل دراسي نشط`);
      loadData();
    } catch (err: any) { showAlert('error', err?.message || 'فشل تحديث الفصل'); }
  };

  const handleCreateSemester = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createSemester(semesterForm);
      showAlert('success', `تمت إضافة الفصل الدراسي (${semesterForm.nameAr}) بنجاح`);
      setIsSemesterModalOpen(false);
      setSemesterForm({ nameAr: '', nameEn: '', semesterNumber: 1, academicYearId: academicYears[0]?.id || '', startDate: '', endDate: '', isCurrent: false });
      loadData();
    } catch (err: any) { showAlert('error', err?.message || 'تعذر إضافة الفصل الدراسي'); }
  };

  const handleDeleteSemester = async (id: string, name: string) => {
    if (!window.confirm(`هل أنت متأكد من حذف الفصل الدراسي (${name})؟`)) return;
    try { await api.deleteSemester(id); showAlert('success', 'تم حذف الفصل بنجاح'); loadData(); }
    catch (err: any) { showAlert('error', err?.message || 'فشل حذف الفصل'); }
  };

  const handleCreateYear = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await api.createAcademicYear(yearForm); showAlert('success', `تمت إضافة السنة الدراسية (${yearForm.name})`); setIsYearModalOpen(false); loadData(); }
    catch (err: any) { showAlert('error', err?.message || 'تعذر إضافة السنة'); }
  };

  const handleDeleteYear = async (id: string, name: string) => {
    if (!window.confirm(`هل أنت متأكد من حذف السنة الدراسية (${name})؟`)) return;
    try { await api.deleteAcademicYear(id); showAlert('success', 'تم حذف السنة بنجاح'); loadData(); }
    catch (err: any) { showAlert('error', err?.message || 'فشل حذف السنة'); }
  };

  // --- University handler ---
  const handleSaveUniv = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.updateUniversityInfo(univForm);
      showAlert('success', 'تم حفظ بيانات الجامعة بنجاح');
      loadData();
    } catch (err: any) { showAlert('error', err?.message || 'فشل حفظ بيانات الجامعة'); }
  };

  // --- Account settings handler ---
  const handleSaveAccountSettings = async () => {
    try {
      await api.updateAccountSettings(accountSettings);
      showAlert('success', 'تم حفظ إعدادات الحسابات بنجاح');
      loadData();
    } catch (err: any) { showAlert('error', err?.message || 'فشل حفظ الإعدادات'); }
  };

  // --- Email config handler ---
  const handleSaveEmailConfig = async () => {
    try {
      await api.updateEmailConfig(emailConfig);
      showAlert('success', 'تم حفظ إعدادات البريد بنجاح');
      loadData();
    } catch (err: any) { showAlert('error', err?.message || 'فشل حفظ إعدادات البريد'); }
  };

  // --- Backup handler ---
  const handleBackup = async () => {
    if (!window.confirm('سيتم إنشاء نسخة احتياطية شاملة من جميع البيانات. هل تريد المتابعة؟')) return;
    setIsBackingUp(true);
    setBackupMessage(null);
    try {
      const res = await api.triggerBackup();
      const backupData = res?.data || res;
      if (!backupData?.data) { setBackupMessage('لم يتم استرداد بيانات من النسخة الاحتياطية'); return; }

      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'جامعة المستقبل';
      workbook.created = new Date();

      const addSheet = (sheetName: string, rows: any[]) => {
        if (!rows || rows.length === 0) return;
        const sheet = workbook.addWorksheet(sheetName);
        sheet.views = [{ rightToLeft: true }];
        const keys = Object.keys(rows[0]);
        sheet.columns = keys.map((k) => ({ header: k, key: k, width: 22 }));
        const headerRow = sheet.getRow(1);
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF065F46' } };
        headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
        rows.forEach((item) => {
          const rowValues: any = {};
          keys.forEach((k) => {
            const val = item[k];
            rowValues[k] = typeof val === 'object' && val !== null ? JSON.stringify(val) : (val ?? '');
          });
          sheet.addRow(rowValues);
        });
      };

      for (const [tableName, rows] of Object.entries(backupData.data)) {
        addSheet(tableName, rows as any[]);
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `نسخة_احتياطية_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setBackupMessage(res?.message || 'تم إنشاء وتحميل النسخة الاحتياطية بنجاح');
    } catch (err: any) {
      setBackupMessage(err?.message || 'تعذر إنشاء النسخة الاحتياطية');
    } finally {
      setIsBackingUp(false);
    }
  };

  const getSemesterDisplayName = (code: string) => {
    if (code === 'FIRST') return 'الفصل الدراسي الأول';
    if (code === 'SECOND') return 'الفصل الدراسي الثاني';
    if (code === 'SUMMER') return 'الفصل الصيفي المكثف';
    if (code === 'ANNUAL') return 'سنوي';
    return code;
  };

  const filteredAuditLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      const matchSearch = !auditSearch ||
        log.userName?.toLowerCase().includes(auditSearch.toLowerCase()) ||
        log.action?.toLowerCase().includes(auditSearch.toLowerCase()) ||
        log.reason?.toLowerCase().includes(auditSearch.toLowerCase());
      const matchAction = !auditActionFilter || log.action === auditActionFilter;
      return matchSearch && matchAction;
    });
  }, [auditLogs, auditSearch, auditActionFilter]);

  const uniqueActions = useMemo(() => Array.from(new Set(auditLogs.map((l) => l.action))).sort(), [auditLogs]);

  const tabItems: Array<{ id: SettingsTab; label: string; icon: React.ComponentType<{ className?: string }>; ownerOnly?: boolean }> = [
    { id: 'general', label: 'الإعدادات العامة', icon: Building2 },
    { id: 'academic', label: 'التقويم الأكاديمي', icon: Calendar },
    { id: 'accounts', label: 'الحسابات والموافقات', icon: Users, ownerOnly: true },
    { id: 'email', label: 'البريد الإلكتروني', icon: Mail, ownerOnly: true },
    { id: 'devices', label: 'الأجهزة', icon: Smartphone, ownerOnly: true },
    { id: 'permissions', label: 'الأدوار والصلاحيات', icon: Shield },
    { id: 'attendance', label: 'الحضور والمحاضرات', icon: Activity },
    { id: 'backup', label: 'النسخ الاحتياطي', icon: Database, ownerOnly: true },
    { id: 'audit', label: 'سجل التدقيق', icon: FileSpreadsheet },
  ];

  const visibleTabs = tabItems.filter((t) => !t.ownerOnly || isOwner);

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

  const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void; label: string; desc?: string; disabled?: boolean }> = ({ checked, onChange, label, desc, disabled }) => (
    <div className={`flex items-center justify-between py-3 ${disabled ? 'opacity-50' : ''}`}>
      <div>
        <div className="text-xs font-semibold text-slate-800">{label}</div>
        {desc && <div className="text-[11px] text-slate-500 mt-0.5">{desc}</div>}
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${checked ? 'bg-emerald-600' : 'bg-slate-300'}`}
      >
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${checked ? 'right-0.5' : 'right-5'}`} />
      </button>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">إعدادات النظام</h2>
            <p className="text-xs text-slate-500">إدارة شاملة لإعدادات النظام والجامعة وال التقويم الأكاديمي</p>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === tab.id ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Alerts */}
      {actionSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2 font-medium"><CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />{actionSuccess}</div>
          <button onClick={() => setActionSuccess(null)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
        </div>
      )}
      {actionError && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2 font-medium"><AlertCircle className="w-4 h-4 text-red-600 shrink-0" />{actionError}</div>
          <button onClick={() => setActionError(null)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* ===== TAB: GENERAL ===== */}
      {activeTab === 'general' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
            <h3 className="font-bold text-slate-900 text-base mb-1">بيانات الجامعة</h3>
            <p className="text-xs text-slate-500 mb-4">الاسم الرسمي ومعلومات الاتصال الخاصة بالجامعة. تظهر هذه البيانات في النظام والتقارير.</p>
            {!isOwner && <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs mb-4">عرض فقط — تعديل هذه البيانات يتطلب صلاحية مالك النظام</div>}
            <form onSubmit={handleSaveUniv} className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">اسم الجامعة</label>
                <input type="text" value={univForm.name} onChange={(e) => setUnivForm({ ...univForm, name: e.target.value })} disabled={!isOwner} placeholder="جامعة المستقبل" className="w-full p-2.5 rounded-xl border border-slate-300 disabled:bg-slate-50" />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">رئيس الجامعة</label>
                <input type="text" value={univForm.chancellor} onChange={(e) => setUnivForm({ ...univForm, chancellor: e.target.value })} disabled={!isOwner} className="w-full p-2.5 rounded-xl border border-slate-300 disabled:bg-slate-50" />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">العنوان</label>
                <input type="text" value={univForm.address} onChange={(e) => setUnivForm({ ...univForm, address: e.target.value })} disabled={!isOwner} className="w-full p-2.5 rounded-xl border border-slate-300 disabled:bg-slate-50" />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">الهاتف</label>
                <input type="text" value={univForm.phone} onChange={(e) => setUnivForm({ ...univForm, phone: e.target.value })} disabled={!isOwner} className="w-full p-2.5 rounded-xl border border-slate-300 disabled:bg-slate-50" />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">البريد الإلكتروني</label>
                <input type="email" dir="ltr" value={univForm.email} onChange={(e) => setUnivForm({ ...univForm, email: e.target.value })} disabled={!isOwner} className="w-full p-2.5 rounded-xl border border-slate-300 disabled:bg-slate-50" />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">الموقع الإلكتروني</label>
                <input type="text" dir="ltr" value={univForm.website} onChange={(e) => setUnivForm({ ...univForm, website: e.target.value })} disabled={!isOwner} className="w-full p-2.5 rounded-xl border border-slate-300 disabled:bg-slate-50" />
              </div>
              {isOwner && (
                <div className="sm:col-span-2 flex justify-end pt-2 border-t border-slate-100">
                  <button type="submit" className="px-5 py-2 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700 cursor-pointer">حفظ بيانات الجامعة</button>
                </div>
              )}
            </form>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
            <h3 className="font-bold text-slate-900 text-base mb-1">معلومات النظام</h3>
            <p className="text-xs text-slate-500 mb-4">بيانات تقنية عن النظام الحالي</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatCard label="المنطقة الزمنية" value={health?.timezone || 'Asia/Baghdad'} icon={Server} color="text-emerald-600" />
              <StatCard label="قاعدة البيانات" value={health?.database || 'غير متصل'} sub={health?.dbLatency != null ? `${health.dbLatency}ms` : ''} icon={Database} color="text-blue-600" />
              <StatCard label="حالة الخادم" value={health?.status === 'online' ? 'متصل' : 'غير متصل'} icon={Activity} color={health?.status === 'online' ? 'text-emerald-600' : 'text-red-500'} />
            </div>
          </div>
        </div>
      )}

      {/* ===== TAB: ACADEMIC ===== */}
      {activeTab === 'academic' && (
        <div className="space-y-6">
          <div className="bg-gradient-to-l from-emerald-800 via-emerald-700 to-teal-900 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-emerald-200 text-xs font-semibold backdrop-blur-xs mb-2">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-300" />الفصل الدراسي النشط
                </span>
                <h3 className="text-2xl font-black tracking-tight">{getSemesterDisplayName(currentSettingSemester)} — {currentSettingYear}</h3>
                <p className="text-emerald-100 text-xs mt-1">تعتمد جميع الجداول الأسبوعية وحسابات الحضور على هذا الفصل</p>
              </div>
              <div className="bg-white/10 backdrop-blur-xs rounded-xl p-3 border border-white/20 space-y-2 shrink-0">
                <div className="text-[11px] font-bold text-emerald-200">تبديل الفصل النشط:</div>
                <div className="flex items-center gap-2">
                  {['FIRST', 'SECOND', 'SUMMER'].map((code) => (
                    <button key={code} onClick={() => handleQuickSwitchTerm(code)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${currentSettingSemester === code ? 'bg-white text-emerald-900 shadow-xs' : 'bg-white/20 text-white hover:bg-white/30'}`}>
                      {code === 'FIRST' ? 'الأول' : code === 'SECOND' ? 'الثاني' : 'الصيفي'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div><h3 className="text-base font-bold text-slate-900">الفصول الدراسية</h3><p className="text-xs text-slate-500">الفصول ومواعيد بدايتها ونهايتها</p></div>
              <button onClick={() => setIsSemesterModalOpen(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold text-xs"><Plus className="w-4 h-4" />إضافة فصل</button>
            </div>
            {semesters.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">لا توجد فصول دراسية مضافة.</div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200"><tr>
                    <th className="py-3 px-4">الاسم</th><th className="py-3 px-4">السنة</th><th className="py-3 px-4">رقم الفصل</th><th className="py-3 px-4">البداية والنهاية</th><th className="py-3 px-4">الحالة</th><th className="py-3 px-4 text-center">إجراءات</th>
                  </tr></thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {semesters.map((sem) => {
                      const yearObj = academicYears.find((y) => y.id === sem.academicYearId);
                      return (
                        <tr key={sem.id} className="hover:bg-slate-50/70">
                          <td className="py-3 px-4 font-bold text-slate-900">{sem.nameAr}</td>
                          <td className="py-3 px-4">{yearObj?.name || '—'}</td>
                          <td className="py-3 px-4">{sem.semesterNumber || 1}</td>
                          <td className="py-3 px-4 text-slate-500">{sem.startDate && sem.endDate ? `${sem.startDate} — ${sem.endDate}` : 'غير محدد'}</td>
                          <td className="py-3 px-4">{sem.isCurrent ? <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[11px] inline-flex items-center gap-1"><Check className="w-3 h-3" />نشط</span> : <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[11px]">غير نشط</span>}</td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              {!sem.isCurrent && <button onClick={() => handleSetActiveSemester(sem)} className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold text-[11px]">تعيين كنشط</button>}
                              <button onClick={() => handleDeleteSemester(sem.id, sem.nameAr)} className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div><h3 className="text-base font-bold text-slate-900">السنوات الدراسية</h3><p className="text-xs text-slate-500">إدارة الأعوام الدراسية</p></div>
              <button onClick={() => setIsYearModalOpen(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-800 hover:bg-slate-200 font-bold text-xs"><Plus className="w-4 h-4" />إضافة سنة</button>
            </div>
            {academicYears.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">لا توجد سنوات دراسية مسجلة.</div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200"><tr>
                    <th className="py-2.5 px-4">السنة</th><th className="py-2.5 px-4">البداية</th><th className="py-2.5 px-4">النهاية</th><th className="py-2.5 px-4">الحالة</th><th className="py-2.5 px-4 text-center">حذف</th>
                  </tr></thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {academicYears.map((yr) => (
                      <tr key={yr.id} className="hover:bg-slate-50/70">
                        <td className="py-2.5 px-4 font-bold text-slate-900">{yr.name}</td>
                        <td className="py-2.5 px-4">{yr.startDate || '—'}</td>
                        <td className="py-2.5 px-4">{yr.endDate || '—'}</td>
                        <td className="py-2.5 px-4">{yr.isCurrent ? <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">الحالية</span> : <span className="text-slate-400 text-[11px]">سابقة</span>}</td>
                        <td className="py-2.5 px-4 text-center"><button onClick={() => handleDeleteYear(yr.id, yr.name)} className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4" /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== TAB: ACCOUNTS ===== */}
      {activeTab === 'accounts' && isOwner && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
          <h3 className="font-bold text-slate-900 text-base mb-1">إعدادات الحسابات والموافقات</h3>
          <p className="text-xs text-slate-500 mb-4">تحكم في سياسات إنشاء الحسابات والأمان</p>
          <div className="divide-y divide-slate-100">
            <Toggle checked={accountSettings.selfRegistration} onChange={(v) => setAccountSettings({ ...accountSettings, selfRegistration: v })} label="التسجيل الذاتي للحسابات الجديدة" desc="السماح للتدريسيين بطلب إنشاء حساب دون تدخل الإدارة" />
            <Toggle checked={accountSettings.emailVerification} onChange={(v) => setAccountSettings({ ...accountSettings, emailVerification: v })} label="التحقق من البريد الإلكتروني" desc="إرسال رمز تحقق إلى البريد قبل قبول طلب التسجيل" />
            <Toggle checked={accountSettings.requireApproval} onChange={(v) => setAccountSettings({ ...accountSettings, requireApproval: v })} label="مراجعة الإدارة للطلبات الجديدة" desc="يتطلب موافقة مالك النظام قبل تفعيل أي حساب جديد" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">الحد الأقصى للأجهزة لكل حساب</label>
              <input type="number" min={1} max={10} value={accountSettings.defaultMaxDevices} onChange={(e) => setAccountSettings({ ...accountSettings, defaultMaxDevices: parseInt(e.target.value) || 1 })} className="w-full p-2.5 rounded-xl border border-slate-300 text-xs" />
              <p className="text-[11px] text-slate-400 mt-1">عدد الأجهزة المسموح بها لكل مستخدم</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">الحد الأدنى لطول كلمة المرور</label>
              <input type="number" min={8} max={32} value={accountSettings.passwordMinLength} onChange={(e) => setAccountSettings({ ...accountSettings, passwordMinLength: parseInt(e.target.value) || 12 })} className="w-full p-2.5 rounded-xl border border-slate-300 text-xs" />
              <p className="text-[11px] text-slate-400 mt-1">عدد الأحرف الأدنى المطلوب لكلمات المرور</p>
            </div>
          </div>
          <div className="flex justify-end pt-4 border-t border-slate-100 mt-4">
            <button onClick={handleSaveAccountSettings} className="px-5 py-2 rounded-xl bg-emerald-600 text-white font-medium text-xs hover:bg-emerald-700 cursor-pointer">حفظ إعدادات الحسابات</button>
          </div>
        </div>
      )}

      {/* ===== TAB: EMAIL ===== */}
      {activeTab === 'email' && isOwner && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
            <h3 className="font-bold text-slate-900 text-base mb-1">إعدادات البريد الإلكتروني</h3>
            <p className="text-xs text-slate-500 mb-4">تكوين خدمة إرسال البريد لرموز التحقق والإشعارات</p>
            {!emailConfig.configured && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs mb-4">
                خدمة البريد غير مهيأة حالياً. يتم إرسال رموز التحقق عبر دالة الخادم (Edge Function). لتفعيل الإرسال الفعلي، يجب إعداد متغيرات البيئة (SMTP_HOST, SMTP_USER, SMTP_PASS) على الخادم.
              </div>
            )}
            <div className="divide-y divide-slate-100">
              <Toggle checked={emailConfig.enabled} onChange={(v) => setEmailConfig({ ...emailConfig, enabled: v })} label="تفعيل خدمة البريد الإلكتروني" desc="عند التعطيل، يتم تسجيل رموز التحقق في سجل الخادم فقط" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">اسم المرسل</label>
                <input type="text" value={emailConfig.fromName} onChange={(e) => setEmailConfig({ ...emailConfig, fromName: e.target.value })} placeholder="جامعة المستقبل" className="w-full p-2.5 rounded-xl border border-slate-300 text-xs" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">بريد المرسل</label>
                <input type="email" dir="ltr" value={emailConfig.fromEmail} onChange={(e) => setEmailConfig({ ...emailConfig, fromEmail: e.target.value })} placeholder="noreply@uomus.edu.iq" className="w-full p-2.5 rounded-xl border border-slate-300 text-xs" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">صلاحية رمز التحقق (دقائق)</label>
                <input type="number" min={1} max={60} value={emailConfig.codeExpiryMinutes} onChange={(e) => setEmailConfig({ ...emailConfig, codeExpiryMinutes: parseInt(e.target.value) || 10 })} className="w-full p-2.5 rounded-xl border border-slate-300 text-xs" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">فترة إعادة إرسال الرمز (ثواني)</label>
                <input type="number" min={30} max={600} value={emailConfig.resendCooldownSeconds} onChange={(e) => setEmailConfig({ ...emailConfig, resendCooldownSeconds: parseInt(e.target.value) || 120 })} className="w-full p-2.5 rounded-xl border border-slate-300 text-xs" />
              </div>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 mt-4 text-[11px] text-slate-500">
              ملاحظة: كلمات مرور وأسرار خدمة البريد (SMTP) تُدار عبر متغيرات البيئة على الخادم ولا يمكن عرضها أو تعديلها من الواجهة.
            </div>
            <div className="flex justify-end pt-4 border-t border-slate-100 mt-4">
              <button onClick={handleSaveEmailConfig} className="px-5 py-2 rounded-xl bg-emerald-600 text-white font-medium text-xs hover:bg-emerald-700 cursor-pointer">حفظ إعدادات البريد</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== TAB: DEVICES ===== */}
      {activeTab === 'devices' && isOwner && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
          <h3 className="font-bold text-slate-900 text-base mb-1">إعدادات الأجهزة</h3>
          <p className="text-xs text-slate-500 mb-4">إدارة سياسة الأجهزة المرتبطة بحسابات المستخدمين</p>
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-xs font-semibold text-slate-700 mb-1">الحد الأقصى للأجهزة لكل حساب</div>
            <div className="text-base font-bold text-slate-900">{accountSettings.defaultMaxDevices || 1} جهاز</div>
            <p className="text-[11px] text-slate-500 mt-1">يمكن تعديل هذا الحد من تبويب "الحسابات والموافقات"</p>
          </div>
          <div className="mt-6 p-4 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-700">
            لإدارة الأجهزة المسجلة (اعتماد، رفض، إلغاء)، انتقل إلى صفحة "إدارة الأجهزة" من القائمة الجانبية.
          </div>
        </div>
      )}

      {/* ===== TAB: PERMISSIONS ===== */}
      {activeTab === 'permissions' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
          <h3 className="font-bold text-slate-900 text-base mb-1">الأدوار والصلاحيات</h3>
          <p className="text-xs text-slate-500 mb-4">الأدوار المتاحة في النظام ونطاق صلاحيات كل دور</p>
          <div className="space-y-3">
            {[
              { role: 'OWNER', label: 'مالك النظام', color: 'emerald', desc: 'صلاحية كاملة على جميع الكليات والأقسام والإعدادات والحسابات' },
              { role: 'COLLEGE_MONITOR', label: 'مسؤول متابعة الكلية', color: 'blue', desc: 'إدارة الكلية المعينة فقط: الأقسام، التدريسيين، الجداول، الحضور، التقارير' },
              { role: 'DEPARTMENT_MONITOR', label: 'مسؤول متابعة القسم', color: 'purple', desc: 'إدارة القسم المعين فقط: التدريسيين، الجداول، الحضور، التقارير' },
              { role: 'FACULTY', label: 'عضو هيئة تدريس', color: 'amber', desc: 'تسجيل الحضور للمحاضرات المعينة فقط وعرض الجدول الشخصي' },
            ].map((r) => (
              <div key={r.role} className="flex items-start gap-3 p-4 rounded-xl border border-slate-200">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center bg-${r.color}-100 text-${r.color}-700 shrink-0`}>
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">{r.label}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{r.desc}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-500">
            الأدوار ثابتة في النظام الحالي ولا يمكن تعديلها من الواجهة. يتم تعيين الأدوار للمستخدمين من صفحة "إدارة الحسابات".
          </div>
        </div>
      )}

      {/* ===== TAB: ATTENDANCE ===== */}
      {activeTab === 'attendance' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
          <h3 className="font-bold text-slate-900 text-base mb-1">إعدادات الحضور والمحاضرات</h3>
          <p className="text-xs text-slate-500 mb-4">الإعدادات الحالية لتسجيل الحضور في النظام</p>
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-4 rounded-xl border border-slate-200">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-bold text-slate-900">تسجيل الحضور بالصورة</div>
                <div className="text-[11px] text-slate-500 mt-0.5">توثيق الحضور بالصورة داخل القاعة كدليل على إجراء المحاضرة</div>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 rounded-xl border border-slate-200">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-bold text-slate-900">تسجيل عدد الحاضرين</div>
                <div className="text-[11px] text-slate-500 mt-0.5">تسجيل عدد الطلاب الحاضرين في كل محاضرة</div>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 rounded-xl border border-slate-200">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-bold text-slate-900">الإنابة في تسجيل الحضور</div>
                <div className="text-[11px] text-slate-500 mt-0.5">يمكن لمسؤول القسم تسجيل الحضور نيابة عن التدريسي مع تسجيل سبب الإنابة واسم المنفذ</div>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 rounded-xl border border-slate-200">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-bold text-slate-900">سجل التدقيق للحضور</div>
                <div className="text-[11px] text-slate-500 mt-0.5">جميع عمليات تعديل سجلات الحضور الحساسة تُسجل في سجل التدقيق</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== TAB: BACKUP ===== */}
      {activeTab === 'backup' && isOwner && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="المستخدمون" value={String(stats.users ?? '—')} icon={Users} color="text-emerald-600" />
            <StatCard label="الكليات" value={String(stats.colleges ?? '—')} icon={Building2} color="text-blue-600" />
            <StatCard label="التدريسيون" value={String(stats.faculties ?? '—')} icon={Users} color="text-amber-600" />
            <StatCard label="سجلات الحضور" value={String(stats.attendance_records ?? '—')} icon={Activity} color="text-purple-600" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard label="حالة الخادم" value={health?.status === 'online' ? 'متصل' : 'غير متصل'} icon={Server} color={health?.status === 'online' ? 'text-emerald-600' : 'text-red-500'} />
            <StatCard label="قاعدة البيانات" value={health?.database || 'غير متصل'} sub={health?.dbLatency != null ? `${health.dbLatency}ms` : ''} icon={Database} color="text-blue-600" />
            <StatCard label="سجلات التدقيق" value={String(stats.audit_logs ?? auditLogs.length)} icon={FileSpreadsheet} color="text-slate-600" />
          </div>
          <div className="p-6 rounded-2xl border border-emerald-200 bg-emerald-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-emerald-950 text-base">النسخ الاحتياطي الشامل</h3>
              <p className="text-xs text-emerald-800 mt-0.5">تصدير كافة البيانات (الكليات، الأقسام، التدريسيين، المواد، الجداول، الحضور) بصيغة Excel متعدد الأوراق</p>
            </div>
            <button onClick={handleBackup} disabled={isBackingUp} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs shadow-xs disabled:opacity-50 shrink-0 cursor-pointer">
              <Download className="w-4 h-4" />{isBackingUp ? 'جاري التصدير...' : 'توليد وتحميل النسخة'}
            </button>
          </div>
          {backupMessage && <div className="p-4 rounded-xl bg-emerald-100 text-emerald-800 text-xs font-medium">{backupMessage}</div>}
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
            تنبيه: عملية الاستعادة غير متاحة من الواجهة. لاستعادة البيانات، يلزم التواصل مع مدير قاعدة البيانات مع التحقق من ملف النسخة الاحتياطية.
          </div>
        </div>
      )}

      {/* ===== TAB: AUDIT ===== */}
      {activeTab === 'audit' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <h3 className="font-bold text-slate-900 text-base">سجل التدقيق</h3>
          <p className="text-xs text-slate-500">سجل العمليات المهمة في النظام (تسجيل دخول، إنشاء حسابات، تعديل إعدادات، استيراد، نسخ احتياطي)</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
              <input type="text" placeholder="بحث في السجلات..." value={auditSearch} onChange={(e) => setAuditSearch(e.target.value)} className="w-full pl-3 pr-9 py-2.5 rounded-xl border border-slate-300 text-xs" />
            </div>
            <select value={auditActionFilter} onChange={(e) => setAuditActionFilter(e.target.value)} className="p-2.5 rounded-xl border border-slate-300 text-xs cursor-pointer">
              <option value="">جميع العمليات</option>
              {uniqueActions.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          {isLoading ? (
            <div className="py-8 text-center text-slate-400 text-xs">جاري التحميل...</div>
          ) : filteredAuditLogs.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">لا توجد سجلات مطابقة.</div>
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200"><tr>
                  <th className="py-2.5 px-3">العملية</th><th className="py-2.5 px-3">المستخدم</th><th className="py-2.5 px-3">الكيان</th><th className="py-2.5 px-3">التفاصيل</th><th className="py-2.5 px-3">الوقت</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredAuditLogs.slice(0, 100).map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-semibold text-slate-900">{log.action}</td>
                      <td className="py-2.5 px-3">{log.userName || log.userId || 'النظام'}</td>
                      <td className="py-2.5 px-3">{log.entity || '—'}</td>
                      <td className="py-2.5 px-3 text-slate-500 max-w-xs truncate">{log.reason || log.details || '—'}</td>
                      <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">{log.createdAt ? new Date(log.createdAt).toLocaleString('ar-IQ') : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-500">
            سجل التدقيق محمي ولا يمكن تعديله أو حذفه من واجهة الإدارة.
          </div>
        </div>
      )}

      {/* MODAL: ADD SEMESTER */}
      {isSemesterModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">إضافة فصل دراسي جديد</h3>
              <button onClick={() => setIsSemesterModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleCreateSemester} className="space-y-3 text-xs">
              <div><label className="block font-medium text-slate-700 mb-1">اسم الفصل (عربي)</label><input type="text" required value={semesterForm.nameAr} onChange={(e) => setSemesterForm({ ...semesterForm, nameAr: e.target.value })} className="w-full p-2.5 rounded-xl border border-slate-300" /></div>
              <div><label className="block font-medium text-slate-700 mb-1">الاسم (إنجليزي)</label><input type="text" value={semesterForm.nameEn} onChange={(e) => setSemesterForm({ ...semesterForm, nameEn: e.target.value })} className="w-full p-2.5 rounded-xl border border-slate-300" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block font-medium text-slate-700 mb-1">رقم الفصل</label><input type="number" min={1} max={3} value={semesterForm.semesterNumber} onChange={(e) => setSemesterForm({ ...semesterForm, semesterNumber: parseInt(e.target.value) || 1 })} className="w-full p-2.5 rounded-xl border border-slate-300" /></div>
                <div><label className="block font-medium text-slate-700 mb-1">السنة الدراسية</label><select value={semesterForm.academicYearId} onChange={(e) => setSemesterForm({ ...semesterForm, academicYearId: e.target.value })} className="w-full p-2.5 rounded-xl border border-slate-300">{academicYears.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}</select></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block font-medium text-slate-700 mb-1">تاريخ البداية</label><input type="date" value={semesterForm.startDate} onChange={(e) => setSemesterForm({ ...semesterForm, startDate: e.target.value })} className="w-full p-2.5 rounded-xl border border-slate-300" /></div>
                <div><label className="block font-medium text-slate-700 mb-1">تاريخ النهاية</label><input type="date" value={semesterForm.endDate} onChange={(e) => setSemesterForm({ ...semesterForm, endDate: e.target.value })} className="w-full p-2.5 rounded-xl border border-slate-300" /></div>
              </div>
              <div className="flex items-center gap-2"><input type="checkbox" id="semCurrent" checked={semesterForm.isCurrent} onChange={(e) => setSemesterForm({ ...semesterForm, isCurrent: e.target.checked })} /><label htmlFor="semCurrent" className="font-medium text-slate-700">تعيين كفصل نشط</label></div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100"><button type="button" onClick={() => setIsSemesterModalOpen(false)} className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100">إلغاء</button><button type="submit" className="px-5 py-2 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700">إضافة</button></div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD YEAR */}
      {isYearModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">إضافة سنة دراسية</h3>
              <button onClick={() => setIsYearModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleCreateYear} className="space-y-3 text-xs">
              <div><label className="block font-medium text-slate-700 mb-1">اسم السنة الدراسية</label><input type="text" required value={yearForm.name} onChange={(e) => setYearForm({ ...yearForm, name: e.target.value })} className="w-full p-2.5 rounded-xl border border-slate-300" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block font-medium text-slate-700 mb-1">البداية</label><input type="date" value={yearForm.startDate} onChange={(e) => setYearForm({ ...yearForm, startDate: e.target.value })} className="w-full p-2.5 rounded-xl border border-slate-300" /></div>
                <div><label className="block font-medium text-slate-700 mb-1">النهاية</label><input type="date" value={yearForm.endDate} onChange={(e) => setYearForm({ ...yearForm, endDate: e.target.value })} className="w-full p-2.5 rounded-xl border border-slate-300" /></div>
              </div>
              <div className="flex items-center gap-2"><input type="checkbox" id="yearCurrent" checked={yearForm.isCurrent} onChange={(e) => setYearForm({ ...yearForm, isCurrent: e.target.checked })} /><label htmlFor="yearCurrent" className="font-medium text-slate-700">تعيين كالسنة الحالية</label></div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100"><button type="button" onClick={() => setIsYearModalOpen(false)} className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100">إلغاء</button><button type="submit" className="px-5 py-2 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700">إضافة</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
