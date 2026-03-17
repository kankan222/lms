import { useAuth } from "./useAuth";

const rolePermissionFallbacks = {
  teacher: [
    "marks.enter",
    "marks.view",
    "teacher.view",
    "attendance.take",
    "subjects.view",
    "messages.view",
    "messages.send",
  ],
  parent: [
    "student.view",
    "fee.view",
    "marks.view",
    "messages.view",
    "messages.send",
  ],
  accounts: [
    "payment.view",
    "payment.create",
    "payment.update",
    "payment.delete",
    "messages.view",
    "messages.send",
  ],
  staff: [
    "staff.view",
    "marks.view",
    "marks.approve",
    "messages.view",
    "messages.send",
  ],
};

export function usePermissions() {

  const { user } = useAuth();

  function can(permission) {
    // Super admin fallback: allow all modules even if local permission cache is stale.
    if (user?.email === "admin@kkv.com" || user?.username === "admin") {
      return true;
    }

    if (user?.permissions?.includes(permission)) {
      return true;
    }

    const roles = Array.isArray(user?.roles) ? user.roles : [];
    return roles.some((role) => rolePermissionFallbacks[role]?.includes(permission));
  }

  function hasRole(roleName) {
    return user?.roles?.includes(roleName);
  }

  return { can, hasRole, user };
}
