import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '../../services/api.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import {
  Wrench,
  Cpu,
  Plus,
  Search,
  Filter,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Laptop,
  Tv,
  Wind,
  Server,
  Activity,
  Layers,
  Building2,
  DoorOpen,
  Send,
  Check,
  X,
  FileText,
  AlertCircle,
  ShieldAlert,
  Loader2,
  Trash2,
  Edit2,
  RefreshCw,
} from 'lucide-react';

interface EquipmentItem {
  id: string;
  collegeId?: string;
  college_id?: string;
  departmentId?: string;
  department_id?: string;
  roomId?: string;
  room_id?: string;
  buildingId?: string;
  building_id?: string;
  code?: string;
  nameAr?: string;
  name_ar?: string;
  nameEn?: string;
  name_en?: string;
  type: string;
  status: string;
  serialNumber?: string;
  serial_number?: string;
  specifications?: string;
  purchaseDate?: string;
  purchase_date?: string;
  notes?: string;
  createdAt?: string;
  created_at?: string;
}

interface MaintenanceTicket {
  id: string;
  ticketNumber?: string;
  ticket_number?: string;
  equipmentId?: string;
  equipment_id?: string;
  collegeId?: string;
  college_id?: string;
  departmentId?: string;
  department_id?: string;
  roomId?: string;
  room_id?: string;
  buildingId?: string;
  building_id?: string;
  reportedByUserId?: string;
  reported_by_user_id?: string;
  reportedByName?: string;
  reported_by_name?: string;
  title: string;
  description: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'EMERGENCY';
  impactOnLectures?: 'NONE' | 'PARTIAL' | 'CRITICAL_STOPPAGE';
  impact_on_lectures?: 'NONE' | 'PARTIAL' | 'CRITICAL_STOPPAGE';
  status: 'NEW' | 'UNDER_REVIEW' | 'ASSIGNED_MAINTENANCE' | 'IN_PROGRESS' | 'WAITING_PARTS' | 'REPAIRED' | 'CLOSED';
  assignedTeam?: string;
  assigned_team?: string;
  actionTaken?: string;
  action_taken?: string;
  resolutionNotes?: string;
  resolution_notes?: string;
  resolutionDate?: string;
  resolution_date?: string;
  createdAt?: string;
  created_at?: string;
}

const TYPE_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  COMPUTER: { label: 'حاسوب / محطة عمل', icon: Laptop, color: 'text-blue-600 bg-blue-50 border-blue-200' },
  PROJECTOR: { label: 'عارض بيانات (Data Show)', icon: Tv, color: 'text-purple-600 bg-purple-50 border-purple-200' },
  AIR_CONDITIONER: { label: 'تكييف وتبريد', icon: Wind, color: 'text-cyan-600 bg-cyan-50 border-cyan-200' },
  NETWORK: { label: 'شبكات واتصالات', icon: Server, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  SMART_BOARD: { label: 'شاشة ذكية / تفاعلية', icon: Tv, color: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
  LAB_DEVICE: { label: 'أجهزة مختبرية تخصصية', icon: Activity, color: 'text-amber-600 bg-amber-50 border-amber-200' },
  OTHER: { label: 'معدة / تجهيز عام', icon: Cpu, color: 'text-slate-600 bg-slate-50 border-slate-200' },
};

const STATUS_CONFIG: Record<string, { label: string; badge: string; dot: string }> = {
  OPERATIONAL: { label: 'جاهز ويعمل بكفاءة', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  NEEDS_MAINTENANCE: { label: 'يحتاج صيانة', badge: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  UNDER_MAINTENANCE: { label: 'قيد الصيانة والتصليح', badge: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500' },
  OUT_OF_SERVICE: { label: 'خارج الخدمة / معطل', badge: 'bg-rose-50 text-rose-700 border-rose-200', dot: 'bg-rose-500' },
};

const TICKET_STATUS_CONFIG: Record<string, { label: string; badge: string }> = {
  NEW: { label: 'بلاغ جديد', badge: 'bg-slate-100 text-slate-800 border-slate-300' },
  UNDER_REVIEW: { label: 'قيد المراجعة والتدقيق', badge: 'bg-amber-100 text-amber-800 border-amber-200' },
  ASSIGNED_MAINTENANCE: { label: 'أحيل إلى شعبة الصيانة', badge: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
  IN_PROGRESS: { label: 'قيد المعالجة والتصليح', badge: 'bg-blue-100 text-blue-800 border-blue-200' },
  WAITING_PARTS: { label: 'بانتظار قطع غيار', badge: 'bg-orange-100 text-orange-800 border-orange-200' },
  REPAIRED: { label: 'تم الإصلاح بنجاح', badge: 'bg-teal-100 text-teal-800 border-teal-200' },
  CLOSED: { label: 'مغلق وموثق', badge: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
};

const PRIORITY_CONFIG: Record<string, { label: string; badge: string; iconColor: string }> = {
  LOW: { label: 'منخفضة', badge: 'bg-slate-100 text-slate-700 border-slate-200', iconColor: 'text-slate-400' },
  MEDIUM: { label: 'متوسطة', badge: 'bg-blue-100 text-blue-800 border-blue-200', iconColor: 'text-blue-500' },
  HIGH: { label: 'عالية', badge: 'bg-amber-100 text-amber-800 border-amber-200', iconColor: 'text-amber-500' },
  EMERGENCY: { label: 'طارئة وحرجة جداً', badge: 'bg-rose-100 text-rose-800 border-rose-200 animate-pulse', iconColor: 'text-rose-600' },
};

export const EquipmentMaintenanceView: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'equipment' | 'tickets' | 'stats'>('equipment');

  // Data states
  const [equipmentList, setEquipmentList] = useState<EquipmentItem[]>([]);
  const [ticketsList, setTicketsList] = useState<MaintenanceTicket[]>([]);
  const [stats, setStats] = useState<any>({});
  const [colleges, setColleges] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [buildings, setBuildings] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterTicketStatus, setFilterTicketStatus] = useState('ALL');
  const [filterTicketPriority, setFilterTicketPriority] = useState('ALL');
  const [filterCollegeId, setFilterCollegeId] = useState('');
  const [filterDeptId, setFilterDeptId] = useState('');

  // Modals
  const [isAddEquipModalOpen, setIsAddEquipModalOpen] = useState(false);
  const [isNewTicketModalOpen, setIsNewTicketModalOpen] = useState(false);
  const [isReviewTicketModalOpen, setIsReviewTicketModalOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<MaintenanceTicket | null>(null);
  const [selectedEquipmentForTicket, setSelectedEquipmentForTicket] = useState<EquipmentItem | null>(null);

  // Form states
  const [equipForm, setEquipForm] = useState({
    code: '',
    nameAr: '',
    nameEn: '',
    type: 'COMPUTER',
    status: 'OPERATIONAL',
    collegeId: '',
    departmentId: '',
    roomId: '',
    buildingId: '',
    serialNumber: '',
    specifications: '',
    purchaseDate: '',
    notes: '',
  });

  const [ticketForm, setTicketForm] = useState({
    equipmentId: '',
    collegeId: '',
    departmentId: '',
    roomId: '',
    title: '',
    description: '',
    priority: 'MEDIUM',
    impactOnLectures: 'NONE',
  });

  const [ticketReviewForm, setTicketReviewForm] = useState({
    status: 'IN_PROGRESS',
    priority: 'MEDIUM',
    assignedTeam: '',
    actionTaken: '',
    resolutionNotes: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [alertMsg, setAlertMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showAlert = (type: 'success' | 'error', text: string) => {
    setAlertMsg({ type, text });
    setTimeout(() => setAlertMsg(null), 5000);
  };

  const loadAllData = useCallback(async () => {
    setLoading(true);
    try {
      const [eqRes, tktRes, stRes, colRes, depRes, rmRes, bldRes] = await Promise.allSettled([
        api.getEquipment(),
        api.getMaintenanceTickets(),
        api.getMaintenanceStats(),
        api.getColleges(),
        api.getDepartments(),
        api.getRooms(),
        api.getBuildings(),
      ]);

      if (eqRes.status === 'fulfilled') setEquipmentList(Array.isArray(eqRes.value) ? eqRes.value : []);
      if (tktRes.status === 'fulfilled') setTicketsList(Array.isArray(tktRes.value) ? tktRes.value : []);
      if (stRes.status === 'fulfilled') setStats(stRes.value || {});
      if (colRes.status === 'fulfilled') setColleges(Array.isArray(colRes.value) ? colRes.value : []);
      if (depRes.status === 'fulfilled') setDepartments(Array.isArray(depRes.value) ? depRes.value : []);
      if (rmRes.status === 'fulfilled') setRooms(Array.isArray(rmRes.value) ? rmRes.value : []);
      if (bldRes.status === 'fulfilled') setBuildings(Array.isArray(bldRes.value) ? bldRes.value : []);
    } catch {
      // safe fallback
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Lookup helpers
  const getCollegeName = (id?: string) => (colleges || []).find((c) => c && c.id === id)?.nameAr || 'كلية عامة';
  const getDeptName = (id?: string) => (departments || []).find((d) => d && d.id === id)?.nameAr || 'قسم عام';
  const getRoomName = (id?: string) => (rooms || []).find((r) => r && r.id === id)?.nameAr || 'قاعة / مختبر';

  // Permission helpers
  const canManageEquipment = user?.role === 'OWNER' || user?.role === 'COLLEGE_MONITOR' || user?.role === 'DEPARTMENT_MONITOR';
  const canReviewTicket = user?.role === 'OWNER' || user?.role === 'COLLEGE_MONITOR' || user?.role === 'DEPARTMENT_MONITOR';

  // Filtered Equipment
  const filteredEquipment = useMemo(() => {
    return (equipmentList || []).filter((eq) => {
      const name = (eq.nameAr || eq.name_ar || '').toLowerCase();
      const code = (eq.code || '').toLowerCase();
      const sn = (eq.serialNumber || eq.serial_number || '').toLowerCase();
      const query = searchQuery.toLowerCase().trim();

      const matchesSearch = !query || name.includes(query) || code.includes(query) || sn.includes(query);
      const matchesType = filterType === 'ALL' || eq.type === filterType;
      const matchesStatus = filterStatus === 'ALL' || eq.status === filterStatus;
      const matchesCollege = !filterCollegeId || (eq.collegeId || eq.college_id) === filterCollegeId;
      const matchesDept = !filterDeptId || (eq.departmentId || eq.department_id) === filterDeptId;

      return matchesSearch && matchesType && matchesStatus && matchesCollege && matchesDept;
    });
  }, [equipmentList, searchQuery, filterType, filterStatus, filterCollegeId, filterDeptId]);

  // Filtered Tickets
  const filteredTickets = useMemo(() => {
    return (ticketsList || []).filter((tkt) => {
      const title = (tkt.title || '').toLowerCase();
      const num = (tkt.ticketNumber || tkt.ticket_number || '').toLowerCase();
      const query = searchQuery.toLowerCase().trim();

      const matchesSearch = !query || title.includes(query) || num.includes(query);
      const matchesStatus = filterTicketStatus === 'ALL' || tkt.status === filterTicketStatus;
      const matchesPriority = filterTicketPriority === 'ALL' || tkt.priority === filterTicketPriority;
      const matchesCollege = !filterCollegeId || (tkt.collegeId || tkt.college_id) === filterCollegeId;

      return matchesSearch && matchesStatus && matchesPriority && matchesCollege;
    });
  }, [ticketsList, searchQuery, filterTicketStatus, filterTicketPriority, filterCollegeId]);

  // Handle Create Equipment
  const handleCreateEquipment = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const colId = equipForm.collegeId || user?.assignedCollegeId || (colleges[0]?.id || '');
      const depId = equipForm.departmentId || user?.assignedDepartmentId || '';
      await api.createEquipment({
        ...equipForm,
        collegeId: colId,
        departmentId: depId || undefined,
      });
      showAlert('success', 'تم تسجيل الجهاز والمعدة بنجاح');
      setIsAddEquipModalOpen(false);
      setEquipForm({
        code: '',
        nameAr: '',
        nameEn: '',
        type: 'COMPUTER',
        status: 'OPERATIONAL',
        collegeId: '',
        departmentId: '',
        roomId: '',
        buildingId: '',
        serialNumber: '',
        specifications: '',
        purchaseDate: '',
        notes: '',
      });
      loadAllData();
    } catch (err: any) {
      showAlert('error', err?.message || 'تعذر إضافة الجهاز');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open New Ticket modal from equipment
  const handleReportForEquipment = (eq: EquipmentItem) => {
    setSelectedEquipmentForTicket(eq);
    const eqName = eq.nameAr || eq.name_ar || 'جهاز';
    setTicketForm({
      equipmentId: eq.id,
      collegeId: eq.collegeId || eq.college_id || '',
      departmentId: eq.departmentId || eq.department_id || '',
      roomId: eq.roomId || eq.room_id || '',
      title: `عطل في: ${eqName} (${eq.code || ''})`,
      description: '',
      priority: 'MEDIUM',
      impactOnLectures: 'NONE',
    });
    setIsNewTicketModalOpen(true);
  };

  // Handle Submit Ticket
  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await api.createMaintenanceTicket(ticketForm);
      showAlert('success', res.message || 'تم إرسال بلاغ الصيانة بنجاح');
      setIsNewTicketModalOpen(false);
      setSelectedEquipmentForTicket(null);
      setTicketForm({
        equipmentId: '',
        collegeId: '',
        departmentId: '',
        roomId: '',
        title: '',
        description: '',
        priority: 'MEDIUM',
        impactOnLectures: 'NONE',
      });
      loadAllData();
    } catch (err: any) {
      showAlert('error', err?.message || 'تعذر إرسال بلاغ الصيانة');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Review Ticket
  const handleOpenReview = (tkt: MaintenanceTicket) => {
    setSelectedTicket(tkt);
    setTicketReviewForm({
      status: tkt.status || 'IN_PROGRESS',
      priority: tkt.priority || 'MEDIUM',
      assignedTeam: tkt.assignedTeam || tkt.assigned_team || '',
      actionTaken: tkt.actionTaken || tkt.action_taken || '',
      resolutionNotes: tkt.resolutionNotes || tkt.resolution_notes || '',
    });
    setIsReviewTicketModalOpen(true);
  };

  const handleUpdateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket) return;

    if (ticketReviewForm.status === 'CLOSED' && (!ticketReviewForm.resolutionNotes || ticketReviewForm.resolutionNotes.trim() === '')) {
      alert('لا يمكن إغلاق البلاغ نهائياً دون تدوين نتيجة الصيانة والإجراء المتخذ');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.updateMaintenanceTicket(selectedTicket.id, ticketReviewForm);
      showAlert('success', 'تم تحديث حالة بلاغ الصيانة بنجاح');
      setIsReviewTicketModalOpen(false);
      setSelectedTicket(null);
      loadAllData();
    } catch (err: any) {
      showAlert('error', err?.message || 'فشل تحديث البلاغ');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Top Banner Alert if any */}
      {alertMsg && (
        <div
          className={`p-4 rounded-xl text-sm font-semibold flex items-center justify-between shadow-sm transition-all ${
            alertMsg.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <span>{alertMsg.text}</span>
          <button onClick={() => setAlertMsg(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header section with university identity */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm">
            <Wrench className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">إدارة التجهيزات والمختبرات وبلاغات الصيانة</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              متابعة جاهزية القاعات الذكية، أجهزة الحاسوب، شبكات المختبرات، ومنظومة الصيانة المركزية
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canManageEquipment && (
            <button
              onClick={() => setIsAddEquipModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              إضافة جهاز / تجهيز جديد
            </button>
          )}
          <button
            onClick={() => {
              setSelectedEquipmentForTicket(null);
              setTicketForm({
                equipmentId: '',
                collegeId: user?.assignedCollegeId || (colleges[0]?.id || ''),
                departmentId: user?.assignedDepartmentId || '',
                roomId: '',
                title: '',
                description: '',
                priority: 'MEDIUM',
                impactOnLectures: 'NONE',
              });
              setIsNewTicketModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
          >
            <AlertTriangle className="w-4 h-4" />
            تسجيل بلاغ صيانة عاجل
          </button>
          <button
            onClick={loadAllData}
            title="تحديث البيانات"
            className="p-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Tabs navigation */}
      <div className="flex border-b border-slate-200 gap-4">
        <button
          onClick={() => setActiveTab('equipment')}
          className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeTab === 'equipment'
              ? 'border-emerald-600 text-emerald-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Cpu className="w-4 h-4" />
          سجل الأجهزة والتجهيزات
          <span className="bg-slate-100 text-slate-700 text-xs px-2 py-0.5 rounded-full font-mono font-bold">
            {equipmentList.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('tickets')}
          className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeTab === 'tickets'
              ? 'border-emerald-600 text-emerald-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Wrench className="w-4 h-4" />
          بلاغات الصيانة والمتابعة
          <span className="bg-amber-100 text-amber-800 text-xs px-2 py-0.5 rounded-full font-mono font-bold">
            {ticketsList.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('stats')}
          className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeTab === 'stats'
              ? 'border-emerald-600 text-emerald-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Activity className="w-4 h-4" />
          المؤشرات والجاهزية الفنية
        </button>
      </div>

      {/* TAB 1: Equipment Registry */}
      {activeTab === 'equipment' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-wrap gap-3 items-center justify-between shadow-xs">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 absolute right-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="بحث باسم الجهاز، الرمز، أو الرقم التسلسلي..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pr-9 pl-4 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white text-slate-700 focus:ring-2 focus:ring-emerald-500"
              >
                <option value="ALL">جميع أنواع التجهيزات</option>
                {Object.entries(TYPE_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white text-slate-700 focus:ring-2 focus:ring-emerald-500"
              >
                <option value="ALL">جميع الحالات التشغيلية</option>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>

              {colleges.length > 1 && (
                <select
                  value={filterCollegeId}
                  onChange={(e) => setFilterCollegeId(e.target.value)}
                  className="px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white text-slate-700 focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">جميع الكليات</option>
                  {colleges.map((c) => (
                    <option key={c.id} value={c.id}>{c.nameAr}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Equipment Cards Grid */}
          {loading ? (
            <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin mb-2 text-emerald-600" />
              <p className="text-xs">جاري تحميل سجل الأجهزة...</p>
            </div>
          ) : filteredEquipment.length === 0 ? (
            <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 text-slate-500">
              <Cpu className="w-12 h-12 mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-bold text-slate-700">لا توجد أجهزة أو تجهيزات مطابقة للبحث</p>
              <p className="text-xs text-slate-400 mt-1">يمكنك إضافة تجهيزات ومعدات جديدة باستخدام زر الإضافة أعلاه</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredEquipment.map((eq) => {
                const typeCfg = TYPE_CONFIG[eq.type] || TYPE_CONFIG.OTHER;
                const statusCfg = STATUS_CONFIG[eq.status] || STATUS_CONFIG.OPERATIONAL;
                const IconComponent = typeCfg.icon;

                return (
                  <div
                    key={eq.id}
                    className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-emerald-300 transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${typeCfg.color}`}>
                            <IconComponent className="w-5 h-5" />
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 font-mono">
                              {eq.code || 'EQ-GENERAL'}
                            </span>
                            <h3 className="text-sm font-bold text-slate-900 leading-tight">
                              {eq.nameAr || eq.name_ar}
                            </h3>
                          </div>
                        </div>

                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusCfg.badge}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
                          {statusCfg.label}
                        </span>
                      </div>

                      <div className="space-y-1.5 text-xs text-slate-600 border-t border-slate-100 pt-3">
                        <div className="flex items-center gap-2 text-slate-500">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          <span>{getCollegeName(eq.collegeId || eq.college_id)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-500">
                          <DoorOpen className="w-3.5 h-3.5 text-slate-400" />
                          <span>{getRoomName(eq.roomId || eq.room_id)} ({getDeptName(eq.departmentId || eq.department_id)})</span>
                        </div>
                        {(eq.serialNumber || eq.serial_number) && (
                          <div className="flex items-center gap-2 text-[11px] font-mono text-slate-500">
                            <span className="text-slate-400">S/N:</span>
                            <span>{eq.serialNumber || eq.serial_number}</span>
                          </div>
                        )}
                        {eq.specifications && (
                          <p className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded-lg mt-2 leading-relaxed">
                            {eq.specifications}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      <button
                        onClick={() => handleReportForEquipment(eq)}
                        className="inline-flex items-center gap-1 text-xs text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 font-bold px-2.5 py-1.5 rounded-lg border border-amber-200 transition-colors cursor-pointer"
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                        إبلاغ عن عطل
                      </button>

                      <span className="text-[10px] text-slate-400">
                        {typeCfg.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Maintenance Tickets */}
      {activeTab === 'tickets' && (
        <div className="space-y-4">
          {/* Tickets Filter */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-wrap gap-3 items-center justify-between shadow-xs">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 absolute right-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="بحث بعنوان البلاغ أو رقم التذكرة..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pr-9 pl-4 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={filterTicketStatus}
                onChange={(e) => setFilterTicketStatus(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white text-slate-700 focus:ring-2 focus:ring-emerald-500"
              >
                <option value="ALL">جميع حالات البلاغ</option>
                {Object.entries(TICKET_STATUS_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>

              <select
                value={filterTicketPriority}
                onChange={(e) => setFilterTicketPriority(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white text-slate-700 focus:ring-2 focus:ring-emerald-500"
              >
                <option value="ALL">جميع مستويات الأولوية</option>
                {Object.entries(PRIORITY_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Tickets List */}
          {loading ? (
            <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin mb-2 text-emerald-600" />
              <p className="text-xs">جاري تحميل بلاغات الصيانة...</p>
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 text-slate-500">
              <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-400 mb-2" />
              <p className="text-sm font-bold text-slate-700">لا توجد بلاغات صيانة مفتوحة حالياً</p>
              <p className="text-xs text-slate-400 mt-1">كافة التجهيزات والقاعات تعمل بصورة جيدة</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredTickets.map((tkt) => {
                const statusCfg = TICKET_STATUS_CONFIG[tkt.status] || TICKET_STATUS_CONFIG.NEW;
                const priorityCfg = PRIORITY_CONFIG[tkt.priority] || PRIORITY_CONFIG.MEDIUM;
                const ticketNum = tkt.ticketNumber || tkt.ticket_number || 'TKT';

                return (
                  <div
                    key={tkt.id}
                    className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-slate-300 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-2 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                          {ticketNum}
                        </span>
                        <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${statusCfg.badge}`}>
                          {statusCfg.label}
                        </span>
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${priorityCfg.badge}`}>
                          أولوية: {priorityCfg.label}
                        </span>
                        {(tkt.impactOnLectures === 'CRITICAL_STOPPAGE' || tkt.impact_on_lectures === 'CRITICAL_STOPPAGE') && (
                          <span className="bg-rose-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-bounce">
                            تعطيل للمحاضرات!
                          </span>
                        )}
                      </div>

                      <h3 className="text-sm font-bold text-slate-900">{tkt.title}</h3>
                      <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        {tkt.description}
                      </p>

                      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-1">
                        <span>المبلّغ: <strong>{tkt.reportedByName || tkt.reported_by_name}</strong></span>
                        <span>الموقع: <strong>{getRoomName(tkt.roomId || tkt.room_id)}</strong> ({getDeptName(tkt.departmentId || tkt.department_id)})</span>
                        {(tkt.assignedTeam || tkt.assigned_team) && (
                          <span>الفريق المكلف: <strong className="text-indigo-600">{tkt.assignedTeam || tkt.assigned_team}</strong></span>
                        )}
                        {(tkt.resolutionNotes || tkt.resolution_notes) && (
                          <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-semibold">
                            النتيجة: {tkt.resolutionNotes || tkt.resolution_notes}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row md:flex-col gap-2 items-end">
                      {canReviewTicket && tkt.status !== 'CLOSED' && (
                        <button
                          onClick={() => handleOpenReview(tkt)}
                          className="w-full sm:w-auto px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
                        >
                          تحديث المعالجة / إغلاق
                        </button>
                      )}
                      <span className="text-[10px] text-slate-400">
                        {tkt.createdAt || tkt.created_at ? new Date(tkt.createdAt || tkt.created_at || '').toLocaleDateString('ar-IQ') : 'اليوم'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Maintenance Readiness & Stats */}
      {activeTab === 'stats' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <div className="text-slate-400 text-xs font-bold mb-1">إجمالي التجهيزات</div>
              <div className="text-2xl font-black text-slate-900">{equipmentList.length}</div>
              <div className="text-[10px] text-slate-400 mt-1">مسجلة في النظام</div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-emerald-200 bg-emerald-50/30 shadow-xs">
              <div className="text-emerald-700 text-xs font-bold mb-1">جاهزة وتعمل</div>
              <div className="text-2xl font-black text-emerald-800">
                {equipmentList.filter((e) => e.status === 'OPERATIONAL').length}
              </div>
              <div className="text-[10px] text-emerald-600 mt-1">كفاءة 100%</div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-amber-200 bg-amber-50/30 shadow-xs">
              <div className="text-amber-700 text-xs font-bold mb-1">بحاجة صيانة</div>
              <div className="text-2xl font-black text-amber-800">
                {equipmentList.filter((e) => e.status === 'NEEDS_MAINTENANCE' || e.status === 'UNDER_MAINTENANCE').length}
              </div>
              <div className="text-[10px] text-amber-600 mt-1">قيد المتابعة</div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-rose-200 bg-rose-50/30 shadow-xs">
              <div className="text-rose-700 text-xs font-bold mb-1">بلاغات مفتوحة</div>
              <div className="text-2xl font-black text-rose-800">
                {ticketsList.filter((t) => t.status !== 'CLOSED' && t.status !== 'REPAIRED').length}
              </div>
              <div className="text-[10px] text-rose-600 mt-1">بانتظار الإنجاز</div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-indigo-200 bg-indigo-50/30 shadow-xs">
              <div className="text-indigo-700 text-xs font-bold mb-1">أولوية عالية / طارئة</div>
              <div className="text-2xl font-black text-indigo-800">
                {ticketsList.filter((t) => (t.priority === 'HIGH' || t.priority === 'EMERGENCY') && t.status !== 'CLOSED').length}
              </div>
              <div className="text-[10px] text-indigo-600 mt-1">تتطلب تدخلاً فورياً</div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-teal-200 bg-teal-50/30 shadow-xs">
              <div className="text-teal-700 text-xs font-bold mb-1">تم إصلاحها ومغلقة</div>
              <div className="text-2xl font-black text-teal-800">
                {ticketsList.filter((t) => t.status === 'CLOSED' || t.status === 'REPAIRED').length}
              </div>
              <div className="text-[10px] text-teal-600 mt-1">موثقة مع النتيجة</div>
            </div>
          </div>

          {/* Critical Warnings Card */}
          {ticketsList.some((t) => t.priority === 'EMERGENCY' && t.status !== 'CLOSED') && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 flex items-center gap-3">
              <ShieldAlert className="w-6 h-6 text-rose-600 shrink-0" />
              <div>
                <h4 className="font-bold text-sm">تنبيه طارئ: توجد بلاغات حرجة قد تعطل المحاضرات العملية!</h4>
                <p className="text-xs text-rose-700 mt-0.5">
                  يرجى التنسيق الفوري مع شعبة الصيانة والخدمات الجامعية لضمان استمرارية العملية التدريسية.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: Add New Equipment */}
      {isAddEquipModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <Plus className="w-5 h-5 text-emerald-600" />
                تسجيل جهاز أو تجهيز جديد في النظام
              </h3>
              <button onClick={() => setIsAddEquipModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateEquipment} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">اسم الجهاز بالعربية *</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: عارض بيانات ليزري 4K"
                    value={equipForm.nameAr}
                    onChange={(e) => setEquipForm({ ...equipForm, nameAr: e.target.value })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">رمز الجهاز (Code)</label>
                  <input
                    type="text"
                    placeholder="مثال: EQ-PRJ-105"
                    value={equipForm.code}
                    onChange={(e) => setEquipForm({ ...equipForm, code: e.target.value })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">نوع التجهيز *</label>
                  <select
                    value={equipForm.type}
                    onChange={(e) => setEquipForm({ ...equipForm, type: e.target.value })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                  >
                    {Object.entries(TYPE_CONFIG).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">الحالة التشغيلية الأولية *</label>
                  <select
                    value={equipForm.status}
                    onChange={(e) => setEquipForm({ ...equipForm, status: e.target.value })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                  >
                    {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">الكلية التابع لها *</label>
                  <select
                    value={equipForm.collegeId || user?.assignedCollegeId || ''}
                    onChange={(e) => setEquipForm({ ...equipForm, collegeId: e.target.value })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                  >
                    {colleges.map((c) => (
                      <option key={c.id} value={c.id}>{c.nameAr}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">القاعة / المختبر المخصص</label>
                  <select
                    value={equipForm.roomId}
                    onChange={(e) => setEquipForm({ ...equipForm, roomId: e.target.value })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">اختر القاعة أو المختبر</option>
                    {rooms.map((r) => (
                      <option key={r.id} value={r.id}>{r.nameAr} ({r.code || ''})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">الرقم التسلسلي (Serial Number)</label>
                <input
                  type="text"
                  placeholder="مثال: SN-EPSON-499210"
                  value={equipForm.serialNumber}
                  onChange={(e) => setEquipForm({ ...equipForm, serialNumber: e.target.value })}
                  className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">المواصفات الفنية والملاحظات</label>
                <textarea
                  rows={2}
                  placeholder="المعالج، المنافذ، سعة التبريد، شروط التشغيل..."
                  value={equipForm.specifications}
                  onChange={(e) => setEquipForm({ ...equipForm, specifications: e.target.value })}
                  className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddEquipModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 font-bold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  حفظ الجهاز
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: New Maintenance Ticket */}
      {isNewTicketModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                تسجيل بلاغ صيانة ومتابعة عطل
              </h3>
              <button onClick={() => setIsNewTicketModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitTicket} className="space-y-4 text-xs">
              {selectedEquipmentForTicket && (
                <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200 text-emerald-900 flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>
                    مرتبط بالجهاز: <strong>{selectedEquipmentForTicket.nameAr || selectedEquipmentForTicket.name_ar}</strong> ({selectedEquipmentForTicket.code || ''})
                  </span>
                </div>
              )}

              <div>
                <label className="block text-slate-700 font-bold mb-1">عنوان البلاغ / وصف المشكلة المختصر *</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: توقف جهاز العرض في قاعة الخوارزمي"
                  value={ticketForm.title}
                  onChange={(e) => setTicketForm({ ...ticketForm, title: e.target.value })}
                  className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">التفاصيل الكاملة للعطل والأعراض *</label>
                <textarea
                  rows={3}
                  required
                  placeholder="يرجى توضيح سبب المشكلة، وما إذا كانت الشاشة تومض أو التبريد متوقف تماماً..."
                  value={ticketForm.description}
                  onChange={(e) => setTicketForm({ ...ticketForm, description: e.target.value })}
                  className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">مستوى الأولوية والخطورة *</label>
                  <select
                    value={ticketForm.priority}
                    onChange={(e) => setTicketForm({ ...ticketForm, priority: e.target.value })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 font-bold"
                  >
                    <option value="LOW">منخفضة (لا تؤثر على المحاضرات)</option>
                    <option value="MEDIUM">متوسطة (بحاجة لمتابعة قريبة)</option>
                    <option value="HIGH">عالية (تؤثر على الشرح العملي)</option>
                    <option value="EMERGENCY">حرجة / طارئة (تعطيل كامل للمحاضرة)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">الأثر على سير المحاضرات</label>
                  <select
                    value={ticketForm.impactOnLectures}
                    onChange={(e) => setTicketForm({ ...ticketForm, impactOnLectures: e.target.value })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="NONE">لا يوجد تأثير مباشر</option>
                    <option value="PARTIAL">تأثير جزئي على الشرح</option>
                    <option value="CRITICAL_STOPPAGE">توقف كلي للمحاضرة</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsNewTicketModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 font-bold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  إرسال البلاغ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Review & Update Ticket */}
      {isReviewTicketModalOpen && selectedTicket && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <Wrench className="w-5 h-5 text-indigo-600" />
                تحديث إجراءات الصيانة ({selectedTicket.ticketNumber || selectedTicket.ticket_number})
              </h3>
              <button onClick={() => setIsReviewTicketModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateTicket} className="space-y-4 text-xs">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="font-bold text-slate-900 mb-1">{selectedTicket.title}</div>
                <div className="text-slate-600">{selectedTicket.description}</div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">الحالة الإجرائية *</label>
                  <select
                    value={ticketReviewForm.status}
                    onChange={(e) => setTicketReviewForm({ ...ticketReviewForm, status: e.target.value })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 font-bold"
                  >
                    {Object.entries(TICKET_STATUS_CONFIG).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">شعبة / فريق الصيانة المكلف</label>
                  <input
                    type="text"
                    placeholder="مثال: شعبة الصيانة الكهربائية / قسم تكنولوجيا المعلومات"
                    value={ticketReviewForm.assignedTeam}
                    onChange={(e) => setTicketReviewForm({ ...ticketReviewForm, assignedTeam: e.target.value })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">الإجراء المتخذ (Action Taken)</label>
                <input
                  type="text"
                  placeholder="مثال: تم فحص الوحدة الداخلية واستبدال كابل التوصيل"
                  value={ticketReviewForm.actionTaken}
                  onChange={(e) => setTicketReviewForm({ ...ticketReviewForm, actionTaken: e.target.value })}
                  className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  نتيجة الصيانة وتوثيق الإغلاق {ticketReviewForm.status === 'CLOSED' && <span className="text-rose-600">(إلزامي عند الإغلاق *)</span>}
                </label>
                <textarea
                  rows={3}
                  required={ticketReviewForm.status === 'CLOSED'}
                  placeholder="اكتب التقرير النهائي: تم فحص الجهاز وتشغيله بنجاح وهو الآن جاهز للمحاضرات..."
                  value={ticketReviewForm.resolutionNotes}
                  onChange={(e) => setTicketReviewForm({ ...ticketReviewForm, resolutionNotes: e.target.value })}
                  className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsReviewTicketModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 font-bold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  حفظ وتوثيق الإجراء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
