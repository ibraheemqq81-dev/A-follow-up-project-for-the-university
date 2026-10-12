import React from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { LogOut, User as UserIcon, Shield, Building2, Bell } from 'lucide-react';

interface NavbarProps {
  onToggleSidebar?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onToggleSidebar }) => {
  const { user, logout } = useAuth();

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'OWNER':
        return <span className="bg-emerald-100 text-emerald-800 text-xs px-2.5 py-0.5 rounded-full font-medium">مالك الجامعة</span>;
      case 'COLLEGE_MONITOR':
        return <span className="bg-blue-100 text-blue-800 text-xs px-2.5 py-0.5 rounded-full font-medium">مسؤول الكلية</span>;
      case 'DEPARTMENT_MONITOR':
        return <span className="bg-purple-100 text-purple-800 text-xs px-2.5 py-0.5 rounded-full font-medium">مسؤول القسم</span>;
      case 'FACULTY':
        return <span className="bg-amber-100 text-amber-800 text-xs px-2.5 py-0.5 rounded-full font-medium">تدريسي</span>;
      default:
        return null;
    }
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center gap-3">
            <button
              onClick={onToggleSidebar}
              className="lg:hidden p-2 rounded-md text-slate-500 hover:text-slate-700 hover:bg-slate-100 focus:outline-hidden"
              aria-label="القائمة الرئيسية"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-xs">
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <h1 className="font-bold text-slate-900 text-lg sm:text-xl leading-tight">
                  جامعة المستقبل
                </h1>
                <p className="text-xs text-slate-500">
                  نظام متابعة حضور التدريسيين والمحاضرات الأكاديمية
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex flex-col text-left items-end">
                  <span className="text-sm font-semibold text-slate-800">{user.name}</span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {getRoleBadge(user.role)}
                    <span className="text-xs text-slate-400">{user.email}</span>
                  </div>
                </div>
                <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 font-semibold">
                  {user.avatar ? (
                    <img src={user.avatar} alt={user.name} className="w-full h-full rounded-full object-cover" />
                  ) : (
                    <UserIcon className="w-5 h-5 text-slate-500" />
                  )}
                </div>
                <button
                  onClick={logout}
                  title="تسجيل الخروج"
                  className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
};
