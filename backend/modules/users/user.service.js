import bcrypt from "bcrypt";
import * as repo from "./user.repository.js";
import AppError from "../../core/errors/AppError.js";

export async function changePassword({
  userId,
  currentPassword,
  newPassword
}) {

  const user = await repo.getUserPasswordHash(userId);

  if (!user)
    throw new AppError("User not found", 404);

  const valid = await bcrypt.compare(
    currentPassword,
    user.password_hash
  );

  if (!valid)
    throw new AppError("Incorrect password", 400);

  const hash = await bcrypt.hash(newPassword, 10);

  await repo.updatePassword(userId, hash);

  return { success: true };

}
export async function adminResetPassword({
  userId,
  newPassword
}) {

  if (!newPassword)
    throw new AppError("Password required", 400);

  const hash =
    await bcrypt.hash(newPassword, 10);

  await repo.updatePassword(userId, hash);

  return { success: true };

}

export async function listUsers(filters = {}) {
  return repo.listUsers(filters);
}

export async function updateUserStatus({ userId, status, actorUserId }) {
  const allowed = ["active", "inactive"];
  if (!allowed.includes(status)) {
    throw new AppError("status must be active or inactive", 400);
  }

  if (Number(userId) === Number(actorUserId) && status !== "active") {
    throw new AppError("You cannot deactivate your own account", 400);
  }

  await repo.updateUserStatus(userId, status);
  return { success: true };
}
