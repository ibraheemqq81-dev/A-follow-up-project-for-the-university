import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import type { DeanUpdate } from '../../types/index.ts';
import {
  Bell,
  Loader2,
  AlertCircle,
  CheckCircle,
  XCircle,
  GitPullRequest,
  Calendar,
  Users,
} from 'lucide-react';

const UPDATE_TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  new_change_request: GitPullRequest,
  change_request_approved: CheckCircle,
  change_request_rejected: XCircle,
  change_request_returned: GitPullRequest,
  general: Bell,
};

const UPDATE_TYPE_LABELS: Record<string, string> = {
  new_change_request: 'طلب تغيير جديد',
  change_request_approved: 'موافقة على طلب تغيير',
  change_request_rejected: 'رفض طلب تغيير',
  change_request_returned: 'إعادة طلب تغيير',
  general: 'إشعار عام',
};

export const DeanUpdatesView: React.FC = () => {
  const { user } = useAuth();
  const [updates, setUpdates] = useState<DeanUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadUpdates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (!user?.assignedCollegeId) {
        setError('لا توجد كلية مرتبطة بحسابك');
        return;
      }
      const data = await api.getDeanUpdates(user.assignedCollegeId);
      setUpdates(data);
    } catch (e: any) {
      setError(e.message || 'فشل تحميل المستجدات');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { loadUpdates(); }, [loadUpdates]);

  const handleMarkRead = async (id: string) => {
    try {
      await api.markDeanUpdateRead(id);
      setUpdates((prev) => prev.map((u) => u.id === id ? { ...u, isRead: true } : u));
    } catch (e: any) {
      setError(e.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Bell className="w-6 h-6 text-emerald-600" />
          مستجدات الكلية
        </h1>
        <p className="text-sm text-slate-500 mt-1">آخر المستجدات والعمليات في كليتك</p>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-rose-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          {error}
        </div>
      )}

      {updates.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <Bell className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>لا توجد مستجدات حالياً</p>
        </div>
      ) : (
        <div className="space-y-3">
          {updates.map((update) => {
            const Icon = UPDATE_TYPE_ICONS[update.updateType] || Bell;
            return (
              <div
                key={update.id}
                className={`bg-white rounded-xl border p-4 transition-shadow hover:shadow-md ${
                  update.isRead ? 'border-slate-200' : 'border-emerald-200 bg-emerald-50/30'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${
                    update.isRead ? 'bg-slate-100 text-slate-400' : 'bg-emerald-100 text-emerald-600'
                  }`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-slate-800">{update.title}</span>
                      {!update.isRead && (
                        <span className="w-2 h-2 bg-emerald-500 rounded-full" />
                      )}
                    </div>
                    {update.description && (
                      <p className="text-sm text-slate-600 mb-2">{update.description}</p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-slate-400">
                      <span>{UPDATE_TYPE_LABELS[update.updateType] || update.updateType}</span>
                      {update.createdByName && <span>بواسطة: {update.createdByName}</span>}
                      {update.createdAt && (
                        <span>{new Date(update.createdAt).toLocaleString('ar-IQ')}</span>
                      )}
                    </div>
                  </div>
                  {!update.isRead && (
                    <button
                      onClick={() => handleMarkRead(update.id)}
                      className="shrink-0 text-xs text-slate-500 hover:text-slate-700 px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors"
                    >
                      تحديد كمقروء
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
