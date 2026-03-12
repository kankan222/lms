import fs from "fs";
import path from "path";
import * as repo from "./staff.repository.js";
import AppError from "../../core/errors/AppError.js";

const SECTION_MAP = {
  head: "HEADSTAFF",
  headstaff: "HEADSTAFF",
  teaching: "TEACHINGSTAFF",
  teachingstaff: "TEACHINGSTAFF",
  non_teaching: "NONTEACHINGSTAFF",
  nonteaching: "NONTEACHINGSTAFF",
  nonteachingstaff: "NONTEACHINGSTAFF",
  "non-teaching": "NONTEACHINGSTAFF",
};

function normalizeCampusType(raw) {
  const campusType = String(raw || "").trim().toLowerCase();
  if (!["school", "college"].includes(campusType)) {
    throw new AppError("Type must be either 'school' or 'college'", 400);
  }
  return campusType;
}

function normalizeSection(raw) {
  const key = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z]+/g, "_");

  const value = SECTION_MAP[key];
  if (!value) {
    throw new AppError("Section must be one of: head, teaching, non_teaching", 400);
  }
  return value;
}

function toSectionLabel(title) {
  if (title === "HEADSTAFF") return "head";
  if (title === "TEACHINGSTAFF") return "teaching";
  if (title === "NONTEACHINGSTAFF") return "non_teaching";
  return "head";
}

function cleanNameFromFilename(filename) {
  const baseName = path.parse(String(filename || "")).name;
  const cleaned = baseName
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) {
    throw new AppError("Invalid filename for staff name parsing", 400);
  }

  return cleaned
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function toPublicRow(row) {
  return {
    ...row,
    section: toSectionLabel(row.title),
  };
}

function deleteFileIfExists(filePath) {
  if (!filePath) return;
  const absolutePath = path.resolve(process.cwd(), String(filePath).replace(/^\//, ""));
  if (fs.existsSync(absolutePath)) {
    fs.unlinkSync(absolutePath);
  }
}

function ensureName(name) {
  const cleanName = String(name || "").trim();
  if (!cleanName) {
    throw new AppError("Staff name is required", 400);
  }
  return cleanName;
}

function ensureImagePath(imageUrl, { required = false } = {}) {
  const cleanPath = String(imageUrl || "").trim();
  if (required && !cleanPath) {
    throw new AppError("Staff image is required", 400);
  }
  return cleanPath || null;
}

export async function listStaff(filters = {}) {
  const rows = await repo.listStaff(filters);
  return rows.map(toPublicRow);
}

export async function listStaffByCampus(type) {
  const campusType = normalizeCampusType(type);
  const rows = await repo.listStaffByCampus(campusType);
  return rows.map(toPublicRow);
}

export async function getStaffById(id) {
  const item = await repo.getStaffById(id);
  if (!item) {
    throw new AppError("Staff not found", 404);
  }
  return toPublicRow(item);
}

export async function createStaff(data) {
  const result = await repo.createStaff({
    image_url: ensureImagePath(data.image_url, { required: true }),
    name: ensureName(data.name),
    title: normalizeSection(data.section || data.title),
    type: normalizeCampusType(data.type),
  });
  return { id: result.insertId };
}

export async function bulkCreateStaff(data) {
  const type = normalizeCampusType(data.type);
  const title = normalizeSection(data.section || data.title);
  const files = Array.isArray(data.files) ? data.files : [];

  if (!files.length) {
    throw new AppError("At least one image file is required", 400);
  }

  try {
    const records = files.map((file) => ({
      name: cleanNameFromFilename(file.originalname),
      image_url: ensureImagePath(file.path ? `/${String(file.path).replace(/\\/g, "/")}` : null, { required: true }),
      type,
      title,
    }));

    const inserted = await repo.bulkCreateStaff(records);
    return {
      count: inserted.length,
      items: inserted.map((item) => ({ ...item, section: toSectionLabel(item.title) })),
    };
  } catch (err) {
    for (const file of files) {
      deleteFileIfExists(file.path ? `/${String(file.path).replace(/\\/g, "/")}` : null);
    }
    throw err;
  }
}

export async function updateStaff(id, data) {
  const existing = await repo.getStaffById(id);
  if (!existing) {
    throw new AppError("Staff not found", 404);
  }

  const nextImageUrl = ensureImagePath(data.image_url, { required: false }) || existing.image_url || null;
  const result = await repo.updateStaff(id, {
    image_url: nextImageUrl,
    name: ensureName(data.name),
    title: normalizeSection(data.section || data.title),
    type: normalizeCampusType(data.type),
  });

  if (!result.affectedRows) {
    throw new AppError("Staff not found", 404);
  }

  if (data.image_url && existing.image_url && existing.image_url !== data.image_url) {
    deleteFileIfExists(existing.image_url);
  }

  return { id: Number(id) };
}

export async function deleteStaff(id) {
  const existing = await repo.getStaffById(id);
  if (!existing) {
    throw new AppError("Staff not found", 404);
  }

  const result = await repo.deleteStaff(id);
  if (!result.affectedRows) {
    throw new AppError("Staff not found", 404);
  }

  deleteFileIfExists(existing.image_url);
  return { id: Number(id) };
}
