import * as repo from "./staff.repository.js";
import AppError from "../../core/errors/AppError.js";

const ALLOWED_TITLES = ["HEADSTAFF", "TEACHINGSTAFF", "NONTEACHINGSTAFF"];

function normalizeTitle(raw) {
  const value = String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/[\s_-]+/g, "");

  if (value === "HEADSTAFF") return "HEADSTAFF";
  if (value === "TEACHINGSTAFF") return "TEACHINGSTAFF";
  if (value === "NONTEACHINGSTAFF") return "NONTEACHINGSTAFF";
  return value;
}

function validatePayload(data) {
  const campusType = String(data?.type || "").trim().toLowerCase();
  if (!campusType) {
    throw new AppError("Staff campus type is required", 400);
  }
  if (!["school", "college"].includes(campusType)) {
    throw new AppError("Type must be either 'school' or 'college'", 400);
  }
  if (!String(data?.name || "").trim()) {
    throw new AppError("Staff name is required", 400);
  }
  const title = normalizeTitle(data?.title);
  if (!title) {
    throw new AppError("Staff title is required", 400);
  }
  if (!ALLOWED_TITLES.includes(title)) {
    throw new AppError(
      "Title must be one of: HEADSTAFF, TEACHINGSTAFF, NONTEACHINGSTAFF",
      400,
    );
  }
}

export async function listStaff() {
  return repo.listStaff();
}

export async function listStaffByCampus(type) {
  const campusType = String(type || "").trim().toLowerCase();
  if (!["school", "college"].includes(campusType)) {
    throw new AppError("Query param 'type' must be 'school' or 'college'", 400);
  }
  return repo.listStaffByCampus(campusType);
}

export async function getStaffById(id) {
  const rows = await repo.getStaffById(id);
  const item = rows?.[0];
  if (!item) {
    throw new AppError("Staff not found", 404);
  }
  return item;
}

export async function createStaff(data) {
  validatePayload(data);
  const result = await repo.createStaff({
    image_url: String(data.image_url || "").trim() || null,
    name: String(data.name || "").trim(),
    title: normalizeTitle(data.title),
    type: String(data.type || "").trim().toLowerCase(),
  });
  return { id: result.insertId };
}

export async function updateStaff(id, data) {
  validatePayload(data);
  const result = await repo.updateStaff(id, {
    image_url: String(data.image_url || "").trim() || null,
    name: String(data.name || "").trim(),
    title: normalizeTitle(data.title),
    type: String(data.type || "").trim().toLowerCase(),
  });

  if (!result.affectedRows) {
    throw new AppError("Staff not found", 404);
  }

  return { id: Number(id) };
}

export async function deleteStaff(id) {
  const result = await repo.deleteStaff(id);
  if (!result.affectedRows) {
    throw new AppError("Staff not found", 404);
  }
  return { id: Number(id) };
}
