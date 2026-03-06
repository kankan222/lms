import { getPermissionsByUserId }
from "./rbac.repository.js";

const permissionCache = new Map();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

export async function loadPermissions(userId) {

  const cached = permissionCache.get(userId);

  if (cached && cached.expiry > Date.now()) {
    return cached.permissions;
  }

  const rows =
    await getPermissionsByUserId(userId);

  const permissions = rows.map(r => r.name);

  permissionCache.set(userId, {
    permissions,
    expiry: Date.now() + CACHE_TTL
  });

  return permissions;
}

export function clearPermissionCache(userId) {
  permissionCache.delete(userId);
}