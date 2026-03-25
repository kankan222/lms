# Full-Stack LMS

Monorepo for the Kalong Kapili Vidyapith LMS stack.

This repository contains:

- `backend`: Express + MySQL API
- `frontend/software`: internal web app for school operations
- `frontend/website`: public website
- `frontend/mobile`: Expo mobile app

`LOCAL_CONTEXT.md` is a working session log. Treat this `README.md` as the developer-facing source of truth.

## Repository Layout

```text
backend/
  app.js
  server.js
  modules/
  database/
  uploads/

frontend/
  software/
  website/
  mobile/
  shared/
```

## Applications

### Backend

- Runtime: Node.js, Express, MySQL
- Entry points:
  - [backend/server.js](D:/Github/Full-Stack-LMS/backend/server.js)
  - [backend/app.js](D:/Github/Full-Stack-LMS/backend/app.js)
- Pattern:
  - `*.routes.js`
  - `*.controller.js`
  - `*.service.js`
  - `*.repository.js`

### Software

- Internal operations app for admins, teachers, parents, staff, and accounts
- Stack: React 19, Vite, Tailwind 4, shadcn-style UI, React Router
- Entry points:
  - [frontend/software/src/main.jsx](D:/Github/Full-Stack-LMS/frontend/software/src/main.jsx)
  - [frontend/software/src/App.jsx](D:/Github/Full-Stack-LMS/frontend/software/src/App.jsx)
  - [frontend/software/src/routes/AppRoutes.jsx](D:/Github/Full-Stack-LMS/frontend/software/src/routes/AppRoutes.jsx)

### Website

- Public marketing/information website
- Stack: React 19, Vite, Tailwind 4
- Entry points:
  - [frontend/website/src/main.jsx](D:/Github/Full-Stack-LMS/frontend/website/src/main.jsx)
  - [frontend/website/src/App.jsx](D:/Github/Full-Stack-LMS/frontend/website/src/App.jsx)
  - [frontend/website/src/app/AppRoutes.jsx](D:/Github/Full-Stack-LMS/frontend/website/src/app/AppRoutes.jsx)

### Mobile

- Expo app consuming the same backend API
- Entry points:
  - [frontend/mobile/index.ts](D:/Github/Full-Stack-LMS/frontend/mobile/index.ts)
  - [frontend/mobile/App.tsx](D:/Github/Full-Stack-LMS/frontend/mobile/App.tsx)
  - [frontend/mobile/src/navigation/AppNavigator.tsx](D:/Github/Full-Stack-LMS/frontend/mobile/src/navigation/AppNavigator.tsx)

## Environment Setup

Use example files as templates:

- [backend/.env.example](D:/Github/Full-Stack-LMS/backend/.env.example)
- [frontend/software/.env.example](D:/Github/Full-Stack-LMS/frontend/software/.env.example)
- [frontend/mobile/.env.example](D:/Github/Full-Stack-LMS/frontend/mobile/.env.example)

Real `.env` files are intentionally ignored.

## Local Run Commands

### Backend

```bash
cd backend
npm install
npm run dev
```

### Software

```bash
cd frontend/software
npm install
npm run dev
```

### Website

```bash
cd frontend/website
npm install
npm run dev
```

### Mobile

```bash
cd frontend/mobile
npm install
npm run start
```

## Backend Request Flow

Typical flow:

1. Route validates auth/permission requirements.
2. Controller parses request input.
3. Service applies business rules.
4. Repository performs SQL operations.

Global auth and RBAC are mounted in [backend/app.js](D:/Github/Full-Stack-LMS/backend/app.js):

- `authenticate`
- `attachPermissions`

Public routes are mounted before auth:

- `/api/v1/auth`
- `/api/v1/public/staff`
- `/api/v1/public/contact`

Everything else is authenticated.

## Roles And Permissions

The system is permission-driven, but some frontend UX still uses role-aware behavior for navigation and tailored workspaces.

Common roles:

- `super_admin`
- `teacher`
- `parent`
- `accounts`
- `staff`

Important rule:

- frontend visibility is not always enough to guarantee backend access
- backend route permissions are the final authority

If a module appears but returns `403`, verify:

1. the role-permission mapping in the database
2. any scope restriction in the backend service
3. whether the backend permission cache needs a restart

## Core Functional Areas

### Attendance

Files:

- [backend/modules/attendance](D:/Github/Full-Stack-LMS/backend/modules/attendance)
- [frontend/software/src/pages/Attendance.jsx](D:/Github/Full-Stack-LMS/frontend/software/src/pages/Attendance.jsx)

Current model:

- teachers take student attendance only for assigned class/section/session scopes
- submission creates a student attendance session
- admin/reviewer approves or rejects
- once approved, that session becomes locked
- teacher UI includes separate workspaces for:
  - taking attendance
  - approved sessions
  - daily history

Important nuance:

- class/section visibility in teacher filters may still be broader than approved data if built from assignment scope instead of loaded records

### Reports / Marks

Files:

- [backend/modules/marks](D:/Github/Full-Stack-LMS/backend/modules/marks)
- [backend/modules/reports](D:/Github/Full-Stack-LMS/backend/modules/reports)
- [frontend/software/src/pages/Reports.jsx](D:/Github/Full-Stack-LMS/frontend/software/src/pages/Reports.jsx)

Current model:

- teachers enter marks for exam/class/section/subject scopes they are assigned to
- marks move through `draft -> pending -> approved/rejected`
- admin review happens in the reports module
- parents can only see approved marks for linked students

### Messaging

Files:

- [backend/modules/messaging](D:/Github/Full-Stack-LMS/backend/modules/messaging)
- [frontend/software/src/pages/Messaging.jsx](D:/Github/Full-Stack-LMS/frontend/software/src/pages/Messaging.jsx)

Current model:

- software uses SSE for live updates
- direct chats resolve user names and profile images when available
- presence is shown as online/offline in messaging UI
- only `super_admin` can start new conversations
- other users can reply only in admin-started conversations

### Notifications

Files:

- [backend/modules/notifications](D:/Github/Full-Stack-LMS/backend/modules/notifications)
- [frontend/software/src/notifications](D:/Github/Full-Stack-LMS/frontend/software/src/notifications)

Current model:

- software receives live in-app notifications
- mobile is structured for push token registration and push delivery
- backend currently supports app/web delivery abstractions

### Academic / Settings

Files:

- [backend/modules/academic](D:/Github/Full-Stack-LMS/backend/modules/academic)
- [frontend/software/src/pages/Settings.jsx](D:/Github/Full-Stack-LMS/frontend/software/src/pages/Settings.jsx)

Current model:

- academic sessions support CRUD
- streams support CRUD
- classes, sections, sessions, and streams are foundational for attendance, exams, and student workflows

## Database

Main folders:

- [backend/database/migrations](D:/Github/Full-Stack-LMS/backend/database/migrations)
- [backend/database/seeds](D:/Github/Full-Stack-LMS/backend/database/seeds)

Guidelines:

- treat migration files as the authoritative schema history
- apply new migrations before testing dependent features
- some older databases may be missing newer compatibility columns such as `staff.user_id`

Useful commands:

```bash
cd backend
npm run seed:admin
```

## Frontend Structure

### Software

High-level organization:

- `src/api`: HTTP wrappers
- `src/auth`: auth context/provider
- `src/components`: shared UI and module components
- `src/pages`: route-level pages
- `src/routes`: route and permission wiring

Important files:

- [frontend/software/src/routes/RouteConfig.jsx](D:/Github/Full-Stack-LMS/frontend/software/src/routes/RouteConfig.jsx)
- [frontend/software/src/hooks/usePermissions.js](D:/Github/Full-Stack-LMS/frontend/software/src/hooks/usePermissions.js)
- [frontend/software/src/components/AppSidebar.jsx](D:/Github/Full-Stack-LMS/frontend/software/src/components/AppSidebar.jsx)
- [frontend/software/src/components/Navbar.jsx](D:/Github/Full-Stack-LMS/frontend/software/src/components/Navbar.jsx)

### Website

Important files:

- [frontend/website/src/app/AppRoutes.jsx](D:/Github/Full-Stack-LMS/frontend/website/src/app/AppRoutes.jsx)
- [frontend/website/index.html](D:/Github/Full-Stack-LMS/frontend/website/index.html)

Notes:

- the website currently uses client-rendered SEO metadata rather than prerender
- build speed was prioritized over prerendering because prerender made deploy builds too slow

### Mobile

Important files:

- [frontend/mobile/src/store/authStore.ts](D:/Github/Full-Stack-LMS/frontend/mobile/src/store/authStore.ts)
- [frontend/mobile/src/services/api.ts](D:/Github/Full-Stack-LMS/frontend/mobile/src/services/api.ts)
- [frontend/mobile/src/screens/AppShellScreen.tsx](D:/Github/Full-Stack-LMS/frontend/mobile/src/screens/AppShellScreen.tsx)

## Known Operational Notes

- full software lint used to be noisy; it is currently expected to be clean before merge
- backend permission or policy changes may require a backend restart because permission data can appear stale until remounted
- website build performance is sensitive to large static assets
- if login succeeds but routing looks wrong, inspect both permissions and `defaultLanding`

## Development Guidelines

- prefer changing shared primitives when a UX rule should affect the whole software app
- avoid committing real env files
- do not assume a clean git worktree
- do not remove files unless they are clearly unreferenced and not part of active flows

## Recommended Onboarding Path

For a new developer:

1. read this file
2. inspect [backend/app.js](D:/Github/Full-Stack-LMS/backend/app.js)
3. inspect [frontend/software/src/routes/RouteConfig.jsx](D:/Github/Full-Stack-LMS/frontend/software/src/routes/RouteConfig.jsx)
4. inspect one full backend module end-to-end, for example `attendance` or `marks`
5. run backend + software locally
6. apply latest migrations before feature work

## Safe References

- [LOCAL_CONTEXT.md](D:/Github/Full-Stack-LMS/LOCAL_CONTEXT.md): session memory and recent implementation notes
- [backend/apis.md](D:/Github/Full-Stack-LMS/backend/apis.md): older backend API notes
- [backend/serverSetup.md](D:/Github/Full-Stack-LMS/backend/serverSetup.md): server setup notes
