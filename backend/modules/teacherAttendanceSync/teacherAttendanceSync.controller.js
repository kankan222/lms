import AppError from "../../core/errors/AppError.js";
import * as service from "./teacherAttendanceSync.service.js";

function readSyncKeyFromRequest(req) {
  const fromHeader = String(req.headers["x-sync-key"] || "").trim();
  if (fromHeader) return fromHeader;

  const auth = String(req.headers.authorization || "").trim();
  if (auth.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }

  return String(req.query?.sync_key || "").trim();
}

function assertSyncAuthorized(req) {
  const expected = String(process.env.ATTENDANCE_SYNC_SHARED_KEY || "").trim();
  if (!expected) {
    throw new AppError("ATTENDANCE_SYNC_SHARED_KEY is not configured", 503);
  }

  const provided = readSyncKeyFromRequest(req);
  if (!provided || provided !== expected) {
    throw new AppError("Unauthorized sync request", 401);
  }
}

export async function ingestTeacherAttendanceLogs(req, res, next) {
  try {
    assertSyncAuthorized(req);

    const result = await service.ingestAttendanceLogs({
      siteId: req.body?.siteId ?? req.body?.site_id,
      records: req.body?.records ?? req.body?.items ?? [],
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

