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
import { useAuthStore } from "../../store/authStore";
import { changeMyPassword, getMyAccount, type AccountProfile } from "../../services/usersService";
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

function InfoRow({ label, value }: { label: string; value: string }) {
  const { theme } = useAppTheme();
  return (
    <View style={[styles.infoRow, { borderColor: theme.border, backgroundColor: theme.cardMuted }]}>
      <Text style={[styles.infoLabel, { color: theme.subText }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: theme.text }]}>{value}</Text>
    </View>
  );
}

export default function ProfileTab() {
  const { theme, isDark } = useAppTheme();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const isSuperAdmin = Array.isArray(user?.roles) && user.roles.includes("super_admin");

  const [account, setAccount] = useState<AccountProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    current_password: "",
    new_password: "",
  });
  const [notice, setNotice] = useState<{
    title: string;
    message: string;
    tone: NoticeTone;
  } | null>(null);

  useEffect(() => {
    loadAccount();
  }, []);

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

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadAccount("refresh")} />}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.heroCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Text style={[styles.heroTitle, { color: theme.text }]}>My Profile</Text>
        <Text style={[styles.heroSubtitle, { color: theme.subText }]}>
          View your account details, update your password, and log out of the mobile app.
        </Text>
      </View>

      <TopNotice notice={notice} />

      <SectionCard title="Account Information" hint={account?.status || "-"}>
        {loading ? (
          <ActivityIndicator size="small" color={theme.text} />
        ) : (
          <>
            <InfoRow label="Name" value={account?.name || user?.name || "-"} />
            <InfoRow label="Username" value={account?.username || "-"} />
            <InfoRow label="Email" value={account?.email || user?.email || "-"} />
            <InfoRow label="Phone" value={account?.phone || "-"} />
            <InfoRow label="Roles" value={(account?.roles || user?.roles || []).join(", ") || "-"} />
            <InfoRow label="Created" value={formatDateLabel(account?.created_at)} />
          </>
        )}
      </SectionCard>

      <SectionCard title="Account Actions">
        <View style={styles.actionRow}>
          {isSuperAdmin ? (
            <Pressable
              style={[
                styles.secondaryBtn,
                { borderColor: theme.border, backgroundColor: isDark ? theme.cardMuted : "#fff" },
              ]}
              onPress={() => setPasswordOpen(true)}
            >
              <Text style={[styles.secondaryBtnText, { color: theme.text }]}>Change Password</Text>
            </Pressable>
          ) : null}
          <Pressable style={styles.deleteBtn} onPress={() => logout()}>
            <Text style={styles.deleteBtnText}>Logout</Text>
          </Pressable>
        </View>
      </SectionCard>

      <Modal visible={isSuperAdmin && passwordOpen} transparent animationType="slide" onRequestClose={() => setPasswordOpen(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setPasswordOpen(false)} />
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
                { borderColor: theme.border, backgroundColor: isDark ? theme.cardMuted : "#fff" },
              ]}
              onPress={() => setPasswordOpen(false)}
            >
              <Text style={[styles.secondaryBtnText, { color: theme.text }]}>Cancel</Text>
            </Pressable>
              <Pressable
                style={[
                  styles.primaryBtn,
                  { backgroundColor: isDark ? "#f8fafc" : "#0f172a" },
                ]}
                onPress={handleChangePassword}
                disabled={passwordSaving}
              >
                <Text style={[styles.primaryBtnText, { color: isDark ? "#0f172a" : "#ffffff" }]}>
                  {passwordSaving ? "Saving..." : "Update"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 14,
    paddingBottom: 24,
  },
  heroCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
    gap: 6,
  },
  heroTitle: {
    fontWeight: "800",
    fontSize: 22,
  },
  heroSubtitle: {
    lineHeight: 20,
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
    gap: 4,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  infoLabel: {
    fontSize: 12,
    textTransform: "uppercase",
    fontWeight: "700",
  },
  infoValue: {
    fontWeight: "600",
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 10,
    marginTop: 4,
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
    borderColor: "#fecaca",
    backgroundColor: "#fee2e2",
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteBtnText: {
    color: "#b91c1c",
    fontWeight: "700",
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
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  modalTitle: {
    fontWeight: "700",
    fontSize: 18,
  },
});
