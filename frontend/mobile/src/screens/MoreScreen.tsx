import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useMemo, useState } from "react";
import type { RootStackParamList } from "../navigation/AppNavigator";
import { useAuthStore } from "../store/authStore";
import { useAppTheme } from "../theme/AppThemeProvider";

type Props = NativeStackScreenProps<RootStackParamList, "More">;
type ModuleKey =
  | "dashboard"
  | "classes"
  | "subjects"
  | "activities"
  | "students"
  | "teachers"
  | "attendance"
  | "teacherAttendance"
  | "fees"
  | "payments"
  | "transportationFee"
  | "messaging"
  | "exams"
  | "reports"
  | "users"
  | "notifications";

type ModuleItem = {
  key: ModuleKey;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  description: string;
  tone: "blue" | "green" | "violet" | "orange" | "coral";
};

type ModuleSection = {
  title: string;
  items: ModuleItem[];
};

const MODULES: Record<ModuleKey, ModuleItem> = {
  dashboard: { key: "dashboard", label: "Dashboard", icon: "grid-outline", description: "School overview", tone: "blue" },
  classes: { key: "classes", label: "Class", icon: "school-outline", description: "Manage classes", tone: "blue" },
  subjects: { key: "subjects", label: "Subject", icon: "book-outline", description: "Manage subjects", tone: "green" },
  activities: { key: "activities", label: "Activity", icon: "sparkles-outline", description: "Co-curricular", tone: "violet" },
  students: { key: "students", label: "Student Info", icon: "people-outline", description: "Manage students", tone: "green" },
  teachers: { key: "teachers", label: "Teacher", icon: "person-outline", description: "Teaching staff", tone: "violet" },
  attendance: { key: "attendance", label: "Attendance", icon: "calendar-outline", description: "Today's records", tone: "violet" },
  teacherAttendance: { key: "teacherAttendance", label: "Teacher Attendance", icon: "finger-print-outline", description: "Staff attendance", tone: "blue" },
  fees: { key: "fees", label: "Fee Setup", icon: "wallet-outline", description: "Fee structure", tone: "orange" },
  payments: { key: "payments", label: "Payment", icon: "card-outline", description: "Fee collections", tone: "orange" },
  transportationFee: { key: "transportationFee", label: "Transportation Fee", icon: "bus-outline", description: "Transport dues", tone: "orange" },
  messaging: { key: "messaging", label: "Chat", icon: "chatbubble-ellipses-outline", description: "Messages", tone: "blue" },
  exams: { key: "exams", label: "Exam Setup", icon: "document-text-outline", description: "Configure exams", tone: "coral" },
  reports: { key: "reports", label: "Marksheet", icon: "bar-chart-outline", description: "Result reports", tone: "blue" },
  users: { key: "users", label: "Profile", icon: "person-circle-outline", description: "Account settings", tone: "violet" },
  notifications: { key: "notifications", label: "Notifications", icon: "notifications-outline", description: "Alerts inbox", tone: "coral" },
};

const SECTION_DEFINITIONS: Array<{ title: string; description: string; icon: keyof typeof Ionicons.glyphMap; tone: ModuleItem["tone"]; keys: ModuleKey[] }> = [
  { title: "Dashboard", description: "School summary and activity", icon: "grid-outline", tone: "blue", keys: ["dashboard"] },
  { title: "Academics", description: "Classes, subjects, exams and activities", icon: "book-outline", tone: "blue", keys: ["classes", "subjects", "activities", "exams"] },
  { title: "Students", description: "Student lifecycle and attendance", icon: "people-outline", tone: "green", keys: ["students", "attendance"] },
  { title: "Fees", description: "Fees, payments and transport dues", icon: "wallet-outline", tone: "orange", keys: ["fees", "payments", "transportationFee"] },
  { title: "Staff", description: "Teaching and non-teaching staff", icon: "person-outline", tone: "violet", keys: ["teachers", "teacherAttendance"] },
  { title: "Utilities", description: "Messages, alerts and account tools", icon: "apps-outline", tone: "coral", keys: ["messaging", "notifications", "users"] },
  { title: "Reports", description: "Marksheets and result reports", icon: "bar-chart-outline", tone: "blue", keys: ["reports"] },
];

function hasAny(permissions: string[], list: string[]) {
  return list.some((permission) => permissions.includes(permission));
}

function hasRole(roles: string[], role: string) {
  return roles.some((value) => String(value).toLowerCase() === role);
}

function canViewModule(moduleKey: ModuleKey, roles: string[], permissions: string[]) {
  if (hasRole(roles, "super_admin")) return true;

  const isParent = hasRole(roles, "parent");
  const isTeacher = hasRole(roles, "teacher");

  switch (moduleKey) {
    case "dashboard":
      if (isTeacher) return false;
      return permissions.includes("dashboard.view");
    case "classes":
      if (isTeacher) return false;
      return hasAny(permissions, ["academic.create", "academic.update", "academic.delete", "dashboard.view"]);
    case "subjects":
      if (isTeacher) return false;
      return hasAny(permissions, ["subjects.view", "subjects.assign"]);
    case "activities":
      if (isTeacher) return false;
      return hasAny(permissions, ["academic.view", "academic.create", "academic.update", "academic.delete"]);
    case "students":
      if (isTeacher) return false;
      return permissions.includes("student.view");
    case "teachers":
      return permissions.includes("teacher.view");
    case "attendance":
      if (isParent) return false;
      return hasAny(permissions, [
        "attendance.take",
        "student_attendance.take",
        "student_attendance.view",
        "student_attendance.review",
        "student_attendance.notify",
      ]);
    case "teacherAttendance":
      if (isParent) return false;
      return permissions.includes("teacher.view");
    case "fees":
      if (isParent || isTeacher) return false;
      return hasAny(permissions, ["fee.view", "fee.create"]);
    case "payments":
      if (isParent || isTeacher) return false;
      return hasAny(permissions, ["payment.view", "payment.create", "payment.update", "payment.delete", "fee.view"]);
    case "transportationFee":
      if (isParent || isTeacher) return false;
      return hasAny(permissions, ["fee.view", "fee.create", "payment.view", "payment.create"]);
    case "messaging":
      return hasAny(permissions, ["messages.view", "messages.send"]);
    case "exams":
      if (isTeacher) return false;
      return hasAny(permissions, ["exams.view", "exams.create", "exams.update", "exams.delete"]);
    case "reports":
      if (isParent) return false;
      return hasAny(permissions, ["marks.view", "marks.enter", "marks.approve"]);
    case "users":
      return true;
    case "notifications":
      return hasRole(roles, "super_admin") || permissions.includes("notifications.view");
    default:
      return false;
  }
}

export default function MoreScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { theme } = useAppTheme();
  const user = useAuthStore((state) => state.user);
  const roles = Array.isArray(user?.roles) ? user.roles : [];
  const permissions = Array.isArray(user?.permissions) ? user.permissions : [];
  const [search, setSearch] = useState("");
  const normalizedSearch = search.trim().toLowerCase();
  const sections = useMemo(
    () => SECTION_DEFINITIONS.map<ModuleSection>((section) => ({
      title: section.title,
      items: section.keys
        .filter((key) => canViewModule(key, roles, permissions))
        .map((key) => MODULES[key])
        .filter((item) =>
          !normalizedSearch ||
          item.label.toLowerCase().includes(normalizedSearch) ||
          item.description.toLowerCase().includes(normalizedSearch) ||
          section.title.toLowerCase().includes(normalizedSearch)
        ),
    })).filter((section) => section.items.length),
    [normalizedSearch, permissions, roles],
  );

  function openModule(key: ModuleKey) {
    if (key === "notifications") {
      navigation.navigate("Notifications");
      return;
    }
    navigation.navigate("AppShell", { tab: key });
  }

  function toneColors(tone: ModuleItem["tone"]) {
    if (tone === "green") return { color: "#16a34a", soft: theme.isDark ? "#052e16" : "#ecfdf3", border: theme.isDark ? "#166534" : "#bbf7d0" };
    if (tone === "violet") return { color: theme.isDark ? "#c4b5fd" : "#7c3aed", soft: theme.isDark ? "#2e1065" : "#f3e8ff", border: theme.isDark ? "#6d28d9" : "#e9d5ff" };
    if (tone === "orange") return { color: "#ea580c", soft: theme.isDark ? "#431407" : "#fff7ed", border: theme.isDark ? "#9a3412" : "#fed7aa" };
    if (tone === "coral") return { color: theme.primary, soft: theme.successSoft, border: theme.successBorder };
    return { color: theme.info, soft: theme.infoSoft, border: theme.infoBorder };
  }

  function renderModuleRow(item: ModuleItem, isLast = false) {
    const tone = toneColors(item.tone);
    return (
      <Pressable
        key={item.key}
        accessibilityRole="button"
        accessibilityLabel={item.label}
        style={[styles.moduleRow, { borderBottomColor: theme.border }, isLast && styles.moduleRowLast]}
        onPress={() => openModule(item.key)}
      >
        <View style={[styles.moduleIcon, { backgroundColor: tone.soft, borderColor: tone.border }]}>
          <Ionicons name={item.icon} size={22} color={tone.color} />
        </View>
        <View style={styles.moduleCopy}>
          <Text style={[styles.moduleTitle, { color: theme.text }]} numberOfLines={1}>{item.label}</Text>
          <Text style={[styles.moduleDescription, { color: theme.subText }]} numberOfLines={1}>{item.description}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={theme.mutedText} />
      </Pressable>
    );
  }

  return (
    <SafeAreaView edges={["left", "right", "bottom"]} style={[styles.screen, { backgroundColor: theme.bg }]}>
      <View
        style={[
          styles.header,
          {
            backgroundColor: theme.bg,
            borderBottomColor: theme.border,
            paddingTop: Math.max(insets.top, 6),
            minHeight: 62 + Math.max(insets.top, 6),
          },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={[styles.backBtn, { borderColor: theme.border, backgroundColor: theme.card }]}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={18} color={theme.icon} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Modules</Text>
          <Text style={[styles.headerSubtitle, { color: theme.subText }]}>Open available LMS modules.</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Search modules"
          style={[styles.backBtn, { borderColor: theme.border, backgroundColor: theme.card }]}
        >
          <Ionicons name="search-outline" size={18} color={theme.icon} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.searchRow}>
          <View style={[styles.searchBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Ionicons name="search-outline" size={18} color={theme.subText} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              style={[styles.searchInput, { color: theme.text }]}
              placeholder="Search modules..."
              placeholderTextColor={theme.mutedText}
            />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            style={[styles.filterButton, { backgroundColor: theme.card, borderColor: theme.border }]}
            onPress={() => setSearch("")}
          >
            <Ionicons name="options-outline" size={18} color={theme.icon} />
          </Pressable>
        </View>

        {sections.map((section) => (
          <View key={section.title} style={styles.moduleSection}>
            <Text style={[styles.sectionHeader, { color: theme.mutedText }]}>{section.title.toUpperCase()}</Text>
            <View style={[styles.moduleList, { backgroundColor: theme.card, borderColor: theme.border }]}>
              {section.items.map((item, index) => renderModuleRow(item, index === section.items.length - 1))}
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCopy: { flex: 1, minWidth: 0 },
  headerTitle: { fontSize: 18, fontWeight: "800" },
  headerSubtitle: { fontSize: 12, fontWeight: "400", marginTop: 2 },
  body: { flex: 1 },
  content: { paddingHorizontal: 14, paddingTop: 14, paddingBottom: 112, gap: 18 },
  searchRow: { flexDirection: "row", gap: 10 },
  searchBox: { flex: 1, minHeight: 46, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 10 },
  searchInput: { flex: 1, minWidth: 0, fontSize: 14, fontWeight: "600", paddingVertical: 0 },
  filterButton: { width: 46, height: 46, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  moduleSection: { gap: 8 },
  sectionHeader: { paddingHorizontal: 4, fontSize: 11, lineHeight: 14, fontWeight: "800", letterSpacing: 0.8 },
  moduleList: { borderWidth: 1, borderRadius: 14, overflow: "hidden" },
  moduleRow: {
    minHeight: 68,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  moduleRowLast: { borderBottomWidth: 0 },
  moduleIcon: { width: 42, height: 42, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  moduleCopy: { flex: 1, minWidth: 0 },
  moduleTitle: { fontSize: 14, fontWeight: "800" },
  moduleDescription: { marginTop: 3, fontSize: 12, fontWeight: "600" },
});
