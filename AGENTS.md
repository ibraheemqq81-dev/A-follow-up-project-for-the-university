# AGENTS.md — General Instructions for AI Agents & Models

Welcome, AI Engineer / Assistant. You are working on **Al-Mustaqbal University Academic Attendance System (نظام متابعة حضور التدريسيين والمحاضرات – جامعة المستقبل)**.

## Core Rules for All AI Tools & Models (Bolt, Google AI Studio, Replit, GitHub):
1. **Never Rebuild from Scratch**: Preserve all existing features, database schemas, API endpoints, and UI components. Do not rewrite codebases without explicit, direct user instructions.
2. **Consult the Constitution & Specs First**: Before making any modification, read `.specify/memory/constitution.md`, `specs/PROJECT_SPEC.md`, `specs/TECHNICAL_SPEC.md`, `specs/COMPATIBILITY.md`, and `HANDOFF.md`.
3. **Handle Older or Newer Models Safely**: When operating under older model versions, make small, precise edits. Never guess or replace large files wholesale. If a file or structure is unclear, stop and report rather than guessing.
4. **Preserve Database & Migrations**: Do not change the underlying SQLite / Drizzle database schema or delete tables/columns without explicit approval.
5. **No Secret Leaks**: Never print passwords, database credentials, or secret keys in logs or files.
6. **Testing & Verification**: Always run `npm run lint` (`tsc --noEmit`) and available tests (`npm test`) after changes.
7. **Document Everything**: Update `CHANGELOG.md`, `docs/DECISIONS.md`, and `HANDOFF.md` at the conclusion of every session.
