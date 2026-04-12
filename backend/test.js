import express from 'express';
import { query } from './core/db/query.js';
import { logTeacherAttendance } from './modules/teachers/teacher.service.js';

const app = express();

app.use(express.raw({ type: 'application/octet-stream', limit: '5mb' }));
app.use(express.text({ type: 'text/*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

let queuedCommand = null;

const teacherIdCache = new Map();
const deviceIdCache = new Map();
const recentEventCache = new Map();
const RECENT_TTL_MS = 10 * 60 * 1000;

function readBodyText(body) {
  if (Buffer.isBuffer(body)) return body.toString('utf8');
  if (typeof body === 'string') return body;
  if (body && typeof body === 'object') return JSON.stringify(body);
  return '';
}

function parseDevicePayload(bodyText) {
  const start = bodyText.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < bodyText.length; i += 1) {
    const ch = bodyText[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === '{') {
      depth += 1;
      continue;
    }

    if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        const jsonPart = bodyText.slice(start, i + 1);
        try {
          return JSON.parse(jsonPart);
        } catch {
          return null;
        }
      }
    }
  }

  return null;
}

function getDeviceUserId(payload) {
  return String(payload?.user_id || payload?.PIN || payload?.UserID || '').trim();
}

function formatDeviceDateTime(value) {
  const raw = String(value || '').trim();
  if (!/^\d{14}$/.test(raw)) return null;

  const yyyy = raw.slice(0, 4);
  const mm = raw.slice(4, 6);
  const dd = raw.slice(6, 8);
  const hh = raw.slice(8, 10);
  const mi = raw.slice(10, 12);
  const ss = raw.slice(12, 14);

  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

function normalizeGlogEvent(req, payload) {
  const deviceCode = String(req.headers['dev_id'] || '').trim() || null;
  const deviceUserId = getDeviceUserId(payload);
  const punchTime = formatDeviceDateTime(payload?.io_time);

  if (!deviceUserId || !punchTime) return null;

  return {
    deviceCode,
    deviceUserId,
    punchTime,
    // Keep unknown until io_mode mapping is confirmed from controlled IN/OUT tests.
    punchType: 'unknown',
    ioMode: payload?.io_mode ?? null,
    verifyMode: payload?.verify_mode ?? null,
  };
}

function pruneRecentEventCache(now) {
  for (const [key, lastSeen] of recentEventCache.entries()) {
    if (now - lastSeen > RECENT_TTL_MS) {
      recentEventCache.delete(key);
    }
  }
}

function hasRecentDuplicate(eventKey) {
  const now = Date.now();
  pruneRecentEventCache(now);

  const lastSeen = recentEventCache.get(eventKey);
  if (lastSeen && now - lastSeen <= RECENT_TTL_MS) {
    return true;
  }

  recentEventCache.set(eventKey, now);
  return false;
}

async function getTeacherIdForDeviceUser(deviceUserId) {
  if (teacherIdCache.has(deviceUserId)) {
    return teacherIdCache.get(deviceUserId);
  }

  let rows = await query(
    `
      SELECT id
      FROM teachers
      WHERE employee_id = ?
      LIMIT 1
    `,
    [deviceUserId]
  );

  if (!rows.length && /^\d+$/.test(deviceUserId)) {
    rows = await query(
      `
        SELECT id
        FROM teachers
        WHERE id = ?
        LIMIT 1
      `,
      [Number(deviceUserId)]
    );
  }

  const teacherId = rows.length ? Number(rows[0].id) : null;
  if (teacherId) {
    teacherIdCache.set(deviceUserId, teacherId);
  }
  return teacherId;
}

async function getDeviceIdByCode(deviceCode) {
  if (!deviceCode) return null;

  if (deviceIdCache.has(deviceCode)) {
    return deviceIdCache.get(deviceCode);
  }

  const rows = await query(
    `
      SELECT id
      FROM attendance_devices
      WHERE device_code = ?
      LIMIT 1
    `,
    [deviceCode]
  );

  const deviceId = rows.length ? Number(rows[0].id) : null;
  if (deviceId) {
    deviceIdCache.set(deviceCode, deviceId);
  }

  return deviceId;
}

async function attendanceAlreadyLogged({ teacherId, deviceId, punchTime }) {
  const rows = await query(
    `
      SELECT id
      FROM teacher_attendance_logs
      WHERE teacher_id = ?
        AND device_id <=> ?
        AND punch_time = ?
      LIMIT 1
    `,
    [teacherId, deviceId, punchTime]
  );

  return rows.length > 0;
}

// DEVICE POLLING
app.get('/iclock/cdata', (req, res) => {
  if (queuedCommand) {
    const commandToSend = queuedCommand;
    queuedCommand = null;
    return res.type('text/plain').send(commandToSend);
  }

  return res.type('text/plain').send('OK');
});

// DEVICE SENDING DATA
app.post('/iclock/cdata', async (req, res) => {
  const requestCode = String(req.headers['request_code'] || '').trim().toLowerCase();
  const bodyText = readBodyText(req.body);
  const payload = parseDevicePayload(bodyText);

  try {
    if (requestCode === 'realtime_glog') {
      const event = normalizeGlogEvent(req, payload);

      if (!event) {
        console.log('ATTENDANCE EVENT INVALID:', { requestCode, payload });
        return res.type('text/plain').send('OK');
      }

      const eventKey = `${event.deviceCode || 'unknown'}|${event.deviceUserId}|${event.punchTime}`;

      if (hasRecentDuplicate(eventKey)) {
        console.log('DUPLICATE (MEMORY) SKIPPED:', eventKey);
        return res.type('text/plain').send('OK');
      }

      const teacherId = await getTeacherIdForDeviceUser(event.deviceUserId);
      if (!teacherId) {
        console.log('NO TEACHER MAPPING:', {
          deviceUserId: event.deviceUserId,
          hint: 'Set teachers.employee_id = device user_id (or matching teacher id fallback).',
        });
        return res.type('text/plain').send('OK');
      }

      const deviceId = await getDeviceIdByCode(event.deviceCode);
      if (!deviceId) {
        console.log('NO DEVICE MAPPING:', {
          deviceCode: event.deviceCode,
          hint: 'Create attendance_devices row with matching device_code, or keep null device_id.',
        });
      }

      const exists = await attendanceAlreadyLogged({
        teacherId,
        deviceId,
        punchTime: event.punchTime,
      });

      if (exists) {
        console.log('DUPLICATE (DB) SKIPPED:', {
          teacherId,
          deviceId,
          punchTime: event.punchTime,
        });
        return res.type('text/plain').send('OK');
      }

      await logTeacherAttendance({
        teacherId,
        deviceId,
        punchTime: event.punchTime,
        punchType: event.punchType,
      });

      console.log('ATTENDANCE STORED:', {
        teacherId,
        deviceId,
        punchTime: event.punchTime,
        punchType: event.punchType,
        ioMode: event.ioMode,
        verifyMode: event.verifyMode,
      });
    } else if (requestCode === 'realtime_enroll_data') {
      console.log('ENROLLMENT PACKET:', {
        requestCode,
        deviceCode: req.headers['dev_id'] || null,
        userId: getDeviceUserId(payload),
      });
    } else if (requestCode === 'receive_cmd') {
      console.log('HEARTBEAT PACKET:', {
        requestCode,
        deviceCode: req.headers['dev_id'] || null,
        deviceTime: payload?.fk_time || null,
      });
    } else {
      console.log('OTHER PACKET:', {
        requestCode: requestCode || 'unknown',
        deviceCode: req.headers['dev_id'] || null,
        hasPayload: Boolean(payload),
      });
    }
  } catch (error) {
    console.error('DEVICE HANDLER ERROR:', error.message || error);
  }

  return res.type('text/plain').send('OK');
});

// TEST HELPER: queue a one-time command for next device poll
app.post('/test/queue-command', (req, res) => {
  const command = String(req.body?.command || req.query?.command || '').trim();

  if (!command) {
    return res.status(400).json({
      success: false,
      message: 'command is required',
    });
  }

  queuedCommand = command;
  return res.json({
    success: true,
    queuedCommand,
  });
});

app.get('/test/queue-command', (req, res) => {
  return res.json({
    success: true,
    queuedCommand,
  });
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
