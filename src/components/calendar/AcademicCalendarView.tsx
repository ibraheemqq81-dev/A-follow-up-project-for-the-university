import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api.ts';
import type { AcademicCalendarEvent } from '../../types/index.ts';
import {
  CalendarDays,
  Plus,
  Trash2,
  Loader2,
  AlertCircle,
  GraduationCap,
  Building,
  Layers,
  Globe,
} from 'lucide-react';

const EVENT_TYPE_LABELS: Record<string, string> = {
  term_start: 'بدء الدوام',
  term_end: 'نهاية الدوام',
  holiday: 'عطلة رسمية',
  exam_period: 'فترة امتحانات',
  break: 'عطلة',
  training: 'فترة تدريب',
  no_lecture_day: 'يوم بلا محاضرات',
  exception: 'استثناء',
};

const EVENT_TYPE_COLORS: Record<string, string> = {
  term_start: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  term_end: 'bg-slate-100 text-slate-800 border-slate-200',
  holiday: 'bg-rose-100 text-rose-800 border-rose-200',
  exam_period: 'bg-amber-100 text-amber-800 border-amber-200',
  break: 'bg-blue-100 text-blue-800 border-blue-200',
  training: 'bg-teal-100 text-teal-800 border-teal-200',
  no_lecture_day: 'bg-slate-100 text-slate-600 border-slate-200',
  exception: 'bg-purple-100 text-purple-800 border-purple-200',
};

const SCOPE_LABELS: Record<string, string> = {
  university: 'جامعة',
  college: 'كلية',
  department: 'قسم',
  stage: 'مرحلة',
};

export const AcademicCalendarView: React.FC = () => {
  const [events, setEvents] = useState<AcademicCalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getCalendarEvents();
      setEvents(data);
    } catch (e: any) {
      setError(e.message || 'فشل تحميل التقويم');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا الحدث؟')) return;
    try {
      await api.deleteCalendarEvent(id);
      await loadEvents();
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-emerald-600" />
            التقويم الدراسي
          </h1>
          <p className="text-sm text-slate-500 mt-1">إدارة التقويم الدراسي: مواعيد الدوام، العطل، الامتحانات، الاستثناءات</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          إضافة حدث
        </button>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-rose-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <CalendarDays className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>لا توجد أحداث في التقويم</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-right p-3 font-medium text-slate-600">الحدث</th>
                <th className="text-right p-3 font-medium text-slate-600">النوع</th>
                <th className="text-right p-3 font-medium text-slate-600">النطاق</th>
                <th className="text-right p-3 font-medium text-slate-600">من</th>
                <th className="text-right p-3 font-medium text-slate-600">إلى</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {events.map((ev) => (
                <tr key={ev.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-3">
                    <div className="font-medium text-slate-800">{ev.title}</div>
                    {ev.description && <div className="text-xs text-slate-500 mt-0.5">{ev.description}</div>}
                  </td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${EVENT_TYPE_COLORS[ev.eventType] || 'bg-slate-100'}`}>
                      {EVENT_TYPE_LABELS[ev.eventType] || ev.eventType}
                    </span>
                  </td>
                  <td className="p-3 text-slate-600">{SCOPE_LABELS[ev.scopeType] || ev.scopeType}</td>
                  <td className="p-3 text-slate-600">{ev.startDate}</td>
                  <td className="p-3 text-slate-600">{ev.endDate}</td>
                  <td className="p-3">
                    <button
                      onClick={() => handleDelete(ev.id)}
                      className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                      title="حذف"
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

      {showModal && (
        <CreateEventModal onClose={() => setShowModal(false)} onCreated={() => { setShowModal(false); loadEvents(); }} />
      )}
    </div>
  );
};

const CreateEventModal: React.FC<{ onClose: () => void; onCreated: () => void }> = ({ onClose, onCreated }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventType, setEventType] = useState('term_start');
  const [scopeType, setScopeType] = useState('university');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!title.trim() || !startDate || !endDate) {
      setError('يجب ملء جميع الحقول المطلوبة');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.createCalendarEvent({
        title: title.trim(),
        description: description.trim() || undefined,
        eventType,
        scopeType,
        startDate,
        endDate,
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
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-slate-800 mb-4">إضافة حدث تقويمي</h2>

        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-rose-700 text-sm mb-4 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">عنوان الحدث</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border border-slate-300 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="مثال: بدء دوام المرحلة الأولى"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">الوصف</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full border border-slate-300 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="وصف مختصر (اختياري)"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">نوع الحدث</label>
              <select
                value={eventType}
                onChange={(e) => setEventType(e.target.value)}
                className="w-full border border-slate-300 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {Object.entries(EVENT_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">النطاق</label>
              <select
                value={scopeType}
                onChange={(e) => setScopeType(e.target.value)}
                className="w-full border border-slate-300 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {Object.entries(SCOPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">تاريخ البداية</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full border border-slate-300 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">تاريخ النهاية</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full border border-slate-300 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-sm font-medium transition-colors"
            >
              إلغاء
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              إضافة
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
