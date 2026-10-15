import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api.ts';
import type { Role, Permission, RolePermission } from '../../types/index.ts';
import {
  Shield,
  Loader2,
  AlertCircle,
  Check,
  X,
  Lock,
} from 'lucide-react';

export const PermissionsManagement: React.FC = () => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [rolePerms, setRolePerms] = useState<Record<string, Set<string>>>({});
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rolesData, permsData] = await Promise.all([
        api.getRoles(),
        api.getPermissions(),
      ]);
      setRoles(rolesData);
      setPermissions(permsData);

      // Load permissions for each role
      const rpMap: Record<string, Set<string>> = {};
      for (const role of rolesData) {
        const rp: RolePermission[] = await api.getRolePermissions(role.id);
        rpMap[role.id] = new Set(rp.map((p) => p.permissionId));
      }
      setRolePerms(rpMap);
      if (rolesData.length > 0 && !selectedRoleId) {
        setSelectedRoleId(rolesData[0].id);
      }
    } catch (e: any) {
      setError(e.message || 'فشل تحميل البيانات');
    } finally {
      setLoading(false);
    }
  }, [selectedRoleId]);

  useEffect(() => { load(); }, [load]);

  const togglePermission = async (roleId: string, permissionId: string, currentlyGranted: boolean) => {
    setSaving(permissionId);
    try {
      await api.setRolePermission(roleId, permissionId, !currentlyGranted);
      setRolePerms((prev) => {
        const next = { ...prev };
        const set = new Set(next[roleId] || []);
        if (currentlyGranted) set.delete(permissionId);
        else set.add(permissionId);
        next[roleId] = set;
        return next;
      });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(null);
    }
  };

  const groupedPermissions = permissions.reduce<Record<string, Permission[]>>((acc, p) => {
    if (!acc[p.module]) acc[p.module] = [];
    acc[p.module].push(p);
    return acc;
  }, {});

  const MODULE_LABELS: Record<string, string> = {
    users: 'المستخدمين',
    roles: 'الأدوار',
    permissions: 'الصلاحيات',
    colleges: 'الكليات',
    departments: 'الأقسام',
    schedules: 'الجداول',
    change_requests: 'طلبات التغيير',
    attendance: 'الحضور',
    reports: 'التقارير',
    academic_calendar: 'التقويم الدراسي',
    imports: 'الاستيراد',
    audit_logs: 'سجل التدقيق',
    general: 'عام',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
      </div>
    );
  }

  const selectedRole = roles.find((r) => r.id === selectedRoleId);
  const selectedPerms = rolePerms[selectedRoleId] || new Set<string>();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Shield className="w-6 h-6 text-emerald-600" />
          الأدوار والصلاحيات
        </h1>
        <p className="text-sm text-slate-500 mt-1">إدارة الأدوار والصلاحيات الدقيقة لكل دور</p>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-rose-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Roles list */}
        <div className="bg-white rounded-xl border border-slate-200 p-3">
          <h3 className="text-sm font-semibold text-slate-700 mb-3 px-2">الأدوار</h3>
          <div className="space-y-1">
            {roles.map((role) => (
              <button
                key={role.id}
                onClick={() => setSelectedRoleId(role.id)}
                className={`w-full text-right px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  selectedRoleId === role.id
                    ? 'bg-emerald-50 text-emerald-800'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <div>{role.nameAr}</div>
                <div className="text-xs text-slate-400">{role.name}</div>
                {role.isSystemRole && (
                  <div className="flex items-center gap-1 text-xs text-slate-400 mt-1">
                    <Lock className="w-3 h-3" />
                    دور نظامي
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Permissions grid */}
        <div className="lg:col-span-3 bg-white rounded-xl border border-slate-200 p-4">
          {selectedRole && (
            <>
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-slate-800">{selectedRole.nameAr}</h3>
                <p className="text-sm text-slate-500">{selectedRole.description}</p>
              </div>

              <div className="space-y-4">
                {Object.entries(groupedPermissions).map(([module, perms]) => (
                  <div key={module}>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                      {MODULE_LABELS[module] || module}
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {perms.map((perm) => {
                        const granted = selectedPerms.has(perm.id);
                        return (
                          <div
                            key={perm.id}
                            className={`flex items-center justify-between p-2.5 rounded-lg border transition-colors ${
                              granted
                                ? 'bg-emerald-50 border-emerald-200'
                                : 'bg-slate-50 border-slate-200'
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-slate-700">{perm.nameAr}</div>
                              <div className="text-xs text-slate-400">{perm.name}</div>
                            </div>
                            <button
                              onClick={() => togglePermission(selectedRoleId, perm.id, granted)}
                              disabled={saving === perm.id || (selectedRole.isSystemRole && selectedRole.name === 'OWNER')}
                              className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                                granted
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-slate-200 text-slate-400 hover:bg-slate-300'
                              } disabled:opacity-50`}
                            >
                              {saving === perm.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : granted ? (
                                <Check className="w-4 h-4" />
                              ) : (
                                <X className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
