import bcrypt from "bcrypt";
import { execute, query } from "../../core/db/query.js";

const ROLES = [
  "super_admin",
  "teacher",
  "student",
  "parent",
  "accounts",
  "staff",
];

const PERMISSIONS = [
  "dashboard.view",
  "academic.view",
  "academic.create",
  "academic.update",
  "academic.delete",
  "attendance.take",
  "student_attendance.take",
  "student_attendance.view",
  "student_attendance.review",
  "student_attendance.notify",
  "subjects.view",
  "subjects.create",
  "subjects.update",
  "subjects.delete",
  "subjects.assign",
  "classSubjects.view",
  "parent.create",
  "parent.view",
  "student.create",
  "student.view",
  "student.update",
  "student.delete",
  "teacher.create",
  "teacher.view",
  "teacher.update",
  "teacher.delete",
  "teacher.assign",
  "staff.view",
  "fee.view",
  "fee.create",
  "fee.update",
  "fee.delete",
  "payment.view",
  "payment.create",
  "payment.update",
  "payment.delete",
  "exams.create",
  "exams.view",
  "exams.update",
  "exams.delete",
  "marks.enter",
  "marks.view",
  "marks.approve",
  "messages.view",
  "messages.send",
  "notifications.view",
];

const ROLE_PERMISSION_MAP = {
  super_admin: PERMISSIONS,
  teacher: ["marks.enter", "marks.view", "teacher.view", "attendance.take", "student_attendance.take", "student_attendance.view", "subjects.view", "exams.view", "messages.view", "messages.send"],
  student: [],
  parent: ["student.view", "student_attendance.view", "fee.view", "marks.view", "messages.view", "messages.send"],
  accounts: ["payment.view", "payment.create", "payment.update", "payment.delete", "messages.view", "messages.send"],
  staff: ["staff.view", "exams.create", "exams.view", "exams.update", "exams.delete", "marks.view", "marks.approve", "student_attendance.view", "student_attendance.review", "student_attendance.notify", "messages.view", "messages.send"],
};

const USERS = [
  {
    role: "super_admin",
    username: "admin",
    email: "admin@kkv.com",
    phone: null,
    password: "Admin@KKV147",
    status: "active",
  },
  {
    role: "accounts",
    username: "accounts.ronit",
    email: "ronit.mehta@kkv.edu.in",
    phone: "9001002001",
    password: "Accounts@KKV147",
    status: "active",
  },
  {
    role: "staff",
    username: "staff.nandita",
    email: "nandita.sen@kkv.edu.in",
    phone: "9001002002",
    password: "Staff@KKV147",
    status: "active",
  },
  {
    role: "teacher",
    username: "teacher.ananya",
    email: "ananya.sharma@kkv.edu.in",
    phone: "9001003001",
    password: "Teacher@KKV147",
    status: "active",
    teacherProfile: {
      employee_id: "TCH-1001",
      name: "Ananya Sharma",
      class_scope: "school",
    },
  },
  {
    role: "parent",
    username: "parent.rahul",
    email: "rahul.bora@gmail.com",
    phone: "9001004001",
    password: "Parent@KKV147",
    status: "active",
    parentProfile: {
      name: "Rahul Bora",
      qualification: null,
      occupation: null,
      class_scope: "school",
    },
  },
];

async function hasColumn(tableName, columnName) {
  const rows = await query(
    `
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
      LIMIT 1
    `,
    [tableName, columnName]
  );

  return rows.length > 0;
}

async function ensureRoles() {
  for (const role of ROLES) {
    await execute("INSERT IGNORE INTO roles(name) VALUES (?)", [role]);
  }
}

async function ensurePermissions() {
  for (const permission of PERMISSIONS) {
    await execute("INSERT IGNORE INTO permissions(name) VALUES (?)", [permission]);
  }
}

async function getRoleIdByName(roleName) {
  const rows = await query("SELECT id FROM roles WHERE name = ? LIMIT 1", [roleName]);
  return rows[0]?.id || null;
}

async function getPermissionIdByName(permissionName) {
  const rows = await query("SELECT id FROM permissions WHERE name = ? LIMIT 1", [permissionName]);
  return rows[0]?.id || null;
}

async function syncRolePermissions() {
  for (const roleName of Object.keys(ROLE_PERMISSION_MAP)) {
    const roleId = await getRoleIdByName(roleName);
    if (!roleId) {
      throw new Error(`Missing role: ${roleName}`);
    }

    await execute("DELETE FROM role_permissions WHERE role_id = ?", [roleId]);

    for (const permissionName of ROLE_PERMISSION_MAP[roleName]) {
      const permissionId = await getPermissionIdByName(permissionName);
      if (!permissionId) {
        throw new Error(`Missing permission: ${permissionName}`);
      }

      await execute(
        "INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)",
        [roleId, permissionId]
      );
    }
  }
}

async function getUserByIdentity({ username, email, phone }) {
  const rows = await query(
    `
      SELECT id, username, email, phone
      FROM users
      WHERE username = ? OR email = ? OR phone = ?
      ORDER BY id
      LIMIT 1
    `,
    [username || null, email || null, phone || null]
  );

  return rows[0] || null;
}

async function upsertUser(user) {
  const passwordHash = await bcrypt.hash(user.password, 10);
  const existing = await getUserByIdentity(user);

  if (existing) {
    await execute(
      `
        UPDATE users
        SET username = ?,
            email = ?,
            phone = ?,
            password_hash = ?,
            status = ?
        WHERE id = ?
      `,
      [user.username || null, user.email || null, user.phone || null, passwordHash, user.status || "active", existing.id]
    );

    return existing.id;
  }

  const result = await execute(
    `
      INSERT INTO users (username, email, phone, password_hash, status)
      VALUES (?, ?, ?, ?, ?)
    `,
    [user.username || null, user.email || null, user.phone || null, passwordHash, user.status || "active"]
  );

  return result.insertId;
}

async function assignRole(userId, roleName) {
  const roleId = await getRoleIdByName(roleName);
  if (!roleId) {
    throw new Error(`Missing role: ${roleName}`);
  }

  await execute("INSERT IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)", [userId, roleId]);
}

async function ensureTeacherProfile(userId, profile = {}) {
  const existing = await query("SELECT id FROM teachers WHERE user_id = ? LIMIT 1", [userId]);
  const teacherHasScope = await hasColumn("teachers", "class_scope");

  if (existing.length) {
    if (teacherHasScope) {
      await execute(
        `
          UPDATE teachers
          SET employee_id = ?,
              name = ?,
              phone = ?,
              email = ?,
              class_scope = ?,
              photo_url = NULL
          WHERE user_id = ?
        `,
        [
          profile.employee_id || null,
          profile.name || null,
          profile.phone || null,
          profile.email || null,
          profile.class_scope || "school",
          userId,
        ]
      );
      return;
    }

    await execute(
      `
        UPDATE teachers
        SET employee_id = ?,
            name = ?,
            phone = ?,
            email = ?,
            photo_url = NULL
        WHERE user_id = ?
      `,
      [profile.employee_id || null, profile.name || null, profile.phone || null, profile.email || null, userId]
    );
    return;
  }

  if (teacherHasScope) {
    await execute(
      `
        INSERT INTO teachers (user_id, employee_id, name, phone, email, class_scope, photo_url)
        VALUES (?, ?, ?, ?, ?, ?, NULL)
      `,
      [
        userId,
        profile.employee_id || null,
        profile.name || null,
        profile.phone || null,
        profile.email || null,
        profile.class_scope || "school",
      ]
    );
    return;
  }

  await execute(
    `
      INSERT INTO teachers (user_id, employee_id, name, phone, email, photo_url)
      VALUES (?, ?, ?, ?, ?, NULL)
    `,
    [userId, profile.employee_id || null, profile.name || null, profile.phone || null, profile.email || null]
  );
}

async function ensureParentProfile(userId, profile = {}) {
  const existing = await query("SELECT id FROM parents WHERE user_id = ? LIMIT 1", [userId]);
  const parentHasScope = await hasColumn("parents", "class_scope");

  if (existing.length) {
    if (parentHasScope) {
      await execute(
        `
          UPDATE parents
          SET name = ?,
              qualification = ?,
              occupation = ?,
              mobile = ?,
              email = ?,
              class_scope = ?
          WHERE user_id = ?
        `,
        [
          profile.name || null,
          profile.qualification || null,
          profile.occupation || null,
          profile.mobile || null,
          profile.email || null,
          profile.class_scope || "school",
          userId,
        ]
      );
      return;
    }

    await execute(
      `
        UPDATE parents
        SET name = ?,
            qualification = ?,
            occupation = ?,
            mobile = ?,
            email = ?
        WHERE user_id = ?
      `,
      [
        profile.name || null,
        profile.qualification || null,
        profile.occupation || null,
        profile.mobile || null,
        profile.email || null,
        userId,
      ]
    );
    return;
  }

  if (parentHasScope) {
    await execute(
      `
        INSERT INTO parents (user_id, name, qualification, occupation, mobile, email, class_scope, address_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, NULL)
      `,
      [
        userId,
        profile.name || null,
        profile.qualification || null,
        profile.occupation || null,
        profile.mobile || null,
        profile.email || null,
        profile.class_scope || "school",
      ]
    );
    return;
  }

  await execute(
    `
      INSERT INTO parents (user_id, name, qualification, occupation, mobile, email, address_id)
      VALUES (?, ?, ?, ?, ?, ?, NULL)
    `,
    [
      userId,
      profile.name || null,
      profile.qualification || null,
      profile.occupation || null,
      profile.mobile || null,
      profile.email || null,
    ]
  );
}

async function seedUsers() {
  for (const user of USERS) {
    const userId = await upsertUser(user);
    await assignRole(userId, user.role);

    if (user.teacherProfile) {
      await ensureTeacherProfile(userId, {
        ...user.teacherProfile,
        phone: user.phone || null,
        email: user.email || null,
      });
    }

    if (user.parentProfile) {
      await ensureParentProfile(userId, {
        ...user.parentProfile,
        mobile: user.phone || null,
        email: user.email || null,
      });
    }
  }
}

async function seed() {
  console.log("Seeding users, roles, and permissions...");

  await ensureRoles();
  await ensurePermissions();
  await syncRolePermissions();
  await seedUsers();

  console.log("Seed complete.");
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
