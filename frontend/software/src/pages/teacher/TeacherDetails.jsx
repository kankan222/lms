import { useEffect, useEffectEvent, useState } from "react";
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
import { adminResetPassword } from "../../api/users.api";

import {
  Phone,
  Mail,
  IdCard,
  BookPlus,
  LayoutList,
  Trash2,
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
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resolveServerImageUrl } from "../../lib/serverImage";
import { formatReadableDate, formatReadableDateTime } from "../../lib/dateTime";

export default function TeacherDetails() {
  const { id } = useParams();
  const { can } = usePermissions();
  const canManageTeachers = can("teacher.update");

  const [teacher, setTeacher] = useState(null);
  const [classes, setClasses] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [attendance, setAttendance] = useState([]);

  const [selectedSections, setSelectedSections] = useState([]);
  const [selectedSession, setSelectedSession] = useState("");
  const [selectedSubjects, setSelectedSubjects] = useState([]);

  const [sessions, setSessions] = useState([]);


  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [assignmentError, setAssignmentError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [feedbackDialog, setFeedbackDialog] = useState({
    open: false,
    title: "",
    message: "",
  });
  const [assignmentToRemove, setAssignmentToRemove] = useState(null);

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [currentPage, setCurrentPage] = useState(1);

  const rowsPerPage = 10;

  function deriveAssignmentSelections(sourceAssignments, sessionId) {
    const normalizedSessionId = String(sessionId || "");
    const scopedAssignments = normalizedSessionId
      ? sourceAssignments.filter((assignment) => String(assignment.session_id) === normalizedSessionId)
      : sourceAssignments;

    return {
      sections: Array.from(
        new Set(
          scopedAssignments
            .filter((assignment) => assignment.class_id && assignment.section_id)
            .map((assignment) => `${assignment.class_id}-${assignment.section_id}`),
        ),
      ),
      subjects: Array.from(
        new Set(
          scopedAssignments
            .filter((assignment) => assignment.class_id && assignment.subject_id)
            .map((assignment) => `${assignment.class_id}-${assignment.subject_id}`),
        ),
      ),
    };
  }

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

  const assignedClassSections = Array.from(
    new Map(
      assignments.map((assignment) => [
        `${assignment.class}-${assignment.section}`,
        {
          key: `${assignment.class}-${assignment.section}`,
          className: assignment.class,
          sectionName: assignment.section,
        },
      ]),
    ).values(),
  );

  const assignedSubjects = Array.from(
    new Map(
      assignments.map((assignment) => [
        assignment.subject,
        {
          key: assignment.subject,
          subjectName: assignment.subject,
        },
      ]),
    ).values(),
  );

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
  }

  const loadTeacherDetails = useEffectEvent(() => {
    loadTeacher();
  });

  useEffect(() => {
    loadTeacherDetails();
  }, [id]);

  if (!teacher) return <div>Loading...</div>;

  async function handleAssignSubjects() {
    if (!selectedSubjects.length) {
      setAssignmentError("Select at least one subject.");
      return;
    }

    if (!selectedSections.length) {
      setAssignmentError("Select at least one section.");
      return;
    }

    if (!selectedSession) {
      setAssignmentError("Select an academic session.");
      return;
    }

    setAssignmentError("");

    const assignmentPayloads = selectedSubjects.flatMap((value) => {
      const [classId, subjectId] = value.split("-");
      const matchingSections = selectedSections
        .map((sectionValue) => sectionValue.split("-"))
        .filter(([sectionClassId]) => sectionClassId === classId)
        .map(([, sectionId]) => sectionId);

      return matchingSections.map((sectionId) =>
        assignTeacher(id, {
          class_id: classId,
          subject_id: subjectId,
          section_id: sectionId,
          session_id: selectedSession,
        }),
      );
    });

    if (!assignmentPayloads.length) {
      setAssignmentError("Select sections for the chosen class subjects.");
      return;
    }

    await Promise.all(assignmentPayloads);

    const updated = await getTeacherAssignments(id);

    const updatedRows = updated.data || [];
    setAssignments(updatedRows);
    const nextSelections = deriveAssignmentSelections(updatedRows, selectedSession);
    setSelectedSubjects(nextSelections.subjects);
    setSelectedSections(nextSelections.sections);
    setAssignmentError("");
    setAssignDialogOpen(false);
  }

  async function handleRemoveAssignment() {
    if (!assignmentToRemove) return;

    await removeAssignment(assignmentToRemove.id);

    setAssignments((prev) => prev.filter((a) => a.id !== assignmentToRemove.id));
    setAssignmentToRemove(null);
  }

  async function handlePasswordChange() {

  if (!passwordForm.newPassword) {
    setPasswordError("Enter a new password.");
    return;
  }

  if (passwordForm.newPassword !== passwordForm.confirmPassword) {
    setPasswordError("Passwords do not match.");
    return;
  }

  setPasswordError("");

  const res = await adminResetPassword({
    user_id: teacher.user_id,
    new_password: passwordForm.newPassword
  });

  if (res?.success) {
    setFeedbackDialog({
      open: true,
      title: "Password Updated",
      message: "Password updated successfully.",
    });
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
              src={resolveServerImageUrl(teacher.photo_url)}
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
              <div className="mt-1 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
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
              <div className="mt-4 space-y-3">
                <div className="flex items-start gap-2">
                  <LayoutList size={16} className="mt-0.5 text-muted-foreground" />
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground">Assigned Classes & Sections</p>
                    <div className="flex flex-wrap gap-2">
                      {assignedClassSections.length ? (
                        assignedClassSections.map((item) => (
                          <span
                            key={item.key}
                            className="px-2 py-1 text-xs rounded bg-muted text-muted-foreground"
                          >
                            {item.className} - {item.sectionName}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">No class assignment yet</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <BookPlus size={16} className="mt-0.5 text-muted-foreground" />
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground">Assigned Subjects</p>
                    <div className="flex flex-wrap gap-2">
                      {assignedSubjects.length ? (
                        assignedSubjects.map((item) => (
                          <span
                            key={item.key}
                            className="px-2 py-1 text-xs rounded bg-muted text-muted-foreground"
                          >
                            {item.subjectName}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">No subject assignment yet</span>
                      )}
                    </div>
                  </div>
                </div>

                {assignments.length ? (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground">Manage Assignments</p>
                    <div className="flex flex-wrap gap-2">
                      {assignments.map((assignment) => (
                        <span
                          key={assignment.id}
                          className="px-2 py-1 text-xs rounded bg-muted flex items-center gap-1"
                        >
                          {assignment.class} - {assignment.section} - {assignment.subject}
                          <Trash2
                            size={16}
                            className="cursor-pointer text-red-500"
                            onClick={() => setAssignmentToRemove(assignment)}
                          />
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            {/* Actions */}
            {canManageTeachers ? (
            <div className="flex gap-2">
              <Dialog
                open={assignDialogOpen}
                onOpenChange={(open) => {
                  setAssignDialogOpen(open);
                  if (open) {
                    const nextSessionId =
                      assignments[0]?.session_id ||
                      sessions.find((session) => session.is_active)?.id ||
                      sessions[0]?.id ||
                      "";
                    const normalizedSessionId = String(nextSessionId || "");
                    const nextSelections = deriveAssignmentSelections(assignments, normalizedSessionId);
                    setSelectedSession(normalizedSessionId);
                    setSelectedSections(nextSelections.sections);
                    setSelectedSubjects(nextSelections.subjects);
                  }
                  if (!open) {
                    setAssignmentError("");
                    setSelectedSubjects([]);
                    setSelectedSections([]);
                    setSelectedSession("");
                  }
                }}
              >
                <DialogTrigger asChild>
                  <Button variant="outline">Assign</Button>
                </DialogTrigger>

                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Assign</DialogTitle>
                    {assignmentError ? (
                      <p className="text-sm text-red-600">{assignmentError}</p>
                    ) : null}
                  </DialogHeader>

                  <div className="space-y-3 max-h-60 overflow-y-auto">
                    {scopedClasses.map((cls) => (
                      <div
                        key={cls.id}
                        className="border rounded-md p-3 flex items-center gap-2 flex-wrap"
                      >
                        <div className="font-medium w-full">{cls.name}</div>
                        <div className="w-full space-y-2">
                          <p className="text-sm font-medium text-foreground">Sections</p>
                          <div className="flex flex-wrap gap-3">
                            {cls.sections.map((sec) => {
                              const sectionValue = `${cls.id}-${sec.id}`;
                              return (
                                <label
                                  key={`${cls.id}-${sec.id}`}
                                  className="flex items-center gap-2 text-sm text-muted-foreground"
                                >
                                  <Checkbox
                                    checked={selectedSections.includes(sectionValue)}
                                    onCheckedChange={(checked) => {
                                      if (checked) {
                                        setSelectedSections((prev) => [
                                          ...prev,
                                          sectionValue,
                                        ]);
                                      } else {
                                        setSelectedSections((prev) =>
                                          prev.filter((value) => value !== sectionValue),
                                        );
                                      }
                                    }}
                                  />
                                  <span>
                                    {sec.name}{sec.medium ? ` (${sec.medium})` : ""}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        </div>

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
                        onChange={(e) => {
                          const nextSessionId = e.target.value;
                          const nextSelections = deriveAssignmentSelections(assignments, nextSessionId);
                          setSelectedSession(nextSessionId);
                          setSelectedSections(nextSelections.sections);
                          setSelectedSubjects(nextSelections.subjects);
                        }}
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
                    Assign
                  </Button>
                </DialogContent>
              </Dialog>

              <Dialog
                open={passwordDialogOpen}
                onOpenChange={(open) => {
                  setPasswordDialogOpen(open);
                  if (!open) setPasswordError("");
                }}
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

                    {passwordError ? (
                      <p className="text-sm text-red-600">{passwordError}</p>
                    ) : null}

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
                  {formatReadableDate(attendance.attendance_date)}
                </TableCell>
                <TableCell>{formatReadableDateTime(attendance.check_in)}</TableCell>
                <TableCell>{formatReadableDateTime(attendance.check_out)}</TableCell>
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

      <AlertDialog
        open={Boolean(assignmentToRemove)}
        onOpenChange={(open) => {
          if (!open) setAssignmentToRemove(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove assignment?</AlertDialogTitle>
            <AlertDialogDescription>
              {assignmentToRemove
                ? `This will remove ${assignmentToRemove.class} - ${assignmentToRemove.section} - ${assignmentToRemove.subject} from the teacher.`
                : "This will remove the selected assignment."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleRemoveAssignment}>
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={feedbackDialog.open}
        onOpenChange={(open) => setFeedbackDialog((prev) => ({ ...prev, open }))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{feedbackDialog.title}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{feedbackDialog.message}</p>
          <Button onClick={() => setFeedbackDialog((prev) => ({ ...prev, open: false }))}>
            Close
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
