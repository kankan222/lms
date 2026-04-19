# Full-Stack LMS System Overview

Last updated: 2026-04-19

## 1. Repo Shape

Monorepo layout:

- `backend` -> Node.js + Express + MySQL API
- `frontend/software` -> internal LMS web app (admin/staff/teacher/parent views by role/permission)
- `frontend/website` -> public website
- `frontend/mobile` -> Expo React Native app
- `frontend/shared` -> shared web API helper(s)
- `uploads` -> uploaded media/files

Key root docs:

- `README.md`
- `LOCAL_CONTEXT.md` (local session memory and current operational notes)

## 2. Backend Architecture

### 2.1 Boot Sequence

- `backend/server.js`
  - loads env
  - checks DB connectivity (`SELECT 1`)
  - starts Express app
- `backend/app.js`
  - CORS + JSON middleware
  - static uploads mount: `/uploads`
  - route registration
  - auth middleware layering
  - centralized error handler

### 2.2 Layered Module Pattern

Most modules follow:

1. `*.routes.js` (routing + permission guards)
2. `*.controller.js` (HTTP boundary / request-response handling)
3. `*.service.js` (business rules)
4. `*.repository.js` (SQL and DB interaction)

Shared DB access:

- `backend/core/db/query.js`
- `backend/database/pool.js`
- `backend/config/database.js`

### 2.3 Auth + RBAC

Auth/JWT:

- `backend/modules/auth/*`
- `backend/core/auth/jwt.js`

RBAC:

- `backend/core/rbac/rbac.middleware.js`
- `backend/core/rbac/rbac.service.js`
- `backend/core/rbac/rbac.repository.js`

Flow in `app.js`:

1. Public routes mounted first
2. `authenticate` middleware
3. `attachPermissions` middleware
4. Protected routes mounted

Permission cache TTL is currently 10 minutes (`rbac.service.js`).

### 2.4 Public vs Protected Route Zones

Public (no JWT required):

- `/api/v1/auth/*`
- `/api/v1/public/staff`
- `/api/v1/public/contact`
- `/sync/*` (teacher attendance sync ingress using shared sync key)

Protected (JWT + permissions required):

- `/api/v1/dashboard`
- `/api/v1/users`
- `/api/v1/academic`
- `/api/v1/students`
- `/api/v1/parents`
- `/api/v1/teachers`
- `/api/v1/attendance`
- `/api/v1/exams`
- `/api/v1/marks`
- `/api/v1/approvals`
- `/api/v1/reports`
- `/api/v1/fees`
- `/api/v1/subjects`
- `/api/v1/messages`
- `/api/v1/staff`
- `/api/v1/website`
- `/api/v1/notifications`

## 3. Backend Domain Modules

Primary module directories in `backend/modules`:

- `academic`
- `approvals`
- `attendance`
- `auth`
- `contact`
- `dashboard`
- `exams`
- `fees`
- `iclock`
- `marks`
- `messaging`
- `notifications`
- `parents`
- `reports`
- `staff`
- `students`
- `subjects`
- `teacherAttendanceSync`
- `teachers`
- `users`

## 4. Realtime + Async Pieces

### 4.1 SSE Realtime

Messaging SSE:

- backend: `backend/modules/messaging/messaging.realtime.js`
- route: `/api/v1/messages/stream`

Notifications SSE:

- backend: `backend/modules/notifications/notification.realtime.js`
- route: `/api/v1/notifications/stream`

Internal web app uses `EventSource` listeners for both.

### 4.2 Attendance Sync Agents

Separate long-running scripts:

- `backend/scripts/run-attendance-sync-agent.js`
- `backend/scripts/teacher-attendance-sync-agent.js`
- `backend/scripts/run-mssql-attendance-sync-agent.js`
- `backend/scripts/mssql-teacher-attendance-sync-agent.js`

These push attendance events to `/sync/teacher-attendance/logs` with shared-key auth.

### 4.3 Cron Jobs Present

Files exist:

- `backend/jobs/feeReminder.job.js`
- `backend/jobs/iclockPull.job.js`

Current note:

- they exist, but no active startup wiring was found in `server.js/app.js`.

## 5. Frontend: Software (Internal Web App)

Stack:

- React + Vite
- React Router
- Tailwind + component utilities

Entrypoints:

- `frontend/software/src/main.jsx`
- `frontend/software/src/App.jsx`
- `frontend/software/src/routes/AppRoutes.jsx`
- `frontend/software/src/routes/RouteConfig.jsx`

Auth state:

- `frontend/software/src/auth/AuthProvider.jsx`
- token/user stored in `localStorage`

API layer:

- `frontend/software/src/api/*.api.js`
- shared fetch helper: `frontend/shared/api/client.js`

Route gating:

- ProtectedRoute/PublicRoute/PermissionRoute
- permissions + some role-based hide rules from route config

## 6. Frontend: Website (Public)

Stack:

- React + Vite

Entrypoints:

- `frontend/website/src/main.jsx`
- `frontend/website/src/app/AppRoutes.jsx`

Consumes public backend endpoints:

- staff listing: `/api/v1/public/staff?type=school|college`
- contact form submit: `/api/v1/public/contact/submissions`

## 7. Frontend: Mobile (Expo)

Stack:

- Expo + React Native + TypeScript
- React Navigation
- Axios
- Zustand auth store
- SecureStore for tokens

Entrypoints:

- `frontend/mobile/App.tsx`
- `frontend/mobile/src/navigation/AppNavigator.tsx`
- `frontend/mobile/src/screens/AppShellScreen.tsx`

API client:

- `frontend/mobile/src/services/api.ts`

Auth persistence:

- `frontend/mobile/src/store/authStore.ts`

Role/permission-driven tab visibility is handled in `AppShellScreen.tsx`.

## 8. Database + Migrations

Schema/history sources:

- `backend/database/migrations`
- `backend/database/*.sql`
- `backend/database/seeds`

Recent migration history includes (examples):

- student attendance workflow
- notifications delivery channels
- messaging updates
- teacher device mapping
- teacher attendance sync events
- fee structure stream scope

Operational rule from project context:

- prefer migrations and targeted SQL changes over reseeding.

## 9. File Upload Paths

Known upload handling:

- staff photos -> campus/section folders under `backend/uploads/...`
- student uploads -> `uploads/students`
- teacher uploads -> `uploads/teachers`
- static serving via backend `/uploads` mount

## 10. Environment and Run Commands

Main run commands:

Backend:

- `cd backend`
- `npm run dev`

Software:

- `cd frontend/software`
- `npm run dev`

Website:

- `cd frontend/website`
- `npm run dev`

Mobile:

- `cd frontend/mobile`
- `npm run start` (or `start:local` / `start:server`)

Env files currently present:

- `backend/.env`
- `backend/.env.development`
- `frontend/software/.env`
- `frontend/software/.env.production`
- `frontend/mobile/.env`
- `frontend/mobile/.env.production`

Note:

- root README references `.env.example` files, but those example files were not found in current repo.

## 11. Current Gaps / Caveats to Remember

- `backend/config/redis.js` exists but is empty.
- `iclock` module files exist, but route mount in `app.js` was not found.
- cron job files exist, but startup invocation in `server.js/app.js` was not found.
- RBAC permission caching may delay permission-change visibility until cache expiry or restart.

## 12. Quick Mental Model

If you need to orient quickly:

1. Backend is authoritative and permission-driven.
2. Software web app is the primary admin/staff operations client.
3. Mobile mirrors many protected features with role-aware UX.
4. Website only hits public staff/contact APIs.
5. Realtime is SSE for messaging/notifications.
6. Teacher attendance cross-system sync is handled by dedicated agent scripts, not standard request traffic.

