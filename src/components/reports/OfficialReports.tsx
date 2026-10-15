import React, { useState, useEffect } from 'react';
import { api } from '../../services/api.ts';
import {
  FileText,
  Printer,
  Calendar,
  Building2,
  CheckCircle2,
  XCircle,
  Clock,
  GitPullRequest,
  UserCog,
  AlertTriangle,
  BarChart3,
  Users,
} from 'lucide-react';

type ReportTab = 'daily' | 'summary' | 'changeRequests' | 'proxy' | 'missing';

export const OfficialReports: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ReportTab>('daily');
  const [reportDate, setReportDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [dateFrom, setDateFrom] = useState<string>(
    new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]
  );
  const [dateTo, setDateTo] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [isLoading, setIsLoading] = useState(true);

  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [faculty, setFaculty] = useState<any[]>([]);
  const [colleges, setColleges] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [changeRequests, setChangeRequests] = useState<any[]>([]);

  const [filterCollegeId, setFilterCollegeId] = useState<string>('');
  const [filterDeptId, setFilterDeptId] = useState<string>('');
  const [filterFacultyId, setFilterFacultyId] = useState<string>('');

  const loadAllData = async () => {
    setIsLoading(true);
    try {
      const [attRes, schedRes, facRes, colRes, depRes, subRes, crRes] =
        await Promise.allSettled([
          api.getAttendance(),
          api.getSchedules(),
          api.getFaculties(),
          api.getColleges(),
          api.getDepartments(),
          api.getSubjects(),
          api.getChangeRequests(),
        ]);

      if (attRes.status === 'fulfilled') setAttendanceRecords(Array.isArray(attRes.value) ? attRes.value : []);
      if (schedRes.status === 'fulfilled') setSchedules(Array.isArray(schedRes.value) ? schedRes.value : []);
      if (facRes.status === 'fulfilled') setFaculty(Array.isArray(facRes.value) ? facRes.value : []);
      if (colRes.status === 'fulfilled') setColleges(Array.isArray(colRes.value) ? colRes.value : []);
      if (depRes.status === 'fulfilled') setDepartments(Array.isArray(depRes.value) ? depRes.value : []);
      if (subRes.status === 'fulfilled') setSubjects(Array.isArray(subRes.value) ? subRes.value : []);
      if (crRes.status === 'fulfilled') setChangeRequests(Array.isArray(crRes.value) ? crRes.value : []);
    } catch {
      // safe fallback
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  const handlePrint = () => window.print();

  const getFacultyName = (id: string) =>
    faculty.find((f) => f?.id === id)?.nameAr || 'تدريسي';

  const getCollegeName = (id: string) =>
    colleges.find((c) => c?.id === id)?.nameAr || '—';

  const getDeptName = (id: string) =>
    departments.find((d) => d?.id === id)?.nameAr || '—';

  const getSubjectName = (id: string) =>
    subjects.find((s) => s?.id === id)?.nameAr || 'المادة';

  // Filter helpers
  const filterByScope = <T extends Record<string, any>>(rows: T[]): T[] => {
    return rows.filter((r) => {
      if (filterCollegeId && r.collegeId && r.collegeId !== filterCollegeId) return false;
      if (filterDeptId && r.departmentId && r.departmentId !== filterDeptId) return false;
      if (filterFacultyId && r.facultyId && r.facultyId !== filterFacultyId) return false;
      return true;
    });
  };

  // Daily report records filtered by date
  const dailyRecords = attendanceRecords.filter(
    (r) => r.lectureDate === reportDate
  );

  // Summary stats
  const summaryRecords = filterByScope(
    attendanceRecords.filter((r) => {
      const d = r.lectureDate || '';
      return d >= dateFrom && d <= dateTo;
    })
  );
  const totalLectures = summaryRecords.length;
  const proxyCount = summaryRecords.filter((r) => r.proxyRecorded).length;
  const totalPresent = summaryRecords.reduce((sum, r) => sum + (r.presentCount || 0), 0);
  const avgPresent = totalLectures > 0 ? Math.round(totalPresent / totalLectures) : 0;

  // Change requests in date range
  const filteredChangeRequests = changeRequests.filter((cr) => {
    const d = cr.createdAt || '';
    if (d < dateFrom || d > dateTo + 'T23:59:59') return false;
    return true;
  });

  // Missing attendance: schedules for reportDate that have no attendance record
  const dayName = new Date(reportDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
  const dayMap: Record<string, string> = {
    SUNDAY: 'الأحد', MONDAY: 'الاثنين', TUESDAY: 'الثلاثاء',
    WEDNESDAY: 'الأربعاء', THURSDAY: 'الخميس', FRIDAY: 'الجمعة', SATURDAY: 'السبت',
  };
  const arabicDay = dayMap[dayName] || dayName;
  const todaysSchedules = schedules.filter(
    (s) => s.dayOfWeek === arabicDay || s.day === arabicDay || s.dayOfWeek === dayName
  );
  const recordedScheduleIds = new Set(
    attendanceRecords.filter((r) => r.lectureDate === reportDate).map((r) => r.scheduleId)
  );
  const missingSchedules = todaysSchedules.filter((s) => !recordedScheduleIds.has(s.id));

  // Proxy records in date range
  const proxyRecords = summaryRecords.filter((r) => r.proxyRecorded);

  const TABS: { key: ReportTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { key: 'daily', label: 'الموقف اليومي', icon: Calendar },
    { key: 'summary', label: 'ملخص تنفيذي', icon: BarChart3 },
    { key: 'changeRequests', label: 'طلبات التغيير', icon: GitPullRequest },
    { key: 'proxy', label: 'التسجيل بالنيابة', icon: UserCog },
    { key: 'missing', label: 'محاضرات بلا حضور', icon: AlertTriangle },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">التقارير الرسمية الموسعة</h2>
              <p className="text-xs text-slate-500">
                تقارير الموقف اليومي والملخصات التنفيذية وطلبات التغيير والمتابعة — جامعة المستقبل
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 text-white font-medium text-xs hover:bg-slate-800 shadow-xs"
            >
              <Printer className="w-4 h-4" />
              طباعة التقرير
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-6 flex flex-wrap gap-2 border-b border-slate-200 pb-3">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === tab.key
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Date & Scope Filters */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {activeTab === 'daily' || activeTab === 'missing' ? (
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">التاريخ</label>
              <input
                type="date"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
              />
            </div>
          ) : (
            <>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">من تاريخ</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">إلى تاريخ</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                />
              </div>
            </>
          )}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">الكلية</label>
            <select
              value={filterCollegeId}
              onChange={(e) => setFilterCollegeId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
            >
              <option value="">الكل</option>
              {colleges.map((c) => (
                <option key={c.id} value={c.id}>{c.nameAr}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">القسم</label>
            <select
              value={filterDeptId}
              onChange={(e) => setFilterDeptId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
            >
              <option value="">الكل</option>
              {departments
                .filter((d) => !filterCollegeId || d.collegeId === filterCollegeId)
                .map((d) => (
                  <option key={d.id} value={d.id}>{d.nameAr}</option>
                ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">التدريسي</label>
            <select
              value={filterFacultyId}
              onChange={(e) => setFilterFacultyId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
            >
              <option value="">الكل</option>
              {faculty.map((f) => (
                <option key={f.id} value={f.id}>{f.nameAr}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Printable Document */}
      <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-xs print:border-none print:p-0">
        <div className="text-center pb-6 border-b border-slate-200">
          <div className="flex justify-between items-center mb-4">
            <div className="text-right text-xs text-slate-600">
              <div>جمهورية العراق</div>
              <div>وزارة التعليم العالي والبحث العلمي</div>
              <div className="font-bold text-slate-900 text-sm mt-0.5">جامعة المستقبل</div>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-emerald-700 flex items-center justify-center text-white">
              <Building2 className="w-8 h-8" />
            </div>
            <div className="text-left text-xs text-slate-600 font-mono">
              <div>التاريخ: {activeTab === 'daily' || activeTab === 'missing' ? reportDate : `${dateFrom} — ${dateTo}`}</div>
              <div>الرقم: AU/ATT/{(activeTab === 'daily' ? reportDate : dateTo).replace(/-/g, '')}</div>
            </div>
          </div>
          <h3 className="text-lg font-bold text-slate-900 mt-2">
            {TABS.find((t) => t.key === activeTab)?.label}
          </h3>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-slate-400 text-sm">جاري إنشاء التقرير...</div>
        ) : activeTab === 'daily' ? (
          /* ===== DAILY REPORT ===== */
          dailyRecords.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">
              لا توجد سجلات حضور موثقة لتاريخ اليوم المحدد.
            </div>
          ) : (
            <ReportTable
              headers={['#', 'اسم التدريسي', 'حالة الحضور', 'عدد الطلبة', 'الموضوع المشروح', 'طريقة التوثيق', 'وقت التثبيت']}
              rows={dailyRecords.map((rec, i) => [
                String(i + 1),
                getFacultyName(rec.facultyId),
                rec.status === 'PRESENT' ? 'حاضر' : rec.status,
                `${rec.presentCount || 0} طالب`,
                rec.topicsCovered || 'تم الشرح',
                rec.verificationMethod === 'CAMERA_EVIDENCE' ? 'كاميرا القاعة' : 'تدقيق مباشر',
                rec.recordedAt ? new Date(rec.recordedAt).toLocaleTimeString('ar-IQ') : '--',
              ])}
            />
          )
        ) : activeTab === 'summary' ? (
          /* ===== EXECUTIVE SUMMARY ===== */
          <div className="mt-6 space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatCard label="إجمالي المحاضرات المنفذة" value={totalLectures} color="emerald" />
              <StatCard label="إجمالي الطلبة الحاضرين" value={totalPresent} color="blue" />
              <StatCard label="متوسط الحضور لكل محاضرة" value={avgPresent} color="indigo" />
              <StatCard label="تسجيلات بالنيابة" value={proxyCount} color="amber" />
            </div>

            <div>
              <h4 className="text-sm font-bold text-slate-700 mb-3">تفصيل المحاضرات المنفذة</h4>
              {summaryRecords.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-sm">لا توجد بيانات في النطاق المحدد.</div>
              ) : (
                <ReportTable
                  headers={['#', 'التاريخ', 'التدريسي', 'المادة', 'الطلبة الحاضرون', 'النيابة', 'التوثيق']}
                  rows={summaryRecords.map((rec, i) => [
                    String(i + 1),
                    rec.lectureDate || '—',
                    getFacultyName(rec.facultyId),
                    getSubjectName(rec.subjectId),
                    `${rec.presentCount || 0}`,
                    rec.proxyRecorded ? 'نعم' : 'لا',
                    rec.verificationMethod === 'CAMERA_EVIDENCE' ? 'كاميرا' : 'مباشر',
                  ])}
                />
              )}
            </div>
          </div>
        ) : activeTab === 'changeRequests' ? (
          /* ===== CHANGE REQUESTS REPORT ===== */
          filteredChangeRequests.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">
              لا توجد طلبات تغيير في النطاق المحدد.
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <StatCard label="إجمالي الطلبات" value={filteredChangeRequests.length} color="blue" />
                <StatCard
                  label="مقبولة"
                  value={filteredChangeRequests.filter((cr) => cr.status === 'APPROVED' || cr.status === 'APPLIED').length}
                  color="emerald"
                />
                <StatCard
                  label="مرفوضة"
                  value={filteredChangeRequests.filter((cr) => cr.status === 'REJECTED').length}
                  color="rose"
                />
                <StatCard
                  label="قيد الانتظار"
                  value={filteredChangeRequests.filter((cr) => cr.status === 'PENDING').length}
                  color="amber"
                />
              </div>
              <ReportTable
                headers={['#', 'التاريخ', 'النوع', 'الحالة', 'السبب', 'القسم']}
                rows={filteredChangeRequests.map((cr, i) => {
                  const typeMap: Record<string, string> = {
                    room_change: 'تغيير قاعة', postpone: 'تأجيل محاضرة', exam_conflict: 'تعارض امتحان',
                    meeting: 'اجتماع', admin_assignment: 'تكليف إداري', mission: 'مأمورية',
                    to_online: 'تحويل لإلكتروني', time_change: 'تغيير وقت', faculty_change: 'تغيير تدريسي', other: 'أخرى',
                  };
                  const statusMap: Record<string, string> = {
                    PENDING: 'قيد الانتظار', APPROVED: 'مقبول', REJECTED: 'مرفوض', RETURNED: 'مرتجع', APPLIED: 'منفذ',
                  };
                  return [
                    String(i + 1),
                    (cr.createdAt || '').split('T')[0],
                    typeMap[cr.changeType] || cr.changeType || '—',
                    statusMap[cr.status] || cr.status,
                    cr.reason || '—',
                    getDeptName(cr.departmentId),
                  ];
                })}
              />
            </div>
          )
        ) : activeTab === 'proxy' ? (
          /* ===== PROXY ATTENDANCE REPORT ===== */
          proxyRecords.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">
              لا توجد تسجيلات بالنيابة في النطاق المحدد.
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <StatCard label="إجمالي التسجيلات بالنيابة" value={proxyRecords.length} color="amber" />
                <StatCard
                  label="نسبة من الإجمالي"
                  value={`${totalLectures > 0 ? Math.round((proxyRecords.length / totalLectures) * 100) : 0}%`}
                  color="blue"
                />
                <StatCard
                  label="أسباب مختلفة"
                  value={new Set(proxyRecords.map((r) => r.proxyReason).filter(Boolean)).size}
                  color="indigo"
                />
              </div>
              <ReportTable
                headers={['#', 'التاريخ', 'التدريسي', 'المادة', 'الطلبة', 'سبب النيابة']}
                rows={proxyRecords.map((rec, i) => [
                  String(i + 1),
                  rec.lectureDate || '—',
                  getFacultyName(rec.facultyId),
                  getSubjectName(rec.subjectId),
                  `${rec.presentCount || 0}`,
                  rec.proxyReason || '—',
                ])}
              />
            </div>
          )
        ) : activeTab === 'missing' ? (
          /* ===== MISSING ATTENDANCE REPORT ===== */
          missingSchedules.length === 0 ? (
            <div className="py-12 text-center text-emerald-600 text-sm font-bold">
              جميع محاضرات اليوم موثقة — لا توجد محاضرات بلا تسجيل حضور.
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-900 text-xs font-bold flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <span>
                  يوجد {missingSchedules.length} محاضرة مجدولة ليوم {arabicDay} ({reportDate}) بدون تسجيل حضور موثق.
                </span>
              </div>
              <ReportTable
                headers={['#', 'المادة', 'التدريسي', 'الوقت', 'القاعة', 'المرحلة']}
                rows={missingSchedules.map((s, i) => [
                  String(i + 1),
                  getSubjectName(s.subjectId),
                  getFacultyName(s.facultyId),
                  `${s.startTime || '—'} - ${s.endTime || '—'}`,
                  s.roomId || '—',
                  s.stageId || '—',
                ])}
              />
            </div>
          )
        ) : null}

        {/* Signature Footer */}
        <div className="mt-8 pt-6 flex justify-between items-end text-xs text-slate-700 border-t border-slate-200">
          <div className="text-center">
            <div className="font-semibold">مسؤول شعبة المتابعة والتدقيق</div>
            <div className="mt-8 text-slate-400">التوقيع والختم</div>
          </div>
          <div className="text-center">
            <div className="font-semibold">عميد الكلية</div>
            <div className="mt-8 text-slate-400">التوقيع والختم</div>
          </div>
          <div className="text-center">
            <div className="font-semibold">مساعد رئيس الجامعة للشؤون العلمية</div>
            <div className="mt-8 text-slate-400">الاعتماد الرسمي</div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Reusable table component for reports
const ReportTable: React.FC<{ headers: string[]; rows: string[][] }> = ({ headers, rows }) => (
  <div className="mt-6 overflow-x-auto">
    <table className="w-full text-right text-xs border border-slate-200">
      <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
        <tr>
          {headers.map((h, i) => (
            <th key={i} className={`py-2.5 px-3 ${i < headers.length - 1 ? 'border-l border-slate-200' : ''}`}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-200 text-slate-800">
        {rows.map((row, ri) => (
          <tr key={ri} className="hover:bg-slate-50">
            {row.map((cell, ci) => (
              <td key={ci} className={`py-2 px-3 ${ci < row.length - 1 ? 'border-l border-slate-200' : ''} ${ci === 0 ? 'font-mono' : ''}`}>
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const StatCard: React.FC<{ label: string; value: React.ReactNode; color: string }> = ({ label, value, color }) => {
  const colorMap: Record<string, string> = {
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-950',
    blue: 'bg-blue-50 border-blue-200 text-blue-950',
    indigo: 'bg-indigo-50 border-indigo-200 text-indigo-950',
    amber: 'bg-amber-50 border-amber-200 text-amber-950',
    rose: 'bg-rose-50 border-rose-200 text-rose-950',
  };
  return (
    <div className={`rounded-xl border p-4 ${colorMap[color] || colorMap.blue}`}>
      <div className="text-[11px] font-bold opacity-80">{label}</div>
      <div className="text-2xl font-black mt-1">{value}</div>
    </div>
  );
};
