import { supabase } from '../lib/supabase.ts';

// ============================================================
// Auth token helpers (stored in localStorage)
// ============================================================

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

const getStoredUser = (): User | null => {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
};

const setStoredUser = (user: User): void => {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

import type { User } from '../types/index.ts';

// ============================================================
// Snake_case <-> camelCase mapper
// ============================================================

function snakeToCamel(s: string): string {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function camelToSnake(s: string): string {
  return s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

function mapRow<T = any>(row: any): T {
  if (!row || typeof row !== 'object') return row;
  const out: any = {};
  for (const k of Object.keys(row)) {
    out[snakeToCamel(k)] = row[k];
  }
  return out as T;
}

function mapInput(data: any): any {
  if (!data || typeof data !== 'object') return data;
  const out: any = {};
  for (const k of Object.keys(data)) {
    if (data[k] !== undefined) {
      out[camelToSnake(k)] = data[k];
    }
  }
  return out;
}

function handleError(error: any, fallback: string): never {
  const msg = error?.message || fallback;
  throw new Error(msg);
}

// Generate a random ID with prefix
function genId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

// ============================================================
// API object — all methods talk to Supabase directly
// ============================================================

export const api = {
  // ---------- Auth ----------
  login: async (credentials: { email: string; password: string }) => {
    const email = credentials.email.trim().toLowerCase();

    const { data, error } = await supabase.rpc('verify_login', {
      p_email: email,
      p_password: credentials.password,
    });

    if (error) handleError(error, 'فشل الاتصال بقاعدة البيانات');
    if (!data || !data.success) throw new Error(data?.error || 'بيانات الاعتماد غير صحيحة');

    const user = data.user as User;
    const token = data.token as string;
    if (!token) throw new Error('فشل إنشاء جلسة آمنة');
    setStoredToken(token);
    setStoredUser(user);

    return { success: true, token, user };
  },

  getMe: async () => {
    const token = getStoredToken();
    const user = getStoredUser();
    if (!token || !user) throw new Error('غير مسجل الدخول');
    // Validate session token server-side
    const { data: sessionData, error: sessionErr } = await supabase.rpc('verify_session', {
      p_token: token,
    });
    if (sessionErr || !sessionData?.success) {
      removeStoredToken();
      throw new Error('انتهت صلاحية الجلسة');
    }
    // Refresh user data from DB
    const { data, error } = await supabase
      .from('users')
      .select('id, uid, name, email, employee_id, role, role_title_ar, assigned_college_id, assigned_department_id, assigned_faculty_id, avatar, must_change_password, status, account_status, max_devices, token_version, created_at, updated_at')
      .eq('id', user.id)
      .maybeSingle();
    if (error || !data) {
      removeStoredToken();
      throw new Error('انتهت صلاحية الجلسة');
    }
    const fresh = mapRow<User>(data);
    setStoredUser(fresh);
    return { success: true, user: fresh };
  },

  logout: async () => {
    const token = getStoredToken();
    if (token) {
      try {
        await supabase.rpc('revoke_session', { p_token: token });
      } catch { /* best effort */ }
    }
    removeStoredToken();
    return { success: true };
  },

  changePassword: async (currentPassword: string, newPassword: string) => {
    const token = getStoredToken();
    if (!token) throw new Error('غير مسجل الدخول');

    const { data, error } = await supabase.rpc('change_password', {
      p_session_token: token,
      p_current: currentPassword,
      p_new: newPassword,
    });

    if (error) throw new Error('تعذر تغيير كلمة المرور');
    if (!data || !data.success) throw new Error(data?.error || 'تعذر تغيير كلمة المرور');

    return { success: true, message: data.message || 'تم تغيير كلمة المرور' };
  },

  // ---------- Colleges ----------
  getColleges: async () => {
    const { data, error } = await supabase.from('colleges').select('*').eq('is_deleted', false);
    if (error) handleError(error, 'فشل تحميل الكليات');
    return (data || []).map(mapRow);
  },
  createCollege: async (data: any) => {
    const input = mapInput(data);
    const id = input.id || genId('col');
    const { data: row, error } = await supabase.from('colleges').insert({ ...input, id, is_deleted: false }).select().single();
    if (error) handleError(error, 'فشل إضافة الكلية');
    return { success: true, data: mapRow(row) };
  },
  updateCollege: async (id: string, data: any) => {
    const input = mapInput(data);
    input.updated_at = new Date().toISOString();
    const { data: row, error } = await supabase.from('colleges').update(input).eq('id', id).select().single();
    if (error) handleError(error, 'فشل تعديل الكلية');
    return { success: true, data: mapRow(row) };
  },
  deleteCollege: async (id: string) => {
    const { error } = await supabase.from('colleges').update({ is_deleted: true, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) handleError(error, 'فشل حذف الكلية');
    return { success: true, message: 'تم حذف الكلية بنجاح' };
  },

  // ---------- Departments ----------
  getDepartments: async (collegeId?: string) => {
    let q = supabase.from('departments').select('*').eq('is_deleted', false);
    if (collegeId) q = q.eq('college_id', collegeId);
    const { data, error } = await q;
    if (error) handleError(error, 'فشل تحميل الأقسام');
    return (data || []).map(mapRow);
  },
  createDepartment: async (data: any) => {
    const input = mapInput(data);
    const id = input.id || genId('dept');
    const { data: row, error } = await supabase.from('departments').insert({ ...input, id, is_deleted: false }).select().single();
    if (error) handleError(error, 'فشل إضافة القسم');
    return { success: true, data: mapRow(row) };
  },
  updateDepartment: async (id: string, data: any) => {
    const input = mapInput(data);
    input.updated_at = new Date().toISOString();
    const { data: row, error } = await supabase.from('departments').update(input).eq('id', id).select().single();
    if (error) handleError(error, 'فشل تعديل القسم');
    return { success: true, data: mapRow(row) };
  },
  deleteDepartment: async (id: string) => {
    const { error } = await supabase.from('departments').update({ is_deleted: true, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) handleError(error, 'فشل حذف القسم');
    return { success: true, message: 'تم حذف القسم بنجاح' };
  },

  // ---------- Buildings ----------
  getBuildings: async () => {
    const { data, error } = await supabase.from('buildings').select('*').eq('is_deleted', false);
    if (error) handleError(error, 'فشل تحميل المباني');
    return (data || []).map(mapRow);
  },
  createBuilding: async (data: any) => {
    const input = mapInput(data);
    const id = input.id || genId('bld');
    const { data: row, error } = await supabase.from('buildings').insert({ ...input, id, is_deleted: false }).select().single();
    if (error) handleError(error, 'فشل إضافة المبنى');
    return { success: true, data: mapRow(row) };
  },
  updateBuilding: async (id: string, data: any) => {
    const input = mapInput(data);
    input.updated_at = new Date().toISOString();
    const { data: row, error } = await supabase.from('buildings').update(input).eq('id', id).select().single();
    if (error) handleError(error, 'فشل تعديل المبنى');
    return { success: true, data: mapRow(row) };
  },
  deleteBuilding: async (id: string) => {
    const { error } = await supabase.from('buildings').update({ is_deleted: true, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) handleError(error, 'فشل حذف المبنى');
    return { success: true, message: 'تم حذف المبنى بنجاح' };
  },

  // ---------- Rooms ----------
  getRooms: async () => {
    const { data, error } = await supabase.from('rooms').select('*').eq('is_deleted', false);
    if (error) handleError(error, 'فشل تحميل القاعات');
    return (data || []).map(mapRow);
  },
  createRoom: async (data: any) => {
    const input = mapInput(data);
    const id = input.id || genId('room');
    const { data: row, error } = await supabase.from('rooms').insert({ ...input, id, is_deleted: false }).select().single();
    if (error) handleError(error, 'فشل إضافة القاعة');
    return { success: true, data: mapRow(row) };
  },
  updateRoom: async (id: string, data: any) => {
    const input = mapInput(data);
    input.updated_at = new Date().toISOString();
    const { data: row, error } = await supabase.from('rooms').update(input).eq('id', id).select().single();
    if (error) handleError(error, 'فشل تعديل القاعة');
    return { success: true, data: mapRow(row) };
  },
  deleteRoom: async (id: string) => {
    const { error } = await supabase.from('rooms').update({ is_deleted: true, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) handleError(error, 'فشل حذف القاعة');
    return { success: true, message: 'تم حذف القاعة بنجاح' };
  },

  // ---------- Stages ----------
  getStages: async (departmentId?: string) => {
    let q = supabase.from('stages').select('*').eq('is_deleted', false);
    if (departmentId) q = q.eq('department_id', departmentId);
    const { data, error } = await q;
    if (error) handleError(error, 'فشل تحميل المراحل');
    return (data || []).map(mapRow);
  },
  createStage: async (data: any) => {
    const input = mapInput(data);
    const id = input.id || genId('stg');
    const { data: row, error } = await supabase.from('stages').insert({ ...input, id, is_deleted: false }).select().single();
    if (error) handleError(error, 'فشل إضافة المرحلة');
    return { success: true, data: mapRow(row) };
  },
  updateStage: async (id: string, data: any) => {
    const input = mapInput(data);
    input.updated_at = new Date().toISOString();
    const { data: row, error } = await supabase.from('stages').update(input).eq('id', id).select().single();
    if (error) handleError(error, 'فشل تعديل المرحلة');
    return { success: true, data: mapRow(row) };
  },
  deleteStage: async (id: string) => {
    const { error } = await supabase.from('stages').update({ is_deleted: true, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) handleError(error, 'فشل حذف المرحلة');
    return { success: true, message: 'تم حذف المرحلة بنجاح' };
  },

  // ---------- Sections ----------
  getSections: async (departmentId?: string) => {
    let q = supabase.from('sections').select('*').eq('is_deleted', false);
    if (departmentId) q = q.eq('department_id', departmentId);
    const { data, error } = await q;
    if (error) handleError(error, 'فشل تحميل الشعب');
    return (data || []).map(mapRow);
  },
  createSection: async (data: any) => {
    const input = mapInput(data);
    const id = input.id || genId('sec');
    const { data: row, error } = await supabase.from('sections').insert({ ...input, id, is_deleted: false }).select().single();
    if (error) handleError(error, 'فشل إضافة الشعبة');
    return { success: true, data: mapRow(row) };
  },
  updateSection: async (id: string, data: any) => {
    const input = mapInput(data);
    input.updated_at = new Date().toISOString();
    const { data: row, error } = await supabase.from('sections').update(input).eq('id', id).select().single();
    if (error) handleError(error, 'فشل تعديل الشعبة');
    return { success: true, data: mapRow(row) };
  },
  deleteSection: async (id: string) => {
    const { error } = await supabase.from('sections').update({ is_deleted: true, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) handleError(error, 'فشل حذف الشعبة');
    return { success: true, message: 'تم حذف الشعبة بنجاح' };
  },

  // ---------- Subjects ----------
  getSubjects: async (departmentId?: string) => {
    let q = supabase.from('subjects').select('*').eq('is_deleted', false);
    if (departmentId) q = q.eq('department_id', departmentId);
    const { data, error } = await q;
    if (error) handleError(error, 'فشل تحميل المواد');
    return (data || []).map(mapRow);
  },
  createSubject: async (data: any) => {
    const input = mapInput(data);
    const id = input.id || genId('subj');
    const { data: row, error } = await supabase.from('subjects').insert({ ...input, id, is_deleted: false }).select().single();
    if (error) handleError(error, 'فشل إضافة المادة');
    return { success: true, data: mapRow(row) };
  },
  updateSubject: async (id: string, data: any) => {
    const input = mapInput(data);
    input.updated_at = new Date().toISOString();
    const { data: row, error } = await supabase.from('subjects').update(input).eq('id', id).select().single();
    if (error) handleError(error, 'فشل تعديل المادة');
    return { success: true, data: mapRow(row) };
  },
  deleteSubject: async (id: string) => {
    const { error } = await supabase.from('subjects').update({ is_deleted: true, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) handleError(error, 'فشل حذف المادة');
    return { success: true, message: 'تم حذف المادة بنجاح' };
  },

  // ---------- Faculties ----------
  getFaculties: async (departmentId?: string) => {
    let q = supabase.from('faculties').select('*').eq('is_deleted', false);
    if (departmentId) q = q.eq('department_id', departmentId);
    const { data, error } = await q;
    if (error) handleError(error, 'فشل تحميل التدريسيين');
    return (data || []).map(mapRow);
  },
  createFaculty: async (data: any) => {
    const input = mapInput(data);
    const id = input.id || genId('fac');
    const { data: row, error } = await supabase.from('faculties').insert({ ...input, id, is_deleted: false }).select().single();
    if (error) handleError(error, 'فشل إضافة التدريسي');
    return { success: true, data: mapRow(row) };
  },
  updateFaculty: async (id: string, data: any) => {
    const input = mapInput(data);
    input.updated_at = new Date().toISOString();
    const { data: row, error } = await supabase.from('faculties').update(input).eq('id', id).select().single();
    if (error) handleError(error, 'فشل تعديل التدريسي');
    return { success: true, data: mapRow(row) };
  },
  deleteFaculty: async (id: string) => {
    const { error } = await supabase.from('faculties').update({ is_deleted: true, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) handleError(error, 'فشل حذف التدريسي');
    return { success: true, message: 'تم حذف التدريسي بنجاح' };
  },

  // ---------- Schedules ----------
  getSchedules: async (params: Record<string, string> = {}) => {
    let q = supabase.from('schedules').select('*').eq('is_deleted', false);
    if (params.facultyId) q = q.eq('faculty_id', params.facultyId);
    if (params.departmentId) q = q.eq('department_id', params.departmentId);
    if (params.day) q = q.eq('day', params.day);
    if (params.roomId) q = q.eq('room_id', params.roomId);
    const { data, error } = await q;
    if (error) handleError(error, 'فشل تحميل الجداول');
    const schedules = (data || []).map(mapRow);
    // Merge schedule_sections
    if (schedules.length > 0) {
      const ids = schedules.map((s: any) => s.id);
      const { data: ssData } = await supabase.from('schedule_sections').select('*').in('schedule_id', ids);
      if (ssData) {
        const map = new Map<string, string[]>();
        for (const ss of ssData) {
          const arr = map.get(ss.schedule_id) || [];
          arr.push(ss.section_id);
          map.set(ss.schedule_id, arr);
        }
        for (const s of schedules) {
          s.sectionIds = map.get(s.id) || (s.sectionId ? [s.sectionId] : []);
        }
      }
    }
    return schedules;
  },
  createSchedule: async (data: any) => {
    const input = mapInput(data);
    const id = input.id || genId('sch');
    const sectionIds = input.section_ids || data.sectionIds || [];
    delete input.section_ids;
    delete input.sectionIds;
    const { data: row, error } = await supabase.from('schedules').insert({ ...input, id, is_deleted: false }).select().single();
    if (error) handleError(error, 'فشل إضافة الجدول');
    if (sectionIds.length > 0) {
      await supabase.from('schedule_sections').insert(
        sectionIds.map((sid: string) => ({ id: genId('ss'), schedule_id: id, section_id: sid }))
      );
    }
    return { success: true, data: mapRow(row) };
  },
  updateSchedule: async (id: string, data: any) => {
    const input = mapInput(data);
    input.updated_at = new Date().toISOString();
    const sectionIds = input.section_ids || data.sectionIds;
    delete input.section_ids;
    delete input.sectionIds;
    const { data: row, error } = await supabase.from('schedules').update(input).eq('id', id).select().single();
    if (error) handleError(error, 'فشل تعديل الجدول');
    if (sectionIds) {
      await supabase.from('schedule_sections').delete().eq('schedule_id', id);
      if (sectionIds.length > 0) {
        await supabase.from('schedule_sections').insert(
          sectionIds.map((sid: string) => ({ id: genId('ss'), schedule_id: id, section_id: sid }))
        );
      }
    }
    return { success: true, data: mapRow(row) };
  },
  deleteSchedule: async (id: string) => {
    const { error } = await supabase.from('schedules').update({ is_deleted: true, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) handleError(error, 'فشل حذف الجدول');
    return { success: true, message: 'تم حذف الجدول بنجاح' };
  },

  // ---------- Attendance ----------
  getAttendance: async (params: Record<string, string> = {}) => {
    let q = supabase.from('attendance_records').select('*').order('created_at', { ascending: false });
    if (params.date) q = q.eq('lecture_date', params.date);
    if (params.facultyId) q = q.eq('faculty_id', params.facultyId);
    const { data, error } = await q.limit(500);
    if (error) handleError(error, 'فشل تحميل سجلات الحضور');
    return (data || []).map(mapRow);
  },
  getAttendanceRecords: async (params: Record<string, string> = {}) => {
    return api.getAttendance(params);
  },
  recordAttendance: async (data: any) => {
    const input = mapInput(data);
    if (!input.id) input.id = genId('att');
    input.created_at = new Date().toISOString();
    input.updated_at = new Date().toISOString();
    const { data: row, error } = await supabase.from('attendance_records').insert(input).select().single();
    if (error) handleError(error, 'فشل تسجيل الحضور');
    return { success: true, data: mapRow(row) };
  },

  // ---------- Users ----------
  getUsers: async () => {
    const { data, error } = await supabase.from('users').select('id, uid, name, email, employee_id, role, role_title_ar, assigned_college_id, assigned_department_id, assigned_faculty_id, avatar, must_change_password, status, account_status, max_devices, token_version, created_at, updated_at');
    if (error) handleError(error, 'فشل تحميل المستخدمين');
    return (data || []).map(mapRow);
  },
  createUser: async (data: any) => {
    const token = getStoredToken();
    if (!token) throw new Error('غير مسجل الدخول');
    const { data: result, error } = await supabase.rpc('admin_create_user', {
      p_session_token: token,
      p_name: data.name,
      p_email: data.email,
      p_role: data.role,
      p_password: data.password,
      p_college_id: data.collegeId || data.assignedCollegeId || null,
      p_department_id: data.departmentId || data.assignedDepartmentId || null,
      p_faculty_id: data.facultyId || data.assignedFacultyId || null,
      p_employee_id: data.employeeId || null,
      p_max_devices: data.maxDevices || 1,
    });
    if (error) throw new Error('فشل إضافة المستخدم');
    if (!result?.success) throw new Error(result?.error || 'فشل إضافة المستخدم');
    return { success: true, data: result };
  },
  updateUser: async (id: string, data: any) => {
    const token = getStoredToken();
    if (!token) throw new Error('غير مسجل الدخول');
    const { data: result, error } = await supabase.rpc('admin_update_user', {
      p_session_token: token,
      p_user_id: id,
      p_name: data.name || null,
      p_role: data.role || null,
      p_college_id: data.collegeId || data.assignedCollegeId || null,
      p_department_id: data.departmentId || data.assignedDepartmentId || null,
      p_faculty_id: data.facultyId || data.assignedFacultyId || null,
      p_employee_id: data.employeeId || null,
      p_max_devices: data.maxDevices || null,
      p_password: data.password || null,
    });
    if (error) throw new Error('فشل تعديل المستخدم');
    if (!result?.success) throw new Error(result?.error || 'فشل تعديل المستخدم');
    return { success: true, data: result };
  },
  deleteUser: async (id: string) => {
    const token = getStoredToken();
    if (!token) throw new Error('غير مسجل الدخول');
    const { data: result, error } = await supabase.rpc('admin_disable_user', {
      p_session_token: token,
      p_user_id: id,
    });
    if (error) throw new Error('فشل تعطيل المستخدم');
    if (!result?.success) throw new Error(result?.error || 'فشل تعطيل المستخدم');
    return { success: true, message: result.message || 'تم تعطيل المستخدم' };
  },
  enableUser: async (id: string) => {
    const token = getStoredToken();
    if (!token) throw new Error('غير مسجل الدخول');
    const { data: result, error } = await supabase.rpc('admin_enable_user', {
      p_session_token: token,
      p_user_id: id,
    });
    if (error) throw new Error('فشل إعادة تفعيل المستخدم');
    if (!result?.success) throw new Error(result?.error || 'فشل إعادة تفعيل المستخدم');
    return { success: true, message: result.message || 'تم إعادة تفعيل المستخدم' };
  },

  // ---------- Audit Logs ----------
  getAuditLogs: async () => {
    const { data, error } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(200);
    if (error) handleError(error, 'فشل تحميل سجلات التدقيق');
    return (data || []).map(mapRow);
  },

  // ---------- Health ----------
  getHealth: async () => {
    const startTime = Date.now();
    const { error } = await supabase.from('system_settings').select('id').limit(1);
    const dbOk = !error;
    const latency = Date.now() - startTime;
    return {
      status: dbOk ? 'online' : 'degraded',
      database: dbOk ? 'PostgreSQL (Supabase)' : 'غير متصل',
      dbLatency: latency,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Baghdad',
      timestamp: new Date().toISOString(),
    };
  },
  getSystemStats: async () => {
    const tables = ['users', 'colleges', 'departments', 'faculties', 'subjects', 'schedules', 'attendance_records', 'audit_logs'];
    const stats: Record<string, number> = {};
    for (const t of tables) {
      const { count, error } = await supabase.from(t).select('id', { count: 'exact', head: true });
      stats[t] = error ? -1 : (count || 0);
    }
    return stats;
  },

  // ---------- Settings ----------
  getSettings: async () => {
    const { data, error } = await supabase.from('system_settings').select('*');
    if (error) handleError(error, 'فشل تحميل الإعدادات');
    const settings: Record<string, any> = {};
    for (const row of data || []) {
      try { settings[row.key] = JSON.parse(row.value); } catch { settings[row.key] = row.value; }
    }
    return settings;
  },
  updateSettings: async (key: string, value: any, description?: string) => {
    const valStr = typeof value === 'string' ? value : JSON.stringify(value);
    const { data: existing } = await supabase.from('system_settings').select('id').eq('key', key).maybeSingle();
    if (existing) {
      const { error } = await supabase.from('system_settings').update({ value: valStr, description, updated_at: new Date().toISOString() }).eq('key', key);
      if (error) handleError(error, 'فشل تحديث الإعدادات');
    } else {
      const { error } = await supabase.from('system_settings').insert({ id: genId('set'), key, value: valStr, description });
      if (error) handleError(error, 'فشل حفظ الإعدادات');
    }
    return { success: true };
  },

  // ---------- Academic Years ----------
  getAcademicYears: async () => {
    const { data, error } = await supabase.from('academic_years').select('*');
    if (error) handleError(error, 'فشل تحميل السنوات الدراسية');
    return (data || []).map(mapRow);
  },
  createAcademicYear: async (data: any) => {
    const input = mapInput(data);
    const id = input.id || genId('ay');
    const { data: row, error } = await supabase.from('academic_years').insert({ ...input, id }).select().single();
    if (error) handleError(error, 'فشل إضافة السنة الدراسية');
    return { success: true, data: mapRow(row) };
  },
  updateAcademicYear: async (id: string, data: any) => {
    const input = mapInput(data);
    input.updated_at = new Date().toISOString();
    if (input.is_current) {
      await supabase.from('academic_years').update({ is_current: false }).neq('id', id);
    }
    const { data: row, error } = await supabase.from('academic_years').update(input).eq('id', id).select().single();
    if (error) handleError(error, 'فشل تعديل السنة الدراسية');
    return { success: true, data: mapRow(row) };
  },
  deleteAcademicYear: async (id: string) => {
    const { error } = await supabase.from('academic_years').delete().eq('id', id);
    if (error) handleError(error, 'فشل حذف السنة الدراسية');
    return { success: true };
  },

  // ---------- Semesters ----------
  getSemesters: async () => {
    const { data, error } = await supabase.from('semesters').select('*');
    if (error) handleError(error, 'فشل تحميل الفصول الدراسية');
    return (data || []).map(mapRow);
  },
  createSemester: async (data: any) => {
    const input = mapInput(data);
    const id = input.id || genId('sem');
    const { data: row, error } = await supabase.from('semesters').insert({ ...input, id }).select().single();
    if (error) handleError(error, 'فشل إضافة الفصل الدراسي');
    return { success: true, data: mapRow(row) };
  },
  updateSemester: async (id: string, data: any) => {
    const input = mapInput(data);
    input.updated_at = new Date().toISOString();
    if (input.is_current) {
      await supabase.from('semesters').update({ is_current: false }).neq('id', id);
    }
    const { data: row, error } = await supabase.from('semesters').update(input).eq('id', id).select().single();
    if (error) handleError(error, 'فشل تعديل الفصل الدراسي');
    return { success: true, data: mapRow(row) };
  },
  deleteSemester: async (id: string) => {
    const { error } = await supabase.from('semesters').delete().eq('id', id);
    if (error) handleError(error, 'فشل حذف الفصل الدراسي');
    return { success: true };
  },

  // ---------- Notifications ----------
  getNotifications: async () => {
    const user = getStoredUser();
    let q = supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(50);
    if (user && user.role !== 'OWNER') {
      q = q.or(`user_id.eq.${user.id},user_id.is.null`);
    }
    const { data, error } = await q;
    if (error) handleError(error, 'فشل تحميل الإشعارات');
    return (data || []).map(mapRow);
  },
  createNotification: async (data: { title: string; message: string; type?: string; userId?: string }) => {
    const user = getStoredUser();
    const input: any = {
      id: genId('notif'),
      title: data.title,
      message: data.message,
      type: data.type || 'system',
      user_id: data.userId || user?.id || null,
      is_read: false,
    };
    const { data: row, error } = await supabase.from('notifications').insert(input).select().single();
    if (error) handleError(error, 'فشل إنشاء الإشعار');
    return { success: true, data: mapRow(row) };
  },
  markNotificationRead: async (id: string) => {
    const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    if (error) handleError(error, 'فشل تحديث الإشعار');
    return { success: true };
  },
  markAllNotificationsRead: async () => {
    const user = getStoredUser();
    let q = supabase.from('notifications').update({ is_read: true });
    if (user && user.role !== 'OWNER') {
      q = q.or(`user_id.eq.${user.id},user_id.is.null`);
    }
    const { error } = await q;
    if (error) handleError(error, 'فشل تحديث الإشعارات');
    return { success: true };
  },
  deleteNotification: async (id: string) => {
    const { error } = await supabase.from('notifications').delete().eq('id', id);
    if (error) handleError(error, 'فشل حذف الإشعار');
    return { success: true };
  },

  // ---------- Reports ----------
  getDailyAttendanceReport: async (date?: string) => {
    // Return attendance records for the given date with schedule info
    let q = supabase.from('attendance_records').select('*');
    if (date) q = q.eq('lecture_date', date);
    const { data: records, error } = await q.order('created_at', { ascending: false });
    if (error) handleError(error, 'فشل تحميل التقرير');
    return { records: (records || []).map(mapRow), date: date || new Date().toISOString().split('T')[0] };
  },

  // ---------- System ----------
  triggerBackup: async () => {
    const user = getStoredUser();
    const tables = ['users', 'colleges', 'departments', 'buildings', 'rooms', 'academic_years', 'semesters', 'stages', 'sections', 'subjects', 'faculties', 'schedules', 'schedule_sections', 'attendance_records', 'notifications', 'audit_logs', 'system_settings', 'import_jobs'];
    const backup: Record<string, any[]> = {};
    let totalRecords = 0;
    for (const t of tables) {
      const { data, error } = await supabase.from(t).select('*').limit(10000);
      if (!error && data) {
        backup[t] = data;
        totalRecords += data.length;
      }
    }
    const backupData = {
      metadata: {
        system: 'UOMUS',
        version: '1.0.0',
        createdAt: new Date().toISOString(),
        createdBy: user?.name || 'unknown',
        totalRecords,
        tablesCount: Object.keys(backup).length,
      },
      data: backup,
    };
    try {
      await supabase.from('audit_logs').insert({
        id: genId('audit'),
        user_id: user?.id || null,
        user_name: user?.name || 'unknown',
        user_role: user?.role || 'UNKNOWN',
        action: 'BACKUP',
        entity: 'system',
        entity_id: 'backup',
        reason: `نسخ احتياطي شامل (${totalRecords} سجل، ${Object.keys(backup).length} جدول)`,
      });
    } catch { /* best effort */ }
    return { success: true, data: backupData, message: `تم إنشاء نسخة احتياطية بنجاح (${totalRecords} سجل)` };
  },

  // ---------- University Settings ----------
  getUniversityInfo: async () => {
    const { data, error } = await supabase.from('system_settings').select('*').eq('key', 'university_info').maybeSingle();
    if (error) throw new Error('فشل تحميل بيانات الجامعة');
    if (data) {
      try {
        const parsed = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
        return parsed;
      } catch {
        return {};
      }
    }
    return {};
  },
  updateUniversityInfo: async (info: { name?: string; chancellor?: string; address?: string; phone?: string; email?: string; website?: string; logo?: string }) => {
    const user = getStoredUser();
    if (!user || user.role !== 'OWNER') throw new Error('غير مصرح: فقط مالك النظام يمكنه تعديل بيانات الجامعة');
    const valStr = JSON.stringify(info);
    const { data: existing } = await supabase.from('system_settings').select('id').eq('key', 'university_info').maybeSingle();
    if (existing) {
      const { error } = await supabase.from('system_settings').update({ value: valStr, description: 'بيانات الجامعة', updated_at: new Date().toISOString() }).eq('key', 'university_info');
      if (error) throw new Error('فشل حفظ بيانات الجامعة');
    } else {
      const { error } = await supabase.from('system_settings').insert({ id: genId('set'), key: 'university_info', value: valStr, description: 'بيانات الجامعة' });
      if (error) throw new Error('فشل حفظ بيانات الجامعة');
    }
    try {
      await supabase.from('audit_logs').insert({
        id: genId('audit'),
        user_id: user.id,
        user_name: user.name,
        user_role: user.role,
        action: 'UNIVERSITY_UPDATE',
        entity: 'system_settings',
        entity_id: 'university_info',
        reason: 'تحديث بيانات الجامعة',
      });
    } catch { /* best effort */ }
    return { success: true, message: 'تم حفظ بيانات الجامعة بنجاح' };
  },
  getEmailConfig: async () => {
    const { data, error } = await supabase.from('system_settings').select('*').eq('key', 'email_config').maybeSingle();
    if (error) return { configured: false };
    if (data) {
      try {
        const parsed = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
        return { configured: !!parsed.enabled, fromName: parsed.fromName || '', fromEmail: parsed.fromEmail || '', enabled: !!parsed.enabled, codeExpiryMinutes: parsed.codeExpiryMinutes || 10, resendCooldownSeconds: parsed.resendCooldownSeconds || 120 };
      } catch {
        return { configured: false };
      }
    }
    return { configured: false };
  },
  updateEmailConfig: async (config: { enabled?: boolean; fromName?: string; fromEmail?: string; codeExpiryMinutes?: number; resendCooldownSeconds?: number }) => {
    const user = getStoredUser();
    if (!user || user.role !== 'OWNER') throw new Error('غير مصرح: فقط مالك النظام يمكنه تعديل إعدادات البريد');
    const valStr = JSON.stringify(config);
    const { data: existing } = await supabase.from('system_settings').select('id').eq('key', 'email_config').maybeSingle();
    if (existing) {
      const { error } = await supabase.from('system_settings').update({ value: valStr, description: 'إعدادات البريد الإلكتروني', updated_at: new Date().toISOString() }).eq('key', 'email_config');
      if (error) throw new Error('فشل حفظ إعدادات البريد');
    } else {
      const { error } = await supabase.from('system_settings').insert({ id: genId('set'), key: 'email_config', value: valStr, description: 'إعدادات البريد الإلكتروني' });
      if (error) throw new Error('فشل حفظ إعدادات البريد');
    }
    return { success: true, message: 'تم حفظ إعدادات البريد بنجاح' };
  },
  getAccountSettings: async () => {
    const { data, error } = await supabase.from('system_settings').select('*').eq('key', 'account_settings').maybeSingle();
    if (error) return { selfRegistration: false, emailVerification: true, requireApproval: true, defaultMaxDevices: 1, passwordMinLength: 12 };
    if (data) {
      try {
        const parsed = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
        return parsed;
      } catch {
        return {};
      }
    }
    return { selfRegistration: false, emailVerification: true, requireApproval: true, defaultMaxDevices: 1, passwordMinLength: 12 };
  },
  updateAccountSettings: async (settings: { selfRegistration?: boolean; emailVerification?: boolean; requireApproval?: boolean; defaultMaxDevices?: number; passwordMinLength?: number }) => {
    const user = getStoredUser();
    if (!user || user.role !== 'OWNER') throw new Error('غير مصرح');
    const valStr = JSON.stringify(settings);
    const { data: existing } = await supabase.from('system_settings').select('id').eq('key', 'account_settings').maybeSingle();
    if (existing) {
      const { error } = await supabase.from('system_settings').update({ value: valStr, description: 'إعدادات الحسابات', updated_at: new Date().toISOString() }).eq('key', 'account_settings');
      if (error) throw new Error('فشل حفظ إعدادات الحسابات');
    } else {
      const { error } = await supabase.from('system_settings').insert({ id: genId('set'), key: 'account_settings', value: valStr, description: 'إعدادات الحسابات' });
      if (error) throw new Error('فشل حفظ إعدادات الحسابات');
    }
    return { success: true, message: 'تم حفظ إعدادات الحسابات بنجاح' };
  },

  // ---------- Import ----------
  getImportTemplate: async (entityType: string) => {
    const templates: Record<string, any> = {
      colleges: { entityType: 'colleges', columns: [
        { key: 'code', labelAr: 'رمز الكلية', required: true, example: 'ENG' },
        { key: 'nameAr', labelAr: 'اسم الكلية بالعربية', required: true, example: 'كلية الهندسة' },
        { key: 'nameEn', labelAr: 'الاسم بالإنجليزية', required: false, example: 'Engineering College' },
        { key: 'deanName', labelAr: 'اسم العميد', required: false, example: 'د. أحمد' },
        { key: 'phone', labelAr: 'الهاتف', required: false, example: '07901234567' },
        { key: 'email', labelAr: 'البريد', required: false, example: 'eng@uomus.edu.iq' },
      ], sampleData: [] },
      departments: { entityType: 'departments', columns: [
        { key: 'collegeCode', labelAr: 'رمز الكلية', required: true, example: 'ENG' },
        { key: 'code', labelAr: 'رمز القسم', required: true, example: 'CSE' },
        { key: 'nameAr', labelAr: 'اسم القسم بالعربية', required: true, example: 'قسم هندسة الحاسوب' },
        { key: 'headName', labelAr: 'رئيس القسم', required: false, example: 'د. محمد' },
      ], sampleData: [] },
      faculty: { entityType: 'faculty', columns: [
        { key: 'departmentCode', labelAr: 'رمز القسم', required: true, example: 'CSE' },
        { key: 'nameAr', labelAr: 'اسم التدريسي', required: true, example: 'د. أحمد علي' },
        { key: 'academicTitle', labelAr: 'اللقب العلمي', required: false, example: 'أستاذ مساعد' },
        { key: 'specialization', labelAr: 'التخصص', required: false, example: 'ذكاء اصطناعي' },
        { key: 'email', labelAr: 'البريد', required: false, example: 'ahmed@uomus.edu.iq' },
        { key: 'phone', labelAr: 'الهاتف', required: false, example: '07901234567' },
      ], sampleData: [] },
      subjects: { entityType: 'subjects', columns: [
        { key: 'departmentCode', labelAr: 'رمز القسم', required: true, example: 'CSE' },
        { key: 'stageName', labelAr: 'المرحلة', required: true, example: 'المرحلة الأولى' },
        { key: 'code', labelAr: 'رمز المادة', required: true, example: 'CSE101' },
        { key: 'nameAr', labelAr: 'اسم المادة', required: true, example: 'مقدمة في البرمجة' },
        { key: 'type', labelAr: 'النوع', required: false, example: 'نظري' },
        { key: 'theoreticalHours', labelAr: 'الساعات النظرية', required: false, example: '3' },
        { key: 'practicalHours', labelAr: 'الساعات العملية', required: false, example: '2' },
      ], sampleData: [] },
      buildings: { entityType: 'buildings', columns: [
        { key: 'code', labelAr: 'رمز المبنى', required: true, example: 'B1' },
        { key: 'nameAr', labelAr: 'اسم المبنى', required: true, example: 'مبنى الهندسة' },
        { key: 'floorsCount', labelAr: 'عدد الطوابق', required: false, example: '4' },
      ], sampleData: [] },
      rooms: { entityType: 'rooms', columns: [
        { key: 'buildingCode', labelAr: 'رمز المبنى', required: true, example: 'B1' },
        { key: 'collegeCode', labelAr: 'رمز الكلية', required: true, example: 'ENG' },
        { key: 'code', labelAr: 'رمز القاعة', required: true, example: 'R101' },
        { key: 'nameAr', labelAr: 'اسم القاعة', required: true, example: 'قاعة 101' },
        { key: 'capacity', labelAr: 'السعة', required: false, example: '60' },
        { key: 'type', labelAr: 'النوع', required: false, example: 'نظري' },
      ], sampleData: [] },
      schedules: { entityType: 'schedules', columns: [
        { key: 'departmentCode', labelAr: 'رمز القسم', required: true, example: 'CSE' },
        { key: 'subjectCode', labelAr: 'رمز المادة', required: true, example: 'CSE101' },
        { key: 'facultyName', labelAr: 'اسم التدريسي', required: true, example: 'د. أحمد علي' },
        { key: 'sectionName', labelAr: 'اسم الشعبة', required: true, example: 'أ' },
        { key: 'roomCode', labelAr: 'رمز القاعة', required: true, example: 'R101' },
        { key: 'day', labelAr: 'اليوم', required: true, example: 'الأحد' },
        { key: 'startTime', labelAr: 'وقت البدء', required: true, example: '08:30' },
        { key: 'endTime', labelAr: 'وقت الانتهاء', required: true, example: '10:00' },
        { key: 'lectureType', labelAr: 'نوع المحاضرة', required: false, example: 'نظري' },
      ], sampleData: [] },
    };
    return templates[entityType] || { entityType, columns: [], sampleData: [] };
  },

  importEntity: async (entityType: string, rows: any[], fileName?: string) => {
    let created = 0;
    let updated = 0;
    const errors: string[] = [];
    const tableMap: Record<string, string> = {
      colleges: 'colleges', departments: 'departments', faculty: 'faculties',
      subjects: 'subjects', buildings: 'buildings', rooms: 'rooms', schedules: 'schedules',
    };
    const table = tableMap[entityType];
    if (!table) throw new Error('نوع الاستيراد غير مدعوم');

    for (let i = 0; i < rows.length; i++) {
      try {
        const input = mapInput(rows[i]);
        input.id = genId(entityType.slice(0, 3));
        input.is_deleted = false;
        const { error } = await supabase.from(table).insert(input);
        if (error) {
          errors.push(`الصف ${i + 2}: ${error.message}`);
        } else {
          created++;
        }
      } catch (e: any) {
        errors.push(`الصف ${i + 2}: ${e.message}`);
      }
    }

    const jobId = genId('job');
    await supabase.from('import_jobs').insert({
      id: jobId,
      file_name: fileName || 'manual',
      import_type: entityType,
      status: errors.length > 0 ? 'COMPLETED_WITH_ERRORS' : 'COMPLETED',
      total_rows: rows.length,
      rows_created: created,
      rows_failed: errors.length,
      error_summary: errors.slice(0, 10).join('; '),
      created_at: new Date().toISOString(),
    });

    return {
      success: true,
      message: `تم استيراد ${created} عنصر${errors.length > 0 ? ` مع ${errors.length} خطأ` : ''}`,
      count: created,
      created,
      updated,
      entityType,
      jobId,
    };
  },

  importDepartmentPackage: async (packageData: any, options: { dryRun?: boolean } = {}) => {
    if (options.dryRun) {
      return {
        success: true,
        dryRun: true,
        message: 'معاينة الاستيراد',
        stats: {
          stages: packageData.stages?.length || 0,
          sections: packageData.sections?.length || 0,
          subjects: packageData.subjects?.length || 0,
          faculty: packageData.faculty?.length || 0,
          schedules: packageData.schedules?.length || 0,
        },
      };
    }
    return { success: true, message: 'استيراد الحزمة غير متاح في وضع المعاينة', stats: {} };
  },

  getImportJobs: async () => {
    const { data, error } = await supabase.from('import_jobs').select('*').order('created_at', { ascending: false }).limit(50);
    if (error) handleError(error, 'فشل تحميل مهام الاستيراد');
    return (data || []).map(mapRow);
  },

  exportDepartmentPackage: async (departmentId: string) => {
    const { data: dept } = await supabase.from('departments').select('*').eq('id', departmentId).maybeSingle();
    const { data: stages } = await supabase.from('stages').select('*').eq('department_id', departmentId).eq('is_deleted', false);
    const { data: sections } = await supabase.from('sections').select('*').eq('department_id', departmentId).eq('is_deleted', false);
    const { data: subjects } = await supabase.from('subjects').select('*').eq('department_id', departmentId).eq('is_deleted', false);
    const { data: faculty } = await supabase.from('faculties').select('*').eq('department_id', departmentId).eq('is_deleted', false);
    const { data: schedules } = await supabase.from('schedules').select('*').eq('department_id', departmentId).eq('is_deleted', false);

    return {
      department: dept ? mapRow(dept) : null,
      stages: (stages || []).map(mapRow),
      sections: (sections || []).map(mapRow),
      subjects: (subjects || []).map(mapRow),
      faculty: (faculty || []).map(mapRow),
      schedules: (schedules || []).map(mapRow),
    };
  },

  // ---------- Registration Requests ----------
  createRegistrationRequest: async (data: { name: string; email: string; password: string; requestedRole: string; collegeId?: string; departmentId?: string }) => {
    const email = data.email.trim().toLowerCase();

    const { data: existingUser } = await supabase.from('users').select('id').eq('email', email).maybeSingle();
    if (existingUser) throw new Error('البريد الإلكتروني مسجل بالفعل في النظام');

    const { data: existingReq } = await supabase.from('registration_requests')
      .select('id, status').eq('email', email).in('status', ['pending_email', 'pending_approval']).maybeSingle();
    if (existingReq) throw new Error('يوجد طلب تسجيل قيد المراجعة لهذا البريد الإلكتروني');

    const { data: hashData, error: hashErr } = await supabase.rpc('hash_password', { p_password: data.password });
    if (hashErr || !hashData) throw new Error('فشل تشفير كلمة المرور');

    const id = genId('reg');
    const { error } = await supabase.from('registration_requests').insert({
      id,
      name: data.name,
      email,
      password_hash: hashData,
      requested_role: data.requestedRole,
      college_id: data.collegeId || null,
      department_id: data.departmentId || null,
      status: 'pending_email',
    });
    if (error) throw new Error('فشل إنشاء طلب التسجيل: ' + error.message);

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    try {
      await fetch(`${supabaseUrl}/functions/v1/send-verification-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseAnonKey}` },
        body: JSON.stringify({ email, name: data.name }),
      });
    } catch { /* email sending is best-effort */ }

    return { success: true, requestId: id, message: 'تم إنشاء طلب التسجيل. يرجى إدخال رمز التحقق المرسل إلى بريدك الإلكتروني' };
  },

  resendVerificationCode: async (email: string) => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    try {
      await fetch(`${supabaseUrl}/functions/v1/send-verification-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseAnonKey}` },
        body: JSON.stringify({ email }),
      });
    } catch { /* best-effort */ }

    return { success: true, message: 'تم إرسال رمز تحقق جديد' };
  },

  verifyEmailCode: async (email: string, code: string, requestId: string) => {
    const { data, error } = await supabase.rpc('verify_email_code', {
      p_email: email.trim().toLowerCase(),
      p_code: code,
      p_request_id: requestId,
    });
    if (error) throw new Error('فشل التحقق من الرمز');
    if (!data?.success) throw new Error(data?.error || 'رمز التحقق غير صحيح');
    return { success: true, message: data.message };
  },

  getRegistrationRequests: async (status?: string) => {
    let q = supabase.from('registration_requests').select('*').order('created_at', { ascending: false });
    if (status) q = q.eq('status', status);
    const { data, error } = await q.limit(100);
    if (error) handleError(error, 'فشل تحميل طلبات التسجيل');
    return (data || []).map(mapRow);
  },

  approveRegistration: async (requestId: string, _reviewer: { id: string; name: string }, options: { role?: string; collegeId?: string; departmentId?: string; facultyId?: string }) => {
    const token = getStoredToken();
    if (!token) throw new Error('غير مسجل الدخول');
    const { data, error } = await supabase.rpc('approve_registration', {
      p_session_token: token,
      p_request_id: requestId,
      p_role: options.role || null,
      p_college_id: options.collegeId || null,
      p_department_id: options.departmentId || null,
      p_faculty_id: options.facultyId || null,
    });
    if (error) throw new Error('فشل الموافقة على الطلب');
    if (!data?.success) throw new Error(data?.error || 'فشل الموافقة');
    return { success: true, message: data.message };
  },

  rejectRegistration: async (requestId: string, _reviewer: { id: string; name: string }, reason: string) => {
    const token = getStoredToken();
    if (!token) throw new Error('غير مسجل الدخول');
    const { data, error } = await supabase.rpc('reject_registration', {
      p_session_token: token,
      p_request_id: requestId,
      p_reason: reason,
    });
    if (error) throw new Error('فشل رفض الطلب');
    if (!data?.success) throw new Error(data?.error || 'فشل رفض الطلب');
    return { success: true, message: data.message };
  },

  // ---------- Device Management ----------
  getUserDevices: async (userId?: string) => {
    let q = supabase.from('user_devices').select('*').order('created_at', { ascending: false });
    if (userId) q = q.eq('user_id', userId);
    const { data, error } = await q.limit(200);
    if (error) handleError(error, 'فشل تحميل الأجهزة');
    return (data || []).map(mapRow);
  },

  registerDevice: async (userId: string, fingerprint: string, deviceName: string) => {
    const { data: existing } = await supabase.from('user_devices')
      .select('id, status').eq('user_id', userId).eq('device_fingerprint', fingerprint).maybeSingle();
    if (existing) {
      if (existing.status === 'approved') return { success: true, status: 'approved', message: 'الجهاز معتمد' };
      if (existing.status === 'pending') return { success: true, status: 'pending', message: 'الجهاز بانتظار الاعتماد' };
      if (existing.status === 'revoked') throw new Error('تم إلغاء اعتماد هذا الجهاز. يرجى مراجعة الإدارة');
    }

    const { data: user } = await supabase.from('users').select('max_devices').eq('id', userId).maybeSingle();
    const maxDevices = user?.max_devices || 1;
    const { count } = await supabase.from('user_devices').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'approved');
    if ((count || 0) >= maxDevices) {
      return { success: false, status: 'limit_reached', message: `تم الوصول إلى الحد الأقصى للأجهزة (${maxDevices}). يرجى مراجعة الإدارة لاستبدال جهاز` };
    }

    const id = genId('dev');
    const { error } = await supabase.from('user_devices').insert({
      id, user_id: userId, device_fingerprint: fingerprint, device_name: deviceName,
      user_agent: navigator.userAgent, status: 'pending',
    });
    if (error) throw new Error('فشل تسجيل الجهاز');
    return { success: true, status: 'pending', message: 'تم تسجيل الجهاز وهو بانتظار اعتماد الإدارة' };
  },

  approveDevice: async (deviceId: string, _approver: { id: string; name: string }) => {
    const token = getStoredToken();
    if (!token) throw new Error('غير مسجل الدخول');
    const { data, error } = await supabase.rpc('approve_device', {
      p_session_token: token, p_device_id: deviceId,
    });
    if (error) throw new Error('فشل اعتماد الجهاز');
    if (!data?.success) throw new Error(data?.error || 'فشل اعتماد الجهاز');
    return { success: true, message: data.message };
  },

  revokeDevice: async (deviceId: string, _revoker: { id: string; name: string }) => {
    const token = getStoredToken();
    if (!token) throw new Error('غير مسجل الدخول');
    const { data, error } = await supabase.rpc('revoke_device', {
      p_session_token: token, p_device_id: deviceId,
    });
    if (error) throw new Error('فشل إلغاء اعتماد الجهاز');
    if (!data?.success) throw new Error(data?.error || 'فشل إلغاء اعتماد الجهاز');
    return { success: true, message: data.message };
  },

  getDeviceFingerprint: () => {
    const components = [
      navigator.userAgent,
      navigator.language,
      screen.width + 'x' + screen.height + 'x' + screen.colorDepth,
      new Date().getTimezoneOffset().toString(),
      navigator.hardwareConcurrency?.toString() || '0',
      (navigator as any).deviceMemory?.toString() || '0',
    ];
    return btoa(components.join('|'));
  },
};
