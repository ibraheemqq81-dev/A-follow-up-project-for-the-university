# API_DOCS.md — التوثيق المرجعي الشامل لواجهات البرمجة (REST API)
**نظام متابعة حضور التدريسيين والمحاضرات — جامعة المستقبل (Al-Mustaqbal University)**
*الإصدار: 1.0.0 (Phase 7 Production)*

---

## 1. مبادئ التصميم والمصادقة (Authentication & RBAC)

- **ترويسة المصادقة (Authorization Header):**
  `Authorization: Bearer <JWT_TOKEN>`
- **الأدوار المعتمدة في النظام (User Roles):**
  1. `OWNER`: مسؤول النظام الرئيسي في جامعة المستقبل (صلاحية شاملة على كافة الكليات والإعدادات والنسخ الاحتياطي).
  2. `COLLEGE_MONITOR`: مسؤول متابعة الكلية (مقيد بكلية محددة `assignedCollegeId`).
  3. `DEPARTMENT_MONITOR`: مسؤول متابعة القسم (مقيد بقسم محدد `assignedDepartmentId`).
  4. `FACULTY`: عضو الهيئة التدريسية (مقيد بجداوله ومحاضراته فقط `assignedFacultyId`).

- **هيكل الاستجابة القياسي (Standard Response Format):**
  ```json
  {
    "success": true,
    "data": { ... },
    "message": "نص التوضيح باللغة العربية"
  }
  ```
  أو عند حدوث خطأ:
  ```json
  {
    "success": false,
    "error": {
      "code": "ERROR_CODE",
      "message": "رسالة الخطأ بالعربية والإنجليزية"
    }
  }
  ```

---

## 2. مسارات المصادقة والمستخدمين (Auth & Users)

### `POST /api/auth/login`
تسجيل دخول مستخدم واستخراج توكن JWT.
- **المدخلات (Body):**
  ```json
  {
    "email": "admin@uomus.edu.iq",
    "password": "SecurePassword123"
  }
  ```
- **المخرجات (200 OK):**
  ```json
  {
    "token": "eyJhbGciOi...",
    "user": {
      "id": "user-sys-...",
      "uid": "user-sys-...",
      "name": "مسؤول النظام الرئيسي",
      "email": "admin@uomus.edu.iq",
      "role": "OWNER"
    }
  }
  ```

### `GET /api/users`
قراءة قائمة المستخدمين مع تطبيق عزل النطاق (Scope Isolation).

### `POST /api/users`
إنشاء مستخدم جديد مع تشفير كلمة المرور بـ `bcryptjs` وتعيين `uid` فريد.
- **الصلاحية:** `OWNER` أو `COLLEGE_MONITOR` (مقيد بكليته).

### `PUT /api/users/:id` | `DELETE /api/users/:id`
تعديل بيانات مستخدم أو تعطيله/حذفه.

---

## 3. مسارات الكيانات الأكاديمية (Vertical Slices CRUD)

| الكيان الأكاديمي | القراءة (GET) | الإنشاء (POST) | التعديل (PUT) | الحذف (DELETE) |
|---|---|---|---|---|
| **الكليات (Colleges)** | `/api/colleges` | `/api/colleges` | `/api/colleges/:id` | `/api/colleges/:id` |
| **الأقسام (Departments)** | `/api/departments` | `/api/departments` | `/api/departments/:id` | `/api/departments/:id` |
| **المباني (Buildings)** | `/api/buildings` | `/api/buildings` | `/api/buildings/:id` | `/api/buildings/:id` |
| **القاعات (Rooms)** | `/api/rooms` | `/api/rooms` | `/api/rooms/:id` | `/api/rooms/:id` |
| **المراحل (Stages)** | `/api/stages` | `/api/stages` | `/api/stages/:id` | `/api/stages/:id` |
| **الشعب (Sections)** | `/api/sections` | `/api/sections` | `/api/sections/:id` | `/api/sections/:id` |
| **المواد الدراسية (Subjects)** | `/api/subjects` | `/api/subjects` | `/api/subjects/:id` | `/api/subjects/:id` |
| **التدريسيون (Faculty)** | `/api/faculties` | `/api/faculties` | `/api/faculties/:id` | `/api/faculties/:id` |

---

## 4. مسارات الجداول ومنع التعارض الثلاثي (Schedules & Conflict Engine)

### `GET /api/schedules`
قراءة الجداول مع دعم الفلاتر: `?collegeId=...&departmentId=...&facultyId=...&roomId=...&day=...`.

### `POST /api/schedules`
إضافة محاضرة مجدولة مع **فحص التعارض الثلاثي الفوري والمحكم**:
- التحقق من خلو القاعة في نفس اليوم والتوقيت.
- التحقق من تفرغ التدريسي في نفس اليوم والتوقيت.
- التحقق من تفرغ الشعبة الدراسية في نفس اليوم والتوقيت.
- في حال وجود تعارض، يتم إرجاع كود `409 CONFLICT` مع التفاصيل الكاملة.

---

## 5. مسارات تسجيل الحضور والتوثيق الميداني (Attendance & Evidence)

### `POST /api/attendance`
تسجيل وتوثيق حضور محاضرة داخل القاعة الدراسية:
- **المعاملات الأساسية:**
  - `scheduleId`: معرف المحاضرة في الجدول.
  - `facultyId`: معرف التدريسي.
  - `lectureDate`: تاريخ المحاضرة (YYYY-MM-DD).
  - `studentsPresent`: عدد الطلبة الحاضرين.
  - `evidencePhotoUrl`: صورة التوثيق الحية من الكاميرا المباشرة للقاعة الدراسية.
  - `recordingMode`: `DIRECT` (تسجيل مباشر من التدريسي) أو `ON_BEHALF` (تسجيل نيابي من مراقب الكلية/القسم).
  - `onBehalfReason`: سبب التسجيل النيابي (`FACULTY_DEVICE_MALFUNCTION`, `DEVICE_BATTERY_DEAD`, `OFFICIAL_DELEGATION`, إلخ).

### `POST /api/attendance/offline-sync`
مزامنة حزمة عمليات الحضور المسجلة محلياً في وضع عدم الاتصال (Offline Queue Sync) مع المعاملات الذرية.

### `POST /api/lecture-sessions/resolve-unrecorded`
معالجة وإغلاق المحاضرات غير المسجلة مع تسجيل المبرر الرسمي والتدريسي البديل إن وجد.

---

## 6. مسارات مركز الاستيراد الذري والأنصبة والتقارير (Import & Reports)

### `POST /api/import/:entityType`
استيراد ذري لبيانات Excel/CSV مع التراجع التام (Atomic Transaction Rollback) لـ 9 كيانات.

### `GET /api/import/template/:entityType`
تحميل وتوليد قوالب الاستيراد المعتمدة مع الحقول المطلوبة والأمثلة.

### `GET /api/workloads` | `GET /api/workloads/summary`
حساب الأنصبة الرسمية للتدريسيين ومقارنتها بالساعات المجدولة حسب الألقاب الأكاديمية.

### `GET /api/reports/daily-attendance`
تقرير الموقف اليومي المعتمد لجامعة المستقبل.

### `GET /api/reports/faculty-absences`
تقرير غياب وتأخر التدريسيين والمحاضرات غير المسجلة.

### `GET /api/reports/room-utilization`
تقرير استثمار وإشغال القاعات والمختبرات الدراسية.

---

## 7. مسارات التشغيل والتشخيص والنسخ الاحتياطي (System Operations & Backup)

### `GET /api/health`
فحص الجاهزية البسيط (Liveness Check).

### `GET /api/system/health`
فحص تشخيصي عميق (Deep Health Diagnostic) يشمل:
- زمن استجابة قاعدة البيانات المحلية SQLite بالمللي ثانية
- حالة اتصال SQLite المحلية وملف القاعدة
- تعداد السجلات في كافة الجداول
- استهلاك الذاكرة ومدة التشغيل (Uptime)

### `GET /api/system/stats`
إحصاءات شاملة ومفصلة لجميع الكيانات والمستخدمين وحالات الحضور.

### `POST /api/system/backup`
إنشاء وتحميل نسخة احتياطية كاملة وموثقة مع بصمة SHA-256 Checksum وسجل تدقيق للعملية.

### `POST /api/system/verify-integrity`
محرك فحص التكامل المرجعي العميق (Foreign Key & Schedule Conflict Integrity Verifier).

### `PUT /api/settings`
تحديث وتعديل الإعدادات العامة والأكاديمية للنظام في قاعدة البيانات.
# صور محلية (المرحلة A)

- `POST /api/uploads/image` يتطلب جلسة دخول ويستقبل `{ entity, entityId, data }`، حيث `data` صورة Data URL أو `null` لحذفها.
- الأنواع المسموحة PNG وJPEG وWebP، والحجم بعد المعالجة لا يتجاوز 2MB.
- تُحفظ الصور في `data/uploads` وتُقرأ عبر `GET /api/files/<entity>/<filename>` مع المصادقة.
