import { sqliteTable, text, integer, real, customType } from 'drizzle-orm/sqlite-core';

export const customTimestamp = customType<{ data: string | Date; driverData: string }>({
  dataType() {
    return 'text';
  },
  toDriver(value: string | Date): string {
    return value instanceof Date ? value.toISOString() : String(value);
  },
  fromDriver(value: string): string {
    return value;
  },
});

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  uid: text('uid').unique(),
  name: text('name').notNull(),
  email: text('email').unique().notNull(),
  employeeId: text('employee_id'),
  role: text('role').notNull(),
  roleTitleAr: text('role_title_ar'),
  assignedCollegeId: text('assigned_college_id'),
  assignedDepartmentId: text('assigned_department_id'),
  assignedFacultyId: text('assigned_faculty_id'),
  avatar: text('avatar'),
  mustChangePassword: integer('must_change_password', { mode: 'boolean' }).default(false),
  status: text('status').default('active'),
  tokenVersion: integer('token_version').default(0),
  passwordHash: text('password_hash').notNull(),
  createdAt: customTimestamp('created_at'),
  updatedAt: customTimestamp('updated_at'),
});

export const colleges = sqliteTable('colleges', {
  id: text('id').primaryKey(),
  code: text('code'),
  nameAr: text('name_ar').notNull(),
  nameEn: text('name_en'),
  deanName: text('dean_name'),
  monitorName: text('monitor_name'),
  monitorUserId: text('monitor_user_id'),
  phone: text('phone'),
  email: text('email'),
  status: text('status').default('active'),
  logoPath: text('logo_path'),
  isDeleted: integer('is_deleted', { mode: 'boolean' }).default(false),
  createdAt: customTimestamp('created_at'),
  updatedAt: customTimestamp('updated_at'),
});

export const departments = sqliteTable('departments', {
  id: text('id').primaryKey(),
  collegeId: text('college_id').notNull(),
  code: text('code'),
  nameAr: text('name_ar').notNull(),
  nameEn: text('name_en'),
  headName: text('head_name'),
  monitorName: text('monitor_name'),
  monitorUserId: text('monitor_user_id'),
  status: text('status').default('active'),
  logoPath: text('logo_path'),
  isDeleted: integer('is_deleted', { mode: 'boolean' }).default(false),
  createdAt: customTimestamp('created_at'),
  updatedAt: customTimestamp('updated_at'),
});

export const buildings = sqliteTable('buildings', {
  id: text('id').primaryKey(),
  code: text('code'),
  nameAr: text('name_ar').notNull(),
  nameEn: text('name_en'),
  floorsCount: integer('floors_count'),
  latitude: real('latitude'),
  longitude: real('longitude'),
  locationDescription: text('location_description'),
  status: text('status').default('active'),
  photoPath: text('photo_path'),
  isDeleted: integer('is_deleted', { mode: 'boolean' }).default(false),
  createdAt: customTimestamp('created_at'),
  updatedAt: customTimestamp('updated_at'),
});

export const rooms = sqliteTable('rooms', {
  id: text('id').primaryKey(),
  buildingId: text('building_id').notNull(),
  collegeId: text('college_id').notNull(),
  departmentId: text('department_id'),
  code: text('code'),
  nameAr: text('name_ar').notNull(),
  nameEn: text('name_en'),
  capacity: integer('capacity'),
  type: text('type'),
  roomType: text('room_type'),
  floor: text('floor'),
  locationDescription: text('location_description'),
  status: text('status').default('active'),
  photoPath: text('photo_path'),
  isDeleted: integer('is_deleted', { mode: 'boolean' }).default(false),
  createdAt: customTimestamp('created_at'),
  updatedAt: customTimestamp('updated_at'),
});

export const academicYears = sqliteTable('academic_years', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  isCurrent: integer('is_current', { mode: 'boolean' }).default(false),
  startDate: text('start_date'),
  endDate: text('end_date'),
  createdAt: customTimestamp('created_at'),
  updatedAt: customTimestamp('updated_at'),
});

export const semesters = sqliteTable('semesters', {
  id: text('id').primaryKey(),
  academicYearId: text('academic_year_id'),
  nameAr: text('name_ar'),
  nameEn: text('name_en'),
  semesterNumber: integer('semester_number'),
  isCurrent: integer('is_current', { mode: 'boolean' }).default(false),
  startDate: text('start_date'),
  endDate: text('end_date'),
  createdAt: customTimestamp('created_at'),
  updatedAt: customTimestamp('updated_at'),
});

export const stages = sqliteTable('stages', {
  id: text('id').primaryKey(),
  departmentId: text('department_id').notNull(),
  nameAr: text('name_ar').notNull(),
  nameEn: text('name_en'),
  yearNumber: integer('year_number'),
  status: text('status').default('ACTIVE'),
  isDeleted: integer('is_deleted', { mode: 'boolean' }).default(false),
  createdAt: customTimestamp('created_at'),
  updatedAt: customTimestamp('updated_at'),
});

export const sections = sqliteTable('sections', {
  id: text('id').primaryKey(),
  departmentId: text('department_id').notNull(),
  stageId: text('stage_id').notNull(),
  name: text('name').notNull(),
  studentCount: integer('student_count').default(0),
  status: text('status').default('ACTIVE'),
  isDeleted: integer('is_deleted', { mode: 'boolean' }).default(false),
  createdAt: customTimestamp('created_at'),
  updatedAt: customTimestamp('updated_at'),
});

export const subjects = sqliteTable('subjects', {
  id: text('id').primaryKey(),
  departmentId: text('department_id').notNull(),
  stageId: text('stage_id'),
  code: text('code'),
  nameAr: text('name_ar').notNull(),
  nameEn: text('name_en'),
  type: text('type'),
  theoreticalHours: integer('theoretical_hours').default(0),
  practicalHours: integer('practical_hours').default(0),
  creditUnits: integer('credit_units').default(0),
  status: text('status').default('active'),
  isDeleted: integer('is_deleted', { mode: 'boolean' }).default(false),
  createdAt: customTimestamp('created_at'),
  updatedAt: customTimestamp('updated_at'),
});

export const faculties = sqliteTable('faculties', {
  id: text('id').primaryKey(),
  collegeId: text('college_id'),
  departmentId: text('department_id'),
  employeeId: text('employee_id'),
  nameAr: text('name_ar').notNull(),
  nameEn: text('name_en'),
  academicTitle: text('academic_title'),
  specialization: text('specialization'),
  email: text('email'),
  phone: text('phone'),
  photoPath: text('photo_path'),
  status: text('status').default('ACTIVE'),
  isDeleted: integer('is_deleted', { mode: 'boolean' }).default(false),
  createdAt: customTimestamp('created_at'),
  updatedAt: customTimestamp('updated_at'),
});

export const schedules = sqliteTable('schedules', {
  id: text('id').primaryKey(),
  collegeId: text('college_id'),
  departmentId: text('department_id').notNull(),
  stageId: text('stage_id'),
  subjectId: text('subject_id').notNull(),
  facultyId: text('faculty_id').notNull(),
  sectionId: text('section_id').notNull(),
  roomId: text('room_id').notNull(),
  day: text('day').notNull(),
  startTime: text('start_time').notNull(),
  endTime: text('end_time').notNull(),
  lectureType: text('lecture_type'),
  academicYear: text('academic_year').notNull(),
  semester: text('semester').notNull(),
  status: text('status').default('ACTIVE'),
  isDeleted: integer('is_deleted', { mode: 'boolean' }).default(false),
  createdAt: customTimestamp('created_at'),
  updatedAt: customTimestamp('updated_at'),
});

export const scheduleSections = sqliteTable('schedule_sections', {
  id: text('id').primaryKey(),
  scheduleId: text('schedule_id').notNull(),
  sectionId: text('section_id').notNull(),
  createdAt: customTimestamp('created_at'),
});

export const lectureSessions = sqliteTable('lecture_sessions', {
  id: text('id').primaryKey(),
  scheduleId: text('schedule_id').notNull(),
  date: text('date').notNull(),
  status: text('status'),
  checkInTime: text('check_in_time'),
  checkOutTime: text('check_out_time'),
  plannedRoomId: text('planned_room_id'),
  actualRoomId: text('actual_room_id'),
  plannedFacultyId: text('planned_faculty_id'),
  actualFacultyId: text('actual_faculty_id'),
  isUnrecordedResolved: integer('is_unrecorded_resolved', { mode: 'boolean' }).default(false),
  unrecordedReason: text('unrecorded_reason'),
  unrecordedNotes: text('unrecorded_notes'),
  notes: text('notes'),
  resolvedBy: text('resolved_by'),
  resolvedByUserId: text('resolved_by_user_id'),
  resolvedAt: text('resolved_at'),
  createdAt: customTimestamp('created_at'),
  updatedAt: customTimestamp('updated_at'),
});

export const attendanceRecords = sqliteTable('attendance_records', {
  id: text('id').primaryKey(),
  facultyId: text('faculty_id').notNull(),
  scheduleId: text('schedule_id').notNull(),
  subjectId: text('subject_id'),
  sectionId: text('section_id'),
  stageId: text('stage_id'),
  roomId: text('room_id'),
  lectureDate: text('lecture_date').notNull(),
  scheduledStart: text('scheduled_start'),
  scheduledEnd: text('scheduled_end'),
  status: text('status'),
  attendanceStatus: text('attendance_status'),
  recordingMode: text('recording_mode'),
  recordedByRole: text('recorded_by_role'),
  onBehalfReason: text('on_behalf_reason'),
  onBehalfOtherNote: text('on_behalf_other_note'),
  clientRecordedAt: customTimestamp('client_recorded_at'),
  serverSyncedAt: customTimestamp('server_synced_at'),
  syncStatus: text('sync_status'),
  snapshotCollegeName: text('snapshot_college_name'),
  snapshotDepartmentName: text('snapshot_department_name'),
  snapshotFacultyName: text('snapshot_faculty_name'),
  snapshotSubjectName: text('snapshot_subject_name'),
  snapshotSubjectCode: text('snapshot_subject_code'),
  snapshotSectionName: text('snapshot_section_name'),
  snapshotRoomName: text('snapshot_room_name'),
  snapshotSemesterName: text('snapshot_semester_name'),
  presentCount: integer('present_count'),
  totalCount: integer('total_count'),
  studentsEnrolled: integer('students_enrolled'),
  studentsPresent: integer('students_present'),
  absencePercentage: text('absence_percentage'),
  topicsCovered: text('topics_covered'),
  verificationMethod: text('verification_method'),
  photoEvidence: text('photo_evidence'),
  evidencePhotoUrl: text('evidence_photo_url'),
  recordedAt: text('recorded_at'),
  recordedByUserId: text('recorded_by_user_id'),
  notes: text('notes'),
  academicYear: text('academic_year'),
  semester: text('semester'),
  proxyRecorded: integer('proxy_recorded', { mode: 'boolean' }).default(false),
  proxyReason: text('proxy_reason'),
  recordedBy: text('recorded_by'),
  createdAt: customTimestamp('created_at'),
  updatedAt: customTimestamp('updated_at'),
});

export const attendanceSectionRecords = sqliteTable('attendance_section_records', {
  id: text('id').primaryKey(),
  attendanceRecordId: text('attendance_record_id'),
  attendanceId: text('attendance_id'),
  scheduleId: text('schedule_id'),
  sectionId: text('section_id'),
  sectionName: text('section_name'),
  stageName: text('stage_name'),
  departmentName: text('department_name'),
  studentsEnrolled: integer('students_enrolled'),
  studentsPresent: integer('students_present'),
  studentCount: integer('student_count'),
  presentCount: integer('present_count'),
  attendancePercentage: text('attendance_percentage'),
  snapshotSectionName: text('snapshot_section_name'),
  snapshotDepartmentName: text('snapshot_department_name'),
  snapshotStageName: text('snapshot_stage_name'),
  lectureDate: text('lecture_date'),
  createdAt: customTimestamp('created_at'),
});

export const attendanceEvidence = sqliteTable('attendance_evidence', {
  id: text('id').primaryKey(),
  attendanceRecordId: text('attendance_record_id'),
  attendanceId: text('attendance_id'),
  scheduleId: text('schedule_id'),
  facultyId: text('faculty_id'),
  lectureDate: text('lecture_date'),
  photoPath: text('photo_path'),
  photoUrl: text('photo_url'),
  recordedByUserId: text('recorded_by_user_id'),
  hash: text('hash'),
  caption: text('caption'),
  recordedAt: text('recorded_at'),
  createdAt: customTimestamp('created_at'),
});

export const workloadPolicies = sqliteTable('workload_policies', {
  id: text('id').primaryKey(),
  academicTitle: text('academic_title'),
  requiredHours: integer('required_hours'),
  maxHours: integer('max_hours'),
  createdAt: customTimestamp('created_at'),
  updatedAt: customTimestamp('updated_at'),
});

export const academicExceptions = sqliteTable('academic_exceptions', {
  id: text('id').primaryKey(),
  facultyId: text('faculty_id'),
  reason: text('reason'),
  type: text('type'),
  startDate: text('start_date'),
  endDate: text('end_date'),
  approvedBy: text('approved_by'),
  createdAt: customTimestamp('created_at'),
  updatedAt: customTimestamp('updated_at'),
});

export const substitutions = sqliteTable('substitutions', {
  id: text('id').primaryKey(),
  scheduleId: text('schedule_id'),
  originalFacultyId: text('original_faculty_id'),
  substituteFacultyId: text('substitute_faculty_id'),
  date: text('date'),
  reason: text('reason'),
  status: text('status'),
  createdAt: customTimestamp('created_at'),
  updatedAt: customTimestamp('updated_at'),
});

export const coTeaching = sqliteTable('co_teaching', {
  id: text('id').primaryKey(),
  scheduleId: text('schedule_id'),
  primaryFacultyId: text('primary_faculty_id'),
  assistantFacultyId: text('assistant_faculty_id'),
  role: text('role'),
  createdAt: customTimestamp('created_at'),
  updatedAt: customTimestamp('updated_at'),
});

export const notifications = sqliteTable('notifications', {
  id: text('id').primaryKey(),
  userId: text('user_id'),
  title: text('title'),
  message: text('message'),
  type: text('type'),
  isRead: integer('is_read', { mode: 'boolean' }).default(false),
  createdAt: customTimestamp('created_at'),
});

export const auditLogs = sqliteTable('audit_logs', {
  id: text('id').primaryKey(),
  userId: text('user_id'),
  userName: text('user_name'),
  userRole: text('user_role'),
  action: text('action').notNull(),
  entity: text('entity'),
  entityId: text('entity_id'),
  reason: text('reason'),
  details: text('details'),
  newValue: text('new_value'),
  previousValue: text('previous_value'),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  timestamp: customTimestamp('timestamp'),
  createdAt: customTimestamp('created_at'),
});

export const systemSettings = sqliteTable('system_settings', {
  id: text('id').primaryKey(),
  key: text('key').unique().notNull(),
  value: text('value').notNull(),
  description: text('description'),
  updatedAt: customTimestamp('updated_at'),
});

export const importJobs = sqliteTable('import_jobs', {
  id: text('id').primaryKey(),
  fileName: text('file_name'),
  importType: text('import_type'),
  status: text('status'),
  totalRows: integer('total_rows'),
  processedRows: integer('processed_rows'),
  rowsProcessed: integer('rows_processed'),
  rowsCreated: integer('rows_created'),
  rowsUpdated: integer('rows_updated'),
  rowsFailed: integer('rows_failed'),
  successRows: integer('success_rows'),
  errorRows: integer('error_rows'),
  errorSummary: text('error_summary'),
  errorDetails: text('error_details'),
  uploadedByUserId: text('uploaded_by_user_id'),
  completedAt: customTimestamp('completed_at'),
  createdAt: customTimestamp('created_at'),
  updatedAt: customTimestamp('updated_at'),
});

export const importErrors = sqliteTable('import_errors', {
  id: text('id').primaryKey(),
  importJobId: text('import_job_id'),
  rowNumber: integer('row_number'),
  field: text('field'),
  message: text('message'),
  rawValue: text('raw_value'),
  createdAt: customTimestamp('created_at'),
});
