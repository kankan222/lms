function formatDate(value) {
  if (!value) return "TBD";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "TBD";
  return date.toLocaleDateString();
}

export default function UpcomingExams({ exams = [] }) {
  return (
    <article className="rounded-xl border bg-card p-4 shadow-sm h-full">
      <h3 className="font-semibold">Upcoming Exams</h3>
      <div className="mt-3 space-y-3">
        {exams.length === 0 && (
          <p className="text-sm text-muted-foreground">No upcoming exams found.</p>
        )}

        {exams.map((exam, idx) => (
          <div
            key={`${exam.id}-${exam.class_name || "na"}-${exam.section_name || "na"}-${idx}`}
            className="rounded-lg border p-3"
          >
            <p className="font-medium">{exam.exam_name}</p>
            <p className="text-sm text-muted-foreground">
              {exam.class_name || "-"} {exam.section_name ? `- ${exam.section_name}` : ""}
            </p>
            <p className="text-xs text-muted-foreground mt-1">{formatDate(exam.exam_date)}</p>
          </div>
        ))}
      </div>
    </article>
  );
}
