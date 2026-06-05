# Progress Tracker

Update this file after every meaningful implementation change.

## Current Phase

- Existing production project maintenance and feature development.

## Current Goal

- Keep project reference docs aligned with the current Full-Stack LMS
  architecture so future changes can be made consistently.

## Completed

- Analyzed the repository layout: backend, internal software app,
  public website, mobile app, shared API helper, uploads, migrations,
  jobs, and scripts.
- Documented backend route layering, auth, RBAC, database access,
  module pattern, and realtime SSE usage.
- Documented frontend boundaries and UI conventions for internal web,
  public website, and mobile.
- Captured current validation setup and known operational gaps.
- Added OTP-based login for new/suspicious devices using Fast2SMS
  Smart OTP, hashed OTP challenges, trusted devices, resend limits,
  and wrong-attempt blocking.
- Added internal web `/verify-otp` flow and mobile OTP verification
  state for new-device login.

## In Progress

- Apply the OTP auth migration and configure all Fast2SMS OTP template
  IDs before validating with real SMS delivery.

## Next Up

- Add missing `.env.example` files if environment onboarding is a
  priority.
- Add `FAST2SMS_ACCOUNTS_OTP_ID` and `FAST2SMS_DEFAULT_OTP_ID` after
  approval, if not already present.
- Decide whether cron jobs should be wired into backend startup or run
  as separate processes.
- Decide whether `backend/modules/iclock` routes should be mounted.
- Add automated tests around auth/RBAC and high-risk domain modules.
- Keep migration history current for any schema-dependent feature work.

## Open Questions

- Should fee reminder and iclock pull jobs start inside
  `backend/server.js`, through PM2, or as separate worker processes?
- Should `backend/modules/iclock/iclock.routes.js` and
  `iclock.admin.routes.js` be publicly mounted, protected mounted, or
  left dormant?
- What is the intended production storage strategy for uploads:
  local disk, shared volume, or external object storage?
- Should web auth continue storing tokens in `localStorage`, or should
  a future hardening pass move toward httpOnly cookie flows?
- Which domain modules should receive tests first: auth/RBAC, fees,
  attendance, marks, or messaging?
- Should the suspicious-login failed-password threshold remain 3
  failures in 24 hours, or be made configurable?

## Architecture Decisions

- Express/MySQL remains the backend source of truth because current
  modules, migrations, repositories, and clients are built around it.
- Backend route middleware is the authorization boundary; frontend
  route/tab filtering is for usability only.
- Migrations are the authoritative schema-change mechanism; reseeding
  is reserved for targeted seed data.
- Public website APIs stay under public route mounts and must not
  require user JWTs for visitor-facing reads/submissions.
- Mobile keeps its separate Axios/cache layer because it has different
  persistence and offline/stale-response needs than the web clients.
- OTP is required only for new devices or suspicious logins; successful
  OTP verification trusts the device and regular refresh-token behavior
  remains unchanged.
- The mobile apps are already published. Future Android and iOS
  submissions are production updates and must preserve package/bundle
  identifiers while incrementing store-required build versions.

## Session Notes

- Root docs `README.md` and `SYSTEM_OVERVIEW.md` already summarize
  much of the current system.
- Real `.env` files exist in backend, internal software, and mobile;
  avoid exposing their values in docs or commits.
- No real backend test suite is wired. Web apps have lint/build
  scripts. Mobile has TypeScript checking.
- Permission cache TTL is 10 minutes, so permission changes may not be
  visible immediately without cache clearing or restart.
- Android updates should use EAS production builds that generate an
  `.aab` for Play Store upload.
- Production mobile builds should point at
  `https://kalongkapilividyapith.com/api/v1`.
