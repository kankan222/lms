import * as studentService from "./student.service.js";
import fs from "node:fs/promises";

function parseCsvLine(line) {
  return line
    .split(/,(?=(?:(?:[^\"]*\"){2})*[^\"]*$)/)
    .map((value) => value.replace(/^\"|\"$/g, "").trim());
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
  if (normalized === "admission_date" || normalized === "dateofadmission") {
    return "date_of_admission";
  }
  if (normalized === "roll_no" || normalized === "rollno" || normalized === "roll") {
    return "roll_number";
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

function normalizeOptionalId(value) {
  if (value === undefined || value === null) {
    return null;
  }

  const raw = String(value).trim();
  if (!raw) {
    return null;
  }

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

export async function createStudent(req, res, next) {
  try {
    const payload = req.body?.payload
      ? JSON.parse(req.body.payload)
      : req.body;

    if (req.file) {
      payload.student = payload.student || {};
      payload.student.photo_url = `/uploads/students/${req.file.filename}`;
    }

    const result = await studentService.createStudent(payload);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function getStudents(req, res, next) {
  try {
    const students = await studentService.getStudentsForActor(
      req.query,
      req.user?.userId
    );
    res.json(students);
  } catch (err) {
    next(err);
  }
}

export async function getStudentById(req, res, next) {
  try {
    const student = await studentService.getStudentByIdForActor(
      req.params.id,
      req.user?.userId
    );
    res.json(student);
  } catch (err) {
    next(err);
  }
}

export async function updateStudent(req, res, next) {
  try {
    const student = await studentService.updateStudent(req.params.id, req.body);
    res.json(student);
  } catch (err) {
    next(err);
  }
}

export async function deleteStudent(req, res, next) {
  try {
    await studentService.deleteStudent(req.params.id);
    res.json({ message: "Student deleted" });
  } catch (err) {
    next(err);
  }
}

export async function searchParent(req, res, next) {
  try {
    const parent = await studentService.searchParent(req.query.phone);
    res.json(parent);
  } catch (err) {
    next(err);
  }
}

export async function bulkUploadStudents(req, res, next) {
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
      student: {
        admission_no: row.admission_no,
        name: row.name,
        dob: row.dob,
        gender: row.gender,
        mobile: row.mobile,
        date_of_admission: row.date_of_admission,
        photo_url: row.photo_url || null
      },
      enrollment: {
        session_id: row.session_id,
        class_id: row.class_id,
        section_id: normalizeOptionalId(row.section_id),
        stream_id: normalizeOptionalId(row.stream_id),
        stream: row.stream || row.stream_name || null,
        medium: row.medium,
        roll_number: row.roll_number
      },
      father: {
        name: row.father_name,
        mobile: row.father_mobile,
        email: row.father_email,
        occupation: row.father_occupation,
        qualification: row.father_qualification
      },
      mother: {
        name: row.mother_name,
        mobile: row.mother_mobile,
        email: row.mother_email,
        occupation: row.mother_occupation,
        qualification: row.mother_qualification
      },
      _meta: {
        rowNo: index + 2,
        admissionNo: row.admission_no || null,
        studentName: row.name || null,
      },
    }));

    const result = await studentService.bulkCreateStudents(payloads);
    const statusCode = result.failedCount > 0 ? 207 : 201;
    res.status(statusCode).json(result);
  } catch (err) {
    next(err);
  }
}
