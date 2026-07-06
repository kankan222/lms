import { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import type { RootStackParamList } from "../navigation/AppNavigator";
import { useAuthStore } from "../store/authStore";
import { DashboardSummary, getDashboardSummary } from "../services/dashboardService";
import { useAppTheme } from "../theme/AppThemeProvider";
import DashboardTab from "./tabs/DashboardTab";
import ClassesTab from "./tabs/ClassesTab";
import SubjectsTab from "./tabs/SubjectsTab";
import ActivitiesTab from "./tabs/ActivitiesTab";
import StudentsTab from "./tabs/StudentsTab";
import TeachersTab from "./tabs/TeachersTab";
import AttendanceTab from "./tabs/AttendanceTab";
import TeacherAttendanceTab from "./tabs/TeacherAttendanceTab";
import FeesTab from "./tabs/FeesTab";
import PaymentsTab from "./tabs/PaymentsTab";
import TransportationFeeTab from "./tabs/TransportationFeeTab";
import ExamsTab from "./tabs/ExamsTab";
import MessagingTab from "./tabs/MessagingTab";
import ProfileTab from "./tabs/ProfileTab";
import ReportsTab from "./tabs/ReportsTab";
import ModulePlaceholderTab from "./tabs/ModulePlaceholderTab";
import type { ParentConversationRequest } from "./tabs/StudentsTab";
import type { TeacherConversationRequest } from "./tabs/TeachersTab";
import type { ParentConversationIntent } from "./tabs/MessagingTab";

type TabKey =
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

type TabItem = {
  key: TabKey;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
};

const TABS: TabItem[] = [
  { key: "dashboard", label: "Dashboard", icon: "grid-outline" },
  { key: "classes", label: "Class", icon: "school-outline" },
  { key: "subjects", label: "Subjects", icon: "book-outline" },
  { key: "activities", label: "Activities", icon: "sparkles-outline" },
  { key: "students", label: "Students", icon: "people-outline" },
  { key: "teachers", label: "Teachers", icon: "person-outline" },
  { key: "attendance", label: "Student Attendance", icon: "calendar-outline" },
  { key: "teacherAttendance", label: "Teacher Attendance", icon: "finger-print-outline" },
  { key: "fees", label: "Fees", icon: "wallet-outline" },
  { key: "payments", label: "Payments", icon: "card-outline" },
  { key: "transportationFee", label: "Transportation Fee", icon: "bus-outline" },
  { key: "messaging", label: "Messaging", icon: "chatbubble-ellipses-outline" },
  { key: "exams", label: "Exams", icon: "document-text-outline" },
  { key: "reports", label: "Reports", icon: "bar-chart-outline" },
  { key: "users", label: "Profile", icon: "person-circle-outline" },
];

type NavTab = {
  key: TabKey | "more";
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
};

type Props = NativeStackScreenProps<RootStackParamList, "AppShell">;

const MemoClassesTab = memo(ClassesTab);
const MemoSubjectsTab = memo(SubjectsTab);
const MemoActivitiesTab = memo(ActivitiesTab);
const MemoStudentsTab = memo(StudentsTab);
const MemoTeachersTab = memo(TeachersTab);
const MemoAttendanceTab = memo(AttendanceTab);
const MemoTeacherAttendanceTab = memo(TeacherAttendanceTab);
const MemoFeesTab = memo(FeesTab);
const MemoPaymentsTab = memo(PaymentsTab);
const MemoTransportationFeeTab = memo(TransportationFeeTab);
const MemoExamsTab = memo(ExamsTab);
const MemoReportsTab = memo(ReportsTab);
const MemoProfileTab = memo(ProfileTab);

function hasAny(permissions: string[], list: string[]) {
  return list.some((permission) => permissions.includes(permission));
}

function hasRole(roles: string[], role: string) {
  return roles.some((value) => String(value).toLowerCase() === role);
}

function canViewTab(tabKey: TabKey, roles: string[], permissions: string[]) {
  const isSuperAdmin = hasRole(roles, "super_admin");
  if (isSuperAdmin) return true;
  const isParent = hasRole(roles, "parent");
  const isTeacher = hasRole(roles, "teacher");

  switch (tabKey) {
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

function buildPrimaryTabs(roles: string[], permissions: string[]): NavTab[] {
  const isSuperAdmin = hasRole(roles, "super_admin");
  const isTeacher = hasRole(roles, "teacher");
  const isParent = hasRole(roles, "parent");
  const isStaff = hasRole(roles, "staff");
  const isAccounts = hasRole(roles, "accounts");

  if (isSuperAdmin) {
    return [
      { key: "dashboard", label: "Dashboard", icon: "grid-outline" },
      { key: "messaging", label: "Messaging", icon: "chatbubble-ellipses-outline" },
      { key: "users", label: "Profile", icon: "person-circle-outline" },
      { key: "more", label: "More", icon: "apps-outline" },
    ];
  }

  if (isTeacher) {
    return [
      { key: "attendance", label: "Student Att.", icon: "calendar-outline" },
      { key: "teacherAttendance", label: "Teacher Att.", icon: "finger-print-outline" },
      { key: "reports", label: "Reports", icon: "bar-chart-outline" },
      { key: "more", label: "More", icon: "apps-outline" },
    ];
  }

  if (isParent) {
    return [
      { key: "students", label: "Students", icon: "people-outline" },
      { key: "messaging", label: "Messaging", icon: "chatbubble-ellipses-outline" },
      { key: "users", label: "Profile", icon: "person-circle-outline" },
      { key: "more", label: "More", icon: "apps-outline" },
    ];
  }

  if (isStaff) {
    return [
      { key: "messaging", label: "Messaging", icon: "chatbubble-ellipses-outline" },
      { key: "reports", label: "Reports", icon: "bar-chart-outline" },
      { key: "users", label: "Profile", icon: "person-circle-outline" },
      { key: "more", label: "More", icon: "apps-outline" },
    ];
  }

  if (isAccounts) {
    return [
      { key: "payments", label: "Payments", icon: "card-outline" },
      { key: "transportationFee", label: "Transport", icon: "bus-outline" },
      { key: "messaging", label: "Messaging", icon: "chatbubble-ellipses-outline" },
      { key: "users", label: "Profile", icon: "person-circle-outline" },
      { key: "more", label: "More", icon: "apps-outline" },
    ];
  }

  if (permissions.includes("dashboard.view")) {
    return [
      { key: "dashboard", label: "Dashboard", icon: "grid-outline" },
      { key: "messaging", label: "Messaging", icon: "chatbubble-ellipses-outline" },
      { key: "users", label: "Profile", icon: "person-circle-outline" },
      { key: "more", label: "More", icon: "apps-outline" },
    ];
  }

  return [
    { key: "users", label: "Profile", icon: "person-circle-outline" },
    { key: "messaging", label: "Messaging", icon: "chatbubble-ellipses-outline" },
    { key: "reports", label: "Reports", icon: "bar-chart-outline" },
    { key: "more", label: "More", icon: "apps-outline" },
  ];
}

function resolveDefaultTab(roles: string[], permissions: string[], visibleTabs: TabKey[]) {
  const preferredOrder = hasRole(roles, "super_admin")
    ? (["dashboard", "messaging", "students", "reports", "users"] as TabKey[])
    : hasRole(roles, "teacher")
      ? (["attendance", "teacherAttendance", "reports", "messaging", "teachers", "students", "users"] as TabKey[])
      : hasRole(roles, "parent")
        ? (["students", "messaging", "users"] as TabKey[])
        : hasRole(roles, "staff")
          ? (["reports", "messaging", "attendance", "users"] as TabKey[])
          : hasRole(roles, "accounts")
            ? (["payments", "transportationFee", "messaging", "fees", "users"] as TabKey[])
          : permissions.includes("dashboard.view")
            ? (["dashboard", "reports", "students", "messaging", "users"] as TabKey[])
            : (["users", "reports", "messaging"] as TabKey[]);

  return preferredOrder.find((tab) => visibleTabs.includes(tab)) ?? visibleTabs[0] ?? "users";
}

export default function AppShellScreen({ navigation, route }: Props) {
  const user = useAuthStore((state) => state.user);
  const insets = useSafeAreaInsets();
  const { theme, isDark, toggleTheme } = useAppTheme();
  const roles = Array.isArray(user?.roles) ? user.roles : [];
  const permissions = Array.isArray(user?.permissions) ? user.permissions : [];
  const visibleTabs = useMemo(
    () => TABS.filter((tab) => canViewTab(tab.key, roles, permissions)).map((tab) => tab.key),
    [permissions, roles],
  );
  const primaryTabs = useMemo(() => {
    const baseTabs = buildPrimaryTabs(roles, permissions);
    const filtered = baseTabs.filter((tab) => tab.key === "more" || visibleTabs.includes(tab.key as TabKey));
    return filtered.length ? filtered : buildPrimaryTabs([], []);
  }, [permissions, roles, visibleTabs]);
  const defaultTab = useMemo(
    () => resolveDefaultTab(roles, permissions, visibleTabs),
    [permissions, roles, visibleTabs],
  );

  const [activeTab, setActiveTab] = useState<TabKey>(defaultTab);
  const [mountedTabs, setMountedTabs] = useState<TabKey[]>([defaultTab]);
  const [isMessagingConversationOpen, setIsMessagingConversationOpen] = useState(false);
  const [parentConversationIntent, setParentConversationIntent] = useState<ParentConversationIntent | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visibleTabs.includes(activeTab)) {
      setActiveTab(defaultTab);
    }
  }, [activeTab, defaultTab, visibleTabs]);

  useEffect(() => {
    const requestedTab = route.params?.tab;
    if (!requestedTab || !visibleTabs.includes(requestedTab as TabKey)) return;
    setActiveTab(requestedTab as TabKey);
    if (requestedTab !== "messaging") {
      setIsMessagingConversationOpen(false);
    }
    navigation.setParams({ tab: undefined });
  }, [navigation, route.params?.tab, visibleTabs]);

  useEffect(() => {
    setMountedTabs((prev) => {
      const next = prev.filter((tab) => visibleTabs.includes(tab));
      if (visibleTabs.includes(activeTab) && !next.includes(activeTab)) {
        return [...next, activeTab];
      }
      if (!next.length && visibleTabs.length) {
        return [visibleTabs[0]];
      }
      return next;
    });
  }, [activeTab, visibleTabs]);

  useEffect(() => {
    if (!permissions.includes("dashboard.view") && !hasRole(roles, "super_admin")) {
      setSummary(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    let mounted = true;
    async function loadDashboard() {
      setIsLoading(true);
      setError(null);
      try {
        const response = await getDashboardSummary();
        if (mounted) setSummary(response);
      } catch {
        if (mounted) {
          setSummary(null);
          setError("Could not load dashboard data.");
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    loadDashboard();
    return () => {
      mounted = false;
    };
  }, [permissions, roles]);

  const title = useMemo(() => {
    const current = TABS.find((tab) => tab.key === activeTab);
    return current?.label ?? "Profile";
  }, [activeTab]);
  const headerBrand = hasRole(roles, "parent")
    ? "Parent Portal"
    : hasRole(roles, "teacher")
      ? "Teacher Portal"
    : hasRole(roles, "accounts")
      ? "Accounts Portal"
      : "KKV";
  const headerSubtitle = hasRole(roles, "parent")
    ? "Student Access"
    : hasRole(roles, "teacher")
      ? title
    : hasRole(roles, "accounts")
      ? "Finance Access"
      : title;

  function selectTab(next: TabKey) {
    setActiveTab(next);
    if (next !== "messaging") {
      setIsMessagingConversationOpen(false);
    }
  }

  const startParentConversation = useCallback((payload: ParentConversationRequest) => {
    setParentConversationIntent({
      token: Date.now(),
      targetType: "parent",
      recipientUserId: payload.recipientUserId,
      recipientName: payload.recipientName,
      classId: payload.classId ?? null,
      sectionId: payload.sectionId ?? null,
    });
    setActiveTab("messaging");
  }, []);

  const startTeacherConversation = useCallback((payload: TeacherConversationRequest) => {
    setParentConversationIntent({
      token: Date.now(),
      targetType: "teacher",
      recipientUserId: payload.recipientUserId,
      recipientName: payload.recipientName,
      classId: payload.classId ?? null,
      sectionId: payload.sectionId ?? null,
    });
    setActiveTab("messaging");
  }, []);

  const refreshDashboard = useCallback(async () => {
    if (!permissions.includes("dashboard.view") && !hasRole(roles, "super_admin")) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await getDashboardSummary();
      setSummary(response);
    } catch {
      setSummary(null);
      setError("Could not load dashboard data.");
    } finally {
      setIsLoading(false);
    }
  }, [permissions, roles]);

  function renderTabContent(tab: TabKey) {
    switch (tab) {
      case "dashboard":
        return (
          <DashboardTab
            summary={summary}
            loading={isLoading}
            error={error}
            onRefresh={refreshDashboard}
          />
        );
      case "classes":
        return <MemoClassesTab />;
      case "subjects":
        return <MemoSubjectsTab />;
      case "activities":
        return <MemoActivitiesTab />;
      case "students":
        return <MemoStudentsTab onStartParentMessage={startParentConversation} />;
      case "teachers":
        return <MemoTeachersTab onStartTeacherMessage={startTeacherConversation} />;
      case "attendance":
        return <MemoAttendanceTab />;
      case "teacherAttendance":
        return <MemoTeacherAttendanceTab />;
      case "fees":
        return <MemoFeesTab />;
      case "payments":
        return <MemoPaymentsTab />;
      case "transportationFee":
        return <MemoTransportationFeeTab />;
      case "messaging":
        return (
          <MessagingTab
            isVisible={activeTab === "messaging"}
            onConversationViewChange={setIsMessagingConversationOpen}
            parentConversationIntent={parentConversationIntent}
            onParentConversationIntentHandled={(token) => {
              setParentConversationIntent((prev) => (prev?.token === token ? null : prev));
            }}
          />
        );
      case "exams":
        return <MemoExamsTab />;
      case "reports":
        return <MemoReportsTab />;
      case "users":
        return <MemoProfileTab />;
      default:
        return <ModulePlaceholderTab title="Module" subtitle="No data available." stats={[]} />;
    }
  }

  return (
    <SafeAreaView edges={["left", "right", "bottom"]} style={[styles.safeArea, { backgroundColor: theme.bg }]}>
      <View
        style={[
          styles.header,
          {
            backgroundColor: theme.bg,
            borderBottomColor: theme.border,
            paddingTop: Math.max(insets.top, 6),
            minHeight: 52 + Math.max(insets.top, 6),
          },
        ]}
      >
        <View style={styles.headerLeft}>
          <View>
            <Text style={[styles.brandText, { color: theme.text }]}>{headerBrand}</Text>
            <Text style={[styles.subtitle, { color: theme.subText }]}>{headerSubtitle}</Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          <Pressable
            style={[
              styles.iconButton,
              {
                backgroundColor: isDark ? theme.card : "#ffffff",
                borderColor: theme.border,
              },
            ]}
            onPress={toggleTheme}
          >
            <Ionicons name={isDark ? "sunny-outline" : "moon-outline"} size={18} color={theme.icon} />
          </Pressable>
          <Pressable
            style={[
              styles.iconButton,
              {
                backgroundColor: isDark ? theme.card : "#ffffff",
                borderColor: theme.border,
              },
            ]}
            onPress={() => navigation.navigate("More")}
          >
            <Ionicons name="apps-outline" size={18} color={theme.icon} />
          </Pressable>
        </View>
      </View>

      <View style={styles.contentStatic}>
        {mountedTabs.map((tab) => {
          const isActive = tab === activeTab;

          if (!visibleTabs.includes(tab)) {
            return null;
          }

          return (
            <View
              key={tab}
              style={[styles.tabPane, !isActive && styles.tabPaneHidden]}
              pointerEvents={isActive ? "auto" : "none"}
            >
              {tab === "dashboard" ? (
                <ScrollView
                  style={styles.content}
                  contentContainerStyle={styles.contentContainer}
                  showsVerticalScrollIndicator={false}
                  bounces
                  refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refreshDashboard} />}
                >
                  {isLoading ? (
                    <View style={styles.centeredBlock}>
                      <ActivityIndicator size="large" color={theme.icon} />
                    </View>
                  ) : (
                    renderTabContent(tab)
                  )}
                </ScrollView>
              ) : (
                renderTabContent(tab)
              )}
            </View>
          );
        })}
      </View>

      {!isMessagingConversationOpen ? (
        <View pointerEvents="box-none" style={[styles.floatingNavWrap, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          <View style={[styles.floatingNav, { backgroundColor: theme.card, borderColor: theme.border }]}>
            {primaryTabs.map((tab) => {
              const isMore = tab.key === "more";
              const isActive = !isMore && activeTab === tab.key;
              return (
                <Pressable
                  key={tab.key}
                  style={styles.floatingNavItem}
                  onPress={() => {
                    if (isMore) {
                      navigation.navigate("More");
                      return;
                    }
                    selectTab(tab.key as TabKey);
                  }}
                >
                  <View style={styles.floatingIconWrap}>
                    <Ionicons
                      name={tab.icon}
                      size={20}
                      color={isActive ? theme.text : theme.subText}
                    />
                  </View>
                  <Text
                    style={[
                      styles.floatingNavText,
                      {
                        color: isActive ? theme.text : theme.subText,
                        fontWeight: isActive ? "700" : "500",
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  header: {
    height: 52,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  brandText: {
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  subtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flex: 1,
  },
  contentStatic: {
    flex: 1,
    backgroundColor: "transparent",
  },
  tabPane: {
    flex: 1,
  },
  tabPaneHidden: {
    display: "none",
  },
  contentContainer: {
    backgroundColor: "transparent",
  },
  centeredBlock: {
    minHeight: 240,
    alignItems: "center",
    justifyContent: "center",
  },
  floatingNavWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    zIndex: 30,
  },
  floatingNav: {
    width: "92%",
    borderRadius: 34,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "space-around",
    overflow: "hidden",
    shadowColor: "#0f172a",
    shadowOpacity: 0.16,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  floatingNavItem: {
    width: "25%",
    alignItems: "center",
    justifyContent: "center",
    gap: 0,
  },
  floatingIconWrap: {
    width: 30,
    height: 28,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  floatingNavText: {
    fontSize: 10,
    textAlign: "center",
    marginTop: -1,
  },
});
