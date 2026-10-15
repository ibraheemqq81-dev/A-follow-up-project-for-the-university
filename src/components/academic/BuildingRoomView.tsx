import React, { useState, useEffect } from 'react';
import { api } from '../../services/api.ts';
import { DoorOpen, Building as BuildingIcon, Plus, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';

export const BuildingRoomView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'rooms' | 'buildings'>('rooms');
  const [rooms, setRooms] = useState<any[]>([]);
  const [buildings, setBuildings] = useState<any[]>([]);
  const [colleges, setColleges] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);
  const [roomForm, setRoomForm] = useState({
    nameAr: '',
    code: '',
    capacity: 60,
    type: 'HALL',
    buildingId: '',
    collegeId: '',
    departmentId: '',
  });

  const [isBuildingModalOpen, setIsBuildingModalOpen] = useState(false);
  const [buildingForm, setBuildingForm] = useState({ nameAr: '', code: '' });

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [rmRes, bgRes, clRes, dpRes] = await Promise.allSettled([
        api.getRooms(),
        api.getBuildings(),
        api.getColleges(),
        api.getDepartments(),
      ]);
      const rm = rmRes.status === 'fulfilled' ? rmRes.value || [] : [];
      const bg = bgRes.status === 'fulfilled' ? bgRes.value || [] : [];
      const cl = clRes.status === 'fulfilled' ? clRes.value || [] : [];
      const dp = dpRes.status === 'fulfilled' ? dpRes.value || [] : [];
      setRooms(rm);
      setBuildings(bg);
      setColleges(cl);
      setDepartments(dp);
      if (bg.length > 0 && !roomForm.buildingId) {
        setRoomForm((prev) => ({ ...prev, buildingId: bg[0].id }));
      }
    } catch {
      // safe fallback
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createRoom(roomForm);
      setMessage({ type: 'success', text: 'تمت إضافة القاعة الدراسية بنجاح!' });
      setIsRoomModalOpen(false);
      setRoomForm({ nameAr: '', code: '', capacity: 60, type: 'HALL', buildingId: buildings[0]?.id || '', collegeId: '', departmentId: '' });
      loadData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'تعذر إضافة القاعة' });
    }
  };

  const handleDeleteRoom = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذه القاعة؟')) return;
    try {
      await api.deleteRoom(id);
      loadData();
    } catch (err: any) {
      alert(err?.message || 'فشل حذف القاعة');
    }
  };

  const handleCreateBuilding = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createBuilding(buildingForm);
      setMessage({ type: 'success', text: 'تمت إضافة المبنى بنجاح!' });
      setIsBuildingModalOpen(false);
      setBuildingForm({ nameAr: '', code: '' });
      loadData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'تعذر إضافة المبنى' });
    }
  };

  const handleDeleteBuilding = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا المبنى؟')) return;
    try {
      await api.deleteBuilding(id);
      loadData();
    } catch (err: any) {
      alert(err?.message || 'فشل حذف المبنى');
    }
  };

  const getBuildingName = (id?: string) => (Array.isArray(buildings) ? buildings : []).find((b) => b && b.id === id)?.nameAr || 'مبنى جامعي';

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center">
              <DoorOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">المباني والقاعات الدراسية</h2>
              <p className="text-xs text-slate-500">
                إدارة القاعات والمختبرات ومطابقة السعة الاستيعابية لطلبة جامعة المستقبل
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            {activeTab === 'rooms' ? (
              <button
                onClick={() => setIsRoomModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs shadow-xs"
              >
                <Plus className="w-4 h-4" />
                إضافة قاعة جديدة
              </button>
            ) : (
              <button
                onClick={() => setIsBuildingModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs shadow-xs"
              >
                <Plus className="w-4 h-4" />
                إضافة مبنى جامعي
              </button>
            )}
          </div>
        </div>

        <div className="flex border-b border-slate-200 mt-6 gap-6 text-sm">
          <button
            onClick={() => setActiveTab('rooms')}
            className={`pb-3 font-semibold transition-colors border-b-2 ${
              activeTab === 'rooms'
                ? 'border-emerald-600 text-emerald-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            القاعات والمختبرات ({rooms.length})
          </button>
          <button
            onClick={() => setActiveTab('buildings')}
            className={`pb-3 font-semibold transition-colors border-b-2 ${
              activeTab === 'buildings'
                ? 'border-emerald-600 text-emerald-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            المباني الأكاديمية ({buildings.length})
          </button>
        </div>

        {message && (
          <div
            className={`mt-4 p-3.5 rounded-xl text-xs flex items-center gap-2 ${
              message.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600" />
            )}
            {message.text}
          </div>
        )}

        {isLoading ? (
          <div className="py-16 text-center text-slate-400 text-sm">جاري التحميل...</div>
        ) : activeTab === 'rooms' ? (
          rooms.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-sm">
              لم تُضف أي قاعات دراسية بعد. أضف قاعة وحدد سعتها للبدء بالجدولة.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
              {rooms.map((r) => (
                <div
                  key={r.id}
                  className="p-5 rounded-2xl border border-slate-200 bg-white hover:border-emerald-300 transition-all shadow-xs flex flex-col justify-between"
                >
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-semibold">
                        {r.code || 'HALL'}
                      </span>
                      <button
                        onClick={() => handleDeleteRoom(r.id)}
                        className="text-slate-400 hover:text-red-600 p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <h3 className="font-bold text-slate-900 text-base">{r.nameAr}</h3>
                    <p className="text-xs text-slate-500 mt-1">{getBuildingName(r.buildingId)}</p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between text-xs text-slate-600">
                    <span>السعة: <strong className="text-slate-900">{r.capacity || 0} طالب</strong></span>
                    <span className="text-emerald-700 font-medium">
                      {r.type === 'LAB' ? 'مختبر علمي' : 'قاعة مدرج'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : buildings.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">
            لم يُضف أي مبنى حتى الآن.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
            {buildings.map((b) => (
              <div
                key={b.id}
                className="p-5 rounded-2xl border border-slate-200 bg-white hover:border-emerald-300 transition-all shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold">
                      {b.code || 'BLDG'}
                    </span>
                    <button
                      onClick={() => handleDeleteBuilding(b.id)}
                      className="text-slate-400 hover:text-red-600 p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <h3 className="font-bold text-slate-900 text-base">{b.nameAr}</h3>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500">
                  عدد القاعات: <strong className="text-slate-900">{rooms.filter((r) => r.buildingId === b.id).length}</strong>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Room Modal */}
      {isRoomModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <h3 className="font-bold text-slate-900 text-base mb-4">إضافة قاعة دراسية أو مختبر</h3>
            <form onSubmit={handleCreateRoom} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">اسم القاعة</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: القاعة المركزية 101"
                  value={roomForm.nameAr}
                  onChange={(e) => setRoomForm({ ...roomForm, nameAr: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-300"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">رمز القاعة</label>
                  <input
                    type="text"
                    placeholder="H-101"
                    value={roomForm.code}
                    onChange={(e) => setRoomForm({ ...roomForm, code: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-300 uppercase"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">السعة القصوى</label>
                  <input
                    type="number"
                    min="1"
                    max="500"
                    value={roomForm.capacity}
                    onChange={(e) => setRoomForm({ ...roomForm, capacity: Number(e.target.value) })}
                    className="w-full p-2.5 rounded-xl border border-slate-300"
                  />
                </div>
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">المبنى</label>
                <select
                  value={roomForm.buildingId}
                  onChange={(e) => setRoomForm({ ...roomForm, buildingId: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-300"
                >
                  <option value="">-- اختر المبنى --</option>
                  {buildings.map((b) => (
                    <option key={b.id} value={b.id}>{b.nameAr}</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsRoomModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700"
                >
                  إضافة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Building Modal */}
      {isBuildingModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <h3 className="font-bold text-slate-900 text-base mb-4">إضافة مبنى جامعي جديد</h3>
            <form onSubmit={handleCreateBuilding} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">اسم المبنى بالعربية</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: مبنى عمادة الهندسة"
                  value={buildingForm.nameAr}
                  onChange={(e) => setBuildingForm({ ...buildingForm, nameAr: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-300"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">الرمز التعريفي</label>
                <input
                  type="text"
                  placeholder="BLD-A"
                  value={buildingForm.code}
                  onChange={(e) => setBuildingForm({ ...buildingForm, code: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-300 uppercase"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsBuildingModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700"
                >
                  إضافة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
