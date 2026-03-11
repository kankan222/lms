import * as authService from "./auth.service.js";

function normalizePhone(rawPhone) {
  if (!rawPhone) return undefined;
  const compact = rawPhone.trim().replace(/[^\d+]/g, "");
  if (!compact) return undefined;
  if (compact.startsWith("+")) {
    return `+${compact.slice(1).replace(/\D/g, "")}`;
  }
  return compact.replace(/\D/g, "");
}

export async function login(req, res, next) {
  try {
    const { email, phone, identifier, password } = req.body;
    const normalizedIdentifier = identifier?.trim();
    const resolvedEmail =
      email?.trim() ||
      (normalizedIdentifier?.includes("@")
        ? normalizedIdentifier
        : undefined);
    const resolvedPhone =
      normalizePhone(phone) ||
      (!normalizedIdentifier?.includes("@")
        ? normalizePhone(normalizedIdentifier)
        : undefined);

    const result = await authService.login(
      {
        email: resolvedEmail,
        phone: resolvedPhone,
        password
      },
      {
        deviceId: req.headers["x-device-id"],
        deviceType: req.headers["x-device-type"],
        ip: req.ip ?? null
      }
    );

    res.json({
      success: true,
      data: result
    });

  } catch (err) {
    next(err);
  }
}
export async function refresh(req, res, next) {
  try {

    const { refreshToken } = req.body;

    const tokens =
      await authService.refresh(refreshToken);

    res.json({
      success: true,
      data: tokens
    });

  } catch (err) {
    next(err);
  }
}
export async function logout(req, res, next) {
  try {

    await authService.logout(req.user.sessionId);

    res.json({ success: true });

  } catch (err) {
    next(err);
  }
}

export async function logoutAll(req, res, next) {
  try {

    await authService.logoutAll(req.user.userId);

    res.json({ success: true });

  } catch (err) {
    next(err);
  }
}
