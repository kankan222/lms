import { useAuth } from "./useAuth";

export function usePermissions() {

  const { user } = useAuth();

  function can(permission) {
    // Super admin fallback: allow all modules even if local permission cache is stale.
    if (user?.email === "admin@kkv.com" || user?.username === "admin") {
      return true;
    }

    return user?.permissions?.includes(permission);
  }

  function hasRole(roleName) {
    return user?.roles?.includes(roleName);
  }

  return { can, hasRole, user };
}
