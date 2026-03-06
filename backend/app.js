import express from "express"
import cors from "cors"
const app = express()

app.use((req, res, next) => {
  console.log(req.method, req.url);
  next();
});

app.use(cors({
    origin: [
        "http://localhost:5173",
        ""
    ],
    credentials: true
}))
app.use(express.json())


// ROUTES 
import authRoutes from "./modules/auth/auth.routes.js"
import academicRoutes from "./modules/academic/academic.routes.js"
import studentRoutes from "./modules/students/student.routes.js"
import parentRoutes from "./modules/parents/parent.routes.js"
import teacherRoutes from "./modules/teachers/teacher.routes.js"
import attendanceRoutes from "./modules/attendance/attendance.routes.js"
import examRoutes from "./modules/exams/exams.routes.js"
import marksRoutes from "./modules/marks/marks.routes.js"
import approvalRoutes from "./modules/approvals/approvals.routes.js"
import reportRoutes from "./modules/reports/reports.routes.js"
import feeRoutes from "./modules/fees/fee.routes.js"
import subjectRoutes from "./modules/subjects/subjects.routes.js"
import messageRoutes from "./modules/messaging/messaging.routes.js"

import notificationRoutes from "./modules/notifications/notification.routes.js"

import dashboardRoutes from "./modules/dashboard/dashboard.routes.js"

// MIDDLEWARES 
import { authenticate } from "./modules/auth/auth.middleware.js";
import { attachPermissions } from "./core/rbac/rbac.middleware.js";

import { errorHandler } from "./middleware/error.middleware.js"

app.use("/api/v1/auth", authRoutes);


app.use(authenticate);
app.use(attachPermissions);

app.use("/api/v1/academic", academicRoutes);
app.use("/api/v1/students", studentRoutes);
app.use("/api/v1/parents", parentRoutes)
app.use("/api/v1/teachers", teacherRoutes)
app.use("/api/v1/attendance", attendanceRoutes)
app.use("/api/v1/exams", examRoutes)
app.use("/api/v1/marks", marksRoutes)
app.use("/api/v1/approvals", approvalRoutes)
app.use("/api/v1/reports", reportRoutes)
app.use("/api/v1/fees", feeRoutes)
app.use("/api/v1/subjects", subjectRoutes)
app.use("/api/v1/messages", messageRoutes)


app.use("/api/v1/notifications", notificationRoutes)

app.use("/api/v1/dashboard", dashboardRoutes)

app.use(errorHandler)


export default app;