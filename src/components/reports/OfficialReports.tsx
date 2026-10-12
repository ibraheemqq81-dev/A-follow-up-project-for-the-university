import React, { useState, useEffect } from 'react';
import { api } from '../../services/api.ts';
import { FileText, Printer, Download, Calendar, CheckCircle2, Building2 } from 'lucide-react';

export const OfficialReports: React.FC = () => {
  const [reportDate, setReportDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [reportData, setReportData] = useState<any>(null);
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [faculty, setFaculty] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadReport = async () => {
    setIsLoading(true);
    try {
      const [daily, att, fac] = await Promise.all([
        api.getDailyAttendanceReport(reportDate).catch(() => null),
        api.getAttendance(),
        api.getFaculties(),
      ]);
      setReportData(daily);
      setAttendanceRecords(att || []);
      setFaculty(fac || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [reportDate]);

  const handlePrint = () => {
    window.print();
  };

  const getFacultyName = (id: string) => faculty.find((f) => f.id === id)?.nameAr || 'تدريسي';

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">الموقف اليومي والتقارير الرسمية</h2>
              <p className="text-xs text-slate-500">
                تقارير الموقف اليومي المعتمدة لجامعة المستقبل وفق متطلبات وزارة التعليم العالي
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="date"
              value={reportDate}
              onChange={(e) => setReportDate(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-300 text-xs"
            />
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 text-white font-medium text-xs hover:bg-slate-800 shadow-xs"
            >
              <Printer className="w-4 h-4" />
              طباعة الموقف
            </button>
          </div>
        </div>

        {/* Printable Official Document */}
        <div className="mt-8 border border-slate-200 rounded-2xl p-8 bg-white print:border-none print:p-0">
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
                <div>التاريخ: {reportDate}</div>
                <div>الرقم: AU/ATT/{reportDate.replace(/-/g, '')}</div>
                <div>المرفقات: سجلات القاعات</div>
              </div>
            </div>

            <h3 className="text-lg font-bold text-slate-900 mt-2">
              تقرير الموقف اليومي لحضور التدريسيين وتغطية المحاضرات
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              ليوم {new Date(reportDate).toLocaleDateString('ar-IQ', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>

          {isLoading ? (
            <div className="py-12 text-center text-slate-400 text-sm">جاري إنشاء التقرير...</div>
          ) : attendanceRecords.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">
              لا توجد سجلات حضور موثقة لتاريخ اليوم المحدد.
            </div>
          ) : (
            <div className="mt-6 overflow-x-auto">
              <table className="w-full text-right text-xs border border-slate-200">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3 border-l border-slate-200">#</th>
                    <th className="py-2.5 px-3 border-l border-slate-200">اسم التدريسي</th>
                    <th className="py-2.5 px-3 border-l border-slate-200">حالة الحضور</th>
                    <th className="py-2.5 px-3 border-l border-slate-200">عدد الطلبة الحاضرين</th>
                    <th className="py-2.5 px-3 border-l border-slate-200">الموضوع المشروح</th>
                    <th className="py-2.5 px-3 border-l border-slate-200">طريقة التوثيق</th>
                    <th className="py-2.5 px-3">وقت التثبيت</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-800">
                  {attendanceRecords.map((rec, index) => (
                    <tr key={rec.id} className="hover:bg-slate-50">
                      <td className="py-2 px-3 border-l border-slate-200 font-mono">{index + 1}</td>
                      <td className="py-2 px-3 border-l border-slate-200 font-semibold">{getFacultyName(rec.facultyId)}</td>
                      <td className="py-2 px-3 border-l border-slate-200">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          rec.status === 'PRESENT' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {rec.status === 'PRESENT' ? 'حاضر' : rec.status}
                        </span>
                      </td>
                      <td className="py-2 px-3 border-l border-slate-200">{rec.presentCount || 0} طالب</td>
                      <td className="py-2 px-3 border-l border-slate-200">{rec.topicsCovered || 'تم الشرح'}</td>
                      <td className="py-2 px-3 border-l border-slate-200 text-slate-500">
                        {rec.verificationMethod === 'CAMERA_EVIDENCE' ? 'كاميرا القاعة' : 'تدقيق مباشر'}
                      </td>
                      <td className="py-2 px-3 text-slate-500 font-mono text-[11px]">
                        {rec.recordedAt ? new Date(rec.recordedAt).toLocaleTimeString('ar-IQ') : '--'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="mt-8 pt-6 flex justify-between items-end text-xs text-slate-700 border-t border-slate-200">
                <div className="text-center">
                  <div className="font-semibold">مسؤول شعبة المتابعة والتدقيق</div>
                  <div className="mt-8 text-slate-400">التوقيع والختم</div>
                </div>
                <div className="text-center">
                  <div className="font-semibold">عميد الكلية / مدير التسجيل</div>
                  <div className="mt-8 text-slate-400">التوقيع والختم</div>
                </div>
                <div className="text-center">
                  <div className="font-semibold">مساعد رئيس الجامعة للشؤون العلمية</div>
                  <div className="mt-8 text-slate-400">الاعتماد الرسمي</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
