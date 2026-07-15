import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
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
  | "users";

type ModuleItem = {
  key: ModuleKey;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
};

type ModuleSection = {
  title: string;
  items: ModuleItem[];
};

const MODULES: Record<ModuleKey, ModuleItem> = {
  dashboard: { key: "dashboard", label: "Dashboard", icon: "grid-outline" },
  classes: { key: "classes", label: "Class", icon: "school-outline" },
  subjects: { key: "subjects", label: "Subject", icon: "book-outline" },
  activities: { key: "activities", label: "Activity", icon: "sparkles-outline" },
  students: { key: "students", label: "Student Info", icon: "people-outline" },
  teachers: { key: "teachers", label: "Teacher", icon: "person-outline" },
  attendance: { key: "attendance", label: "Student Attendance", icon: "calendar-outline" },
  teacherAttendance: { key: "teacherAttendance", label: "Teacher Attendance", icon: "finger-print-outline" },
  fees: { key: "fees", label: "Fee Setup", icon: "wallet-outline" },
  payments: { key: "payments", label: "Payment", icon: "card-outline" },
  transportationFee: { key: "transportationFee", label: "Transportation Fee", icon: "bus-outline" },
  messaging: { key: "messaging", label: "Chat", icon: "chatbubble-ellipses-outline" },
  exams: { key: "exams", label: "Exam Setup", icon: "document-text-outline" },
  reports: { key: "reports", label: "Marksheet", icon: "bar-chart-outline" },
  users: { key: "users", label: "Profile", icon: "person-circle-outline" },
};

const SECTION_DEFINITIONS: Array<{ title: string; keys: ModuleKey[] }> = [
  { title: "Dashboard", keys: ["dashboard"] },
  { title: "Academics", keys: ["classes", "subjects", "activities", "exams"] },
  { title: "Student", keys: ["students", "attendance"] },
  { title: "Fee", keys: ["fees", "payments", "transportationFee"] },
  { title: "Staff", keys: ["teachers", "teacherAttendance"] },
  { title: "Utilities", keys: ["messaging"] },
  { title: "Marksheet", keys: ["reports"] },
  { title: "Settings", keys: ["users"] },
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

  const sections = SECTION_DEFINITIONS.map<ModuleSection>((section) => ({
    title: section.title,
    items: section.keys
      .filter((key) => canViewModule(key, roles, permissions))
      .map((key) => MODULES[key]),
  })).filter((section) => section.items.length);

  function openModule(key: ModuleKey) {
    navigation.navigate("AppShell", { tab: key });
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
          <Text style={[styles.headerTitle, { color: theme.text }]}>More</Text>
          <Text style={[styles.headerSubtitle, { color: theme.subText }]}>Open available LMS modules by section.</Text>
        </View>
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        {sections.map((section) => (
          <View key={section.title} style={styles.sectionBlock}>
            <Text style={[styles.sectionTitle, { color: theme.subText }]}>{section.title}</Text>
            <View style={styles.grid}>
              {section.items.map((item) => (
                <Pressable
                  key={item.key}
                  accessibilityRole="button"
                  accessibilityLabel={item.label}
                  style={[styles.gridItem, { backgroundColor: theme.card, borderColor: theme.border }]}
                  onPress={() => openModule(item.key)}
                >
                  <View style={[styles.iconWrap, { backgroundColor: theme.cardMuted, borderColor: theme.border }]}>
                    <Ionicons name={item.icon} size={22} color={theme.icon} />
                  </View>
                  <Text style={[styles.itemText, { color: theme.text }]} numberOfLines={2}>
                    {item.label}
                  </Text>
                </Pressable>
              ))}
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
  headerSubtitle: { fontSize: 12, fontWeight: "600", marginTop: 2 },
  body: { flex: 1 },
  content: { paddingHorizontal: 14, paddingTop: 14, paddingBottom: 30, gap: 18 },
  sectionBlock: { gap: 10 },
  sectionTitle: { fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.8 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  gridItem: {
    width: "31%",
    minWidth: 96,
    aspectRatio: 1,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  itemText: { fontSize: 12, fontWeight: "700", textAlign: "center", lineHeight: 16 },
});
