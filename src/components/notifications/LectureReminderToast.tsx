import React, { useEffect, useState } from 'react';
import { useNotification } from '../../context/NotificationContext.tsx';
import {
  Bell,
  Clock,
  DoorOpen,
  BookOpen,
  X,
  ChevronLeft,
  Volume2,
  VolumeX,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';

interface LectureReminderToastProps {
  onNavigateToAttendance: (scheduleId?: string) => void;
}

export const LectureReminderToast: React.FC<LectureReminderToastProps> = ({
  onNavigateToAttendance,
}) => {
  const {
    activeReminder,
    dismissActiveReminder,
    soundEnabled,
    toggleSound,
  } = useNotification();

  const [isClosing, setIsClosing] = useState(false);

  // Auto-dismiss after 60 seconds if not interacted with, but allow manual close
  useEffect(() => {
    if (!activeReminder) return;
    const timer = setTimeout(() => {
      dismissActiveReminder();
    }, 60000);
    return () => clearTimeout(timer);
  }, [activeReminder, dismissActiveReminder]);

  if (!activeReminder) return null;

  const handleActionClick = () => {
    onNavigateToAttendance(activeReminder.scheduleId);
    dismissActiveReminder();
  };

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      dismissActiveReminder();
      setIsClosing(false);
    }, 200);
  };

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`fixed top-20 left-4 sm:left-6 z-50 max-w-md w-full transition-all duration-300 transform ${
        isClosing ? 'opacity-0 -translate-y-4' : 'opacity-100 translate-y-0'
      }`}
    >
      <div className="bg-gradient-to-br from-amber-900/95 via-slate-900/95 to-slate-950/95 backdrop-blur-md text-white rounded-2xl shadow-2xl border-2 border-amber-400/50 p-5 overflow-hidden relative">
        {/* Animated glowing accent line */}
        <div className="absolute top-0 right-0 left-0 h-1.5 bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-500 animate-pulse" />

        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400 shadow-inner animate-bounce">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-400/30">
                  تذكير بموعد المحاضرة
                </span>
                <span className="text-[11px] font-medium text-amber-200/90 flex items-center gap-1 bg-black/40 px-2 py-0.5 rounded-full">
                  <Clock className="w-3 h-3 text-amber-300" />
                  قبل {activeReminder.minutesRemaining > 0 ? activeReminder.minutesRemaining : 15} دقيقة
                </span>
              </div>
              <h4 className="font-bold text-white text-base mt-1 leading-tight flex items-center gap-1.5">
                {activeReminder.subjectName}
              </h4>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={toggleSound}
              title={soundEnabled ? 'كتم الصوت' : 'تفعيل صوت التنبيه'}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              {soundEnabled ? <Volume2 className="w-4 h-4 text-amber-300" /> : <VolumeX className="w-4 h-4" />}
            </button>
            <button
              onClick={handleClose}
              title="إغلاق التنبيه"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Details Card */}
        <div className="bg-white/10 rounded-xl p-3 border border-white/10 space-y-2 mb-4 text-xs">
          <div className="flex items-center justify-between text-slate-200">
            <div className="flex items-center gap-2">
              <DoorOpen className="w-4 h-4 text-amber-300 shrink-0" />
              <span className="text-slate-300">القاعة الدراسية:</span>
            </div>
            <span className="font-bold text-amber-300 bg-amber-950/60 px-2.5 py-1 rounded-lg border border-amber-400/30">
              {activeReminder.roomName}
            </span>
          </div>

          <div className="flex items-center justify-between text-slate-200">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="text-slate-300">موعد المحاضرة:</span>
            </div>
            <span className="font-semibold text-emerald-300" dir="ltr">
              {activeReminder.startTime} - {activeReminder.endTime}
            </span>
          </div>

          {activeReminder.facultyName && (
            <div className="flex items-center justify-between text-slate-300 text-[11px] pt-1 border-t border-white/10">
              <span>الأستاذ المكلّف:</span>
              <span className="font-medium text-white">{activeReminder.facultyName}</span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleActionClick}
            className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold py-2.5 px-3.5 rounded-xl shadow-lg hover:shadow-emerald-500/25 transition-all text-xs flex items-center justify-center gap-2 group cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-100 group-hover:scale-110 transition-transform" />
            <span>الانتقال وتوثيق الحضور</span>
            <ChevronLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" />
          </button>
          <button
            onClick={handleClose}
            className="bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
