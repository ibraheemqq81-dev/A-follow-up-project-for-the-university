const TOKEN_KEY = 'uomus_auth_token';

export const getStoredToken = (): string | null => {
  return localStorage.getItem(TOKEN_KEY);
};

export const setStoredToken = (token: string): void => {
  localStorage.setItem(TOKEN_KEY, token);
};

export const removeStoredToken = (): void => {
  localStorage.removeItem(TOKEN_KEY);
};

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
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
    if (response.status === 401 && endpoint !== '/api/auth/login') {
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
  // Auth
  login: (credentials: { email: string; password: string }) =>
    apiRequest<{ success: boolean; token: string; user: any }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    }),
  getMe: () => apiRequest<{ success: boolean; user: any }>('/api/auth/me'),

  // Academic Entities
  getColleges: () => apiRequest<any[]>('/api/colleges'),
  createCollege: (data: any) =>
    apiRequest('/api/colleges', { method: 'POST', body: JSON.stringify(data) }),
  updateCollege: (id: string, data: any) =>
    apiRequest(`/api/colleges/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCollege: (id: string) => apiRequest(`/api/colleges/${id}`, { method: 'DELETE' }),

  getDepartments: (collegeId?: string) =>
    apiRequest<any[]>(collegeId ? `/api/departments?collegeId=${collegeId}` : '/api/departments'),
  createDepartment: (data: any) =>
    apiRequest('/api/departments', { method: 'POST', body: JSON.stringify(data) }),
  updateDepartment: (id: string, data: any) =>
    apiRequest(`/api/departments/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteDepartment: (id: string) => apiRequest(`/api/departments/${id}`, { method: 'DELETE' }),

  getBuildings: () => apiRequest<any[]>('/api/buildings'),
  createBuilding: (data: any) =>
    apiRequest('/api/buildings', { method: 'POST', body: JSON.stringify(data) }),
  updateBuilding: (id: string, data: any) =>
    apiRequest(`/api/buildings/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteBuilding: (id: string) => apiRequest(`/api/buildings/${id}`, { method: 'DELETE' }),

  getRooms: () => apiRequest<any[]>('/api/rooms'),
  createRoom: (data: any) =>
    apiRequest('/api/rooms', { method: 'POST', body: JSON.stringify(data) }),
  updateRoom: (id: string, data: any) =>
    apiRequest(`/api/rooms/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteRoom: (id: string) => apiRequest(`/api/rooms/${id}`, { method: 'DELETE' }),

  getStages: (departmentId?: string) =>
    apiRequest<any[]>(departmentId ? `/api/stages?departmentId=${departmentId}` : '/api/stages'),
  createStage: (data: any) =>
    apiRequest('/api/stages', { method: 'POST', body: JSON.stringify(data) }),
  updateStage: (id: string, data: any) =>
    apiRequest(`/api/stages/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteStage: (id: string) => apiRequest(`/api/stages/${id}`, { method: 'DELETE' }),

  getSections: (departmentId?: string) =>
    apiRequest<any[]>(departmentId ? `/api/sections?departmentId=${departmentId}` : '/api/sections'),
  createSection: (data: any) =>
    apiRequest('/api/sections', { method: 'POST', body: JSON.stringify(data) }),
  updateSection: (id: string, data: any) =>
    apiRequest(`/api/sections/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteSection: (id: string) => apiRequest(`/api/sections/${id}`, { method: 'DELETE' }),

  getSubjects: (departmentId?: string) =>
    apiRequest<any[]>(departmentId ? `/api/subjects?departmentId=${departmentId}` : '/api/subjects'),
  createSubject: (data: any) =>
    apiRequest('/api/subjects', { method: 'POST', body: JSON.stringify(data) }),
  updateSubject: (id: string, data: any) =>
    apiRequest(`/api/subjects/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteSubject: (id: string) => apiRequest(`/api/subjects/${id}`, { method: 'DELETE' }),

  getFaculties: (departmentId?: string) =>
    apiRequest<any[]>(departmentId ? `/api/faculties?departmentId=${departmentId}` : '/api/faculties'),
  createFaculty: (data: any) =>
    apiRequest('/api/faculties', { method: 'POST', body: JSON.stringify(data) }),
  updateFaculty: (id: string, data: any) =>
    apiRequest(`/api/faculties/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteFaculty: (id: string) => apiRequest(`/api/faculties/${id}`, { method: 'DELETE' }),

  getSchedules: (params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiRequest<any[]>(`/api/schedules${qs ? `?${qs}` : ''}`);
  },
  createSchedule: (data: any) =>
    apiRequest('/api/schedules', { method: 'POST', body: JSON.stringify(data) }),
  updateSchedule: (id: string, data: any) =>
    apiRequest(`/api/schedules/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteSchedule: (id: string) => apiRequest(`/api/schedules/${id}`, { method: 'DELETE' }),

  getAttendance: (params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiRequest<any[]>(`/api/attendance${qs ? `?${qs}` : ''}`);
  },
  getAttendanceRecords: (params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiRequest<any[]>(`/api/attendance${qs ? `?${qs}` : ''}`);
  },
  recordAttendance: (data: any) =>
    apiRequest('/api/attendance', { method: 'POST', body: JSON.stringify(data) }),

  getUsers: () => apiRequest<any[]>('/api/users'),
  createUser: (data: any) =>
    apiRequest('/api/users', { method: 'POST', body: JSON.stringify(data) }),
  updateUser: (id: string, data: any) =>
    apiRequest(`/api/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteUser: (id: string) => apiRequest(`/api/users/${id}`, { method: 'DELETE' }),

  getAuditLogs: () => apiRequest<any[]>('/api/audit-logs'),
  getHealth: () => apiRequest<any>('/api/health'),
  getSettings: () => apiRequest<any>('/api/settings'),
  updateSettings: (key: string, value: any, description?: string) =>
    apiRequest('/api/settings', { method: 'PUT', body: JSON.stringify({ key, value, description }) }),

  // Academic Years & Semesters
  getAcademicYears: () => apiRequest<any[]>('/api/academic-years'),
  createAcademicYear: (data: any) =>
    apiRequest('/api/academic-years', { method: 'POST', body: JSON.stringify(data) }),
  updateAcademicYear: (id: string, data: any) =>
    apiRequest(`/api/academic-years/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteAcademicYear: (id: string) =>
    apiRequest(`/api/academic-years/${id}`, { method: 'DELETE' }),

  getSemesters: () => apiRequest<any[]>('/api/semesters'),
  createSemester: (data: any) =>
    apiRequest('/api/semesters', { method: 'POST', body: JSON.stringify(data) }),
  updateSemester: (id: string, data: any) =>
    apiRequest(`/api/semesters/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteSemester: (id: string) =>
    apiRequest(`/api/semesters/${id}`, { method: 'DELETE' }),

  // Notifications API
  getNotifications: () => apiRequest<any[]>('/api/notifications'),
  createNotification: (data: { title: string; message: string; type?: string; userId?: string }) =>
    apiRequest('/api/notifications', { method: 'POST', body: JSON.stringify(data) }),
  markNotificationRead: (id: string) =>
    apiRequest(`/api/notifications/${id}/read`, { method: 'PUT' }),
  markAllNotificationsRead: () =>
    apiRequest('/api/notifications/read-all', { method: 'PUT' }),
  deleteNotification: (id: string) =>
    apiRequest(`/api/notifications/${id}`, { method: 'DELETE' }),


  triggerBackup: () => apiRequest('/api/system/backup', { method: 'POST' }),
  getDailyAttendanceReport: (date?: string) =>
    apiRequest<any>(date ? `/api/reports/daily-attendance?date=${date}` : '/api/reports/daily-attendance'),

  // Import Center API
  getImportTemplate: (entityType: string) =>
    apiRequest<{
      entityType: string;
      university: string;
      columns: Array<{ key: string; labelAr: string; labelEn: string; required: boolean; example: string }>;
      sampleData: any[];
    }>(`/api/import/template/${entityType}`),

  importEntity: (entityType: string, data: any[], fileName?: string) =>
    apiRequest<{
      success: boolean;
      message: string;
      count: number;
      created: number;
      updated: number;
      entityType: string;
      jobId: string;
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
};
