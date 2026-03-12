import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { getClassStructure } from "../../services/classesService";
import {
  changeMyPassword,
  createUser,
  getMyAccount,
  getPermissions,
  getUserPermissions,
  getUserRoles,
  getUsers,
  grantUserPermissions,
  updateUserStatus,
  type AccountProfile,
  type UserListItem,
} from "../../services/usersService";
import { useAuthStore } from "../../store/authStore";
import { formatDateLabel } from "../../utils/format";

const ROLE_FILTERS = [
  { label: "All", value: "" },
  { label: "Teachers", value: "teacher" },
  { label: "Parents", value: "parent" },
  { label: "Accounts", value: "accounts" },
  { label: "Staff", value: "staff" },
];

const STATUS_FILTERS = [
  { label: "All Status", value: "" },
  { label: "Active", value: "active" },
  { label: "Inactive", value: "inactive" },
];

const DEFAULT_ROLES = ["teacher", "student", "parent", "accounts", "staff"];

function normalizePermissionNames(payload: Array<{ name?: string } | string>) {
  return payload
    .map((item) => (typeof item === "string" ? item : item?.name || ""))
    .filter(Boolean);
}

function toTitleCase(value: string) {
  return String(value || "")
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function singularizeResource(resource: string) {
  if (!resource) return "";
  if (resource.endsWith("ies")) return `${resource.slice(0, -3)}y`;
  if (resource.endsWith("sses")) return resource;
  if (resource.endsWith("s")) return resource.slice(0, -1);
  return resource;
}

function formatPermissionLabel(permissionName: string) {
  const [resourcePart = "", actionPart = ""] = String(permissionName || "").split(".");
  const resource = toTitleCase(singularizeResource(resourcePart));
  const actionMap: Record<string, string> = {
    create: "Create",
    view: "View",
    update: "Update",
    delete: "Delete",
    enter: "Enter",
    approve: "Approve",
    take: "Take",
    send: "Send",
    manage: "Manage",
    reset: "Reset",
  };
  const action = actionMap[actionPart] || toTitleCase(actionPart);
  return [action, resource].filter(Boolean).join(" ");
}

function getErrorMessage(err: unknown, fallback: string) {
  if (
    typeof err === "object" &&
    err &&
    "response" in err &&
    typeof (err as { response?: { data?: { message?: string; error?: string } } }).response?.data
      ?.error === "string"
  ) {
    return (
      (err as { response?: { data?: { message?: string; error?: string } } }).response?.data?.error ||
      fallback
    );
  }
  if (
    typeof err === "object" &&
    err &&
    "response" in err &&
    typeof (err as { response?: { data?: { message?: string } } }).response?.data?.message === "string"
  ) {
    return (err as { response?: { data?: { message?: string } } }).response?.data?.message || fallback;
  }
  return fallback;
}

type SectionItem = {
  id: number;
  name: string;
};

type ClassItem = {
  id: number;
  name: string;
  medium?: string | null;
  sections: SectionItem[];
};

export default function ProfileTab() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const canManageUsers = Boolean(user?.permissions?.includes("teacher.update"));

  const [account, setAccount] = useState<AccountProfile | null>(null);
  const [accountLoading, setAccountLoading] = useState(true);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    current_password: "",
    new_password: "",
  });

  const [users, setUsers] = useState<UserListItem[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [roles, setRoles] = useState(DEFAULT_ROLES);
  const [allPermissions, setAllPermissions] = useState<string[]>([]);
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 5,
    total: 0,
    totalPages: 1,
  });
  const [loadingUsers, setLoadingUsers] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [grantingUser, setGrantingUser] = useState<UserListItem | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [createForm, setCreateForm] = useState({
    username: "",
    email: "",
    phone: "",
    password: "",
    status: "active",
    roles: [] as string[],
  });

  const selectedClass = useMemo(
    () => classes.find((c) => String(c.id) === String(classId)),
    [classes, classId]
  );
  const sections = selectedClass?.sections || [];
  const activeCount = users.filter((item) => item.status === "active").length;
  const inactiveCount = users.filter((item) => item.status === "inactive").length;

  useEffect(() => {
    loadAccount();
    if (canManageUsers) {
      loadClasses();
      loadReferenceData();
    }
  }, [canManageUsers]);

  useEffect(() => {
    if (!canManageUsers) return;
    loadUsers();
  }, [canManageUsers, role, status, classId, sectionId, page, search]);

  useEffect(() => {
    if (!grantingUser) return;
    loadPermissionDialog(grantingUser.id);
  }, [grantingUser]);

  async function loadAccount() {
    setAccountLoading(true);
    try {
      setAccount((await getMyAccount()) ?? null);
    } catch (err: unknown) {
      Alert.alert("Account unavailable", getErrorMessage(err, "Failed to load account."));
      setAccount(null);
    } finally {
      setAccountLoading(false);
    }
  }

  async function loadClasses() {
    try {
      const res = await getClassStructure();
      setClasses(res as ClassItem[]);
    } catch {
      setClasses([]);
    }
  }

  async function loadReferenceData() {
    try {
      const [roleRows, permissionRows] = await Promise.all([getUserRoles(), getPermissions()]);
      const dynamicRoles = roleRows
        .map((item) => item.name)
        .filter((item) => item && item !== "super_admin");
      if (dynamicRoles.length) setRoles(dynamicRoles);
      setAllPermissions(normalizePermissionNames(permissionRows));
    } catch {
      setRoles(DEFAULT_ROLES);
      setAllPermissions([]);
    }
  }

  async function loadUsers() {
    setLoadingUsers(true);
    try {
      const res = await getUsers({
        page,
        limit: pagination.limit,
        role: role || undefined,
        status: status || undefined,
        class_id: role === "parent" ? classId || undefined : undefined,
        section_id: role === "parent" ? sectionId || undefined : undefined,
        search: search || undefined,
      });
      setUsers(res.data);
      setPagination(res.pagination);
    } catch (err: unknown) {
      Alert.alert("Users unavailable", getErrorMessage(err, "Failed to load users."));
      setUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  }

  async function loadPermissionDialog(userId: number) {
    try {
      const granted = await getUserPermissions(userId);
      setSelectedPermissions(normalizePermissionNames(granted));
    } catch (err: unknown) {
      Alert.alert("Permissions unavailable", getErrorMessage(err, "Failed to load permissions."));
      setSelectedPermissions([]);
    }
  }

  function resetCreateForm() {
    setCreateForm({
      username: "",
      email: "",
      phone: "",
      password: "",
      status: "active",
      roles: [],
    });
  }

  function toggleRoleSelection(roleName: string) {
    setCreateForm((prev) => ({
      ...prev,
      roles: prev.roles.includes(roleName)
        ? prev.roles.filter((item) => item !== roleName)
        : [...prev.roles, roleName],
    }));
  }

  function togglePermissionSelection(permissionName: string) {
    setSelectedPermissions((prev) =>
      prev.includes(permissionName)
        ? prev.filter((item) => item !== permissionName)
        : [...prev, permissionName]
    );
  }

  async function handleCreateUser() {
    if (!createForm.password.trim()) {
      Alert.alert("Validation", "Password is required.");
      return;
    }
    if (!createForm.email.trim() && !createForm.phone.trim()) {
      Alert.alert("Validation", "Enter either email or phone for login.");
      return;
    }
    if (!createForm.roles.length) {
      Alert.alert("Validation", "Select at least one role.");
      return;
    }

    try {
      await createUser({
        username: createForm.username.trim() || null,
        email: createForm.email.trim() || null,
        phone: createForm.phone.trim() || null,
        password: createForm.password,
        status: createForm.status,
        roles: createForm.roles,
      });
      setCreateOpen(false);
      resetCreateForm();
      await loadUsers();
      Alert.alert("User created", "User account created successfully.");
    } catch (err: unknown) {
      Alert.alert("Create failed", getErrorMessage(err, "Failed to create user."));
    }
  }

  async function handleGrantPermissions() {
    if (!grantingUser?.id) return;
    try {
      await grantUserPermissions(grantingUser.id, selectedPermissions);
      setGrantingUser(null);
      Alert.alert("Permissions updated", "Direct permissions saved successfully.");
    } catch (err: unknown) {
      Alert.alert("Update failed", getErrorMessage(err, "Failed to grant permissions."));
    }
  }

  function confirmStatusUpdate(row: UserListItem) {
    const nextStatus = row.status === "active" ? "inactive" : "active";
    Alert.alert(
      nextStatus === "inactive" ? "Deactivate user?" : "Activate user?",
      `Change user #${row.id} status to ${nextStatus}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: async () => {
            try {
              await updateUserStatus(row.id, nextStatus);
              await loadUsers();
              Alert.alert("User updated", `User status changed to ${nextStatus}.`);
            } catch (err: unknown) {
              Alert.alert("Update failed", getErrorMessage(err, "Failed to update user status."));
            }
          },
        },
      ]
    );
  }

  async function handleChangePassword() {
    if (!passwordForm.current_password || !passwordForm.new_password) {
      Alert.alert("Validation", "Current password and new password are required.");
      return;
    }
    setPasswordSaving(true);
    try {
      await changeMyPassword(passwordForm);
      setPasswordOpen(false);
      setPasswordForm({ current_password: "", new_password: "" });
      Alert.alert("Password changed", "Your password was updated successfully.");
    } catch (err: unknown) {
      Alert.alert("Update failed", getErrorMessage(err, "Failed to change password."));
    } finally {
      setPasswordSaving(false);
    }
  }

  const visibleUsers = users.map((row) => ({
    ...row,
    display_name: row.teacher_name || row.parent_name || row.username || "-",
    roles_display: row.roles || "-",
    email_display: row.email || "-",
    phone_display: row.phone || "-",
    parent_classes_display: row.parent_classes || "-",
    parent_sections_display: row.parent_sections || "-",
  }));

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>My Account</Text>
        {accountLoading ? (
          <ActivityIndicator size="small" color="#0f172a" />
        ) : (
          <>
            <InfoRow label="Name" value={account?.name || user?.name || "-"} />
            <InfoRow label="Email" value={account?.email || user?.email || "-"} />
            <InfoRow label="Phone" value={account?.phone || "-"} />
            <InfoRow label="Roles" value={(account?.roles || user?.roles || []).join(", ") || "-"} />
            <InfoRow label="Status" value={account?.status || "-"} />
            <InfoRow label="Created" value={formatDateLabel(account?.created_at)} />
          </>
        )}

        <View style={styles.actionRow}>
          <Pressable style={styles.secondaryBtn} onPress={() => setPasswordOpen(true)}>
            <Text style={styles.secondaryBtnText}>Change Password</Text>
          </Pressable>
          <Pressable style={styles.deleteBtn} onPress={() => logout()}>
            <Text style={styles.deleteBtnText}>Logout</Text>
          </Pressable>
        </View>
      </View>

      {canManageUsers ? (
        <>
          <View style={styles.card}>
            <View style={styles.headerRow}>
              <View style={styles.headerCopy}>
                <Text style={styles.sectionTitle}>Users</Text>
                <Text style={styles.muted}>View all users, create accounts, and manage direct permissions.</Text>
              </View>
              <Pressable
                style={styles.primaryBtn}
                onPress={() => {
                  resetCreateForm();
                  setCreateOpen(true);
                }}
              >
                <Text style={styles.primaryBtnText}>Add User</Text>
              </Pressable>
            </View>

            <FilterGroup
              label="User Category"
              options={ROLE_FILTERS}
              value={role}
              onChange={(value) => {
                setRole(value);
                setClassId("");
                setSectionId("");
                setPage(1);
              }}
            />

            <FilterGroup
              label="Status"
              options={STATUS_FILTERS}
              value={status}
              onChange={(value) => {
                setStatus(value);
                setPage(1);
              }}
            />

            <Text style={styles.inputLabel}>Search</Text>
            <TextInput
              style={styles.input}
              placeholder="Search username, email, or phone"
              value={search}
              onChangeText={(value) => {
                setSearch(value);
                setPage(1);
              }}
            />

            <FilterGroup
              label="Parent Class"
              options={[
                { label: "All Classes", value: "" },
                ...classes.map((item) => ({
                  label: `${item.name}${item.medium ? ` (${item.medium})` : ""}`,
                  value: String(item.id),
                })),
              ]}
              value={classId}
              onChange={(value) => {
                setClassId(value);
                setSectionId("");
                setPage(1);
              }}
              disabled={role !== "parent"}
            />

            <FilterGroup
              label="Parent Section"
              options={[
                { label: "All Sections", value: "" },
                ...sections.map((item) => ({
                  label: item.name,
                  value: String(item.id),
                })),
              ]}
              value={sectionId}
              onChange={(value) => {
                setSectionId(value);
                setPage(1);
              }}
              disabled={role !== "parent" || !classId}
            />

            <Pressable
              style={styles.secondaryBtn}
              onPress={() => {
                setRole("");
                setStatus("");
                setClassId("");
                setSectionId("");
                setSearch("");
                setPage(1);
              }}
            >
              <Text style={styles.secondaryBtnText}>Reset Filters</Text>
            </Pressable>
          </View>

          <View style={styles.summaryGrid}>
            <SummaryCard label="Visible Users" value={pagination.total} />
            <SummaryCard label="Active On Page" value={activeCount} />
            <SummaryCard label="Inactive On Page" value={inactiveCount} />
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>User Directory</Text>
            <Text style={styles.muted}>Manage status, direct permissions, and account records from one list.</Text>

            {loadingUsers ? (
              <ActivityIndicator size="small" color="#0f172a" />
            ) : visibleUsers.length ? (
              visibleUsers.map((row) => (
                <View key={row.id} style={styles.userCard}>
                  <View style={styles.headerRow}>
                    <View style={styles.headerCopy}>
                      <Text style={styles.userName}>{row.display_name}</Text>
                      <Text style={styles.muted}>User #{row.id}</Text>
                    </View>
                    <StatusBadge status={row.status} />
                  </View>
                  <InfoRow label="Username" value={row.username || "-"} />
                  <InfoRow label="Email" value={row.email_display} />
                  <InfoRow label="Phone" value={row.phone_display} />
                  <InfoRow label="Roles" value={row.roles_display} />
                  <InfoRow label="Parent Class" value={row.parent_classes_display} />
                  <InfoRow label="Parent Section" value={row.parent_sections_display} />
                  <View style={styles.actionRow}>
                    <Pressable style={styles.secondaryBtn} onPress={() => setGrantingUser(row)}>
                      <Text style={styles.secondaryBtnText}>Grant Permission</Text>
                    </Pressable>
                    <Pressable
                      style={row.status === "active" ? styles.deleteBtn : styles.primaryBtn}
                      onPress={() => confirmStatusUpdate(row)}
                    >
                      <Text style={row.status === "active" ? styles.deleteBtnText : styles.primaryBtnText}>
                        {row.status === "active" ? "Deactivate" : "Activate"}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              ))
            ) : (
              <Text style={styles.muted}>No users found for current filters.</Text>
            )}

            <View style={styles.paginationRow}>
              <Pressable
                style={styles.secondaryBtn}
                disabled={pagination.page <= 1}
                onPress={() => setPage((prev) => Math.max(1, prev - 1))}
              >
                <Text style={styles.secondaryBtnText}>Previous</Text>
              </Pressable>
              <Text style={styles.muted}>
                Page {pagination.page} of {pagination.totalPages}
              </Text>
              <Pressable
                style={styles.secondaryBtn}
                disabled={pagination.page >= pagination.totalPages}
                onPress={() => setPage((prev) => Math.min(pagination.totalPages, prev + 1))}
              >
                <Text style={styles.secondaryBtnText}>Next</Text>
              </Pressable>
            </View>
          </View>
        </>
      ) : null}

      <Modal visible={passwordOpen} transparent animationType="slide" onRequestClose={() => setPasswordOpen(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setPasswordOpen(false)} />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Change Password</Text>
            <Text style={styles.muted}>Update your password for this account.</Text>
            <TextInput
              style={styles.input}
              placeholder="Current password"
              secureTextEntry
              value={passwordForm.current_password}
              onChangeText={(value) => setPasswordForm((prev) => ({ ...prev, current_password: value }))}
            />
            <TextInput
              style={styles.input}
              placeholder="New password"
              secureTextEntry
              value={passwordForm.new_password}
              onChangeText={(value) => setPasswordForm((prev) => ({ ...prev, new_password: value }))}
            />
            <View style={styles.actionRow}>
              <Pressable style={styles.secondaryBtn} onPress={() => setPasswordOpen(false)}>
                <Text style={styles.secondaryBtnText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.primaryBtn} onPress={handleChangePassword} disabled={passwordSaving}>
                <Text style={styles.primaryBtnText}>{passwordSaving ? "Saving..." : "Update"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={createOpen} transparent animationType="slide" onRequestClose={() => setCreateOpen(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setCreateOpen(false)} />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add User</Text>
            <ScrollView style={styles.modalBody}>
              <Text style={styles.muted}>Create a user account and assign one or more roles.</Text>
              <Text style={styles.inputLabel}>Username</Text>
              <TextInput style={styles.input} value={createForm.username} onChangeText={(value) => setCreateForm((prev) => ({ ...prev, username: value }))} />
              <Text style={styles.inputLabel}>Email</Text>
              <TextInput style={styles.input} keyboardType="email-address" value={createForm.email} onChangeText={(value) => setCreateForm((prev) => ({ ...prev, email: value }))} />
              <Text style={styles.inputLabel}>Phone</Text>
              <TextInput style={styles.input} keyboardType="phone-pad" value={createForm.phone} onChangeText={(value) => setCreateForm((prev) => ({ ...prev, phone: value }))} />
              <Text style={styles.inputLabel}>Password</Text>
              <TextInput style={styles.input} secureTextEntry value={createForm.password} onChangeText={(value) => setCreateForm((prev) => ({ ...prev, password: value }))} />

              <FilterGroup
                label="Status"
                options={[
                  { label: "Active", value: "active" },
                  { label: "Inactive", value: "inactive" },
                ]}
                value={createForm.status}
                onChange={(value) => setCreateForm((prev) => ({ ...prev, status: value }))}
              />

              <Text style={styles.inputLabel}>Roles</Text>
              <View style={styles.permissionWrap}>
                {roles.map((roleName) => {
                  const active = createForm.roles.includes(roleName);
                  return (
                    <Pressable
                      key={roleName}
                      style={[styles.permissionCard, active && styles.permissionCardActive]}
                      onPress={() => toggleRoleSelection(roleName)}
                    >
                      <Text style={[styles.permissionTitle, active && styles.permissionTitleActive]}>
                        {roleName}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
            <View style={styles.actionRow}>
              <Pressable style={styles.secondaryBtn} onPress={() => setCreateOpen(false)}>
                <Text style={styles.secondaryBtnText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.primaryBtn} onPress={handleCreateUser}>
                <Text style={styles.primaryBtnText}>Create User</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={!!grantingUser} transparent animationType="slide" onRequestClose={() => setGrantingUser(null)}>
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setGrantingUser(null)} />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Grant Permission</Text>
            <Text style={styles.muted}>
              {grantingUser ? `Select direct permissions for user #${grantingUser.id}.` : "Select permissions."}
            </Text>
            <ScrollView style={styles.modalBody}>
              <View style={styles.permissionWrap}>
                {allPermissions.map((permissionName) => {
                  const active = selectedPermissions.includes(permissionName);
                  return (
                    <Pressable
                      key={permissionName}
                      style={[styles.permissionCard, active && styles.permissionCardActive]}
                      onPress={() => togglePermissionSelection(permissionName)}
                    >
                      <Text style={[styles.permissionTitle, active && styles.permissionTitleActive]}>
                        {formatPermissionLabel(permissionName)}
                      </Text>
                      <Text style={styles.permissionMeta}>{permissionName}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
            <View style={styles.actionRow}>
              <Pressable style={styles.secondaryBtn} onPress={() => setGrantingUser(null)}>
                <Text style={styles.secondaryBtnText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.primaryBtn} onPress={handleGrantPermissions}>
                <Text style={styles.primaryBtnText}>Save Permissions</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function FilterGroup({
  label,
  options,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  options: Array<{ label: string; value: string }>;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.filterGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipWrap}>
        {options.map((item) => {
          const active = value === item.value;
          return (
            <Pressable
              key={`${label}-${item.value || "all"}`}
              disabled={disabled}
              style={[styles.chip, active && styles.chipActive, disabled && styles.disabledChip]}
              onPress={() => onChange(item.value)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function SummaryCard({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function StatusBadge({ status }: { status: string }) {
  const active = status === "active";
  return (
    <View style={[styles.statusBadge, active ? styles.statusActive : styles.statusInactive]}>
      <Text style={[styles.statusBadgeText, active ? styles.statusActiveText : styles.statusInactiveText]}>
        {status}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
    paddingBottom: 24,
  },
  card: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    backgroundColor: "#ffffff",
    padding: 12,
    gap: 10,
  },
  sectionTitle: {
    color: "#0f172a",
    fontWeight: "700",
    fontSize: 16,
  },
  muted: {
    color: "#64748b",
    fontSize: 12,
  },
  infoRow: {
    gap: 3,
  },
  infoLabel: {
    color: "#64748b",
    fontSize: 12,
    textTransform: "uppercase",
  },
  infoValue: {
    color: "#0f172a",
    fontWeight: "600",
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    alignItems: "flex-start",
  },
  headerCopy: {
    flex: 1,
  },
  filterGroup: {
    gap: 8,
  },
  inputLabel: {
    color: "#334155",
    fontWeight: "600",
    fontSize: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: "#ffffff",
  },
  chipActive: {
    borderColor: "#0f172a",
    backgroundColor: "#e2e8f0",
  },
  disabledChip: {
    opacity: 0.45,
  },
  chipText: {
    color: "#334155",
    fontWeight: "600",
    fontSize: 12,
  },
  chipTextActive: {
    color: "#0f172a",
  },
  primaryBtn: {
    backgroundColor: "#0f172a",
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: {
    color: "#ffffff",
    fontWeight: "600",
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtnText: {
    color: "#334155",
    fontWeight: "600",
  },
  deleteBtn: {
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: "#fee2e2",
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteBtnText: {
    color: "#b91c1c",
    fontWeight: "700",
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  summaryCard: {
    minWidth: 100,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  summaryValue: {
    color: "#0f172a",
    fontWeight: "800",
    fontSize: 16,
  },
  summaryLabel: {
    marginTop: 4,
    color: "#64748b",
    fontWeight: "600",
    fontSize: 12,
  },
  userCard: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    backgroundColor: "#f8fafc",
    padding: 12,
    gap: 8,
  },
  userName: {
    color: "#0f172a",
    fontWeight: "700",
    fontSize: 15,
  },
  statusBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  statusActive: {
    borderColor: "#86efac",
    backgroundColor: "#dcfce7",
  },
  statusActiveText: {
    color: "#166534",
  },
  statusInactive: {
    borderColor: "#fecaca",
    backgroundColor: "#fee2e2",
  },
  statusInactiveText: {
    color: "#b91c1c",
  },
  paginationRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.35)",
  },
  modalCard: {
    maxHeight: "86%",
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    gap: 10,
  },
  modalTitle: {
    color: "#0f172a",
    fontWeight: "700",
    fontSize: 18,
  },
  modalBody: {
    maxHeight: 470,
  },
  permissionWrap: {
    gap: 8,
    paddingVertical: 8,
  },
  permissionCard: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    backgroundColor: "#ffffff",
    padding: 10,
    gap: 4,
  },
  permissionCardActive: {
    borderColor: "#0f172a",
    backgroundColor: "#e2e8f0",
  },
  permissionTitle: {
    color: "#0f172a",
    fontWeight: "600",
  },
  permissionTitleActive: {
    color: "#0f172a",
  },
  permissionMeta: {
    color: "#64748b",
    fontSize: 12,
  },
});
