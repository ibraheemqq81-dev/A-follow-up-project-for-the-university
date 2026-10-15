import React from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { ActiveTab } from './Sidebar.tsx';
import {
  CalendarCheck,
  Calendar,
  LayoutDashboard,
  Radio,
  Menu,
  FileText,
} from 'lucide-react';

interface MobileBottomBarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  onToggleSidebar: () => void;
}

export const MobileBottomBar: React.FC<MobileBottomBarProps> = ({
  activeTab,
  onSelectTab,
  onToggleSidebar,
}) => {
  const { user } = useAuth();
  if (!user) return null;

  const role = user.role || 'FACULTY';
  const isFaculty = role === 'FACULTY';

  return (
    <nav
      aria-label="شريط التنقل السفلي للهاتف"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 shadow-lg px-2 py-1.5 transition-colors pb-[max(0.375rem,env(safe-area-inset-bottom))]"
      dir="rtl"
    >
      <div className="flex items-center justify-around max-w-md mx-auto">
        {/* Attendance Portal */}
        <button
          type="button"
          onClick={() => onSelectTab('attendance')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all cursor-pointer ${
            activeTab === 'attendance'
              ? 'text-emerald-600 dark:text-emerald-400 font-bold scale-105'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
          }`}
        >
          <div className={`p-1 rounded-lg ${activeTab === 'attendance' ? 'bg-emerald-50 dark:bg-emerald-950/60' : ''}`}>
            <CalendarCheck className="w-5 h-5" />
          </div>
          <span className="text-[10px] mt-0.5">الحضور</span>
        </button>

        {/* Weekly Schedule */}
        <button
          type="button"
          onClick={() => onSelectTab('schedules')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all cursor-pointer ${
            activeTab === 'schedules'
              ? 'text-emerald-600 dark:text-emerald-400 font-bold scale-105'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
          }`}
        >
          <div className={`p-1 rounded-lg ${activeTab === 'schedules' ? 'bg-emerald-50 dark:bg-emerald-950/60' : ''}`}>
            <Calendar className="w-5 h-5" />
          </div>
          <span className="text-[10px] mt-0.5">الجدول</span>
        </button>

        {/* Dashboard / Monitoring for Monitors or Reports for Faculty */}
        {!isFaculty ? (
          <button
            type="button"
            onClick={() => onSelectTab('dashboard')}
            className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all cursor-pointer ${
              activeTab === 'dashboard'
                ? 'text-emerald-600 dark:text-emerald-400 font-bold scale-105'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
            }`}
          >
            <div className={`p-1 rounded-lg ${activeTab === 'dashboard' ? 'bg-emerald-50 dark:bg-emerald-950/60' : ''}`}>
              <LayoutDashboard className="w-5 h-5" />
            </div>
            <span className="text-[10px] mt-0.5">المؤشرات</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onSelectTab('changeRequests')}
            className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all cursor-pointer ${
              activeTab === 'changeRequests'
                ? 'text-emerald-600 dark:text-emerald-400 font-bold scale-105'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
            }`}
          >
            <div className={`p-1 rounded-lg ${activeTab === 'changeRequests' ? 'bg-emerald-50 dark:bg-emerald-950/60' : ''}`}>
              <FileText className="w-5 h-5" />
            </div>
            <span className="text-[10px] mt-0.5">الطلبات</span>
          </button>
        )}

        {/* Live Monitoring (for monitors/owners) */}
        {!isFaculty && (
          <button
            type="button"
            onClick={() => onSelectTab('monitoring')}
            className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all cursor-pointer ${
              activeTab === 'monitoring'
                ? 'text-emerald-600 dark:text-emerald-400 font-bold scale-105'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
            }`}
          >
            <div className={`p-1 rounded-lg ${activeTab === 'monitoring' ? 'bg-emerald-50 dark:bg-emerald-950/60' : ''}`}>
              <Radio className="w-5 h-5" />
            </div>
            <span className="text-[10px] mt-0.5">المتابعة الحية</span>
          </button>
        )}

        {/* More / Menu Drawer Toggle */}
        <button
          type="button"
          onClick={onToggleSidebar}
          className="flex flex-col items-center justify-center py-1 px-3 rounded-xl text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all cursor-pointer"
        >
          <div className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
            <Menu className="w-5 h-5" />
          </div>
          <span className="text-[10px] mt-0.5">القائمة</span>
        </button>
      </div>
    </nav>
  );
};
