import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useEffect, useEffectEvent, useMemo, useState } from "react";

import { getClasses } from "../../api/academic.api";
export default function StudentSelector({ onSelect }) {

  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);

  const [classId, setClassId] = useState(null);
  const [section, setSection] = useState(null);

  async function loadClasses() {
    const res = await getClasses();
    setClasses(res.data);
  }

  const selectedClass = useMemo(
    () => classes.find((item) => String(item.id) === String(classId)),
    [classes, classId]
  );
  const sections = selectedClass?.section_details || [];

  const loadInitialClasses = useEffectEvent(() => {
    loadClasses();
  });

  const loadScopedStudents = useEffectEvent(() => {
    if (!classId || !section) return;

    fetch(`/api/v1/students?class_id=${classId}&section_id=${section}`)
      .then((r) => r.json())
      .then((payload) => setStudents(Array.isArray(payload?.data) ? payload.data : payload));
  });

  useEffect(() => {
    loadInitialClasses();
  }, []);

  useEffect(() => {
    loadScopedStudents();
  }, [classId, section]);

  return (
    <div className="grid grid-cols-3 gap-4">

      <Select onValueChange={setClassId}>
        <SelectTrigger>
          <SelectValue placeholder="Select Class" />
        </SelectTrigger>

        <SelectContent>
          {classes.map(c => (
            <SelectItem key={c.id} value={String(c.id)}>
              {c.name}{c.medium ? ` (${c.medium})` : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select onValueChange={setSection}>
        <SelectTrigger>
          <SelectValue placeholder="Select Section" />
        </SelectTrigger>

        <SelectContent>
          {sections.map((item) => (
            <SelectItem key={item.name} value={String(item.id || item.name)}>
              {item.name}{item.medium ? ` (${item.medium})` : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select onValueChange={onSelect}>
        <SelectTrigger>
          <SelectValue placeholder="Select Student" />
        </SelectTrigger>

        <SelectContent>
          {students.map(s => (
            <SelectItem key={s.id} value={String(s.id)}>
              {s.name || `${s.first_name || ""} ${s.last_name || ""}`.trim()}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

    </div>
  );
}
