API 

/api/v1/

/api/v1/
   auth/
   students/
   teachers/
   attendance/
   exams/
   finance/
   messaging/
   notifications/
   reports/

POST /api/v1/students
{
  "firstName": "Rahul",
  "lastName": "Das",
  "dob": "2012-05-10",
  "classId": 3,
  "sectionId": 2,
  "parentIds": [10, 11]
}
SUCCESS
{
  "success": true,
  "message": "Student created",
  "data": {},
  "meta": {}
}
{
  "success": false,
  "message": "Unauthorized",
  "errors": []
}

PAGINATION
GET /students?page=1&limit=20
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 3000,
    "totalPages": 150
  }
}

FILTERING AND SEARCH PATTERN
/students?classId=2&sectionId=1
/students?search=rahul

AUTHENTICATION CONTRACT
POST /auth/login
{
  "accessToken": "",
  "refreshToken": "",
  "user": {
    "id": 1,
    "roles": ["teacher"]
  }
}
HEADERS (ALL PROTECTED APIS)
Authorization: Bearer ACCESS_TOKEN

RBAC ENFORCEMENT PATTERN
authMiddleware
→ permissionMiddleware("marks.create")

POST /exams/marks

Approval Workflow API Design
GET  /approvals
POST /approvals/:id/approve
POST /approvals/:id/reject

Attendance API Example
POST /attendance/sessions
POST /attendance/records
{
  "sessionId": 12,
  "records": [
    {"studentId":1,"status":"present"},
    {"studentId":2,"status":"absent"}
  ]
}

Messaging API Design
POST /messages
{
  "message": "Holiday tomorrow",
  "targetType": "class",
  "targetIds": [3,4]
}

Finance API Contract
POST /finance/invoices
POST /finance/payments
{
  "invoiceId": 45,
  "amount": 2000,
  "method": "UPI"
}

File Upload Contract
POST /files/upload
{
  "fileUrl": "...",
  "fileId": 22
}


Notification APIs
GET /notifications
PATCH /notifications/:id/read

Offline Sync Contract (Mobile Critical)
POST /sync
{
  "deviceId": "abc123",
  "actions": [...]
}

API Versioning Strategy
/api/v2/


Error Code Standards
| Code | Meaning           |
| ---- | ----------------- |
| 200  | success           |
| 201  | created           |
| 400  | validation error  |
| 401  | not authenticated |
| 403  | forbidden         |
| 404  | not found         |
| 500  | server error      |


POST /api/v1/exams/marks
↓
Auth middleware
↓
RBAC check
↓
Validate payload
↓
Save marks (pending)
↓
Create approval record
↓
Send notification
↓
Return response



{
  "identifier": "admin",
  "password": "Admin@KKV147"
}

{
  "admissionNo": "ST001",
  "firstName": "Rahul",
  "lastName": "Das",
  "dob": "2012-05-10",
  "gender": "male",
  "classId": 1,
  "sectionId": 1,
  "sessionId": 1,
  "rollNumber": 5
}