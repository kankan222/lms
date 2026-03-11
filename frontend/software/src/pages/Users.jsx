import { useEffect, useMemo, useState } from "react";
import TopBar from "../components/TopBar";
import DataTable from "../components/DataTable";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { getClassStructure } from "../api/academic.api";
import { getUsers, updateUserStatus } from "../api/users.api";

const ROLE_FILTERS = [
  { label: "All", value: "" },
  { label: "Teachers", value: "teacher" },
  { label: "Parents", value: "parent" },
  { label: "Accounts", value: "accounts" },
  { label: "Staff", value: "staff" }
];

const STATUS_FILTERS = [
  { label: "All Status", value: "" },
  { label: "Active", value: "active" },
  { label: "Inactive", value: "inactive" }
];

const columns = [
  { header: "User ID", accessor: "id" },
  { header: "Name", accessor: "name" },
  { header: "Email", accessor: "email" },
  { header: "Phone", accessor: "phone" },
  { header: "Role", accessor: "roles" },
  { header: "Parent Class", accessor: "parent_classes" },
  { header: "Parent Section", accessor: "parent_sections" },
  { header: "Status", accessor: "status" }
];

export default function Users() {
  const [users, setUsers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(5);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 5,
    total: 0,
    totalPages: 1
  });

  const selectedClass = useMemo(
    () => classes.find((c) => String(c.id) === String(classId)),
    [classes, classId]
  );
  const sections = selectedClass?.sections || [];

  useEffect(() => {
    loadClasses();
  }, []);

  useEffect(() => {
    loadUsers();
  }, [role, status, classId, sectionId, page, limit]);

  async function loadClasses() {
    const res = await getClassStructure();
    setClasses(res?.data || []);
  }

  async function loadUsers() {
    const res = await getUsers({
      page,
      limit,
      role: role || undefined,
      status: status || undefined,
      class_id: role === "parent" ? classId || undefined : undefined,
      section_id: role === "parent" ? sectionId || undefined : undefined
    });

    const rows = (res?.data || []).map((row) => ({
      ...row,
      name: row.teacher_name || row.parent_name || row.username || "-",
      email: row.email || "-",
      phone: row.phone || "-",
      roles: row.roles || "-",
      parent_classes: row.parent_classes || "-",
      parent_sections: row.parent_sections || "-"
    }));
    setUsers(rows);
    setPagination(
      res?.pagination || {
        page: 1,
        limit,
        total: rows.length,
        totalPages: 1
      }
    );
  }

  async function toggleStatus(row) {
    const nextStatus = row.status === "active" ? "inactive" : "active";
    const ok = window.confirm(
      `Set user #${row.id} status to ${nextStatus}?`
    );
    if (!ok) return;

    await updateUserStatus(row.id, nextStatus);
    await loadUsers();
  }

  return (
    <>
      <TopBar title="Users" subTitle="View all users and manage account status" />

      <div className="mb-4 grid gap-3 rounded-xl border bg-card p-4 md:grid-cols-2">
        <div className="grid gap-1.5">
          <Label>User Category</Label>
          <select
            className="border rounded-md px-3 py-2 bg-background"
            value={role}
            onChange={(e) => {
              setRole(e.target.value);
              setClassId("");
              setSectionId("");
              setPage(1);
            }}
          >
            {ROLE_FILTERS.map((item) => (
              <option key={item.value || "all"} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-1.5">
          <Label>Status</Label>
          <select
            className="border rounded-md px-3 py-2 bg-background"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            {STATUS_FILTERS.map((item) => (
              <option key={item.value || "all-status"} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-1.5">
          <Label>Parent Class</Label>
          <select
            className="border rounded-md px-3 py-2 bg-background"
            value={classId}
            disabled={role !== "parent"}
            onChange={(e) => {
              setClassId(e.target.value);
              setSectionId("");
              setPage(1);
            }}
          >
            <option value="">All Classes</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}{c.medium ? ` (${c.medium})` : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-1.5">
          <Label>Parent Section</Label>
          <select
            className="border rounded-md px-3 py-2 bg-background"
            value={sectionId}
            disabled={role !== "parent" || !classId}
            onChange={(e) => {
              setSectionId(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Sections</option>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={users}
        rowsPerPageOptions={[5, 10, 20, 50]}
        paginationMode="server"
        page={pagination.page}
        totalPages={pagination.totalPages}
        totalRows={pagination.total}
        rowsPerPage={pagination.limit}
        onPageChange={setPage}
        onRowsPerPageChange={(nextLimit) => {
          setLimit(nextLimit);
          setPage(1);
        }}
        renderActions={(row) => (
          <Button
            size="sm"
            variant={row.status === "active" ? "destructive" : "outline"}
            onClick={(e) => {
              e.stopPropagation();
              toggleStatus(row);
            }}
          >
            {row.status === "active" ? "Deactivate" : "Activate"}
          </Button>
        )}
      />
    </>
  );
}
