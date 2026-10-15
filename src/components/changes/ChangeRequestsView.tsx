import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import type { ChangeRequest } from '../../types/index.ts';
import {
  GitPullRequest,
  Plus,
  CheckCircle,
  XCircle,
  RotateCcw,
  Clock,
  Calendar,
  MapPin,
  User,
  AlertCircle,
  Loader2,
} from 'lucide-react';

const STATUS_LABELS: Record<string, string> = {
  pending: 'بانتظار المراجعة',
  approved: 'موافق عليه',
  rejected: 'مرفوض',
  returned: 'أُعيد لاستكمال المعلومات',
  applied: 'تم تطبيق التغيير',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800 border-amber-200',
  approved: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  rejected: 'bg-rose-100 text-rose-800 border-rose-200',
  returned: 'bg-blue-100 text-blue-800 border-blue-200',
  applied: 'bg-teal-100 text-teal-800 border-teal-200',
};

const CHANGE_TYPE_LABELS: Record<string, string> = {
  room_change: 'تغيير القاعة',
  postpone: 'تأجيل المحاضرة',
  exam_conflict: 'امتحان في الوقت نفسه',
  meeting: 'اجتماع',
  admin_assignment: 'تكليف إداري',
  mission: 'إيفاد',
  to_online: 'تحويل إلى محاضرة إلكترونية',
  time_change: 'تغيير الموعد',
  faculty_change: 'تغيير التدريسي',
  other: 'سبب آخر',
};

const REASON_TYPE_LABELS: Record<string, string> = {
  room_change: 'تغيير القاعة',
  postpone: 'تأجيل',
  exam_conflict: 'امتحان متزامن',
  meeting: 'اجتماع',
  admin_assignment: 'تكليف إداري',
  mission: 'إيفاد',
  to_online: 'محاضرة إلكترونية',
  time_change: 'تغيير الوقت',
  faculty_change: 'تغيير التدريسي',
  other: 'أخرى',
};

export const ChangeRequestsView: React.FC = () => {
  const { user } = useAuth();
  const [requests, setRequests] = useState<ChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject' | 'return'>('approve');
  const [reviewNotes, setReviewNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canReview = user?.role === 'OWNER' || user?.role === 'COLLEGE_MONITOR';
  const canCreate = user?.role === 'OWNER' || user?.role === 'DEPARTMENT_MONITOR' || user?.role === 'COLLEGE_MONITOR';

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (filterStatus !== 'all') params.status = filterStatus;
      if (user?.role === 'COLLEGE_MONITOR' || user?.role === 'COLLEGE_DEAN') {
        if (user.assignedCollegeId) params.collegeId = user.assignedCollegeId;
      }
      if (user?.role === 'DEPARTMENT_MONITOR') {
        if (user.assignedDepartmentId) params.departmentId = user.assignedDepartmentId;
      }
      const data = await api.getChangeRequests(params);
      setRequests(data);
    } catch (e: any) {
      setError(e.message || 'فشل تحميل الطلبات');
    } finally {
      setLoading(false);
    }
  }, [filterStatus, user]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const handleReview = async () => {
    if (!reviewingId) return;
    setSubmitting(true);
    try {
      await api.reviewChangeRequest(reviewingId, reviewAction, reviewNotes);
      setReviewingId(null);
      setReviewNotes('');
      await loadRequests();
    } catch (e: any) {
      setError(e.message || 'فشل تنفيذ العملية');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <GitPullRequest className="w-6 h-6 text-emerald-600" />
            طلبات تغيير المحاضرات
          </h1>
          <p className="text-sm text-slate-500 mt-1">إدارة ومراجعة طلبات تغيير المحاضرات</p>
        </div>
        {canCreate && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            طلب تغيير جديد
          </button>
        )}
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-rose-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          {error}
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        {[
          { key: 'all', label: 'الكل' },
          { key: 'pending', label: 'بانتظار المراجعة' },
          { key: 'approved', label: 'موافق عليها' },
          { key: 'rejected', label: 'مرفوضة' },
          { key: 'returned', label: 'أُعيدت لاستكمال' },
          { key: 'applied', label: 'تم تطبيقها' },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilterStatus(f.key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filterStatus === f.key
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
        </div>
      ) : requests.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <GitPullRequest className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>لا توجد طلبات تغيير</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => (
            <div
              key={req.id}
              className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLORS[req.status] || 'bg-slate-100 text-slate-600'}`}>
                      {STATUS_LABELS[req.status] || req.status}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                      {CHANGE_TYPE_LABELS[req.changeType] || req.changeType}
                    </span>
                  </div>
                  <p className="text-sm text-slate-700 font-medium mb-1">{req.reasonDescription}</p>
                  <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
                    <span className="flex items-center gap-1">
                      <User className="w-3.5 h-3.5" />
                      {req.requestedByName || 'غير محدد'}
                    </span>
                    {req.originalDay && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {req.originalDay}
                      </span>
                    )}
                    {req.originalStartTime && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {req.originalStartTime} - {req.originalEndTime}
                      </span>
                    )}
                    {req.reviewedByName && (
                      <span className="text-slate-400">مراجع: {req.reviewedByName}</span>
                    )}
                  </div>
                  {req.reviewNotes && (
                    <p className="text-xs text-slate-500 mt-2 bg-slate-50 rounded-lg p-2">
                      ملاحظات المراجعة: {req.reviewNotes}
                    </p>
                  )}
                </div>
                {canReview && req.status === 'pending' && (
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => { setReviewingId(req.id); setReviewAction('approve'); setReviewNotes(''); }}
                      className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                      title="موافقة"
                    >
                      <CheckCircle className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => { setReviewingId(req.id); setReviewAction('reject'); setReviewNotes(''); }}
                      className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      title="رفض"
                    >
                      <XCircle className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => { setReviewingId(req.id); setReviewAction('return'); setReviewNotes(''); }}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="إعادة لاستكمال"
                    >
                      <RotateCcw className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Review Modal */}
      {reviewingId && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setReviewingId(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-slate-800 mb-4">
              {reviewAction === 'approve' ? 'الموافقة على الطلب' : reviewAction === 'reject' ? 'رفض الطلب' : 'إعادة الطلب لاستكمال المعلومات'}
            </h2>
            <textarea
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              placeholder={reviewAction === 'reject' ? 'سبب الرفض...' : 'ملاحظات...'}
              className="w-full border border-slate-300 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 mb-4"
              rows={3}
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setReviewingId(null)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-sm font-medium transition-colors"
              >
                إلغاء
              </button>
              <button
                onClick={handleReview}
                disabled={submitting}
                className={`px-4 py-2 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50 ${
                  reviewAction === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700' :
                  reviewAction === 'reject' ? 'bg-rose-600 hover:bg-rose-700' :
                  'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'تأكيد'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Modal placeholder - will be expanded with schedule selection */}
      {showCreateModal && (
        <CreateChangeRequestModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => { setShowCreateModal(false); loadRequests(); }}
        />
      )}
    </div>
  );
};

const CreateChangeRequestModal: React.FC<{ onClose: () => void; onCreated: () => void }> = ({ onClose, onCreated }) => {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState<any[]>([]);
  const [scheduleId, setScheduleId] = useState('');
  const [changeType, setChangeType] = useState('room_change');
  const [reasonDescription, setReasonDescription] = useState('');
  const [newRoomId, setNewRoomId] = useState('');
  const [newDay, setNewDay] = useState('');
  const [newStartTime, setNewStartTime] = useState('');
  const [newEndTime, setNewEndTime] = useState('');
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const params: Record<string, string> = {};
        if (user?.role === 'DEPARTMENT_MONITOR' && user.assignedDepartmentId) {
          params.departmentId = user.assignedDepartmentId;
        }
        const [schedData, roomData] = await Promise.all([
          api.getSchedules(params),
          api.getRooms(),
        ]);
        setSchedules(schedData);
        setRooms(roomData);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const handleSubmit = async () => {
    if (!scheduleId || !reasonDescription.trim()) {
      setError('يجب اختيار محاضرة وكتابة سبب التغيير');
      return;
    }
    const sched = schedules.find((s) => s.id === scheduleId);
    if (!sched) return;

    setSubmitting(true);
    setError(null);
    try {
      await api.createChangeRequest({
        scheduleId,
        collegeId: sched.collegeId,
        departmentId: sched.departmentId,
        stageId: sched.stageId,
        subjectId: sched.subjectId,
        facultyId: sched.facultyId,
        originalDay: sched.day,
        originalStartTime: sched.startTime,
        originalEndTime: sched.endTime,
        originalRoomId: sched.roomId,
        originalLectureType: sched.lectureType,
        originalFacultyId: sched.facultyId,
        changeType,
        reasonType: changeType,
        reasonDescription: reasonDescription.trim(),
        newRoomId: newRoomId || undefined,
        newDay: newDay || undefined,
        newStartTime: newStartTime || undefined,
        newEndTime: newEndTime || undefined,
        newLectureType: changeType === 'to_online' ? 'online' : undefined,
      });
      onCreated();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-slate-800 mb-4">طلب تغيير محاضرة جديد</h2>

        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-rose-700 text-sm mb-4 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 text-emerald-600 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">المحاضرة</label>
              <select
                value={scheduleId}
                onChange={(e) => setScheduleId(e.target.value)}
                className="w-full border border-slate-300 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">اختر محاضرة...</option>
                {schedules.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.day} {s.startTime}-{s.endTime} | {s.subjectId || 'مادة'} | {s.facultyId || 'تدريسي'}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">نوع التغيير</label>
              <select
                value={changeType}
                onChange={(e) => setChangeType(e.target.value)}
                className="w-full border border-slate-300 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {Object.entries(REASON_TYPE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">سبب التغيير (تفصيل)</label>
              <textarea
                value={reasonDescription}
                onChange={(e) => setReasonDescription(e.target.value)}
                className="w-full border border-slate-300 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                rows={2}
                placeholder="اكتب سبب طلب التغيير..."
              />
            </div>

            {changeType === 'room_change' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">القاعة البديلة</label>
                <select
                  value={newRoomId}
                  onChange={(e) => setNewRoomId(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">اختر قاعة...</option>
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>{r.nameAr} ({r.code})</option>
                  ))}
                </select>
              </div>
            )}

            {(changeType === 'time_change' || changeType === 'postpone') && (
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">اليوم الجديد</label>
                  <input
                    type="text"
                    value={newDay}
                    onChange={(e) => setNewDay(e.target.value)}
                    placeholder="الأحد"
                    className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">من</label>
                  <input
                    type="time"
                    value={newStartTime}
                    onChange={(e) => setNewStartTime(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">إلى</label>
                  <input
                    type="time"
                    value={newEndTime}
                    onChange={(e) => setNewEndTime(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
            )}

            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={onClose}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-sm font-medium transition-colors"
              >
                إلغاء
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || !scheduleId || !reasonDescription.trim()}
                className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                تقديم الطلب
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
