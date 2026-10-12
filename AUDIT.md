# AUDIT.md — تقرير التدقيق الفاحص الشامل للمشروع (Phase 0)
**نظام متابعة حضور التدريسيين والمحاضرات — جامعة المستقبل (Al-Mustaqbal University)**  
*تاريخ الفحص: 2026-10-06 | وضع الفحص: قراءة وتحليل معمق لجميع مكونات النظام دون تعديل شفرة الإنتاج.*

---

## 1. الملخص التنفيذي (Executive Summary)

أظهر الفحص الشامل لمنظومة المشروع الحالية ما يلي:
1. **الواجهة الأمامية (Frontend):** متكاملة بصرياً بتصميم عربي RTL متناسق واحترافي لجامعة المستقبل، لكنها تعتمد في **كافة عمليات القراءة والكتابة اليومية (CRUD)** على طبقة وهمية ومخزن محلي (`src/services/db.ts` المخزن في `localStorage`) بدلاً من استهلاك الـ Backend الحقيقي.
2. **الواجهة الخلفية (Backend - Express):** يحتوي `server.ts` على endpoints قراءة لبعض الجداول، وendpoints لكتابة الحضور والجداول، لكنه **يفتقر تماماً لـ endpoints الإنشاء والتعديل والحذف (POST / PUT / DELETE)** لمعظم الكيانات الأكاديمية (الكليات، الأقسام، المباني، القاعات، المراحل، الشعب، المواد، التدريسيين، المستخدمين).
3. **قاعدة البيانات (PostgreSQL / Cloud SQL):** تم تعريف مخطط هيكلي متكامل في `src/db/schema.ts` مكوّن من **24 جدولاً علائقياً حقيقياً** وهي مُنشأة بالفعل في Cloud SQL PostgreSQL. لكن الربط بين الـ Frontend وهذه الجداول غير مفعل في واجهات CRUD، حيث تدور العمليات في فلك الـ localStorage.
4. **نظام المصادقة والأمان (Auth & RBAC):** لا يوجد نظام توثيق مبني على JWT أو جلسات آمنة، ولا يوجد تشفير لكلمات المرور بـ bcrypt. تسجيل الدخول في `server.ts` يقارن نصوصاً صريحة بدون توليد Token أو تطبيق Middleware للتحقق من الأدوار (`OWNER`, `COLLEGE_MONITOR`, `DEPARTMENT_MONITOR`, `FACULTY`) أو عزل النطاق (`Scope Isolation`) على مستوى الـ API.

---

## 2. جدول فحص الشاشات الفعلي (Screens Audit Matrix)

| الشاشة / الوحدة | المكون في `src/` | تستدعي أي API حالياً؟ | أي جدول في PostgreSQL معني؟ | الحالة الفعلية | الملاحظات والفجوات |
|---|---|---|---|---|---|
| **تسجيل الدخول (Login)** | `src/components/auth/LoginModal.tsx` | لا تستدعي API (تغير `currentUserId` محلياً) | `users` | **MOCK** | الواجهة تعرض نافذة منبثقة لاختيار الحسابات مباشرة بدون طلب كلمة مرور حقيقية أو استدعاء `/api/auth/login`، ولا يتم تخزين JWT. |
| **لوحة المؤشرات (Dashboard)** | `src/components/dashboard/Dashboard.tsx` | لا تستدعي API | `colleges`, `departments`, `faculty`, `rooms`, `lecture_sessions` | **MOCK** | تقرأ الإحصائيات من `useApp()` المستمد من `src/services/db.ts` (localStorage/seedData). |
| **إدارة الكليات (Colleges)** | `src/components/colleges/CollegeManagement.tsx` | لا تستدعي API | `colleges` | **MOCK** | عمليات الإضافة والتعديل والحذف تتم عبر `db.addCollege` / `db.updateCollege` في localStorage. لا يوجد `POST/PUT/DELETE /api/colleges`. |
| **إدارة الأقسام (Departments)** | `src/components/departments/DepartmentManagement.tsx` | لا تستدعي API | `departments` | **MOCK** | عمليات الإضافة والتعديل والحذف تنفذ محلياً عبر `db.addDepartment` في localStorage. لا يوجد `POST/PUT/DELETE /api/departments`. |
| **إدارة المباني (Buildings)** | `src/components/buildings/BuildingManagement.tsx` | لا تستدعي API | `buildings` | **MOCK** | العمليات تنفذ محلياً عبر `db.addBuilding` / `db.updateBuilding` في localStorage. |
| **إدارة القاعات (Rooms)** | `src/components/rooms/RoomManagement.tsx` | لا تستدعي API | `rooms` | **MOCK** | العمليات تنفذ محلياً عبر `db.addRoom` / `db.updateRoom` في localStorage. تم تنظيف أزرار الخريطة والـ GPS. |
| **المراحل والشعب (Stages & Sections)** | `src/components/academic/StageSectionManagement.tsx` | لا تستدعي API | `stages`, `sections` | **MOCK** | العمليات تنفذ محلياً عبر `db.addStage` / `db.addSection` في localStorage. |
| **المواد الدراسية (Subjects)** | `src/components/academic/SubjectManagement.tsx` | لا تستدعي API | `subjects` | **MOCK** | العمليات تنفذ محلياً عبر `db.addSubject` / `db.updateSubject` في localStorage. |
| **إدارة التدريسيين (Faculty)** | `src/components/faculty/FacultyManagement.tsx` | لا تستدعي API | `faculties`, `users` | **MOCK** | العمليات تنفذ محلياً عبر `db.addFaculty`. صور التدريسيين الافتراضية تعتمد جزئياً على Unsplash. |
| **بوابة التدريسي (Faculty Portal)** | `src/components/faculty/FacultyPortal.tsx` | تستدعي غير مباشر عبر `db.recordLectureSession` | `lecture_sessions`, `attendance_records` | **PARTIAL** | توثيق الكاميرا يعمل، لكن التسجيل الأساسي يتم محلياً في localStorage مع محاولة إرسال غير متزامنة لـ `/api/attendance`. |
| **الجداول الدراسية (Schedules)** | `src/components/schedule/ScheduleManagement.tsx` | لا تستدعي API (تستدعي `db.addSchedule`) | `schedules` | **PARTIAL** | فحص التعارض ينفذ في الواجهة الأمامية عبر `db.detectConflicts`. يوجد في `server.ts` كود لـ `POST /api/schedules` لكن الواجهة لا تستدعيه! |
| **المتابعة الحية (Live Monitoring)** | `src/components/monitoring/LiveMonitoring.tsx` | لا تستدعي API | `lecture_sessions`, `attendance_records` | **MOCK** | تعرض الجلسات المسجلة في `db.state.lectureSessions` وتنفذ التسجيل النيابي محلياً. |
| **التقارير الرسمية (Reports)** | `src/components/reports/OfficialReports.tsx` | لا تستدعي API | `attendance_records`, `workload_policies` | **MOCK** | الحسابات وجداول الحضور والغياب تُحسب برمجياً داخل React من الـ state المحلي. |
| **الإعدادات الأكاديمية (Settings)** | `src/components/settings/AcademicSettings.tsx` | لا تستدعي API | `system_settings`, `workload_policies` | **MOCK** | تُحفظ التغييرات في `db.updateSettings` داخل localStorage. |
| **سجل العمليات (Audit Logs)** | `src/components/common/AuditLogModal.tsx` | لا تستدعي API | `audit_logs` | **MOCK** | تقرأ من `db.state.auditLogs` المحلي ولا تقرأ من `/api/audit-logs`. |
| **معالج الإعداد الأولي (Setup Wizard)** | `src/components/wizard/SetupWizard.tsx` | لا تستدعي API | `universities`, `colleges`, `departments` | **MOCK** | يكتب الكيانات الأولية في localStorage. |
| **إدارة المستخدمين (User Management)** | *غير موجودة كشاشة مستقلة* | لا يوجد endpoint إنشاء | `users` | **BROKEN / NOT DONE** | لا توجد شاشة CRUD لإدارة المستخدمين؛ المستخدمون محددون في seed data فقط، وهو أصل مشكلة `INVALID_USER`. |

---

## 3. تدقيق الـ Backend والـ API (`server.ts`)

### أ. الـ Endpoints المتوفرة حالياً:
1. `POST /api/auth/login`: يتحقق من المستخدم في DB، لكن يقارن نصوصاً صريحة بدون تشفير bcrypt، ولا يعيد JWT Token.
2. `GET /api/users`: قراءة المستخدمين (بدون صلاحيات أو scope).
3. `GET /api/colleges`, `GET /api/departments`, `GET /api/buildings`, `GET /api/rooms`, `GET /api/stages`, `GET /api/sections`, `GET /api/subjects`, `GET /api/faculties`: استعلامات قراءة فقط بدون حماية وبدون pagination.
4. `GET /api/schedules`: قراءة الجداول.
5. `POST /api/schedules`: إضافة جدول مع فحص تعارض (موجود في الخادم لكن غير مستدعى من واجهة React).
6. `DELETE /api/schedules/:id`: حذف جدول.
7. `GET /api/attendance`: قراءة سجلات الحضور.
8. `POST /api/attendance`: تسجيل حضور مع توثيق الصور.
9. `POST /api/attendance/offline-sync`: مزامنة العمليات غير المتصلة.
10. `POST /api/lecture-sessions/resolve-unrecorded`: معالجة المحاضرات غير المسجلة.
11. `GET /api/workloads`: حساب النصاب.
12. `GET /api/audit-logs`: قراءة سجل التدقيق.
13. `GET /api/settings`: قراءة الإعدادات.
14. `GET /api/health`: فحص سلامة الخادم.

### ب. النواقص الجوهرية في الـ Backend:
- **انعدام طبقة المصادقة والصلاحيات (Auth Middleware):** لا يوجد middleware يتحقق من الـ Bearer Token أو الدور أو النطاق.
- **انعدام endpoints التعديل والإنشاء والحذف للكيانات الرئيسية:** لا يوجد:
  - `POST /api/colleges`, `PUT /api/colleges/:id`, `DELETE /api/colleges/:id`
  - `POST /api/departments`, `PUT /api/departments/:id`, `DELETE /api/departments/:id`
  - `POST /api/buildings`, `PUT /api/buildings/:id`, `DELETE /api/buildings/:id`
  - `POST /api/rooms`, `PUT /api/rooms/:id`, `DELETE /api/rooms/:id`
  - `POST /api/stages`, `PUT /api/stages/:id`, `DELETE /api/stages/:id`
  - `POST /api/sections`, `PUT /api/sections/:id`, `DELETE /api/sections/:id`
  - `POST /api/subjects`, `PUT /api/subjects/:id`, `DELETE /api/subjects/:id`
  - `POST /api/faculties`, `PUT /api/faculties/:id`, `DELETE /api/faculties/:id`
  - `POST /api/users`, `PUT /api/users/:id`, `DELETE /api/users/:id`
  - `PUT /api/settings`
- **توليد المعرفات (ID Generation):** استخدام دالة `generateId(prefix)` المبنية على `Date.now()` و`Math.random()` في `server.ts` بدلاً من UUIDs أو `gen_random_uuid()`.

---

## 4. قائمة الفجوات الأمنية الفعلية مرتبة بالأولوية (Security Gaps by Priority)

| الأولوية | الفجوة الأمنية | الوصف والتأثير | الحل المطلوب |
|---|---|---|---|
| **حرجة (P0)** | غياب التوثيق والرموز الآمنة (No JWT / Session Auth) | يمكن لأي شخص استدعاء كافة endpoints الـ API مباشرة دون توكن، ولا توجد آلية تأكيد هوية المستخدم في الطلبات. | تطبيق JWT Token مع middleware للتحقق من التوكن وصلاحيته وفك تشفيره في كل طلب. |
| **حرجة (P0)** | انعدام عزل الصلاحيات والنطاق (No RBAC / Scope Enforcement) | مسؤولو الكليات والأقسام يمكنهم الوصول إلى بيانات أي كلية أو قسم بمجرد تمرير المعرف في الـ query أو المسار (IDOR Vulnerability). | تطبيق middleware لفحص الدور وتطبيق `WHERE college_id = $1` تلقائياً وفق دور المستخدم. |
| **حرجة (P0)** | تخزين كلمات المرور بصيغة غير مشفرة (Plaintext Passwords) | يتم فحص `user.passwordHash !== password` كنص صريح دون استخدام خوارزميات التجزئة الآمنة. | اعتماد `bcrypt` لتجزئة وفحص كلمات المرور. |
| **عالية (P1)** | الاعتماد على `localStorage` كمصدر حقيقة وحيد | التغييرات لا تُحفظ في PostgreSQL، وأي مستخدم آخر أو جهاز آخر لن يرى البيانات المعدلة إطلاقاً. | تحويل جميع شاشات الـ CRUD لاستهلاك الـ REST API واستخدام PostgreSQL كمصدر وحيد للحقيقة. |
| **عالية (P1)** | عدم وجود واجهة ونقاط نهاية لإدارة المستخدمين (`User Management`) | هذا هو السبب الجذري لظهور خطأ `INVALID_USER`؛ لا توجد آلية متكاملة لإنشاء مستخدمين وربطهم بالأدوار والكليات. | بناء CRUD متكامل للمستخدمين مع تدقيق Zod ومطابقة النطاق (`Scope Validation`). |
| **متوسطة (P2)** | استخدام `Math.random()` و`Date.now()` لتوليد المعرفات | قد يسبب تضارباً في المعرفات (ID Collisions) عند تسجيل الحضور المتزامن أو تعدد الجلسات. | استخدام UUIDs القياسية (`crypto.randomUUID()` أو `gen_random_uuid()`). |
| **متوسطة (P2)** | استدعاء صور خارجية عبر Unsplash | يخالف متطلبات الخصوصية وبيئات العمل المغلقة أو منعدمة الإنترنت في الجامعات. | استبدالها برفع صور محلي إلى مجلد التخزين المخصص للتدريسيين `/uploads/faculty/`. |

---

## 5. نتائج الفحوصات المضادة للتزييف (Anti-Fake Checks Evidence)

تم تشغيل الفحوصات البرمجية المباشرة وجاءت النتائج كالتالي:

1. **فحص الـ Geolocation والـ GPS:**
   ```bash
   grep -rnE "navigator\.geolocation|latitude|longitude|geofence" src server.ts
   # النتيجة: صفر (Clean - 0 occurrences)
   ```
   *الدليل:* تم استئصال كافة مراجع الـ GPS والإحداثيات الجغرافية بنجاح سابقاً.

2. **فحص الصور الخارجية (Unsplash):**
   ```bash
   grep -rnE "unsplash|picsum|placeholder\.com" src
   # النتيجة: 8 مواضع في Navbar.tsx و FacultyManagement.tsx و seed.ts
   ```
   *الملاحظة:* يتطلب استبدالها بصور محلية/أيقونات محايدة في مرحلة الكيانات.

3. **فحص المعرفات العشوائية (`Date.now()` / `Math.random()`):**
   ```bash
   grep -rnE "Math\.random\(\)|Date\.now\(\)" src server.ts
   # النتيجة: 14 موضعاً في db.ts و apiClient.ts و server.ts (دالة generateId)
   ```
   *الملاحظة:* سيتم توحيدها على UUIDs في Phase 3.

4. **فحص استخدام `localStorage`:**
   ```bash
   grep -rnE "localStorage|sessionStorage" src server.ts
   # النتيجة: مستخدم في dashboardWidgets (مقبول لتفضيلات UI)، ومستخدم بكثافة في db.ts (يجب إلغاؤه)، وفي apiClient.ts لرتل الأوفلاين (مقبول).
   ```

5. **فحص الكلمات المفتاحية (`seed` / `mock` / `demo` / `fake`):**
   ```bash
   grep -rniE "seed|mock|demo|fake" src server.ts
   # النتيجة: موجود في زر Reset Demo في Navbar، والبيانات الأولية في seedData.ts و seed.ts.
   ```

6. **فحص `any` / `@ts-ignore`:**
   ```bash
   grep -rnE ": any|as any|@ts-ignore" src server.ts
   # النتيجة: موجود في بعض تحويلات الأنواع في النماذج ومعالجات الأخطاء catch(err: any).
   ```

7. **فحص كلمات المرور المكتوبة يدوياً (Hardcoded Passwords):**
   ```bash
   grep -rnE "password\s*[:=]\s*['\"]" src server.ts
   # النتيجة: صفر (Clean - لا توجد كلمات مرور ثابتة في الكود).
   ```

---

## 6. خاتمة التدقيق والتوصيات

المشروع يمتلك أساساً متيناً جداً من حيث التصميم، واجهات المستخدم، ومخطط قاعدة البيانات (Drizzle ORM).  
الانتقال إلى نظام إنتاجي يتطلب تنفيذ خطة المراحل المتفق عليها بالترتيب، بدءاً من خط الأساس (Phase 1) وإصلاح مسار المستخدمين (Phase 2)، ثم إرساء دعائم الـ Auth/Scope والـ API الحقيقي (Phase 3)، تليها ميكنة الكيانات واحداً تلو الآخر حتى اكتمال النظام.
