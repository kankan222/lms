import { useEffect, useMemo, useState } from "react";
import TopBar from "../components/TopBar";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  createSession,
  deleteSession,
  createStream,
  deleteStream,
  getSessions,
  getStreams,
  updateSession,
  updateStream,
} from "../api/academic.api";
import { adminResetPassword, getMyAccount, getUsers, changeMyPassword } from "../api/users.api";
import { usePermissions } from "../hooks/usePermissions";
import { formatReadableDate } from "../lib/dateTime";

function NoticeBanner({ notice }) {
  if (!notice) return null;
  return (
    <div className="pointer-events-none fixed top-6 right-6 z-50 w-full max-w-sm">
      <Alert
        variant={notice.variant}
        className="pointer-events-auto overflow-hidden border shadow-xl"
      >
        <AlertTitle>{notice.title}</AlertTitle>
        <AlertDescription>{notice.message}</AlertDescription>
      </Alert>
    </div>
  );
}

function AcademicSessionsPanel({ showNotice }) {
  const { can } = usePermissions();
  const canCreate = can("academic.create");
  const canUpdate = can("academic.update");
  const canDelete = can("academic.delete");
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    name: "",
    startDate: "",
    endDate: "",
    isActive: true,
  });

  useEffect(() => {
    loadSessions();
  }, []);

  async function loadSessions() {
    setLoading(true);
    setError("");
    try {
      const res = await getSessions();
      setSessions(Array.isArray(res?.data) ? res.data : []);
    } catch (err) {
      setError(err?.message || "Failed to load academic sessions.");
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setEditingId(null);
    setForm({
      name: "",
      startDate: "",
      endDate: "",
      isActive: true,
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    const name = String(form.name || "").trim();
    if (!name || !form.startDate || !form.endDate) {
      setError("Session name, start date, and end date are required.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name,
        startDate: form.startDate,
        endDate: form.endDate,
        isActive: form.isActive,
      };

      if (editingId) {
        await updateSession(editingId, payload);
        showNotice("Session Updated", "Academic session updated successfully.");
      } else {
        await createSession(payload);
        showNotice("Session Created", "Academic session created successfully.");
      }

      resetForm();
      await loadSessions();
    } catch (err) {
      setError(err?.message || "Failed to save academic session.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(sessionId) {
    setError("");
    setSaving(true);
    try {
      await deleteSession(sessionId);
      if (String(editingId) === String(sessionId)) {
        resetForm();
      }
      await loadSessions();
      showNotice("Session Deleted", "Academic session deleted successfully.");
    } catch (err) {
      setError(err?.message || "Failed to delete academic session.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
      <Card>
        <CardHeader>
          <CardTitle>{editingId ? "Edit Session" : "Create Session"}</CardTitle>
          <CardDescription>
            Add an academic session and optionally mark it as the active one.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid gap-4">
            <div className="grid gap-2">
              <Label>Session Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="2026-2027"
                disabled={!(editingId ? canUpdate : canCreate)}
              />
            </div>

            <div className="grid gap-2">
              <Label>Start Date *</Label>
              <Input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm((prev) => ({ ...prev, startDate: e.target.value }))}
                disabled={!(editingId ? canUpdate : canCreate)}
              />
            </div>

            <div className="grid gap-2">
              <Label>End Date *</Label>
              <Input
                type="date"
                value={form.endDate}
                onChange={(e) => setForm((prev) => ({ ...prev, endDate: e.target.value }))}
                disabled={!(editingId ? canUpdate : canCreate)}
              />
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
                disabled={!(editingId ? canUpdate : canCreate)}
              />
              Set as active session
            </label>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex gap-2">
              <Button
                type="submit"
                disabled={saving || !(editingId ? canUpdate : canCreate)}
              >
                {saving ? "Saving..." : editingId ? "Update Session" : "Create Session"}
              </Button>
              {editingId ? (
                <Button type="button" variant="outline" onClick={resetForm} disabled={saving}>
                  Cancel
                </Button>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Academic Sessions</CardTitle>
          <CardDescription>Existing sessions from the backend academic module.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading sessions...</p>
          ) : sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No academic sessions found.</p>
          ) : (
            sessions.map((session) => (
              <div key={session.id} className="rounded-lg border bg-muted/30 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{session.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatReadableDate(session.start_date)} to {formatReadableDate(session.end_date)}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      session.is_active
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-stone-100 text-stone-600"
                    }`}
                  >
                    {session.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
                <div className="mt-3 flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditingId(session.id);
                      setForm({
                        name: session.name || "",
                        startDate: String(session.start_date || "").slice(0, 10),
                        endDate: String(session.end_date || "").slice(0, 10),
                        isActive: Boolean(session.is_active),
                      });
                      setError("");
                    }}
                    disabled={!canUpdate || saving}
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDelete(session.id)}
                    disabled={!canDelete || saving}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StreamsPanel({ showNotice }) {
  const { can } = usePermissions();
  const canCreate = can("academic.create");
  const canUpdate = can("academic.update");
  const canDelete = can("academic.delete");

  const [streams, setStreams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "" });
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    loadStreams();
  }, []);

  async function loadStreams() {
    setLoading(true);
    setError("");
    try {
      const res = await getStreams();
      setStreams(Array.isArray(res?.data) ? res.data : []);
    } catch (err) {
      setError(err?.message || "Failed to load streams.");
      setStreams([]);
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setForm({ name: "" });
    setEditingId(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    const name = String(form.name || "").trim();
    if (!name) {
      setError("Stream name is required.");
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        await updateStream(editingId, { name });
        showNotice("Stream Updated", "Stream updated successfully.");
      } else {
        await createStream({ name });
        showNotice("Stream Created", "Stream created successfully.");
      }

      resetForm();
      await loadStreams();
    } catch (err) {
      setError(err?.message || "Failed to save stream.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(streamId) {
    setError("");
    setSaving(true);
    try {
      await deleteStream(streamId);
      if (String(editingId) === String(streamId)) {
        resetForm();
      }
      await loadStreams();
      showNotice("Stream Deleted", "Stream deleted successfully.");
    } catch (err) {
      setError(err?.message || "Failed to delete stream.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
      <Card>
        <CardHeader>
          <CardTitle>{editingId ? "Edit Stream" : "Create Stream"}</CardTitle>
          <CardDescription>
            Manage higher secondary stream options used across student enrollment.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid gap-4">
            <div className="grid gap-2">
              <Label>Stream Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ name: e.target.value })}
                placeholder="Science"
                disabled={!(editingId ? canUpdate : canCreate)}
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex gap-2">
              <Button
                type="submit"
                disabled={saving || !(editingId ? canUpdate : canCreate)}
              >
                {saving ? "Saving..." : editingId ? "Update Stream" : "Create Stream"}
              </Button>
              {editingId ? (
                <Button type="button" variant="outline" onClick={resetForm} disabled={saving}>
                  Cancel
                </Button>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Available Streams</CardTitle>
          <CardDescription>
            Existing stream records from the academic module.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading streams...</p>
          ) : streams.length === 0 ? (
            <p className="text-sm text-muted-foreground">No streams found.</p>
          ) : (
            streams.map((stream) => (
              <div
                key={stream.id}
                className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 px-4 py-3"
              >
                <div>
                  <p className="font-semibold">{stream.name}</p>
                  <p className="text-xs text-muted-foreground">Stream #{stream.id}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditingId(stream.id);
                      setForm({ name: stream.name || "" });
                      setError("");
                    }}
                    disabled={!canUpdate || saving}
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDelete(stream.id)}
                    disabled={!canDelete || saving}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AccountInformationPanel({ showNotice }) {
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState({
    current_password: "",
    new_password: "",
  });

  useEffect(() => {
    loadAccount();
  }, []);

  async function loadAccount() {
    setLoading(true);
    setError("");
    try {
      const res = await getMyAccount();
      setAccount(res?.data || null);
    } catch (err) {
      setError(err?.message || "Failed to load account information.");
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordChange(e) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!form.current_password || !form.new_password) {
      setError("Current password and new password are required.");
      return;
    }

    if (form.new_password.length < 6) {
      setError("New password must be at least 6 characters.");
      return;
    }

    setSaving(true);
    try {
      await changeMyPassword(form);
      setForm({
        current_password: "",
        new_password: "",
      });
      setSuccess("Password updated successfully.");
      showNotice("Password Updated", "Your account password was updated successfully.");
    } catch (err) {
      setError(err?.message || "Failed to change password.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <Card>
        <CardHeader>
          <CardTitle>Account Information</CardTitle>
          <CardDescription>
            User details loaded directly from the backend users module.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading account information...</p>
          ) : !account ? (
            <p className="text-sm text-muted-foreground">No account details found.</p>
          ) : (
            <>
              <div className="rounded-lg border bg-muted/30 px-4 py-3">
                <p className="text-xs font-medium uppercase text-muted-foreground">Display Name</p>
                <p className="mt-1 font-semibold">{account.name || "-"}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <InfoTile label="Username" value={account.username || "-"} />
                <InfoTile label="Email" value={account.email || "-"} />
                <InfoTile label="Phone" value={account.phone || "-"} />
                <InfoTile label="Status" value={account.status || "-"} capitalize />
                <InfoTile
                  label="Roles"
                  value={Array.isArray(account.roles) && account.roles.length ? account.roles.join(", ") : "-"}
                  spanTwo
                />
                <InfoTile label="Created" value={formatReadableDate(account.created_at)} spanTwo />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
          <CardDescription>
            Update your own account password from the settings module.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordChange} className="grid gap-4">
            <div className="grid gap-2">
              <Label>Current Password *</Label>
              <Input
                type="password"
                value={form.current_password}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, current_password: e.target.value }))
                }
              />
            </div>

            <div className="grid gap-2">
              <Label>New Password *</Label>
              <Input
                type="password"
                value={form.new_password}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, new_password: e.target.value }))
                }
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
            {success && <p className="text-sm text-emerald-600">{success}</p>}

            <Button type="submit" disabled={saving}>
              {saving ? "Updating..." : "Update Password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function SecurityPanel({ showNotice }) {
  const { can } = usePermissions();
  const canManageUsers = can("teacher.update");
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(canManageUsers);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    user_id: "",
    new_password: "",
    search: "",
  });

  const filteredUsers = useMemo(() => {
    const query = String(form.search || "").trim().toLowerCase();
    if (!query) return users;
    return users.filter((user) =>
      [user.teacher_name, user.parent_name, user.username, user.email, user.phone]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [form.search, users]);

  useEffect(() => {
    if (!canManageUsers) return;
    loadUsers();
  }, [canManageUsers]);

  async function loadUsers() {
    setLoading(true);
    setError("");
    try {
      const res = await getUsers({ page: 1, limit: 50 });
      setUsers(Array.isArray(res?.data) ? res.data : []);
    } catch (err) {
      setError(err?.message || "Failed to load users.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword(e) {
    e.preventDefault();
    setError("");

    if (!form.user_id || !form.new_password) {
      setError("User and new password are required.");
      return;
    }

    if (form.new_password.length < 6) {
      setError("New password must be at least 6 characters.");
      return;
    }

    setSaving(true);
    try {
      await adminResetPassword({
        user_id: Number(form.user_id),
        new_password: form.new_password,
      });
      const resetUser = users.find((user) => String(user.id) === String(form.user_id));
      setForm({
        user_id: "",
        new_password: "",
        search: "",
      });
      showNotice(
        "Password Reset",
        `Password reset completed for ${resetUser?.teacher_name || resetUser?.parent_name || resetUser?.username || `user #${form.user_id}`}.`
      );
    } catch (err) {
      setError(err?.message || "Failed to reset password.");
    } finally {
      setSaving(false);
    }
  }

  if (!canManageUsers) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Security Settings</CardTitle>
          <CardDescription>Additional security tools require elevated user-management permissions.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Your account can only access personal password changes from the Account Information tab.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[380px_minmax(0,1fr)]">
      <Card>
        <CardHeader>
          <CardTitle>Admin Password Reset</CardTitle>
          <CardDescription>
            Reset another user&apos;s password using the backend users security endpoints.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleResetPassword} className="grid gap-4">
            <div className="grid gap-2">
              <Label>Find User</Label>
              <Input
                placeholder="Search username, email, phone"
                value={form.search}
                onChange={(e) => setForm((prev) => ({ ...prev, search: e.target.value }))}
              />
            </div>

            <div className="grid gap-2">
              <Label>Select User *</Label>
              <select
                className="w-full rounded-md border bg-background px-3 py-2"
                value={form.user_id}
                onChange={(e) => setForm((prev) => ({ ...prev, user_id: e.target.value }))}
              >
                <option value="">Select user</option>
                {filteredUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {(user.teacher_name || user.parent_name || user.username || `User #${user.id}`)}{" "}
                    {user.roles ? `(${user.roles})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-2">
              <Label>New Password *</Label>
              <Input
                type="password"
                value={form.new_password}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, new_password: e.target.value }))
                }
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <Button type="submit" disabled={saving}>
              {saving ? "Resetting..." : "Reset Password"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="min-h-0">
        <CardHeader>
          <CardTitle>Recent User Accounts</CardTitle>
          <CardDescription>
            Select from the current user directory returned by the users backend module.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid max-h-[70vh] gap-3 overflow-y-auto pr-2">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading users...</p>
          ) : filteredUsers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No users found for this search.</p>
          ) : (
            filteredUsers.slice(0, 12).map((user) => (
              <button
                key={user.id}
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, user_id: String(user.id) }))}
                className={`rounded-lg border px-4 py-3 text-left transition ${
                  String(form.user_id) === String(user.id)
                    ? "border-primary bg-primary/5"
                    : "bg-muted/30 hover:bg-muted/50"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">
                      {user.teacher_name || user.parent_name || user.username || `User #${user.id}`}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {user.email || user.phone || "No email/phone"}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">{user.roles || "-"}</span>
                </div>
              </button>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PlaceholderPanel({ title, description }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">This section is not configured yet.</p>
      </CardContent>
    </Card>
  );
}

function InfoTile({ label, value, spanTwo = false, capitalize = false }) {
  return (
    <div className={`rounded-lg border bg-muted/30 px-4 py-3 ${spanTwo ? "sm:col-span-2" : ""}`}>
      <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
      <p className={`mt-1 ${capitalize ? "capitalize" : ""}`}>{value}</p>
    </div>
  );
}

export default function Settings() {
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    if (!notice) return undefined;
    const timeoutId = window.setTimeout(() => setNotice(null), 3500);
    return () => window.clearTimeout(timeoutId);
  }, [notice]);

  function showNotice(title, message, variant = "success") {
    setNotice({
      title,
      message,
      variant: variant === "error" ? "destructive" : variant,
    });
  }

  return (
    <>
      <NoticeBanner notice={notice} />
      <TopBar title="Settings" subTitle="Manage application configuration" />

      <Tabs defaultValue="account-information" orientation="vertical" className="gap-6">
        <TabsList variant="line" className="min-w-[220px] items-stretch border-r pr-4">
          <TabsTrigger value="account-information">Account Information</TabsTrigger>
          <TabsTrigger value="academic-sessions">Academic Sessions</TabsTrigger>
          <TabsTrigger value="streams">Streams</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="general">General</TabsTrigger>
        </TabsList>

        <TabsContent value="account-information">
          <AccountInformationPanel showNotice={showNotice} />
        </TabsContent>

        <TabsContent value="academic-sessions">
          <AcademicSessionsPanel showNotice={showNotice} />
        </TabsContent>

        <TabsContent value="streams">
          <StreamsPanel showNotice={showNotice} />
        </TabsContent>

        <TabsContent value="security">
          <SecurityPanel showNotice={showNotice} />
        </TabsContent>

        <TabsContent value="general">
          <PlaceholderPanel
            title="General Settings"
            description="Secondary navigation slot for future software settings."
          />
        </TabsContent>
      </Tabs>
    </>
  );
}
