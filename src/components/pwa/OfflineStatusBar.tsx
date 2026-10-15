import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi, RefreshCw, AlertCircle } from 'lucide-react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus.ts';

interface OfflineStatusBarProps {
  onSyncRequest?: () => void;
}

export const OfflineStatusBar: React.FC<OfflineStatusBarProps> = ({ onSyncRequest }) => {
  const isOnline = useOnlineStatus();
  const [offlineQueueCount, setOfflineQueueCount] = useState<number>(0);
  const [showRestoredNotice, setShowRestoredNotice] = useState<boolean>(false);
  const [prevOnline, setPrevOnline] = useState<boolean>(true);

  // Check offline queue size periodically and on changes
  useEffect(() => {
    const updateCount = () => {
      try {
        const queueStr = localStorage.getItem('uomus_offline_attendance_queue');
        if (queueStr) {
          const list = JSON.parse(queueStr);
          setOfflineQueueCount(Array.isArray(list) ? list.length : 0);
        } else {
          setOfflineQueueCount(0);
        }
      } catch {
        setOfflineQueueCount(0);
      }
    };

    updateCount();
    const interval = setInterval(updateCount, 3000);
    return () => clearInterval(interval);
  }, []);

  // Show "Connection Restored" temporary notice when going from offline to online
  useEffect(() => {
    if (!prevOnline && isOnline) {
      setShowRestoredNotice(true);
      const timer = setTimeout(() => setShowRestoredNotice(false), 5000);
      return () => clearTimeout(timer);
    }
    setPrevOnline(isOnline);
  }, [isOnline, prevOnline]);

  if (isOnline && !showRestoredNotice && offlineQueueCount === 0) {
    return null;
  }

  // Notice when connection is restored
  if (isOnline && showRestoredNotice) {
    return (
      <aside aria-label="حالة استعادة الاتصال" className="bg-emerald-600 text-white px-4 py-2 text-xs sm:text-sm font-semibold shadow-md flex items-center justify-between gap-3 animate-in slide-in-from-top" dir="rtl">
        <div className="flex items-center gap-2 max-w-7xl mx-auto w-full justify-between">
          <div className="flex items-center gap-2">
            <Wifi className="w-4 h-4 text-emerald-200 animate-pulse shrink-0" />
            <span>تم استعادة الاتصال بالإنترنت بنجاح. النظام متصل الآن بسيرفر الجامعة.</span>
          </div>
          {offlineQueueCount > 0 && onSyncRequest && (
            <button
              type="button"
              onClick={onSyncRequest}
              className="px-3 py-1 bg-white text-emerald-800 rounded-lg text-xs font-bold hover:bg-emerald-50 transition-colors flex items-center gap-1.5 shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>مزامنة ({offlineQueueCount}) سجلات معلقة</span>
            </button>
          )}
        </div>
      </aside>
    );
  }

  // Offline banner
  return (
    <aside aria-label="حالة عدم الاتصال" className="bg-amber-600 text-white px-4 py-2.5 text-xs sm:text-sm font-semibold shadow-md animate-in slide-in-from-top" dir="rtl">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <WifiOff className="w-4 h-4 text-amber-200 shrink-0 animate-bounce" />
          <span>
            <strong>وضع عدم الاتصال (Offline):</strong> أنت تعمل محلياً. يتم عرض البيانات المتاحة بالذاكرة المؤقتة. العمليات الإدارية الحساسة تتطلب اتصالاً نشطاً.
          </span>
        </div>

        {offlineQueueCount > 0 && (
          <div className="flex items-center gap-2 bg-amber-700/80 px-2.5 py-1 rounded-lg border border-amber-500/50 text-xs">
            <AlertCircle className="w-3.5 h-3.5 text-amber-200" />
            <span>
              {offlineQueueCount} {offlineQueueCount === 1 ? 'سجل حضور محفوظ محلياً بانتظار المزامنة' : 'سجلات حضور محفوظة محلياً بانتظار المزامنة'}
            </span>
          </div>
        )}
      </div>
    </aside>
  );
};
