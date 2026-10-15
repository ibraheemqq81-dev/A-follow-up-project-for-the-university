# TECHNICAL_SPEC.md — البنية التقنية والتبعيات

## 1. حكامة التقنيات
- **الواجهة الأمامية (Frontend)**: React 19, TypeScript, Tailwind CSS, Vite.
- **الخادم (Backend)**: Node.js (>=22.5.0), Express.js, TypeScript (`tsx server.ts`).
- **قاعدة البيانات**: SQLite (بواسطة Drizzle ORM).
- **التوثيق**: JWT (JSON Web Tokens), bcryptjs لتشفيير كلمات المرور.
- **PWA**: vite-plugin-pwa, Service Worker مخصص (`public/sw.js`).

## 2. إدارة التبعيات وقفل الإصدارات
- الاعتماد على ملف `package.json` وعدم ترقية أو تخفيض إصدارات المكتبات الأساسية (مثل React 19, Express 4, Drizzle 0.45) دون سبب موثق.
- الالتزام بأمر `npm run lint` (`tsc --noEmit`) للتحقق من سلامة الأنواع (TypeScript types).
- تشغيل الاختبارات عبر `npm test` للتحقق من تكامل واجهات الـ API ومنطق العمليات.
