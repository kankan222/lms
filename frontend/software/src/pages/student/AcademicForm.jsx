import { useEffect, useEffectEvent, useState } from "react";
import { Label } from "@/components/ui/label";
import { Field, FieldGroup } from "@/components/ui/field";

import { getSessions, getClassStructure } from "../../api/academic.api";

const STREAM_OPTIONS = [
  { value: "Arts", label: "Arts" },
  { value: "Commerce", label: "Commerce" },
  { value: "Science", label: "Science" },
];

export default function AcademicForm({ update, errors = {} }) {
  const [sessions, setSessions] = useState([]);
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState("");

  async function loadAcademicData() {
    const sessionRes = await getSessions();
    const classRes = await getClassStructure();

    setSessions(sessionRes.data);
    setClasses(classRes.data || []);
  }

  const loadInitialAcademicData = useEffectEvent(() => {
    loadAcademicData();
  });

  useEffect(() => {
    loadInitialAcademicData();
  }, []);

  const selectedClass = classes.find((c) => String(c.id) === String(classId));
  const sections = selectedClass?.sections || [];
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const selectedSection = sections.find((s) => String(s.id) === String(selectedSectionId));

  return (
    <div>
      <h3 className="font-medium mb-5">Academic Details</h3>
      <FieldGroup className="grid grid-cols-2 gap-3">
        <Field>
          <Label>Academic Session</Label>

          <select
            required
            className="border rounded p-2 w-full"
            onChange={(e) => update("enrollment", "session_id", e.target.value)}
          >
            <option value="">Select Session</option>

            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          {errors.session_id && <p className="text-xs text-red-500">{errors.session_id}</p>}
        </Field>

        <Field>
          <Label>Class *</Label>

          <select
            required
            className="border rounded p-2 w-full"
            value={classId}
            onChange={(e) => {
              setClassId(e.target.value);
              setSelectedSectionId("");
              update("enrollment", "class_id", e.target.value);
              update("enrollment", "section_id", "");
              update("enrollment", "medium", "");
              update("enrollment", "stream", "");
              update("enrollment", "stream_id", "");
            }}
          >
            <option value="">Select Class</option>

            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {errors.class_id && <p className="text-xs text-red-500">{errors.class_id}</p>}
        </Field>

        <Field>
          <Label>Section *</Label>

          <select
            required
            className="border rounded p-2 w-full"
            disabled={!classId}
            onChange={(e) => {
              const value = e.target.value;
              setSelectedSectionId(value);
              update("enrollment", "section_id", value);
              const section = sections.find((s) => String(s.id) === String(value));
              const sectionMedium = String(section?.medium || "").trim();
              update("enrollment", "medium", sectionMedium);
            }}
          >
            <option value="">Select Section</option>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}{s.medium ? ` (${s.medium})` : ""}
              </option>
            ))}

          </select>
          {errors.section_id && <p className="text-xs text-red-500">{errors.section_id}</p>}
          {selectedSection?.medium && (
            <p className="text-xs text-muted-foreground">Medium: {selectedSection.medium}</p>
          )}
          {errors.medium && <p className="text-xs text-red-500">{errors.medium}</p>}
        </Field>

        {selectedClass?.class_scope === "hs" ? (
          <Field>
            <Label>Stream *</Label>

            <select
              required
              className="border rounded p-2 w-full"
              onChange={(e) => {
                update("enrollment", "stream", e.target.value);
                update("enrollment", "stream_id", "");
              }}
            >
              <option value="">Select Stream</option>
              {STREAM_OPTIONS.map((stream) => (
                <option key={stream.value} value={stream.value}>
                  {stream.label}
                </option>
              ))}
            </select>
            {errors.stream && <p className="text-xs text-red-500">{errors.stream}</p>}
          </Field>
        ) : null}

        <Field>
          <Label>Roll Number *</Label>

          <input
            required
            className="border rounded p-2 w-full"
            onChange={(e) =>
              update("enrollment", "roll_number", e.target.value)
            }
          />
          {errors.roll_number && <p className="text-xs text-red-500">{errors.roll_number}</p>}
        </Field>
      </FieldGroup>
    </div>
  );
}
