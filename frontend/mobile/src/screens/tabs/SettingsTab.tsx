import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  adminResetPassword,
  changeMyPassword,
  getMyAccount,
  getUsers,
  type AccountProfile,
  type UserListItem,
} from "../../services/usersService";
import {
  createSession,
  createStream,
  deleteSession,
  deleteStream,
  getSessions,
  getStreams,
  updateSession,
  updateStream,
  type AcademicSessionItem,
  type StreamItem,
} from "../../services/settingsService";
import TopNotice from "../../components/feedback/TopNotice";
import { useAuthStore } from "../../store/authStore";
import DateField from "../../components/form/DateField";

type NoticeTone = "success" | "error";
type SettingsTabKey = "account" | "sessions" | "streams" | "security";

function getErrorMessage(err: unknown, fallback: string) {
  if (typeof err === "object" && err && "response" in err) {
    const data = (err as { response?: { data?: { message?: string; error?: string } } }).response?.data;
    return data?.error || data?.message || fallback;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString();
}

function noticeToneStyle(tone: NoticeTone) {
  return tone === "success"
    ? { borderColor: "#bbf7d0", backgroundColor: "#f0fdf4" }
    : { borderColor: "#fecaca", backgroundColor: "#fef2f2" };
}

function TabChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.tabChip, active && styles.tabChipActive]} onPress={onPress}>
      <Text style={[styles.tabChipText, active && styles.tabChipTextActive]}>{label}</Text>
    </Pressable>
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

export default function SettingsTab() {
  const user = useAuthStore((state) => state.user);
  const canManageUsers = Boolean(user?.permissions?.includes("teacher.update"));
  const canCreateAcademic = Boolean(user?.permissions?.includes("academic.create"));
  const canUpdateAcademic = Boolean(user?.permissions?.includes("academic.update"));
  const canDeleteAcademic = Boolean(user?.permissions?.includes("academic.delete"));

  const [activeTab, setActiveTab] = useState<SettingsTabKey>("account");
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState<{ title: string; message: string; tone: NoticeTone } | null>(null);

  const [account, setAccount] = useState<AccountProfile | null>(null);
  const [accountLoading, setAccountLoading] = useState(true);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current_password: "", new_password: "" });

  const [sessions, setSessions] = useState<AcademicSessionItem[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionSaving, setSessionSaving] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<number | null>(null);
  const [sessionForm, setSessionForm] = useState({
    name: "",
    startDate: "",
    endDate: "",
    isActive: true,
  });

  const [streams, setStreams] = useState<StreamItem[]>([]);
  const [streamsLoading, setStreamsLoading] = useState(false);
  const [streamSaving, setStreamSaving] = useState(false);
  const [editingStreamId, setEditingStreamId] = useState<number | null>(null);
  const [streamForm, setStreamForm] = useState({ name: "" });

  const [users, setUsers] = useState<UserListItem[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [securitySaving, setSecuritySaving] = useState(false);
  const [securityForm, setSecurityForm] = useState({
    user_id: "",
    new_password: "",
    search: "",
  });

  useEffect(() => {
    loadAccount();
    if (canManageUsers) loadUsers();
    loadSessions();
    loadStreams();
  }, [canManageUsers]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), 3200);
    return () => clearTimeout(timer);
  }, [notice]);

  const filteredUsers = useMemo(() => {
    const query = securityForm.search.trim().toLowerCase();
    if (!query) return users;
    return users.filter((userRow) =>
      [userRow.teacher_name, userRow.parent_name, userRow.username, userRow.email, userRow.phone]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [securityForm.search, users]);

  async function loadAccount() {
    setAccountLoading(true);
    try {
      setAccount((await getMyAccount()) ?? null);
    } finally {
      setAccountLoading(false);
    }
  }

  async function loadSessions() {
    setSessionsLoading(true);
    try {
      setSessions(await getSessions());
    } finally {
      setSessionsLoading(false);
    }
  }

  async function loadStreams() {
    setStreamsLoading(true);
    try {
      setStreams(await getStreams());
    } finally {
      setStreamsLoading(false);
    }
  }

  async function loadUsers() {
    setUsersLoading(true);
    try {
      const res = await getUsers({ page: 1, limit: 50 });
      setUsers(Array.isArray(res.data) ? res.data : []);
    } finally {
      setUsersLoading(false);
    }
  }

  async function refreshCurrentTab() {
    setRefreshing(true);
    try {
      await loadAccount();
      if (activeTab === "sessions") await loadSessions();
      if (activeTab === "streams") await loadStreams();
      if (activeTab === "security" && canManageUsers) await loadUsers();
    } finally {
      setRefreshing(false);
    }
  }

  function showNotice(title: string, message: string, tone: NoticeTone = "success") {
    setNotice({ title, message, tone });
  }

  function resetSessionForm() {
    setEditingSessionId(null);
    setSessionForm({ name: "", startDate: "", endDate: "", isActive: true });
  }

  function resetStreamForm() {
    setEditingStreamId(null);
    setStreamForm({ name: "" });
  }

  async function handlePasswordChange() {
    if (!passwordForm.current_password || !passwordForm.new_password) {
      showNotice("Validation", "Current password and new password are required.", "error");
      return;
    }
    if (passwordForm.new_password.length < 6) {
      showNotice("Validation", "New password must be at least 6 characters.", "error");
      return;
    }

    setPasswordSaving(true);
    try {
      await changeMyPassword(passwordForm);
      setPasswordForm({ current_password: "", new_password: "" });
      showNotice("Password Updated", "Your password was updated successfully.");
    } catch (err: unknown) {
      showNotice("Update Failed", getErrorMessage(err, "Failed to change password."), "error");
    } finally {
      setPasswordSaving(false);
    }
  }

  async function handleSaveSession() {
    if (!sessionForm.name.trim() || !sessionForm.startDate || !sessionForm.endDate) {
      showNotice("Validation", "Session name, start date, and end date are required.", "error");
      return;
    }

    setSessionSaving(true);
    try {
      const payload = {
        name: sessionForm.name.trim(),
        startDate: sessionForm.startDate,
        endDate: sessionForm.endDate,
        isActive: sessionForm.isActive,
      };
      if (editingSessionId) {
        await updateSession(editingSessionId, payload);
        showNotice("Session Updated", "Academic session updated successfully.");
      } else {
        await createSession(payload);
        showNotice("Session Created", "Academic session created successfully.");
      }
      resetSessionForm();
      await loadSessions();
    } catch (err: unknown) {
      showNotice("Save Failed", getErrorMessage(err, "Failed to save academic session."), "error");
    } finally {
      setSessionSaving(false);
    }
  }

  async function handleDeleteSession(sessionId: number) {
    setSessionSaving(true);
    try {
      await deleteSession(sessionId);
      if (editingSessionId === sessionId) resetSessionForm();
      await loadSessions();
      showNotice("Session Deleted", "Academic session deleted successfully.");
    } catch (err: unknown) {
      showNotice("Delete Failed", getErrorMessage(err, "Failed to delete academic session."), "error");
    } finally {
      setSessionSaving(false);
    }
  }

  async function handleSaveStream() {
    if (!streamForm.name.trim()) {
      showNotice("Validation", "Stream name is required.", "error");
      return;
    }
    setStreamSaving(true);
    try {
      if (editingStreamId) {
        await updateStream(editingStreamId, { name: streamForm.name.trim() });
        showNotice("Stream Updated", "Stream updated successfully.");
      } else {
        await createStream({ name: streamForm.name.trim() });
        showNotice("Stream Created", "Stream created successfully.");
      }
      resetStreamForm();
      await loadStreams();
    } catch (err: unknown) {
      showNotice("Save Failed", getErrorMessage(err, "Failed to save stream."), "error");
    } finally {
      setStreamSaving(false);
    }
  }

  async function handleDeleteStream(streamId: number) {
    setStreamSaving(true);
    try {
      await deleteStream(streamId);
      if (editingStreamId === streamId) resetStreamForm();
      await loadStreams();
      showNotice("Stream Deleted", "Stream deleted successfully.");
    } catch (err: unknown) {
      showNotice("Delete Failed", getErrorMessage(err, "Failed to delete stream."), "error");
    } finally {
      setStreamSaving(false);
    }
  }

  async function handleAdminResetPassword() {
    if (!securityForm.user_id || !securityForm.new_password) {
      showNotice("Validation", "User and new password are required.", "error");
      return;
    }
    if (securityForm.new_password.length < 6) {
      showNotice("Validation", "New password must be at least 6 characters.", "error");
      return;
    }

    setSecuritySaving(true);
    try {
      await adminResetPassword({
        user_id: Number(securityForm.user_id),
        new_password: securityForm.new_password,
      });
      const resetUser = users.find((item) => String(item.id) === String(securityForm.user_id));
      setSecurityForm({ user_id: "", new_password: "", search: "" });
      showNotice(
        "Password Reset",
        `Password reset completed for ${resetUser?.teacher_name || resetUser?.parent_name || resetUser?.username || `user #${securityForm.user_id}`}.`,
      );
    } catch (err: unknown) {
      showNotice("Reset Failed", getErrorMessage(err, "Failed to reset password."), "error");
    } finally {
      setSecuritySaving(false);
    }
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshCurrentTab} />}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.heroCard}>
        <Text style={styles.heroTitle}>Settings</Text>
        <Text style={styles.heroSubtitle}>
          Manage account, academic sessions, streams, and security tools with the live backend settings workflows.
        </Text>
      </View>

      <TopNotice notice={notice} />

      <View style={styles.tabsRow}>
        <TabChip label="Account" active={activeTab === "account"} onPress={() => setActiveTab("account")} />
        <TabChip label="Sessions" active={activeTab === "sessions"} onPress={() => setActiveTab("sessions")} />
        <TabChip label="Streams" active={activeTab === "streams"} onPress={() => setActiveTab("streams")} />
        <TabChip label="Security" active={activeTab === "security"} onPress={() => setActiveTab("security")} />
      </View>

      {activeTab === "account" ? (
        <>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Account Information</Text>
            {accountLoading ? (
              <ActivityIndicator size="small" color="#0f172a" />
            ) : !account ? (
              <Text style={styles.muted}>No account details found.</Text>
            ) : (
              <>
                <InfoRow label="Display Name" value={account.name || "-"} />
                <InfoRow label="Username" value={account.username || "-"} />
                <InfoRow label="Email" value={account.email || "-"} />
                <InfoRow label="Phone" value={account.phone || "-"} />
                <InfoRow label="Status" value={account.status || "-"} />
                <InfoRow label="Roles" value={Array.isArray(account.roles) && account.roles.length ? account.roles.join(", ") : "-"} />
                <InfoRow label="Created" value={formatDate(account.created_at)} />
              </>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Change Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Current password"
              placeholderTextColor="#94a3b8"
              secureTextEntry
              value={passwordForm.current_password}
              onChangeText={(value) => setPasswordForm((prev) => ({ ...prev, current_password: value }))}
            />
            <TextInput
              style={styles.input}
              placeholder="New password"
              placeholderTextColor="#94a3b8"
              secureTextEntry
              value={passwordForm.new_password}
              onChangeText={(value) => setPasswordForm((prev) => ({ ...prev, new_password: value }))}
            />
            <Pressable style={styles.primaryBtn} onPress={handlePasswordChange} disabled={passwordSaving}>
              <Text style={styles.primaryBtnText}>{passwordSaving ? "Updating..." : "Update Password"}</Text>
            </Pressable>
          </View>
        </>
      ) : null}

      {activeTab === "sessions" ? (
        <>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{editingSessionId ? "Edit Session" : "Create Session"}</Text>
            <TextInput
              style={styles.input}
              placeholder="Session name"
              placeholderTextColor="#94a3b8"
              value={sessionForm.name}
              onChangeText={(value) => setSessionForm((prev) => ({ ...prev, name: value }))}
              editable={editingSessionId ? canUpdateAcademic : canCreateAcademic}
            />
            <DateField
              label="Start Date"
              value={sessionForm.startDate}
              onChange={(value) => setSessionForm((prev) => ({ ...prev, startDate: value }))}
              placeholder="Select start date"
              disabled={!(editingSessionId ? canUpdateAcademic : canCreateAcademic)}
            />
            <DateField
              label="End Date"
              value={sessionForm.endDate}
              onChange={(value) => setSessionForm((prev) => ({ ...prev, endDate: value }))}
              placeholder="Select end date"
              disabled={!(editingSessionId ? canUpdateAcademic : canCreateAcademic)}
            />
            <Pressable
              style={[styles.secondaryBtn, sessionForm.isActive && styles.secondaryBtnActive]}
              onPress={() => setSessionForm((prev) => ({ ...prev, isActive: !prev.isActive }))}
              disabled={!(editingSessionId ? canUpdateAcademic : canCreateAcademic)}
            >
              <Text style={[styles.secondaryBtnText, sessionForm.isActive && styles.secondaryBtnTextActive]}>
                {sessionForm.isActive ? "Active Session" : "Set As Active"}
              </Text>
            </Pressable>
            <View style={styles.actionRow}>
              <Pressable
                style={styles.primaryBtn}
                onPress={handleSaveSession}
                disabled={sessionSaving || !(editingSessionId ? canUpdateAcademic : canCreateAcademic)}
              >
                <Text style={styles.primaryBtnText}>{sessionSaving ? "Saving..." : editingSessionId ? "Update Session" : "Create Session"}</Text>
              </Pressable>
              {editingSessionId ? (
                <Pressable style={styles.secondaryBtn} onPress={resetSessionForm} disabled={sessionSaving}>
                  <Text style={styles.secondaryBtnText}>Cancel</Text>
                </Pressable>
              ) : null}
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Academic Sessions</Text>
            {sessionsLoading ? (
              <ActivityIndicator size="small" color="#0f172a" />
            ) : sessions.length ? (
              sessions.map((session) => (
                <View key={session.id} style={styles.listCard}>
                  <Text style={styles.listTitle}>{session.name}</Text>
                  <Text style={styles.muted}>{formatDate(session.start_date)} to {formatDate(session.end_date)}</Text>
                  <Text style={styles.muted}>{session.is_active ? "Active" : "Inactive"}</Text>
                  <View style={styles.actionRow}>
                    <Pressable
                      style={styles.secondaryBtn}
                      disabled={!canUpdateAcademic || sessionSaving}
                      onPress={() => {
                        setEditingSessionId(session.id);
                        setSessionForm({
                          name: session.name || "",
                          startDate: String(session.start_date || "").slice(0, 10),
                          endDate: String(session.end_date || "").slice(0, 10),
                          isActive: Boolean(session.is_active),
                        });
                      }}
                    >
                      <Text style={styles.secondaryBtnText}>Edit</Text>
                    </Pressable>
                    <Pressable
                      style={styles.deleteBtn}
                      disabled={!canDeleteAcademic || sessionSaving}
                      onPress={() => handleDeleteSession(session.id)}
                    >
                      <Text style={styles.deleteBtnText}>Delete</Text>
                    </Pressable>
                  </View>
                </View>
              ))
            ) : (
              <Text style={styles.muted}>No academic sessions found.</Text>
            )}
          </View>
        </>
      ) : null}

      {activeTab === "streams" ? (
        <>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{editingStreamId ? "Edit Stream" : "Create Stream"}</Text>
            <TextInput
              style={styles.input}
              placeholder="Stream name"
              placeholderTextColor="#94a3b8"
              value={streamForm.name}
              onChangeText={(value) => setStreamForm({ name: value })}
              editable={editingStreamId ? canUpdateAcademic : canCreateAcademic}
            />
            <View style={styles.actionRow}>
              <Pressable
                style={styles.primaryBtn}
                onPress={handleSaveStream}
                disabled={streamSaving || !(editingStreamId ? canUpdateAcademic : canCreateAcademic)}
              >
                <Text style={styles.primaryBtnText}>{streamSaving ? "Saving..." : editingStreamId ? "Update Stream" : "Create Stream"}</Text>
              </Pressable>
              {editingStreamId ? (
                <Pressable style={styles.secondaryBtn} onPress={resetStreamForm} disabled={streamSaving}>
                  <Text style={styles.secondaryBtnText}>Cancel</Text>
                </Pressable>
              ) : null}
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Available Streams</Text>
            {streamsLoading ? (
              <ActivityIndicator size="small" color="#0f172a" />
            ) : streams.length ? (
              streams.map((stream) => (
                <View key={stream.id} style={styles.listCard}>
                  <Text style={styles.listTitle}>{stream.name}</Text>
                  <Text style={styles.muted}>Stream #{stream.id}</Text>
                  <View style={styles.actionRow}>
                    <Pressable
                      style={styles.secondaryBtn}
                      disabled={!canUpdateAcademic || streamSaving}
                      onPress={() => {
                        setEditingStreamId(stream.id);
                        setStreamForm({ name: stream.name || "" });
                      }}
                    >
                      <Text style={styles.secondaryBtnText}>Edit</Text>
                    </Pressable>
                    <Pressable
                      style={styles.deleteBtn}
                      disabled={!canDeleteAcademic || streamSaving}
                      onPress={() => handleDeleteStream(stream.id)}
                    >
                      <Text style={styles.deleteBtnText}>Delete</Text>
                    </Pressable>
                  </View>
                </View>
              ))
            ) : (
              <Text style={styles.muted}>No streams found.</Text>
            )}
          </View>
        </>
      ) : null}

      {activeTab === "security" ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Security</Text>
          {!canManageUsers ? (
            <Text style={styles.muted}>
              Additional security tools require elevated user-management permissions. You can still change your own password in the Account tab.
            </Text>
          ) : (
            <>
              <TextInput
                style={styles.input}
                placeholder="Search username, email, phone"
                placeholderTextColor="#94a3b8"
                value={securityForm.search}
                onChangeText={(value) => setSecurityForm((prev) => ({ ...prev, search: value }))}
              />
              <TextInput
                style={styles.input}
                placeholder="New password"
                placeholderTextColor="#94a3b8"
                secureTextEntry
                value={securityForm.new_password}
                onChangeText={(value) => setSecurityForm((prev) => ({ ...prev, new_password: value }))}
              />
              <Pressable
                style={styles.primaryBtn}
                onPress={handleAdminResetPassword}
                disabled={securitySaving}
              >
                <Text style={styles.primaryBtnText}>{securitySaving ? "Resetting..." : "Reset Password"}</Text>
              </Pressable>

              <View style={styles.userList}>
                {usersLoading ? (
                  <ActivityIndicator size="small" color="#0f172a" />
                ) : filteredUsers.length ? (
                  filteredUsers.slice(0, 12).map((userRow) => (
                    <Pressable
                      key={userRow.id}
                      style={[
                        styles.userRow,
                        String(securityForm.user_id) === String(userRow.id) && styles.userRowActive,
                      ]}
                      onPress={() => setSecurityForm((prev) => ({ ...prev, user_id: String(userRow.id) }))}
                    >
                      <Text style={styles.listTitle}>
                        {userRow.teacher_name || userRow.parent_name || userRow.username || `User #${userRow.id}`}
                      </Text>
                      <Text style={styles.muted}>{userRow.email || userRow.phone || "No email/phone"}</Text>
                      <Text style={styles.muted}>{userRow.roles || "-"}</Text>
                    </Pressable>
                  ))
                ) : (
                  <Text style={styles.muted}>No users found for this search.</Text>
                )}
              </View>
            </>
          )}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { gap: 14, paddingBottom: 24 },
  heroCard: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 24, backgroundColor: "#ffffff", padding: 18, gap: 6 },
  heroTitle: { color: "#0f172a", fontWeight: "800", fontSize: 22 },
  heroSubtitle: { color: "#64748b", lineHeight: 20 },
  noticeCard: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 12 },
  noticeTitle: { color: "#0f172a", fontWeight: "800", marginBottom: 2 },
  noticeMessage: { color: "#475569" },
  tabsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tabChip: { borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: "#ffffff" },
  tabChipActive: { borderColor: "#0f172a", backgroundColor: "#0f172a" },
  tabChipText: { color: "#475569", fontWeight: "700", fontSize: 12 },
  tabChipTextActive: { color: "#ffffff" },
  card: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 22, backgroundColor: "#ffffff", padding: 16, gap: 12 },
  sectionTitle: { color: "#0f172a", fontWeight: "800", fontSize: 16 },
  muted: { color: "#64748b", fontSize: 12 },
  infoRow: { gap: 3 },
  infoLabel: { color: "#64748b", fontSize: 12, textTransform: "uppercase" },
  infoValue: { color: "#0f172a", fontWeight: "600" },
  input: { borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 14, backgroundColor: "#ffffff", paddingHorizontal: 12, paddingVertical: 11, color: "#0f172a" },
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  primaryBtn: { backgroundColor: "#0f172a", paddingHorizontal: 14, paddingVertical: 11, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  primaryBtnText: { color: "#ffffff", fontWeight: "700" },
  secondaryBtn: { borderWidth: 1, borderColor: "#cbd5e1", backgroundColor: "#ffffff", paddingHorizontal: 14, paddingVertical: 11, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  secondaryBtnActive: { borderColor: "#0f172a", backgroundColor: "#eef2ff" },
  secondaryBtnText: { color: "#334155", fontWeight: "700" },
  secondaryBtnTextActive: { color: "#0f172a" },
  deleteBtn: { borderWidth: 1, borderColor: "#fecaca", backgroundColor: "#fee2e2", paddingHorizontal: 14, paddingVertical: 11, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  deleteBtnText: { color: "#b91c1c", fontWeight: "700" },
  listCard: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 16, backgroundColor: "#f8fafc", padding: 12, gap: 8 },
  listTitle: { color: "#0f172a", fontWeight: "700", fontSize: 14 },
  userList: { gap: 8 },
  userRow: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 14, backgroundColor: "#f8fafc", padding: 12, gap: 4 },
  userRowActive: { borderColor: "#0f172a", backgroundColor: "#eef2ff" },
});
