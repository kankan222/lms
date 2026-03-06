import("bcrypt").then(b =>
  b.hash("123456",10).then(console.log)
);


Token Architecture

Access Token  → short life (15 min)
Refresh Token → long life (7–30 days)
{
  "userId": 12,
  "roles": ["teacher"],
  "sessionId": "uuid",
  "exp": 15min
}

Database Tables for Auth
user_sessions
--------------
id (uuid)
user_id
device_id
device_type
refresh_token_hash
ip_address
expires_at
last_used_at
revoked_at

Login Flow (Exact Sequence)
User Login →
Verify credentials →
Create session →
Generate tokens →
Return tokens
{
  "accessToken": "...",
  "refreshToken": "...",
  "user": {
    "id": 1,
    "roles": ["teacher"]
  }
}

PASSWORD SECURITY 

Request Authentication Flow
Request →
Auth Middleware →
Verify Access Token →
Attach user to request →
Next middleware


REFRESH TOKEN FLOW
Client →
POST /auth/refresh →
verify refresh token →
issue new access token

LOGOUT FLOW
DELETE /auth/session
revoke session
delete refresh token

DELETE /auth/sessions/all

RBAC Authorization Pipeline
Auth Middleware
        ↓
Permission Middleware
        ↓
Controller

Get user roles →
Load permissions →
Cache in Redis →
Check permission →
Allow / Deny

Permission Caching (Performance Critical)(USE REDIS)
cache key:
permissions:userId


Ownership Authorization (Second Layer)
isTeacherAssigned(teacherId, classId)

Approval Authority Integration
marks.create
marks.approve
fees.create
fees.approve

Token Security Rules
old refresh token → invalid
new refresh token → issued

Device Identification (Important for Mobile)
deviceId
deviceName
platform

Account Status Control
status:
active
suspended
inactive

Failed Login Protection
failed_attempts
locked_until

Password Reset Flow
password_resets
----------------
user_id
token_hash
expires_at

request reset →
email link →
verify token →
update password →
invalidate sessions

Mobile Offline Authentication Strategy
access token
refresh token
deviceId

Full Request Security Flow
Request →
Verify Access Token →
Check Session Valid →
Load Permissions (cache) →
RBAC Check →
Ownership Check →
Execute Service →
Log Activity →
Response