// ============================================================
// Al-Mustaqbal University - API Client (Express + SQLite backend)
// ============================================================

import type { User } from '../types/index.ts';

const TOKEN_KEY = 'uomus_auth_token';
const USER_KEY = 'uomus_auth_user';

export const getStoredToken = (): string | null => {
  return localStorage.getItem(TOKEN_KEY);
};

export const setStoredToken = (token: string): void => {
  localStorage.setItem(TOKEN_KEY, token);
};

export const removeStoredToken = (): void => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit & { _isRetry?: boolean } = {}
): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  const contentType = response.headers.get('content-type') || '';
  let data: any = null;
  if (contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    if (response.status === 401 && endpoint !== '/api/auth/login' && !options._isRetry) {
      removeStoredToken();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('auth:unauthorized'));
      }
    }
    const errorMessage =
      data?.error?.message ||
      data?.error ||
      data?.message ||
      `Request failed with status ${response.status}`;
    const error = new Error(errorMessage);
    (error as any).status = response.status;
    (error as any).data = data;
    throw error;
  }

  return data;
}

export const api = {
  // ---------- Authentication ----------
  login: async (credentials: { email: string; password: string }): Promise<{ token: string; user: User }> => {
    const res = await apiRequest<{ success: boolean; token: string; user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    setStoredToken(res.token);
    localStorage.setItem(USER_KEY, JSON.stringify(res.user));
    return res;
  },

  logout: async (): Promise<void> => {
    removeStoredToken();
  },

  getMe: async (): Promise<{ user: User }> => {
    return apiRequest<{ user: User }>('/api/auth/me');
  },

  changePassword: (data: { oldPassword?: string; newPassword?: string } | string, newPass?: string) => {
    const body = typeof data === 'string'
      ? { currentPassword: data, newPassword: newPass }
      : { currentPassword: (data as any).oldPassword || (data as any).currentPassword, newPassword: data.newPassword };
    return apiRequest('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  // ---------- Health & Stats ----------
  getHealth: () => apiRequest('/api/health'),
  getSystemStats: () => apiRequest('/api/dashboard/stats').catch(() => ({})),

  // ---------- Colleges & Departments ----------
  getColleges: () => apiRequest<any[]>('/api/colleges'),
  createCollege: (data: any) => apiRequest('/api/colleges', { method: 'POST', body: JSON.stringify(data) }),
  updateCollege: (id: string, data: any) => apiRequest(`/api/colleges/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCollege: (id: string) => apiRequest(`/api/colleges/${id}`, { method: 'DELETE' }),

  getDepartments: (collegeId?: string) =>
    apiRequest<any[]>(collegeId ? `/api/departments?collegeId=${collegeId}` : '/api/departments'),
  createDepartment: (data: any) => apiRequest('/api/departments', { method: 'POST', body: JSON.stringify(data) }),
  updateDepartment: (id: string, data: any) => apiRequest(`/api/departments/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteDepartment: (id: string) => apiRequest(`/api/departments/${id}`, { method: 'DELETE' }),

  // ---------- Buildings & Rooms ----------
  getBuildings: () => apiRequest<any[]>('/api/buildings'),
  createBuilding: (data: any) => apiRequest('/api/buildings', { method: 'POST', body: JSON.stringify(data) }),
  updateBuilding: (id: string, data: any) => apiRequest(`/api/buildings/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteBuilding: (id: string) => apiRequest(`/api/buildings/${id}`, { method: 'DELETE' }),

  getRooms: (collegeId?: string) =>
    apiRequest<any[]>(collegeId ? `/api/rooms?collegeId=${collegeId}` : '/api/rooms'),
  createRoom: (data: any) => apiRequest('/api/rooms', { method: 'POST', body: JSON.stringify(data) }),
  updateRoom: (id: string, data: any) => apiRequest(`/api/rooms/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteRoom: (id: string) => apiRequest(`/api/rooms/${id}`, { method: 'DELETE' }),

  // ---------- Stages & Sections ----------
  getStages: (departmentId?: string) =>
    apiRequest<any[]>(departmentId ? `/api/stages?departmentId=${departmentId}` : '/api/stages'),
  createStage: (data: any) => apiRequest('/api/stages', { method: 'POST', body: JSON.stringify(data) }),
  updateStage: (id: string, data: any) => apiRequest(`/api/stages/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteStage: (id: string) => apiRequest(`/api/stages/${id}`, { method: 'DELETE' }),

  getSections: (stageId?: string) =>
    apiRequest<any[]>(stageId ? `/api/sections?stageId=${stageId}` : '/api/sections'),
  createSection: (data: any) => apiRequest('/api/sections', { method: 'POST', body: JSON.stringify(data) }),
  updateSection: (id: string, data: any) => apiRequest(`/api/sections/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteSection: (id: string) => apiRequest(`/api/sections/${id}`, { method: 'DELETE' }),

  // ---------- Subjects & Faculty ----------
  getSubjects: (departmentId?: string) =>
    apiRequest<any[]>(departmentId ? `/api/subjects?departmentId=${departmentId}` : '/api/subjects'),
  createSubject: (data: any) => apiRequest('/api/subjects', { method: 'POST', body: JSON.stringify(data) }),
  updateSubject: (id: string, data: any) => apiRequest(`/api/subjects/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteSubject: (id: string) => apiRequest(`/api/subjects/${id}`, { method: 'DELETE' }),

  getFaculties: (departmentId?: string) =>
    apiRequest<any[]>(departmentId ? `/api/faculties?departmentId=${departmentId}` : '/api/faculties'),
  createFaculty: (data: any) => apiRequest('/api/faculties', { method: 'POST', body: JSON.stringify(data) }),
  updateFaculty: (id: string, data: any) => apiRequest(`/api/faculties/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteFaculty: (id: string) => apiRequest(`/api/faculties/${id}`, { method: 'DELETE' }),

  // ---------- Schedules ----------
  getSchedules: (params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiRequest<any[]>(`/api/schedules${qs ? `?${qs}` : ''}`);
  },
  createSchedule: (data: any) => apiRequest('/api/schedules', { method: 'POST', body: JSON.stringify(data) }),
  updateSchedule: (id: string, data: any) => apiRequest(`/api/schedules/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteSchedule: (id: string) => apiRequest(`/api/schedules/${id}`, { method: 'DELETE' }),

  // ---------- Attendance ----------
  getAttendance: (params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiRequest<any[]>(`/api/attendance${qs ? `?${qs}` : ''}`);
  },
  getAttendanceRecords: (params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiRequest<any[]>(`/api/attendance${qs ? `?${qs}` : ''}`);
  },
  recordAttendance: (data: any) => apiRequest('/api/attendance', { method: 'POST', body: JSON.stringify(data) }),
  getDailyAttendanceReport: (date: string) => apiRequest(`/api/reports/daily?date=${date}`),

  // ---------- Users ----------
  getUsers: () => apiRequest<any[]>('/api/users'),
  createUser: (data: any) => apiRequest('/api/users', { method: 'POST', body: JSON.stringify(data) }),
  updateUser: (id: string, data: any) => apiRequest(`/api/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteUser: (id: string) => apiRequest(`/api/users/${id}`, { method: 'DELETE' }),

  // ---------- Terms & Semesters ----------
  getAcademicYears: () => apiRequest<any[]>('/api/academic-years'),
  createAcademicYear: (data: any) => apiRequest('/api/academic-years', { method: 'POST', body: JSON.stringify(data) }),
  deleteAcademicYear: (id: string) => apiRequest(`/api/academic-years/${id}`, { method: 'DELETE' }),

  getSemesters: () => apiRequest<any[]>('/api/semesters'),
  createSemester: (data: any) => apiRequest('/api/semesters', { method: 'POST', body: JSON.stringify(data) }),
  updateSemester: (id: string, data: any) => apiRequest(`/api/semesters/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteSemester: (id: string) => apiRequest(`/api/semesters/${id}`, { method: 'DELETE' }),

  // ---------- Notifications ----------
  getNotifications: () => apiRequest<any[]>('/api/notifications'),
  createNotification: (data: any) => apiRequest('/api/notifications', { method: 'POST', body: JSON.stringify(data) }),
  markNotificationRead: (id: string) => apiRequest(`/api/notifications/${id}/read`, { method: 'PUT' }),
  markAllNotificationsRead: () => apiRequest('/api/notifications/read-all', { method: 'PUT' }),
  deleteNotification: (id: string) => apiRequest(`/api/notifications/${id}`, { method: 'DELETE' }),

  // ---------- Settings & Backup ----------
  getSettings: () => apiRequest<any>('/api/settings'),
  updateSettings: (key: string, value: any, description?: string) =>
    apiRequest('/api/settings', { method: 'PUT', body: JSON.stringify({ key, value, description }) }),

  getAccountSettings: () => apiRequest<any>('/api/settings/account').catch(() => ({})),
  updateAccountSettings: (data: any) => apiRequest('/api/settings/account', { method: 'PUT', body: JSON.stringify(data) }).catch(() => ({})),
  getEmailConfig: () => apiRequest<any>('/api/settings/email-config').catch(() => ({})),
  updateEmailConfig: (data: any) => apiRequest('/api/settings/email-config', { method: 'PUT', body: JSON.stringify(data) }).catch(() => ({})),
  getUniversityInfo: () => apiRequest<any>('/api/settings/university').catch(() => ({})),
  updateUniversityInfo: (data: any) => apiRequest('/api/settings/university', { method: 'PUT', body: JSON.stringify(data) }).catch(() => ({})),

  triggerBackup: () => apiRequest<any>('/api/system/backup'),
  getAuditLogs: () => apiRequest<any[]>('/api/system/audit-logs'),

  getBackups: () => apiRequest<any[]>('/api/system/backups').catch(() => []),
  getBackupDetails: (id: string) => apiRequest<any>(`/api/system/backups/${id}`).catch(() => null),
  getBackupAuditLog: () => apiRequest<any[]>('/api/system/backup-audit-log').catch(() => []),
  createBackup: (type: string = 'MANUAL') => apiRequest<any>('/api/system/backups', { method: 'POST', body: JSON.stringify({ type }) }).catch(() => null),
  downloadBackup: (id: string) => apiRequest<any>(`/api/system/backups/${id}/download`).catch(() => null),
  restoreBackup: (id: string) => apiRequest<any>(`/api/system/backups/${id}/restore`, { method: 'POST' }).catch(() => null),
  deleteBackup: (id: string) => apiRequest<any>(`/api/system/backups/${id}`, { method: 'DELETE' }).catch(() => null),
  uploadBackup: (data: any) => apiRequest<any>('/api/system/backups/upload', { method: 'POST', body: JSON.stringify(data) }).catch(() => null),
  verifyBackup: (id: string) => apiRequest<any>(`/api/system/backups/${id}/verify`, { method: 'POST' }).catch(() => null),

  // ---------- Import & Export ----------
  getImportTemplate: (entityType: string) =>
    apiRequest<{ columns: any[]; sampleData: any[] }>(`/api/import/template/${entityType}`),

  importEntity: (entityType: string, data: any[], fileName?: string) =>
    apiRequest<{
      success: boolean;
      message: string;
      count: number;
      created: number;
      updated: number;
      entityType: string;
      jobId: string;
      errors?: string[];
    }>(`/api/import/${entityType}`, {
      method: 'POST',
      body: JSON.stringify({ data, fileName }),
    }),

  importDepartmentPackage: (
    packageData: any,
    options: { dryRun?: boolean; confirmConflicts?: boolean; overrideReason?: string } = {}
  ) =>
    apiRequest<any>(
      `/api/import/department-package${options.dryRun ? '?dryRun=true' : ''}`,
      {
        method: 'POST',
        body: JSON.stringify({
          packageData,
          dryRun: options.dryRun,
          confirmConflicts: options.confirmConflicts,
          overrideReason: options.overrideReason,
        }),
      }
    ),

  getImportJobs: () => apiRequest<any[]>('/api/import/jobs'),
  exportDepartmentPackage: (departmentId: string) =>
    apiRequest<any>(`/api/export/department-package/${departmentId}`),

  // ---------- Registration Requests & Email Verification (Phases 2-3) ----------
  createRegistrationRequest: (data: any) =>
    apiRequest<{ success: boolean; requestId: string; message: string }>('/api/auth/register-request', {
      method: 'POST',
      body: JSON.stringify(data),
    }).catch(async (err) => {
      // Graceful fallback during inspection/phase 1
      throw err;
    }),

  verifyEmailCode: (emailOrRequestId: string, code: string, requestId?: string) =>
    apiRequest<{ success: boolean; message: string }>('/api/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({
        email: requestId ? emailOrRequestId : undefined,
        requestId: requestId || emailOrRequestId,
        code,
      }),
    }),

  resendVerificationCode: (requestId: string) =>
    apiRequest<{ success: boolean; message: string }>('/api/auth/resend-code', {
      method: 'POST',
      body: JSON.stringify({ requestId }),
    }),

  getRegistrationRequests: (status?: string) =>
    apiRequest<any[]>(`/api/registration-requests${status ? `?status=${status}` : ''}`).catch(() => []),

  approveRegistration: (requestId: string, reviewerOrData?: any, extraData?: any) => {
    const body = extraData ? { ...reviewerOrData, ...extraData } : (reviewerOrData || {});
    return apiRequest(`/api/registration-requests/${requestId}/approve`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  rejectRegistration: (requestId: string, reviewerOrReason?: any, reasonStr?: string) => {
    const body = reasonStr ? { reviewer: reviewerOrReason, reason: reasonStr } : { reason: reviewerOrReason };
    return apiRequest(`/api/registration-requests/${requestId}/reject`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  // ---------- Device Management (Phase 4) ----------
  getUserDevices: (userId?: string) =>
    apiRequest<any[]>(`/api/devices${userId ? `?userId=${userId}` : ''}`).catch(() => []),

  approveDevice: (deviceId: string, approvedBy?: any) =>
    apiRequest(`/api/devices/${deviceId}/approve`, {
      method: 'POST',
      body: JSON.stringify({ approvedBy }),
    }),

  revokeDevice: (deviceId: string, revokedBy?: any) =>
    apiRequest(`/api/devices/${deviceId}/revoke`, {
      method: 'POST',
      body: JSON.stringify({ revokedBy }),
    }),

  // ---------- Change Requests & Dean Updates ----------
  getChangeRequests: (params?: Record<string, string>) => {
    const qs = params ? new URLSearchParams(params).toString() : '';
    return apiRequest<any[]>(`/api/change-requests${qs ? `?${qs}` : ''}`).catch(() => []);
  },
  createChangeRequest: (data: any) => apiRequest('/api/change-requests', { method: 'POST', body: JSON.stringify(data) }).catch(() => null),
  reviewChangeRequest: (id: string, actionOrData: any, notes?: string) => {
    const body = typeof actionOrData === 'string' ? { status: actionOrData, reviewNotes: notes } : actionOrData;
    return apiRequest(`/api/change-requests/${id}/review`, { method: 'POST', body: JSON.stringify(body) }).catch(() => null);
  },

  getDeanUpdates: (collegeId: string) => apiRequest<any[]>(`/api/dean-updates?collegeId=${collegeId}`).catch(() => []),
  markDeanUpdateRead: (id: string) => apiRequest(`/api/dean-updates/${id}/read`, { method: 'PUT' }).catch(() => null),

  // ---------- Academic Calendar ----------
  getCalendarEvents: () => apiRequest<any[]>('/api/academic-calendar').catch(() => []),
  createCalendarEvent: (data: any) => apiRequest('/api/academic-calendar', { method: 'POST', body: JSON.stringify(data) }).catch(() => null),
  deleteCalendarEvent: (id: string) => apiRequest(`/api/academic-calendar/${id}`, { method: 'DELETE' }).catch(() => null),

  // ---------- Roles & Permissions ----------
  getRoles: () => apiRequest<any[]>('/api/roles').catch(() => []),
  getPermissions: () => apiRequest<any[]>('/api/permissions').catch(() => []),
  getRolePermissions: (roleId: string) => apiRequest<any[]>(`/api/roles/${roleId}/permissions`).catch(() => []),
  setRolePermission: (roleId: string, permissionId: string, granted: boolean) =>
    apiRequest(`/api/roles/${roleId}/permissions`, {
      method: 'POST',
      body: JSON.stringify({ permissionId, granted }),
    }).catch(() => null),

  // ---------- Equipment & Maintenance ----------
  getEquipment: (params?: Record<string, string>) => {
    const qs = params ? new URLSearchParams(params).toString() : '';
    return apiRequest<any[]>(`/api/equipment${qs ? `?${qs}` : ''}`).catch(() => []);
  },
  createEquipment: (data: any) =>
    apiRequest('/api/equipment', { method: 'POST', body: JSON.stringify(data) }),
  updateEquipment: (id: string, data: any) =>
    apiRequest(`/api/equipment/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteEquipment: (id: string) =>
    apiRequest(`/api/equipment/${id}`, { method: 'DELETE' }),

  getMaintenanceTickets: (params?: Record<string, string>) => {
    const qs = params ? new URLSearchParams(params).toString() : '';
    return apiRequest<any[]>(`/api/maintenance-tickets${qs ? `?${qs}` : ''}`).catch(() => []);
  },
  createMaintenanceTicket: (data: any) =>
    apiRequest('/api/maintenance-tickets', { method: 'POST', body: JSON.stringify(data) }),
  updateMaintenanceTicket: (id: string, data: any) =>
    apiRequest(`/api/maintenance-tickets/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  getMaintenanceStats: () =>
    apiRequest<any>('/api/maintenance-tickets/stats').catch(() => ({})),

  // ---------- Password Policy ----------
  getPasswordPolicy: () =>
    apiRequest<{ success: boolean; data: { minLength: number } }>('/api/settings/password-policy').catch(() => ({ success: true, data: { minLength: 8 } })),
  updatePasswordPolicy: (minLength: number) =>
    apiRequest('/api/settings/password-policy', { method: 'PUT', body: JSON.stringify({ minLength }) }),
};
