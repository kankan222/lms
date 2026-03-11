import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function Unauthorized() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border bg-card p-6 text-center space-y-3">
        <h1 className="text-2xl font-semibold">Access Denied</h1>
        <p className="text-sm text-muted-foreground">
          You do not have permission to view this page.
        </p>
        <Button onClick={() => navigate("/")}>Go To Dashboard</Button>
      </div>
    </div>
  );
}
