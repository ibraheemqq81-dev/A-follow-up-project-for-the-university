export interface AcademicTerm {
  academicYear: string;
  semester: 'FIRST' | 'SECOND' | 'SUMMER' | 'ANNUAL' | string;
  label?: string;
}

export function validateAcademicYear(year: unknown): string | null {
  if (typeof year !== 'string') return null;
  const trimmed = year.trim();
  if (/^\d{4}-\d{4}$/.test(trimmed)) {
    return trimmed;
  }
  return null;
}

export function normalizeSemester(semester: unknown): 'FIRST' | 'SECOND' | 'SUMMER' | 'ANNUAL' | null {
  if (!semester) return null;
  const str = String(semester).trim().toUpperCase();
  if (str === 'FIRST' || str === '1' || str.includes('أول') || str.includes('الأول') || str === 'FALL') {
    return 'FIRST';
  }
  if (str === 'SECOND' || str === '2' || str.includes('ثان') || str.includes('الثاني') || str === 'SPRING') {
    return 'SECOND';
  }
  if (str === 'SUMMER' || str === '3' || str.includes('صيف') || str.includes('الصيفي')) {
    return 'SUMMER';
  }
  if (str === 'ANNUAL' || str === 'سنوي' || str.includes('سنوي')) {
    return 'ANNUAL';
  }
  return null;
}

export function formatAcademicTerm(term: { academicYear?: string | null; semester?: string | null }): string {
  const year = term.academicYear || '2025-2026';
  const norm = normalizeSemester(term.semester);
  let semName = 'الفصل الأول';
  if (norm === 'SECOND') semName = 'الفصل الثاني';
  else if (norm === 'SUMMER') semName = 'الفصل الصيفي';
  else if (norm === 'ANNUAL') semName = 'سنوي';
  return `${year} — ${semName}`;
}

export function isSameAcademicTerm(
  a: { academicYear?: string | null; semester?: string | null } | null | undefined,
  b: { academicYear?: string | null; semester?: string | null } | null | undefined
): boolean {
  if (!a || !b) return false;
  if (!a.academicYear || !b.academicYear || a.academicYear !== b.academicYear) return false;
  const normA = normalizeSemester(a.semester);
  const normB = normalizeSemester(b.semester);
  return normA !== null && normA === normB;
}

export function parseCurrentTermSetting(value: unknown): AcademicTerm {
  const defaultTerm: AcademicTerm = {
    academicYear: '2025-2026',
    semester: 'FIRST',
    label: '2025-2026 — الفصل الأول',
  };

  if (!value) return defaultTerm;

  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    const structure = parsed?.academicStructure || parsed;
    const year = validateAcademicYear(structure?.currentAcademicYear);
    const semester = normalizeSemester(structure?.currentSemester);
    if (year && semester) {
      return {
        academicYear: year,
        semester,
        label: formatAcademicTerm({ academicYear: year, semester }),
      };
    }
  } catch {
    // fallback
  }

  return defaultTerm;
}

export function resolveAcademicTerm(
  requested: { academicYear?: unknown; semester?: unknown },
  current: AcademicTerm
): AcademicTerm {
  const academicYear = validateAcademicYear(requested?.academicYear) || current.academicYear;
  const semester = normalizeSemester(requested?.semester) || current.semester;
  return {
    academicYear,
    semester,
    label: formatAcademicTerm({ academicYear, semester }),
  };
}

export function cloneScheduleForTerm(sourceSchedule: any, newId: string, targetTerm: AcademicTerm): any {
  return {
    id: newId,
    collegeId: sourceSchedule.collegeId,
    departmentId: sourceSchedule.departmentId,
    stageId: sourceSchedule.stageId,
    subjectId: sourceSchedule.subjectId,
    facultyId: sourceSchedule.facultyId,
    sectionId: sourceSchedule.sectionId,
    roomId: sourceSchedule.roomId,
    day: sourceSchedule.day,
    startTime: sourceSchedule.startTime,
    endTime: sourceSchedule.endTime,
    lectureType: sourceSchedule.lectureType || 'THEORETICAL',
    academicYear: targetTerm.academicYear,
    semester: targetTerm.semester,
    status: sourceSchedule.status || 'ACTIVE',
    isDeleted: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function areIntervalsOverlapping(startA: string, endA: string, startB: string, endB: string): boolean {
  return startA < endB && endA > startB;
}

export function findScheduleTermConflicts(
  target: any,
  existingSchedules: any[],
  term: AcademicTerm,
  membership?: Map<string, string[]>
): {
  roomConflict?: any;
  facultyConflict?: any;
  sectionConflict?: any;
} {
  let roomConflict: any = undefined;
  let facultyConflict: any = undefined;
  let sectionConflict: any = undefined;

  const targetSections: string[] = Array.isArray(target.sectionIds)
    ? target.sectionIds
    : target.sectionId
      ? [target.sectionId]
      : [];

  for (const existing of existingSchedules) {
    if (existing.id && target.id && existing.id === target.id) continue;
    if (existing.isDeleted) continue;
    if (existing.day !== target.day) continue;
    if (!areIntervalsOverlapping(existing.startTime, existing.endTime, target.startTime, target.endTime)) continue;
    if (!isSameAcademicTerm(existing, term)) continue;

    if (!roomConflict && existing.roomId && target.roomId && existing.roomId === target.roomId) {
      roomConflict = existing;
    }
    if (!facultyConflict && existing.facultyId && target.facultyId && existing.facultyId === target.facultyId) {
      facultyConflict = existing;
    }
    const existingSections: string[] =
      membership?.get(existing.id) ||
      (Array.isArray(existing.sectionIds)
        ? existing.sectionIds
        : existing.sectionId
          ? [existing.sectionId]
          : []);

    if (!sectionConflict && targetSections.some((s) => existingSections.includes(s))) {
      sectionConflict = existing;
    }
  }

  return { roomConflict, facultyConflict, sectionConflict };
}
