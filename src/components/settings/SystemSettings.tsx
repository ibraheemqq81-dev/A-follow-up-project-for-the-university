import React, { useState, useEffect } from 'react';
import ExcelJS from 'exceljs';
import { api } from '../../services/api.ts';
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
  Clock,
  Sparkles,
  Layers,
  X,
  RefreshCw,
  Sliders,
} from 'lucide-react';

export const SystemSettings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'academic' | 'system' | 'audit'>('academic');

  // Academic Calendar Data
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [semesters, setSemesters] = useState<any[]>([]);
  const [currentSettingYear, setCurrentSettingYear] = useState<string>('2025-2026');
  const [currentSettingSemester, setCurrentSettingSemester] = useState<string>('FIRST');

  // New Semester Modal
  const [isSemesterModalOpen, setIsSemesterModalOpen] = useState(false);
  const [semesterForm, setSemesterForm] = useState({
    nameAr: '',
    nameEn: '',
    semesterNumber: 1,
    academicYearId: '',
    startDate: '',
    endDate: '',
    isCurrent: true,
  });

  // New Academic Year Modal
  const [isYearModalOpen, setIsYearModalOpen] = useState(false);
  const [yearForm, setYearForm] = useState({
    name: '2025-2026',
    startDate: '2025-09-15',
    endDate: '2026-06-30',
    isCurrent: true,
  });

  // System Diagnostics
  const [health, setHealth] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupMessage, setBackupMessage] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [hRes, aRes, yRes, sRes, setRes] = await Promise.allSettled([
        api.getHealth(),
        api.getAuditLogs(),
        api.getAcademicYears(),
        api.getSemesters(),
        api.getSettings(),
      ]);

      setHealth(hRes.status === 'fulfilled' ? hRes.value : null);
      setAuditLogs(aRes.status === 'fulfilled' ? aRes.value || [] : []);
      const years = yRes.status === 'fulfilled' ? yRes.value || [] : [];
      const sems = sRes.status === 'fulfilled' ? sRes.value || [] : [];
      setAcademicYears(years);
      setSemesters(sems);

      if (years.length > 0 && !semesterForm.academicYearId) {
        setSemesterForm((prev) => ({ ...prev, academicYearId: years[0].id }));
      }

      // Parse current academic structure setting
      if (setRes.status === 'fulfilled' && setRes.value) {
        const settingsList = setRes.value;
        const acRow = Array.isArray(settingsList)
          ? settingsList.find((r: any) => r.key === 'academicSettings')
          : null;
        if (acRow) {
          try {
            const parsed = typeof acRow.value === 'string' ? JSON.parse(acRow.value) : acRow.value;
            const struct = parsed?.academicStructure || parsed;
            if (struct?.currentAcademicYear) setCurrentSettingYear(struct.currentAcademicYear);
            if (struct?.currentSemester) setCurrentSettingSemester(struct.currentSemester);
          } catch {
            // fallback
          }
        }
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

  // Set active semester and sync setting
  const handleSetActiveSemester = async (sem: any) => {
    setActionError(null);
    setActionSuccess(null);
    try {
      await api.updateSemester(sem.id, { isCurrent: true });

      // Map to code
      let semCode = 'FIRST';
      if (sem.nameAr.includes('ثان') || sem.semesterNumber === 2) semCode = 'SECOND';
      else if (sem.nameAr.includes('صيف') || sem.semesterNumber === 3) semCode = 'SUMMER';
      else if (sem.nameAr.includes('سنو')) semCode = 'ANNUAL';

      const yearName = academicYears.find((y) => y.id === sem.academicYearId)?.name || currentSettingYear;

      await api.updateSettings('academicSettings', {
        academicStructure: {
          currentAcademicYear: yearName,
          currentSemester: semCode,
        },
      });

      setCurrentSettingSemester(semCode);
      setCurrentSettingYear(yearName);
      setActionSuccess(`تم تفعيل (${sem.nameAr}) كفصل دراسي نشط ورسمي في النظام بنجاح!`);
      loadData();
    } catch (err: any) {
      setActionError(err?.message || 'تعذر تحديث الفصل النشط');
    }
  };

  // Quick Switch Active Semester via buttons
  const handleQuickSwitchTerm = async (semesterCode: string) => {
    setActionError(null);
    setActionSuccess(null);
    try {
      await api.updateSettings('academicSettings', {
        academicStructure: {
          currentAcademicYear: currentSettingYear,
          currentSemester: semesterCode,
        },
      });
      setCurrentSettingSemester(semesterCode);
      const name =
        semesterCode === 'FIRST'
          ? 'الفصل الأول'
          : semesterCode === 'SECOND'
          ? 'الفصل الثاني'
          : 'الفصل الصيفي';
      setActionSuccess(`تم تعيين (${name}) كفصل دراسي نشط للنظام بنجاح!`);
      loadData();
    } catch (err: any) {
      setActionError(err?.message || 'فشل تحديث الفصل الدراسي النشط');
    }
  };

  // Create Semester
  const handleCreateSemester = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    setActionSuccess(null);

    try {
      await api.createSemester(semesterForm);
      setActionSuccess(`تمت إضافة الفصل الدراسي (${semesterForm.nameAr}) بنجاح!`);
      setIsSemesterModalOpen(false);
      setSemesterForm({
        nameAr: '',
        nameEn: '',
        semesterNumber: 1,
        academicYearId: academicYears[0]?.id || '',
        startDate: '',
        endDate: '',
        isCurrent: false,
      });
      loadData();
    } catch (err: any) {
      setActionError(err?.message || 'تعذر إضافة الفصل الدراسي. يرجى التحقق من المدخلات.');
    }
  };

  // Delete Semester
  const handleDeleteSemester = async (id: string, name: string) => {
    if (!window.confirm(`هل أنت متأكد من حذف الفصل الدراسي (${name})؟`)) return;
    try {
      await api.deleteSemester(id);
      setActionSuccess('تم حذف الفصل الدراسي بنجاح');
      loadData();
    } catch (err: any) {
      setActionError(err?.message || 'فشل حذف الفصل الدراسي');
    }
  };

  // Create Academic Year
  const handleCreateYear = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    setActionSuccess(null);

    try {
      await api.createAcademicYear(yearForm);
      setActionSuccess(`تمت إضافة السنة الدراسية (${yearForm.name}) بنجاح!`);
      setIsYearModalOpen(false);
      loadData();
    } catch (err: any) {
      setActionError(err?.message || 'تعذر إضافة السنة الدراسية');
    }
  };

  // Delete Academic Year
  const handleDeleteYear = async (id: string, name: string) => {
    if (!window.confirm(`هل أنت متأكد من حذف السنة الدراسية (${name})؟`)) return;
    try {
      await api.deleteAcademicYear(id);
      setActionSuccess('تم حذف السنة الدراسية بنجاح');
      loadData();
    } catch (err: any) {
      setActionError(err?.message || 'فشل حذف السنة الدراسية');
    }
  };

  // Backup Export as Excel (.xlsx)
  const handleBackup = async () => {
    setIsBackingUp(true);
    setBackupMessage(null);
    try {
      const res = await api.triggerBackup();
      const backupData = res?.data || res;

      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'جامعة المستقبل - Al-Mustaqbal University';
      workbook.created = new Date();

      const addSheet = (sheetName: string, headers: Array<{ key: string; label: string }>, rows: any[]) => {
        const sheet = workbook.addWorksheet(sheetName);
        sheet.views = [{ rightToLeft: true }];
        sheet.columns = headers.map((h) => ({ header: h.label, key: h.key, width: 22 }));
        const headerRow = sheet.getRow(1);
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        headerRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF065F46' },
        };
        headerRow.alignment = { horizontal: 'center', vertical: 'middle' };

        (rows || []).forEach((item) => {
          const rowValues: any = {};
          headers.forEach((h) => {
            const val = item[h.key];
            rowValues[h.key] = typeof val === 'object' && val !== null ? JSON.stringify(val) : (val ?? '');
          });
          sheet.addRow(rowValues);
        });
      };

      if (backupData.collegesList) {
        addSheet(
          'الكليات',
          [
            { key: 'code', label: 'رمز الكلية' },
            { key: 'nameAr', label: 'اسم الكلية بالعربية' },
            { key: 'nameEn', label: 'اسم الكلية بالإنجليزية' },
            { key: 'deanName', label: 'عميد الكلية' },
            { key: 'email', label: 'البريد الإلكتروني' },
            { key: 'phone', label: 'رقم الهاتف' },
          ],
          backupData.collegesList
        );
      }

      if (backupData.departmentsList) {
        addSheet(
          'الأقسام',
          [
            { key: 'code', label: 'رمز القسم' },
            { key: 'nameAr', label: 'اسم القسم بالعربية' },
            { key: 'nameEn', label: 'اسم القسم بالإنجليزية' },
            { key: 'headName', label: 'رئيس القسم' },
            { key: 'monitorName', label: 'مسؤول المتابعة' },
            { key: 'email', label: 'البريد الإلكتروني' },
          ],
          backupData.departmentsList
        );
      }

      if (backupData.facultyList) {
        addSheet(
          'الكادر_التدريسي',
          [
            { key: 'employeeId', label: 'الرقم الوظيفي' },
            { key: 'nameAr', label: 'اسم التدريسي' },
            { key: 'academicTitle', label: 'اللقب العلمي' },
            { key: 'specialization', label: 'التخصص' },
            { key: 'email', label: 'البريد الرسمي' },
            { key: 'phone', label: 'الهاتف' },
          ],
          backupData.facultyList
        );
      }

      if (backupData.subjectsList) {
        addSheet(
          'المواد_الدراسية',
          [
            { key: 'code', label: 'رمز المادة' },
            { key: 'nameAr', label: 'اسم المادة' },
            { key: 'type', label: 'نوع المادة' },
            { key: 'theoreticalHours', label: 'ساعات نظري' },
            { key: 'practicalHours', label: 'ساعات عملي' },
            { key: 'creditUnits', label: 'الوحدات' },
          ],
          backupData.subjectsList
        );
      }

      if (backupData.schedulesList) {
        addSheet(
          'الجداول_الأسبوعية',
          [
            { key: 'day', label: 'اليوم' },
            { key: 'startTime', label: 'وقت البدء' },
            { key: 'endTime', label: 'وقت الانتهاء' },
            { key: 'academicYear', label: 'السنة الدراسية' },
            { key: 'semester', label: 'الفصل الدراسي' },
            { key: 'lectureType', label: 'نوع المحاضرة' },
          ],
          backupData.schedulesList
        );
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const downloadAnchor = document.createElement('a');
      downloadAnchor.href = url;
      downloadAnchor.download = `نسخة_احتياطية_جامعة_المستقبل_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      URL.revokeObjectURL(url);

      setBackupMessage('تم توليد وتحميل النسخة الاحتياطية بنجاح بصيغة ملف Excel (.xlsx) متعدد الأوراق.');
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

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                إعدادات النظام والتقويم الأكاديمي
              </h2>
              <p className="text-xs text-slate-500">
                إدارة الفصول والسنوات الدراسية، تعيين الفصل الحالي، تشخيص النظام والنسخ الاحتياطي
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsSemesterModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              إضافة فصل دراسي جديد
            </button>
            <button
              onClick={() => setIsYearModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              إضافة سنة دراسية
            </button>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 mt-6 border-b border-slate-200 pb-3">
          <button
            onClick={() => setActiveTab('academic')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              activeTab === 'academic'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Calendar className="w-4 h-4" />
            التقويم والفصول الدراسية
          </button>
          <button
            onClick={() => setActiveTab('system')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              activeTab === 'system'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Settings className="w-4 h-4" />
            صحة الخادم والنسخ الاحتياطي
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              activeTab === 'audit'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Activity className="w-4 h-4" />
            سجل التدقيق والأمان ({auditLogs.length})
          </button>
        </div>
      </div>

      {/* Alerts */}
      {actionSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            {actionSuccess}
          </div>
          <button onClick={() => setActionSuccess(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {actionError && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2 font-medium">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            {actionError}
          </div>
          <button onClick={() => setActionError(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* TAB 1: ACADEMIC CALENDAR & SEMESTERS */}
      {activeTab === 'academic' && (
        <div className="space-y-6">
          {/* Active Academic Term Banner */}
          <div className="bg-gradient-to-l from-emerald-800 via-emerald-700 to-teal-900 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-emerald-200 text-xs font-semibold backdrop-blur-xs mb-2">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-300" />
                  الفصل الدراسي النشط المعتمد حالياً في النظام
                </span>
                <h3 className="text-2xl font-black tracking-tight">
                  {getSemesterDisplayName(currentSettingSemester)} — {currentSettingYear}
                </h3>
                <p className="text-emerald-100 text-xs mt-1">
                  تعتمد جميع الجداول الأسبوعية وحسابات الحضور والغياب على هذا الفصل الدراسي كفصل افتراضي
                </p>
              </div>

              {/* Quick Switch Buttons */}
              <div className="bg-white/10 backdrop-blur-xs rounded-xl p-3 border border-white/20 space-y-2 shrink-0">
                <div className="text-[11px] font-bold text-emerald-200">تبديل الفصل النشط فورياً:</div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleQuickSwitchTerm('FIRST')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      currentSettingSemester === 'FIRST'
                        ? 'bg-white text-emerald-900 shadow-xs'
                        : 'bg-white/20 text-white hover:bg-white/30'
                    }`}
                  >
                    الفصل الأول
                  </button>
                  <button
                    onClick={() => handleQuickSwitchTerm('SECOND')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      currentSettingSemester === 'SECOND'
                        ? 'bg-white text-emerald-900 shadow-xs'
                        : 'bg-white/20 text-white hover:bg-white/30'
                    }`}
                  >
                    الفصل الثاني
                  </button>
                  <button
                    onClick={() => handleQuickSwitchTerm('SUMMER')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      currentSettingSemester === 'SUMMER'
                        ? 'bg-white text-emerald-900 shadow-xs'
                        : 'bg-white/20 text-white hover:bg-white/30'
                    }`}
                  >
                    الفصل الصيفي
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Semesters Table */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">قائمة الفصول الدراسية المسجلة</h3>
                <p className="text-xs text-slate-500">
                  الفصول الدراسية الأكاديمية ومواعيد بدايتها ونهايتها وحالتها في النظام
                </p>
              </div>
              <button
                onClick={() => setIsSemesterModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold text-xs"
              >
                <Plus className="w-4 h-4" />
                إضافة فصل جديد
              </button>
            </div>

            {semesters.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                لا توجد فصول دراسية مضافة حتى الآن. انقر على زر إضافة فصل للبدء.
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">اسم الفصل الدراسي</th>
                      <th className="py-3 px-4">السنة الدراسية</th>
                      <th className="py-3 px-4">رقم الفصل</th>
                      <th className="py-3 px-4">تاريخ البداية والنهاية</th>
                      <th className="py-3 px-4">الحالة</th>
                      <th className="py-3 px-4 text-center">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {semesters.map((sem) => {
                      const yearObj = academicYears.find((y) => y.id === sem.academicYearId);
                      const isCurrent = sem.isCurrent;
                      return (
                        <tr key={sem.id} className="hover:bg-slate-50/70">
                          <td className="py-3 px-4 font-bold text-slate-900">
                            {sem.nameAr}
                            {sem.nameEn && <span className="text-[11px] text-slate-400 block font-normal">{sem.nameEn}</span>}
                          </td>
                          <td className="py-3 px-4 font-medium text-slate-800">
                            {yearObj?.name || '2025-2026'}
                          </td>
                          <td className="py-3 px-4">الفصل {sem.semesterNumber || 1}</td>
                          <td className="py-3 px-4 text-slate-500">
                            {sem.startDate && sem.endDate ? `${sem.startDate} إلى ${sem.endDate}` : 'غير محدد'}
                          </td>
                          <td className="py-3 px-4">
                            {isCurrent ? (
                              <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[11px] inline-flex items-center gap-1">
                                <Check className="w-3 h-3" />
                                الفصل النشط حالياً
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[11px]">
                                غير نشط
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              {!isCurrent && (
                                <button
                                  onClick={() => handleSetActiveSemester(sem)}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold text-[11px]"
                                  title="تعيين كفصل نشط"
                                >
                                  تعيين كنشط
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteSemester(sem.id, sem.nameAr)}
                                className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
                                title="حذف الفصل"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
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

          {/* Academic Years Table */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">السنوات الدراسية الأكاديمية</h3>
                <p className="text-xs text-slate-500">
                  إدارة الأعوام الدراسية (مثل: 2025-2026، 2026-2027)
                </p>
              </div>
              <button
                onClick={() => setIsYearModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-800 hover:bg-slate-200 font-bold text-xs"
              >
                <Plus className="w-4 h-4" />
                إضافة سنة دراسية
              </button>
            </div>

            {academicYears.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">لا توجد سنوات دراسية مسجلة.</div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-4">السنة الدراسية</th>
                      <th className="py-2.5 px-4">بداية العام الدراسي</th>
                      <th className="py-2.5 px-4">نهاية العام الدراسي</th>
                      <th className="py-2.5 px-4">الحالة</th>
                      <th className="py-2.5 px-4 text-center">حذف</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {academicYears.map((yr) => (
                      <tr key={yr.id} className="hover:bg-slate-50/70">
                        <td className="py-2.5 px-4 font-bold text-slate-900">{yr.name}</td>
                        <td className="py-2.5 px-4">{yr.startDate || '—'}</td>
                        <td className="py-2.5 px-4">{yr.endDate || '—'}</td>
                        <td className="py-2.5 px-4">
                          {yr.isCurrent ? (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                              السنة الحالية
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[11px]">سابقة / قادمة</span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          <button
                            onClick={() => handleDeleteYear(yr.id, yr.name)}
                            className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
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
        </div>
      )}

      {/* TAB 2: SYSTEM HEALTH & BACKUP */}
      {activeTab === 'system' && (
        <div className="space-y-6">
          {/* Health Diagnostic */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 mb-1">
                <Activity className="w-4 h-4 text-emerald-600" />
                حالة الخادم
              </div>
              <div className="text-base font-bold text-emerald-800 mt-1">
                {health?.status === 'online' ? 'متصل وجاهز (Online)' : 'جاري الفحص...'}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">المنطقة الزمنية: {health?.timezone || 'Asia/Baghdad'}</div>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 mb-1">
                <HardDrive className="w-4 h-4 text-blue-600" />
                قاعدة البيانات
              </div>
              <div className="text-base font-bold text-slate-900 mt-1">
                SQLite (WAL Mode)
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">مسار التخزين: data/app.db</div>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs">
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
          <div className="p-6 rounded-2xl border border-emerald-200 bg-emerald-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-emerald-950 text-base">النسخ الاحتياطي الشامل للنظام</h3>
              <p className="text-xs text-emerald-800 mt-0.5">
                تصدير كافة الكليات، الأقسام، الكادر، المواد، الجداول، وسجلات الحضور بصيغة ملف Excel (.xlsx) شامل متعدد أوراق العمل
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
            <div className="p-4 rounded-xl bg-emerald-100 text-emerald-800 text-xs font-medium">
              {backupMessage}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: AUDIT LOGS */}
      {activeTab === 'audit' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <h3 className="font-bold text-slate-900 text-base">سجل العمليات والتدقيق (Audit Logs)</h3>
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
                    <th className="py-2.5 px-3">التفاصيل</th>
                    <th className="py-2.5 px-3">الوقت</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {auditLogs.slice(0, 50).map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-semibold text-slate-900">{log.action}</td>
                      <td className="py-2.5 px-3">{log.userId || 'النظام'}</td>
                      <td className="py-2.5 px-3">{log.entityType || '—'}</td>
                      <td className="py-2.5 px-3 text-slate-500 max-w-xs truncate">{log.details || '—'}</td>
                      <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString('ar-IQ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MODAL: ADD SEMESTER */}
      {isSemesterModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">إضافة فصل دراسي جديد</h3>
              <button
                onClick={() => setIsSemesterModalOpen(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSemester} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  اسم الفصل الدراسي بالعربية <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="مثال: الفصل الدراسي الأول، الفصل الثاني، الفصل الصيفي"
                  value={semesterForm.nameAr}
                  onChange={(e) => setSemesterForm({ ...semesterForm, nameAr: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-300"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  اسم الفصل بالإنجليزية (اختياري)
                </label>
                <input
                  type="text"
                  placeholder="مثال: Fall Semester / Spring Semester"
                  value={semesterForm.nameEn}
                  onChange={(e) => setSemesterForm({ ...semesterForm, nameEn: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-300"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">رقم الفصل</label>
                  <select
                    value={semesterForm.semesterNumber}
                    onChange={(e) => setSemesterForm({ ...semesterForm, semesterNumber: Number(e.target.value) })}
                    className="w-full p-2.5 rounded-xl border border-slate-300"
                  >
                    <option value={1}>الفصل 1 (الأول)</option>
                    <option value={2}>الفصل 2 (الثاني)</option>
                    <option value={3}>الفصل 3 (الصيفي)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">السنة الدراسية التابع لها</label>
                  <select
                    value={semesterForm.academicYearId}
                    onChange={(e) => setSemesterForm({ ...semesterForm, academicYearId: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-300"
                  >
                    {academicYears.map((y) => (
                      <option key={y.id} value={y.id}>{y.name}</option>
                    ))}
                    {academicYears.length === 0 && <option value="">2025-2026</option>}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">تاريخ بداية الفصل</label>
                  <input
                    type="date"
                    value={semesterForm.startDate}
                    onChange={(e) => setSemesterForm({ ...semesterForm, startDate: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">تاريخ نهاية الفصل</label>
                  <input
                    type="date"
                    value={semesterForm.endDate}
                    onChange={(e) => setSemesterForm({ ...semesterForm, endDate: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-300"
                  />
                </div>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={semesterForm.isCurrent}
                    onChange={(e) => setSemesterForm({ ...semesterForm, isCurrent: e.target.checked })}
                    className="rounded-md text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                  />
                  <span className="font-bold text-slate-800">
                    تعيين كفصل دراسي حالي نشط في النظام مباشرة
                  </span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsSemesterModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700"
                >
                  حفظ الفصل الدراسي
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD ACADEMIC YEAR */}
      {isYearModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">إضافة سنة دراسية جديدة</h3>
              <button
                onClick={() => setIsYearModalOpen(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateYear} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  اسم السنة الدراسية (بصيغة YYYY-YYYY) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="مثال: 2026-2027"
                  value={yearForm.name}
                  onChange={(e) => setYearForm({ ...yearForm, name: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-300"
                  pattern="\d{4}-\d{4}"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">تاريخ البداية</label>
                  <input
                    type="date"
                    value={yearForm.startDate}
                    onChange={(e) => setYearForm({ ...yearForm, startDate: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-300"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">تاريخ النهاية</label>
                  <input
                    type="date"
                    value={yearForm.endDate}
                    onChange={(e) => setYearForm({ ...yearForm, endDate: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-300"
                    required
                  />
                </div>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={yearForm.isCurrent}
                    onChange={(e) => setYearForm({ ...yearForm, isCurrent: e.target.checked })}
                    className="rounded-md text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                  />
                  <span className="font-bold text-slate-800">
                    تعيين كسنة دراسية نشطة حالياً
                  </span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsYearModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700"
                >
                  حفظ السنة الدراسية
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
