import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import TopBar from "../../components/TopBar";
import { usePermissions } from "../../hooks/usePermissions";

import {
  getTeacher,
  getTeacherAssignments,
  getTeacherAttendance,
  assignTeacher,
  removeAssignment,
} from "../../api/teachers.api";

import { getClassStructure, getSessions } from "../../api/academic.api";
import { changePassword, adminResetPassword } from "../../api/users.api";

import {
  Phone,
  Mail,
  IdCard,
  BookPlus,
  Eye,
  EyeOff,
  Trash2,
  Pencil,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function TeacherDetails() {
  const { id } = useParams();
  const { can } = usePermissions();
  const canManageTeachers = can("teacher.update");

  const [teacher, setTeacher] = useState(null);
  const [classes, setClasses] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [attendance, setAttendance] = useState([]);

  const [selectedSection, setSelectedSection] = useState("");
  const [selectedSession, setSelectedSession] = useState("");
  const [selectedSubjects, setSelectedSubjects] = useState([]);

  const [sessions, setSessions] = useState([]);


  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);

  const [showPassword, setShowPassword] = useState(false);

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [currentPage, setCurrentPage] = useState(1);

  const rowsPerPage = 10;

  function isHsClassName(name) {
    const value = String(name || "").trim().toLowerCase();
    if (!value) return false;
    if (value.includes("higher secondary")) return true;
    if (/\bhs\b/.test(value)) return true;
    if (/\b(11|12|xi|xii)\b/.test(value)) return true;
    if (value.includes("1st year") || value.includes("2nd year")) return true;
    return false;
  }

  function matchesScope(className, scope) {
    const hs = isHsClassName(className);
    return scope === "hs" ? hs : !hs;
  }

  const scopedClasses = classes.filter((cls) =>
    matchesScope(cls.name, teacher?.class_scope || "school")
  );

  useEffect(() => {
    loadTeacher();
  }, [id]);

  async function loadTeacher() {
    const teacherRes = await getTeacher(id);
    const assignmentRes = await getTeacherAssignments(id);
    const attendanceRes = await getTeacherAttendance(id);

    const sessionRes = await getSessions();
    const classesRes = await getClassStructure();

    setTeacher(teacherRes.data);
    setAssignments(assignmentRes.data);
    setAttendance(attendanceRes.data || []);
    setClasses(classesRes.data || []);
    setSessions(sessionRes.data || []);
    console.log(classesRes.data);
    console.log(attendanceRes.data);
    console.log(sessionRes.data);
  }

  if (!teacher) return <div>Loading...</div>;

  async function handleAssignSubjects() {
    if (!selectedSection) {
    alert("Select section");
    return;
  }

  if (!selectedSession) {
    alert("Select session");
    return;
  }
    await Promise.all(
      selectedSubjects.map((value) => {
        const [classId, subjectId] = value.split("-");

        return assignTeacher(id, {
          class_id: classId,
          subject_id: subjectId,
          section_id: selectedSection,
          session_id: selectedSession,
        });
      }),
    );

    const updated = await getTeacherAssignments(id);

    setAssignments(updated.data || [])
    setSelectedSubjects([])
    setAssignDialogOpen(false);
  }

  async function handleRemoveAssignment(assignmentId) {
    if (!confirm("Remove this assignment?")) return;

    await removeAssignment(assignmentId);

    setAssignments((prev) => prev.filter((a) => a.id !== assignmentId));
  }

  async function handlePasswordChange() {

  if (!passwordForm.newPassword) {
    alert("Enter new password");
    return;
  }

  if (passwordForm.newPassword !== passwordForm.confirmPassword) {
    alert("Passwords do not match");
    return;
  }

  const res = await adminResetPassword({
    user_id: teacher.user_id,
    new_password: passwordForm.newPassword
  });

  if (res?.success) {
    alert("Password updated successfully");
  }
  setPasswordForm({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });

  setPasswordDialogOpen(false);

}

  const totalPages = Math.ceil(attendance.length / rowsPerPage);

  const paginatedAttendance = attendance.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage,
  );
  return (
    <>
      <TopBar title="Teacher Information" />
      <div className="w-full bg-card rounded-xl border shadow-sm p-6 flex gap-6 items-start">
        {/* Avatar */}
        <div className="w-24 h-24 rounded-lg overflow-hidden bg-pink-200 shrink-0">
          {teacher.photo_url && (
            <img
              src={`http://localhost:5000${teacher.photo_url}`}
              alt={teacher.name}
              className="w-full h-full object-cover"
            />
          )}
        </div>

        {/* Content */}
        <div className="flex-1">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-semibold text-foreground">
                {teacher.name}
              </h2>
              {/* Meta Info */}
              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 mt-1">
                <span className="flex items-center gap-1">
                  <IdCard size={16} /> {teacher.employee_id}
                </span>

                <span className="flex items-center gap-1">
                  <Phone size={16} />
                  {teacher.phone}
                </span>

                <span className="flex items-center gap-1">
                  <Mail size={16} /> {teacher.email}
                </span>
                <span className="flex items-center gap-1">
                  Scope: {teacher.class_scope === "hs" ? "Higher Secondary" : "School"}
                </span>
              </div>
                <p className="flex items-center gap-1">
                  <BookPlus size={16} /> Assigned Classes :
                  {assignments.map((a) => (
                    <span
                      key={a.id}
                      className="px-2 py-1 text-xs rounded bg-muted flex items-center gap-1"
                    >
                      {a.class} - {a.section} - {a.subject}
                      <Trash2
                        size={16}
                        className="cursor-pointer text-red-500"
                        onClick={() => handleRemoveAssignment(a.id)}
                      />
                    </span>
                  ))}
                </p>
            </div>

            {/* Actions */}
            {canManageTeachers ? (
            <div className="flex gap-2">
              <Dialog
                open={assignDialogOpen}
                onOpenChange={setAssignDialogOpen}
              >
                <DialogTrigger asChild>
                  <Button variant="outline">Assign Subject</Button>
                </DialogTrigger>

                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Assign Subjects</DialogTitle>
                  </DialogHeader>

                  <div className="space-y-3 max-h-60 overflow-y-auto">
                    {scopedClasses.map((cls) => (
                      <div
                        key={cls.id}
                        className="border rounded-md p-3 flex items-center gap-2 flex-wrap"
                      >
                        <div className="font-medium w-full">{cls.name}</div>

                        <select
                          className="border rounded p-1 mt-2"
                          value={selectedSection}
                          onChange={(e) => setSelectedSection(e.target.value)}
                        >
                          <option value="">Select section</option>

                          {cls.sections.map((sec) => (
                            <option key={`${cls.id}-${sec.id}`} value={sec.id}>
                              {sec.name}{sec.medium ? ` (${sec.medium})` : ""}
                            </option>
                          ))}
                        </select>

                        {cls.subjects.map((sub) => {
                          const value = `${cls.id}-${sub.id}`;

                          return (
                            <div
                              key={`${cls.id}-${sub.id}`}
                              className="flex items-center gap-2 mt-1"
                            >
                              <Checkbox
                                checked={selectedSubjects.includes(value)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setSelectedSubjects((prev) => [
                                      ...prev,
                                      value,
                                    ]);
                                  } else {
                                    setSelectedSubjects((prev) =>
                                      prev.filter((v) => v !== value),
                                    );
                                  }
                                }}
                              />

                              <span>{sub.name}</span>
                            </div>
                          );
                        })}
                      </div>
                    ))}

                    <div className="mb-4 grid gap-1.5">
                      <Label>Academic Session</Label>

                      <select
                        className="w-full border rounded-md p-2"
                        value={selectedSession}
                        onChange={(e) => setSelectedSession(e.target.value)}
                      >
                        <option value="">Select session</option>

                        {sessions.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <Button onClick={handleAssignSubjects}>
                    Save Assignments
                  </Button>
                </DialogContent>
              </Dialog>

              <Dialog
                open={passwordDialogOpen}
                onOpenChange={setPasswordDialogOpen}
              >
                <DialogTrigger asChild>
                  <Button variant="outline">Change Password</Button>
                </DialogTrigger>

                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Change Password</DialogTitle>
                  </DialogHeader>

                  <div className="space-y-4">
                    <div className="grid gap-2 mb-2">
                      <Label>New Password</Label>
                      <Input
                        type="password"
                        value={passwordForm.newPassword}
                        onChange={(e) =>
                          setPasswordForm((prev) => ({
                            ...prev,
                            newPassword: e.target.value,
                          }))
                        }
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label>Confirm Password</Label>
                      <Input
                        type="password"
                        value={passwordForm.confirmPassword}
                        onChange={(e) =>
                          setPasswordForm((prev) => ({
                            ...prev,
                            confirmPassword: e.target.value,
                          }))
                        }
                      />
                    </div>

                    <Button onClick={handlePasswordChange}>
                      Update Password
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            ) : null}
          </div>
        </div>
      </div>
      <div className="mt-5">
        <h3 className="text-lg font-semibold">Attendance</h3>
        <Table>
          <TableCaption>A list of your recent attendance</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Check In</TableHead>
              <TableHead>Check Out</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Device</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedAttendance.map((attendance) => (
              <TableRow key={attendance.id}>
                <TableCell className="font-medium">
                  {attendance.attendance_date}
                </TableCell>
                <TableCell>{attendance.check_in}</TableCell>
                <TableCell>{attendance.check_out}</TableCell>
                <TableCell>{attendance.status}</TableCell>
                <TableCell>{attendance.worked_hours}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={5}>
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={() =>
                          setCurrentPage((p) => Math.max(p - 1, 1))
                        }
                      />
                    </PaginationItem>

                    {Array.from({ length: totalPages }).map((_, i) => (
                      <PaginationItem key={i}>
                        <PaginationLink
                          isActive={currentPage === i + 1}
                          onClick={() => setCurrentPage(i + 1)}
                        >
                          {i + 1}
                        </PaginationLink>
                      </PaginationItem>
                    ))}

                    <PaginationItem>
                      <PaginationNext
                        onClick={() =>
                          setCurrentPage((p) => Math.min(p + 1, totalPages))
                        }
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>
    </>
  );
}
