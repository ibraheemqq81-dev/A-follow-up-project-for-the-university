# سجل التغييرات — CHANGELOG.md
# Al-Mustaqbal University Attendance System Changelog

## [1.4.0] — 2026-10-15 (Password Policy Enforcement & Robust Settings APIs)
### Fixed & Improved
- **Password Policy & Length Enforcement**:
  - Added backend configuration and validation for both minimum (`minPasswordLength`) and maximum (`maxPasswordLength`) password lengths in `server.ts` and `validatePassword`.
  - Synced password policy inputs in `SystemSettings.tsx` and database settings.
- **Robust Settings Backend APIs**:
  - Implemented missing server endpoints (`/api/settings/account`, `/api/settings/email-config`, `/api/settings/university`) to persist and retrieve all system settings securely in SQLite without relying on fallbacks.
- **System Verification & Integrity**:
  - Verified 100% successful build and TypeScript compilation (`tsc --noEmit`).

## [1.3.0] — 2026-10-15 (College Dean Role & Permissions Integration)
### Fixed & Improved
- **College Dean (`COLLEGE_DEAN`) Role Integration**:
  - Added full navigation menu support for `COLLEGE_DEAN` in `Sidebar.tsx` (Dashboard, Monitoring, Reports, Faculty, Import, Colleges, Rooms, Stages, Subjects, Settings, Change Requests, Academic Calendar).
  - Enabled change request review and approval for College Deans both on frontend (`ChangeRequestsView.tsx`) and backend API (`server.ts`).
  - Restored proper visibility of academic settings and oversight controls for college deans and monitors without altering existing roles or database structures.

## [1.2.0] — 2026-10-15 (PWA & Responsive Web App Upgrade)
### Added
- **Progressive Web App (PWA) Support**:
  - Web App Manifest (`manifest.webmanifest`, `manifest.json`) with Arabic RTL support, theme colors, display standalone, and shortcuts.
  - PWA Service Worker (`public/sw.js`) with static asset caching and strict security rules excluding sensitive authentication endpoints (`/api/auth`, `/api/users`).
  - High-resolution PWA icons (192px, 512px, maskable, apple-touch-icon, and favicon).
- **In-App PWA Install UI**:
  - `PWAInstallButton` and `PWAInstallModal` components allowing one-click installation on Android, Windows/macOS, and guided instructions for iOS Safari.
- **Offline Mode & Synchronization**:
  - Real-time `OfflineStatusBar` monitoring connectivity state.
  - Robust offline attendance queue (`uomus_offline_attendance_queue`) with automatic sync on reconnect and duplicate prevention (idempotency & 409 conflict check).
- **Responsive Mobile Layout Improvements**:
  - `MobileBottomBar` for thumb-friendly navigation on smartphones.
  - Full mobile camera support with watermarking for lecture evidence.
- **Documentation**:
  - Updated `README.md` and created `HANDOFF.md` and `CHANGELOG.md`.

## [1.1.0] — Secure Email Verification & Account Management
### Added
- Email verification flow with 6-digit codes.
- Administrator account approval and device management.
- Role-based access control (RBAC) hardening.
