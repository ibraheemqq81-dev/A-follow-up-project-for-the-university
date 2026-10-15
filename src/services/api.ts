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
// Import helper: build lookup maps for FK resolution
// ============================================================

async function buildCollegeCodeMap(): Promise<Map<string, string>> {
  const { data } = await supabase.from('colleges').select('id, code').eq('is_deleted', false);
  const m = new Map<string, string>();
  (data || []).forEach((r: any) => { if (r.code) m.set(r.code.toUpperCase(), r.id); });
  return m;
}

async function buildDeptCodeMap(): Promise<Map<string, string>> {
  const { data } = await supabase.from('departments').select('id, code, college_id').eq('is_deleted', false);
  const m = new Map<string, string>();
  (data || []).forEach((r: any) => {
    if (r.code) {
      m.set(r.code.toUpperCase(), r.id);
      m.set(r.code.toUpperCase() + '__college', r.college_id);
    }
  });
  return m;
}

async function buildBuildingCodeMap(): Promise<Map<string, string>> {
  const { data } = await supabase.from('buildings').select('id, code').eq('is_deleted', false);
  const m = new Map<string, string>();
  (data || []).forEach((r: any) => { if (r.code) m.set(r.code.toUpperCase(), r.id); });
  return m;
}

async function buildDeptStageMap(): Promise<Map<string, string>> {
  const { data } = await supabase.from('stages').select('id, department_id, year_number').eq('is_deleted', false);
  const m = new Map<string, string>();
  (data || []).forEach((r: any) => { m.set(`${r.department_id}:${r.year_number}`, r.id); });
  return m;
}

async function buildDeptSubjectMap(): Promise<Map<string, string>> {
  const { data } = await supabase.from('subjects').select('id, department_id, code').eq('is_deleted', false);
  const m = new Map<string, string>();
  (data || []).forEach((r: any) => { if (r.code) m.set(`${r.department_id}:${r.code.toUpperCase()}`, r.id); });
  return m;
}

async function buildDeptFacultyMap(): Promise<Map<string, string>> {
  const { data } = await supabase.from('faculties').select('id, department_id, name_ar').eq('is_deleted', false);
  const m = new Map<string, string>();
  (data || []).forEach((r: any) => { if (r.name_ar) m.set(`${r.department_id}:${r.name_ar.trim()}`, r.id); });
  return m;
}

async function buildRoomCodeMap(): Promise<Map<string, string>> {
  const { data } = await supabase.from('rooms').select('id, code').eq('is_deleted', false);
  const m = new Map<string, string>();
  (data || []).forEach((r: any) => { if (r.code) m.set(r.code.toUpperCase(), r.id); });
  return m;
}

async function buildDeptStageSectionMap(): Promise<Map<string, string>> {
  const { data: sections } = await supabase.from('sections').select('id, department_id, stage_id, name').eq('is_deleted', false);
  const { data: stages } = await supabase.from('stages').select('id, department_id, year_number').eq('is_deleted', false);
  const stageByDeptYear = new Map<string, string>();
  (stages || []).forEach((s: any) => { stageByDeptYear.set(`${s.department_id}:${s.year_number}`, s.id); });
  const m = new Map<string, string>();
  (sections || []).forEach((sec: any) => {
    const stage = (stages || []).find((s: any) => s.id === sec.stage_id);
    if (stage) {
      m.set(`${sec.department_id}:${stage.year_number}:${sec.name.trim()}`, sec.id);
    }
  });
  return m;
}

// Combined colleges + departments importer
async function importCollegesDepartments(rows: any[], fileName: string | undefined, user: any) {
  const errors: Array<{ row: number; field: string; message: string }> = [];
  let created = 0;
  let updated = 0;

  // Pre-load existing colleges by code
  const existingColleges = await supabase.from('colleges').select('id, code, name_ar').eq('is_deleted', false);
  const collegeByCode = new Map<string, string>();
  const collegeByName = new Map<string, string>();
  (existingColleges.data || []).forEach((c: any) => {
    if (c.code) collegeByCode.set(c.code.toUpperCase(), c.id);
    if (c.name_ar) collegeByName.set(c.name_ar.trim(), c.id);
  });

  // Track which colleges we've already created in this import
  const createdColleges = new Map<string, string>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;

    const collegeCode = String(row.collegeCode || '').trim();
    const collegeNameAr = String(row.collegeNameAr || '').trim();
    const deptCode = String(row.departmentCode || '').trim();
    const deptNameAr = String(row.departmentNameAr || '').trim();

    if (!collegeCode && !collegeNameAr && !deptCode && !deptNameAr) {
      errors.push({ row: rowNum, field: '—', message: 'صف فارغ' });
      continue;
    }

    if (!collegeCode) { errors.push({ row: rowNum, field: 'رمز الكلية', message: 'رمز الكلية مطلوب' }); continue; }
    if (!collegeNameAr) { errors.push({ row: rowNum, field: 'اسم الكلية', message: 'اسم الكلية مطلوب' }); continue; }
    if (!deptCode) { errors.push({ row: rowNum, field: 'رمز القسم', message: 'رمز القسم مطلوب' }); continue; }
    if (!deptNameAr) { errors.push({ row: rowNum, field: 'اسم القسم', message: 'اسم القسم مطلوب' }); continue; }

    // Find or create college (don't duplicate if already exists or created earlier in this import)
    let collegeId = createdColleges.get(collegeCode.toUpperCase()) || collegeByCode.get(collegeCode.toUpperCase());
    if (!collegeId && collegeNameAr) { collegeId = collegeByName.get(collegeNameAr); }

    if (!collegeId) {
      // Create the college
      const collegeInput: any = {
        id: genId('col'),
        code: collegeCode,
        name_ar: collegeNameAr,
        name_en: String(row.collegeNameEn || '').trim() || null,
        dean_name: String(row.deanName || '').trim() || null,
        phone: String(row.collegePhone || '').trim() || null,
        email: String(row.collegeEmail || '').trim() || null,
        is_deleted: false,
      };
      const { data: newCol, error: colErr } = await supabase.from('colleges').insert(collegeInput).select().single();
      if (colErr) { errors.push({ row: rowNum, field: 'الكلية', message: `فشل إنشاء الكلية: ${colErr.message}` }); continue; }
      collegeId = newCol.id;
      createdColleges.set(collegeCode.toUpperCase(), collegeId);
      collegeByCode.set(collegeCode.toUpperCase(), collegeId);
      created++;
    }

    // Check if department already exists
    const { data: existingDept } = await supabase.from('departments').select('id').eq('college_id', collegeId).eq('code', deptCode).eq('is_deleted', false).maybeSingle();
    if (existingDept) {
      errors.push({ row: rowNum, field: 'رمز القسم', message: `القسم "${deptCode}" موجود بالفعل في هذه الكلية` });
      continue;
    }

    // Create the department
    const deptInput: any = {
      id: genId('dept'),
      college_id: collegeId,
      code: deptCode,
      name_ar: deptNameAr,
      name_en: String(row.departmentNameEn || '').trim() || null,
      head_name: String(row.headName || '').trim() || null,
      is_deleted: false,
    };
    const { error: deptErr } = await supabase.from('departments').insert(deptInput);
    if (deptErr) {
      errors.push({ row: rowNum, field: 'القسم', message: `فشل إنشاء القسم: ${deptErr.message}` });
    } else {
      created++;
    }
  }

  const jobId = genId('job');
  await supabase.from('import_jobs').insert({
    id: jobId,
    file_name: fileName || 'manual',
    import_type: 'colleges_departments',
    status: errors.length > 0 ? 'COMPLETED_WITH_ERRORS' : 'COMPLETED',
    total_rows: rows.length,
    rows_processed: rows.length,
    rows_created: created,
    rows_failed: errors.length,
    uploaded_by_user_id: user?.id || null,
    error_summary: errors.slice(0, 10).map((e) => `الصف ${e.row}: ${e.message}`).join('; '),
    created_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
  });

  if (created === 0) {
    return { success: false, message: `لم يتم استيراد أي بيانات. ${errors.length} خطأ.`, count: 0, created: 0, updated: 0, jobId, errors };
  }
  return {
    success: true,
    message: errors.length > 0 ? `تم استيراد ${created} سجل بنجاح مع ${errors.length} خطأ.` : `تم استيراد ${created} سجل بنجاح تام.`,
    count: created, created, updated, jobId,
    errors: errors.length > 0 ? errors : undefined,
  };
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

  // ---------- Backup & Restore ----------
  getBackups: async () => {
    const { data, error } = await supabase
      .from('system_backups')
      .select('id, name, type, status, format_version, size_bytes, total_records, tables_count, tables_included, checksum, created_by, created_by_name, created_at, verified_at, verified_by, verification_result, restored_at, restored_by, restore_result, notes')
      .order('created_at', { ascending: false });
    if (error) handleError(error, 'فشل تحميل قائمة النسخ الاحتياطية');
    return (data || []).map(mapRow);
  },

  createBackup: async (notes?: string) => {
    const user = getStoredUser();
    if (!user || user.role !== 'OWNER') throw new Error('غير مصرح: فقط مالك النظام يمكنه إنشاء نسخة احتياطية');

    const backupId = genId('bkp');
    const timestamp = new Date().toISOString();
    const tables = ['users', 'colleges', 'departments', 'buildings', 'rooms', 'academic_years', 'semesters', 'stages', 'sections', 'subjects', 'faculties', 'schedules', 'schedule_sections', 'lecture_sessions', 'attendance_records', 'attendance_section_records', 'attendance_evidence', 'workload_policies', 'academic_exceptions', 'substitutions', 'co_teaching', 'notifications', 'audit_logs', 'system_settings', 'import_jobs', 'import_errors', 'registration_requests', 'email_verifications', 'user_devices', 'session_tokens', 'change_requests', 'change_request_decisions', 'academic_calendar_events', 'roles', 'permissions', 'role_permissions', 'user_permissions', 'dean_updates'];

    const backup: Record<string, any[]> = {};
    let totalRecords = 0;

    for (const t of tables) {
      const { data, error: tableErr } = await supabase.from(t).select('*').limit(50000);
      if (!tableErr && data && data.length > 0) {
        backup[t] = data;
        totalRecords += data.length;
      }
    }

    const tablesIncluded = Object.keys(backup);
    const backupPayload = {
      backupId,
      version: '2.0.0',
      system: 'UOMUS',
      university: 'جامعة المستقبل - Al-Mustaqbal University',
      createdAt: timestamp,
      createdBy: user.name,
      createdById: user.id,
      totalRecords,
      tablesCount: tablesIncluded.length,
      tablesIncluded,
      data: backup,
    };

    const payloadString = JSON.stringify(backupPayload);
    const sizeBytes = new Blob([payloadString]).size;

    const checksumBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payloadString));
    const checksum = Array.from(new Uint8Array(checksumBuf)).map((b) => b.toString(16).padStart(2, '0')).join('');

    const { error: insertErr } = await supabase.from('system_backups').insert({
      id: backupId,
      name: `نسخة احتياطية - ${new Date().toLocaleString('ar-IQ')}`,
      type: 'full',
      status: 'completed',
      format_version: '2.0.0',
      size_bytes: sizeBytes,
      total_records: totalRecords,
      tables_count: tablesIncluded.length,
      tables_included: tablesIncluded,
      checksum,
      backup_data: backupPayload,
      created_by: user.id,
      created_by_name: user.name,
      notes: notes || null,
    });

    if (insertErr) throw new Error('فشل حفظ النسخة الاحتياطية: ' + insertErr.message);

    await supabase.from('audit_logs').insert({
      id: genId('audit'),
      user_id: user.id,
      user_name: user.name,
      user_role: user.role,
      action: 'BACKUP_CREATED',
      entity: 'system_backups',
      entity_id: backupId,
      reason: `إنشاء نسخة احتياطية (${totalRecords} سجل، ${tablesIncluded.length} جدول)`,
    });

    await supabase.from('backup_audit_log').insert({
      id: genId('baud'),
      backup_id: backupId,
      backup_name: `نسخة احتياطية - ${new Date().toLocaleString('ar-IQ')}`,
      action: 'BACKUP_CREATED',
      user_id: user.id,
      user_name: user.name,
      user_role: user.role,
      result: 'success',
      details: { totalRecords, tablesCount: tablesIncluded.length, sizeBytes },
    });

    return { success: true, backupId, message: `تم إنشاء النسخة الاحتياطية بنجاح (${totalRecords} سجل، ${tablesIncluded.length} جدول)` };
  },

  getBackupDetails: async (backupId: string) => {
    const { data, error } = await supabase
      .from('system_backups')
      .select('*')
      .eq('id', backupId)
      .maybeSingle();
    if (error) handleError(error, 'فشل تحميل تفاصيل النسخة');
    if (!data) throw new Error('النسخة الاحتياطية غير موجودة');
    return mapRow(data);
  },

  verifyBackup: async (backupId: string) => {
    const user = getStoredUser();
    if (!user || user.role !== 'OWNER') throw new Error('غير مصرح: فقط مالك النظام يمكنه التحقق من النسخة');

    const { data: backup, error } = await supabase
      .from('system_backups')
      .select('*')
      .eq('id', backupId)
      .maybeSingle();
    if (error || !backup) throw new Error('النسخة الاحتياطية غير موجودة');

    await supabase.from('system_backups').update({ status: 'verifying' }).eq('id', backupId);

    const issues: string[] = [];
    let valid = true;

    if (!backup.backup_data) { issues.push('بيانات النسخة مفقودة'); valid = false; }
    if (!backup.checksum) { issues.push('بصمة السلامة مفقودة'); valid = false; }

    if (backup.backup_data) {
      const payloadStr = JSON.stringify(backup.backup_data);
      const checksumBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payloadStr));
      const computedChecksum = Array.from(new Uint8Array(checksumBuf)).map((b) => b.toString(16).padStart(2, '0')).join('');

      if (computedChecksum !== backup.checksum) {
        issues.push('بصمة السلامة غير متطابقة - البيانات قد تكون تالفة');
        valid = false;
      }

      const bd = backup.backup_data as any;
      if (!bd.version || !bd.createdAt || !bd.data) {
        issues.push('بنية النسخة غير مكتملة');
        valid = false;
      }
      if (bd.version && !bd.version.startsWith('2.')) {
        issues.push(`إصدار تنسيق غير مدعوم: ${bd.version}`);
        valid = false;
      }
    }

    const verificationResult = { valid, issues, verifiedAt: new Date().toISOString(), verifiedBy: user.name };

    await supabase.from('system_backups').update({
      status: valid ? 'valid' : 'invalid',
      verified_at: new Date().toISOString(),
      verified_by: user.id,
      verification_result: verificationResult,
    }).eq('id', backupId);

    await supabase.from('backup_audit_log').insert({
      id: genId('baud'),
      backup_id: backupId,
      backup_name: backup.name,
      action: valid ? 'BACKUP_VERIFIED' : 'BACKUP_VERIFICATION_FAILED',
      user_id: user.id,
      user_name: user.name,
      user_role: user.role,
      result: valid ? 'success' : 'failed',
      error_message: valid ? null : issues.join('; '),
      details: verificationResult,
    });

    return { success: true, valid, issues, message: valid ? 'النسخة سليمة وصالحة للاستعادة' : 'النسخة غير صالحة: ' + issues.join('; ') };
  },

  downloadBackup: async (backupId: string) => {
    const user = getStoredUser();
    const { data: backup, error } = await supabase
      .from('system_backups')
      .select('*')
      .eq('id', backupId)
      .maybeSingle();
    if (error || !backup) throw new Error('النسخة الاحتياطية غير موجودة');

    const payloadStr = JSON.stringify(backup.backup_data, null, 2);
    const blob = new Blob([payloadStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_${backup.id}_${new Date(backup.created_at).toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    await supabase.from('backup_audit_log').insert({
      id: genId('baud'),
      backup_id: backupId,
      backup_name: backup.name,
      action: 'BACKUP_DOWNLOADED',
      user_id: user?.id || null,
      user_name: user?.name || 'unknown',
      user_role: user?.role || 'UNKNOWN',
      result: 'success',
    });

    return { success: true };
  },

  restoreBackup: async (backupId: string) => {
    const user = getStoredUser();
    if (!user || user.role !== 'OWNER') throw new Error('غير مصرح: فقط مالك النظام يمكنه استعادة النسخة');

    const { data: backup, error } = await supabase
      .from('system_backups')
      .select('*')
      .eq('id', backupId)
      .maybeSingle();
    if (error || !backup) throw new Error('النسخة الاحتياطية غير موجودة');
    if (backup.status !== 'valid' && backup.status !== 'completed') {
      throw new Error('النسخة غير صالحة للاستعادة. يرجى التحقق من سلامتها أولاً');
    }

    await supabase.from('system_backups').update({ status: 'restoring' }).eq('id', backupId);

    await supabase.from('backup_audit_log').insert({
      id: genId('baud'),
      backup_id: backupId,
      backup_name: backup.name,
      action: 'RESTORE_STARTED',
      user_id: user.id,
      user_name: user.name,
      user_role: user.role,
      result: 'success',
    });

    try {
      const bd = backup.backup_data as any;
      if (!bd || !bd.data) throw new Error('بيانات النسخة تالفة أو غير مكتملة');

      const restoreOrder = [
        'colleges', 'departments', 'buildings', 'rooms',
        'academic_years', 'semesters', 'stages', 'sections', 'subjects', 'faculties',
        'schedules', 'schedule_sections', 'lecture_sessions',
        'attendance_records', 'attendance_section_records', 'attendance_evidence',
        'workload_policies', 'academic_exceptions', 'substitutions', 'co_teaching',
        'notifications', 'system_settings', 'import_jobs', 'import_errors',
        'registration_requests', 'email_verifications', 'user_devices',
        'change_requests', 'change_request_decisions', 'academic_calendar_events',
        'roles', 'permissions', 'role_permissions', 'user_permissions', 'dean_updates',
        'users', 'session_tokens', 'audit_logs',
      ];

      const results: Record<string, { inserted: number; errors: string[] }> = {};
      let totalInserted = 0;
      const allErrors: string[] = [];

      for (const tableName of restoreOrder) {
        const rows = bd.data[tableName];
        if (!rows || !Array.isArray(rows) || rows.length === 0) continue;

        let inserted = 0;
        const tableErrors: string[] = [];

        const { error: delErr } = await supabase.from(tableName).delete().neq('id', '___never___');
        if (delErr) {
          tableErrors.push(`فشل مسح الجدول: ${delErr.message}`);
        }

        if (tableErrors.length === 0) {
          for (const row of rows) {
            const rowCopy = { ...row };
            for (const key of Object.keys(rowCopy)) {
              if (rowCopy[key] === null) delete rowCopy[key];
            }
            const { error: insErr } = await supabase.from(tableName).insert(rowCopy);
            if (insErr) {
              tableErrors.push(`${insErr.message}`);
            } else {
              inserted++;
            }
          }
        }

        results[tableName] = { inserted, errors: tableErrors };
        totalInserted += inserted;
        if (tableErrors.length > 0) allErrors.push(`${tableName}: ${tableErrors.length} خطأ`);
      }

      const restoreResult = {
        totalInserted,
        tablesRestored: Object.keys(results).length,
        results,
        errors: allErrors,
        restoredAt: new Date().toISOString(),
        restoredBy: user.name,
      };

      await supabase.from('system_backups').update({
        status: 'restored',
        restored_at: new Date().toISOString(),
        restored_by: user.id,
        restore_result: restoreResult,
      }).eq('id', backupId);

      await supabase.from('backup_audit_log').insert({
        id: genId('baud'),
        backup_id: backupId,
        backup_name: backup.name,
        action: 'RESTORE_SUCCEEDED',
        user_id: user.id,
        user_name: user.name,
        user_role: user.role,
        result: 'success',
        details: { totalInserted, tablesRestored: Object.keys(results).length },
      });

      await supabase.from('audit_logs').insert({
        id: genId('audit'),
        user_id: user.id,
        user_name: user.name,
        user_role: user.role,
        action: 'RESTORE_COMPLETED',
        entity: 'system_backups',
        entity_id: backupId,
        reason: `استعادة نسخة احتياطية (${totalInserted} سجل)`,
      });

      const hasErrors = allErrors.length > 0;
      return {
        success: true,
        totalInserted,
        tablesRestored: Object.keys(results).length,
        errors: allErrors,
        message: hasErrors
          ? `تمت الاستعادة مع ${allErrors.length} أخطاء (${totalInserted} سجل مستعد)`
          : `تمت الاستعادة بنجاح (${totalInserted} سجل، ${Object.keys(results).length} جدول)`,
      };
    } catch (restoreErr: any) {
      await supabase.from('system_backups').update({
        status: 'restore_failed',
        restore_result: { error: restoreErr.message, restoredAt: new Date().toISOString() },
      }).eq('id', backupId);

      await supabase.from('backup_audit_log').insert({
        id: genId('baud'),
        backup_id: backupId,
        backup_name: backup.name,
        action: 'RESTORE_FAILED',
        user_id: user.id,
        user_name: user.name,
        user_role: user.role,
        result: 'failed',
        error_message: restoreErr.message,
      });

      throw new Error('فشلت الاستعادة: ' + restoreErr.message);
    }
  },

  uploadBackup: async (file: File) => {
    const user = getStoredUser();
    if (!user || user.role !== 'OWNER') throw new Error('غير مصرح: فقط مالك النظام يمكنه رفع نسخة احتياطية');

    if (file.size > 100 * 1024 * 1024) throw new Error('حجم الملف يتجاوز الحد الأقصى (100 ميجابايت)');
    if (!file.name.endsWith('.json')) throw new Error('الملف يجب أن يكون بصيغة JSON');

    const text = await file.text();
    let parsed: any;
    try { parsed = JSON.parse(text); }
    catch { throw new Error('الملف ليس JSON صالح'); }

    if (!parsed || !parsed.data || !parsed.version || !parsed.createdAt) {
      throw new Error('بنية الملف غير متوافقة مع نسخة احتياطية صالحة');
    }
    if (!parsed.version.startsWith('2.')) {
      throw new Error(`إصدار التنسيق غير مدعوم: ${parsed.version}`);
    }

    const payloadStr = JSON.stringify(parsed);
    const checksumBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payloadStr));
    const checksum = Array.from(new Uint8Array(checksumBuf)).map((b) => b.toString(16).padStart(2, '0')).join('');

    const tablesIncluded = Object.keys(parsed.data);
    let totalRecords = 0;
    for (const t of tablesIncluded) totalRecords += (parsed.data[t] as any[]).length;

    const backupId = genId('bkp');
    const { error: insertErr } = await supabase.from('system_backups').insert({
      id: backupId,
      name: `نسخة مرفوعة - ${file.name}`,
      type: 'full',
      status: 'completed',
      format_version: parsed.version,
      size_bytes: file.size,
      total_records: totalRecords,
      tables_count: tablesIncluded.length,
      tables_included: tablesIncluded,
      checksum,
      backup_data: parsed,
      created_by: user.id,
      created_by_name: user.name,
      notes: `مرفوعة من الجهاز: ${file.name}`,
    });

    if (insertErr) throw new Error('فشل حفظ النسخة المرفوعة: ' + insertErr.message);

    await supabase.from('backup_audit_log').insert({
      id: genId('baud'),
      backup_id: backupId,
      backup_name: `نسخة مرفوعة - ${file.name}`,
      action: 'BACKUP_UPLOADED',
      user_id: user.id,
      user_name: user.name,
      user_role: user.role,
      result: 'success',
      details: { fileName: file.name, sizeBytes: file.size, totalRecords },
    });

    return { success: true, backupId, message: `تم رفع النسخة بنجاح (${totalRecords} سجل، ${tablesIncluded.length} جدول)` };
  },

  deleteBackup: async (backupId: string) => {
    const user = getStoredUser();
    if (!user || user.role !== 'OWNER') throw new Error('غير مصرح');

    const { data: backup } = await supabase.from('system_backups').select('name').eq('id', backupId).maybeSingle();

    const { error } = await supabase.from('system_backups').delete().eq('id', backupId);
    if (error) throw new Error('فشل حذف النسخة');

    await supabase.from('backup_audit_log').insert({
      id: genId('baud'),
      backup_id: backupId,
      backup_name: backup?.name || 'unknown',
      action: 'BACKUP_DELETED',
      user_id: user.id,
      user_name: user.name,
      user_role: user.role,
      result: 'success',
    });

    return { success: true, message: 'تم حذف النسخة الاحتياطية' };
  },

  getBackupAuditLog: async () => {
    const { data, error } = await supabase
      .from('backup_audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) handleError(error, 'فشل تحميل سجل النسخ الاحتياطي');
    return (data || []).map(mapRow);
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
        { key: 'code', labelAr: 'رمز الكلية', labelEn: 'College Code', required: true, example: 'ENG' },
        { key: 'nameAr', labelAr: 'اسم الكلية بالعربية', labelEn: 'College Name (Arabic)', required: true, example: 'كلية الهندسة' },
        { key: 'nameEn', labelAr: 'الاسم بالإنجليزية', labelEn: 'College Name (English)', required: false, example: 'Engineering College' },
        { key: 'deanName', labelAr: 'اسم العميد', labelEn: 'Dean Name', required: false, example: 'د. أحمد' },
        { key: 'phone', labelAr: 'الهاتف', labelEn: 'Phone', required: false, example: '07901234567' },
        { key: 'email', labelAr: 'البريد', labelEn: 'Email', required: false, example: 'eng@uomus.edu.iq' },
      ], sampleData: [
        { code: 'ENG', nameAr: 'كلية الهندسة', nameEn: 'Engineering College', deanName: 'أ.د. أحمد محمد', phone: '07901234567', email: 'eng@uomus.edu.iq' },
        { code: 'SCI', nameAr: 'كلية العلوم', nameEn: 'Science College', deanName: 'أ.د. سامي خليل', phone: '07907654321', email: 'sci@uomus.edu.iq' },
      ] },
      'colleges_departments': { entityType: 'colleges_departments', columns: [
        { key: 'collegeCode', labelAr: 'رمز الكلية', labelEn: 'College Code', required: true, example: 'ENG' },
        { key: 'collegeNameAr', labelAr: 'اسم الكلية', labelEn: 'College Name', required: true, example: 'كلية الهندسة' },
        { key: 'collegeNameEn', labelAr: 'اسم الكلية بالإنجليزية', labelEn: 'College Name (EN)', required: false, example: 'Engineering College' },
        { key: 'deanName', labelAr: 'اسم العميد', labelEn: 'Dean Name', required: false, example: 'د. أحمد' },
        { key: 'collegePhone', labelAr: 'هاتف الكلية', labelEn: 'College Phone', required: false, example: '07901234567' },
        { key: 'collegeEmail', labelAr: 'بريد الكلية', labelEn: 'College Email', required: false, example: 'eng@uomus.edu.iq' },
        { key: 'departmentCode', labelAr: 'رمز القسم', labelEn: 'Department Code', required: true, example: 'CSE' },
        { key: 'departmentNameAr', labelAr: 'اسم القسم بالعربية', labelEn: 'Department Name (Arabic)', required: true, example: 'قسم هندسة الحاسوب' },
        { key: 'departmentNameEn', labelAr: 'اسم القسم بالإنجليزية', labelEn: 'Department Name (EN)', required: false, example: 'Computer Engineering' },
        { key: 'headName', labelAr: 'رئيس القسم', labelEn: 'Department Head', required: false, example: 'د. محمد' },
      ], sampleData: [
        { collegeCode: 'ENG', collegeNameAr: 'كلية الهندسة', collegeNameEn: 'Engineering College', deanName: 'أ.د. أحمد محمد', collegePhone: '07901234567', collegeEmail: 'eng@uomus.edu.iq', departmentCode: 'CSE', departmentNameAr: 'قسم هندسة الحاسوب', departmentNameEn: 'Computer Engineering', headName: 'د. محمد علي' },
        { collegeCode: 'ENG', collegeNameAr: 'كلية الهندسة', collegeNameEn: 'Engineering College', deanName: '', collegePhone: '', collegeEmail: '', departmentCode: 'ECE', departmentNameAr: 'قسم هندسة الإلكترونك', departmentNameEn: 'Electronics Engineering', headName: 'د. سامي خليل' },
        { collegeCode: 'SCI', collegeNameAr: 'كلية العلوم', collegeNameEn: 'Science College', deanName: 'أ.د. خالد يوسف', collegePhone: '07907654321', collegeEmail: 'sci@uomus.edu.iq', departmentCode: 'MATH', departmentNameAr: 'قسم الرياضيات', departmentNameEn: 'Mathematics', headName: 'د. عبد الله' },
      ], instructions: 'هذا القالب موحد لاستيراد الكليات والأقسام معاً. املأ بيانات الكلية في الصف الأول، وكرر نفس رمز الكلية واسمها في الصفوف التالية مع تغيير بيانات القسم. لا حاجة لتكرار بيانات العميد والهاتف لكل صف — اتركها فارغة في الصفوف التالية للكلية نفسها. الصفوف المظللة بالأصفر هي أمثلة احذفها قبل الاستيراد.' },
      departments: { entityType: 'departments', columns: [
        { key: 'collegeCode', labelAr: 'رمز الكلية', labelEn: 'College Code', required: true, example: 'ENG' },
        { key: 'code', labelAr: 'رمز القسم', labelEn: 'Department Code', required: true, example: 'CSE' },
        { key: 'nameAr', labelAr: 'اسم القسم بالعربية', labelEn: 'Department Name (Arabic)', required: true, example: 'قسم هندسة الحاسوب' },
        { key: 'nameEn', labelAr: 'الاسم بالإنجليزية', labelEn: 'Department Name (EN)', required: false, example: 'Computer Engineering' },
        { key: 'headName', labelAr: 'رئيس القسم', labelEn: 'Department Head', required: false, example: 'د. محمد' },
      ], sampleData: [
        { collegeCode: 'ENG', code: 'CSE', nameAr: 'قسم هندسة الحاسوب', nameEn: 'Computer Engineering', headName: 'د. محمد علي' },
        { collegeCode: 'ENG', code: 'ECE', nameAr: 'قسم هندسة الإلكترونك', nameEn: 'Electronics Engineering', headName: 'د. سامي خليل' },
      ] },
      faculty: { entityType: 'faculty', columns: [
        { key: 'departmentCode', labelAr: 'رمز القسم', labelEn: 'Department Code', required: true, example: 'CSE' },
        { key: 'nameAr', labelAr: 'اسم التدريسي', labelEn: 'Faculty Name', required: true, example: 'د. أحمد علي' },
        { key: 'academicTitle', labelAr: 'اللقب العلمي', labelEn: 'Academic Title', required: false, example: 'أستاذ مساعد' },
        { key: 'specialization', labelAr: 'التخصص', labelEn: 'Specialization', required: false, example: 'ذكاء اصطناعي' },
        { key: 'email', labelAr: 'البريد', labelEn: 'Email', required: false, example: 'ahmed@uomus.edu.iq' },
        { key: 'phone', labelAr: 'الهاتف', labelEn: 'Phone', required: false, example: '07901234567' },
        { key: 'employeeId', labelAr: 'الرقم الوظيفي', labelEn: 'Employee ID', required: false, example: 'EMP-001' },
      ], sampleData: [
        { departmentCode: 'CSE', nameAr: 'د. أحمد علي محمود', academicTitle: 'أستاذ مساعد', specialization: 'ذكاء اصطناعي', email: 'ahmed@uomus.edu.iq', phone: '07901234567', employeeId: 'EMP-001' },
        { departmentCode: 'CSE', nameAr: 'م. محمد جاسم', academicTitle: 'مدرس مساعد', specialization: 'قواعد بيانات', email: 'mohammed@uomus.edu.iq', phone: '07907654321', employeeId: 'EMP-002' },
      ] },
      subjects: { entityType: 'subjects', columns: [
        { key: 'departmentCode', labelAr: 'رمز القسم', labelEn: 'Department Code', required: true, example: 'CSE' },
        { key: 'stageNumber', labelAr: 'رقم المرحلة', labelEn: 'Stage Number', required: true, example: '1' },
        { key: 'code', labelAr: 'رمز المادة', labelEn: 'Subject Code', required: true, example: 'CSE101' },
        { key: 'nameAr', labelAr: 'اسم المادة', labelEn: 'Subject Name', required: true, example: 'مقدمة في البرمجة' },
        { key: 'nameEn', labelAr: 'الاسم بالإنجليزية', labelEn: 'Subject Name (EN)', required: false, example: 'Intro to Programming' },
        { key: 'type', labelAr: 'النوع', labelEn: 'Type', required: false, example: 'نظري' },
        { key: 'theoreticalHours', labelAr: 'الساعات النظرية', labelEn: 'Theoretical Hours', required: false, example: '3' },
        { key: 'practicalHours', labelAr: 'الساعات العملية', labelEn: 'Practical Hours', required: false, example: '2' },
        { key: 'creditUnits', labelAr: 'الوحدات', labelEn: 'Credit Units', required: false, example: '4' },
      ], sampleData: [
        { departmentCode: 'CSE', stageNumber: '1', code: 'CSE101', nameAr: 'مقدمة في البرمجة', nameEn: 'Intro to Programming', type: 'نظري', theoreticalHours: '3', practicalHours: '0', creditUnits: '3' },
        { departmentCode: 'CSE', stageNumber: '1', code: 'CSE102', nameAr: 'تراكيب البيانات', nameEn: 'Data Structures', type: 'نظري', theoreticalHours: '2', practicalHours: '2', creditUnits: '3' },
      ] },
      buildings: { entityType: 'buildings', columns: [
        { key: 'code', labelAr: 'رمز المبنى', labelEn: 'Building Code', required: true, example: 'B1' },
        { key: 'nameAr', labelAr: 'اسم المبنى', labelEn: 'Building Name', required: true, example: 'مبنى الهندسة' },
        { key: 'nameEn', labelAr: 'الاسم بالإنجليزية', labelEn: 'Building Name (EN)', required: false, example: 'Engineering Building' },
        { key: 'floorsCount', labelAr: 'عدد الطوابق', labelEn: 'Floors Count', required: false, example: '4' },
      ], sampleData: [
        { code: 'B1', nameAr: 'مبنى الهندسة', nameEn: 'Engineering Building', floorsCount: '4' },
        { code: 'B2', nameAr: 'مبنى المختبرات', nameEn: 'Labs Building', floorsCount: '3' },
      ] },
      rooms: { entityType: 'rooms', columns: [
        { key: 'buildingCode', labelAr: 'رمز المبنى', labelEn: 'Building Code', required: true, example: 'B1' },
        { key: 'collegeCode', labelAr: 'رمز الكلية', labelEn: 'College Code', required: true, example: 'ENG' },
        { key: 'departmentCode', labelAr: 'رمز القسم', labelEn: 'Department Code', required: false, example: 'CSE' },
        { key: 'code', labelAr: 'رمز القاعة', labelEn: 'Room Code', required: true, example: 'R101' },
        { key: 'nameAr', labelAr: 'اسم القاعة', labelEn: 'Room Name', required: true, example: 'قاعة 101' },
        { key: 'capacity', labelAr: 'السعة', labelEn: 'Capacity', required: false, example: '60' },
        { key: 'type', labelAr: 'النوع', labelEn: 'Type', required: false, example: 'نظري' },
      ], sampleData: [
        { buildingCode: 'B1', collegeCode: 'ENG', departmentCode: 'CSE', code: 'R101', nameAr: 'قاعة 101', capacity: '60', type: 'نظري' },
        { buildingCode: 'B1', collegeCode: 'ENG', departmentCode: 'CSE', code: 'LAB1', nameAr: 'مختبر الحاسوب 1', capacity: '40', type: 'عملي' },
      ] },
      schedules: { entityType: 'schedules', columns: [
        { key: 'departmentCode', labelAr: 'رمز القسم', labelEn: 'Department Code', required: true, example: 'CSE' },
        { key: 'subjectCode', labelAr: 'رمز المادة', labelEn: 'Subject Code', required: true, example: 'CSE101' },
        { key: 'facultyName', labelAr: 'اسم التدريسي', labelEn: 'Faculty Name', required: true, example: 'د. أحمد علي' },
        { key: 'sectionName', labelAr: 'اسم الشعبة', labelEn: 'Section Name', required: true, example: 'أ' },
        { key: 'roomCode', labelAr: 'رمز القاعة', labelEn: 'Room Code', required: true, example: 'R101' },
        { key: 'day', labelAr: 'اليوم', labelEn: 'Day', required: true, example: 'الأحد' },
        { key: 'startTime', labelAr: 'وقت البدء', labelEn: 'Start Time', required: true, example: '08:30' },
        { key: 'endTime', labelAr: 'وقت الانتهاء', labelEn: 'End Time', required: true, example: '10:00' },
        { key: 'lectureType', labelAr: 'نوع المحاضرة', labelEn: 'Lecture Type', required: false, example: 'نظري' },
      ], sampleData: [
        { departmentCode: 'CSE', subjectCode: 'CSE101', facultyName: 'د. أحمد علي', sectionName: 'أ', roomCode: 'R101', day: 'الأحد', startTime: '08:30', endTime: '10:00', lectureType: 'نظري' },
        { departmentCode: 'CSE', subjectCode: 'CSE102', facultyName: 'م. محمد جاسم', sectionName: 'ب', roomCode: 'LAB1', day: 'الإثنين', startTime: '10:00', endTime: '12:00', lectureType: 'عملي' },
      ] },
    };
    return templates[entityType] || { entityType, columns: [], sampleData: [] };
  },

  importEntity: async (entityType: string, rows: any[], fileName?: string) => {
    let created = 0;
    let updated = 0;
    const errors: Array<{ row: number; field: string; message: string }> = [];
    const user = getStoredUser();

    // Combined colleges+departments import
    if (entityType === 'colleges_departments') {
      const result = await importCollegesDepartments(rows, fileName, user);
      return result;
    }

    const tableMap: Record<string, string> = {
      colleges: 'colleges', departments: 'departments', faculty: 'faculties',
      subjects: 'subjects', buildings: 'buildings', rooms: 'rooms', schedules: 'schedules',
    };
    const table = tableMap[entityType];
    if (!table) throw new Error('نوع الاستيراد غير مدعوم');

    // Pre-load lookup maps for FK resolution
    const collegeMap = await buildCollegeCodeMap();
    const deptMap = await buildDeptCodeMap();
    const buildingMap = await buildBuildingCodeMap();
    const stageMap = await buildDeptStageMap();
    const subjectMap = await buildDeptSubjectMap();
    const facultyMap = await buildDeptFacultyMap();
    const roomMap = await buildRoomCodeMap();
    const sectionMap = await buildDeptStageSectionMap();

    // Track seen keys within this import to detect intra-file duplicates
    const seenKeys = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;
      try {
        const input = mapInput(row);

        // Skip completely empty rows
        const hasAnyValue = Object.values(input).some((v: any) => v !== null && v !== undefined && String(v).trim() !== '');
        if (!hasAnyValue) { errors.push({ row: rowNum, field: '—', message: 'صف فارغ' }); continue; }

        // Resolve foreign keys based on entity type
        if (entityType === 'departments') {
          const collegeCode = String(row.collegeCode || input.college_code || '').trim();
          if (!collegeCode) { errors.push({ row: rowNum, field: 'رمز الكلية', message: 'رمز الكلية مطلوب' }); continue; }
          const collegeId = collegeMap.get(collegeCode.toUpperCase());
          if (!collegeId) { errors.push({ row: rowNum, field: 'رمز الكلية', message: `الكلية "${collegeCode}" غير موجودة` }); continue; }
          input.college_id = collegeId;
          delete input.college_code;
          const deptCode = String(input.code || '').trim();
          if (deptCode && seenKeys.has(`dept:${deptCode.toUpperCase()}`)) { errors.push({ row: rowNum, field: 'رمز القسم', message: `قسم مكرر في الملف: ${deptCode}` }); continue; }
          if (deptCode) seenKeys.add(`dept:${deptCode.toUpperCase()}`);
        }

        if (entityType === 'faculty') {
          const deptCode = String(row.departmentCode || input.department_code || '').trim();
          if (!deptCode) { errors.push({ row: rowNum, field: 'رمز القسم', message: 'رمز القسم مطلوب' }); continue; }
          const deptId = deptMap.get(deptCode.toUpperCase());
          if (!deptId) { errors.push({ row: rowNum, field: 'رمز القسم', message: `القسم "${deptCode}" غير موجود` }); continue; }
          input.department_id = deptId;
          const collegeId = deptMap.get(deptCode.toUpperCase() + '__college');
          if (collegeId) input.college_id = collegeId;
          delete input.department_code;
        }

        if (entityType === 'subjects') {
          const deptCode = String(row.departmentCode || input.department_code || '').trim();
          if (!deptCode) { errors.push({ row: rowNum, field: 'رمز القسم', message: 'رمز القسم مطلوب' }); continue; }
          const deptId = deptMap.get(deptCode.toUpperCase());
          if (!deptId) { errors.push({ row: rowNum, field: 'رمز القسم', message: `القسم "${deptCode}" غير موجود` }); continue; }
          input.department_id = deptId;
          delete input.department_code;
          // Resolve stage
          const stageNum = parseInt(String(row.stageNumber || input.stage_number || '0'), 10);
          if (stageNum > 0) {
            const stageId = stageMap.get(`${deptId}:${stageNum}`);
            if (stageId) input.stage_id = stageId;
          }
          delete input.stage_number;
        }

        if (entityType === 'rooms') {
          const buildingCode = String(row.buildingCode || input.building_code || '').trim();
          const buildingId = buildingMap.get(buildingCode.toUpperCase());
          if (!buildingId) { errors.push({ row: rowNum, field: 'رمز المبنى', message: `المبنى "${buildingCode}" غير موجود` }); continue; }
          input.building_id = buildingId;
          delete input.building_code;
          const collegeCode = String(row.collegeCode || input.college_code || '').trim();
          const collegeId = collegeMap.get(collegeCode.toUpperCase());
          if (!collegeId) { errors.push({ row: rowNum, field: 'رمز الكلية', message: `الكلية "${collegeCode}" غير موجودة` }); continue; }
          input.college_id = collegeId;
          delete input.college_code;
          const deptCode = String(row.departmentCode || input.department_code || '').trim();
          if (deptCode) {
            const deptId = deptMap.get(deptCode.toUpperCase());
            if (deptId) input.department_id = deptId;
            delete input.department_code;
          }
        }

        if (entityType === 'schedules') {
          const deptCode = String(row.departmentCode || input.department_code || '').trim();
          const deptId = deptMap.get(deptCode.toUpperCase());
          if (!deptId) { errors.push({ row: rowNum, field: 'رمز القسم', message: `القسم "${deptCode}" غير موجود` }); continue; }
          input.department_id = deptId;
          const collegeId = deptMap.get(deptCode.toUpperCase() + '__college');
          if (collegeId) input.college_id = collegeId;
          delete input.department_code;

          const subjectCode = String(row.subjectCode || input.subject_code || '').trim();
          const subjectId = subjectMap.get(`${deptId}:${subjectCode.toUpperCase()}`);
          if (!subjectId) { errors.push({ row: rowNum, field: 'رمز المادة', message: `المادة "${subjectCode}" غير موجودة في القسم` }); continue; }
          input.subject_id = subjectId;
          delete input.subject_code;

          const facultyName = String(row.facultyName || input.faculty_name || '').trim();
          const facultyId = facultyMap.get(`${deptId}:${facultyName}`);
          if (!facultyId) { errors.push({ row: rowNum, field: 'اسم التدريسي', message: `التدريسي "${facultyName}" غير موجود في القسم` }); continue; }
          input.faculty_id = facultyId;
          delete input.faculty_name;

          const roomCode = String(row.roomCode || input.room_code || '').trim();
          const roomId = roomMap.get(roomCode.toUpperCase());
          if (!roomId) { errors.push({ row: rowNum, field: 'رمز القاعة', message: `القاعة "${roomCode}" غير موجودة` }); continue; }
          input.room_id = roomId;
          delete input.room_code;

          const sectionName = String(row.sectionName || input.section_name || '').trim();
          const stageNum = parseInt(String(row.stageNumber || input.stage_number || '0'), 10);
          const sectionId = sectionMap.get(`${deptId}:${stageNum}:${sectionName}`);
          if (!sectionId) { errors.push({ row: rowNum, field: 'اسم الشعبة', message: `الشعبة "${sectionName}" غير موجودة في المرحلة ${stageNum}` }); continue; }
          input.section_id = sectionId;
          delete input.section_name;
          delete input.stage_number;

          // Resolve stage_id from section
          const stageId = stageMap.get(`${deptId}:${stageNum}`);
          if (stageId) input.stage_id = stageId;

          // Academic term defaults
          if (!input.academic_year) input.academic_year = '2025-2026';
          if (!input.semester) input.semester = 'FIRST';

          // Normalize lecture type
          if (input.lecture_type) {
            const lt = String(input.lecture_type).trim();
            if (lt.includes('نظري') || lt.toUpperCase() === 'THEORETICAL') input.lecture_type = 'THEORETICAL';
            else if (lt.includes('عملي') || lt.toUpperCase() === 'PRACTICAL') input.lecture_type = 'PRACTICAL';
          }
        }

        // Generate ID and set defaults
        input.id = genId(entityType.slice(0, 3));
        input.is_deleted = false;

        // Check for existing record by code to avoid duplicate errors
        if (input.code && ['colleges', 'departments', 'buildings', 'rooms', 'subjects'].includes(table)) {
          const { data: existing } = await supabase.from(table).select('id').eq('code', input.code).eq('is_deleted', false).maybeSingle();
          if (existing) {
            errors.push({ row: rowNum, field: 'الرمز', message: `سجل موجود بالفعل بالرمز "${input.code}"` });
            continue;
          }
        }

        const { error } = await supabase.from(table).insert(input);
        if (error) {
          errors.push({ row: rowNum, field: '—', message: error.message });
        } else {
          created++;
        }
      } catch (e: any) {
        errors.push({ row: rowNum, field: '—', message: e.message || 'خطأ غير متوقع' });
      }
    }

    const jobId = genId('job');
    await supabase.from('import_jobs').insert({
      id: jobId,
      file_name: fileName || 'manual',
      import_type: entityType,
      status: errors.length > 0 ? 'COMPLETED_WITH_ERRORS' : 'COMPLETED',
      total_rows: rows.length,
      rows_processed: rows.length,
      rows_created: created,
      rows_failed: errors.length,
      uploaded_by_user_id: user?.id || null,
      error_summary: errors.slice(0, 10).map((e) => `الصف ${e.row}: ${e.message}`).join('; '),
      created_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    });

    if (created === 0) {
      return {
        success: false,
        message: `لم يتم استيراد أي بيانات. ${errors.length} خطأ اكتشفها النظام.`,
        count: 0, created: 0, updated: 0, entityType, jobId,
        errors,
      };
    }

    return {
      success: true,
      message: errors.length > 0
        ? `تم استيراد ${created} سجل بنجاح مع ${errors.length} خطأ.`
        : `تم استيراد ${created} سجل بنجاح تام.`,
      count: created, created, updated, entityType, jobId,
      errors: errors.length > 0 ? errors : undefined,
    };
  },

  importDepartmentPackage: async (packageData: any, options: { dryRun?: boolean } = {}) => {
    const errors: Array<{ row: number; field: string; message: string }> = [];
    const user = getStoredUser();

    const stats = {
      department: 0,
      stages: packageData.stages?.length || 0,
      sections: packageData.sections?.length || 0,
      faculty: packageData.faculty?.length || 0,
      subjects: packageData.subjects?.length || 0,
      schedules: packageData.schedules?.length || 0,
    };

    if (options.dryRun) {
      // Validate: check that college code exists, department code is not duplicate
      const collegeCode = String(packageData.department?.collegeCode || '').trim();
      if (!collegeCode) {
        return { success: false, dryRun: true, message: 'رمز الكلية مطلوب في ورقة بيانات القسم', errors: [{ row: 1, field: 'رمز الكلية', message: 'حقل إلزامي فارغ' }] };
      }
      const { data: college } = await supabase.from('colleges').select('id, code').eq('code', collegeCode).eq('is_deleted', false).maybeSingle();
      if (!college) {
        return { success: false, dryRun: true, message: `الكلية برمز "${collegeCode}" غير موجودة في النظام`, errors: [{ row: 1, field: 'رمز الكلية', message: 'الكلية غير موجودة' }] };
      }
      const deptCode = String(packageData.department?.code || '').trim();
      if (!deptCode) {
        return { success: false, dryRun: true, message: 'رمز القسم مطلوب', errors: [{ row: 1, field: 'رمز القسم', message: 'حقل إلزامي فارغ' }] };
      }
      const { data: existingDept } = await supabase.from('departments').select('id, code').eq('college_id', college.id).eq('code', deptCode).eq('is_deleted', false).maybeSingle();
      if (existingDept) {
        return { success: false, dryRun: true, message: `القسم برمز "${deptCode}" موجود بالفعل في هذه الكلية`, errors: [{ row: 1, field: 'رمز القسم', message: 'قسم مكرر' }] };
      }
      if (!packageData.department?.nameAr) {
        return { success: false, dryRun: true, message: 'اسم القسم بالعربية مطلوب', errors: [{ row: 1, field: 'اسم القسم', message: 'حقل إلزامي فارغ' }] };
      }
      return {
        success: true,
        dryRun: true,
        message: 'تم فحص البيانات بنجاح. الكلية موجودة، رمز القسم غير مكرر، والبيانات جاهزة للاستيراد.',
        stats,
      };
    }

    // Real import
    const collegeCode = String(packageData.department?.collegeCode || '').trim();
    const { data: college } = await supabase.from('colleges').select('id, code').eq('code', collegeCode).eq('is_deleted', false).maybeSingle();
    if (!college) {
      return { success: false, dryRun: false, message: `الكلية برمز "${collegeCode}" غير موجودة`, errors: [{ row: 1, field: 'رمز الكلية', message: 'الكلية غير موجودة' }] };
    }

    const deptCode = String(packageData.department?.code || '').trim();
    const { data: existingDept } = await supabase.from('departments').select('id').eq('college_id', college.id).eq('code', deptCode).eq('is_deleted', false).maybeSingle();
    if (existingDept) {
      return { success: false, dryRun: false, message: `القسم برمز "${deptCode}" موجود بالفعل`, errors: [{ row: 1, field: 'رمز القسم', message: 'قسم مكرر' }] };
    }

    // 1. Create department
    const deptId = genId('dept');
    const { error: deptErr } = await supabase.from('departments').insert({
      id: deptId,
      college_id: college.id,
      code: deptCode,
      name_ar: String(packageData.department?.nameAr || '').trim(),
      name_en: String(packageData.department?.nameEn || '').trim() || null,
      head_name: String(packageData.department?.headName || '').trim() || null,
      monitor_name: String(packageData.department?.monitorName || '').trim() || null,
      phone: String(packageData.department?.phone || '').trim() || null,
      email: String(packageData.department?.email || '').trim() || null,
      is_deleted: false,
    });
    if (deptErr) {
      return { success: false, dryRun: false, message: `فشل إنشاء القسم: ${deptErr.message}`, errors: [{ row: 1, field: 'القسم', message: deptErr.message }] };
    }
    stats.department = 1;

    // 2. Create stages
    const stageIdMap = new Map<number, string>();
    const stagesToCreate = (packageData.stages || []).length > 0 ? packageData.stages : [
      { yearNumber: 1, nameAr: 'المرحلة الأولى', nameEn: 'Stage 1' },
      { yearNumber: 2, nameAr: 'المرحلة الثانية', nameEn: 'Stage 2' },
      { yearNumber: 3, nameAr: 'المرحلة الثالثة', nameEn: 'Stage 3' },
      { yearNumber: 4, nameAr: 'المرحلة الرابعة', nameEn: 'Stage 4' },
    ];
    for (const stg of stagesToCreate) {
      const yr = parseInt(String(stg.yearNumber || stg.year_number || '0'), 10);
      if (!yr) continue;
      const stgId = genId('stg');
      const { error: stgErr } = await supabase.from('stages').insert({
        id: stgId,
        department_id: deptId,
        year_number: yr,
        name_ar: stg.nameAr || `المرحلة ${yr}`,
        name_en: stg.nameEn || `Stage ${yr}`,
        is_deleted: false,
      });
      if (stgErr) { errors.push({ row: 1, field: 'المراحل', message: `فشل إنشاء المرحلة ${yr}: ${stgErr.message}` }); }
      else { stageIdMap.set(yr, stgId); }
    }

    // 3. Create sections
    const sectionIdMap = new Map<string, string>();
    for (const sec of (packageData.sections || [])) {
      const stageNum = parseInt(String(sec.stageNumber || sec.stage_number || '0'), 10);
      const stageId = stageIdMap.get(stageNum);
      if (!stageId) { errors.push({ row: 1, field: 'الشعب', message: `المرحلة ${stageNum} غير موجودة للشعبة` }); continue; }
      const secName = String(sec.name || '').trim();
      if (!secName) continue;
      const secId = genId('sec');
      const { error: secErr } = await supabase.from('sections').insert({
        id: secId,
        department_id: deptId,
        stage_id: stageId,
        name: secName,
        student_count: parseInt(String(sec.studentCount || sec.student_count || '0'), 10) || 0,
        is_deleted: false,
      });
      if (secErr) { errors.push({ row: 1, field: 'الشعب', message: `فشل إنشاء الشعبة ${secName}: ${secErr.message}` }); }
      else { sectionIdMap.set(`${stageNum}:${secName}`, secId); }
    }

    // 4. Create faculty
    const facultyIdMap = new Map<string, string>();
    for (const fac of (packageData.faculty || [])) {
      const nameAr = String(fac.nameAr || '').trim();
      if (!nameAr) continue;
      const facId = genId('fac');
      const { error: facErr } = await supabase.from('faculties').insert({
        id: facId,
        college_id: college.id,
        department_id: deptId,
        employee_id: String(fac.employeeId || '').trim() || null,
        name_ar: nameAr,
        name_en: String(fac.nameEn || '').trim() || null,
        academic_title: String(fac.academicTitle || '').trim() || null,
        specialization: String(fac.specialization || '').trim() || null,
        email: String(fac.email || '').trim() || null,
        phone: String(fac.phone || '').trim() || null,
        is_deleted: false,
      });
      if (facErr) { errors.push({ row: 1, field: 'الكادر', message: `فشل إنشاء التدريسي ${nameAr}: ${facErr.message}` }); }
      else { facultyIdMap.set(nameAr, facId); }
    }

    // 5. Create subjects
    const subjectIdMap = new Map<string, string>();
    for (const subj of (packageData.subjects || [])) {
      const subjCode = String(subj.code || '').trim();
      const subjName = String(subj.nameAr || '').trim();
      if (!subjName && !subjCode) continue;
      const stageNum = parseInt(String(subj.stageNumber || subj.stage_number || '0'), 10);
      const stageId = stageIdMap.get(stageNum);
      const subjId = genId('sub');
      const { error: subjErr } = await supabase.from('subjects').insert({
        id: subjId,
        department_id: deptId,
        stage_id: stageId || null,
        code: subjCode || null,
        name_ar: subjName || subjCode,
        name_en: String(subj.nameEn || '').trim() || null,
        type: String(subj.type || '').trim() || null,
        theoretical_hours: parseInt(String(subj.theoreticalHours || subj.theoretical_hours || '0'), 10) || 0,
        practical_hours: parseInt(String(subj.practicalHours || subj.practical_hours || '0'), 10) || 0,
        credit_units: parseInt(String(subj.creditUnits || subj.credit_units || '0'), 10) || 0,
        is_deleted: false,
      });
      if (subjErr) { errors.push({ row: 1, field: 'المواد', message: `فشل إنشاء المادة ${subjName}: ${subjErr.message}` }); }
      else { if (subjCode) subjectIdMap.set(subjCode.toUpperCase(), subjId); }
    }

    // 6. Create schedules
    for (const sch of (packageData.schedules || [])) {
      const day = String(sch.day || '').trim();
      const startTime = String(sch.startTime || '').trim();
      const endTime = String(sch.endTime || '').trim();
      if (!day || !startTime || !endTime) continue;

      const subjCode = String(sch.subjectCode || '').trim();
      const subjectId = subjectIdMap.get(subjCode.toUpperCase());
      const facultyName = String(sch.facultyEmail || '').trim();
      const facultyId = facultyIdMap.get(facultyName);
      const roomCode = String(sch.roomCode || '').trim();
      const { data: room } = await supabase.from('rooms').select('id').eq('code', roomCode).eq('is_deleted', false).maybeSingle();
      const stageNum = parseInt(String(sch.stageNumber || sch.stage_number || '0'), 10);
      const sectionName = String(sch.sectionNames || sch.section_names || '').trim();
      const sectionId = sectionIdMap.get(`${stageNum}:${sectionName}`);
      const stageId = stageIdMap.get(stageNum);

      if (!subjectId) { errors.push({ row: 1, field: 'الجداول', message: `المادة "${subjCode}" غير موجودة` }); continue; }
      if (!facultyId) { errors.push({ row: 1, field: 'الجداول', message: `التدريسي "${facultyName}" غير موجود` }); continue; }
      if (!room) { errors.push({ row: 1, field: 'الجداول', message: `القاعة "${roomCode}" غير موجودة` }); continue; }

      const lt = String(sch.lectureType || sch.lecture_type || '').trim();
      let lectureType = 'THEORETICAL';
      if (lt.includes('عملي') || lt.toUpperCase() === 'PRACTICAL') lectureType = 'PRACTICAL';

      const { error: schErr } = await supabase.from('schedules').insert({
        id: genId('sch'),
        college_id: college.id,
        department_id: deptId,
        stage_id: stageId || null,
        subject_id: subjectId,
        faculty_id: facultyId,
        section_id: sectionId || null,
        room_id: room.id,
        day,
        start_time: startTime,
        end_time: endTime,
        lecture_type: lectureType,
        academic_year: '2025-2026',
        semester: 'FIRST',
        is_deleted: false,
      });
      if (schErr) { errors.push({ row: 1, field: 'الجداول', message: `فشل إنشاء المحاضرة: ${schErr.message}` }); }
    }

    const jobId = genId('job');
    await supabase.from('import_jobs').insert({
      id: jobId,
      file_name: 'department_package',
      import_type: 'department_package',
      status: errors.length > 0 ? 'COMPLETED_WITH_ERRORS' : 'COMPLETED',
      total_rows: stats.stages + stats.sections + stats.faculty + stats.subjects + stats.schedules + 1,
      rows_processed: stats.stages + stats.sections + stats.faculty + stats.subjects + stats.schedules + 1,
      rows_created: stats.stages + stats.sections + stats.faculty + stats.subjects + stats.schedules + 1 - errors.length,
      rows_failed: errors.length,
      uploaded_by_user_id: user?.id || null,
      error_summary: errors.slice(0, 10).map((e) => `${e.field}: ${e.message}`).join('; '),
      created_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    });

    if (errors.length > 0 && stats.department === 0) {
      return { success: false, dryRun: false, message: 'فشل استيراد حزمة القسم', errors, stats };
    }

    return {
      success: true,
      dryRun: false,
      message: errors.length > 0
        ? `تم استيراد حزمة القسم مع ${errors.length} تحذير. تم إنشاء القسم والمراحل والشعب والكادر والمواد والجداول.`
        : 'تم استيراد حزمة القسم الأكاديمي بنجاح تام. تم إنشاء القسم والمراحل والشعب والكادر والمواد والجداول.',
      stats,
      errors: errors.length > 0 ? errors : undefined,
    };
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

  // ---------- Change Requests ----------
  getChangeRequests: async (params: Record<string, string> = {}) => {
    let q = supabase.from('change_requests').select('*').order('created_at', { ascending: false });
    if (params.status) q = q.eq('status', params.status);
    if (params.collegeId) q = q.eq('college_id', params.collegeId);
    if (params.departmentId) q = q.eq('department_id', params.departmentId);
    const { data, error } = await q.limit(200);
    if (error) handleError(error, 'فشل تحميل طلبات التغيير');
    return (data || []).map(mapRow);
  },

  createChangeRequest: async (data: any) => {
    const input = mapInput(data);
    if (!input.id) input.id = genId('cr');
    const user = getStoredUser();
    input.requested_by = user?.id;
    input.requested_by_name = user?.name;
    input.status = 'pending';
    const { data: row, error } = await supabase.from('change_requests').insert(input).select().single();
    if (error) handleError(error, 'فشل إنشاء طلب التغيير');

    // Create dean update
    if (input.college_id) {
      await supabase.from('dean_updates').insert({
        id: genId('du'),
        college_id: input.college_id,
        update_type: 'new_change_request',
        title: 'طلب تغيير محاضرة جديد',
        description: `طلب تغيير: ${input.reason_description || ''}`,
        related_entity_type: 'change_request',
        related_entity_id: input.id,
        department_id: input.department_id || null,
        created_by: user?.id,
        created_by_name: user?.name,
      });
    }

    return { success: true, data: mapRow(row) };
  },

  reviewChangeRequest: async (id: string, action: 'approve' | 'reject' | 'return', notes: string) => {
    const user = getStoredUser();
    const token = getStoredToken();
    if (!user || !token) throw new Error('غير مسجل الدخول');

    // Fetch the change request
    const { data: cr, error: fetchErr } = await supabase.from('change_requests').select('*').eq('id', id).maybeSingle();
    if (fetchErr || !cr) throw new Error('طلب التغيير غير موجود');

    const newStatus = action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'returned';

    // Update the change request
    const { data: updated, error: updateErr } = await supabase.from('change_requests').update({
      status: newStatus,
      reviewed_by: user.id,
      reviewed_by_name: user.name,
      reviewed_at: new Date().toISOString(),
      review_notes: notes || null,
      rejection_reason: action === 'reject' ? notes : null,
      updated_at: new Date().toISOString(),
    }).eq('id', id).select().single();
    if (updateErr) handleError(updateErr, 'فشل تحديث الطلب');

    // Record decision
    await supabase.from('change_request_decisions').insert({
      id: genId('crd'),
      change_request_id: id,
      action,
      decision_by: user.id,
      decision_by_name: user.name,
      notes: notes || null,
      previous_status: cr.status,
      new_status: newStatus,
    });

    // If approved, apply changes to schedule
    if (action === 'approve' && cr.schedule_id) {
      const scheduleUpdate: Record<string, any> = { updated_at: new Date().toISOString() };
      if (cr.new_day) scheduleUpdate.day = cr.new_day;
      if (cr.new_start_time) scheduleUpdate.start_time = cr.new_start_time;
      if (cr.new_end_time) scheduleUpdate.end_time = cr.new_end_time;
      if (cr.new_room_id) scheduleUpdate.room_id = cr.new_room_id;
      if (cr.new_lecture_type) scheduleUpdate.lecture_type = cr.new_lecture_type;
      if (cr.new_faculty_id) scheduleUpdate.faculty_id = cr.new_faculty_id;

      await supabase.from('schedules').update(scheduleUpdate).eq('id', cr.schedule_id);

      // Update change request status to applied
      await supabase.from('change_requests').update({ status: 'applied', updated_at: new Date().toISOString() }).eq('id', id);
    }

    // Create dean update
    if (cr.college_id) {
      const updateTitle = action === 'approve' ? 'تمت الموافقة على طلب تغيير' : action === 'reject' ? 'تم رفض طلب تغيير' : 'تم إعادة طلب تغيير لاستكمال المعلومات';
      await supabase.from('dean_updates').insert({
        id: genId('du'),
        college_id: cr.college_id,
        update_type: `change_request_${action}d`,
        title: updateTitle,
        description: `${notes || ''}`,
        related_entity_type: 'change_request',
        related_entity_id: id,
        department_id: cr.department_id || null,
        created_by: user.id,
        created_by_name: user.name,
      });
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      id: genId('audit'),
      user_id: user.id,
      user_name: user.name,
      user_role: user.role,
      action: `CHANGE_REQUEST_${action.toUpperCase()}`,
      entity: 'change_requests',
      entity_id: id,
      reason: notes || '',
    });

    return { success: true, data: mapRow(updated) };
  },

  getChangeRequestDecisions: async (changeRequestId: string) => {
    const { data, error } = await supabase.from('change_request_decisions')
      .select('*').eq('change_request_id', changeRequestId).order('created_at', { ascending: false });
    if (error) handleError(error, 'فشل تحميل قرارات الطلب');
    return (data || []).map(mapRow);
  },

  // ---------- Academic Calendar ----------
  getCalendarEvents: async (params: Record<string, string> = {}) => {
    let q = supabase.from('academic_calendar_events').select('*').order('start_date', { ascending: true });
    if (params.scopeType) q = q.eq('scope_type', params.scopeType);
    if (params.collegeId) q = q.eq('college_id', params.collegeId);
    if (params.eventType) q = q.eq('event_type', params.eventType);
    const { data, error } = await q.limit(500);
    if (error) handleError(error, 'فشل تحميل أحداث التقويم');
    return (data || []).map(mapRow);
  },

  createCalendarEvent: async (data: any) => {
    const input = mapInput(data);
    if (!input.id) input.id = genId('cal');
    const user = getStoredUser();
    input.created_by = user?.id;
    input.created_by_name = user?.name;
    const { data: row, error } = await supabase.from('academic_calendar_events').insert(input).select().single();
    if (error) handleError(error, 'فشل إضافة الحدث');
    return { success: true, data: mapRow(row) };
  },

  updateCalendarEvent: async (id: string, data: any) => {
    const input = mapInput(data);
    input.updated_at = new Date().toISOString();
    const { data: row, error } = await supabase.from('academic_calendar_events').update(input).eq('id', id).select().single();
    if (error) handleError(error, 'فشل تعديل الحدث');
    return { success: true, data: mapRow(row) };
  },

  deleteCalendarEvent: async (id: string) => {
    const { error } = await supabase.from('academic_calendar_events').delete().eq('id', id);
    if (error) handleError(error, 'فشل حذف الحدث');
    return { success: true };
  },

  // ---------- Roles & Permissions ----------
  getRoles: async () => {
    const { data, error } = await supabase.from('roles').select('*').order('name');
    if (error) handleError(error, 'فشل تحميل الأدوار');
    return (data || []).map(mapRow);
  },

  createRole: async (data: any) => {
    const input = mapInput(data);
    if (!input.id) input.id = genId('role');
    const { data: row, error } = await supabase.from('roles').insert(input).select().single();
    if (error) handleError(error, 'فشل إضافة الدور');
    return { success: true, data: mapRow(row) };
  },

  updateRole: async (id: string, data: any) => {
    const input = mapInput(data);
    input.updated_at = new Date().toISOString();
    const { data: row, error } = await supabase.from('roles').update(input).eq('id', id).select().single();
    if (error) handleError(error, 'فشل تعديل الدور');
    return { success: true, data: mapRow(row) };
  },

  deleteRole: async (id: string) => {
    const { error } = await supabase.from('roles').delete().eq('id', id);
    if (error) handleError(error, 'فشل حذف الدور');
    return { success: true };
  },

  getPermissions: async () => {
    const { data, error } = await supabase.from('permissions').select('*').order('module, name');
    if (error) handleError(error, 'فشل تحميل الصلاحيات');
    return (data || []).map(mapRow);
  },

  getRolePermissions: async (roleId: string) => {
    const { data, error } = await supabase.from('role_permissions').select('*').eq('role_id', roleId);
    if (error) handleError(error, 'فشل تحميل صلاحيات الدور');
    return (data || []).map(mapRow);
  },

  setRolePermission: async (roleId: string, permissionId: string, granted: boolean) => {
    if (granted) {
      const id = genId('rp');
      const { error } = await supabase.from('role_permissions')
        .upsert({ id, role_id: roleId, permission_id: permissionId }, { onConflict: 'role_id,permission_id' });
      if (error) handleError(error, 'فشل منح الصلاحية');
    } else {
      const { error } = await supabase.from('role_permissions')
        .delete().eq('role_id', roleId).eq('permission_id', permissionId);
      if (error) handleError(error, 'فشل سحب الصلاحية');
    }
    return { success: true };
  },

  getUserPermissions: async (userId: string) => {
    const { data, error } = await supabase.from('user_permissions').select('*').eq('user_id', userId);
    if (error) handleError(error, 'فشل تحميل صلاحيات المستخدم');
    return (data || []).map(mapRow);
  },

  setUserPermission: async (userId: string, permissionId: string, granted: boolean) => {
    const id = genId('up');
    const { error } = await supabase.from('user_permissions')
      .upsert({ id, user_id: userId, permission_id: permissionId, granted }, { onConflict: 'user_id,permission_id' });
    if (error) handleError(error, granted ? 'فشل منح الصلاحية' : 'فشل سحب الصلاحية');
    return { success: true };
  },

  // ---------- Dean Updates ----------
  getDeanUpdates: async (collegeId: string) => {
    const { data, error } = await supabase.from('dean_updates')
      .select('*').eq('college_id', collegeId).order('created_at', { ascending: false }).limit(100);
    if (error) handleError(error, 'فشل تحميل مستجدات الكلية');
    return (data || []).map(mapRow);
  },

  markDeanUpdateRead: async (id: string) => {
    const { error } = await supabase.from('dean_updates').update({ is_read: true }).eq('id', id);
    if (error) handleError(error, 'فشل تحديث الحالة');
    return { success: true };
  },
};
