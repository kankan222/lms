import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useState, useEffect } from "react";

import { getClasses } from "../../api/academic.api";
export default function StudentSelector({ onSelect }) {

  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [students, setStudents] = useState([]);

  const [classId, setClassId] = useState(null);
  const [section, setSection] = useState(null);

  useEffect(() => {
    loadClasses();
  }, []);

  useEffect(() => {
    if (!classId || !section) return;

    fetch(`/api/v1/students?class_id=${classId}&section=${section}`)
      .then(r => r.json())
      .then(setStudents);

  }, [classId, section]);
 async function loadClasses() {
    const res = await getClasses();
    console.log("Classes Api", res.data)
    setClasses(res.data);
  }
  return (
    <div className="grid grid-cols-3 gap-4">

      <Select onValueChange={setClassId}>
        <SelectTrigger>
          <SelectValue placeholder="Select Class" />
        </SelectTrigger>

        <SelectContent>
          {classes.map(c => (
            <SelectItem key={c.id} value={String(c.id)}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select onValueChange={setSection}>
        <SelectTrigger>
          <SelectValue placeholder="Select Section" />
        </SelectTrigger>

        <SelectContent>
          <SelectItem value="A">A</SelectItem>
          <SelectItem value="B">B</SelectItem>
          <SelectItem value="C">C</SelectItem>
        </SelectContent>
      </Select>

      <Select onValueChange={onSelect}>
        <SelectTrigger>
          <SelectValue placeholder="Select Student" />
        </SelectTrigger>

        <SelectContent>
          {students.map(s => (
            <SelectItem key={s.id} value={String(s.id)}>
              {s.first_name} {s.last_name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

    </div>
  );
}