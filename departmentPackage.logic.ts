import { db, sqlite } from './src/db/index.ts';
import {
  colleges,
  departments,
  stages,
  sections,
  subjects,
  faculties,
  rooms,
  schedules,
  scheduleSections,
  auditLogs,
} from './src/db/schema.ts';
import { eq, and, or, sql, inArray } from 'drizzle-orm';

export interface DepartmentPackagePayload {
  departmentId: string;
  collegeId?: string;
  stageId?: string;
  subjects?: Array<{
    code: string;
    nameAr: string;
    nameEn?: string;
    type?: string;
    theoreticalHours?: number;
    practicalHours?: number;
    creditUnits?: number;
  }>;
  sections?: Array<{
    name: string;
    studentCount?: number;
  }>;
  faculty?: Array<{
    employeeId?: string;
    nameAr: string;
    nameEn?: string;
    academicTitle?: string;
    specialization?: string;
    email: string;
    phone?: string;
  }>;
  schedules?: Array<{
    subjectCode: string;
    facultyEmail: string;
    // One section name, kept for backward compatibility with older callers.
    sectionName?: string;
    // The template's own header ("رموز الشعب (افصل بينها بـ ؛ أو ،)") and sample
    // row invite multiple section codes per lecture. Prefer this when present;
    // sectionName is used only as a single-item fallback.
    sectionNames?: string[];
    roomCode?: string;
    roomId?: string;
    day: string;
    startTime: string;
    endTime: string;
    lectureType?: string;
  }>;
}

export interface PackageImportOptions {
  dryRun?: boolean;
  confirmConflicts?: boolean;
  overrideReason?: string;
  academicYear: string;
  semester: string;
  user?: {
    id: string;
    name: string;
    role: string;
    assignedDepartmentId?: string;
    assignedCollegeId?: string;
  };
}

export interface ScheduleConflict {
  type: 'ROOM_CONFLICT' | 'FACULTY_CONFLICT' | 'SECTION_CONFLICT';
  scheduleIndex: number;
  day: string;
  startTime: string;
  endTime: string;
  conflictingDepartmentId: string;
  conflictingDepartmentName: string;
  entityName: string;
  message: string;
}

export async function processDepartmentPackage(
  payload: DepartmentPackagePayload,
  options: PackageImportOptions
) {
  const { dryRun = false, confirmConflicts = false, overrideReason = '', user } = options;

  if (!payload || !payload.departmentId) {
    return {
      success: false,
      status: 400,
      message: 'معرف القسم (departmentId) مطلوب لمعالجة حزمة القسم',
    };
  }

  const deptList = await db
    .select()
    .from(departments)
    .where(eq(departments.id, payload.departmentId))
    .limit(1);

  if (deptList.length === 0) {
    return {
      success: false,
      status: 404,
      message: 'القسم المحدد غير موجود في قاعدة البيانات',
    };
  }

  const targetDept = deptList[0];
  const collegeId = payload.collegeId || targetDept.collegeId;
  if (collegeId !== targetDept.collegeId) {
    return { success: false, status: 403, message: 'الكلية لا تطابق الكلية الفعلية للقسم' };
  }

  // Resolve Stage ID
  let targetStageId = payload.stageId;
  let createFallbackStage = false;
  if (!targetStageId) {
    const existingStages = await db
      .select()
      .from(stages)
      .where(and(eq(stages.departmentId, targetDept.id), eq(stages.isDeleted, false)))
      .limit(1);

    if (existingStages.length > 0) {
      targetStageId = existingStages[0].id;
    } else {
      // Fallback stage
      targetStageId = `stage-${targetDept.id}-1`;
      createFallbackStage = true;
    }
  }

  const rawSubjects = payload.subjects || [];
  const rawSections = payload.sections || [];
  const rawFaculty = payload.faculty || [];
  const rawSchedules = payload.schedules || [];

  if (payload.stageId) {
    const [requestedStage] = await db.select().from(stages).where(and(eq(stages.id, payload.stageId), eq(stages.isDeleted, false))).limit(1);
    if (!requestedStage || requestedStage.departmentId !== targetDept.id) {
      return { success: false, status: 404, message: 'المرحلة المحددة غير موجودة ضمن القسم' };
    }
  }

  // Fetch existing records for idempotency & duplicate checks
  const existingDeptSubjects = await db
    .select()
    .from(subjects)
    .where(eq(subjects.departmentId, targetDept.id));

  const existingDeptSections = await db
    .select()
    .from(sections)
    .where(and(eq(sections.departmentId, targetDept.id), eq(sections.stageId, targetStageId), eq(sections.isDeleted, false)));

  const existingFaculty = await db
    .select()
    .from(faculties);

  const existingRooms = await db.select().from(rooms);
  const allDepartments = await db.select().from(departments);
  const deptMap = new Map(allDepartments.map((d) => [d.id, d.nameAr]));

  // Calculate new vs existing counts
  let newSubjectsCount = 0;
  const subjectCodeMap = new Map<string, string>(); // code -> id

  for (const s of existingDeptSubjects) {
    subjectCodeMap.set(s.code.toUpperCase(), s.id);
  }

  for (const s of rawSubjects) {
    const key = s.code.toUpperCase();
    if (!subjectCodeMap.has(key)) {
      newSubjectsCount++;
      subjectCodeMap.set(key, `subj-${targetDept.id}-${key}`);
    }
  }

  let newSectionsCount = 0;
  const sectionNameMap = new Map<string, string>(); // name -> id

  for (const sec of existingDeptSections) {
    sectionNameMap.set(sec.name.trim(), sec.id);
  }

  for (const sec of rawSections) {
    const key = sec.name.trim();
    if (!sectionNameMap.has(key)) {
      newSectionsCount++;
      sectionNameMap.set(key, `sec-${targetDept.id}-${key}`);
    }
  }

  let newFacultyCount = 0;
  const facultyEmailMap = new Map<string, string>(); // email -> id
  const facultyEmployeeMap = new Map<string, string>();

  for (const f of existingFaculty) {
    if (f.email) facultyEmailMap.set(f.email.toLowerCase(), f.id);
    if (f.employeeId) facultyEmployeeMap.set(f.employeeId.toLowerCase(), f.id);
  }

  for (const f of rawFaculty) {
    const emailKey = f.email.toLowerCase();
    const employeeKey = String(f.employeeId || '').trim().toLowerCase();
    const existingId = facultyEmailMap.get(emailKey) || (employeeKey ? facultyEmployeeMap.get(employeeKey) : undefined);
    if (!existingId) {
      newFacultyCount++;
      facultyEmailMap.set(emailKey, `fac-${targetDept.id}-${emailKey.replace(/[@.]/g, '_')}`);
    } else {
      facultyEmailMap.set(emailKey, existingId);
    }
  }

  // Room lookup map
  const roomCodeMap = new Map<string, string>();
  for (const r of existingRooms) {
    if (r.collegeId !== targetDept.collegeId) continue;
    roomCodeMap.set(r.code.toUpperCase(), r.id);
    roomCodeMap.set(r.nameAr.toUpperCase(), r.id);
  }

  const scopedRooms = existingRooms.filter((room) => room.collegeId === targetDept.collegeId);
  const defaultRoomId = scopedRooms[0]?.id;

  for (const [index, sch] of rawSchedules.entries()) {
    const subjectId = subjectCodeMap.get(String(sch.subjectCode || '').toUpperCase());
    const refNames = (sch.sectionNames && sch.sectionNames.length > 0 ? sch.sectionNames : [sch.sectionName || '']).map((n) => n.trim()).filter(Boolean);
    const sectionIds = refNames.map((name) => sectionNameMap.get(name));
    const facultyId = facultyEmailMap.get(String(sch.facultyEmail || '').toLowerCase());
    const roomKey = String(sch.roomCode || sch.roomId || '').toUpperCase();
    const roomId = roomCodeMap.get(roomKey) || (sch.roomId && scopedRooms.some((room) => room.id === sch.roomId) ? sch.roomId : undefined) || (!sch.roomCode && !sch.roomId ? defaultRoomId : undefined);
    if (!subjectId || refNames.length === 0 || sectionIds.some((id) => !id) || !facultyId || !roomId || !scopedRooms.some((room) => room.id === roomId)) {
      return {
        success: false,
        status: 400,
        message: `بيانات المحاضرة رقم ${index + 1} تشير إلى مادة أو شعبة أو تدريسي أو قاعة غير موجودة`,
      };
    }
  }

  // Conflict Detection against existing schedules in database
  const existingSchedules = await db
    .select()
    .from(schedules)
    .where(and(eq(schedules.isDeleted, false), eq(schedules.academicYear, options.academicYear)));

  const conflicts: ScheduleConflict[] = [];

  for (let i = 0; i < rawSchedules.length; i++) {
    const sch = rawSchedules[i];
    const roomKey = (sch.roomCode || sch.roomId || '').toUpperCase();
    const targetRoomId = roomCodeMap.get(roomKey) || sch.roomId || defaultRoomId;
    const facEmailKey = (sch.facultyEmail || '').toLowerCase();
    const targetFacultyId = facultyEmailMap.get(facEmailKey) || `fac-${facEmailKey}`;

    // Validate time
    if (sch.startTime >= sch.endTime) {
      conflicts.push({
        type: 'ROOM_CONFLICT',
        scheduleIndex: i,
        day: sch.day,
        startTime: sch.startTime,
        endTime: sch.endTime,
        conflictingDepartmentId: targetDept.id,
        conflictingDepartmentName: targetDept.nameAr,
        entityName: sch.subjectCode,
        message: `وقت البداية (${sch.startTime}) يجب أن يكون قبل وقت النهاية (${sch.endTime})`,
      });
      continue;
    }

    // Check overlap with existing schedules in database (cross-department conflicts)
    for (const ex of existingSchedules) {
      if (ex.semester !== options.semester && !(options.semester === 'SUMMER' && ex.semester === 'ANNUAL')) continue;
      if (ex.departmentId === targetDept.id) continue; // Ignore same-department schedules

      if (ex.day === sch.day) {
        const isTimeOverlap = sch.startTime < ex.endTime && sch.endTime > ex.startTime;

        if (isTimeOverlap) {
          const otherDeptName = deptMap.get(ex.departmentId) || 'قسم آخر';

          // Room conflict
          if (ex.roomId === targetRoomId) {
            conflicts.push({
              type: 'ROOM_CONFLICT',
              scheduleIndex: i,
              day: sch.day,
              startTime: sch.startTime,
              endTime: sch.endTime,
              conflictingDepartmentId: ex.departmentId,
              conflictingDepartmentName: otherDeptName,
              entityName: sch.roomCode || targetRoomId,
              message: `تعارض القاعة (${sch.roomCode || targetRoomId}) في يوم ${sch.day} (${sch.startTime}-${sch.endTime}) حجزت لـ ${otherDeptName}`,
            });
          }

          // Faculty conflict
          if (ex.facultyId === targetFacultyId) {
            conflicts.push({
              type: 'FACULTY_CONFLICT',
              scheduleIndex: i,
              day: sch.day,
              startTime: sch.startTime,
              endTime: sch.endTime,
              conflictingDepartmentId: ex.departmentId,
              conflictingDepartmentName: otherDeptName,
              entityName: sch.facultyEmail,
              message: `تعارض التدريسي (${sch.facultyEmail}) في يوم ${sch.day} (${sch.startTime}-${sch.endTime}) كُلّف في ${otherDeptName}`,
            });
          }
        }
      }
    }
  }

  // Handle Dry Run
  if (dryRun) {
    return {
      success: true,
      status: 200,
      dryRun: true,
      summary: {
        subjectsCount: rawSubjects.length,
        sectionsCount: rawSections.length,
        facultyCount: rawFaculty.length,
        schedulesCount: rawSchedules.length,
      },
      created: {
        subjects: newSubjectsCount,
        sections: newSectionsCount,
        faculty: newFacultyCount,
        schedules: rawSchedules.length,
      },
      conflicts,
      message: 'تم فحص حزمة القسم بنجاح (معاينة بدون حفظ)',
    };
  }

  // Handle Non-Dry Run Conflict Guard
  if (conflicts.length > 0) {
    if (!confirmConflicts) {
      return {
        success: false,
        status: 409,
        conflicts,
        message: `تم رفض حفظ حزمة القسم لوجود ${conflicts.length} تعارض في الجدول مع قسم آخر`,
      };
    }

    if (!overrideReason || overrideReason.trim() === '') {
      return {
        success: false,
        status: 400,
        message: 'سبب التجاوز (overrideReason) مطلوب عند تأكيد التعارض',
      };
    }
  }

  // Perform Atomic Insertions
  const insertedSubjects: string[] = [];
  const insertedSections: string[] = [];
  const insertedFaculty: string[] = [];
  const insertedSchedules: string[] = [];

  try {
    sqlite.exec('BEGIN');
    if (createFallbackStage && targetStageId) {
      await db.insert(stages).values({
        id: targetStageId,
        departmentId: targetDept.id,
        nameAr: 'المرحلة الأولى',
        nameEn: 'Stage 1',
        yearNumber: 1,
        status: 'active',
        isDeleted: false,
      }).onConflictDoNothing();
    }
    // 1. Subjects
    for (const s of rawSubjects) {
      const codeKey = s.code.toUpperCase();
      const existing = existingDeptSubjects.find((ex) => ex.code.toUpperCase() === codeKey);
      if (!existing) {
        const safeKey = Buffer.from(codeKey).toString('hex').slice(0, 12);
        const id = `subj-${targetDept.id}-${safeKey}`;
        await db.insert(subjects).values({
          id,
          departmentId: targetDept.id,
          stageId: targetStageId,
          code: codeKey,
          nameAr: s.nameAr,
          nameEn: s.nameEn || s.nameAr,
          type: (s.type as any) || 'theoretical',
          theoreticalHours: s.theoreticalHours || 3,
          practicalHours: s.practicalHours || 0,
          creditUnits: s.creditUnits || 3,
          status: 'active',
          isDeleted: false,
        }).onConflictDoNothing();
        insertedSubjects.push(id);
        subjectCodeMap.set(codeKey, id);
      }
    }

    // 2. Sections
    for (const sec of rawSections) {
      const secName = sec.name.trim();
      const existing = existingDeptSections.find((ex) => ex.name.trim() === secName);
      if (!existing) {
        const safeKey = Buffer.from(secName).toString('hex').slice(0, 12);
        const id = `sec-${targetDept.id}-${safeKey}`;
        await db.insert(sections).values({
          id,
          stageId: targetStageId,
          departmentId: targetDept.id,
          name: secName,
          studentCount: sec.studentCount || 45,
          status: 'active',
          isDeleted: false,
        }).onConflictDoNothing();
        insertedSections.push(id);
        sectionNameMap.set(secName, id);
      }
    }

    // 3. Faculty
    for (const f of rawFaculty) {
      const emailKey = f.email.toLowerCase();
      const existing = existingFaculty.find((ex) => ex.email?.toLowerCase() === emailKey || (f.employeeId && ex.employeeId?.toLowerCase() === f.employeeId.toLowerCase()));
      if (!existing) {
        const safeKey = Buffer.from(emailKey).toString('hex').slice(0, 12);
        const id = `fac-${targetDept.id}-${safeKey}`;
        await db.insert(faculties).values({
          id,
          employeeId: f.employeeId || `EMP-${Math.floor(1000 + Math.random() * 9000)}`,
          collegeId,
          departmentId: targetDept.id,
          nameAr: f.nameAr,
          nameEn: f.nameEn || f.nameAr,
          academicTitle: f.academicTitle || 'مدرس',
          specialization: f.specialization || 'عام',
          email: emailKey,
          phone: f.phone || '+9647800000000',
          status: 'active',
          isDeleted: false,
        }).onConflictDoNothing();
        insertedFaculty.push(id);
        facultyEmailMap.set(emailKey, id);
      } else if (existing.departmentId === targetDept.id) {
        await db.update(faculties).set({
          employeeId: f.employeeId || existing.employeeId,
          nameAr: f.nameAr || existing.nameAr,
          nameEn: f.nameEn || existing.nameEn,
          academicTitle: f.academicTitle || existing.academicTitle,
          specialization: f.specialization || existing.specialization,
          phone: f.phone || existing.phone,
          updatedAt: new Date(),
        }).where(eq(faculties.id, existing.id));
        facultyEmailMap.set(emailKey, existing.id);
      } else {
        // A faculty member may teach across departments, but package imports
        // must never mutate the profile owned by another department.
        facultyEmailMap.set(emailKey, existing.id);
      }
    }

    // 4. Schedules
    for (const sch of rawSchedules) {
      const subjectId = subjectCodeMap.get(sch.subjectCode.toUpperCase())!;
      // Support one lecture shared by several sections (the template's own
      // header says codes may be separated by ؛ or ،); schedules.sectionId
      // keeps the first section for backward compatibility, and every
      // section (including the first) is linked via scheduleSections so
      // none of them are silently dropped.
      const refNames = (sch.sectionNames && sch.sectionNames.length > 0 ? sch.sectionNames : [sch.sectionName || '']).map((n) => n.trim()).filter(Boolean);
      const sectionIds = refNames.map((name) => sectionNameMap.get(name)!);
      const sectionId = sectionIds[0];
      const facultyId = facultyEmailMap.get(sch.facultyEmail.toLowerCase())!;
      const roomKey = (sch.roomCode || sch.roomId || '').toUpperCase();
      const roomId = roomCodeMap.get(roomKey) || sch.roomId || defaultRoomId;

      const schId = `sch-${targetDept.id}-${sch.subjectCode}-${refNames.join('-')}-${sch.day}-${sch.startTime.replace(':', '')}`;

      await db.insert(schedules).values({
        id: schId,
        departmentId: targetDept.id,
        stageId: targetStageId,
        sectionId,
        subjectId,
        facultyId,
        roomId,
        day: sch.day as any,
        startTime: sch.startTime,
        endTime: sch.endTime,
        lectureType: (sch.lectureType as any) || 'theoretical',
        academicYear: options.academicYear,
        semester: options.semester,
        status: 'active',
        isDeleted: false,
      }).onConflictDoNothing();

      if (sectionIds.length > 0) {
        await db.insert(scheduleSections).values(
          sectionIds.map((sid) => ({ scheduleId: schId, sectionId: sid }))
        ).onConflictDoNothing();
      }

      insertedSchedules.push(schId);
    }

    // 5. Audit Log
    await db.insert(auditLogs).values({
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      userId: user?.id || 'system',
      userName: user?.name || 'مسؤول الحزمة',
      userRole: (user?.role as any) || 'OWNER',
      action: 'DEPARTMENT_PACKAGE_IMPORT',
      entity: 'department_package',
      entityId: targetDept.id,
      newValue: `تم استيراد حزمة قسم (${targetDept.nameAr}): ${insertedSchedules.length} محاضرات، ${insertedFaculty.length} تدريسيين، ${insertedSections.length} شعب، ${insertedSubjects.length} مواد`,
      reason: overrideReason || 'استيراد حزمة القسم الحزمة الأكاديمية الشاملة',
    }).onConflictDoNothing();

    sqlite.exec('COMMIT');
    return {
      success: true,
      status: 201,
      summary: {
        subjectsCount: rawSubjects.length,
        sectionsCount: rawSections.length,
        facultyCount: rawFaculty.length,
        schedulesCount: rawSchedules.length,
      },
      created: {
        subjects: newSubjectsCount,
        sections: newSectionsCount,
        faculty: newFacultyCount,
        schedules: rawSchedules.length,
      },
      conflicts,
      message: 'تم استيراد حزمة القسم بنجاح في قاعدة البيانات الحقيقية',
    };
  } catch (err: any) {
    try { sqlite.exec('ROLLBACK'); } catch { /* transaction already closed */ }
    return {
      success: false,
      status: 500,
      message: `فشل استيراد حزمة القسم: ${err.message}`,
    };
  }
}
