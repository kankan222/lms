import bcrypt from "bcrypt";
import { v4 as uuid } from "uuid";
import {
  findUserByEmailOrPhone,
  getUserPermissions,
  getUserRoles,
  createSession,
  findSession,
  updateSessionToken,
  revokeSession,
  revokeAllUserSessions
} from "./auth.repository.js";

import {
  verifyRefreshToken,
  generateAccessToken,
  generateRefreshToken
} from "../../core/auth/jwt.js";


import AppError from "../../core/errors/AppError.js";
export async function login(data, meta) {
  const email = data.email?.trim();
  const phone = data.phone?.trim();
  const password = data.password;
  if ((!email && !phone) || !password) {
    throw new AppError("Missing credentials", 400);
  }
  const user = await findUserByEmailOrPhone({ email, phone });

  if (!user)
    throw new AppError("Invalid credentials", 401);

  if (user.status !== "active") {
    throw new AppError("Account is inactive. Contact admin.", 403);
  }

  const match = await bcrypt.compare(
    password,
    user.password_hash
  );

  if (!match)
    throw new AppError("Invalid credentials");

  const [permissionsRows, roleRows] = await Promise.all([
    getUserPermissions(user.id),
    getUserRoles(user.id)
  ]);

  const permissions =
    permissionsRows.map(p => p.name);
  const roles = roleRows.map((r) => r.name);

  const sessionId = uuid();

  const accessToken = generateAccessToken({
    userId: user.id,
    sessionId
  });

  const refreshToken = generateRefreshToken({
    userId: user.id,
    sessionId
  });

  const refreshHash =
    await bcrypt.hash(refreshToken, 10);

  await createSession({
    sessionId,
    userId: user.id,
    refreshHash,
    deviceId: meta.deviceId ?? null,
    deviceType: meta.deviceType ?? null,
    ip: meta.ip,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  });

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      permissions,
      roles
    }
  };
}

export async function refresh(refreshToken) {
  if (!refreshToken) {
    throw new AppError("Refresh token missing", 400);
  }
  let payload;

  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new AppError("Invalid refresh token");
  }

  const session = await findSession(payload.sessionId);

  if (!session)
    throw new Error("Session expired");

  const match = await bcrypt.compare(
    refreshToken,
    session.refresh_token_hash
  );

  if (!match)
    throw new Error("Token mismatch");

  const newAccessToken = generateAccessToken({
    userId: payload.userId,
    sessionId: payload.sessionId
  });

  const newRefreshToken = generateRefreshToken({
    userId: payload.userId,
    sessionId: payload.sessionId
  });

  const newHash = await bcrypt.hash(newRefreshToken, 10);

  await updateSessionToken(
    payload.sessionId,
    newHash,
    new Date(Date.now() + 30*24*60*60*1000)
  );

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken
  };
}


export async function logout(sessionId) {
  await revokeSession(sessionId);
  // return true;
}

export async function logoutAll(userId) {
  await revokeAllUserSessions(userId);
  // return true;
}
