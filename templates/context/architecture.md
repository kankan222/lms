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
| Realtime | Server-Sent Events | Messaging, typing, presence, delivery, and notifications updates |
| Message media | Private S3-compatible storage | Production photos, documents, thumbnails, and voice notes |
| SMS | Fast2SMS with DLT templates | OTP and offline announcement delivery |
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
  trusted devices, failed-login tracking, academic structure, subject
  offerings, student subject registrations, students, parents,
  teachers, attendance, exams, marks, approvals, fees, payments,
  optional transportation routes/pickup points, student-specific transport
  assignments, transport dues/payments/receipts, class routines, exam routines,
  announcements, DLT SMS templates, holiday calendar records,
  messages, notifications, staff records, contact submissions, and
  sync events.
- **Local file storage**: uploaded student, teacher, and staff media
  served by Express through `/uploads`; messaging media may use the
  local storage driver in development.
- **Private object storage**: production messaging photos, documents,
  thumbnails, and voice notes use an S3-compatible provider. MySQL
  stores object keys and metadata, never file bodies. Media access
  requires conversation authorization and short-lived signed URLs.
- Messaging storage settings are documented in
  `backend/.env.messaging.example`. The implementation is compatible
  with AWS S3, Cloudflare R2, DigitalOcean Spaces, Backblaze B2, and
  MinIO-style endpoints.
- Announcement, holiday, routine import, and Fast2SMS worker settings
  are documented in `backend/docs/announcements-routines-ops.md`; safe
  environment placeholders live in `backend/.env.announcements.example`.
- **Notification delivery**: MySQL stores the in-app notification feed.
  SSE publishes optional realtime updates to connected software clients.
  Push delivery is best-effort and must be gated by
  `notifications.push.receive`; lack of push delivery must not prevent
  the in-app notification record from being created.
- **Browser storage**: internal web app stores `accessToken`,
  `refreshToken`, and serialized `user` in `localStorage`.
- **Mobile secure storage/cache**: mobile auth state uses Zustand and
  SecureStore; API GET responses are cached with user-scoped keys and
  stale fallback.

## Auth and Access Model

- Public routes mount before auth middleware: `/api/v1/auth`,
  `/api/v1/public/staff`, `/api/v1/public/contact`, `/sync`, and
  `/api/v1/sync`. The `/api/v1/sync` alias is the production-facing
  attendance sync path because the public reverse proxy forwards
  `/api/v1/*` requests to Express.
- Protected routes mount after `authenticate` and `attachPermissions`.
- Login accepts email, phone, or identifier plus password.
- New devices and suspicious logins require a 6 digit SMS OTP through
  Fast2SMS Smart OTP before access and refresh tokens are issued.
- In `NODE_ENV=production`, every password login requires OTP even when the
  device ID was previously trusted. Trusted-device bypass is development-only.
- Repeated password login attempts for the same active challenge should
  reuse the existing OTP challenge instead of sending another OTP.
- OTPs are sent only to the phone number stored on the user record.
- Trusted devices are identified by client-generated device IDs and
  remain trusted in non-production environments until password reset,
  account deactivation, or explicit revocation.
- Access tokens contain `userId` and `sessionId`; refresh tokens are
  hashed in the sessions table.
- Refresh sessions are role-aware: `super_admin` and `admin` refresh tokens
  and session rows expire after 1 day by default, while other users expire
  after 30 days by default.
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
10. Messaging media must remain private and may be accessed only after
    backend conversation-membership authorization plus parent/teacher
    scope eligibility where those roles are involved.
11. Existing text messages and conversations must remain readable
    after messaging schema upgrades.
12. Broadcast conversations are announcement-only; class and section
    conversations allow member replies.
13. Only super admin may initiate conversations. Student-directed
    communication targets linked parents or guardians.
14. Notifications should represent attention-worthy events only, not
    generic CRUD changes. Notification records are the source of truth;
    push is an optional delivery channel.
15. Push-device registration and push dispatch require
    `notifications.push.receive`. Notification inbox access requires
    `notifications.view`.
16. Announcements are one-way broadcast records and must remain separate from
    conversation-based Messaging.
17. Offline announcement SMS may be sent only after announcement publish and
    must use a registered DLT template.
18. Exam routine publish flows must preserve draft/published
    state history and archive the previous published record for the same scope.
    Class routine normal edits update the canonical routine for that class
    scope instead of creating duplicate draft rows.
19. Routine and announcement management is limited to admin and super admin
    permissions, while teachers and parents receive scoped read access.

## Routine Model

- Class routines are scoped by academic session, class, section, medium, and
  stream where applicable. Normal create, import, full-edit, and slot-edit
  operations upsert the canonical routine for that class scope instead of
  creating duplicate version rows.
- Class routines have an explicit `layout_mode`. `standard` routines are the
  default and remain section/medium-specific with one entry per day/period.
  `packed_hs` is available only for Higher Secondary packed routines and is the
  only mode that may use per-entry medium/section applicability or multiple
  subject rows in one period.
- Class routine reads default to the canonical Current row for each class
  scope, with explicit All versions access retained for old duplicate rows.
  Current selection prefers the published routine for the scope and falls back
  to a draft when no published routine exists.
- Draft creation for class routines is currently a compatibility redirect to
  the canonical routine. Publishing validates that canonical routine and may
  merge an older stale draft into it before publish.
- Exam routine versions remain scoped draft/published records. Publishing a
  new exam routine archives only the previous published exam routine for the
  same exam, class scope, class, and any optional section, medium, or stream
  narrowing.
- Period timing may come from reusable school-wide, higher-secondary-wide, or
  class/section-specific time-slot templates. Break periods should be modeled
  in reusable templates where possible while still allowing per-class
  overrides.
- Routine entries support subject, break, activity, assembly, games, library,
  remedial, free, and custom entry types.
- Subject entries require subject and teacher assignment. Teacher assignment
  validation should use existing academic assignment data where applicable.
- Exam routine subject entries must belong to the selected exam and selected
  class scope. Section and medium are optional because exam routines are
  class-wide by default. Eligibility uses active `subject_offerings` and also
  accepts legacy `class_subjects` where older assignment data still exists.
- Teacher time conflicts must be blocked at publish time for routines.
  Multiple teachers may be assigned to one period when needed.
- Rooms are optional.
- Parent/student routine views expose only subject and time. Teacher views
  include assigned class/section, subject, and room.
- Published class and exam routines must support PDF output.
- Excel import is a later workflow. Class routine imports should upsert the
  canonical routine for each resolved class scope, while exam routine imports
  should create draft routines. Imports should expose unresolved class,
  section, subject, teacher, and conflict mappings before save.

## Announcement Model

- Announcements are one-way broadcast records separate from Messaging.
- Announcement categories are configurable and should support general,
  holiday, festival, exam, exam reschedule, vacation, urgent, and future
  school-defined categories.
- Announcements support online, offline SMS, and both delivery modes.
- Announcements support draft, scheduled, published, sent, failed, cancelled,
  and expired lifecycle states as needed.
- Online announcements may target software, mobile, and optionally public
  website visibility. They support attachments and automatic expiry.
- Online announcement publish should create in-app notifications and push
  notifications when permitted. Urgent announcements should trigger push where
  push permission exists.
- Read tracking is not required.
- Published announcements may be edited, but content that has already been sent
  by SMS must be locked.
- Offline SMS announcements use Fast2SMS with registered DLT templates. Both
  `{#var#}` and `{#alp#}` placeholder styles must be supported.
- Offline SMS may be sent only after publish and may be scheduled.
- SMS preview and placeholder-count validation are required before publish/send.
- Failed SMS sends are retryable. Delivery status should be pulled from
  Fast2SMS when available.
- Targeting supports roles, academic scopes, and individual users. Parent SMS
  resolves to all linked active parent/guardian phone numbers and deduplicates
  duplicate numbers.
- Inactive users, inactive students, and parents of inactive students are
  excluded from announcement targets.
- Holiday and vacation announcements create display-only calendar records.
  Holiday records do not block attendance entry and can also be created
  manually outside the announcement flow.

## Messaging Model

- Message content types are text, image, document, and voice.
- A message may include text only, one voice note, or attachments from
  one category. Mixed photo/document batches are not allowed.
- A message may contain at most five attachments.
- Images are limited to 10 MB each. Documents are limited to 25 MB
  each. Voice notes are limited to 20 MB and 10 minutes.
- Supported images include JPEG/JPG, PNG, WebP, GIF, HEIC/HEIF, BMP,
  and TIFF. SVG is excluded. Images receive compressed previews and
  thumbnails.
- Supported documents include PDF, DOCX, XLSX, CSV, and TXT.
- Supported audio includes M4A/AAC, MP3, and WebM.
- Upload validation checks declared MIME type, extension, detected file
  signature, size, and authorization. Malware scanning is not required.
- Users may preview, cancel, and re-record voice notes before sending.
  Playback supports seek, duration, pause, and 1x/1.5x/2x speed.
- Senders may edit messages for one hour. Senders may delete for
  themselves or everyone; delete-for-everyone is limited to one hour.
  Administrators may remove any message or attachment.
- Replies and forwarding apply to text and media messages. Reactions
  are not supported.
- Delivery and read status are tracked per conversation member.
- Deleted media is purged after 30 days. Orphaned or failed uploads are
  purged after 24 hours. Audit metadata is retained after removal.
- The backend starts a messaging cleanup job after server startup and
  runs it daily at 03:30 unless `MESSAGING_CLEANUP_ENABLED=false`.
- Moderation includes search, reports, audit history, attachment
  removal, conversation export, and user suspension.

## Notification Model

- Notification categories are `message`, `attendance`, `marksheet`,
  `fee`, `account`, and `system`.
- Supported high-value events include new messages, approved absence
  notices sent to parents, marksheets published, marks rejected or
  needing correction, fee due/overdue reminders, payment confirmations,
  account/security alerts, and operational system alerts.
- Avoid generic notifications for every create/update/delete action or
  background sync success. Background sync should notify only when a
  failure needs user action.
- Every producer should call the shared notification service rather
  than inserting notification rows directly. The service owns category
  normalization, persistence, realtime publication, and push dispatch.
- Notifications may include `entity_type`, `entity_id`, and an
  `action_url`/`deep_link` so clients can route users to the relevant
  message, student, marksheet, fee, or account screen when supported.
