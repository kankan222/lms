import bcrypt from "bcrypt";
import { execute, query } from "../../core/db/query.js";

const REVIEWER_USERS = [
  {
    role: "super_admin",
    username: "review.admin",
    email: "review.admin@kkv.com",
    phone: "9001099001",
    password: "Review@KKV147",
    status: "active",
  },
  {
    role: "teacher",
    username: "review.teacher",
    email: "review.teacher@kkv.edu.in",
    phone: "9001099002",
    password: "ReviewTeacher@147",
    status: "active",
    teacherProfile: {
      employee_id: "RVW-TCH-001",
      name: "Review Teacher",
      class_scope: "school",
    },
  },
  {
    role: "parent",
    username: "review.parent",
    email: "review.parent@kkv.com",
    phone: "9001099003",
    password: "ReviewParent@147",
    status: "active",
    parentProfile: {
      name: "Review Parent",
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

async function getRoleIdByName(roleName) {
  const rows = await query("SELECT id FROM roles WHERE name = ? LIMIT 1", [roleName]);
  return rows[0]?.id || null;
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
      [
        user.username || null,
        user.email || null,
        user.phone || null,
        passwordHash,
        user.status || "active",
        existing.id,
      ]
    );

    return existing.id;
  }

  const result = await execute(
    `
      INSERT INTO users (username, email, phone, password_hash, status)
      VALUES (?, ?, ?, ?, ?)
    `,
    [
      user.username || null,
      user.email || null,
      user.phone || null,
      passwordHash,
      user.status || "active",
    ]
  );

  return result.insertId;
}

async function assignRole(userId, roleName) {
  const roleId = await getRoleIdByName(roleName);
  if (!roleId) {
    throw new Error(`Missing role: ${roleName}. Run admin.seeds.js first.`);
  }

  await execute("DELETE FROM user_roles WHERE user_id = ?", [userId]);
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

async function seedReviewerUsers() {
  for (const user of REVIEWER_USERS) {
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
  console.log("Seeding reviewer/test users...");
  await seedReviewerUsers();
  console.log("Reviewer/test seed complete.");
  console.log("Credentials:");
  for (const user of REVIEWER_USERS) {
    console.log(`- ${user.role}: ${user.email} / ${user.password}`);
  }
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
