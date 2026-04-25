import * as service from "./teacher.service.js";
import { generateTeacherAttendanceMatrixPdf } from "./teacherPdf.service.js";
import fs from "node:fs/promises";

function parseCsvLine(line) {
  return String(line || "")
    .split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
    .map((value) => value.replace(/^"|"$/g, "").trim());
}

function normalizeCsvHeader(header) {
  return String(header || "")
    .trim()
    .replace(/^\uFEFF/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function mapCsvHeader(header) {
  const normalized = normalizeCsvHeader(header);
  if (normalized === "mobile" || normalized === "mobile_no" || normalized === "contact") {
    return "phone";
  }
  if (normalized === "classscope" || normalized === "scope" || normalized === "class") {
    return "class_scope";
  }
  if (normalized === "employeeid" || normalized === "teacher_id") {
    return "employee_id";
  }
  if (normalized === "pass" || normalized === "pwd") {
    return "password";
  }
  return normalized;
}

function mapCsvRow(headers, values) {
  const row = {};
  headers.forEach((header, idx) => {
    const mappedHeader = mapCsvHeader(header);
    const value = values[idx] ?? "";
    if (!(mappedHeader in row) || !String(row[mappedHeader] || "").trim()) {
      row[mappedHeader] = value;
    }
  });
  return row;
}

function normalizeClassScopeValue(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "school";
  if (raw === "hs") return "hs";
  if (raw === "school") return "school";
  if (raw.includes("higher secondary")) return "hs";
  if (/\b(11|12|xi|xii)\b/.test(raw)) return "hs";
  return "school";
}

/* ------------------ TEACHERS ------------------ */

export async function createTeacher(req, res, next) {
  try {
    const photo_url = req.file ? `/uploads/teachers/${req.file.filename}` : null;
      const data = {
      employee_id: req.body.employee_id,
      name: req.body.name,
      phone: req.body.phone,
      email: req.body.email,
      class_scope: req.body.class_scope,
      password: req.body.password,
      photo_url,
    };
    const result = await service.createTeacher(data);

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function getTeachers(req, res, next) {
  try {
    const teachers = await service.getTeachersForActor({
      actorUserId: req.user?.userId,
      actorPermissions: req.user?.permissions || [],
      page: req.query.page,
      limit: req.query.limit,
    });

    if (teachers && typeof teachers === "object" && Array.isArray(teachers.data)) {
      return res.json({
        success: true,
        data: teachers.data,
        pagination: teachers.pagination || null,
      });
    }

    res.json({ success: true, data: teachers });
  } catch (err) {
    next(err);
  }
}

export async function bulkUploadTeachers(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "CSV file is required" });
    }

    const text = await fs.readFile(req.file.path, "utf8");
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length < 2) {
      return res.status(400).json({ message: "CSV is empty" });
    }

    const headers = parseCsvLine(lines[0]);
    const rows = lines.slice(1).map((line) => mapCsvRow(headers, parseCsvLine(line)));
    const payloads = rows.map((row, index) => ({
      employee_id: row.employee_id,
      name: row.name,
      phone: row.phone,
      email: row.email,
      class_scope: normalizeClassScopeValue(row.class_scope),
      password: row.password,
      photo_url: row.photo_url || null,
      _meta: {
        rowNo: index + 2,
        employeeId: row.employee_id || null,
        teacherName: row.name || null,
      },
    }));

    const result = await service.bulkCreateTeachers(payloads);
    const statusCode = result.failedCount > 0 ? 207 : 201;
    res.status(statusCode).json(result);
  } catch (err) {
    next(err);
  }
}

export async function getTeacherById(req, res, next) {
  try {
    const teacher = await service.getTeacherForActor({
      teacherId: req.params.id,
      actorUserId: req.user?.userId,
      actorPermissions: req.user?.permissions || [],
    });
    res.json({ success: true, data: teacher });
  } catch (err) {
    next(err);
  }
}

export async function updateTeacher(req, res, next) {
  try {
    const photo_url = req.file ? `/uploads/teachers/${req.file.filename}` : undefined;
    await service.updateTeacher(req.params.id, {
      employee_id: req.body.employee_id,
      name: req.body.name,
      phone: req.body.phone,
      email: req.body.email,
      class_scope: req.body.class_scope,
      photo_url,
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function deleteTeacher(req, res, next) {
  try {
    await service.deleteTeacher(req.params.id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

/* ------------------ TEACHER ASSIGNMENTS ------------------ */

export async function assignTeacher(req, res, next) {
  try {
    console.log("Controller", req.body, res)
    await service.assignTeacher({
      teacherId: req.params.id,
      ...req.body
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function removeAssignment(req, res, next) {
  try {
    await service.removeAssignment(req.params.assignmentId);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function getAssignments(req, res, next) {
  try {
    const data = await service.getTeacherAssignmentsForActor({
      teacherId: req.params.id,
      actorUserId: req.user?.userId,
      actorPermissions: req.user?.permissions || [],
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

/* ------------------ ATTENDANCE DEVICES ------------------ */

export async function createAttendanceDevice(req, res, next) {
  try {
    const device = await service.createAttendanceDevice(req.body);
    res.json({ success: true, data: device });
  } catch (err) {
    next(err);
  }
}

export async function getAttendanceDevices(req, res, next) {
  try {
    const devices = await service.getAttendanceDevices();
    res.json({ success: true, data: devices });
  } catch (err) {
    next(err);
  }
}

export async function getAttendanceDeviceUserMappings(req, res, next) {
  try {
    const data = await service.getAttendanceDeviceUserMappings({
      deviceId: req.query.device_id || req.query.deviceId,
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function upsertAttendanceDeviceUserMapping(req, res, next) {
  try {
    const result = await service.upsertAttendanceDeviceUserMapping(req.body);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function deleteAttendanceDeviceUserMapping(req, res, next) {
  try {
    const result = await service.deleteAttendanceDeviceUserMapping(req.params.id);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

/* ------------------ ATTENDANCE LOGS (DEVICE INPUT) ------------------ */

export async function logTeacherAttendance(req, res, next) {
  try {
    const result = await service.logTeacherAttendance(req.body);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

/* ------------------ DAILY ATTENDANCE ------------------ */

export async function getTeacherAttendance(req, res, next) {
  try {
    const data = await service.getTeacherAttendanceForActor({
      teacherId: req.params.id,
      actorUserId: req.user?.userId,
      actorPermissions: req.user?.permissions || [],
      startDate: req.query.startDate,
      endDate: req.query.endDate
    });

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
export async function getAllTeacherAttendance(req,res,next){

  try{

    const data =
      await service.getAllTeacherAttendanceForActor({
        actorUserId: req.user?.userId,
        actorPermissions: req.user?.permissions || [],
        startDate: req.query.startDate,
        endDate: req.query.endDate
      });

    res.json({
      success:true,
      data
    });

  }catch(err){
    next(err);
  }

}
export async function downloadTeacherAttendanceMatrixPdf(req, res, next) {
  try {
    const matrixData = await service.getTeacherAttendanceMatrixForActor({
      actorUserId: req.user?.userId,
      actorPermissions: req.user?.permissions || [],
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      teacherId: req.query.teacher_id || req.query.teacherId,
      classScope: req.query.class_scope || req.query.classScope,
    });

    const pdfBuffer = await generateTeacherAttendanceMatrixPdf(matrixData);
    const from = matrixData?.meta?.from || "from";
    const to = matrixData?.meta?.to || "to";

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=teacher-attendance-matrix-${from}-to-${to}.pdf`
    );

    res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
}
export async function generateDailyAttendance(req, res, next) {
  try {
    const result = await service.generateDailyAttendance(req.body);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}
