export default function ClassOverview({ rows = [] }) {
  return (
    <article className="rounded-xl border bg-card p-4 shadow-sm">
      <h3 className="font-semibold">Class Overview</h3>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-muted-foreground">
              <th className="py-2 text-left font-medium">Class</th>
              <th className="py-2 text-left font-medium">Section</th>
              <th className="py-2 text-left font-medium">Students</th>
              <th className="py-2 text-left font-medium">Present Today</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td className="py-3 text-muted-foreground" colSpan={4}>
                  No class data available.
                </td>
              </tr>
            )}
            {rows.map((item) => (
              <tr key={`${item.class_id}-${item.section_id}`} className="border-b">
                <td className="py-2">{item.class_name}</td>
                <td className="py-2">{item.section_name}</td>
                <td className="py-2">{item.students}</td>
                <td className="py-2">{item.present_today}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}
