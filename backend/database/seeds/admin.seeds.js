import bcrypt from "bcrypt";
import { query } from "../../core/db/query.js";

const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "Admin@KKV147"; // change anytime

async function seedAdmin() {

  console.log("🌱 Seeding Super Admin...");

  // hash password
  const passwordHash = await bcrypt.hash(
    ADMIN_PASSWORD,
    10
  );

  // check if admin exists
  const existing = await query(
    `SELECT id FROM users WHERE username=? LIMIT 1`,
    [ADMIN_USERNAME]
  );

  let userId;

  if (existing.length) {
    userId = existing[0].id;

    // update password safely
    await query(
      `UPDATE users SET password_hash=? WHERE id=?`,
      [passwordHash, userId]
    );

    console.log("✅ Admin password updated");
  } else {

    const result = await query(
      `INSERT INTO users
      (username, email, password_hash, status)
      VALUES (?, ?, ?, 'active')`,
      [
        ADMIN_USERNAME,
        "admin@system.local",
        passwordHash
      ]
    );

    userId = result.insertId;

    console.log("✅ Admin user created");
  }

  /* ---------- ROLE ---------- */

  const role = await query(
    `SELECT id FROM roles WHERE name='super_admin' LIMIT 1`
  );

  if (!role.length)
    throw new Error("super_admin role missing");

  const roleId = role[0].id;

  await query(
    `INSERT IGNORE INTO user_roles (user_id, role_id)
     VALUES (?, ?)`,
    [userId, roleId]
  );

  console.log("✅ Role assigned");

  /* ---------- PERMISSIONS ---------- */

  const permissions = await query(
    `SELECT id FROM permissions`
  );

  for (const perm of permissions) {
    await query(
      `INSERT IGNORE INTO role_permissions
       (role_id, permission_id)
       VALUES (?, ?)`,
      [roleId, perm.id]
    );
  }

  console.log("✅ Permissions assigned");

  console.log("🎉 Super Admin Ready");
}

seedAdmin()
  .then(() => process.exit())
  .catch(err => {
    console.error(err);
    process.exit(1);
  });