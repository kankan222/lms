import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const ACTIONS = [
  { label: "Add Student", path: "/students" },
  { label: "Add Teacher", path: "/teachers" },
  { label: "Create Exam", path: "/exams" },
  { label: "Mark Attendance", path: "/attendance" },
  { label: "Send Announcement", path: "/messaging" }
];

export default function QuickActions() {
  const navigate = useNavigate();

  return (
    <article className="rounded-xl border bg-card p-4 shadow-sm">
      <h3 className="font-semibold">Quick Actions</h3>
      <div className="mt-3 flex flex-wrap gap-2">
        {ACTIONS.map((action) => (
          <Button
            key={action.label}
            variant="outline"
            onClick={() => navigate(action.path)}
          >
            {action.label}
          </Button>
        ))}
      </div>
    </article>
  );
}
