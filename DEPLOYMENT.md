# DEPLOYMENT.md — دليل النشر والتشغيل الإنتاجي
**نظام متابعة حضور التدريسيين والمحاضرات — جامعة المستقبل (Al-Mustaqbal University)**
*الإصدار: 1.0.0 (SQLite Local Database)*

---

## 1. نظرة عامة على معمارية النشر (Deployment Architecture)

يعتمد النظام على خادم واحد وقاعدة SQLite محلية:
- **طبقة الواجهة الأمامية (Frontend):** تطبيق React 19 مبني بأحدث معايير Vite و Tailwind CSS 4 مع دعم كامل للغة العربية (RTL First).
- **طبقة الواجهة الخلفية (Backend API):** خادم Node.js / Express مع TypeScript ومحرك وسيطات للأمان (JWT, RBAC, Scope Isolation, Drizzle ORM).
- **طبقة قاعدة البيانات (Database):** ملف SQLite محلي `data/app.db` مع 24 جدولاً ومفاتيح علائقية.
- **طبقة التخزين الميداني (Classroom Evidence Storage):** مجلد محلي `/uploads/evidence/` أو تخزين سحابي مع توثيق الكاميرا الحية المباشرة وحظر الـ GPS الزائف.

```
       ┌────────────────────────────────────────────────────────┐
       │             متصفحات وأجهزة المستخدمين                  │
       │   (العمداء / مسؤولو الكليات / مسؤولو الأقسام / التدريسيون)  │
       └───────────────────────────┬────────────────────────────┘
                                   │ HTTPS (Port 443 / 3000)
                                   ▼
       ┌────────────────────────────────────────────────────────┐
       │           خادم Express + Vite Production Build         │
       │  - JWT Authentication Middleware                       │
       │  - RBAC & College/Dept Scope Enforcer                  │
       │  - Conflict Resolution Engine                          │
       │  - Atomic Excel Import Engine                          │
       └───────────────────────────┬────────────────────────────┘
                                   │ ملف SQLite محلي
                                   ▼
       ┌────────────────────────────────────────────────────────┐
       │                SQLite (24 Tables)                      │
       │  - مفاتيح علائقية وفهارس                              │
       │  - معاملات محلية مع التراجع                            │
       └────────────────────────────────────────────────────────┘
```

---

## 2. متطلبات الخادم والبيئة (System Requirements)

- **Node.js:** الإصدار `22.5` أو أحدث (يتضمن SQLite المدمجة)
- **حزمة إدارة الاعتماديات:** `npm 10+`
- **قاعدة البيانات:** تُنشأ تلقائياً في `data/app.db`؛ لا يلزم خادم قاعدة بيانات خارجي.
- **الذاكرة العشوائية (RAM):** الحد الأدنى 1 GB، والموصى به 2 GB فأعلى
- **المعالج (CPU):** 1 Core vCPU فأعلى
- **المساحة التخزينية (Disk):** 10 GB SSD على الأقل (لحفظ صور التوثيق وسجلات التدقيق)

---

## 3. المتغيرات البيئية (Environment Variables)

قم بإنشاء ملف `.env` في المجلد الجذري للمشروع:

```env
# بيئة التشغيل
NODE_ENV=production
PORT=3000

# أسرار التشفير والمصادقة
JWT_SECRET=ضع_هنا_قيمة_سرية_خاصة_ببيئتك
VITE_API_BASE_URL=/api

# سياسة التوقيت
TZ=Asia/Baghdad
```

---

## 4. خطوات التثبيت والتشغيل المحلي والإنتاجي

### أ. تثبيت الاعتماديات:
```bash
npm install
```

### ب. إنشاء المدير الأول:
```bash
npm run admin:create
```
يطلب البرنامج الاسم والبريد وكلمة مرور يختارها المشغّل.

### ج. تهيئة وفحص قاعدة البيانات:
```bash
npx tsx scripts/healthcheck.ts
```

### د. فحص التكامل المرجعي:
```bash
npx tsx scripts/verify-integrity.ts
```

### هـ. بناء نسخة الإنتاج للواجهة الأمامية:
```bash
npm run build
```

### و. تشغيل الخادم الإنتاجي:
```bash
npm run start
# أو باستخدام مدير العمليات PM2
pm2 start server.ts --name "uomus-academic-app" --interpreter ./node_modules/.bin/tsx
```

---

## 5. التشغيل عبر Docker و Cloud Run

### ملف `Dockerfile`:
```dockerfile
FROM node:24-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app ./
EXPOSE 3000
VOLUME ["/app/data"]
CMD ["npm", "run", "start"]
```

### أوامر البناء والنشر:
```bash
# بناء صورة Docker
docker build -t uomus-academic-system:latest .

# تشغيل الحاوية
docker run -d -p 3000:3000 --env-file .env --name uomus-app uomus-academic-system:latest
```

---

## 6. إجراءات النسخ الاحتياطي والاستعادة (Backup & Recovery)

### أ. إنشاء نسخة احتياطية فورية:
```bash
npx tsx scripts/backup.ts
```
يتم حفظ النسخة المشفرة مع بصمة SHA-256 داخل مجلد `./backups/uomus_backup_YYYY-MM-DD.json`.

### ب. معاينة النسخة الاحتياطية قبل التطبيق (Dry Run):
```bash
npx tsx scripts/restore.ts --file ./backups/uomus_backup_2026-10-07.json --dry-run
```

### ج. استعادة النسخة الاحتياطية الفعلية:
```bash
npx tsx scripts/restore.ts --file ./backups/uomus_backup_2026-10-07.json
```

---

## 7. مراقبة الصحة وفحص الجاهزية (Healthchecks & Probes)

يوفر النظام نقطتي نهاية أساسيتين لأنظمة المراقبة (مثل Kubernetes أو Cloud Run Probes):
1. **فحص الجاهزية البسيط (Liveness Probe):**
   - `GET /api/health`
   - الاستجابة: `200 OK`
2. **فحص السلامة العميق (Readiness / Diagnostic Probe):**
   - `GET /api/system/health`
   - يفحص ملف SQLite المحلي، زمن الاستجابة، وإحصاءات الجداول الحية.
