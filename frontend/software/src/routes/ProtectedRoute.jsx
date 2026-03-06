import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import {Spinner} from "@/components/ui/spinner"

export default function ProtectedRoute({ children }) {

  const { user , loading } = useAuth();
  if (loading) {
    return <Spinner />; // or a spinner
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}