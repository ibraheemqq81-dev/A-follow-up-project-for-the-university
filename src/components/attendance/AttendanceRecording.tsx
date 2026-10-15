import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { api } from '../../services/api.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import { useNotification } from '../../context/NotificationContext.tsx';
import {
  CalendarCheck,
  Clock,
  Calendar,
  Users,
  Camera,
  DoorOpen,
  BookOpen,
  Building2,
  X,
  Plus,
  Minus,
  RefreshCw,
  Bell,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  WifiOff,
  Wifi,
  Check,
} from 'lucide-react';

interface ScheduleItem {
  id: string;
  collegeId: string;
  departmentId: string;
  stageId?: string;
  subjectId?: string;
  facultyId?: string;
  sectionId?: string;
  roomId?: string;
  day: string;
  startTime: string;
  endTime: string;
  lectureType?: string;
  academicYear?: string;
  semester?: string;
}

const DAYS_ARABIC: Record<string, string> = {
  Saturday: 'السبت',
  Sunday: 'الأحد',
  Monday: 'الإثنين',
  Tuesday: 'الثلاثاء',
  Wednesday: 'الأربعاء',
  Thursday: 'الخميس',
  Friday: 'الجمعة',
};

const ensureArray = (val: any): any[] => {
  if (Array.isArray(val)) return val;
  if (val && Array.isArray(val.data)) return val.data;
  if (val && Array.isArray(val.list)) return val.list;
  if (val && Array.isArray(val.faculties)) return val.faculties;
  if (val && Array.isArray(val.schedules)) return val.schedules;
  if (val && Array.isArray(val.records)) return val.records;
  return [];
};

function getTodayDayName(): string {
  const dayIndex = new Date().getDay();
  const map: Record<number, string> = {
    0: 'Sunday',
    1: 'Monday',
    2: 'Tuesday',
    3: 'Wednesday',
    4: 'Thursday',
    5: 'Friday',
    6: 'Saturday',
  };
  return map[dayIndex] || 'Sunday';
}

function getArabicDateFormatted(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('ar-IQ', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

interface AttendanceRecordingProps {
  targetScheduleId?: string;
  onClearTargetScheduleId?: () => void;
}

export const AttendanceRecording: React.FC<AttendanceRecordingProps> = ({
  targetScheduleId,
  onClearTargetScheduleId,
}) => {
  const { user } = useAuth();
  const { activeReminder } = useNotification();

  // Network & Offline Status
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [offlineQueue, setOfflineQueue] = useState<any[]>([]);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncMessage, setSyncMessage] = useState<string>('');

  // Core Data
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [facultyList, setFacultyList] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [stages, setStages] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [allAttendance, setAllAttendance] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Selected faculty & dates
  const [selectedFacultyId, setSelectedFacultyId] = useState<string>('');
  const todayDateStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const todayDayName = useMemo(() => getTodayDayName(), []);

  // Active Selected Lecture for direct attendance
  const [selectedScheduleId, setSelectedScheduleId] = useState<string>('');

  // Attendance Form Values
  const [presentCount, setPresentCount] = useState<number | ''>(35);
  const [photoEvidence, setPhotoEvidence] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isSuccessSaved, setIsSuccessSaved] = useState<boolean>(false);
  const [savedDataSummary, setSavedDataSummary] = useState<any>(null);
  const [showConfirmPopup, setShowConfirmPopup] = useState<boolean>(false);

  // Optional History drawer
  const [showHistorySection, setShowHistorySection] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Load offline queue from localStorage on mount
  useEffect(() => {
    try {
      const storedQueue = localStorage.getItem('uomus_offline_attendance_queue');
      if (storedQueue) {
        setOfflineQueue(JSON.parse(storedQueue));
      }
    } catch {
      // ignore
    }
  }, []);

  // Sync offline queue when online
  const syncOfflineQueue = useCallback(async () => {
    if (!navigator.onLine || isSyncing) return;
    const storedQueueStr = localStorage.getItem('uomus_offline_attendance_queue');
    if (!storedQueueStr) return;

    try {
      const queue: any[] = JSON.parse(storedQueueStr);
      if (queue.length === 0) return;

      setIsSyncing(true);
      setSyncMessage('جاري مزامنة سجلات الحضور المحلية مع السيرفر...');

      const remainingQueue: any[] = [];
      for (const item of queue) {
        try {
          await api.recordAttendance(item);
        } catch {
          remainingQueue.push(item);
        }
      }

      localStorage.setItem('uomus_offline_attendance_queue', JSON.stringify(remainingQueue));
      setOfflineQueue(remainingQueue);

      // Refresh attendance records from server
      const updatedAtt = await api.getAttendanceRecords();
      setAllAttendance(updatedAtt || []);

      if (remainingQueue.length === 0) {
        setSyncMessage('تمت مزامنة جميع سجلات الحضور بنجاح مع السيرفر!');
      } else {
        setSyncMessage(`تمت مزامنة بعض السجلات، وبقي ${remainingQueue.length} قيد الانتظار.`);
      }

      setTimeout(() => setSyncMessage(''), 4000);
    } catch (err) {
      console.warn('Sync notice (offline/network unavailable):', err);
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing]);

  // Monitor online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncOfflineQueue();
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    if (navigator.onLine) {
      syncOfflineQueue();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [syncOfflineQueue]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [schRes, facRes, subRes, rmRes, stgRes, secRes, depRes, attRes] = await Promise.allSettled([
        api.getSchedules(),
        api.getFaculties(),
        api.getSubjects(),
        api.getRooms(),
        api.getStages(),
        api.getSections(),
        api.getDepartments(),
        api.getAttendanceRecords(),
      ]);

      const sch = ensureArray(schRes.status === 'fulfilled' ? schRes.value : null);
      const fac = ensureArray(facRes.status === 'fulfilled' ? facRes.value : null);
      const sub = ensureArray(subRes.status === 'fulfilled' ? subRes.value : null);
      const rm = ensureArray(rmRes.status === 'fulfilled' ? rmRes.value : null);
      const stg = ensureArray(stgRes.status === 'fulfilled' ? stgRes.value : null);
      const sec = ensureArray(secRes.status === 'fulfilled' ? secRes.value : null);
      const dep = ensureArray(depRes.status === 'fulfilled' ? depRes.value : null);
      const att = ensureArray(attRes.status === 'fulfilled' ? attRes.value : null);

      // Merge offline queued attendance with server attendance
      let localQueue: any[] = [];
      try {
        const qStr = localStorage.getItem('uomus_offline_attendance_queue');
        if (qStr) localQueue = ensureArray(JSON.parse(qStr));
      } catch {
        // ignore
      }

      const combinedAtt = [...localQueue, ...att];

      setSchedules(sch);
      setFacultyList(fac);
      setSubjects(sub);
      setRooms(rm);
      setStages(stg);
      setSections(sec);
      setDepartments(dep);
      setAllAttendance(combinedAtt);

      // Save to offline cache for offline fallback
      try {
        localStorage.setItem(
          'uomus_offline_cache',
          JSON.stringify({
            schedules: sch,
            facultyList: fac,
            subjects: sub,
            rooms: rm,
            stages: stg,
            sections: sec,
            departments: dep,
            attendance: att,
          })
        );
      } catch {
        // ignore storage limits
      }

      // Match Faculty
      let matchedId = '';
      if (user?.assignedFacultyId) {
        matchedId = user.assignedFacultyId;
      } else if (user?.email && fac.length > 0) {
        const found = fac.find((f: any) => f?.email?.toLowerCase() === user.email?.toLowerCase());
        if (found) matchedId = found.id;
      }
      if (!matchedId && user?.role !== 'FACULTY' && fac.length > 0) {
        matchedId = fac[0]?.id || '';
      }

      setSelectedFacultyId((prev) => prev || matchedId);
    } catch (err) {
      console.warn('Network request failed, loading from offline cache:', err);
      // Fallback to offline cache
      try {
        const cached = localStorage.getItem('uomus_offline_cache');
        if (cached) {
          const data = JSON.parse(cached);
          const cachedSch = ensureArray(data.schedules);
          const cachedFac = ensureArray(data.facultyList);
          const cachedSub = ensureArray(data.subjects);
          const cachedRm = ensureArray(data.rooms);
          const cachedStg = ensureArray(data.stages);
          const cachedSec = ensureArray(data.sections);
          const cachedDep = ensureArray(data.departments);
          const cachedAtt = ensureArray(data.attendance);

          setSchedules(cachedSch);
          setFacultyList(cachedFac);
          setSubjects(cachedSub);
          setRooms(cachedRm);
          setStages(cachedStg);
          setSections(cachedSec);
          setDepartments(cachedDep);
          
          let localQueue: any[] = [];
          try {
            const qStr = localStorage.getItem('uomus_offline_attendance_queue');
            if (qStr) localQueue = ensureArray(JSON.parse(qStr));
          } catch {}

          setAllAttendance([...localQueue, ...cachedAtt]);

          if (cachedFac.length > 0) {
            setSelectedFacultyId((prev) => prev || cachedFac[0].id);
          }
        }
      } catch (cacheErr) {
        console.error('Error loading offline cache:', cacheErr);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Clean up camera stream on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Current faculty object
  const currentFaculty = useMemo(() => {
    const list = ensureArray(facultyList);
    return list.find((f) => f && f.id === selectedFacultyId) || null;
  }, [facultyList, selectedFacultyId]);

  // Lookup Helpers
  const getSubject = (id?: string) => ensureArray(subjects).find((s) => s && s.id === id);
  const getRoom = (id?: string) => ensureArray(rooms).find((r) => r && r.id === id);
  const getStage = (id?: string) => ensureArray(stages).find((s) => s && s.id === id);
  const getSection = (id?: string) => ensureArray(sections).find((s) => s && s.id === id);
  const getDept = (id?: string) => ensureArray(departments).find((d) => d && d.id === id);

  // Professor's Lectures
  const myFacultySchedules = useMemo(() => {
    if (!selectedFacultyId) return [];
    const list = ensureArray(schedules);
    return list.filter((s) => s && s.facultyId === selectedFacultyId);
  }, [schedules, selectedFacultyId]);

  // Today's lectures for this professor
  const myTodaySchedules = useMemo(() => {
    const list = ensureArray(myFacultySchedules);
    return list
      .filter((s) => s && s.day === todayDayName)
      .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
  }, [myFacultySchedules, todayDayName]);

  // Fallback: If today has no lectures, show all lectures of this professor
  const activeLectureOptions = useMemo(() => {
    const today = ensureArray(myTodaySchedules);
    if (today.length > 0) return today;
    return ensureArray(myFacultySchedules);
  }, [myTodaySchedules, myFacultySchedules]);

  // Select active lecture automatically
  useEffect(() => {
    const allSchedules = ensureArray(schedules);
    if (targetScheduleId) {
      const found = allSchedules.find((s) => s && s.id === targetScheduleId);
      if (found) {
        setSelectedScheduleId(found.id);
        if (found.facultyId) setSelectedFacultyId(found.facultyId);
        onClearTargetScheduleId?.();
        return;
      }
    }

    if (!selectedScheduleId && activeLectureOptions.length > 0) {
      setSelectedScheduleId(activeLectureOptions[0].id);
    }
  }, [targetScheduleId, activeLectureOptions, schedules]);

  // Active Schedule Object
  const currentSchedule = useMemo(() => {
    const allSchedules = ensureArray(schedules);
    if (selectedScheduleId) {
      const found = allSchedules.find((s) => s && s.id === selectedScheduleId);
      if (found) return found;
    }
    return activeLectureOptions[0] || null;
  }, [schedules, selectedScheduleId, activeLectureOptions]);

  // Check if current lecture already recorded today
  const existingAttendance = useMemo(() => {
    if (!currentSchedule) return null;
    const allAtt = ensureArray(allAttendance);
    return allAtt.find(
      (a) => a && a.scheduleId === currentSchedule.id && a.lectureDate === todayDateStr
    );
  }, [currentSchedule, allAttendance, todayDateStr]);

  // Prepopulate if previously recorded
  useEffect(() => {
    if (existingAttendance) {
      setPresentCount(existingAttendance.presentCount || 35);
      setPhotoEvidence(existingAttendance.photoEvidence || null);
    } else {
      setPresentCount(35);
      setPhotoEvidence(null);
    }
  }, [existingAttendance, currentSchedule]);

  // Unified Camera Launcher for all device types
  const handleOpenUnifiedCamera = async () => {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
          setIsCameraActive(true);
          return;
        }
      } catch (err) {
        console.warn('Direct media stream unavailable, trying camera picker fallback:', err);
      }
    }

    if (fileInputRef.current) {
      fileInputRef.current.click();
    } else {
      captureOfficialDigitalStamp();
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'rgba(6, 78, 59, 0.85)';
        ctx.fillRect(0, canvas.height - 48, canvas.width, 48);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 15px sans-serif';
        const subName = currentSchedule ? getSubject(currentSchedule.subjectId)?.nameAr : '';
        const roomName = currentSchedule ? getRoom(currentSchedule.roomId)?.nameAr : '';
        const watermark = `جامعة المستقبل • ${subName || 'توثيق الحضور'} • ${roomName || ''} • ${new Date().toLocaleDateString('ar-IQ')} ${new Date().toLocaleTimeString('ar-IQ')}`;
        ctx.fillText(watermark, 20, canvas.height - 18);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
        setPhotoEvidence(dataUrl);
        stopCamera();
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setPhotoEvidence(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const captureOfficialDigitalStamp = () => {
    const timeText = new Date().toLocaleString('ar-IQ');
    const subName = currentSchedule ? getSubject(currentSchedule.subjectId)?.nameAr || 'المادة' : 'المادة';
    const roomName = currentSchedule ? getRoom(currentSchedule.roomId)?.nameAr || 'القاعة' : 'القاعة';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400"><rect width="640" height="400" fill="#064e3b"/><rect x="20" y="20" width="600" height="360" rx="16" fill="#047857" stroke="#34d399" stroke-width="2.5"/><text x="320" y="100" fill="#ffffff" font-size="22" font-weight="bold" text-anchor="middle" font-family="sans-serif">جامعة المستقبل — توثيق الحضور الأكاديمي (بدون اتصال)</text><text x="320" y="160" fill="#a7f3d0" font-size="19" font-weight="bold" text-anchor="middle" font-family="sans-serif">${subName}</text><text x="320" y="210" fill="#ffffff" font-size="16" text-anchor="middle" font-family="sans-serif">${roomName} • الأستاذ: ${currentFaculty?.nameAr || 'التدريسي'}</text><text x="320" y="270" fill="#d1fae5" font-size="14" text-anchor="middle" font-family="sans-serif">التاريخ: ${timeText}</text><rect x="180" y="305" width="280" height="36" rx="10" fill="#065f46"/><text x="320" y="328" fill="#6ee7b7" font-size="14" font-weight="bold" text-anchor="middle" font-family="sans-serif">توثيق محلي معتمد</text></svg>`;
    const dataUrl = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
    setPhotoEvidence(dataUrl);
  };

  // Submit Attendance (Robust Offline Support)
  const handleSaveAttendance = async () => {
    if (!currentSchedule || !selectedFacultyId) return;

    if (!photoEvidence) {
      alert('لا يمكن تثبيت واعتماد الحضور إلا بعد توثيق صورة للمحاضرة أولاً.');
      return;
    }

    const countNum = presentCount === '' ? 0 : Number(presentCount);

    setIsSubmitting(true);
    const sub = getSubject(currentSchedule.subjectId);
    const rm = getRoom(currentSchedule.roomId);

    const payload = {
      id: `offline-${Date.now()}`,
      scheduleId: currentSchedule.id,
      facultyId: selectedFacultyId,
      lectureDate: todayDateStr,
      status: 'PRESENT',
      presentCount: countNum,
      totalCount: countNum, // Use actual present count as total (will be updated when enrollment data is available)
      topicsCovered: `محاضرة ${sub?.nameAr || 'المادة'} — الفصل الدراسي الحالي`,
      verificationMethod: photoEvidence ? 'CAMERA_EVIDENCE' : 'DIRECT_VERIFICATION',
      photoEvidence: photoEvidence || undefined,
      sectionId: currentSchedule.sectionId,
      subjectId: currentSchedule.subjectId,
      roomId: currentSchedule.roomId,
      createdAt: new Date().toISOString(),
    };

    try {
      if (!navigator.onLine) {
        throw new Error('Offline');
      }

      await api.recordAttendance(payload);

      // If online sync succeeds
      setSavedDataSummary({
        subjectName: sub?.nameAr || 'المادة الدراسية',
        roomName: rm?.nameAr || 'القاعة الدراسية',
        count: countNum,
        photo: photoEvidence,
        time: new Date().toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' }),
        isOfflineSaved: false,
      });

      setShowConfirmPopup(true);
      stopCamera();

      const updatedAtt = await api.getAttendanceRecords();
      setAllAttendance(updatedAtt || []);
    } catch (err) {
      // Offline fallback: store in local queue
      console.warn('Network offline or error during submit, saving to local offline queue:', err);

      try {
        const existingQueueStr = localStorage.getItem('uomus_offline_attendance_queue');
        const queue = existingQueueStr ? JSON.parse(existingQueueStr) : [];
        queue.push(payload);
        localStorage.setItem('uomus_offline_attendance_queue', JSON.stringify(queue));
        setOfflineQueue(queue);

        // Update local state immediately
        setAllAttendance((prev) => [payload, ...prev]);

        setSavedDataSummary({
          subjectName: sub?.nameAr || 'المادة الدراسية',
          roomName: rm?.nameAr || 'القاعة الدراسية',
          count: countNum,
          photo: photoEvidence,
          time: new Date().toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' }),
          isOfflineSaved: true,
        });

        setShowConfirmPopup(true);
        stopCamera();
      } catch (localErr) {
        alert('تعذر حفظ الحضور محلياً. يرجى التحقق من المساحة المتوفرة.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="py-24 text-center space-y-4">
        <div className="w-14 h-14 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <h2 className="text-lg font-bold text-slate-700">جاري فتح بوابة حضور التدريسيين...</h2>
      </div>
    );
  }

  // SUCCESS CONFIRMATION VIEW
  if (isSuccessSaved && savedDataSummary) {
    return (
      <div className="max-w-2xl mx-auto py-8 px-4 text-center animate-in fade-in zoom-in-95">
        <div className="bg-white rounded-3xl p-8 sm:p-10 shadow-2xl border-4 border-emerald-400 space-y-6">
          <div className="w-20 h-20 rounded-full bg-emerald-100 border-4 border-emerald-300 text-emerald-700 mx-auto flex items-center justify-center shadow-md">
            <ShieldCheck className="w-12 h-12" />
          </div>

          <div>
            <span className="px-4 py-1.5 rounded-full bg-emerald-100 text-emerald-900 font-black text-sm uppercase tracking-wider">
              {savedDataSummary.isOfflineSaved
                ? 'تم الحفظ محلياً بنجاح (بدون اتصال)'
                : 'تم التوثيق والاعتماد الأكاديمي بنجاح'}
            </span>
            <h1 className="text-3xl sm:text-4xl font-black text-slate-900 mt-3">
              {savedDataSummary.isOfflineSaved
                ? 'تم تسجيل الحضور في وضع عدم الاتصال'
                : 'تم حفظ حضور المحاضرة رسمياً'}
            </h1>
            <p className="text-base sm:text-lg text-slate-600 mt-2 font-medium">
              {savedDataSummary.isOfflineSaved
                ? 'تم حفظ السجل على جهازك محلياً، وسيتم مزامنته تلقائياً مع السيرفر بمجرد عودة الاتصال بالإنترنت.'
                : 'تم تثبيت السجل والتوثيق المائي ضمن منظومة جامعة المستقبل المعتمدة.'}
            </p>
          </div>

          <div className="bg-emerald-50/90 border-2 border-emerald-200 rounded-3xl p-6 text-right space-y-3.5 text-base sm:text-lg font-bold text-slate-800">
            <div className="flex justify-between border-b border-emerald-200/70 pb-2">
              <span className="text-slate-500 font-medium">المادة الدراسية:</span>
              <span className="text-slate-900 font-black text-xl">{savedDataSummary.subjectName}</span>
            </div>
            <div className="flex justify-between border-b border-emerald-200/70 pb-2">
              <span className="text-slate-500 font-medium">القاعة الدراسية:</span>
              <span className="text-emerald-800 font-black">{savedDataSummary.roomName}</span>
            </div>
            <div className="flex justify-between border-b border-emerald-200/70 pb-2">
              <span className="text-slate-500 font-medium">عدد الطلبة الحاضرين:</span>
              <span className="text-emerald-700 font-black text-2xl">{savedDataSummary.count} طالباً</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">وقت التوثيق:</span>
              <span className="text-slate-700 font-semibold">{savedDataSummary.time}</span>
            </div>
          </div>

          {savedDataSummary.photo && (
            <div className="rounded-2xl overflow-hidden border-2 border-emerald-300 max-h-56 shadow-md">
              <img src={savedDataSummary.photo} alt="صورة القاعة الموثقة" className="w-full h-auto object-cover" />
            </div>
          )}

          <button
            type="button"
            onClick={() => setIsSuccessSaved(false)}
            className="w-full py-4 sm:py-5 px-8 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xl shadow-xl cursor-pointer transition-all"
          >
            العودة لجدول المحاضرات
          </button>
        </div>
      </div>
    );
  }

  const subObj = currentSchedule ? getSubject(currentSchedule.subjectId) : null;
  const rmObj = currentSchedule ? getRoom(currentSchedule.roomId) : null;
  const stgObj = currentSchedule ? getStage(currentSchedule.stageId) : null;
  const secObj = currentSchedule ? getSection(currentSchedule.sectionId) : null;

  const currentCountDisplay = presentCount === '' ? 0 : presentCount;

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-16">
      {/* Hidden File Input as universal camera fallback */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* OFFLINE / SYNC STATUS BANNER */}
      {!isOnline ? (
        <div className="bg-amber-100 border-2 border-amber-400 text-amber-950 p-4 rounded-2xl shadow-sm flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-300 flex items-center justify-center text-amber-900 shrink-0">
              <WifiOff className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-sm">وضع عدم الاتصال بالإنترنت (Offline Mode)</div>
              <div className="text-xs text-amber-800">
                يمكنك تسجيل حضور المحاضرات وكتابة أعداد الطلاب والتقاط الصور؛ سيتم حفظها محلياً ومزامنتها تلقائياً عند عودة الإنترنت.
              </div>
            </div>
          </div>
          {offlineQueue.length > 0 && (
            <span className="px-3 py-1 rounded-xl bg-amber-200 text-amber-950 font-black text-xs shrink-0">
              {offlineQueue.length} سجل محلي معلق
            </span>
          )}
        </div>
      ) : offlineQueue.length > 0 ? (
        <div className="bg-blue-50 border-2 border-blue-300 text-blue-950 p-4 rounded-2xl shadow-sm flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-200 flex items-center justify-center text-blue-900 shrink-0">
              <Wifi className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-sm">الاتصال متوفر — لديك {offlineQueue.length} سجل حضور محلي</div>
              <div className="text-xs text-blue-800">
                {syncMessage || 'انقر على زر المزامنة لنقل السجلات المحلية إلى السيرفر الرسمي.'}
              </div>
            </div>
          </div>
          <button
            type="button"
            disabled={isSyncing}
            onClick={syncOfflineQueue}
            className="px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50 shrink-0"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'جاري المزامنة...' : 'مزامنة السجلات الآن'}</span>
          </button>
        </div>
      ) : syncMessage ? (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 p-3 rounded-xl text-xs font-bold text-center">
          {syncMessage}
        </div>
      ) : null}

      {/* 1. WELCOME HEADER */}
      <div className="bg-gradient-to-l from-emerald-900 via-emerald-800 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl border-2 border-emerald-600/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-emerald-200 text-xs font-bold mb-2">
            <Building2 className="w-4 h-4 text-emerald-300" />
            <span>جامعة المستقبل — بوابة حضور التدريسيين</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-black tracking-tight">
            أهلاً بك، {currentFaculty?.nameAr || 'دكتور'}
          </h1>
          <p className="text-emerald-200 text-sm sm:text-base mt-1 font-semibold flex items-center gap-2">
            <Calendar className="w-4 h-4 text-emerald-300 inline" />
            <span>{getArabicDateFormatted(todayDateStr)}</span>
            <span className="mx-1">•</span>
            <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-bold ${isOnline ? 'bg-emerald-700/80 text-white' : 'bg-amber-600 text-white'}`}>
              {isOnline ? <Wifi className="w-3 h-3 inline" /> : <WifiOff className="w-3 h-3 inline" />}
              {isOnline ? 'متصل بالإنترنت' : 'غير متصل (وضع غير متصل)'}
            </span>
          </p>
        </div>

        {user?.role !== 'FACULTY' && (
          <div className="shrink-0">
            <select
              value={selectedFacultyId}
              onChange={(e) => {
                setSelectedFacultyId(e.target.value);
                setSelectedScheduleId('');
              }}
              className="px-3.5 py-2.5 rounded-2xl bg-slate-900 text-white text-xs font-bold border border-emerald-500/50"
            >
              {ensureArray(facultyList).map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nameAr}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* 15-MINUTE NOTIFICATION BANNER */}
      {activeReminder && (
        <div className="bg-amber-100 border-2 border-amber-400 text-amber-950 p-4 sm:p-5 rounded-3xl shadow-sm flex items-center gap-4">
          <div className="w-11 h-11 rounded-2xl bg-amber-300 flex items-center justify-center text-amber-900 shrink-0">
            <Bell className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <div className="text-xs font-black uppercase text-amber-800">
              تذكير أكاديمي: تبدأ المحاضرة بعد {activeReminder.minutesRemaining} دقيقة
            </div>
            <div className="text-base sm:text-lg font-black text-slate-900 mt-0.5">
              {activeReminder.subjectName} — القاعة: {activeReminder.roomName}
            </div>
          </div>
        </div>
      )}

      {/* 2. LECTURE SELECTOR */}
      {activeLectureOptions.length > 1 && (
        <div className="bg-white rounded-3xl border-2 border-slate-200 p-4 sm:p-5 shadow-xs space-y-3">
          <div className="text-sm font-bold text-slate-700">
            اختر المحاضرة المراد تثبيت حضورها:
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {activeLectureOptions.map((item, idx) => {
              const sub = getSubject(item.subjectId);
              const rm = getRoom(item.roomId);
              const isSelected = item.id === (currentSchedule?.id || selectedScheduleId);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedScheduleId(item.id)}
                  className={`p-4 rounded-2xl border-3 text-right transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-50 border-emerald-600 ring-2 ring-emerald-400'
                      : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black px-2 py-0.5 rounded-md bg-slate-900 text-white">
                      المحاضرة {idx + 1}
                    </span>
                    <span className="text-xs font-bold text-emerald-800">
                      {item.startTime} - {item.endTime}
                    </span>
                  </div>
                  <div className="font-black text-slate-900 text-base mt-1.5">
                    {sub?.nameAr || 'المادة الدراسية'}
                  </div>
                  <div className="text-xs text-slate-600 mt-1 font-semibold">
                    القاعة: {rm?.nameAr || 'القاعة'}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. MAIN LECTURE ATTENDANCE CARD */}
      <div className="bg-white rounded-3xl border-3 border-emerald-500 p-6 sm:p-8 shadow-lg space-y-6">
        <div className="border-b-2 border-slate-100 pb-5 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-xl bg-slate-900 text-white font-black text-sm sm:text-base">
              <Clock className="w-4 h-4 text-slate-300" />
              <span>{currentSchedule?.startTime || '08:30'} إلى {currentSchedule?.endTime || '10:30'}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-xl bg-emerald-100 text-emerald-900 font-black text-sm sm:text-base border border-emerald-300">
              <DoorOpen className="w-4 h-4 text-emerald-700" />
              <span>القاعة: {rmObj?.nameAr || 'قاعة الخوارزمي'}</span>
            </span>
            {stgObj && (
              <span className="px-3 py-1 rounded-xl bg-blue-50 text-blue-900 font-bold text-sm">
                {stgObj.nameAr} {secObj ? `— شعبة ${secObj.name}` : ''}
              </span>
            )}
          </div>

          <h2 className="text-2xl sm:text-4xl font-black text-slate-900 mt-2">
            {subObj?.nameAr || 'المادة الدراسية'}
          </h2>

          {existingAttendance ? (
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-emerald-100 text-emerald-950 font-black text-xs sm:text-sm mt-1 border border-emerald-300">
              <ShieldCheck className="w-4 h-4 text-emerald-700" />
              <span>تم تسجيل حضور هذه المحاضرة مسبقاً ({existingAttendance.presentCount} طالباً) — يمكنك التعديل والحفظ مجدداً</span>
            </div>
          ) : (
            <div className="text-xs sm:text-sm text-slate-500 font-bold">
              الرجاء فتح الكاميرا لتوثيق القاعة وتحديد عدد الطلاب ثم الضغط على زر تثبيت الحضور بالأسفل (يعمل حتى بدون إنترنت).
            </div>
          )}
        </div>

        {/* STEP 1: CAMERA */}
        <div className="p-5 sm:p-6 rounded-3xl bg-slate-50 border-2 border-slate-200 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-2xl bg-emerald-600 text-white font-black text-base flex items-center justify-center shadow-xs">
                1
              </span>
              <label className="font-black text-slate-900 text-lg sm:text-xl">
                توثيق القاعة والطلبة بالكاميرا
              </label>
            </div>
            {photoEvidence && (
              <span className="text-xs sm:text-sm font-black text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full border border-emerald-300">
                تم توثيق الصورة
              </span>
            )}
          </div>

          <div className="border-2 border-dashed border-slate-300 rounded-2xl p-4 bg-white text-center">
            {isCameraActive ? (
              <div className="space-y-3">
                <div className="relative rounded-2xl overflow-hidden bg-black max-w-md mx-auto shadow-md">
                  <video ref={videoRef} className="w-full h-auto bg-black rounded-2xl" autoPlay playsInline />
                  <div className="absolute top-3 right-3 bg-red-600 text-white text-xs font-black px-3 py-1 rounded-full animate-pulse">
                    الكاميرا قيد التشغيل
                  </div>
                </div>

                <div className="flex flex-wrap justify-center gap-3">
                  <button
                    type="button"
                    onClick={capturePhoto}
                    className="py-3.5 px-7 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-base sm:text-lg shadow-lg shadow-emerald-700/25 flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <Camera className="w-5 h-5 text-emerald-100" />
                    <span>التقاط صورة التوثيق</span>
                  </button>
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="py-3.5 px-5 rounded-2xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-sm cursor-pointer"
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            ) : photoEvidence ? (
              <div className="space-y-3">
                <div className="relative max-w-sm mx-auto rounded-2xl overflow-hidden border-2 border-emerald-400 shadow-md">
                  <img src={photoEvidence} alt="دليل التوثيق" className="w-full h-auto max-h-56 object-cover" />
                  <div className="absolute bottom-2 right-2 bg-emerald-950/80 text-white text-xs px-2.5 py-1 rounded-lg font-bold">
                    صورة القاعة الموثقة
                  </div>
                </div>

                <div>
                  <button
                    type="button"
                    onClick={() => {
                      setPhotoEvidence(null);
                      handleOpenUnifiedCamera();
                    }}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm border border-slate-300 cursor-pointer"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>إعادة التقاط صورة أخرى</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-3 space-y-3">
                <div className="max-w-md mx-auto">
                  <button
                    type="button"
                    onClick={handleOpenUnifiedCamera}
                    className="w-full py-4 sm:py-5 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-lg flex items-center justify-center gap-3 shadow-lg shadow-emerald-700/25 cursor-pointer transition-all hover:scale-[1.01]"
                  >
                    <Camera className="w-6 h-6 text-emerald-100" />
                    <span>فتح الكاميرا لتوثيق القاعة</span>
                  </button>
                </div>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={captureOfficialDigitalStamp}
                    className="text-xs sm:text-sm font-semibold text-slate-500 hover:text-slate-800 underline cursor-pointer"
                  >
                    اعتماد توثيق رقمي رسمي في حال تعذر تشغيل الكاميرا
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* STEP 2: STUDENT ATTENDANCE COUNT (KEYBOARD + STEPPERS) */}
        <div className="p-5 sm:p-6 rounded-3xl bg-slate-50 border-2 border-slate-200 space-y-4">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-2xl bg-emerald-600 text-white font-black text-base flex items-center justify-center shadow-xs">
              2
            </span>
            <div>
              <label className="font-black text-slate-900 text-lg sm:text-xl">
                عدد الطلاب الحاضرين في القاعة اليوم
              </label>
              <p className="text-xs sm:text-sm text-slate-500 font-bold">
                يمكنك كتابة العدد مباشرة من الكيبورد أو استخدام أزرار الزيادة والنقصان:
              </p>
            </div>
          </div>

          <div className="flex items-center justify-center gap-3 sm:gap-6 py-2">
            <button
              type="button"
              onClick={() => {
                const current = presentCount === '' ? 0 : Number(presentCount);
                setPresentCount(Math.max(0, current - 1));
              }}
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-red-100 hover:bg-red-200 text-red-800 font-black text-3xl sm:text-4xl border-2 border-red-300 shadow-sm cursor-pointer flex items-center justify-center shrink-0 transition-transform active:scale-95"
              title="إنقاص طالب واحد"
            >
              <Minus className="w-8 h-8 sm:w-10 sm:h-10" />
            </button>

            <div className="px-5 sm:px-8 py-3 sm:py-4 rounded-3xl bg-emerald-50 border-4 border-emerald-400 text-center shadow-inner min-w-[170px] sm:min-w-[220px]">
              <div className="flex items-center justify-center">
                <input
                  type="number"
                  min="0"
                  max="500"
                  step="1"
                  value={presentCount}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '') {
                      setPresentCount('');
                    } else {
                      const num = parseInt(val, 10);
                      if (!isNaN(num) && num >= 0) {
                        setPresentCount(num);
                      }
                    }
                  }}
                  onBlur={() => {
                    if (presentCount === '') {
                      setPresentCount(0);
                    }
                  }}
                  placeholder="0"
                  className="w-28 sm:w-36 text-center text-5xl sm:text-7xl font-black text-emerald-950 bg-transparent border-b-2 border-emerald-500/40 focus:border-emerald-600 focus:outline-none tracking-tight"
                  title="انقر هنا للكتابة بواسطة لوحة المفاتيح"
                />
              </div>
              <div className="text-sm sm:text-base font-bold text-emerald-800 mt-1">
                طالباً حاضراً (اكتب هنا)
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                const current = presentCount === '' ? 0 : Number(presentCount);
                setPresentCount(current + 1);
              }}
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-3xl sm:text-4xl shadow-xl shadow-emerald-700/30 cursor-pointer flex items-center justify-center shrink-0 transition-transform active:scale-95"
              title="زيادة طالب واحد"
            >
              <Plus className="w-8 h-8 sm:w-10 sm:h-10" />
            </button>
          </div>

          <div className="space-y-1.5 pt-2">
            <div className="text-xs sm:text-sm font-bold text-slate-500 text-center">
              أو اختر الرقم بلمسة واحدة مباشرة:
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {[15, 20, 25, 30, 35, 40, 45, 50, 60].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setPresentCount(num)}
                  className={`min-w-[54px] py-2.5 px-3 rounded-xl font-black text-base transition-all cursor-pointer ${
                    currentCountDisplay === num
                      ? 'bg-emerald-700 text-white shadow-md ring-2 ring-emerald-400 scale-105'
                      : 'bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 shadow-2xs'
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* STEP 3: SAVE BUTTON */}
        <div className="pt-2 space-y-2">
          {!photoEvidence && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800 text-xs sm:text-sm font-bold text-center flex items-center justify-center gap-2">
              <span>⚠️ تنبيه: زر تثبيت واعتماد الحضور غير متاح حتى يتم توثيق التقاط صورة للمحاضرة أولاً.</span>
            </div>
          )}
          <button
            type="button"
            disabled={isSubmitting || !photoEvidence}
            onClick={handleSaveAttendance}
            className={`w-full py-5 px-8 rounded-3xl font-black text-2xl sm:text-3xl shadow-2xl flex items-center justify-center gap-3 transition-all cursor-pointer transform ${
              !photoEvidence
                ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                : 'bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-emerald-700/35 hover:-translate-y-0.5 active:translate-y-0'
            }`}
            title={!photoEvidence ? 'يرجى التقاط صورة توثيقية للمحاضرة أولاً' : 'تثبيت واعتماد الحضور'}
          >
            <span>
              {isSubmitting ? 'جاري تثبيت السجل...' : !photoEvidence ? 'يفتقر إلى توثيق صورة المحاضرة' : 'تثبيت واعتماد حضور المحاضرة'}
            </span>
          </button>
        </div>
      </div>

      {/* 4. OPTIONAL ACCORDION: PREVIOUS ATTENDANCE HISTORY */}
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
        <button
          type="button"
          onClick={() => setShowHistorySection((s) => !s)}
          className="w-full p-5 text-right font-bold text-slate-700 hover:text-slate-900 flex items-center justify-between cursor-pointer"
        >
          <span className="flex items-center gap-2 text-sm sm:text-base">
            <Calendar className="w-5 h-5 text-emerald-600" />
            <span>عرض السجل السابق للمحاضرات الموثقة (شاملة السجلات المحلية)</span>
          </span>
          {showHistorySection ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>

        {showHistorySection && (
          <div className="p-5 pt-0 border-t border-slate-100">
            {ensureArray(allAttendance).filter((a) => a && a.facultyId === selectedFacultyId).length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-400">
                لا توجد سجلات حضور موثقة سابقاً لهذا التدريسي.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs sm:text-sm">
                  <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-3">التاريخ</th>
                      <th className="p-3">المادة</th>
                      <th className="p-3">القاعة</th>
                      <th className="p-3">عدد الطلاب الحاضرين</th>
                      <th className="p-3">حالة السجل</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {ensureArray(allAttendance)
                      .filter((a) => a && a.facultyId === selectedFacultyId)
                      .map((rec) => {
                        const isLocal = String(rec.id).startsWith('offline-');
                        return (
                          <tr key={rec.id}>
                            <td className="p-3 font-bold text-slate-900">{rec.lectureDate}</td>
                            <td className="p-3">{getSubject(rec.subjectId)?.nameAr || 'المادة'}</td>
                            <td className="p-3">{getRoom(rec.roomId)?.nameAr || 'القاعة'}</td>
                            <td className="p-3 font-black text-emerald-700">{rec.presentCount} طالب</td>
                            <td className="p-3 font-bold">
                              {isLocal ? (
                                <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 text-xs">
                                  محلي (بانتظار المزامنة)
                                </span>
                              ) : (
                                <span className="text-emerald-800">معتمد رسمياً</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Small Reassuring Confirmation Popup */}
      {showConfirmPopup && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in zoom-in-95">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border-3 border-emerald-400 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-100 border-3 border-emerald-300 text-emerald-700 mx-auto flex items-center justify-center shadow-md">
              <Check className="w-8 h-8 font-black" />
            </div>
            <div>
              <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-900 font-bold text-xs">
                {savedDataSummary?.isOfflineSaved ? 'تم الحفظ المحلي الآمن' : 'معتمد في السجل الأكاديمي'}
              </span>
              <h2 className="text-2xl font-black text-slate-900 mt-2">تم تسجيل الحضور بنجاح!</h2>
              <p className="text-sm text-slate-600 mt-1 font-medium">
                تم توثيق حضور المحاضرة للمادة <span className="font-bold text-emerald-800">{savedDataSummary?.subjectName}</span> بنجاح تام لتعزيز طمأنينة التدريسي.
              </p>
            </div>
            <div className="bg-emerald-50 rounded-2xl p-4 text-right text-xs space-y-2 border border-emerald-200">
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">القاعة:</span>
                <span className="font-bold text-slate-800">{savedDataSummary?.roomName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">عدد الحضور:</span>
                <span className="font-black text-emerald-800 text-sm">{savedDataSummary?.count} طالباً</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">الوقت:</span>
                <span className="font-semibold text-slate-700">{savedDataSummary?.time}</span>
              </div>
            </div>
            <div className="pt-2 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowConfirmPopup(false);
                  setIsSuccessSaved(true);
                }}
                className="flex-1 py-3.5 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-sm shadow-md cursor-pointer transition-all"
              >
                عرض التفاصيل الكاملة
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowConfirmPopup(false);
                  setSelectedScheduleId('');
                }}
                className="py-3.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm cursor-pointer transition-all"
              >
                حسناً (تم)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
