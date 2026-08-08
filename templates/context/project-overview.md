# Full-Stack LMS

## Overview

Full-Stack LMS is a school and college management system
for administrators, staff, teachers, parents, accounts users,
and public website visitors. It centralizes student records,
academic setup, attendance, class and exam routines, exams,
marks, fees, announcements, messaging, notifications, public
staff content, and mobile access around one Express/MySQL backend.

## Goals

1. Provide a permission-driven internal operations app for
   managing the school and college lifecycle.
2. Keep backend business rules authoritative and reusable
   across web, website, mobile, and sync agents.
3. Support role-specific experiences for admin, teacher,
   parent, staff, and accounts users.
4. Keep public website content manageable from the internal
   software app where possible.
5. Preserve migration-based database evolution so local and
   deployed environments can be updated predictably.

## Core User Flow

1. A user signs in with email, phone, or identifier and password.
2. Backend validates credentials, creates a session, and returns
   access and refresh tokens with roles and permissions.
3. The client stores auth state and renders only routes or tabs
   allowed by the user's role and permissions.
4. The user performs module work such as managing students,
   taking attendance, entering marks, recording payments, or
   publishing routines, announcements, or sending messages.
5. Backend route guards enforce permissions, controllers parse
   request input, services apply business rules, and repositories
   persist changes in MySQL.
6. Notifications and messaging updates stream to the internal
   app through SSE where supported.
7. Mobile clients check an authenticated app-update policy after
   sign-in and from Profile; update notifications can announce a
   release, while the in-app prompt/store link remains the primary
   update path.

## Features

### Academic Operations

- Sessions, scopes, classes, sections, and higher secondary
  streams.
- Subject creation and class/teacher subject assignments.
- Student, parent, teacher, and staff record management.
- Class routines with canonical current rows per academic scope,
  reusable time slots, break/activity/free/custom entries, teacher
  assignment validation, publish state, PDFs, and role-specific
  teacher/parent/student views.
- Routine substitutions for date-specific or date-range temporary
  changes such as extra classes, cancelled periods, teacher
  substitutions, subject changes, and room changes.

### Attendance and Reporting

- Student attendance entry, review, parent notification, and
  teacher-facing workflows.
- Teacher attendance device mapping and cross-system attendance
  sync agents.
- Exams, marks entry, approval, student reports, and report PDFs.
- Exam routines managed from the Routine module, linked to existing
  exams and scoped by school/higher-secondary class, with optional
  section, medium, and stream narrowing where needed. They support
  configured exam subjects, active `subject_offerings` plus legacy
  `class_subjects` eligibility, practical/custom entries, optional
  invigilators, optional rooms, publish actions, student detail
  visibility, and school notice-style PDFs.

### Finance

- Fee structures, installments, student ledgers, payments,
  approvals, receipts, exports, and parent-visible payment data.
- Student-specific transportation fee assignments with per-student monthly
  amounts, month-wise dues, separate payments, and transportation receipts.

### Communication

- Announcements as a separate one-way broadcast module from
  Messaging, with online, offline SMS, and combined delivery modes.
- Announcement categories, scheduling, attachments, public visibility,
  configurable DLT SMS templates, Fast2SMS delivery, SMS retries and
  delivery status, holiday/vacation calendar records, and optional
  notifications/push on publish.
- Internal messaging with conversations, targets, read state,
  presence updates, and SSE.
- Messaging supports text, photos, documents, and recorded voice
  notes on internal web and mobile.
- Direct conversations support typing indicators. Class and section
  conversations are shared group discussions. Broadcast conversations
  are announcement-only.
- Messages support replies, forwarding, editing, sender deletion,
  deletion for everyone, delivery/read state, search, and moderation.
- Students are contacted through their linked parents or guardians;
  students are not direct messaging accounts.
- Notifications with category filters, read/read-all handling,
  realtime updates, permission-gated push delivery, and action
  deep links for high-value events such as messages, attendance
  notices, marksheets, fees, payments, account security, and system
  alerts.

### Public Website and Mobile

- Public website pages for school, college, computer section,
  staff lists, gallery, fees, rules, privacy, and contact.
- Expo mobile app with role-aware tabs, secure token storage,
  cached API reads, and stale data fallback.
- Mobile app update prompts compare the installed app version/build
  with server-configured latest and minimum supported versions, then
  open the configured Play Store/App Store URL when available.

## Scope

### In Scope

- `backend/` Express API, MySQL data access, migrations, seeds,
  uploads, background jobs, and attendance sync scripts.
- `frontend/software/` internal React/Vite LMS operations app.
- `frontend/website/` public React/Vite website.
- `frontend/mobile/` Expo React Native app.
- `frontend/shared/` shared web API helper used by the internal
  software app.
- `uploads/` local uploaded file storage served by the backend.

### Out of Scope

- Replacing the Express/MySQL backend with another framework.
- Moving all clients into a single frontend app.
- Using reseeding as the primary way to evolve production data.
- Treating frontend permission checks as security boundaries.
- Committing real local secrets from `.env` files.

## Success Criteria

1. A signed-in user can access only the backend routes allowed
   by assigned permissions.
2. Internal web routes and mobile tabs match the user's role and
   permission set.
3. Core modules work end to end through controller, service, and
   repository layers.
4. Public website routes can read public staff/contact data
   without requiring JWT auth.
5. Database changes are represented as migrations, not hidden
   manual schema edits.
