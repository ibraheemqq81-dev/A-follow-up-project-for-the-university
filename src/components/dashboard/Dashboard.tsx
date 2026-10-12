import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { api } from '../../services/api.ts';
import { ActiveTab } from '../layout/Sidebar.tsx';
import {
  GraduationCap,
  Users,
  CalendarCheck,
  Radio,
  DoorOpen,
  Calendar,
  FileText,
  Clock,
  ArrowUpRight,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

interface DashboardProps {
  onNavigate: (tab: ActiveTab) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    colleges: 0,
    departments: 0,
    rooms: 0,
    faculty: 0,
    schedules: 0,
    attendanceToday: 0,
  });
  const [schedules, setSchedules] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const [collegesRes, deptsRes, roomsRes, facultyRes, schedulesRes, attendanceRes] =
          await Promise.allSettled([
            api.getColleges(),
            api.getDepartments(),
            api.getRooms(),
            api.getFaculties(),
            api.getSchedules(),
            api.getAttendance(),
          ]);

        const colleges = collegesRes.status === 'fulfilled' ? collegesRes.value : [];
        const departments = deptsRes.status === 'fulfilled' ? deptsRes.value : [];
        const rooms = roomsRes.status === 'fulfilled' ? roomsRes.value : [];
        const faculty = facultyRes.status === 'fulfilled' ? facultyRes.value : [];
        const scheds = schedulesRes.status === 'fulfilled' ? schedulesRes.value : [];
        const attendance = attendanceRes.status === 'fulfilled' ? attendanceRes.value : [];

        setStats({
          colleges: colleges.length,
          departments: departments.length,
          rooms: rooms.length,
          faculty: faculty.length,
          schedules: scheds.length,
          attendanceToday: attendance.length,
        });

        setSchedules(scheds.slice(0, 5));
      } catch (err) {
        console.error('Error loading dashboard data:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, []);

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-l from-emerald-800 to-emerald-950 rounded-2xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-emerald-200 text-xs font-medium mb-3 backdrop-blur-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            نظام المتابعة الأكاديمي المعتمد — 2025-2026
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
            أهلاً بك، {user?.name || 'مرحباً'}
          </h2>
          <p className="mt-2 text-emerald-100 text-sm sm:text-base leading-relaxed">
            منظومة جامعة المستقبل المركزية لتوثيق حضور التدريسيين، تنظيم القاعات والجداول الدراسية، وإصدار تقارير الموقف اليومي المعتمدة.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              onClick={() => onNavigate('attendance')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-emerald-900 font-semibold text-sm hover:bg-emerald-50 transition-colors shadow-xs"
            >
              <CalendarCheck className="w-4 h-4 text-emerald-700" />
              تسجيل حضور محاضرة الآن
            </button>
            <button
              onClick={() => onNavigate('monitoring')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-700/60 hover:bg-emerald-700 text-white font-medium text-sm transition-colors backdrop-blur-xs"
            >
              <Radio className="w-4 h-4 text-emerald-300" />
              المتابعة الحية للقاعات
            </button>
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">{isLoading ? '...' : stats.colleges}</div>
            <div className="text-xs text-slate-500 font-medium mt-0.5">الكليات المسجلة</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">{isLoading ? '...' : stats.faculty}</div>
            <div className="text-xs text-slate-500 font-medium mt-0.5">أعضاء الهيئة التدريسية</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">{isLoading ? '...' : stats.schedules}</div>
            <div className="text-xs text-slate-500 font-medium mt-0.5">المحاضرات المجدولة</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <CalendarCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">{isLoading ? '...' : stats.attendanceToday}</div>
            <div className="text-xs text-slate-500 font-medium mt-0.5">سجلات الحضور الموثقة</div>
          </div>
        </div>
      </div>

      {/* Main Grid: Schedules Preview & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-base">جدول المحاضرات اليومية</h3>
              <p className="text-xs text-slate-500">المحاضرات المجدولة في الأقسام الأكاديمية</p>
            </div>
            <button
              onClick={() => onNavigate('schedules')}
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
            >
              عرض الجدول الأسبوعي الكامل
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {isLoading ? (
            <div className="py-12 text-center text-sm text-slate-400">جاري تحميل البيانات...</div>
          ) : schedules.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">
              <Calendar className="w-10 h-10 mx-auto text-slate-300 mb-2" />
              لا توجد محاضرات مجدولة حالياً. يمكنك إضافة جداول من شاشة الجداول.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {schedules.map((sch) => (
                <div key={sch.id} className="py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-xs shrink-0">
                      {sch.day?.slice(0, 3)}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-900">
                        محاضرة {sch.lectureType === 'PRACTICAL' ? 'عملية' : 'نظرية'}
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                        <Clock className="w-3 h-3" />
                        <span>{sch.startTime} - {sch.endTime}</span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => onNavigate('attendance')}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
                  >
                    تسجيل الحضور
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Links / Operations Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-base mb-1">الوصول السريع</h3>
            <p className="text-xs text-slate-500 mb-4">العمليات الأكثر استخداماً في المتابعة</p>

            <div className="space-y-2.5">
              <button
                onClick={() => onNavigate('monitoring')}
                className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50 transition-all text-right"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
                    <Radio className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-800">مراقبة القاعات الحية</div>
                    <div className="text-[11px] text-slate-500">حالة القاعات والمحاضرات الآن</div>
                  </div>
                </div>
                <ArrowUpRight className="w-4 h-4 text-slate-400" />
              </button>

              <button
                onClick={() => onNavigate('reports')}
                className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50 transition-all text-right"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-800">الموقف اليومي المعتمد</div>
                    <div className="text-[11px] text-slate-500">تقرير نسب الحضور والغياب</div>
                  </div>
                </div>
                <ArrowUpRight className="w-4 h-4 text-slate-400" />
              </button>

              <button
                onClick={() => onNavigate('faculty')}
                className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50 transition-all text-right"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-800 flex items-center justify-center">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-800">كادر التدريسيين</div>
                    <div className="text-[11px] text-slate-500">إدارة التدريسيين وتوزيع الأنصبة</div>
                  </div>
                </div>
                <ArrowUpRight className="w-4 h-4 text-slate-400" />
              </button>
            </div>
          </div>

          <div className="mt-6 p-3.5 rounded-xl bg-slate-50 border border-slate-100">
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800 mb-1">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              حالة النظام والخادم: متصل وقيد العمل
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              تم تأمين طبقة التحقق برمز الجلسة ومطابقة النطاق الأكاديمي، وقاعدة البيانات SQLite تعمل بنمط WAL الآمن.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
