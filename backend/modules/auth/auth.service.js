import bcrypt from "bcrypt";
import { v4 as uuid } from "uuid";
import {
  findUserByIdentifier,
  getUserPermissions,
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

  const identifier = data.identifier;
  if (!identifier || !data.password) {
    throw new AppError("Missing credentials", 400);
  }
  const user = await findUserByIdentifier(identifier);

  if (!user)
    throw new AppError("Invalid credentials", 401);

  const match = await bcrypt.compare(
    data.password,
    user.password_hash
  );

  if (!match)
    throw new Error("Invalid credentials");

  const permissionsRows =
    await getUserPermissions(user.id);

  const permissions =
    permissionsRows.map(p => p.name);

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
      permissions
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
    throw new Error("Invalid refresh token");
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