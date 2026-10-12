import React from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import {
  LayoutDashboard,
  CalendarCheck,
  Radio,
  Calendar,
  GraduationCap,
  DoorOpen,
  Layers,
  BookOpen,
  Users,
  UserCheck,
  FileText,
  Settings,
} from 'lucide-react';

export type ActiveTab =
  | 'dashboard'
  | 'attendance'
  | 'monitoring'
  | 'schedules'
  | 'colleges'
  | 'rooms'
  | 'stages'
  | 'subjects'
  | 'faculty'
  | 'users'
  | 'reports'
  | 'settings';

interface SidebarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  isOpen,
  onClose,
}) => {
  const { user } = useAuth();
  const role = user?.role || 'OWNER';

  const navItems: Array<{
    id: ActiveTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    roles: string[];
    category?: string;
  }> = [
    { id: 'dashboard', label: 'لوحة المؤشرات', icon: LayoutDashboard, roles: ['OWNER', 'COLLEGE_MONITOR', 'DEPARTMENT_MONITOR', 'FACULTY'], category: 'الرئيسية' },
    { id: 'attendance', label: 'تسجيل الحضور والمحاضرات', icon: CalendarCheck, roles: ['OWNER', 'COLLEGE_MONITOR', 'DEPARTMENT_MONITOR', 'FACULTY'], category: 'العمليات والمتابعة' },
    { id: 'monitoring', label: 'المتابعة الحية المباشرة', icon: Radio, roles: ['OWNER', 'COLLEGE_MONITOR', 'DEPARTMENT_MONITOR'], category: 'العمليات والمتابعة' },
    { id: 'schedules', label: 'الجداول الدراسية الأسبوعية', icon: Calendar, roles: ['OWNER', 'COLLEGE_MONITOR', 'DEPARTMENT_MONITOR', 'FACULTY'], category: 'العمليات والمتابعة' },
    { id: 'colleges', label: 'الكليات والأقسام', icon: GraduationCap, roles: ['OWNER', 'COLLEGE_MONITOR'], category: 'الهيكل الأكاديمي' },
    { id: 'rooms', label: 'المباني والقاعات الدراسية', icon: DoorOpen, roles: ['OWNER', 'COLLEGE_MONITOR', 'DEPARTMENT_MONITOR'], category: 'الهيكل الأكاديمي' },
    { id: 'stages', label: 'المراحل والشعب', icon: Layers, roles: ['OWNER', 'COLLEGE_MONITOR', 'DEPARTMENT_MONITOR'], category: 'الهيكل الأكاديمي' },
    { id: 'subjects', label: 'المواد والمناهج الدراسية', icon: BookOpen, roles: ['OWNER', 'COLLEGE_MONITOR', 'DEPARTMENT_MONITOR'], category: 'الهيكل الأكاديمي' },
    { id: 'faculty', label: 'إدارة التدريسيين والأنصبة', icon: Users, roles: ['OWNER', 'COLLEGE_MONITOR', 'DEPARTMENT_MONITOR'], category: 'الكادر الأكاديمي' },
    { id: 'users', label: 'إدارة الحسابات والصلاحيات', icon: UserCheck, roles: ['OWNER', 'COLLEGE_MONITOR'], category: 'النظام والإدارة' },
    { id: 'reports', label: 'التقارير والموقف اليومي', icon: FileText, roles: ['OWNER', 'COLLEGE_MONITOR', 'DEPARTMENT_MONITOR', 'FACULTY'], category: 'النظام والإدارة' },
    { id: 'settings', label: 'إعدادات النظام والنسخ الاحتياطي', icon: Settings, roles: ['OWNER'], category: 'النظام والإدارة' },
  ];

  const allowedItems = navItems.filter((item) => item.roles.includes(role));

  const categories = Array.from(new Set(allowedItems.map((item) => item.category || 'عام')));

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed top-16 bottom-0 right-0 z-40 w-64 bg-white border-l border-slate-200 flex flex-col transition-transform duration-200 lg:static lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {categories.map((cat) => (
            <div key={cat} className="space-y-1">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 px-3 mb-2">
                {cat}
              </h3>
              <div className="space-y-1">
                {allowedItems
                  .filter((item) => item.category === cat)
                  .map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          onSelectTab(item.id);
                          if (onClose) onClose();
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                          isActive
                            ? 'bg-emerald-50 text-emerald-800 font-semibold'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                        }`}
                      >
                        <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-emerald-600' : 'text-slate-400'}`} />
                        <span className="truncate">{item.label}</span>
                      </button>
                    );
                  })}
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50/50 text-center">
          <div className="text-xs text-slate-400">
            جامعة المستقبل — الإصدار 1.0.0
          </div>
        </div>
      </aside>
    </>
  );
};
