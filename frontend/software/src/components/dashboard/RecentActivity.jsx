function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

export default function RecentActivity({ activities = [] }) {
  return (
    <article className="rounded-xl border bg-card p-4 shadow-sm">
      <h3 className="font-semibold">Recent Activity</h3>
      <div className="mt-3 space-y-3">
        {activities.length === 0 && (
          <p className="text-sm text-muted-foreground">No recent activities.</p>
        )}

        {activities.map((item) => (
          <div key={item.id} className="rounded-lg border p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium text-sm">{item.action || "Activity"}</p>
              <p className="text-xs text-muted-foreground">{formatDateTime(item.created_at)}</p>
            </div>
            <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
            <p className="text-xs text-muted-foreground mt-1">By: {item.actor || "-"}</p>
          </div>
        ))}
      </div>
    </article>
  );
}
