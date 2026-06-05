# Architecture Context

## Stack

| Layer | Technology | Role |
| ----- | ---------- | ---- |
| Backend API | Node.js, Express 5, ES modules | Authoritative HTTP API and business rules |
| Database | MySQL via `mysql2/promise` | Relational source of truth |
| Auth | JWT tokens, bcrypt, Fast2SMS OTP | Password login, OTP challenge, sessions, token refresh |
| RBAC | Custom permission middleware | Server-side route authorization |
| Internal web app | React 19, Vite, React Router | Admin/staff/teacher/parent/accounts UI |
| Public website | React 19, Vite, React Router | Public marketing/information site |
| Mobile app | Expo, React Native, TypeScript | Role-aware mobile access |
| Styling | Tailwind CSS 4, shadcn-style UI | Web UI tokens and reusable components |
| Mobile state | Zustand, SecureStore, Axios | Auth persistence and API access |
| Realtime | Server-Sent Events | Messaging and notifications updates |
| Jobs and agents | `node-cron`, Node scripts | Fee reminders, iclock pulls, attendance sync |

## System Boundaries

- `backend/app.js` - Express middleware, static uploads, public
  routes, protected route mounting, and centralized error handling.
- `backend/server.js` - environment loading, database health check,
  and HTTP server startup.
- `backend/modules/*` - feature modules. Most modules follow
  `*.routes.js`, `*.controller.js`, `*.service.js`, and
  `*.repository.js`.
- `backend/core/*` - shared backend concerns such as DB query
  helpers, JWT helpers, RBAC, and shared errors.
- `backend/database/migrations` - schema and data evolution history.
- `backend/database/seeds` - targeted seed scripts, not the primary
  production schema mechanism.
- `backend/jobs` - cron-capable background jobs.
- `backend/scripts` - local startup wrappers and attendance sync
  agents.
- `frontend/software` - internal LMS operations web app.
- `frontend/website` - public website.
- `frontend/mobile` - Expo mobile app.
- `frontend/shared` - shared web API helper currently used by
  `frontend/software`.
- `uploads` and `backend/uploads` - local uploaded media/files.

## Storage Model

- **MySQL**: users, roles, permissions, sessions, OTP challenges,
  trusted devices, failed-login tracking, academic structure, students,
  parents, teachers, attendance, exams, marks, approvals, fees,
  payments, messages, notifications, staff records, contact
  submissions, and sync events.
- **Local file storage**: uploaded student, teacher, and staff media
  served by Express through `/uploads`.
- **Browser storage**: internal web app stores `accessToken`,
  `refreshToken`, and serialized `user` in `localStorage`.
- **Mobile secure storage/cache**: mobile auth state uses Zustand and
  SecureStore; API GET responses are cached with user-scoped keys and
  stale fallback.

## Auth and Access Model

- Public routes mount before auth middleware: `/api/v1/auth`,
  `/api/v1/public/staff`, `/api/v1/public/contact`, and `/sync`.
- Protected routes mount after `authenticate` and `attachPermissions`.
- Login accepts email, phone, or identifier plus password.
- New devices and suspicious logins require a 6 digit SMS OTP through
  Fast2SMS Smart OTP before access and refresh tokens are issued.
- Repeated password login attempts for the same active challenge should
  reuse the existing OTP challenge instead of sending another OTP.
- OTPs are sent only to the phone number stored on the user record.
- Trusted devices are identified by client-generated device IDs and
  remain trusted until password reset, account deactivation, or
  explicit revocation.
- Access tokens contain `userId` and `sessionId`; refresh tokens are
  hashed in the sessions table.
- Permissions are loaded server-side and cached for 10 minutes by
  user id.
- Backend `requirePermission` checks are the security boundary.
- Web and mobile route/tab visibility improves UX but must not be
  treated as authorization.
- Teacher attendance sync ingress uses shared-key style sync routes,
  separate from standard user JWT flows.

## Release Model

- The project is already in production.
- Any backend, website, internal software, or mobile release should be
  treated as a production update, not a first-time launch.
- Android app updates must keep the existing package name:
  `com.kalongkapilividyapith.mobile`.
- iOS app updates must keep the existing bundle identifier:
  `com.kalongkapilividyapith.mobile`.
- Mobile store updates must increment the platform build number or
  version code before submission.
- Production mobile builds should use the production API URL:
  `https://kalongkapilividyapith.com/api/v1`.
- Prefer TestFlight/internal or closed testing before production
  rollout when authentication, permissions, or payment/fee behavior
  changes.

## Invariants

1. All protected backend endpoints must run after authentication and
   permission attachment.
2. Mutating protected routes must enforce an explicit permission in
   route middleware or a stricter service-level rule.
3. Controllers should stay at the HTTP boundary; business rules belong
   in services, and SQL belongs in repositories.
4. Database schema changes belong in migrations. Do not depend on full
   reseeding to deploy normal changes.
5. Uploaded files must be referenced by persisted metadata and served
   through the backend upload mount.
6. Frontend clients must refresh expired access tokens through the
   backend refresh endpoint instead of silently ignoring 401 responses.
7. OTP verification applies to login challenges only; token refresh
   must not trigger OTP.
8. Realtime messaging/notification streams must be optional from a UX
   perspective; core data should still be retrievable by normal APIs.
9. Do not commit real local environment secrets.
