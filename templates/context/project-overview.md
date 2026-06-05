# Full-Stack LMS

## Overview

Full-Stack LMS is a school and college management system
for administrators, staff, teachers, parents, accounts users,
and public website visitors. It centralizes student records,
academic setup, attendance, exams, marks, fees, messaging,
notifications, public staff content, and mobile access around
one Express/MySQL backend.

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
   sending messages.
5. Backend route guards enforce permissions, controllers parse
   request input, services apply business rules, and repositories
   persist changes in MySQL.
6. Notifications and messaging updates stream to the internal
   app through SSE where supported.

## Features

### Academic Operations

- Sessions, scopes, classes, sections, and higher secondary
  streams.
- Subject creation and class/teacher subject assignments.
- Student, parent, teacher, and staff record management.

### Attendance and Reporting

- Student attendance entry, review, parent notification, and
  teacher-facing workflows.
- Teacher attendance device mapping and cross-system attendance
  sync agents.
- Exams, marks entry, approval, student reports, and report PDFs.

### Finance

- Fee structures, installments, student ledgers, payments,
  approvals, receipts, exports, and parent-visible payment data.

### Communication

- Internal messaging with conversations, targets, read state,
  presence updates, and SSE.
- Notifications with read/read-all handling and realtime updates.

### Public Website and Mobile

- Public website pages for school, college, computer section,
  staff lists, gallery, fees, rules, privacy, and contact.
- Expo mobile app with role-aware tabs, secure token storage,
  cached API reads, and stale data fallback.

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
