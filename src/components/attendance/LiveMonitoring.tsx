import React, { useEffect, useState } from 'react';
import { api } from '../../services/api.ts';
import { Radio, DoorOpen, Users, Clock, CheckCircle2, AlertTriangle, XCircle, Search } from 'lucide-react';

export const LiveMonitoring: React.FC = () => {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [faculty, setFaculty] = useState<any[]>([]);
  const [filterQuery, setFilterQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const [scheds, rms, atts, facs] = await Promise.all([
          api.getSchedules(),
          api.getRooms(),
          api.getAttendance(),
          api.getFaculties(),
        ]);
        setSchedules(scheds || []);
        setRooms(rms || []);
        setAttendance(atts || []);
        setFaculty(facs || []);
      } catch (err) {
        console.error('Error loading monitoring data:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, []);

  const getFacultyName = (facultyId: string) => {
    const f = faculty.find((item) => item.id === facultyId);
    return f ? f.nameAr : 'غير محدد';
  };

  const getRoomName = (roomId: string) => {
    const r = rooms.find((item) => item.id === roomId);
    return r ? `${r.nameAr} (${r.code || ''})` : 'قاعة غير محددة';
  };

  const getAttendanceStatus = (scheduleId: string) => {
    const record = attendance.find((a) => a.scheduleId === scheduleId);
    if (!record) return { label: 'بانتظار التسجيل', color: 'bg-amber-100 text-amber-800 border-amber-200', icon: Clock };
    if (record.status === 'PRESENT') return { label: 'حاضر — تم التوثيق', color: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: CheckCircle2 };
    if (record.status === 'DELAYED') return { label: 'متأخر بعذر', color: 'bg-blue-100 text-blue-800 border-blue-200', icon: AlertTriangle };
    return { label: 'غائب', color: 'bg-red-100 text-red-800 border-red-200', icon: XCircle };
  };

  const filteredSchedules = schedules.filter((s) => {
    const facultyName = getFacultyName(s.facultyId);
    const roomName = getRoomName(s.roomId);
    const query = filterQuery.toLowerCase();
    return (
      facultyName.toLowerCase().includes(query) ||
      roomName.toLowerCase().includes(query) ||
      (s.day && s.day.toLowerCase().includes(query))
    );
  });

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">المتابعة الحية المباشرة للقاعات</h2>
              <p className="text-xs text-slate-500">
                مراقبة الجلسات الجارية ونسب الحضور لحظياً في كافة كليات جامعة المستقبل
              </p>
            </div>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
            <input
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="بحث بالتدريسي أو القاعة..."
              className="w-full pr-9 pl-4 py-2 rounded-xl border border-slate-300 text-xs focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="py-16 text-center text-slate-400 text-sm">جاري تحديث الرصد المباشر...</div>
        ) : filteredSchedules.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">
            لا توجد جلسات مطابقة لمعايير البحث حالياً.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
            {filteredSchedules.map((sch) => {
              const statusInfo = getAttendanceStatus(sch.id);
              const StatusIcon = statusInfo.icon;
              return (
                <div
                  key={sch.id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 hover:border-emerald-300 transition-all shadow-xs flex flex-col justify-between"
                >
                  <div>
                    <div className="flex justify-between items-start mb-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${statusInfo.color}`}>
                        <StatusIcon className="w-3.5 h-3.5" />
                        {statusInfo.label}
                      </span>
                      <span className="text-xs font-medium text-slate-400">
                        {sch.day}
                      </span>
                    </div>

                    <div className="text-sm font-bold text-slate-900 mb-1">
                      {getFacultyName(sch.facultyId)}
                    </div>

                    <div className="space-y-1.5 text-xs text-slate-600 mt-3">
                      <div className="flex items-center gap-2">
                        <DoorOpen className="w-3.5 h-3.5 text-slate-400" />
                        <span>{getRoomName(sch.roomId)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>{sch.startTime} - {sch.endTime}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        <span>نوع المحاضرة: {sch.lectureType === 'PRACTICAL' ? 'عملي' : 'نظري'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                    <span>جامعة المستقبل</span>
                    <span className="font-mono">ID: {sch.id.slice(0, 8)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
