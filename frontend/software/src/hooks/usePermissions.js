import { useAuth } from "./useAuth";

export function usePermissions() {

  const { user } = useAuth();

  function can(permission) {
    return user?.permissions?.includes(permission);
  }

  return { can };
}