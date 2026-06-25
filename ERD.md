# Full-Stack LMS Entity Relationship Diagrams

This document is derived from the current schema files, migrations, and backend
repository queries. The database is split into domain diagrams because a single
diagram containing every table and relationship is difficult to read.

Legend:

- `PK` — primary key
- `FK` — database or intended foreign key
- `UK` — unique key
- `logical` — a relationship used by application code but not consistently
  enforced by a database foreign-key constraint
- `polymorphic` — a reference identified by an entity type and entity ID

## 1. Identity, Authentication, and RBAC

```mermaid
erDiagram
    USERS {
        bigint id PK
        varchar username UK
        varchar email UK
        varchar phone UK
        varchar password_hash
        enum status
        datetime last_login
        timestamp created_at
        timestamp updated_at
    }

    ROLES {
        int id PK
        varchar name UK
    }

    PERMISSIONS {
        int id PK
        varchar name UK
    }

    USER_ROLES {
        bigint user_id PK, FK
        int role_id PK, FK
    }

    ROLE_PERMISSIONS {
        int role_id PK, FK
        int permission_id PK, FK
    }

    USER_PERMISSIONS {
        bigint user_id PK, FK
        int permission_id PK, FK
        timestamp created_at
    }

    USER_SESSIONS {
        varchar id PK
        bigint user_id FK
        varchar refresh_token_hash
        varchar device_id
        varchar device_type
        varchar ip_address
        datetime expires_at
        datetime revoked_at
        timestamp created_at
    }

    AUTH_TRUSTED_DEVICES {
        bigint id PK
        bigint user_id FK
        varchar device_id UK
        varchar device_type
        datetime first_trusted_at
        datetime last_seen_at
        varchar last_ip
        datetime revoked_at
    }

    AUTH_OTP_CHALLENGES {
        varchar id PK
        bigint user_id FK
        varchar phone
        varchar otp_hash
        varchar device_id
        varchar reason
        datetime expires_at
        int resend_count
        int failed_attempts
        datetime blocked_until
        datetime verified_at
    }

    AUTH_LOGIN_FAILURES {
        bigint id PK
        bigint user_id FK
        varchar device_id
        varchar ip_address
        timestamp created_at
    }

    USERS ||--o{ USER_ROLES : has
    ROLES ||--o{ USER_ROLES : assigned
    ROLES ||--o{ ROLE_PERMISSIONS : grants
    PERMISSIONS ||--o{ ROLE_PERMISSIONS : included_in
    USERS ||--o{ USER_PERMISSIONS : receives_directly
    PERMISSIONS ||--o{ USER_PERMISSIONS : assigned_directly
    USERS ||--o{ USER_SESSIONS : opens
    USERS ||--o{ AUTH_TRUSTED_DEVICES : trusts
    USERS ||--o{ AUTH_OTP_CHALLENGES : verifies
    USERS ||--o{ AUTH_LOGIN_FAILURES : accumulates
```

## 2. Academic Structure and People

```mermaid
erDiagram
    SCOPES {
        int id PK
        varchar code UK
        varchar name
        boolean is_active
    }

    ACADEMIC_SESSIONS {
        int id PK
        varchar name
        date start_date
        date end_date
        boolean is_active
    }

    CLASSES {
        int id PK
        varchar name
        enum class_scope
        int scope_id FK
        set medium
        boolean is_active
    }

    SECTIONS {
        int id PK
        int class_id FK
        varchar name
        enum medium
    }

    STREAMS {
        int id PK
        varchar name UK
    }

    SUBJECTS {
        int id PK
        varchar name
        varchar code
    }

    CLASS_SUBJECTS {
        bigint id PK
        int class_id FK
        int subject_id FK
        boolean is_active
    }

    SUBJECT_OFFERINGS {
        bigint id PK
        int class_id FK
        int section_id FK
        int stream_id FK
        int subject_id FK
        enum subject_group
        boolean is_active
    }

    STUDENT_SUBJECT_REGISTRATIONS {
        bigint id PK
        bigint student_id FK
        bigint subject_offering_id FK
        enum status
    }

    STUDENTS {
        bigint id PK
        varchar admission_no UK
        varchar name
        date dob
        enum gender
        varchar mobile
        text photo_url
        timestamp created_at
    }

    STUDENT_ENROLLMENTS {
        bigint id PK
        bigint student_id FK
        int class_id FK
        int stream_id FK
        int section_id FK
        int session_id FK
        int roll_number
        enum status
    }

    ADDRESSES {
        bigint id PK
        varchar district
        varchar state
        varchar country
        varchar pin_code
    }

    PARENTS {
        bigint id PK
        bigint user_id FK, UK
        varchar name
        varchar mobile
        varchar email
        bigint address_id FK
    }

    STUDENT_PARENTS {
        bigint student_id PK, FK
        bigint parent_id PK, FK
        enum relationship
        varchar father_name
        varchar mother_name
    }

    STUDENT_DOCUMENTS {
        bigint id PK
        bigint student_id FK
        enum type
        text file_url
        bigint uploaded_by
    }

    TEACHERS {
        bigint id PK
        bigint user_id FK, UK
        varchar employee_id UK
        varchar name
        varchar phone
        varchar email
        enum class_scope
        text photo_url
    }

    TEACHER_CLASS_ASSIGNMENTS {
        bigint id PK
        bigint teacher_id FK
        int class_id FK
        int section_id FK
        int subject_id FK
        int session_id FK
    }

    STAFF {
        bigint id PK
        bigint user_id
        varchar image_url
        varchar name
        varchar title
        enum type
    }

    USERS {
        bigint id PK
    }

    SCOPES ||--o{ CLASSES : categorizes
    CLASSES ||--o{ SECTIONS : contains
    CLASSES ||--o{ CLASS_SUBJECTS : offers
    SUBJECTS ||--o{ CLASS_SUBJECTS : mapped_to
    CLASSES ||--o{ SUBJECT_OFFERINGS : offers
    SECTIONS o|--o{ SUBJECT_OFFERINGS : optionally_scopes
    STREAMS o|--o{ SUBJECT_OFFERINGS : optionally_scopes
    SUBJECTS ||--o{ SUBJECT_OFFERINGS : offered_as

    STUDENTS ||--o{ STUDENT_ENROLLMENTS : enrolls
    CLASSES ||--o{ STUDENT_ENROLLMENTS : places
    STREAMS o|--o{ STUDENT_ENROLLMENTS : specializes
    SECTIONS ||--o{ STUDENT_ENROLLMENTS : groups
    ACADEMIC_SESSIONS ||--o{ STUDENT_ENROLLMENTS : occurs_in
    STUDENTS ||--o{ STUDENT_SUBJECT_REGISTRATIONS : chooses
    SUBJECT_OFFERINGS ||--o{ STUDENT_SUBJECT_REGISTRATIONS : selected_by

    USERS ||--o| PARENTS : authenticates_as
    ADDRESSES o|--o{ PARENTS : belongs_to
    STUDENTS ||--o{ STUDENT_PARENTS : linked_to
    PARENTS ||--o{ STUDENT_PARENTS : responsible_for
    STUDENTS ||--o{ STUDENT_DOCUMENTS : owns

    USERS ||--o| TEACHERS : authenticates_as
    TEACHERS ||--o{ TEACHER_CLASS_ASSIGNMENTS : receives
    CLASSES ||--o{ TEACHER_CLASS_ASSIGNMENTS : assigned_class
    SECTIONS ||--o{ TEACHER_CLASS_ASSIGNMENTS : assigned_section
    SUBJECTS ||--o{ TEACHER_CLASS_ASSIGNMENTS : teaches
    ACADEMIC_SESSIONS ||--o{ TEACHER_CLASS_ASSIGNMENTS : valid_during

    USERS o|--o| STAFF : "logical profile link"
```

## 3. Student and Teacher Attendance

```mermaid
erDiagram
    USERS {
        bigint id PK
    }

    STUDENTS {
        bigint id PK
    }

    TEACHERS {
        bigint id PK
        varchar employee_id UK
    }

    CLASSES {
        int id PK
    }

    SECTIONS {
        int id PK
    }

    ACADEMIC_SESSIONS {
        int id PK
    }

    ATTENDANCE_SESSIONS {
        bigint id PK
        int class_id FK
        int section_id FK
        int academic_session_id FK
        date date
        bigint taken_by FK
        enum attendance_type
        enum approval_status
        bigint submitted_by FK
        bigint reviewed_by FK
    }

    STUDENT_ATTENDANCE {
        bigint id PK
        bigint attendance_session_id FK
        bigint student_id FK
        enum status
    }

    ATTENDANCE_DEVICES {
        bigint id PK
        varchar device_code UK
        varchar device_name
        varchar location
    }

    TEACHER_DEVICE_USERS {
        bigint id PK
        bigint device_id FK
        varchar device_user_id
        bigint teacher_id FK
    }

    TEACHER_ATTENDANCE_LOGS {
        bigint id PK
        bigint teacher_id FK
        bigint device_id FK
        datetime punch_time
        enum punch_type
    }

    TEACHER_DAILY_ATTENDANCE {
        bigint id PK
        bigint teacher_id FK
        date attendance_date
        datetime check_in
        datetime check_out
        enum status
        decimal worked_hours
    }

    TEACHER_ATTENDANCE_SYNC_EVENTS {
        bigint id PK
        varchar site_id UK
        bigint source_log_id UK
        bigint teacher_id
        varchar teacher_employee_id
        varchar device_code
        datetime punch_time
        enum punch_type
        json payload_json
    }

    APPROVALS {
        bigint id PK
        varchar entity_type
        bigint entity_id
        bigint submitted_by
        bigint approved_by
        enum status
    }

    CLASSES ||--o{ ATTENDANCE_SESSIONS : scopes
    SECTIONS ||--o{ ATTENDANCE_SESSIONS : scopes
    ACADEMIC_SESSIONS o|--o{ ATTENDANCE_SESSIONS : scopes
    USERS ||--o{ ATTENDANCE_SESSIONS : takes_or_reviews
    ATTENDANCE_SESSIONS ||--o{ STUDENT_ATTENDANCE : contains
    STUDENTS ||--o{ STUDENT_ATTENDANCE : receives

    ATTENDANCE_DEVICES ||--o{ TEACHER_DEVICE_USERS : maps
    TEACHERS ||--o{ TEACHER_DEVICE_USERS : identified_as
    TEACHERS ||--o{ TEACHER_ATTENDANCE_LOGS : records
    ATTENDANCE_DEVICES o|--o{ TEACHER_ATTENDANCE_LOGS : captures
    TEACHERS ||--o{ TEACHER_DAILY_ATTENDANCE : summarizes

    TEACHERS o|--o{ TEACHER_ATTENDANCE_SYNC_EVENTS : "logical match"
    ATTENDANCE_DEVICES o|--o{ TEACHER_ATTENDANCE_SYNC_EVENTS : "logical match"
    ATTENDANCE_SESSIONS o|--o{ APPROVALS : "polymorphic entity"
```

## 4. Exams, Marks, and Reports

```mermaid
erDiagram
    USERS {
        bigint id PK
    }

    STUDENTS {
        bigint id PK
    }

    ACADEMIC_SESSIONS {
        int id PK
    }

    CLASSES {
        int id PK
    }

    SECTIONS {
        int id PK
    }

    SUBJECTS {
        int id PK
    }

    EXAMS {
        bigint id PK
        varchar name
        int session_id FK
        int class_id
        int section_id
        bigint created_by
    }

    EXAM_SCOPES {
        bigint id PK
        bigint exam_id FK
        int class_id FK
        int section_id FK
        int section_id_dedupe
    }

    EXAM_SUBJECTS {
        bigint id PK
        bigint exam_id FK
        int subject_id FK
        enum mark_pattern
        decimal max_marks
        decimal pass_marks
        decimal theory_max
        decimal theory_pass
        decimal practical_max
        decimal practical_pass
    }

    STUDENT_EXAM_SUBJECTS {
        bigint id PK
        bigint student_id FK
        bigint exam_id FK
        int subject_id FK
    }

    SUBJECT_OFFERINGS {
        bigint id PK
        int class_id FK
        int section_id FK
        int stream_id FK
        int subject_id FK
    }

    STUDENT_SUBJECT_REGISTRATIONS {
        bigint id PK
        bigint student_id FK
        bigint subject_offering_id FK
        enum status
    }

    MARKS_ENTRIES {
        bigint id PK
        bigint student_id FK
        bigint exam_id FK
        int subject_id FK
        decimal marks
        decimal theory_marks
        decimal practical_marks
        bigint entered_by
        enum approval_status
        bigint approved_by
        datetime approved_at
    }

    ACADEMIC_SESSIONS ||--o{ EXAMS : schedules
    EXAMS ||--o{ EXAM_SCOPES : targets
    CLASSES ||--o{ EXAM_SCOPES : included
    SECTIONS o|--o{ EXAM_SCOPES : optionally_narrows
    EXAMS ||--o{ EXAM_SUBJECTS : defines
    SUBJECTS ||--o{ EXAM_SUBJECTS : assessed

    STUDENTS ||--o{ STUDENT_EXAM_SUBJECTS : assigned
    EXAMS ||--o{ STUDENT_EXAM_SUBJECTS : includes
    SUBJECTS ||--o{ STUDENT_EXAM_SUBJECTS : selects
    SUBJECT_OFFERINGS ||--o{ STUDENT_SUBJECT_REGISTRATIONS : selected
    STUDENTS ||--o{ STUDENT_SUBJECT_REGISTRATIONS : registers

    STUDENTS ||--o{ MARKS_ENTRIES : receives
    EXAMS ||--o{ MARKS_ENTRIES : contains
    SUBJECTS ||--o{ MARKS_ENTRIES : grades
    USERS o|--o{ MARKS_ENTRIES : "enters or approves"
```

## 5. Fees and Payments

```mermaid
erDiagram
    CLASSES {
        int id PK
    }

    STREAMS {
        int id PK
    }

    ACADEMIC_SESSIONS {
        int id PK
    }

    STUDENT_ENROLLMENTS {
        bigint id PK
    }

    FEE_CATEGORIES {
        int id PK
        varchar name
        text description
    }

    FEE_STRUCTURES {
        int id PK
        int class_id FK
        int session_id FK
        int stream_id FK
        decimal admission_fee
    }

    FEE_INSTALLMENTS {
        int id PK
        int fee_structure_id FK
        varchar installment_name
        decimal amount
        date due_date
    }

    STUDENT_FEES {
        bigint id PK
        bigint enrollment_id FK
        int installment_id
        enum fee_type
        decimal amount
        enum status
    }

    PAYMENTS {
        bigint id PK
        bigint student_fee_id FK
        decimal amount_paid
        text remarks
        enum status
        bigint created_by
        bigint approved_by
        datetime approved_at
    }

    FEE_RECEIPTS {
        bigint id PK
        varchar receipt_no UK
        bigint payment_id FK
        enum status
        timestamp generated_at
    }

    CLASSES ||--o{ FEE_STRUCTURES : priced_for
    ACADEMIC_SESSIONS ||--o{ FEE_STRUCTURES : valid_during
    STREAMS o|--o{ FEE_STRUCTURES : optionally_scopes
    FEE_STRUCTURES ||--o{ FEE_INSTALLMENTS : divides_into
    STUDENT_ENROLLMENTS ||--o{ STUDENT_FEES : charged
    FEE_INSTALLMENTS o|--o{ STUDENT_FEES : "logical installment"
    STUDENT_FEES ||--o{ PAYMENTS : settled_by
    PAYMENTS ||--o| FEE_RECEIPTS : generates
```

`fee_categories` currently exists as reference data but is not linked by a
foreign key to the active fee-structure model.

## 6. Messaging and Media

```mermaid
erDiagram
    USERS {
        bigint id PK
    }

    CLASSES {
        int id PK
    }

    SECTIONS {
        int id PK
    }

    MESSAGING_PERMISSIONS {
        int id PK
        bigint user_id FK, UK
        boolean can_send_message
        bigint approved_by FK
    }

    CONVERSATIONS {
        int id PK
        enum type
        varchar name
        int class_id FK
        int section_id FK
        bigint created_by FK
        datetime created_at
        datetime last_message_at
    }

    CONVERSATION_MEMBERS {
        int conversation_id PK, FK
        bigint user_id PK, FK
        datetime last_read_at
    }

    CONVERSATION_RECIPIENTS {
        int id PK
        int conversation_id FK
        enum recipient_type
        bigint recipient_id
    }

    MESSAGES {
        int id PK
        int conversation_id FK
        bigint sender_id FK
        text message
        enum message_type
        int reply_to_message_id
        int forwarded_from_message_id
        datetime created_at
        datetime edited_at
        datetime deleted_for_everyone_at
        bigint deleted_by
    }

    MESSAGE_ATTACHMENTS {
        int id PK
        int message_id FK
        bigint uploaded_by FK
        enum category
        enum storage_driver
        varchar object_key UK
        varchar thumbnail_key
        bigint file_size
        enum status
        datetime purge_after
    }

    MESSAGE_STATUS {
        bigint id PK
        int message_id FK
        bigint user_id FK
        enum status
        datetime delivered_at
        datetime read_at
    }

    MESSAGE_HIDDEN_USERS {
        int message_id PK, FK
        bigint user_id PK, FK
        datetime hidden_at
    }

    MESSAGE_REPORTS {
        bigint id PK
        int message_id FK
        bigint reported_by FK
        bigint reviewed_by FK
        varchar reason
        enum status
    }

    MESSAGING_USER_SUSPENSIONS {
        bigint user_id PK, FK
        bigint suspended_by FK
        bigint lifted_by FK
        varchar reason
        datetime expires_at
    }

    MESSAGING_AUDIT_LOG {
        bigint id PK
        bigint actor_user_id FK
        varchar action
        int conversation_id FK
        int message_id FK
        int attachment_id FK
        bigint target_user_id FK
        json metadata_json
    }

    USERS ||--o| MESSAGING_PERMISSIONS : may_receive
    USERS ||--o{ MESSAGING_PERMISSIONS : approves
    USERS ||--o{ CONVERSATIONS : creates
    CLASSES o|--o{ CONVERSATIONS : scopes
    SECTIONS o|--o{ CONVERSATIONS : scopes
    CONVERSATIONS ||--o{ CONVERSATION_MEMBERS : includes
    USERS ||--o{ CONVERSATION_MEMBERS : joins
    CONVERSATIONS ||--o{ CONVERSATION_RECIPIENTS : targets

    CONVERSATIONS ||--o{ MESSAGES : contains
    USERS ||--o{ MESSAGES : sends
    MESSAGES o|--o{ MESSAGES : replies_or_forwards
    MESSAGES o|--o{ MESSAGE_ATTACHMENTS : owns
    USERS ||--o{ MESSAGE_ATTACHMENTS : uploads
    MESSAGES ||--o{ MESSAGE_STATUS : tracks
    USERS ||--o{ MESSAGE_STATUS : receives
    MESSAGES ||--o{ MESSAGE_HIDDEN_USERS : hidden_by
    USERS ||--o{ MESSAGE_HIDDEN_USERS : hides
    MESSAGES ||--o{ MESSAGE_REPORTS : reported
    USERS ||--o{ MESSAGE_REPORTS : reports_or_reviews

    USERS ||--o| MESSAGING_USER_SUSPENSIONS : suspended
    USERS ||--o{ MESSAGING_USER_SUSPENSIONS : administers
    USERS o|--o{ MESSAGING_AUDIT_LOG : acts_or_targeted
    CONVERSATIONS o|--o{ MESSAGING_AUDIT_LOG : audited
    MESSAGES o|--o{ MESSAGING_AUDIT_LOG : audited
    MESSAGE_ATTACHMENTS o|--o{ MESSAGING_AUDIT_LOG : audited
```

The `reply_to_message_id`, `forwarded_from_message_id`, and `deleted_by`
columns are logical references in the current migration and do not have
explicit foreign-key constraints.

## 7. Notifications, Attendance Communication, and Generic Audit Records

```mermaid
erDiagram
    USERS {
        bigint id PK
    }

    STUDENTS {
        bigint id PK
    }

    ATTENDANCE_SESSIONS {
        bigint id PK
    }

    CONVERSATIONS {
        int id PK
    }

    MESSAGES {
        int id PK
    }

    NOTIFICATIONS {
        bigint id PK
        bigint user_id FK
        varchar type
        varchar entity_type
        bigint entity_id
        varchar title
        text body
        boolean is_read
        datetime read_at
    }

    NOTIFICATION_DEVICES {
        bigint id PK
        bigint user_id FK
        enum platform
        varchar device_token UK
        varchar push_token UK
        boolean is_active
    }

    STUDENT_ATTENDANCE_PARENT_MESSAGES {
        bigint id PK
        bigint attendance_session_id FK
        bigint student_id FK
        bigint parent_user_id FK
        int conversation_id FK
        int message_id FK
        bigint notification_id FK
        bigint sent_by FK
        text message_body
    }

    APPROVALS {
        bigint id PK
        varchar entity_type
        bigint entity_id
        bigint submitted_by
        bigint approved_by
        enum status
    }

    FILES {
        bigint id PK
        varchar owner_type
        bigint owner_id
        text file_url
        varchar file_type
        bigint uploaded_by
    }

    ACTIVITY_LOGS {
        bigint id PK
        bigint user_id
        varchar action
        varchar entity_type
        bigint entity_id
        json old_value
        json new_value
    }

    WEBSITE_CONTACT_SUBMISSIONS {
        bigint id PK
        varchar name
        varchar contact_number
        text message
        timestamp created_at
    }

    USERS ||--o{ NOTIFICATIONS : receives
    USERS ||--o{ NOTIFICATION_DEVICES : registers
    ATTENDANCE_SESSIONS ||--o{ STUDENT_ATTENDANCE_PARENT_MESSAGES : produces
    STUDENTS ||--o{ STUDENT_ATTENDANCE_PARENT_MESSAGES : concerns
    USERS ||--o{ STUDENT_ATTENDANCE_PARENT_MESSAGES : receives_or_sends
    CONVERSATIONS o|--o{ STUDENT_ATTENDANCE_PARENT_MESSAGES : records
    MESSAGES o|--o{ STUDENT_ATTENDANCE_PARENT_MESSAGES : records
    NOTIFICATIONS o|--o{ STUDENT_ATTENDANCE_PARENT_MESSAGES : records
    USERS o|--o{ ACTIVITY_LOGS : "logical actor"
    USERS o|--o{ FILES : "logical uploader"
```

`approvals`, `notifications`, `files`, and `activity_logs` contain polymorphic
entity references. Their `entity_type`/`entity_id` or `owner_type`/`owner_id`
pairs intentionally cannot be represented as normal foreign keys to one table.

## Important Schema Observations

1. The migration history is the deployment authority. Older SQL snapshots may
   not contain every current column or relationship.
2. `staff.user_id` is used as a user-profile relationship but the migration
   adding it does not create a foreign-key constraint.
3. `student_fees.installment_id` is used as a relationship to
   `fee_installments.id`, but the original schema does not declare its foreign
   key.
4. `teacher_attendance_sync_events` stores source identifiers and resolved
   teacher/device values without foreign keys so external events can be audited
   even when mapping fails.
5. Messaging self-references for replies and forwards are indexed but not
   declared as foreign keys.
6. Generic approvals and audit entities use polymorphic references.
7. Some legacy repository code refers to older names such as
   `parent_students`; the active attendance, user, and messaging flows use
   `student_parents`.
8. `subject_offerings` is the forward path for assigning subjects to a
   class, optional section, and optional stream. Existing `class_subjects`
   remains for backward compatibility and simple class-level subjects.
9. `student_subject_registrations` stores permanent student subject choices.
   Marks and reports use these registrations when present, while existing
   `student_exam_subjects` remains as an exam-specific transition layer.

## Prompt for Generating a Visual ERD

Use this prompt with a diagram-capable AI tool:

```text
Create a professional entity relationship diagram for a production School and
College Learning Management System using MySQL.

Use Crow's Foot notation. Group entities into these colored domains:

1. Identity and RBAC:
users, roles, permissions, user_roles, role_permissions, user_permissions,
user_sessions, auth_trusted_devices, auth_otp_challenges, auth_login_failures.

2. Academic and People:
scopes, academic_sessions, classes, sections, streams, subjects,
class_subjects, students, student_enrollments, addresses, parents,
student_parents, student_documents, teachers, teacher_class_assignments, staff.

3. Attendance:
attendance_sessions, student_attendance, attendance_devices,
teacher_device_users, teacher_attendance_logs, teacher_daily_attendance,
teacher_attendance_sync_events, student_attendance_parent_messages.

4. Exams and Marks:
exams, exam_scopes, exam_subjects, student_exam_subjects, marks_entries.

5. Finance:
fee_categories, fee_structures, fee_installments, student_fees, payments,
fee_receipts.

6. Messaging:
messaging_permissions, conversations, conversation_members,
conversation_recipients, messages, message_attachments, message_status,
message_hidden_users, message_reports, messaging_user_suspensions,
messaging_audit_log.

7. Notifications and Generic Records:
notifications, notification_devices, approvals, files, activity_logs,
website_contact_submissions.

Show primary keys, foreign keys, unique keys, and cardinality. Emphasize these
many-to-many junction tables:
user_roles, role_permissions, user_permissions, class_subjects,
student_parents, teacher_class_assignments, conversation_members,
message_hidden_users, and student_exam_subjects.

Show these core flows prominently:

- users -> roles -> permissions
- students -> enrollments -> class/section/session/stream
- parents <-> student_parents <-> students
- teachers -> teacher_class_assignments -> classes/sections/subjects/sessions
- attendance_sessions -> student_attendance -> students
- attendance_devices -> teacher_device_users -> teachers
- exams -> exam_scopes and exam_subjects -> marks_entries -> students
- fee_structures -> fee_installments -> student_fees -> payments -> receipts
- conversations -> conversation_members and messages -> attachments/status
- users -> notifications and notification_devices

Represent these as logical or dashed relationships because they are not always
enforced by database foreign keys:

- staff.user_id -> users.id
- student_fees.installment_id -> fee_installments.id
- messages.reply_to_message_id -> messages.id
- messages.forwarded_from_message_id -> messages.id
- messages.deleted_by -> users.id
- teacher_attendance_sync_events.teacher_id -> teachers.id
- approvals.entity_type/entity_id -> domain entities
- notifications.entity_type/entity_id -> domain entities
- files.owner_type/owner_id -> domain entities
- activity_logs.entity_type/entity_id -> domain entities

Keep the diagram readable by producing one overview diagram and separate
domain-level detail diagrams. Do not invent tables or relationships that are
not listed.
```
