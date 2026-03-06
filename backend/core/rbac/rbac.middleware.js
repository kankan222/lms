import { loadPermissions }
from "./rbac.service.js";
export async function attachPermissions(
  req,
  res,
  next
) {
  try {

    const permissions =
      await loadPermissions(req.user.userId);

    req.user.permissions = permissions;

    next();

  } catch (err) {
    next(err);
  }
}

export function requirePermission(permission) {

  return (req, res, next) => {

    if (
      !req.user.permissions ||
      !req.user.permissions.includes(permission)
    ) {
      return res.status(403).json({
        message: "Forbidden"
      });
    }

    next();
  };
}