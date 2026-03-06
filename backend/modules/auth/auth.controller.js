import * as authService from "./auth.service.js";

export async function login(req, res, next) {
  try {
const { email, username, identifier, password } = req.body;
console.log("Login body", req.body)
    const result = await authService.login(
       {
        identifier: identifier || email || username,
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