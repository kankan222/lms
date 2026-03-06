import { useEffect, useState } from "react";
import DataTable from "../components/DataTable";
import TopBar from "../components/TopBar";

import {
  getStudents,
  createStudent,
  updateStudent,
  deleteStudent,
} from "../api/students.api";

import { getClasses, getSessions } from "../api/academic.api";

import { Button } from "../components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const columns = [
  { header: "Admission No", accessor: "admission_no" },
  { header: "First Name", accessor: "first_name" },
  { header: "Last Name", accessor: "last_name" },
  { header: "DOB", accessor: "dob" },
  { header: "Gender", accessor: "gender" },
  { header: "Class", accessor: "class" },
  { header: "Section", accessor: "section" },
  { header: "Roll", accessor: "roll_number" },
  { header: "Status", accessor: "status" },
];

const Student = () => {
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [sessions, setSessions] = useState([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);

  const [newStudent, setNewStudent] = useState({
    admission_no: "",
    first_name: "",
    last_name: "",
    dob: "",
    gender: "",
    classId: "",
    sectionId: "",
    sessionId: "",
    rollNumber: "",
    status: "active",
  });

  useEffect(() => {
    loadStudents();
    loadClasses();
    loadSessions();
  }, []);

  function formatDate(date) {
    if (!date) return "";
    return new Date(date).toISOString().split("T")[0];
  }

  async function loadStudents() {
    const res = await getStudents();

    const formatted = res.data.map((s) => ({
      ...s,
      dob: formatDate(s.dob),
    }));

    setStudents(formatted);
  }

  async function loadClasses() {
    const res = await getClasses();
    console.log("Classes Api", res.data)
    setClasses(res.data);
  }
  async function loadSessions() {
    const res = await getSessions();
    setSessions(res.data);
  }
function handleClassChange(classId) {
  const selectedClass = classes.find(c => c.id == classId);

  let secs = selectedClass?.sections;

  if (typeof secs === "string") {
    secs = secs.split(",").map(s => ({
      id: s.trim(),
      name: s.trim()
    }));
  }

  setSections(secs || []);

  setNewStudent({
    ...newStudent,
    classId,
    sectionId: ""
  });
}
  async function handleCreate(e) {
    e.preventDefault();
    console.log("Sending", newStudent)
    await createStudent(newStudent);

    await loadStudents();

    setCreateOpen(false);
  }

  async function handleUpdate(e) {
    e.preventDefault();

    await updateStudent(editingStudent.id, editingStudent);

    await loadStudents();

    setEditingStudent(null);
  }

  async function handleDelete(row) {
    if (!confirm("Delete this student?")) return;

    await deleteStudent(row.id);

    setStudents((prev) => prev.filter((s) => s.id !== row.id));
  }

  function handleEdit(row) {
    const cls = classes.find((c) => c.name === row.class);
    setSections(cls?.sections || []);
    setEditingStudent(row);
  }

  return (
    <>
      <TopBar
        title="Students"
        subTitle="Find all student details here"
        action={
          <Sheet open={createOpen} onOpenChange={setCreateOpen}>
            <SheetTrigger asChild>
              <Button>Add Student</Button>
            </SheetTrigger>

            <SheetContent className="overflow-y-auto">
              <form onSubmit={handleCreate} className="px-4">
                <SheetHeader>
                  <SheetTitle>Add Student</SheetTitle>
                </SheetHeader>

                <div className="grid gap-3 py-4">
                  <Label>Admission No</Label>
                  <Input
                    value={newStudent.admission_no}
                    onChange={(e) =>
                      setNewStudent({
                        ...newStudent,
                        admission_no: e.target.value,
                      })
                    }
                  />

                  <Label>First Name</Label>
                  <Input
                    value={newStudent.first_name}
                    onChange={(e) =>
                      setNewStudent({
                        ...newStudent,
                        first_name: e.target.value,
                      })
                    }
                  />

                  <Label>Last Name</Label>
                  <Input
                    value={newStudent.last_name}
                    onChange={(e) =>
                      setNewStudent({
                        ...newStudent,
                        last_name: e.target.value,
                      })
                    }
                  />

                  <Label>DOB</Label>
                  <Input
                    type="date"
                    value={newStudent.dob}
                    onChange={(e) =>
                      setNewStudent({
                        ...newStudent,
                        dob: e.target.value,
                      })
                    }
                  />

                  <Label>Gender</Label>
                  <select
                    className="border rounded p-2 w-full"
                    value={newStudent.gender}
                    onChange={(e) =>
                      setNewStudent({
                        ...newStudent,
                        gender: e.target.value,
                      })
                    }
                  >
                    <option value="">Select</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>

                  <Label>Class</Label>
                  <select
                    className="border rounded p-2 w-full"
                    value={newStudent.classId}
                    onChange={(e) => handleClassChange(e.target.value)}
                  >
                    <option value="">Select Class</option>

                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>

                  <Label>Section</Label>
                  <select
                    className="border rounded p-2 w-full"
                    value={newStudent.sectionId}
                    onChange={(e) =>
                      setNewStudent({
                        ...newStudent,
                        sectionId: e.target.value,
                      })
                    }
                  >
                    <option value="">Select Section</option>

                    {Array.isArray(sections) && sections.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>

                  <Label>Academic Session</Label>
                  <select
                    className="border rounded p-2 w-full"
                    value={newStudent.sessionId}
                    onChange={(e) =>
                      setNewStudent({
                        ...newStudent,
                        sessionId: e.target.value,
                      })
                    }
                  >
                    <option value="">Select Session</option>

                    {sessions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>

                  <Label>Roll Number</Label>
                  <Input
                    value={newStudent.rollNumber}
                    onChange={(e) =>
                      setNewStudent({
                        ...newStudent,
                        rollNumber: e.target.value,
                      })
                    }
                  />

                  <Label>Status</Label>
                  <select
                    className="border rounded p-2 w-full"
                    value={newStudent.status}
                    onChange={(e) =>
                      setNewStudent({
                        ...newStudent,
                        status: e.target.value,
                      })
                    }
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>

                <SheetFooter>
                  <Button type="submit">Save</Button>
                </SheetFooter>
              </form>
            </SheetContent>
          </Sheet>
        }
      />

      <DataTable
        columns={columns}
        data={students}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      {/* EDIT FORM */}

      <Sheet
        open={!!editingStudent}
        onOpenChange={() => setEditingStudent(null)}
      >
        <SheetContent>
          <form onSubmit={handleUpdate}>
            <SheetHeader>
              <SheetTitle>Edit Student</SheetTitle>
            </SheetHeader>

            <div className="grid gap-3 py-4">
              <Label>Admission No</Label>
              <Input
                value={editingStudent?.admission_no || ""}
                onChange={(e) =>
                  setEditingStudent({
                    ...editingStudent,
                    admission_no: e.target.value,
                  })
                }
              />

              <Label>First Name</Label>
              <Input
                value={editingStudent?.first_name || ""}
                onChange={(e) =>
                  setEditingStudent({
                    ...editingStudent,
                    first_name: e.target.value,
                  })
                }
              />

              <Label>Last Name</Label>
              <Input
                value={editingStudent?.last_name || ""}
                onChange={(e) =>
                  setEditingStudent({
                    ...editingStudent,
                    last_name: e.target.value,
                  })
                }
              />

              <Label>DOB</Label>
              <Input
                type="date"
                value={formatDate(editingStudent?.dob)}
                onChange={(e) =>
                  setEditingStudent({
                    ...editingStudent,
                    dob: e.target.value,
                  })
                }
              />

              <Label>Gender</Label>
              <select
                className="border rounded p-2 w-full"
                value={editingStudent?.gender || ""}
                onChange={(e) =>
                  setEditingStudent({
                    ...editingStudent,
                    gender: e.target.value,
                  })
                }
              >
                <option value="">Select</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
              
            </div>
            

            <SheetFooter>
              <Button type="submit">Update</Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
};

export default Student;
