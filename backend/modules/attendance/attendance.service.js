import { pool } from "../../database/pool.js";
import * as repo from "./attendance.repository.js";
import AppError from "../../core/errors/AppError.js";
import * as messagingService from "../messaging/messaging.service.js";
import * as notificationService from "../notifications/notification.service.js";

const STUDENT_ATTENDANCE_STATUSES = new Set(["present", "absent"]);
const REVIEWABLE_STATUSES = new Set(["approved", "rejected"]);

const ABSENCE_MESSAGE_TEMPLATES = [
  {
    key: "absent_today",
    label: "Absent Today",
    body:
      "Dear {parent_name}, {student_name} was marked absent on {attendance_date} for {class_name} Section {section_name} ({session_name}). Please contact the school if this absence was unexpected.",
  },
  {
    key: "follow_up_required",
    label: "Follow Up Required",
    body:
      "Dear {parent_name}, this is to inform you that {student_name} was absent on {attendance_date}. Please respond in the app or contact the school office regarding the absence.",
  },
  {
    key: "attendance_warning",
    label: "Attendance Warning",
    body:
      "Dear {parent_name}, {student_name} has been recorded absent for class on {attendance_date}. Regular attendance is important. Please ensure the student reports to school or share the reason with the school administration.",
  },
];

function normalizeDate(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    throw new AppError("Attendance date is required", 400);
  }

  const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw new AppError("Attendance date must be a valid date", 400);
  }

  return parsed.toISOString().slice(0, 10);
}

function normalizeStudentIds(input) {
  if (!Array.isArray(input)) return [];
  return [...new Set(input.map((value) => Number(value)).filter(Boolean))];
}

function getTemplate(templateKey) {
  return ABSENCE_MESSAGE_TEMPLATES.find((item) => item.key === templateKey) || null;
}

function renderTemplate(templateBody, data) {
  return templateBody.replace(/\{(\w+)\}/g, (_, key) => String(data[key] ?? ""));
}

function formatHumanReadableDate(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return raw;
  }

  return parsed.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

async function resolveAcademicSessionId(explicitSessionId) {
  if (explicitSessionId) {
    const [session] = await repo.getAcademicSessionById(Number(explicitSessionId));
    if (!session) {
      throw new AppError("Academic session not found", 404);
    }
    return session;
  }

  const [activeSession] = await repo.getActiveAcademicSession();
  if (!activeSession) {
    throw new AppError("No active academic session", 400);
  }

  return activeSession;
}

async function validateTeacherScope(actor, classId, sectionId, academicSessionId) {
  const [teacher] = await repo.getTeacherByUserId(actor.userId);
  if (!teacher) {
    if (Array.isArray(actor?.roles) && actor.roles.includes("teacher")) {
      throw new AppError("Teacher record not found for the current user", 403);
    }
    return null;
  }

  const allowed = await repo.checkTeacherAssignment({
    teacherId: teacher.id,
    classId,
    sectionId,
    sessionId: academicSessionId,
  });

  if (!allowed.length) {
    throw new AppError("Not authorized for this class and section", 403);
  }

  return teacher;
}

function buildAttendanceRows(enrolledStudents, submittedAttendance) {
  const enrolledIds = new Set(enrolledStudents.map((row) => Number(row.student_id)));
  const statusMap = new Map();

  for (const row of Array.isArray(submittedAttendance) ? submittedAttendance : []) {
    const studentId = Number(row?.studentId || row?.student_id);
    const status = String(row?.status || "").trim().toLowerCase();

    if (!studentId) {
      throw new AppError("Each attendance row must include studentId", 400);
    }

    if (!enrolledIds.has(studentId)) {
      throw new AppError(`Student ${studentId} is not enrolled in the selected class/section`, 400);
    }

    if (!STUDENT_ATTENDANCE_STATUSES.has(status)) {
      throw new AppError("Student attendance status must be present or absent", 400);
    }

    statusMap.set(studentId, status);
  }

  return enrolledStudents.map((student) => ({
    studentId: Number(student.student_id),
    status: statusMap.get(Number(student.student_id)) || "absent",
  }));
}

function canAutoApprove(actor) {
  const permissions = actor.permissions || [];
  return (
    permissions.includes("student_attendance.review") ||
    permissions.includes("marks.approve")
  );
}

export async function getStudentAttendanceEntryScopes(actor) {
  const isTeacher = Array.isArray(actor?.roles) && actor.roles.includes("teacher");

  if (!isTeacher) {
    return {
      restricted: false,
      assignments: [],
    };
  }

  const assignments = await repo.getTeacherAssignedScopes(actor.userId);

  return {
    restricted: true,
    assignments: assignments.map((row) => ({
      class_id: Number(row.class_id),
      section_id: Number(row.section_id),
      session_id: Number(row.session_id),
      class_name: row.class_name,
      class_scope: row.class_scope,
      section_name: row.section_name,
      medium: row.medium,
      session_name: row.session_name,
    })),
  };
}

export async function takeStudentAttendance(data, actor) {
  const classId = Number(data?.classId || data?.class_id);
  const sectionId = Number(data?.sectionId || data?.section_id);
  const attendanceDate = normalizeDate(data?.date);

  if (!classId || !sectionId) {
    throw new AppError("classId and sectionId are required", 400);
  }

  const academicSession = await resolveAcademicSessionId(
    data?.academic_session_id || data?.session_id
  );

  await validateTeacherScope(actor, classId, sectionId, academicSession.id);

  const [existingSession] = await repo.getStudentAttendanceSessionForScope({
    classId,
    sectionId,
    date: attendanceDate,
    academicSessionId: academicSession.id,
  });

  if (existingSession && existingSession.approval_status !== "rejected") {
    throw new AppError("Student attendance is already recorded for this class, section, and date", 400);
  }

  const enrolled = await repo.getEnrolledStudents({
    classId,
    sectionId,
    sessionId: academicSession.id,
  });

  if (!enrolled.length) {
      throw new AppError("No active students found for the selected class and section", 400);
  }

  const finalRows = buildAttendanceRows(enrolled, data?.attendance);
  const autoApproved = canAutoApprove(actor);
  const reviewedAt = autoApproved ? new Date() : null;
  const reviewRemarks = autoApproved ? "Recorded and approved by admin." : null;
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const sessionPayload = {
      classId,
      sectionId,
      academicSessionId: academicSession.id,
      date: attendanceDate,
      takenBy: actor.userId,
      deviceSource: data?.deviceSource || data?.device_source || "manual",
      attendanceType: "student",
      approvalStatus: autoApproved ? "approved" : "pending",
      submittedBy: actor.userId,
      submittedAt: new Date(),
      reviewedBy: autoApproved ? actor.userId : null,
      reviewedAt,
      reviewRemarks,
    };

    let attendanceSessionId;
    if (existingSession?.id) {
      attendanceSessionId = Number(existingSession.id);
      await repo.resubmitAttendanceSession(conn, {
        sessionId: attendanceSessionId,
        takenBy: sessionPayload.takenBy,
        deviceSource: sessionPayload.deviceSource,
        approvalStatus: sessionPayload.approvalStatus,
        submittedBy: sessionPayload.submittedBy,
        submittedAt: sessionPayload.submittedAt,
        reviewedBy: sessionPayload.reviewedBy,
        reviewedAt: sessionPayload.reviewedAt,
        reviewRemarks: sessionPayload.reviewRemarks,
      });
      await repo.deleteAttendanceRows(conn, attendanceSessionId);
      await repo.upsertApproval(conn, {
        sessionId: attendanceSessionId,
        submittedBy: actor.userId,
        status: autoApproved ? "approved" : "pending",
        approvedBy: autoApproved ? actor.userId : null,
        approvedAt: reviewedAt,
        remarks: reviewRemarks,
      });
    } else {
      attendanceSessionId = await repo.createAttendanceSession(sessionPayload, conn);

      if (!autoApproved) {
        await repo.createApproval(conn, {
          sessionId: attendanceSessionId,
          submittedBy: actor.userId,
        });
      }
    }

    await repo.insertAttendanceRows(
      finalRows.map((row) => ({
        sessionId: attendanceSessionId,
        studentId: row.studentId,
        status: row.status,
      })),
      conn
    );

    await conn.commit();

    return {
      attendanceSessionId,
      approval_status: autoApproved ? "approved" : "pending",
      academic_session_id: academicSession.id,
      resubmitted: Boolean(existingSession?.id),
      totals: {
        total: finalRows.length,
        present: finalRows.filter((row) => row.status === "present").length,
        absent: finalRows.filter((row) => row.status === "absent").length,
      },
    };
  } catch (err) {
    await conn.rollback();

    if (err.code === "ER_DUP_ENTRY") {
      throw new AppError("Student attendance is already recorded for this class, section, and date", 400);
    }

    throw err;
  } finally {
    conn.release();
  }
}

export async function listStudentAttendanceSessions(filters = {}) {
  return repo.getStudentAttendanceSessions(filters);
}

export async function getStudentAttendanceRoster(filters = {}, actor) {
  const classId = Number(filters?.class_id || filters?.classId);
  const sectionId = Number(filters?.section_id || filters?.sectionId);
  const attendanceDate = normalizeDate(filters?.date || filters?.attendance_date || new Date());

  if (!classId || !sectionId) {
    throw new AppError("class_id and section_id are required", 400);
  }

  const academicSession = await resolveAcademicSessionId(
    filters?.academic_session_id || filters?.session_id
  );

  await validateTeacherScope(actor, classId, sectionId, academicSession.id);

  const enrolled = await repo.getEnrolledStudents({
    classId,
    sectionId,
    sessionId: academicSession.id,
  });

  const [existingSession] = await repo.getStudentAttendanceSessionForScope({
    classId,
    sectionId,
    date: attendanceDate,
    academicSessionId: academicSession.id,
  });
  const existingRows = existingSession
    ? await repo.getStudentAttendanceRows(Number(existingSession.id))
    : [];
  const existingStatusMap = new Map(
    existingRows.map((row) => [Number(row.student_id), row.status])
  );

  return {
    academic_session_id: academicSession.id,
    academic_session_name: academicSession.name,
    class_id: classId,
    section_id: sectionId,
    date: attendanceDate,
    existing_session_id: existingSession ? Number(existingSession.id) : null,
    existing_approval_status: existingSession?.approval_status || null,
    existing_submitted_at: existingSession?.submitted_at || null,
    existing_submitted_by_username: existingSession?.submitted_by_username || null,
    existing_reviewed_at: existingSession?.reviewed_at || null,
    existing_reviewed_by_username: existingSession?.reviewed_by_username || null,
    existing_review_remarks: existingSession?.review_remarks || null,
    students: enrolled.map((student) => ({
      student_id: Number(student.student_id),
      name: student.student_name,
      roll_number: student.roll_number,
      class_name: student.class_name,
      section_name: student.section_name,
      class_scope: student.class_scope,
      medium: student.medium,
      status: existingStatusMap.get(Number(student.student_id)) || "present",
    })),
  };
}

export async function getPendingStudentAttendance(filters = {}) {
  return repo.getStudentAttendanceSessions({
    ...filters,
    approval_status: "pending",
  });
}

export async function getStudentAttendanceSession(sessionId) {
  const [session] = await repo.getStudentAttendanceSessionById(Number(sessionId));

  if (!session) {
    throw new AppError("Student attendance session not found", 404);
  }

  const rows = await repo.getStudentAttendanceRows(Number(sessionId));
  const parentMessages = await repo.getParentMessageHistory(Number(sessionId));

  return {
    ...session,
    rows,
    parent_messages: parentMessages,
  };
}

export async function reviewStudentAttendance(data, actor) {
  const sessionId = Number(data?.attendance_session_id || data?.sessionId);
  const status = String(data?.status || "").trim().toLowerCase();

  if (!sessionId) {
    throw new AppError("attendance_session_id is required", 400);
  }

  if (!REVIEWABLE_STATUSES.has(status)) {
    throw new AppError("Review status must be approved or rejected", 400);
  }

  const [session] = await repo.getStudentAttendanceSessionById(sessionId);
  if (!session) {
    throw new AppError("Student attendance session not found", 404);
  }

  if (session.approval_status !== "pending") {
    throw new AppError(`Student attendance is already ${session.approval_status}`, 400);
  }

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    await repo.updateAttendanceSessionReview(conn, {
      sessionId,
      status,
      reviewedBy: actor.userId,
      remarks: data?.remarks || null,
    });

    await repo.updateApprovalReview(conn, {
      sessionId,
      status,
      reviewedBy: actor.userId,
      remarks: data?.remarks || null,
    });

    await conn.commit();

    return {
      attendance_session_id: sessionId,
      status,
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export function getAbsenceMessageTemplates() {
  return ABSENCE_MESSAGE_TEMPLATES;
}

export async function notifyAbsentParents(sessionId, data, actor) {
  const [session] = await repo.getStudentAttendanceSessionById(Number(sessionId));

  if (!session) {
    throw new AppError("Student attendance session not found", 404);
  }

  if (session.approval_status !== "approved") {
    throw new AppError("Parents can only be notified after admin approval", 400);
  }

  const selectedStudentIds = normalizeStudentIds(data?.student_ids);
  const recipients = await repo.getAbsentStudentsWithParents(Number(sessionId), selectedStudentIds);

  if (!recipients.length) {
    throw new AppError("No approved absent students with linked parent app accounts were found", 404);
  }

  const template = data?.template_key ? getTemplate(data.template_key) : null;
  if (data?.template_key && !template) {
    throw new AppError("Invalid absence message template", 400);
  }

  const customMessage = String(data?.message || "").trim();
  if (!template && !customMessage) {
    throw new AppError("template_key or message is required", 400);
  }

  const sent = [];
  const failed = [];

  for (const row of recipients) {
    const messageBody = template
      ? renderTemplate(template.body, {
          parent_name: row.parent_name || "Parent",
          student_name: row.student_name,
          attendance_date: formatHumanReadableDate(row.attendance_date),
          class_name: row.class_name || "-",
          section_name: row.section_name || "-",
          session_name: row.session_name || "-",
          relationship: row.relationship || "Parent",
        })
      : customMessage;
    const notificationTitle = `Absence Notice: ${row.student_name}`;

    try {
      const messageResult = await messagingService.sendMessage(
        {
          target_type: "direct",
          recipient_user_id: row.parent_user_id,
          message: messageBody,
        },
        actor.userId
      );

      sent.push({
        student_id: row.student_id,
        student_name: row.student_name,
        parent_user_id: row.parent_user_id,
        parent_name: row.parent_name,
      });

      const conn = await pool.getConnection();

      try {
        await conn.beginTransaction();

        const notificationId = await repo.createNotification(conn, {
          userId: row.parent_user_id,
          type: "student_attendance_absent",
          entityType: "attendance_session",
          entityId: Number(sessionId),
          title: notificationTitle,
          body: messageBody,
        });

        await repo.logParentMessage(conn, {
          attendanceSessionId: Number(sessionId),
          studentId: row.student_id,
          parentUserId: row.parent_user_id,
          conversationId: messageResult.conversation_id,
          messageId: messageResult.message_id,
          notificationId,
          messageBody,
          sentBy: actor.userId,
        });

        await conn.commit();
      } catch (err) {
        await conn.rollback();
        console.error("Parent message logging failed after send", err);
      } finally {
        conn.release();
      }

      try {
        await notificationService.dispatchNotificationUpdate([row.parent_user_id], {
          type: "student_attendance_absent",
          entityType: "attendance_session",
          entityId: Number(sessionId),
          title: notificationTitle,
          body: messageBody,
        });
      } catch (err) {
        console.error("Parent notification dispatch failed after send", err);
      }
    } catch (err) {
      failed.push({
        student_id: row.student_id,
        student_name: row.student_name,
        parent_user_id: row.parent_user_id,
        parent_name: row.parent_name,
        error: err.message,
      });
    }
  }

  return {
    attendance_session_id: Number(sessionId),
    sent_count: sent.length,
    failed_count: failed.length,
    sent,
    failed,
  };
}
