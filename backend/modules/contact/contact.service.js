import AppError from "../../core/errors/AppError.js";
import * as repo from "./contact.repository.js";

function normalizePhone(value) {
  return String(value || "").replace(/[^\d+]/g, "").trim();
}

export async function createContactSubmission(payload = {}) {
  const name = String(payload.name || "").trim();
  const contact_number = normalizePhone(payload.contact_number);
  const message = String(payload.message || "").trim();

  if (!name) throw new AppError("Name is required", 400);
  if (!contact_number) throw new AppError("Contact number is required", 400);

  const digits = contact_number.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) {
    throw new AppError("Contact number must be between 10 and 15 digits", 400);
  }

  if (message.length > 1000) {
    throw new AppError("Message cannot exceed 1000 characters", 400);
  }

  await repo.ensureContactSubmissionsTable();
  const result = await repo.createContactSubmission({
    name,
    contact_number,
    message: message || null,
  });

  return {
    id: result.insertId,
    name,
    contact_number,
    message: message || null,
  };
}

export async function listContactSubmissions(filters = {}) {
  await repo.ensureContactSubmissionsTable();
  return repo.listContactSubmissions({
    limit: filters.limit,
  });
}