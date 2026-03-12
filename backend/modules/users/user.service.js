import bcrypt from "bcrypt";
import * as repo from "./user.repository.js";
import AppError from "../../core/errors/AppError.js";

export async function changePassword({
  userId,
  currentPassword,
  newPassword
}) {
  if (!currentPassword || !newPassword) {
    throw new AppError("Current password and new password are required", 400);
  }

  if (String(newPassword).length < 6) {
    throw new AppError("New password must be at least 6 characters", 400);
  }

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

export async function getMyAccount(userId) {
  const user = await repo.getUserAccountProfile(userId);

  if (!user) {
    throw new AppError("User not found", 404);
  }

  return {
    ...user,
    roles: String(user.roles || "")
      .split(",")
      .map((role) => role.trim())
      .filter(Boolean),
    name: user.teacher_name || user.parent_name || user.username || user.email || "-",
  };
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

export async function listRoles() {
  return repo.listRoles();
}

export async function listPermissions() {
  return repo.listPermissions();
}

export async function createUser(data = {}) {
  const username = String(data.username || "").trim();
  const email = String(data.email || "").trim();
  const phone = String(data.phone || "").trim();
  const password = String(data.password || "");
  const status = String(data.status || "active").trim() || "active";
  const roles = Array.isArray(data.roles)
    ? data.roles.map((item) => String(item || "").trim()).filter(Boolean)
    : [];

  if (!password) {
    throw new AppError("Password is required", 400);
  }
  if (!email && !phone) {
    throw new AppError("Either email or phone is required", 400);
  }
  if (password.length < 6) {
    throw new AppError("Password must be at least 6 characters", 400);
  }
  if (!roles.length) {
    throw new AppError("At least one role is required", 400);
  }
  if (!["active", "inactive"].includes(status)) {
    throw new AppError("status must be active or inactive", 400);
  }

  const existing = await repo.getUserByUsernameOrContact({
    username,
    email: email || null,
    phone: phone || null
  });

  if (existing) {
    throw new AppError("A user with the same username, email or phone already exists", 400);
  }

  const validRoles = await repo.listRoles();
  const validRoleNames = new Set(validRoles.map((item) => item.name));
  const invalidRoles = roles.filter((roleName) => !validRoleNames.has(roleName));
  if (invalidRoles.length) {
    throw new AppError(`Invalid role(s): ${invalidRoles.join(", ")}`, 400);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const userId = await repo.createUserWithRoles({
    username: username || null,
    email: email || null,
    phone: phone || null,
    passwordHash,
    status,
    roles
  });

  return { success: true, user_id: userId };
}

export async function getUserPermissions(userId) {
  const user = await repo.getUserById(userId);
  if (!user) {
    throw new AppError("User not found", 404);
  }
  return repo.getUserDirectPermissions(userId);
}

export async function grantUserPermissions({ userId, permissions }) {
  const user = await repo.getUserById(userId);
  if (!user) {
    throw new AppError("User not found", 404);
  }

  const normalizedPermissions = Array.isArray(permissions)
    ? permissions.map((item) => String(item || "").trim()).filter(Boolean)
    : [];

  const availablePermissions = await repo.listPermissions();
  const availableNames = new Set(availablePermissions.map((item) => item.name));
  const invalidPermissions = normalizedPermissions.filter((name) => !availableNames.has(name));

  if (invalidPermissions.length) {
    throw new AppError(`Invalid permission(s): ${invalidPermissions.join(", ")}`, 400);
  }

  await repo.replaceUserPermissions(userId, normalizedPermissions);
  return { success: true };
}
