# Code Standards

## General

- Keep changes scoped to the affected module and preserve the existing
  layered backend pattern.
- Fix root causes instead of adding UI-only or controller-only
  workarounds.
- Do not mix unrelated domains in one route, service, component, or
  migration.
- Prefer existing helpers and conventions before introducing new
  abstractions.
- Keep response shapes predictable: successful API responses generally
  include `success` and `data` when the surrounding module already does.

## TypeScript

- TypeScript is currently used in `frontend/mobile`.
- Keep mobile service and screen types explicit enough to protect API
  contracts.
- Avoid broad `any`; use local interfaces or shared types in
  `frontend/mobile/src/types` where appropriate.
- Validate mobile environment values through the existing Zod env
  pattern.

## Backend Express

- Keep module files organized as routes, controller, service, and
  repository when adding or expanding backend features.
- Route files own HTTP method/path definitions and permission guards.
- Controllers parse request input, call services, and send responses.
- Services own business rules, cross-repository orchestration, and
  domain-specific errors.
- Repositories own SQL and database interaction only.
- Use `AppError` or existing module error mapping for expected
  user-facing failures.
- Use parameterized queries through `pool.execute`, `query`, or
  existing repository helpers.

## Styling

- Web apps use Tailwind 4 tokens from their `index.css` files.
- Prefer existing shadcn-style components in
  `frontend/software/src/components/ui`.
- Keep internal software UI dense, operational, and role-focused.
- Keep public website UI consistent with the existing punch/red brand
  palette and section layout conventions.
- Mobile styles should use `useAppTheme` and values from
  `mobileTheme.ts` instead of one-off colors.

## API Routes

- Mount public routes before `authenticate`; mount protected routes
  after `authenticate` and `attachPermissions`.
- Add `requirePermission` to protected routes unless a broader parent
  guard already enforces the same rule.
- Parse and normalize request input at the controller boundary.
- Enforce role, ownership, scope, and permission rules before any
  mutation.
- Keep SSE endpoints compatible with browser `EventSource`; token
  query support exists for those streams.
- Notification producers must use `backend/modules/notifications`
  service functions. Do not insert into `notifications` directly from
  another domain module unless that module is inside a larger
  transaction and immediately delegates delivery through the
  notification service.
- Push notification token registration and push dispatch must be
  gated by `notifications.push.receive`; `notifications.view` controls
  in-app inbox access only.
- Preserve refresh-token behavior for 401 responses in web and mobile
  clients.
- Login clients must send stable `x-device-id` and `x-device-type`
  headers so trusted-device checks work consistently.
- OTP verification and resend routes are public auth routes, but must
  validate the challenge, device, expiry, resend limit, and attempt
  limit before issuing tokens.

## Data and Storage

- Metadata, relationships, permissions, sessions, and transactional
  records belong in MySQL.
- Uploaded media/files belong in upload folders and should be served
  by `/uploads`.
- Messaging media must use the messaging storage abstraction: local
  storage for development and private S3-compatible object storage for
  production. Do not persist public messaging attachment URLs.
- Authorize every messaging media download against conversation
  membership before issuing a local response or short-lived signed URL.
- Validate messaging uploads by size, extension, MIME type, and file
  signature. SVG is not accepted. Malware scanning is not required.
- Keep attachment metadata, deletion state, delivery/read state, and
  moderation audit records in MySQL.
- Prefer migrations over reseeding for schema and durable data changes.
- Do not introduce ad hoc SQL in controllers or frontend code.
- Keep cache invalidation in mind when changing mobile GET responses
  or mutation endpoints.
- Store OTP hashes only. Never store or log plain OTP values.
- Revoke trusted devices when passwords reset or accounts deactivate.
- Do not mix timestamp clocks for school-facing records. If a module
  stores school-local `DATETIME` values and compares schedules with a
  module helper such as `schoolNowSql()`, all user-visible timestamps
  in that module must use the same helper instead of raw `NOW()` or
  JavaScript `new Date()`.

## File Organization

- `backend/modules/[domain]/` - backend feature routes, controllers,
  services, repositories, realtime helpers, upload helpers, and PDFs.
- `backend/core/` - shared backend infrastructure such as auth, DB,
  RBAC, and errors.
- `backend/database/migrations/` - versioned schema/data changes.
- `backend/jobs/` - cron jobs that can be wired into startup or run
  separately.
- `backend/scripts/` - local wrappers and sync agents.
- `frontend/software/src/api/` - internal web API wrappers.
- `frontend/software/src/pages/` - route-level internal web views.
- `frontend/software/src/components/` - shared and domain-specific
  internal web components.
- `frontend/website/src/pages/` - public website route views.
- `frontend/website/src/modules/` - public section layout/config code.
- `frontend/mobile/src/screens/` - mobile screens and tab modules.
- `frontend/mobile/src/services/` - mobile API clients and domain
  services.
