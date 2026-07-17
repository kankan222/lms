import AppError from "../../core/errors/AppError.js";

const FAST2SMS_OTP_URL = "https://www.fast2sms.com/dev/otp/send";

function isProductionEnvironment() {
  return String(process.env.NODE_ENV || "").trim().toLowerCase() === "production";
}

function allowNonProductionSms() {
  return String(process.env.SMS_ALLOW_NON_PRODUCTION || "").trim().toLowerCase() === "true";
}

function requireConfig(name) {
  const value = process.env[name];
  if (!value) {
    throw new AppError(`${name} is not configured`, 500);
  }
  return value;
}

export function getOtpSettings() {
  const expiryMinutes = Number(process.env.SMS_OTP_EXPIRY_MINUTES || 10);
  const otpLength = Number(process.env.SMS_OTP_LENGTH || 6);

  return {
    expiryMinutes: Number.isFinite(expiryMinutes) ? expiryMinutes : 10,
    otpLength: Number.isFinite(otpLength) ? otpLength : 6,
  };
}

export function resolveOtpTemplateId(roles = []) {
  const roleSet = new Set(roles);
  const templateByRole = [
    ["teacher", process.env.FAST2SMS_TEACHER_OTP_ID],
    ["parent", process.env.FAST2SMS_PARENT_OTP_ID],
    ["accounts", process.env.FAST2SMS_ACCOUNTS_OTP_ID],
    ["staff", process.env.FAST2SMS_STAFF_OTP_ID],
    ["admin", process.env.FAST2SMS_ADMIN_OTP_ID],
  ];

  for (const [roleName, templateId] of templateByRole) {
    if (roleSet.has(roleName)) {
      if (!templateId) {
        throw new AppError(`OTP template is not configured for ${roleName}`, 500);
      }
      return { roleName, templateId };
    }
  }

  const defaultTemplateId = process.env.FAST2SMS_DEFAULT_OTP_ID;
  if (!defaultTemplateId) {
    throw new AppError("FAST2SMS_DEFAULT_OTP_ID is not configured", 500);
  }

  return {
    roleName: roleSet.has("super_admin") ? "super_admin" : roles[0] || "user",
    templateId: defaultTemplateId,
  };
}

export async function sendOtpSms({ phone, otp, templateId }) {
  if (!isProductionEnvironment() && !allowNonProductionSms()) {
    return {
      return: true,
      skipped: true,
      reason: "sms_disabled_outside_production",
    };
  }

  if (String(process.env.SMS_PROVIDER || "fast2sms").toLowerCase() !== "fast2sms") {
    throw new AppError("SMS_PROVIDER must be fast2sms", 500);
  }

  const apiKey = requireConfig("SMS_API_KEY");
  const { expiryMinutes, otpLength } = getOtpSettings();

  const response = await fetch(FAST2SMS_OTP_URL, {
    method: "POST",
    headers: {
      authorization: apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      mobile: phone,
      otp_id: templateId,
      otp_expiry: expiryMinutes,
      otp_length: otpLength,
      otp,
      variables_values: otp,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  const message = payload?.message || payload?.error || payload?.return || "Could not send OTP";

  if (!response.ok || payload?.return === false) {
    throw new AppError(Array.isArray(message) ? message.join(", ") : String(message), response.status || 502);
  }

  return payload;
}
