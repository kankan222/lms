import * as studentService from "./student.service.js";
import fs from "node:fs/promises";

function parseCsvLine(line) {
  return line
    .split(/,(?=(?:(?:[^\"]*\"){2})*[^\"]*$)/)
    .map((value) => value.replace(/^\"|\"$/g, "").trim());
}

function mapCsvRow(headers, values) {
  const row = {};
  headers.forEach((header, idx) => {
    row[header] = values[idx] ?? "";
  });
  return row;
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

    const payloads = rows.map((row) => ({
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
        section_id: row.section_id,
        stream_id: row.stream_id || null,
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
      }
    }));

    const result = await studentService.bulkCreateStudents(payloads);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}
