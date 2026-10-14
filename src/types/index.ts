export type UserRole = 'OWNER' | 'COLLEGE_MONITOR' | 'DEPARTMENT_MONITOR' | 'FACULTY';

export interface User {
  id: string;
  uid?: string;
  name: string;
  email: string;
  role: UserRole;
  roleTitleAr?: string;
  assignedCollegeId?: string | null;
  assignedDepartmentId?: string | null;
  assignedFacultyId?: string | null;
  avatar?: string | null;
  status?: string;
  mustChangePassword?: boolean;
  createdAt?: string;
}

export interface College {
  id: string;
  code?: string;
  nameAr: string;
  nameEn?: string;
  logoPath?: string;
  isDeleted?: boolean;
}

export interface Department {
  id: string;
  collegeId: string;
  code?: string;
  nameAr: string;
  nameEn?: string;
  logoPath?: string;
  isDeleted?: boolean;
}

export interface Building {
  id: string;
  code?: string;
  nameAr: string;
  nameEn?: string;
  photoPath?: string;
  isDeleted?: boolean;
}

export interface Room {
  id: string;
  buildingId?: string;
  collegeId?: string;
  departmentId?: string;
  code?: string;
  nameAr: string;
  nameEn?: string;
  capacity?: number;
  type?: string;
  photoPath?: string;
  isDeleted?: boolean;
}

export interface Stage {
  id: string;
  departmentId: string;
  nameAr: string;
  nameEn?: string;
  yearNumber?: number;
  status?: string;
  isDeleted?: boolean;
}

export interface Section {
  id: string;
  departmentId: string;
  stageId: string;
  name: string;
  studentCount?: number;
  status?: string;
  isDeleted?: boolean;
}

export interface Subject {
  id: string;
  departmentId: string;
  stageId?: string;
  code?: string;
  nameAr: string;
  nameEn?: string;
  type?: string;
  theoreticalHours?: number;
  practicalHours?: number;
  creditUnits?: number;
  isDeleted?: boolean;
}

export interface Faculty {
  id: string;
  collegeId?: string;
  departmentId?: string;
  employeeId?: string;
  nameAr: string;
  nameEn?: string;
  academicTitle?: string;
  specialization?: string;
  email?: string;
  phone?: string;
  photoPath?: string;
  status?: string;
  isDeleted?: boolean;
}

export interface Schedule {
  id: string;
  collegeId?: string;
  departmentId?: string;
  stageId?: string;
  subjectId?: string;
  facultyId?: string;
  sectionId?: string;
  sectionIds?: string[];
  roomId?: string;
  day: string;
  startTime: string;
  endTime: string;
  lectureType?: string;
  academicYear?: string;
  semester?: string;
  status?: string;
  isDeleted?: boolean;
}

export interface AttendanceRecord {
  id: string;
  facultyId: string;
  scheduleId: string;
  subjectId?: string;
  sectionId?: string;
  stageId?: string;
  roomId?: string;
  lectureDate: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  status?: string;
  presentCount?: number;
  totalCount?: number;
  absencePercentage?: string;
  topicsCovered?: string;
  verificationMethod?: string;
  photoEvidence?: string;
  recordedAt?: string;
  academicYear?: string;
  semester?: string;
  proxyRecorded?: boolean;
  proxyReason?: string;
  recordedBy?: string;
}

export interface AuditLog {
  id: string;
  userId?: string;
  userName?: string;
  userRole?: string;
  action: string;
  entity?: string;
  entityId?: string;
  reason?: string;
  details?: string;
  timestamp?: string;
}

export interface AppNotification {
  id: string;
  userId?: string;
  title: string;
  message: string;
  type?: 'lecture_reminder' | 'attendance' | 'system' | 'alert' | string;
  scheduleId?: string;
  roomId?: string;
  roomName?: string;
  subjectName?: string;
  startTime?: string;
  endTime?: string;
  minutesRemaining?: number;
  isRead?: boolean;
  createdAt?: string;
}

