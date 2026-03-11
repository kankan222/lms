function ProgressRow({ label, value, total, colorClass }) {
  const safeTotal = Number(total || 0);
  const safeValue = Number(value || 0);
  const percentage = safeTotal > 0 ? Math.round((safeValue / safeTotal) * 100) : 0;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">
          {safeValue} ({percentage}%)
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted">
        <div
          className={`h-2 rounded-full ${colorClass}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

export default function AttendanceChart({ attendance }) {
  const student = attendance?.student || { present: 0, absent: 0, late: 0 };
  const teacher = attendance?.teacher || { present: 0, absent: 0 };

  const studentTotal = Number(student.present || 0) + Number(student.absent || 0) + Number(student.late || 0);
  const teacherTotal = Number(teacher.present || 0) + Number(teacher.absent || 0);

  return (
    <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <article className="rounded-xl border bg-card p-4 shadow-sm">
        <h3 className="font-semibold">Student Attendance Today</h3>
        <div className="mt-4 space-y-3">
          <ProgressRow label="Present" value={student.present} total={studentTotal} colorClass="bg-green-500" />
          <ProgressRow label="Absent" value={student.absent} total={studentTotal} colorClass="bg-red-500" />
          <ProgressRow label="Late" value={student.late} total={studentTotal} colorClass="bg-amber-500" />
        </div>
      </article>

      <article className="rounded-xl border bg-card p-4 shadow-sm">
        <h3 className="font-semibold">Teacher Attendance Today</h3>
        <div className="mt-4 space-y-3">
          <ProgressRow label="Present" value={teacher.present} total={teacherTotal} colorClass="bg-green-500" />
          <ProgressRow label="Absent" value={teacher.absent} total={teacherTotal} colorClass="bg-red-500" />
        </div>
      </article>
    </section>
  );
}
