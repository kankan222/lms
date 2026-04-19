import { useCallback, useEffect, useState } from "react";
import TopBar from "../components/TopBar";
import { Button } from "../components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  deleteAttendanceDeviceUser,
  getAttendanceDevices,
  getAttendanceDeviceUsers,
  getTeachers,
  upsertAttendanceDeviceUser,
} from "../api/teachers.api";
import { usePermissions } from "../hooks/usePermissions";
import { formatReadableDateTime } from "../lib/dateTime";

const FIELD_CLASSNAME =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-xs outline-hidden transition focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-60";

function SectionShell({ title, description, action, children }) {
  return (
    <div className="space-y-4 rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">{title}</h3>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

export default function TeacherDeviceMapping({ embedded = false } = {}) {
  const { can } = usePermissions();
  const canManageDeviceMappings = can("teacher.assign");

  const [error, setError] = useState("");
  const [notice, setNotice] = useState(null);
  const [attendanceDevices, setAttendanceDevices] = useState([]);
  const [teacherOptions, setTeacherOptions] = useState([]);
  const [deviceUserMappings, setDeviceUserMappings] = useState([]);
  const [deviceUserLoading, setDeviceUserLoading] = useState(false);
  const [deviceUserSaving, setDeviceUserSaving] = useState(false);
  const [deletingDeviceUserId, setDeletingDeviceUserId] = useState(null);
  const [deviceUserFilterId, setDeviceUserFilterId] = useState("");
  const [deviceUserForm, setDeviceUserForm] = useState({
    device_id: "",
    device_user_id: "",
    teacher_id: "",
  });

  const loadDeviceUserMappings = useCallback(async () => {
    if (!canManageDeviceMappings) return;
    setDeviceUserLoading(true);
    try {
      const res = await getAttendanceDeviceUsers({
        device_id: deviceUserFilterId || undefined,
      });
      setDeviceUserMappings(Array.isArray(res?.data) ? res.data : []);
    } catch (err) {
      setDeviceUserMappings([]);
      setError(err?.message || "Failed to load device user mappings.");
    } finally {
      setDeviceUserLoading(false);
    }
  }, [canManageDeviceMappings, deviceUserFilterId]);

  const loadDeviceUserSetup = useCallback(async () => {
    if (!canManageDeviceMappings) return;
    try {
      const [deviceRes, teacherRes] = await Promise.all([
        getAttendanceDevices(),
        getTeachers(),
      ]);
      setAttendanceDevices(Array.isArray(deviceRes?.data) ? deviceRes.data : []);
      setTeacherOptions(Array.isArray(teacherRes?.data) ? teacherRes.data : []);
    } catch (err) {
      setAttendanceDevices([]);
      setTeacherOptions([]);
      setError(err?.message || "Failed to load device mapping options.");
    }
  }, [canManageDeviceMappings]);

  useEffect(() => {
    if (!canManageDeviceMappings) return;
    loadDeviceUserSetup();
  }, [canManageDeviceMappings, loadDeviceUserSetup]);

  useEffect(() => {
    loadDeviceUserMappings();
  }, [loadDeviceUserMappings]);

  useEffect(() => {
    if (!notice) return undefined;
    const timeoutId = window.setTimeout(() => setNotice(null), 3500);
    return () => window.clearTimeout(timeoutId);
  }, [notice]);

  async function handleSaveDeviceUserMapping() {
    const deviceId = String(deviceUserForm.device_id || "").trim();
    const teacherId = String(deviceUserForm.teacher_id || "").trim();
    const deviceUserId = String(deviceUserForm.device_user_id || "").trim();

    if (!deviceId || !teacherId || !deviceUserId) {
      setError("Device, machine user ID, and teacher are required for mapping.");
      return;
    }

    setDeviceUserSaving(true);
    setError("");

    try {
      await upsertAttendanceDeviceUser({
        device_id: Number(deviceId),
        teacher_id: Number(teacherId),
        device_user_id: deviceUserId,
      });

      setDeviceUserForm((prev) => ({
        ...prev,
        device_user_id: "",
      }));
      setNotice({
        title: "Mapping Saved",
        message: "Device user mapping saved successfully.",
      });
      await loadDeviceUserMappings();
    } catch (err) {
      setError(err?.message || "Failed to save device user mapping.");
    } finally {
      setDeviceUserSaving(false);
    }
  }

  async function handleDeleteDeviceUserMapping(mappingId) {
    if (!mappingId || deletingDeviceUserId) return;

    setDeletingDeviceUserId(mappingId);
    setError("");
    try {
      await deleteAttendanceDeviceUser(mappingId);
      setNotice({
        title: "Mapping Deleted",
        message: "Device user mapping removed.",
      });
      await loadDeviceUserMappings();
    } catch (err) {
      setError(err?.message || "Failed to delete device user mapping.");
    } finally {
      setDeletingDeviceUserId(null);
    }
  }

  return (
    <>
      {notice ? (
        embedded ? (
          <Alert className="overflow-hidden border shadow-sm">
            <AlertTitle>{notice.title}</AlertTitle>
            <AlertDescription>{notice.message}</AlertDescription>
          </Alert>
        ) : (
          <div className="pointer-events-none fixed top-6 right-6 z-50 w-full max-w-sm">
            <Alert className="pointer-events-auto overflow-hidden border shadow-xl">
              <AlertTitle>{notice.title}</AlertTitle>
              <AlertDescription>{notice.message}</AlertDescription>
            </Alert>
          </div>
        )
      ) : null}

      {!embedded ? (
        <TopBar
          title="Teacher Device Mapping"
          subTitle="Map each machine user ID per device to the correct teacher."
        />
      ) : null}

      {!canManageDeviceMappings ? (
        <div className={embedded ? "" : "mt-4"}>
          <Alert>
            <AlertTitle>Permission Required</AlertTitle>
            <AlertDescription>
              You do not have permission to manage teacher device user mappings.
            </AlertDescription>
          </Alert>
        </div>
      ) : (
        <div className={embedded ? "" : "mt-4"}>
          <SectionShell
            title="Device User Mapping"
            description="Use this page to maintain machine user to teacher mappings."
            action={(
              <Button
                variant="outline"
                onClick={() => {
                  loadDeviceUserSetup();
                  loadDeviceUserMappings();
                }}
                disabled={deviceUserLoading}
              >
                {deviceUserLoading ? "Refreshing..." : "Refresh"}
              </Button>
            )}
          >
            <div className="grid gap-3 md:grid-cols-4">
              <div className="grid gap-2">
                <Label>Device</Label>
                <select
                  className={FIELD_CLASSNAME}
                  value={deviceUserForm.device_id}
                  onChange={(e) =>
                    setDeviceUserForm((prev) => ({ ...prev, device_id: e.target.value }))
                  }
                >
                  <option value="">Select device</option>
                  {attendanceDevices.map((device) => (
                    <option key={device.id} value={device.id}>
                      {device.device_name || device.device_code || `Device #${device.id}`}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-2">
                <Label>Machine User ID</Label>
                <Input
                  value={deviceUserForm.device_user_id}
                  onChange={(e) =>
                    setDeviceUserForm((prev) => ({ ...prev, device_user_id: e.target.value }))
                  }
                  placeholder="e.g. 00000001"
                />
              </div>

              <div className="grid gap-2">
                <Label>Teacher</Label>
                <select
                  className={FIELD_CLASSNAME}
                  value={deviceUserForm.teacher_id}
                  onChange={(e) =>
                    setDeviceUserForm((prev) => ({ ...prev, teacher_id: e.target.value }))
                  }
                >
                  <option value="">Select teacher</option>
                  {teacherOptions.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.name} ({teacher.employee_id || `ID ${teacher.id}`})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-end">
                <Button onClick={handleSaveDeviceUserMapping} disabled={deviceUserSaving}>
                  {deviceUserSaving ? "Saving..." : "Save Mapping"}
                </Button>
              </div>
            </div>

            <div className="grid gap-2 md:max-w-sm">
              <Label>Filter By Device</Label>
              <select
                className={FIELD_CLASSNAME}
                value={deviceUserFilterId}
                onChange={(e) => setDeviceUserFilterId(e.target.value)}
              >
                <option value="">All devices</option>
                {attendanceDevices.map((device) => (
                  <option key={device.id} value={device.id}>
                    {device.device_name || device.device_code || `Device #${device.id}`}
                  </option>
                ))}
              </select>
            </div>

            {error ? <p className="text-sm text-red-600">{error}</p> : null}

            <div className="rounded-xl border">
              <table className="w-full text-sm">
                <thead className="border-b bg-secondary">
                  <tr>
                    <th className="px-3 py-2 text-left">Device</th>
                    <th className="px-3 py-2 text-left">Machine User ID</th>
                    <th className="px-3 py-2 text-left">Teacher</th>
                    <th className="px-3 py-2 text-left">Updated</th>
                    <th className="px-3 py-2 text-left">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {deviceUserMappings.map((row) => (
                    <tr key={row.id} className="border-b">
                      <td className="px-3 py-2">{row.device_name || row.device_code || "-"}</td>
                      <td className="px-3 py-2">{row.device_user_id || "-"}</td>
                      <td className="px-3 py-2">
                        {row.teacher_name || "-"} {row.employee_id ? `(${row.employee_id})` : ""}
                      </td>
                      <td className="px-3 py-2">{formatReadableDateTime(row.updated_at)}</td>
                      <td className="px-3 py-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteDeviceUserMapping(row.id)}
                          disabled={deletingDeviceUserId === row.id}
                        >
                          {deletingDeviceUserId === row.id ? "Deleting..." : "Delete"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {!deviceUserLoading && deviceUserMappings.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                        No device user mappings found.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </SectionShell>
        </div>
      )}
    </>
  );
}
