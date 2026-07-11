# Full-Stack LMS Requirements

## Functional Requirements

### 1. Authentication and Access Control

- Users must be able to sign in using an email address, phone number, or
  identifier and password.
- New devices, changed device types, unknown IP addresses, and suspicious
  login activity must require SMS OTP verification.
- Production password logins must require SMS OTP verification every time,
  even for previously verified devices.
- Successfully verified devices may be registered as trusted devices outside
  production.
- Users must be able to refresh sessions, log out, and log out from all
  sessions.
- Access must be controlled through roles and granular permissions.
- Backend routes must enforce authorization independently of frontend route
  and tab visibility.
- Supported roles include super admin, admin, teacher, parent, staff, and
  accounts users.

### 2. User and Staff Management

- Authorized administrators must be able to create and manage user accounts.
- Administrators must be able to assign roles and direct permissions.
- Users must be able to change their own passwords.
- Authorized administrators must be able to reset passwords and activate or
  deactivate accounts.
- Staff and teacher profiles must support creation, viewing, updating,
  deletion, and bulk import.
- Teacher profiles must support academic assignments and attendance-device
  mappings.

### 3. Academic Structure

- Authorized users must be able to manage academic sessions.
- The system must support school, college, and other configured academic
  scopes.
- Authorized users must be able to manage classes, sections, streams, and
  mediums.
- Authorized users must be able to manage subjects.
- Subjects must be assignable to classes and teachers.
- Teacher access must be restricted to assigned classes, sections, sessions,
  and subjects where applicable.

### 4. Student and Parent Management

- Authorized users must be able to create, view, update, delete, and bulk
  import students.
- Student records must include enrollment, academic placement, addresses, and
  documents.
- Authorized users must be able to create and manage parent and guardian
  records.
- The system must support linking multiple parents or guardians to a student.
- Parents must only be able to access students linked to their accounts.
- Student-directed communication must be delivered through linked parent or
  guardian accounts.

### 5. Student Attendance

- Teachers and other authorized users must be able to record attendance by
  class, section, academic session, and date.
- Student attendance must support present and absent statuses.
- Teachers must only access attendance scopes assigned to them.
- The system must prevent duplicate attendance for the same class, section,
  session, and date.
- Attendance submitted by teachers may require administrative approval.
- Rejected attendance must be correctable and resubmittable.
- Authorized reviewers must be able to approve or reject attendance.
- Parents of absent students may be notified only after attendance approval.
- Parent notices must support predefined templates and custom messages.
- Attendance-related messages and notifications must be recorded.

### 6. Teacher Attendance

- Authorized users must be able to manage biometric attendance devices and
  user mappings.
- The backend must accept attendance logs from authorized external systems.
- Attendance synchronization must use shared-key authentication.
- The system must support MSSQL-based attendance source agents.
- Duplicate source events must not create duplicate attendance records.
- Synced events must contribute to teacher daily attendance records and
  reports.

### 7. Exams, Marks, and Reports

- Authorized users must be able to create, view, update, and delete exams.
- Exams must be scoped to appropriate academic sessions and classes.
- Exams must support subject configuration and separate mark components.
- Authorized teachers must be able to save draft marks for assigned scopes and
  subjects.
- Marks must be submittable for approval.
- Authorized reviewers must be able to approve or reject submitted marks.
- Parents must only access approved results for linked students.
- The system must generate student reports, marksheets, and supported PDF
  documents.

### 8. Fees and Payments

- Authorized users must be able to create and manage fee structures.
- Fee structures must support academic session, class, and stream scope.
- Authorized users must be able to configure fee installments.
- The system must generate and maintain student fee ledgers.
- Authorized users must be able to record, update, delete, and approve
  payments.
- The system must display pending and completed payments.
- Parents must be able to view fees and payments for linked students.
- The system must generate payment receipts.
- Authorized users must be able to export payment data as CSV.
- The system must support scheduled fee-reminder processing.
- The system must support student-specific transportation fee management from
  Student Details and the Transportation Fee page.
- Transportation fees must be assignable per student and academic session,
  starting from the student's actual service start month with a per-student
  monthly amount.
- Transportation fees must generate month-wise dues and allow one payment to
  cover multiple selected months.
- Transportation fee payments and receipts must remain separate from normal
  admission/installment fee payments and receipts.

### 9. Messaging

- Only super admin users may initiate conversations.
- Authorized conversation members may participate where the conversation type
  permits replies.
- The system must support direct, class, section, and broadcast conversations.
- Broadcast conversations must be announcement-only.
- Class and section conversations must allow member replies.
- Messages must support text, image, document, and voice content.
- A message may contain no more than five attachments.
- Users must be able to preview media and record, review, cancel, and re-record
  voice notes before sending.
- Voice playback must support seeking, duration display, pause, and supported
  playback speeds.
- The system must support replies and forwarding.
- Direct conversations must support typing indicators.
- Delivery and read status must be tracked per conversation member.
- Users must be able to search messages.
- Senders must be able to edit messages within one hour.
- Senders must be able to delete messages for themselves or everyone, subject
  to the configured one-hour delete-for-everyone window.
- Users must be able to report messages.
- Authorized moderators must be able to review reports, suspend messaging
  users, manage conversation membership, remove attachments, inspect audit
  history, and export conversations.
- Messaging media must remain private and require conversation-membership
  authorization.
- Deleted, failed, expired, and orphaned media must be cleaned up according to
  configured retention rules.
- Existing text messages and conversations must remain readable after
  messaging upgrades.

### 10. Notifications

- Users must be able to retrieve their notifications.
- Users must be able to mark one or all notifications as read.
- Users must be able to delete supported notifications.
- Web clients must receive realtime notification updates through
  Server-Sent Events where available.
- Mobile devices must support registration for push notifications where
  enabled.
- Domain workflows such as attendance must be able to create notifications.

### 11. Dashboards and Reporting

- The system must provide role-appropriate dashboard information.
- Dashboards may include operational statistics, attendance, recent activity,
  messages, and upcoming exams according to permissions.
- The system must provide student, teacher, attendance, marks, and payment
  reports.
- Supported reports must be downloadable as PDF or exported in the appropriate
  format.

### 12. Internal Web Application

- The internal web application must provide protected, permission-aware
  routes.
- Navigation and modules must reflect the current user's roles and
  permissions.
- The application must provide operational tables, forms, filters, dialogs,
  dashboards, and reports.
- The application must automatically refresh expired access tokens when a
  valid refresh token is available.
- The application must support realtime messaging and notifications.
- Authorized users must be able to manage public staff content and inspect
  website contact submissions.

### 13. Public Website

- The public website must provide home, school, college, and computer-section
  pages.
- It must provide facilities, gallery, fee structure, staff, rules, privacy,
  and contact pages where configured.
- Public staff information must be retrievable without authentication.
- Visitors must be able to submit contact forms.
- Authorized internal users must be able to inspect contact submissions.

### 14. Mobile Application

- The mobile application must provide role-aware modules and navigation.
- It must support password login and OTP verification.
- Authentication tokens must be stored securely.
- Users must only see and access permitted LMS modules.
- API reads must be cached by user scope.
- Stale cached data may be returned when the network is unavailable.
- Mobile messaging must support text, uploads, document selection, images, and
  voice recording.
- Production updates must preserve the existing Android package and iOS bundle
  identifiers.

## System Requirements

### 1. Runtime and Platform

- The backend requires a Node.js runtime compatible with Express 5 and ES
  modules.
- MySQL must be available and accessible through `mysql2/promise`.
- npm is required for dependency installation and project scripts.
- Modern browsers are required for the internal and public web applications.
- Expo and EAS tooling are required for mobile development and production
  releases.
- The MSSQL attendance sync agent requires a Node.js environment with network
  access to its configured SQL Server and LMS API.

### 2. Backend Architecture

- The backend must use Express 5 as the authoritative HTTP API.
- The backend must verify database connectivity before accepting requests.
- Public routes must be mounted before global authentication middleware.
- Protected routes must pass through authentication and permission attachment.
- Backend modules should separate routes, controllers, services, and
  repositories.
- Controllers must handle HTTP parsing and response formatting.
- Services must contain business rules and orchestration.
- Repositories must contain SQL and database interaction.
- SQL queries must be parameterized.
- Expected user-facing failures must use the project's structured error
  handling.

### 3. Database

- MySQL is the authoritative relational datastore.
- Schema and durable data changes must use versioned migrations.
- Applied migrations must not be modified; new migrations must be added.
- Production schema evolution must not depend on complete database reseeding.
- The database must store users, roles, permissions, sessions, OTP challenges,
  trusted devices, academic records, people records, attendance, exams, marks,
  fees, payments, messaging, notifications, audits, and synchronization
  events.

### 4. Authentication and Security

- Passwords must be hashed with bcrypt.
- Refresh tokens must be hashed before database storage.
- OTP values must only be stored as hashes and must not be logged.
- Access tokens must identify the user and session.
- Refresh tokens must support rotation.
- Token refresh must not require OTP verification.
- Refresh sessions for `super_admin` and `admin` users must expire after 1 day
  by default, while other user sessions must expire after 30 days by default.
- Production password logins must complete OTP verification on every login.
- Non-production new or suspicious devices must complete OTP verification.
- Trusted devices must be revocable after password reset, account
  deactivation, or explicit administrative action.
- Backend permission checks are the security boundary.
- Frontend route and tab visibility must not be treated as authorization.
- Real secrets and environment files must not be committed.
- Uploads must be validated by authorization, size, extension, MIME type, and
  file signature where applicable.

### 5. Storage

- MySQL must store records, relationships, permissions, metadata, and audit
  state.
- Student, teacher, staff, and other standard uploads may use backend-served
  local storage.
- Production messaging media must use private S3-compatible object storage.
- The messaging storage abstraction must support local development storage.
- Messaging media must not use permanent public URLs.
- Media access must require conversation-membership authorization.
- Downloads must use authorized backend streaming or short-lived signed URLs.
- Deleted messaging media must be purged after 30 days.
- Failed and orphaned messaging uploads must be purged after 24 hours.

### 6. Internal Web Application

- The internal application requires React 19, Vite, Tailwind CSS 4, and the
  existing shadcn-style component system.
- It must be built and served under `/software`.
- The production web server must support single-page application route
  fallback.
- `VITE_API_URL` must configure the backend API base URL.
- The current implementation requires browser `localStorage` for
  authentication state.
- Browsers must support `EventSource` for realtime features.

### 7. Public Website

- The website requires React 19, Vite, and Tailwind CSS 4.
- Public backend endpoints must be reachable without JWT authentication.
- The production web server must support single-page application route
  fallback.
- Static assets, fonts, `sitemap.xml`, and `robots.txt` must be served
  correctly.

### 8. Mobile Application

- The mobile application requires Expo SDK 54, React Native 0.81, and
  TypeScript 5.9.
- SecureStore is required for authentication persistence.
- File-system access is required for persisted API caching.
- Image picker, document picker, audio recording, and sharing capabilities are
  required by messaging.
- `EXPO_PUBLIC_API_BASE_URL` must contain a valid backend API URL.
- Production mobile builds must use EAS.
- The production API URL is
  `https://kalongkapilividyapith.com/api/v1`.
- The Android package identifier must remain
  `com.kalongkapilividyapith.mobile`.
- The iOS bundle identifier must remain
  `com.kalongkapilividyapith.mobile`.
- Store releases must increment the required platform build number or version
  code.

### 9. Realtime and External Integrations

- Messaging, typing, presence, delivery, and notification updates use
  Server-Sent Events.
- Core functionality must remain available through standard HTTP APIs when
  realtime connections fail.
- Teacher attendance synchronization must require a configured shared secret.
- The MSSQL sync agent requires SQL Server connection details, source table and
  column configuration, an LMS API address, site identifier, batch size,
  interval, and persistent state storage.
- Fast2SMS configuration is required for production OTP delivery.
- Expo push configuration is required only when push delivery is enabled.

### 10. Background Jobs

- Messaging cleanup must start with the backend unless disabled and run daily
  at 03:30.
- Fee-reminder and iClock pull jobs require explicit process or startup wiring.
- Long-running backend and attendance-sync processes may be managed with PM2.
- Scheduled jobs should run as a single effective instance unless distributed
  locking is added.

### 11. Validation and Operations

- Backend changes should be validated with targeted endpoint or script checks
  because no comprehensive backend test suite currently exists.
- Internal web changes should pass `npm run lint` and `npm run build` from
  `frontend/software`.
- Public website changes should pass `npm run lint` and `npm run build` from
  `frontend/website`.
- Mobile changes should pass `npm run typecheck` from `frontend/mobile`.
- Database migrations must be reviewed or applied in a suitable local
  environment before deployment.
- Authentication, authorization, payment, and mobile changes should use staged
  testing before broad production rollout.
- Production releases must preserve existing data, conversations, package
  identifiers, and compatible client behavior.
