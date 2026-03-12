import { useState } from "react";
import StudentBasicForm from "./BasicForm";
import AcademicForm from "./AcademicForm";
import ParentForm from "./ParentForm";

import { Button } from "@/components/ui/button";

export default function StudentForm({ onSubmit, errors = {} }) {

  const [formData, setFormData] = useState({
  student: {
    name: "",
    dob: "",
    gender: "",
    mobile: ""
  },
  enrollment: {
    session_id: "",
    class_id: "",
    section_id: "",
    medium: "",
    stream: "",
    stream_id: "",
    roll_number: ""
  },
  father: {},
  mother: {}
});

function update(section, field, value) {
  setFormData((prev) => ({
    ...prev,
    [section]: {
      ...prev[section],
      [field]: value
    }
  }));
}

  function handleSubmit(e) {
    e.preventDefault();
    onSubmit(formData);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      <StudentBasicForm update={update} errors={errors} />

      <AcademicForm update={update} errors={errors} />

      <ParentForm type="father" update={update} errors={errors} />

      <ParentForm type="mother" update={update} errors={errors} />

      <Button type="submit" className="w-full">
        Save Student
      </Button>

    </form>
  );
}
