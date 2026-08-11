import { getPermissionsByUserId, getRolesByUserId }
from "./rbac.repository.js";

const permissionCache = new Map();
const roleCache = new Map();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes
const rolePermissionFallbacks = {
  teacher: [
    "attendance.take",
    "marks.enter",
    "marks.view",
    "messages.view",
    "routines.view",
    "announcements.view",
    "subjects.view",
    "teacher.view",
  ],
};

export function applyRolePermissionFallbacks(permissions = [], roles = []) {
  const permissionSet = new Set(permissions);

  for (const role of roles) {
    for (const permission of rolePermissionFallbacks[role] || []) {
      permissionSet.add(permission);
    }
  }

  return [...permissionSet];
}

export async function loadPermissions(userId) {

  const cached = permissionCache.get(userId);

  if (cached && cached.expiry > Date.now()) {
    return cached.permissions;
  }

  const [permissionRows, roleRows] = await Promise.all([
    getPermissionsByUserId(userId),
    getRolesByUserId(userId)
  ]);

  const permissions = applyRolePermissionFallbacks(
    permissionRows.map(r => r.name),
    roleRows.map(r => r.name)
  );

  permissionCache.set(userId, {
    permissions,
    expiry: Date.now() + CACHE_TTL
  });

  return permissions;
}

export async function loadRoles(userId) {
  const cached = roleCache.get(userId);

  if (cached && cached.expiry > Date.now()) {
    return cached.roles;
  }

  const roleRows = await getRolesByUserId(userId);
  const roles = roleRows.map((row) => row.name);

  roleCache.set(userId, {
    roles,
    expiry: Date.now() + CACHE_TTL
  });

  return roles;
}

export function clearPermissionCache(userId) {
  permissionCache.delete(userId);
  roleCache.delete(userId);
}
