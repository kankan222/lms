import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../../store/authStore";
import { changeMyPassword, getMyAccount, type AccountProfile } from "../../services/usersService";
import {
  disablePushNotifications,
  enablePushNotifications,
  getPushPreference,
} from "../../services/pushNotificationService";
import {
  checkAppUpdate,
  notifyAppUpdateAvailable,
  openAppUpdate,
  showAppUpdatePrompt,
  type AppUpdateInfo,
} from "../../services/appUpdateService";
import { MOBILE_APP_VERSION } from "../../constants/appVersion";
import { formatDateLabel } from "../../utils/format";
import TopNotice from "../../components/feedback/TopNotice";
import { useAppTheme } from "../../theme/AppThemeProvider";

type NoticeTone = "success" | "error";

function getErrorMessage(err: unknown, fallback: string) {
  if (
    typeof err === "object" &&
    err &&
    "response" in err &&
    typeof (err as { response?: { data?: { message?: string; error?: string } } }).response?.data === "object"
  ) {
    const data = (err as { response?: { data?: { message?: string; error?: string } } }).response?.data;
    return data?.error || data?.message || fallback;
  }
  return fallback;
}

function SectionCard({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  const { theme } = useAppTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={styles.rowBetween}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>{title}</Text>
        {hint ? <Text style={[styles.muted, { color: theme.subText }]}>{hint}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function ProfileBadge({ label }: { label: string }) {
  const { theme } = useAppTheme();
  return (
    <View style={[styles.profileBadge, { backgroundColor: theme.successSoft, borderColor: theme.successBorder }]}>
      <Text style={[styles.profileBadgeText, { color: theme.success }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

function DetailIcon({ name }: { name: keyof typeof Ionicons.glyphMap }) {
  const { theme } = useAppTheme();
  return (
    <View style={[styles.detailIcon, { backgroundColor: theme.successSoft, borderColor: theme.successBorder }]}>
      <Ionicons name={name} size={18} color={theme.success} />
    </View>
  );
}

function InfoRow({ label, value, icon }: { label: string; value: string; icon: keyof typeof Ionicons.glyphMap }) {
  const { theme } = useAppTheme();
  return (
    <View style={[styles.infoRow, { borderColor: theme.border }]}>
      <DetailIcon name={icon} />
      <Text style={[styles.infoLabel, { color: theme.subText }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: theme.text }]} numberOfLines={2}>{value}</Text>
    </View>
  );
}

export default function ProfileTab() {
  const { theme, isDark } = useAppTheme();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const roles = Array.isArray(user?.roles) ? user.roles : [];
  const isSuperAdmin = roles.some((role) => {
    const normalized = String(role || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
    return normalized === "super_admin" || normalized === "superadmin";
  });
  const canReceivePush = Boolean(user?.id);

  const [account, setAccount] = useState<AccountProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [pushEnabled, setPushEnabled] = useState<boolean | null>(null);
  const [pushSaving, setPushSaving] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<AppUpdateInfo | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [notifyingUpdate, setNotifyingUpdate] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    current_password: "",
    new_password: "",
  });
  const [notice, setNotice] = useState<{
    title: string;
    message: string;
    tone: NoticeTone;
  } | null>(null);
  const displayName = account?.name || user?.name || "-";
  const displayUsername = account?.username || "-";
  const displayRoles = account?.roles || user?.roles || [];
  const profileInitial = String(displayName || "P").slice(0, 1).toUpperCase();

  useEffect(() => {
    loadAccount();
  }, []);

  useEffect(() => {
    if (!canReceivePush) {
      setPushEnabled(null);
      return;
    }

    let active = true;
    getPushPreference()
      .then((value) => {
        if (active) setPushEnabled(value !== false);
      })
      .catch(() => {
        if (active) setPushEnabled(false);
      });

    return () => {
      active = false;
    };
  }, [canReceivePush]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), 3200);
    return () => clearTimeout(timer);
  }, [notice]);

  async function loadAccount(mode: "initial" | "refresh" = "initial") {
    if (mode === "refresh") setRefreshing(true);
    else setLoading(true);
    try {
      setAccount((await getMyAccount()) ?? null);
    } catch (err: unknown) {
      setNotice({
        title: "Account Unavailable",
        message: getErrorMessage(err, "Failed to load account details."),
        tone: "error",
      });
      setAccount(null);
    } finally {
      if (mode === "refresh") setRefreshing(false);
      else setLoading(false);
    }
  }

  async function handleChangePassword() {
    if (!passwordForm.current_password || !passwordForm.new_password) {
      setNotice({
        title: "Validation",
        message: "Current password and new password are required.",
        tone: "error",
      });
      return;
    }

    setPasswordSaving(true);
    try {
      await changeMyPassword(passwordForm);
      setPasswordOpen(false);
      setPasswordForm({ current_password: "", new_password: "" });
      setNotice({
        title: "Password Changed",
        message: "Your password was updated successfully.",
        tone: "success",
      });
    } catch (err: unknown) {
      setNotice({
        title: "Update Failed",
        message: getErrorMessage(err, "Failed to change password."),
        tone: "error",
      });
    } finally {
      setPasswordSaving(false);
    }
  }

  async function togglePushNotifications() {
    if (!canReceivePush || pushSaving) return;
    setPushSaving(true);
    try {
      const nextEnabled = !pushEnabled;
      if (nextEnabled) {
        const enabled = await enablePushNotifications(user);
        setPushEnabled(enabled);
        setNotice({
          title: enabled ? "Notifications Enabled" : "Permission Needed",
          message: enabled
            ? "Push notifications are enabled for this device."
            : "Allow notifications from your device settings to receive push alerts.",
          tone: enabled ? "success" : "error",
        });
      } else {
        await disablePushNotifications();
        setPushEnabled(false);
        setNotice({
          title: "Notifications Disabled",
          message: "Push notifications are disabled on this device. The in-app inbox remains available.",
          tone: "success",
        });
      }
    } catch (err: unknown) {
      setNotice({
        title: "Update Failed",
        message: getErrorMessage(err, "Failed to update push notification settings."),
        tone: "error",
      });
    } finally {
      setPushSaving(false);
    }
  }

  async function handleCheckUpdate() {
    setCheckingUpdate(true);
    try {
      const info = await checkAppUpdate();
      setUpdateInfo(info);
      if (info?.update_available) {
        showAppUpdatePrompt(info, { force: true });
      } else {
        setNotice({
          title: "App Is Current",
          message: `You are using version ${MOBILE_APP_VERSION}.`,
          tone: "success",
        });
      }
    } catch (err: unknown) {
      setNotice({
        title: "Update Check Failed",
        message: getErrorMessage(err, "Could not check for app updates."),
        tone: "error",
      });
    } finally {
      setCheckingUpdate(false);
    }
  }

  async function handleOpenUpdate() {
    await openAppUpdate(updateInfo);
  }

  async function handleNotifyUpdate() {
    if (!isSuperAdmin || notifyingUpdate) return;
    setNotifyingUpdate(true);
    try {
      const result = await notifyAppUpdateAvailable();
      setNotice({
        title: "Notification Sent",
        message: `App update notification sent to ${result.notified} users.`,
        tone: "success",
      });
    } catch (err: unknown) {
      setNotice({
        title: "Notification Failed",
        message: getErrorMessage(err, "Could not notify users about the app update."),
        tone: "error",
      });
    } finally {
      setNotifyingUpdate(false);
    }
  }

  return (
    <View style={styles.screen}>
      <TopNotice notice={notice} style={styles.topNoticeOverlay} />
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadAccount("refresh")} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.innerContent}>
      <Text style={[styles.moduleLabel, { color: theme.subText }]}>PROFILE</Text>
      <View style={[styles.heroCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={[styles.avatarBadge, { backgroundColor: theme.successSoft, borderColor: theme.successBorder }]}>
          <Text style={[styles.avatarText, { color: theme.success }]}>{profileInitial}</Text>
        </View>
        <View style={styles.heroCopy}>
          <Text style={[styles.heroTitle, { color: theme.subText }]} numberOfLines={1}>My Profile</Text>
          <Text style={[styles.profileName, { color: theme.text }]} numberOfLines={1}>{displayName}</Text>
          <Text style={[styles.heroSubtitle, { color: theme.subText }]} numberOfLines={1}>{displayUsername}</Text>
          <View style={styles.profileBadgeRow}>
            {displayRoles.length ? displayRoles.map((role) => <ProfileBadge key={role} label={role.replace(/_/g, " ")} />) : <ProfileBadge label="user" />}
          </View>
        </View>
      </View>

      <SectionCard title="Account Information" hint={account?.status || "-"}>
        {loading ? (
          <ActivityIndicator size="small" color={theme.text} />
        ) : (
          <>
            <InfoRow label="Name" value={displayName} icon="person-outline" />
            <InfoRow label="Username" value={account?.username || "-"} icon="at-outline" />
            <InfoRow label="Email" value={account?.email || user?.email || "-"} icon="mail-outline" />
            <InfoRow label="Phone" value={account?.phone || "-"} icon="call-outline" />
            <InfoRow label="Roles" value={displayRoles.join(", ") || "-"} icon="shield-checkmark-outline" />
            <InfoRow label="Created" value={formatDateLabel(account?.created_at)} icon="calendar-outline" />
          </>
        )}
      </SectionCard>

      <SectionCard title="Account Actions">
        <View style={styles.actionRow}>
          {isSuperAdmin ? (
            <Pressable
              style={[
                styles.secondaryBtn,
                { borderColor: theme.border, backgroundColor: theme.cardMuted },
              ]}
              onPress={() => setPasswordOpen(true)}
            >
              <Text style={[styles.secondaryBtnText, { color: theme.text }]}>Change Password</Text>
            </Pressable>
          ) : null}
          <Pressable style={[styles.deleteBtn, { borderColor: theme.dangerBorder, backgroundColor: theme.dangerSoft }]} onPress={() => logout()}>
            <Text style={[styles.deleteBtnText, { color: theme.danger }]}>Logout</Text>
          </Pressable>
        </View>
      </SectionCard>

      {canReceivePush ? (
        <SectionCard title="Notifications" hint={pushEnabled ? "Push On" : "Push Off"}>
          <View style={styles.pushRow}>
            <View style={styles.pushCopy}>
              <Text style={[styles.pushTitle, { color: theme.text }]}>Push Notifications</Text>
              <Text style={[styles.muted, { color: theme.subText }]}>
                Receive message, attendance, marksheet, fee, account, and system alerts on this device.
              </Text>
            </View>
            <Pressable
              style={[
                styles.toggle,
                {
                  borderColor: pushEnabled ? theme.success : theme.border,
                  backgroundColor: pushEnabled ? theme.success : theme.cardMuted,
                  opacity: pushSaving ? 0.65 : 1,
                },
              ]}
              onPress={togglePushNotifications}
              disabled={pushSaving}
            >
              <View
                style={[
                  styles.toggleKnob,
                  {
                    backgroundColor: pushEnabled ? theme.successText : theme.subText,
                    transform: [{ translateX: pushEnabled ? 18 : 0 }],
                  },
                ]}
              />
            </Pressable>
          </View>
        </SectionCard>
      ) : null}

      <SectionCard
        title="App Updates"
        hint={updateInfo?.update_available ? (updateInfo.required ? "Required" : "Available") : `v${MOBILE_APP_VERSION}`}
      >
        <View style={styles.pushRow}>
          <View style={styles.pushCopy}>
            <Text style={[styles.pushTitle, { color: theme.text }]}>Installed Version</Text>
            <Text style={[styles.muted, { color: theme.subText }]}>
              {updateInfo
                ? `Latest version ${updateInfo.latest_version}${updateInfo.latest_build ? ` (${updateInfo.latest_build})` : ""}`
                : `Current version ${MOBILE_APP_VERSION}`}
            </Text>
          </View>
          <Pressable
            style={[styles.compactPrimaryBtn, { backgroundColor: theme.primary, opacity: checkingUpdate ? 0.65 : 1 }]}
            onPress={handleCheckUpdate}
            disabled={checkingUpdate}
          >
            <Text style={[styles.primaryBtnText, { color: theme.primaryText }]}>
              {checkingUpdate ? "Checking..." : "Check"}
            </Text>
          </Pressable>
        </View>
        {updateInfo?.update_available ? (
          <Pressable style={[styles.secondaryBtn, { borderColor: theme.successBorder, backgroundColor: theme.successSoft }]} onPress={handleOpenUpdate}>
            <Text style={[styles.secondaryBtnText, { color: theme.success }]}>Update App</Text>
          </Pressable>
        ) : null}
        {isSuperAdmin ? (
          <Pressable
            style={[styles.secondaryBtn, { borderColor: theme.border, backgroundColor: theme.cardMuted, opacity: notifyingUpdate ? 0.65 : 1 }]}
            onPress={handleNotifyUpdate}
            disabled={notifyingUpdate}
          >
            <Text style={[styles.secondaryBtnText, { color: theme.text }]}>
              {notifyingUpdate ? "Sending..." : "Notify Users About Update"}
            </Text>
          </Pressable>
        ) : null}
      </SectionCard>

      <Modal visible={isSuperAdmin && passwordOpen} transparent animationType="slide" onRequestClose={() => setPasswordOpen(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={[styles.modalBackdrop, { backgroundColor: theme.overlay }]} onPress={() => setPasswordOpen(false)} />
          <View style={[styles.modalCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Change Password</Text>
            <Text style={[styles.muted, { color: theme.subText }]}>Update your password for this account.</Text>
            <TextInput
              style={[styles.input, { borderColor: theme.border, backgroundColor: theme.inputBg, color: theme.text }]}
              placeholder="Current password"
              placeholderTextColor={theme.mutedText}
              secureTextEntry
              value={passwordForm.current_password}
              onChangeText={(value) => setPasswordForm((prev) => ({ ...prev, current_password: value }))}
            />
            <TextInput
              style={[styles.input, { borderColor: theme.border, backgroundColor: theme.inputBg, color: theme.text }]}
              placeholder="New password"
              placeholderTextColor={theme.mutedText}
              secureTextEntry
              value={passwordForm.new_password}
              onChangeText={(value) => setPasswordForm((prev) => ({ ...prev, new_password: value }))}
            />
            <View style={styles.actionRow}>
            <Pressable
              style={[
                styles.secondaryBtn,
                { borderColor: theme.border, backgroundColor: theme.cardMuted },
              ]}
              onPress={() => setPasswordOpen(false)}
            >
              <Text style={[styles.secondaryBtnText, { color: theme.text }]}>Cancel</Text>
            </Pressable>
              <Pressable
                style={[
                  styles.primaryBtn,
                  { backgroundColor: theme.primary },
                ]}
                onPress={handleChangePassword}
                disabled={passwordSaving}
              >
                <Text style={[styles.primaryBtnText, { color: theme.primaryText }]}>
                  {passwordSaving ? "Saving..." : "Update"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  container: {
    gap: 14,
    paddingBottom: 120,
  },
  innerContent: {
    gap: 14,
    paddingHorizontal: 14,
    paddingTop: 10,
  },
  topNoticeOverlay: {
    position: "absolute",
    top: 0,
    left: 14,
    right: 14,
    zIndex: 20,
  },
  heroCard: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  moduleLabel: { fontSize: 13, lineHeight: 16, fontWeight: "900", letterSpacing: 0.8 },
  heroCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  heroEyebrow: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  heroTitle: {
    fontWeight: "700",
    fontSize: 12,
  },
  profileName: {
    fontSize: 16,
    fontWeight: "800",
  },
  heroSubtitle: {
    fontSize: 12,
    lineHeight: 20,
  },
  avatarBadge: {
    width: 56,
    height: 56,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 20,
    fontWeight: "800",
  },
  profileBadgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginTop: 2,
  },
  profileBadge: {
    maxWidth: "100%",
    borderWidth: 1,
    borderRadius: 9,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  profileBadgeText: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  noticeCard: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  noticeSuccess: {
    borderColor: "#bbf7d0",
    backgroundColor: "#f0fdf4",
  },
  noticeError: {
    borderColor: "#fecaca",
    backgroundColor: "#fef2f2",
  },
  noticeTitle: {
    color: "#0f172a",
    fontWeight: "800",
    marginBottom: 2,
  },
  noticeMessage: {
    color: "#475569",
  },
  card: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 16,
    gap: 12,
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  sectionTitle: {
    fontWeight: "800",
    fontSize: 16,
  },
  muted: {
    fontSize: 12,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
  },
  detailIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: "700",
    flex: 1,
  },
  infoValue: {
    fontWeight: "800",
    flexShrink: 1,
    maxWidth: "48%",
    textAlign: "right",
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 10,
    marginTop: 4,
  },
  pushRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  pushCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  pushTitle: {
    fontSize: 14,
    fontWeight: "800",
  },
  toggle: {
    width: 48,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    padding: 3,
    justifyContent: "center",
  },
  toggleKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  primaryBtn: {
    flex: 1,
    backgroundColor: "#0f172a",
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: {
    color: "#ffffff",
    fontWeight: "700",
  },
  compactPrimaryBtn: {
    minHeight: 40,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtn: {
    flex: 1,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtnText: {
    fontWeight: "700",
  },
  deleteBtn: {
    flex: 1,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteBtnText: {
    fontWeight: "700",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalCard: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    padding: 16,
    paddingBottom: 32,
    marginBottom: 12,
    gap: 12,
  },
  modalTitle: {
    fontWeight: "700",
    fontSize: 18,
  },
});
