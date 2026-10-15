export type UserRole = 'OWNER' | 'COLLEGE_DEAN' | 'COLLEGE_MONITOR' | 'DEPARTMENT_MONITOR' | 'FACULTY';

export type AccountStatus = 'active' | 'pending_email' | 'pending_approval' | 'rejected' | 'suspended';

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
  accountStatus?: AccountStatus;
  maxDevices?: number;
  mustChangePassword?: boolean;
  tokenVersion?: number;
  createdAt?: string;
}

export interface RegistrationRequest {
  id: string;
  name: string;
  email: string;
  requestedRole: UserRole;
  collegeId?: string | null;
  departmentId?: string | null;
  facultyId?: string | null;
  status: 'pending_email' | 'pending_approval' | 'approved' | 'rejected';
  emailVerifiedAt?: string | null;
  rejectionReason?: string | null;
  reviewedBy?: string | null;
  reviewedByName?: string | null;
  reviewedAt?: string | null;
  createdAt?: string;
}

export interface UserDevice {
  id: string;
  userId: string;
  deviceFingerprint: string;
  deviceName?: string;
  userAgent?: string;
  status: 'pending' | 'approved' | 'revoked';
  approvedBy?: string | null;
  approvedByName?: string | null;
  approvedAt?: string | null;
  createdAt?: string;
  lastSeenAt?: string;
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

export type ChangeRequestStatus = 'pending' | 'approved' | 'rejected' | 'returned' | 'applied';

export type ChangeType = 'room_change' | 'postpone' | 'exam_conflict' | 'meeting' | 'admin_assignment' | 'mission' | 'to_online' | 'time_change' | 'faculty_change' | 'other';

export interface ChangeRequest {
  id: string;
  scheduleId: string;
  collegeId?: string;
  departmentId?: string;
  stageId?: string;
  subjectId?: string;
  facultyId?: string;
  originalDay?: string;
  originalStartTime?: string;
  originalEndTime?: string;
  originalRoomId?: string;
  originalLectureType?: string;
  originalFacultyId?: string;
  changeType: ChangeType;
  reasonType: string;
  reasonDescription: string;
  newDay?: string;
  newStartTime?: string;
  newEndTime?: string;
  newRoomId?: string;
  newLectureType?: string;
  newFacultyId?: string;
  status: ChangeRequestStatus;
  requestedBy: string;
  requestedByName?: string;
  reviewedBy?: string;
  reviewedByName?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  rejectionReason?: string;
  attachments?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ChangeRequestDecision {
  id: string;
  changeRequestId: string;
  action: string;
  decisionBy: string;
  decisionByName?: string;
  notes?: string;
  previousStatus?: string;
  newStatus?: string;
  createdAt?: string;
}

export type CalendarScopeType = 'university' | 'college' | 'department' | 'stage';
export type CalendarEventType = 'term_start' | 'term_end' | 'holiday' | 'exam_period' | 'break' | 'training' | 'no_lecture_day' | 'exception';

export interface AcademicCalendarEvent {
  id: string;
  title: string;
  description?: string;
  scopeType: CalendarScopeType;
  collegeId?: string;
  departmentId?: string;
  stageId?: string;
  eventType: CalendarEventType;
  startDate: string;
  endDate: string;
  isRecurring?: boolean;
  createdBy?: string;
  createdByName?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Role {
  id: string;
  name: string;
  nameAr: string;
  description?: string;
  isSystemRole?: boolean;
  createdAt?: string;
}

export interface Permission {
  id: string;
  name: string;
  nameAr: string;
  description?: string;
  module: string;
}

export interface RolePermission {
  id: string;
  roleId: string;
  permissionId: string;
}

export interface UserPermission {
  id: string;
  userId: string;
  permissionId: string;
  granted: boolean;
}

export interface DeanUpdate {
  id: string;
  collegeId: string;
  updateType: string;
  title: string;
  description?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  departmentId?: string;
  createdBy?: string;
  createdByName?: string;
  isRead?: boolean;
  readBy?: string[];
  createdAt?: string;
}

