import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { Navbar } from './components/layout/Navbar.tsx';
import { Sidebar, ActiveTab } from './components/layout/Sidebar.tsx';
import { LoginModal } from './components/auth/LoginModal.tsx';
import { Dashboard } from './components/dashboard/Dashboard.tsx';
import { AttendanceRecording } from './components/attendance/AttendanceRecording.tsx';
import { LiveMonitoring } from './components/attendance/LiveMonitoring.tsx';
import { ScheduleManagement } from './components/schedules/ScheduleManagement.tsx';
import { CollegeDepartmentView } from './components/academic/CollegeDepartmentView.tsx';
import { BuildingRoomView } from './components/academic/BuildingRoomView.tsx';
import { StageSectionView } from './components/academic/StageSectionView.tsx';
import { SubjectManagement } from './components/academic/SubjectManagement.tsx';
import { FacultyManagement } from './components/faculty/FacultyManagement.tsx';
import { UserManagement } from './components/users/UserManagement.tsx';
import { OfficialReports } from './components/reports/OfficialReports.tsx';
import { SystemSettings } from './components/settings/SystemSettings.tsx';

const MainLayout: React.FC = () => {
  const { user, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4" />
        <h2 className="text-lg font-bold">جامعة المستقبل</h2>
        <p className="text-xs text-slate-400 mt-1">جاري تحميل نظام المتابعة الأكاديمي...</p>
      </div>
    );
  }

  if (!user) {
    return <LoginModal />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard onNavigate={setActiveTab} />;
      case 'attendance':
        return <AttendanceRecording />;
      case 'monitoring':
        return <LiveMonitoring />;
      case 'schedules':
        return <ScheduleManagement />;
      case 'colleges':
        return <CollegeDepartmentView />;
      case 'rooms':
        return <BuildingRoomView />;
      case 'stages':
        return <StageSectionView />;
      case 'subjects':
        return <SubjectManagement />;
      case 'faculty':
        return <FacultyManagement />;
      case 'users':
        return <UserManagement />;
      case 'reports':
        return <OfficialReports />;
      case 'settings':
        return <SystemSettings />;
      default:
        return <Dashboard onNavigate={setActiveTab} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col" dir="rtl">
      <Navbar onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">{renderContent()}</div>
        </main>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <MainLayout />
    </AuthProvider>
  );
}
