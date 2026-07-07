import bcrypt from "bcrypt";
import { v4 as uuid } from "uuid";
import {
  findUserByEmailOrPhone,
  findUserById,
  getUserPermissions,
  getUserRoles,
  createSession,
  findSession,
  updateSessionToken,
  updateLastLogin,
  revokeSession,
  revokeAllUserSessions
} from "./auth.repository.js";
import * as otpRepo from "./auth.otp.repository.js";
import {
  getOtpSettings,
  resolveOtpTemplateId,
  sendOtpSms
} from "./auth.sms.service.js";

import {
  verifyRefreshToken,
  generateAccessToken,
  generateRefreshToken
} from "../../core/auth/jwt.js";
import { applyRolePermissionFallbacks } from "../../core/rbac/rbac.service.js";


import AppError from "../../core/errors/AppError.js";

const OTP_MAX_WRONG_ATTEMPTS = 5;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const OTP_MAX_RESENDS_PER_DAY = 10;
const SUSPICIOUS_FAILED_LOGIN_THRESHOLD = 3;

function isProductionEnvironment() {
  return String(process.env.NODE_ENV || "").trim().toLowerCase() === "production";
}

function normalizeStoredIndianPhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length === 10) return digits;
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  return null;
}

function maskPhone(phone) {
  const digits = String(phone || "");
  if (digits.length < 4) return "registered phone";
  return `******${digits.slice(-4)}`;
}

function generateOtp(length) {
  const max = 10 ** length;
  return String(Math.floor(Math.random() * max)).padStart(length, "0");
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function secondsUntil(date) {
  return Math.max(0, Math.ceil((new Date(date).getTime() - Date.now()) / 1000));
}

async function loadAccessData(userId) {
  const [permissionsRows, roleRows] = await Promise.all([
    getUserPermissions(userId),
    getUserRoles(userId)
  ]);

  const roles = roleRows.map((r) => r.name);

  return {
    permissions: applyRolePermissionFallbacks(
      permissionsRows.map(p => p.name),
      roles
    ),
    roles
  };
}

async function issueLoginSession(user, accessData, meta) {
  const sessionId = uuid();

  const accessToken = generateAccessToken({
    userId: user.id,
    sessionId
  });

  const refreshToken = generateRefreshToken({
    userId: user.id,
    sessionId
  });

  const refreshHash = await bcrypt.hash(refreshToken, 10);

  await createSession({
    sessionId,
    userId: user.id,
    refreshHash,
    deviceId: meta.deviceId ?? null,
    deviceType: meta.deviceType ?? null,
    ip: meta.ip,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  });

  if (meta.deviceId && !isProductionEnvironment()) {
    await otpRepo.touchTrustedDevice({
      userId: user.id,
      deviceId: meta.deviceId,
      deviceType: meta.deviceType,
      ip: meta.ip
    });
  }

  await Promise.all([
    updateLastLogin(user.id),
    otpRepo.clearLoginFailures(user.id)
  ]);

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      permissions: accessData.permissions,
      roles: accessData.roles
    }
  };
}

async function resolveOtpRequirement(user, roles, meta) {
  if (isProductionEnvironment()) {
    return { required: true, reason: "production_login" };
  }

  if (!meta.deviceId) {
    return { required: true, reason: "new_device" };
  }

  const trustedDevice = await otpRepo.findTrustedDevice(user.id, meta.deviceId);
  if (!trustedDevice) {
    return { required: true, reason: "new_device" };
  }

  if (trustedDevice.device_type && meta.deviceType && trustedDevice.device_type !== meta.deviceType) {
    return { required: true, reason: "changed_device_type" };
  }

  if (trustedDevice.last_ip && meta.ip && trustedDevice.last_ip !== meta.ip) {
    return { required: true, reason: "unknown_ip" };
  }

  const failedLoginCount = await otpRepo.countRecentLoginFailures(user.id);
  if (failedLoginCount >= SUSPICIOUS_FAILED_LOGIN_THRESHOLD) {
    return { required: true, reason: "many_failed_logins" };
  }

  return { required: false, reason: null };
}

async function createAndSendOtpChallenge({ user, roles, phone, meta, reason }) {
  const activeBlock = await otpRepo.getActiveOtpBlock(user.id);
  if (activeBlock) {
    throw new AppError("Too many wrong OTP attempts. Try again after 24 hours.", 423);
  }

  const { expiryMinutes, otpLength } = getOtpSettings();
  const activeChallenge = await otpRepo.findActiveOtpChallenge({
    userId: user.id,
    deviceId: meta.deviceId ?? null
  });

  if (activeChallenge) {
    const resendAvailableAt = new Date(
      new Date(activeChallenge.last_sent_at).getTime() + OTP_RESEND_COOLDOWN_MS
    );

    return {
      otpRequired: true,
      challengeId: activeChallenge.id,
      expiresInMinutes: Math.max(1, Math.ceil(secondsUntil(activeChallenge.expires_at) / 60)),
      resendAvailableInSeconds: secondsUntil(resendAvailableAt),
      phone: maskPhone(activeChallenge.phone),
      reason: activeChallenge.reason || reason
    };
  }

  const otp = generateOtp(otpLength);
  const otpHash = await bcrypt.hash(otp, 10);
  const challengeId = uuid();
  const { roleName, templateId } = resolveOtpTemplateId(roles);

  await sendOtpSms({
    phone,
    otp,
    templateId
  });

  await otpRepo.createOtpChallenge({
    challengeId,
    userId: user.id,
    phone,
    roleName,
    templateId,
    otpHash,
    deviceId: meta.deviceId,
    deviceType: meta.deviceType,
    ip: meta.ip,
    reason,
    expiresAt: addMinutes(new Date(), expiryMinutes)
  });

  return {
    otpRequired: true,
    challengeId,
    expiresInMinutes: expiryMinutes,
    resendAvailableInSeconds: 60,
    phone: maskPhone(phone),
    reason
  };
}

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
    await otpRepo.revokeTrustedDevicesForUser(user.id, "account_inactive");
    throw new AppError("Account is inactive. Contact admin.", 403);
  }

  const match = await bcrypt.compare(
    password,
    user.password_hash
  );

  if (!match) {
    await otpRepo.recordLoginFailure({
      userId: user.id,
      deviceId: meta.deviceId,
      deviceType: meta.deviceType,
      ip: meta.ip
    });
    throw new AppError("Invalid credentials", 401);
  }

  const { permissions, roles } = await loadAccessData(user.id);
  const storedPhone = normalizeStoredIndianPhone(user.phone);
  if (!storedPhone) {
    throw new AppError("No valid phone number found. Contact administrator to update phone number.", 400);
  }

  const otpRequirement = await resolveOtpRequirement(user, roles, meta);
  if (otpRequirement.required) {
    return createAndSendOtpChallenge({
      user,
      roles,
      phone: storedPhone,
      meta,
      reason: otpRequirement.reason
    });
  }

  return issueLoginSession(user, { permissions, roles }, meta);
}

export async function verifyOtp(data, meta) {
  const challengeId = String(data.challengeId || "").trim();
  const otp = String(data.otp || "").trim();

  if (!challengeId || !otp) {
    throw new AppError("Challenge ID and OTP are required", 400);
  }

  const challenge = await otpRepo.getOtpChallenge(challengeId);
  if (!challenge) {
    throw new AppError("Invalid OTP challenge", 400);
  }

  if (challenge.verified_at) {
    throw new AppError("OTP challenge already used", 400);
  }

  if (challenge.blocked_until && new Date(challenge.blocked_until).getTime() > Date.now()) {
    throw new AppError("Too many wrong OTP attempts. Try again after 24 hours.", 423);
  }

  if (new Date(challenge.expires_at).getTime() < Date.now()) {
    throw new AppError("OTP expired. Please request a new OTP.", 400);
  }

  if (challenge.device_id && meta.deviceId && challenge.device_id !== meta.deviceId) {
    throw new AppError("OTP challenge is not valid for this device", 400);
  }

  const valid = await bcrypt.compare(otp, challenge.otp_hash);
  if (!valid) {
    const nextAttempts = Number(challenge.failed_attempts || 0) + 1;
    const shouldBlock = nextAttempts >= OTP_MAX_WRONG_ATTEMPTS;
    await otpRepo.incrementOtpFailure(challengeId, shouldBlock);

    if (shouldBlock) {
      throw new AppError("Too many wrong OTP attempts. Try again after 24 hours.", 423);
    }

    throw new AppError(`Invalid OTP. ${OTP_MAX_WRONG_ATTEMPTS - nextAttempts} attempts remaining.`, 401);
  }

  const user = await findUserById(challenge.user_id);
  if (!user) {
    throw new AppError("User not found", 404);
  }
  if (user.status !== "active") {
    await otpRepo.revokeTrustedDevicesForUser(user.id, "account_inactive");
    throw new AppError("Account is inactive. Contact admin.", 403);
  }

  const accessData = await loadAccessData(user.id);

  await otpRepo.markOtpVerified(challengeId);
  if (meta.deviceId && !isProductionEnvironment()) {
    await otpRepo.trustDevice({
      userId: user.id,
      deviceId: meta.deviceId,
      deviceType: meta.deviceType,
      ip: meta.ip
    });
  }

  return issueLoginSession(user, accessData, meta);
}

export async function resendOtp(data, meta) {
  const challengeId = String(data.challengeId || "").trim();
  if (!challengeId) {
    throw new AppError("Challenge ID is required", 400);
  }

  const challenge = await otpRepo.getOtpChallenge(challengeId);
  if (!challenge) {
    throw new AppError("Invalid OTP challenge", 400);
  }
  if (challenge.verified_at) {
    throw new AppError("OTP challenge already used", 400);
  }
  if (challenge.blocked_until && new Date(challenge.blocked_until).getTime() > Date.now()) {
    throw new AppError("Too many wrong OTP attempts. Try again after 24 hours.", 423);
  }
  if (challenge.device_id && meta.deviceId && challenge.device_id !== meta.deviceId) {
    throw new AppError("OTP challenge is not valid for this device", 400);
  }

  const lastSentAt = new Date(challenge.last_sent_at).getTime();
  const elapsed = Date.now() - lastSentAt;
  if (elapsed < OTP_RESEND_COOLDOWN_MS) {
    const waitSeconds = Math.ceil((OTP_RESEND_COOLDOWN_MS - elapsed) / 1000);
    throw new AppError(`Please wait ${waitSeconds} seconds before requesting another OTP.`, 429);
  }

  const resendCount = await otpRepo.countOtpResendsLast24Hours(challenge.user_id);
  if (resendCount >= OTP_MAX_RESENDS_PER_DAY) {
    throw new AppError("Daily OTP resend limit exhausted. Try again after 24 hours.", 429);
  }

  const { expiryMinutes, otpLength } = getOtpSettings();
  const otp = generateOtp(otpLength);
  const otpHash = await bcrypt.hash(otp, 10);

  await sendOtpSms({
    phone: challenge.phone,
    otp,
    templateId: challenge.otp_template_id
  });

  await otpRepo.updateOtpForResend({
    challengeId,
    otpHash,
    expiresAt: addMinutes(new Date(), expiryMinutes)
  });

  return {
    otpRequired: true,
    challengeId,
    expiresInMinutes: expiryMinutes,
    resendAvailableInSeconds: 60,
    phone: maskPhone(challenge.phone)
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
    throw new AppError("Invalid refresh token", 401);
  }

  const session = await findSession(payload.sessionId);

  if (!session)
    throw new AppError("Session expired", 401);

  const match = await bcrypt.compare(
    refreshToken,
    session.refresh_token_hash
  );

  if (!match)
    throw new AppError("Token mismatch", 401);

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
