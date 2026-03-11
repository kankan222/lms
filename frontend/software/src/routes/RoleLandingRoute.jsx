import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { Spinner } from "@/components/ui/spinner";
import { getDefaultLandingPath } from "../utils/defaultLanding";

export default function RoleLandingRoute() {
  const { user, loading } = useAuth();

  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;

  return <Navigate to={getDefaultLandingPath(user)} replace />;
}
