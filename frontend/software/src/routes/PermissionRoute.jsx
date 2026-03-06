import { Navigate } from "react-router-dom";
import { usePermissions } from "../hooks/usePermissions";

export default function PermissionRoute({ permission, children }) {

  const { can } = usePermissions();

  if (!can(permission)) {
    return <Navigate to="/unauthorized" />;
  }

  return children;
}