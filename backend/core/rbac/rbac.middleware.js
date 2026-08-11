import { loadPermissions, loadRoles }
from "./rbac.service.js";
export async function attachPermissions(
  req,
  res,
  next
) {
  try {
    if (!req.user?.userId) {
      return res.status(401).json({
        message: "Unauthorized"
      });
    }

    const [permissions, roles] =
      await Promise.all([
        loadPermissions(req.user.userId),
        loadRoles(req.user.userId)
      ]);
      req.user.permissions = permissions;
      req.user.roles = roles;
      next();

      
    } catch (err) {
      next(err);
    }
  }
  
  export function requirePermission(permission) {
    
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          message: "Unauthorized"
        });
      }

    const roles = Array.isArray(req.user.roles) ? req.user.roles : [];
    const isSuperAdmin = roles.some((role) => {
      const normalized = String(role || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
      return normalized === "super_admin" || normalized === "superadmin";
    });

    if (!isSuperAdmin && (!req.user.permissions || !req.user.permissions.includes(permission))) {
      return res.status(403).json({
        message: "Forbidden"
      });
    }

    next();
  };
}
