import React, { useState, useRef, useEffect } from 'react';
import { useNotification } from '../../context/NotificationContext.tsx';
import {
  Bell,
  CheckCircle2,
  Clock,
  DoorOpen,
  Trash2,
  Check,
  AlertCircle,
  ExternalLink,
  ChevronLeft,
} from 'lucide-react';

interface NotificationDropdownProps {
  onNavigateToAttendance: (scheduleId?: string) => void;
}

export const NotificationDropdown: React.FC<NotificationDropdownProps> = ({
  onNavigateToAttendance,
}) => {
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    soundEnabled,
    toggleSound,
    simulateLectureReminder,
  } = useNotification();

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleNotificationClick = (notif: any) => {
    markAsRead(notif.id);
    if (notif.type === 'lecture_reminder' || notif.scheduleId) {
      onNavigateToAttendance(notif.scheduleId);
      setIsOpen(false);
    }
  };

  const handleSimulate = () => {
    simulateLectureReminder();
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label="الإشعارات الأكاديمية"
        className={`relative p-2 rounded-xl transition-all duration-200 cursor-pointer ${
          isOpen
            ? 'bg-amber-100 text-amber-800'
            : unreadCount > 0
            ? 'bg-amber-50 text-amber-700 hover:bg-amber-100 hover:text-amber-800'
            : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
        }`}
        title="التنبيهات وإشعارات المحاضرات"
      >
        <Bell className={`w-5 h-5 ${unreadCount > 0 ? 'animate-wiggle' : ''}`} />

        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex items-center justify-center rounded-full h-5 w-5 bg-red-600 text-[10px] font-bold text-white shadow-xs">
              {unreadCount > 9 ? '+9' : unreadCount}
            </span>
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          dir="rtl"
          className="absolute left-0 sm:left-auto sm:right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150"
        >
          {/* Header */}
          <div className="p-3.5 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-300">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-sm">التنبيهات الأكاديمية</h3>
                <p className="text-[11px] text-slate-300">
                  تذكير بمواعيد وقاعات المحاضرات قبل 15 دقيقة
                </p>
              </div>
            </div>
          </div>

          {/* Quick Actions Bar */}
          <div className="px-3.5 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
            <button
              onClick={handleSimulate}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 font-semibold transition-colors cursor-pointer"
              title="تجربة محاكاة التنبيه قبل 15 دقيقة فوراً"
            >
              <Bell className="w-3.5 h-3.5 text-amber-700" />
              <span>تجربة إشعار 15 دقيقة</span>
            </button>

            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800 font-medium transition-colors cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>تحديد الكل كمقروء</span>
              </button>
            )}
          </div>

          {/* Notifications List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
            {notifications.length === 0 ? (
              <div className="py-10 px-4 text-center">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-2 text-slate-400">
                  <Bell className="w-6 h-6" />
                </div>
                <p className="text-sm font-semibold text-slate-700">لا توجد إشعارات حالياً</p>
                <p className="text-xs text-slate-400 mt-1">
                  سيظهر لك إشعار تلقائي قبل 15 دقيقة من بدء أي محاضرة لتذكيرك بالقاعة
                </p>
                <button
                  onClick={handleSimulate}
                  className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 text-white font-semibold text-xs hover:bg-amber-600 transition-colors shadow-xs cursor-pointer"
                >
                  <Bell className="w-3.5 h-3.5" />
                  <span>بدء التنبيه التجريبي</span>
                </button>
              </div>
            ) : (
              notifications.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleNotificationClick(item)}
                  className={`p-3.5 hover:bg-slate-50 transition-colors cursor-pointer group flex items-start gap-3 ${
                    !item.isRead ? 'bg-amber-50/40' : ''
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                      item.type === 'lecture_reminder'
                        ? 'bg-amber-500/15 text-amber-700 border border-amber-300'
                        : 'bg-emerald-500/15 text-emerald-700 border border-emerald-300'
                    }`}
                  >
                    {item.type === 'lecture_reminder' ? (
                      <Clock className="w-4 h-4" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="font-bold text-xs text-slate-900 truncate">
                        {item.title}
                      </span>
                      {!item.isRead && (
                        <span className="w-2 h-2 rounded-full bg-amber-600 shrink-0" />
                      )}
                    </div>

                    <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                      {item.message}
                    </p>

                    {item.roomName && (
                      <div className="flex items-center gap-2 mt-2">
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-md">
                          <DoorOpen className="w-3 h-3" />
                          {item.roomName}
                        </span>
                        {item.startTime && (
                          <span
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md"
                            dir="ltr"
                          >
                            <Clock className="w-3 h-3 text-slate-400" />
                            {item.startTime}
                          </span>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-between mt-2 pt-1 text-[10px] text-slate-400">
                      <span>
                        {item.createdAt
                          ? new Date(item.createdAt).toLocaleTimeString('ar-IQ', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : 'الآن'}
                      </span>
                      <span className="text-emerald-700 font-semibold group-hover:underline flex items-center gap-0.5">
                        تسجيل الحضور
                        <ChevronLeft className="w-3 h-3" />
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteNotification(item.id);
                    }}
                    title="حذف الإشعار"
                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-600 transition-all cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-2.5 bg-slate-50 border-t border-slate-200 text-center">
            <button
              onClick={() => {
                onNavigateToAttendance();
                setIsOpen(false);
              }}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 transition-colors cursor-pointer"
            >
              عرض جدول محاضرات اليوم الكامل في بوابة التدريسي ←
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
