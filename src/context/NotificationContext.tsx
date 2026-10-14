import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext.tsx';
import { api } from '../services/api.ts';
import { AppNotification, Schedule, Room, Subject, Faculty } from '../types/index.ts';

export interface LectureReminder {
  id: string;
  scheduleId: string;
  subjectName: string;
  roomName: string;
  buildingName?: string;
  startTime: string;
  endTime: string;
  minutesRemaining: number;
  stageName?: string;
  sectionName?: string;
  facultyName?: string;
  facultyId?: string;
  lectureDate: string;
}

interface NotificationContextType {
  notifications: AppNotification[];
  unreadCount: number;
  activeReminder: LectureReminder | null;
  soundEnabled: boolean;
  toggleSound: () => void;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  dismissActiveReminder: () => void;
  simulateLectureReminder: () => void;
  navigateToAttendanceLecture: ((scheduleId?: string) => void) | null;
  setNavigateToAttendanceLecture: (fn: (scheduleId?: string) => void) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

// Web Audio API chime generator (soft, elegant two-tone chime)
function playGentleChime() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    const now = ctx.currentTime;
    
    // First tone (523.25 Hz - C5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now); // D5
    gain1.gain.setValueAtTime(0.15, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.5);

    // Second tone (880 Hz - A5)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, now + 0.15);
    gain2.gain.setValueAtTime(0.18, now + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.15);
    osc2.stop(now + 0.8);
  } catch (e) {
    // Ignore audio permission or context restrictions
  }
}

const DAYS_MAP: Record<number, string> = {
  0: 'Sunday',
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
};

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [activeReminder, setActiveReminder] = useState<LectureReminder | null>(null);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    return localStorage.getItem('uomus_notif_sound') !== 'false';
  });
  const navigateToAttendanceRef = useRef<((scheduleId?: string) => void) | null>(null);

  // Keep track of lectures already notified in this session to prevent repeated spam
  const notifiedKeysRef = useRef<Set<string>>(new Set());

  // Cached academic resources for quick resolution
  const schedulesRef = useRef<Schedule[]>([]);
  const roomsRef = useRef<Room[]>([]);
  const subjectsRef = useRef<Subject[]>([]);
  const facultiesRef = useRef<Faculty[]>([]);

  const toggleSound = () => {
    setSoundEnabled((prev) => {
      const next = !prev;
      localStorage.setItem('uomus_notif_sound', String(next));
      return next;
    });
  };

  const setNavigateToAttendanceLecture = useCallback((fn: (scheduleId?: string) => void) => {
    navigateToAttendanceRef.current = fn;
  }, []);

  // Fetch persisted notifications
  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const list = await api.getNotifications();
      if (Array.isArray(list)) {
        setNotifications(list);
      }
    } catch {
      // Backend error fallback
    }
  }, [user]);

  // Load auxiliary data for schedule calculation
  const loadScheduleData = useCallback(async () => {
    if (!user) return;
    try {
      const [sch, rm, sub, fac] = await Promise.allSettled([
        api.getSchedules(),
        api.getRooms(),
        api.getSubjects(),
        api.getFaculties(),
      ]);
      if (sch.status === 'fulfilled' && Array.isArray(sch.value)) schedulesRef.current = sch.value;
      if (rm.status === 'fulfilled' && Array.isArray(rm.value)) roomsRef.current = rm.value;
      if (sub.status === 'fulfilled' && Array.isArray(sub.value)) subjectsRef.current = sub.value;
      if (fac.status === 'fulfilled' && Array.isArray(fac.value)) facultiesRef.current = fac.value;
    } catch {
      // ignore
    }
  }, [user]);

  // Lecture check logic: inspect today's lectures and identify any starting within <= 15 minutes
  const checkUpcomingLectures = useCallback(async () => {
    if (!user) return;
    const now = new Date();
    const currentDay = DAYS_MAP[now.getDay()];
    const todayDateStr = now.toISOString().split('T')[0];

    const currentMinutesOfDay = now.getHours() * 60 + now.getMinutes();

    // Determine target faculty id
    let targetFacultyId = user.assignedFacultyId;
    if (!targetFacultyId && user.role === 'FACULTY' && facultiesRef.current.length > 0) {
      const matched = facultiesRef.current.find(
        (f) => f.email?.toLowerCase() === user.email?.toLowerCase()
      );
      if (matched) targetFacultyId = matched.id;
    }

    // If user is owner or monitor, we can also check their assigned or all faculties for testing
    const todaySchedules = schedulesRef.current.filter((s) => {
      if (s.day !== currentDay) return false;
      if (targetFacultyId) return s.facultyId === targetFacultyId;
      return true; // For testing in OWNER role
    });

    for (const schedule of todaySchedules) {
      if (!schedule.startTime) continue;

      const [startH, startM] = schedule.startTime.split(':').map(Number);
      if (isNaN(startH) || isNaN(startM)) continue;

      const lectureStartMinutes = startH * 60 + startM;
      const diffMinutes = lectureStartMinutes - currentMinutesOfDay;

      // Condition: Lecture starts in 15 minutes or less (0 <= diffMinutes <= 15)
      // Or has just started in the last 5 minutes without attendance: (-5 <= diffMinutes <= 15)
      if (diffMinutes >= -5 && diffMinutes <= 15) {
        const uniqueKey = `${schedule.id}_${todayDateStr}_${schedule.startTime}`;
        if (notifiedKeysRef.current.has(uniqueKey)) {
          continue; // Already notified in this session
        }

        notifiedKeysRef.current.add(uniqueKey);

        const sub = subjectsRef.current.find((s) => s.id === schedule.subjectId);
        const rm = roomsRef.current.find((r) => r.id === schedule.roomId);
        const fac = facultiesRef.current.find((f) => f.id === schedule.facultyId);

        const subjectName = sub?.nameAr || 'المحاضرة الأكاديمية';
        const roomName = rm?.nameAr || (schedule.roomId ? `قاعة ${schedule.roomId}` : 'القاعة المحددة');

        const reminder: LectureReminder = {
          id: `reminder-${Date.now()}`,
          scheduleId: schedule.id,
          subjectName,
          roomName,
          buildingName: rm?.code,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          minutesRemaining: Math.max(0, diffMinutes),
          facultyName: fac?.nameAr || user.name,
          facultyId: schedule.facultyId,
          lectureDate: todayDateStr,
        };

        setActiveReminder(reminder);

        if (soundEnabled) {
          playGentleChime();
        }

        // Add to local notifications & backend
        const notifTitle = `تذكير بموعد المحاضرة (قبل ${diffMinutes > 0 ? diffMinutes : 15} دقيقة)`;
        const notifMessage = `محاضرة "${subjectName}" في ${roomName} تبدأ في تمام الساعة ${schedule.startTime}.`;

        const newNotif: AppNotification = {
          id: `notif-${Date.now()}`,
          title: notifTitle,
          message: notifMessage,
          type: 'lecture_reminder',
          scheduleId: schedule.id,
          roomName,
          subjectName,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          minutesRemaining: Math.max(0, diffMinutes),
          isRead: false,
          createdAt: new Date().toISOString(),
        };

        setNotifications((prev) => [newNotif, ...prev]);

        // Attempt persisting to backend
        try {
          await api.createNotification({
            title: notifTitle,
            message: notifMessage,
            type: 'lecture_reminder',
            userId: user.id,
          });
        } catch {
          // Ignore
        }

        break; // Show one active popup at a time
      }
    }
  }, [user, soundEnabled]);

  // Simulate an upcoming lecture reminder (15-minute countdown test)
  const simulateLectureReminder = useCallback(() => {
    // Pick the first available schedule or mock a realistic lecture
    const sampleSchedule = schedulesRef.current[0];
    const sub = subjectsRef.current.find((s) => s.id === sampleSchedule?.subjectId);
    const rm = roomsRef.current.find((r) => r.id === sampleSchedule?.roomId);

    const now = new Date();
    const futureTime = new Date(now.getTime() + 15 * 60 * 1000);
    const timeStr = `${futureTime.getHours().toString().padStart(2, '0')}:${futureTime.getMinutes().toString().padStart(2, '0')}`;
    const endFuture = new Date(futureTime.getTime() + 90 * 60 * 1000);
    const endTimeStr = `${endFuture.getHours().toString().padStart(2, '0')}:${endFuture.getMinutes().toString().padStart(2, '0')}`;

    const subjectName = sub?.nameAr || 'الذكاء الاصطناعي وهندسة البرمجيات';
    const roomName = rm?.nameAr || 'المدرج 204 - مبنى الهندسة';

    const reminder: LectureReminder = {
      id: `sim-${Date.now()}`,
      scheduleId: sampleSchedule?.id || 'sch-demo-15',
      subjectName,
      roomName,
      buildingName: 'المبنى الرئيسي',
      startTime: timeStr,
      endTime: endTimeStr,
      minutesRemaining: 15,
      facultyName: user?.name || 'الأستاذ الجامعي',
      lectureDate: now.toISOString().split('T')[0],
    };

    setActiveReminder(reminder);

    if (soundEnabled) {
      playGentleChime();
    }

    const notifTitle = 'تذكير بموعد المحاضرة (قبل 15 دقيقة)';
    const notifMessage = `محاضرة "${subjectName}" في ${roomName} تبدأ في تمام الساعة ${timeStr} (متبقي 15 دقيقة).`;

    const newNotif: AppNotification = {
      id: `sim-notif-${Date.now()}`,
      title: notifTitle,
      message: notifMessage,
      type: 'lecture_reminder',
      scheduleId: reminder.scheduleId,
      roomName,
      subjectName,
      startTime: timeStr,
      endTime: endTimeStr,
      minutesRemaining: 15,
      isRead: false,
      createdAt: new Date().toISOString(),
    };

    setNotifications((prev) => [newNotif, ...prev]);

    // Persist to backend if possible
    api.createNotification({
      title: notifTitle,
      message: notifMessage,
      type: 'lecture_reminder',
      userId: user?.id,
    }).catch(() => {});
  }, [user, soundEnabled]);

  const markAsRead = async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
    try {
      await api.markNotificationRead(id);
    } catch {
      // ignore
    }
  };

  const markAllAsRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    try {
      await api.markAllNotificationsRead();
    } catch {
      // ignore
    }
  };

  const deleteNotification = async (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    try {
      await api.deleteNotification(id);
    } catch {
      // ignore
    }
  };

  const dismissActiveReminder = () => {
    setActiveReminder(null);
  };

  // Initial load
  useEffect(() => {
    if (user) {
      fetchNotifications();
      loadScheduleData().then(() => {
        checkUpcomingLectures();
      });
    }
  }, [user, fetchNotifications, loadScheduleData, checkUpcomingLectures]);

  // Periodic check every 25 seconds
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      checkUpcomingLectures();
    }, 25000);
    return () => clearInterval(interval);
  }, [user, checkUpcomingLectures]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        activeReminder,
        soundEnabled,
        toggleSound,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        dismissActiveReminder,
        simulateLectureReminder,
        navigateToAttendanceLecture: navigateToAttendanceRef.current,
        setNavigateToAttendanceLecture,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotification = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};
