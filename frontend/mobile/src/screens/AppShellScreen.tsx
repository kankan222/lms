import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuthStore } from "../store/authStore";
import { DashboardSummary, getDashboardSummary } from "../services/dashboardService";
import { useAppTheme } from "../theme/AppThemeProvider";
import DashboardTab from "./tabs/DashboardTab";
import ClassesTab from "./tabs/ClassesTab";
import SubjectsTab from "./tabs/SubjectsTab";
import StudentsTab from "./tabs/StudentsTab";
import TeachersTab from "./tabs/TeachersTab";
import AttendanceTab from "./tabs/AttendanceTab";
import FeesTab from "./tabs/FeesTab";
import PaymentsTab from "./tabs/PaymentsTab";
import ExamsTab from "./tabs/ExamsTab";
import MessagingTab from "./tabs/MessagingTab";
import ProfileTab from "./tabs/ProfileTab";
import ReportsTab from "./tabs/ReportsTab";
import ModulePlaceholderTab from "./tabs/ModulePlaceholderTab";

type TabKey =
  | "dashboard"
  | "classes"
  | "subjects"
  | "students"
  | "teachers"
  | "attendance"
  | "fees"
  | "payments"
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
  { key: "classes", label: "Classes", icon: "school-outline" },
  { key: "subjects", label: "Subjects", icon: "book-outline" },
  { key: "students", label: "Students", icon: "people-outline" },
  { key: "teachers", label: "Teachers", icon: "person-outline" },
  { key: "attendance", label: "Attendance", icon: "calendar-outline" },
  { key: "fees", label: "Fees", icon: "wallet-outline" },
  { key: "payments", label: "Payments", icon: "card-outline" },
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

function hasAny(permissions: string[], list: string[]) {
  return list.some((permission) => permissions.includes(permission));
}

function canViewTab(tabKey: TabKey, roles: string[], permissions: string[]) {
  const isSuperAdmin = roles.includes("super_admin");
  if (isSuperAdmin) return true;

  switch (tabKey) {
    case "dashboard":
      return permissions.includes("dashboard.view");
    case "classes":
      return hasAny(permissions, ["academic.create", "academic.update", "academic.delete", "dashboard.view"]);
    case "subjects":
      return hasAny(permissions, ["subjects.view", "subjects.assign"]);
    case "students":
      return permissions.includes("student.view");
    case "teachers":
      return permissions.includes("teacher.view");
    case "attendance":
      if (roles.includes("parent")) return false;
      return hasAny(permissions, [
        "attendance.take",
        "student_attendance.take",
        "student_attendance.view",
        "student_attendance.review",
        "student_attendance.notify",
        "teacher.view",
      ]);
    case "fees":
      if (roles.includes("parent")) return false;
      return hasAny(permissions, ["fee.view", "fee.create"]);
    case "payments":
      return hasAny(permissions, ["payment.view", "payment.create", "payment.update", "payment.delete", "fee.view"]);
    case "messaging":
      return hasAny(permissions, ["messages.view", "messages.send"]);
    case "exams":
      return hasAny(permissions, ["exams.view", "exams.create", "exams.update", "exams.delete"]);
    case "reports":
      if (roles.includes("parent")) return false;
      return hasAny(permissions, ["marks.view", "marks.enter", "marks.approve"]);
    case "users":
      return true;
    default:
      return false;
  }
}

function buildPrimaryTabs(roles: string[], permissions: string[]): NavTab[] {
  const isSuperAdmin = roles.includes("super_admin");
  const isTeacher = roles.includes("teacher");
  const isParent = roles.includes("parent");
  const isStaff = roles.includes("staff");
  const isAccounts = roles.includes("accounts");

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
      { key: "attendance", label: "Attendance", icon: "calendar-outline" },
      { key: "reports", label: "Reports", icon: "bar-chart-outline" },
      { key: "users", label: "Profile", icon: "person-circle-outline" },
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
  const preferredOrder = roles.includes("super_admin")
    ? (["dashboard", "messaging", "students", "reports", "users"] as TabKey[])
    : roles.includes("teacher")
      ? (["attendance", "reports", "messaging", "teachers", "students", "users"] as TabKey[])
      : roles.includes("parent")
        ? (["students", "messaging", "users"] as TabKey[])
        : roles.includes("staff")
          ? (["reports", "messaging", "attendance", "users"] as TabKey[])
          : roles.includes("accounts")
            ? (["payments", "messaging", "fees", "users"] as TabKey[])
          : permissions.includes("dashboard.view")
            ? (["dashboard", "reports", "students", "messaging", "users"] as TabKey[])
            : (["users", "reports", "messaging"] as TabKey[]);

  return preferredOrder.find((tab) => visibleTabs.includes(tab)) ?? visibleTabs[0] ?? "users";
}

export default function AppShellScreen() {
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
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visibleTabs.includes(activeTab)) {
      setActiveTab(defaultTab);
    }
  }, [activeTab, defaultTab, visibleTabs]);

  useEffect(() => {
    if (!permissions.includes("dashboard.view") && !roles.includes("super_admin")) {
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
  const headerBrand = roles.includes("parent")
    ? "Parent Portal"
    : roles.includes("accounts")
      ? "Accounts Portal"
      : "KKV";
  const headerSubtitle = roles.includes("parent")
    ? "Student Access"
    : roles.includes("accounts")
      ? "Finance Access"
      : title;

  function selectTab(next: TabKey) {
    setActiveTab(next);
    setIsMoreOpen(false);
  }

  function renderContent() {
    switch (activeTab) {
      case "dashboard":
        return (
          <DashboardTab
            summary={summary}
            loading={isLoading}
            error={error}
            onRefresh={async () => {
              if (!permissions.includes("dashboard.view") && !roles.includes("super_admin")) return;
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
            }}
          />
        );
      case "classes":
        return <ClassesTab />;
      case "subjects":
        return <SubjectsTab />;
      case "students":
        return <StudentsTab />;
      case "teachers":
        return <TeachersTab />;
      case "attendance":
        return <AttendanceTab />;
      case "fees":
        return <FeesTab />;
      case "payments":
        return <PaymentsTab />;
      case "messaging":
        return <MessagingTab />;
      case "exams":
        return <ExamsTab />;
      case "reports":
        return <ReportsTab />;
      case "users":
        return <ProfileTab />;
      default:
        return <ModulePlaceholderTab title="Module" subtitle="No data available." stats={[]} />;
    }
  }

  const moreTabs = TABS.filter(
    (tab) => visibleTabs.includes(tab.key) && !primaryTabs.some((item) => item.key === tab.key),
  );

  return (
    <SafeAreaView edges={["left", "right", "bottom"]} style={[styles.safeArea, { backgroundColor: theme.bg }]}>
      <View
        style={[
          styles.header,
          {
            backgroundColor: theme.bg,
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
            onPress={() => setIsMoreOpen((prev) => !prev)}
          >
            <Ionicons name="apps-outline" size={18} color={theme.icon} />
          </Pressable>
        </View>
      </View>

      {isMoreOpen && moreTabs.length ? (
        <>
          <Pressable
            style={[styles.inlineBackdrop, { bottom: Math.max(insets.bottom, 10) + 82 }]}
            onPress={() => setIsMoreOpen(false)}
          />
          <View
            style={[
              styles.moreSheet,
              {
                backgroundColor: theme.card,
                borderColor: theme.border,
                bottom: Math.max(insets.bottom, 10) + 82,
              },
            ]}
          >
            <View style={styles.moreHeader}>
              <View>
                <Text style={[styles.drawerTitle, { color: theme.text }]}>More</Text>
                <Text style={[styles.moreSubtitle, { color: theme.subText }]}>Open any available module from here.</Text>
              </View>
            </View>
            <View style={styles.moreGrid}>
              {moreTabs.map((tab) => {
                const isActive = tab.key === activeTab;
                return (
                  <Pressable
                    key={tab.key}
                    style={[
                      styles.moreItem,
                      {
                        backgroundColor: isActive ? theme.cardMuted : theme.bg,
                        borderColor: isActive ? theme.icon : theme.border,
                      },
                    ]}
                    onPress={() => selectTab(tab.key)}
                  >
                    <Ionicons name={tab.icon} size={20} color={isActive ? theme.text : theme.subText} />
                    <Text
                      style={[
                        styles.moreItemText,
                        { color: isActive ? theme.text : theme.subText, fontWeight: isActive ? "700" : "500" },
                      ]}
                    >
                      {tab.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </>
      ) : null}

      {activeTab === "messaging" ? (
        <View style={styles.contentStatic}>
          {renderContent()}
        </View>
      ) : (
        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          {activeTab === "dashboard" && isLoading ? (
            <View style={styles.centeredBlock}>
              <ActivityIndicator size="large" color={theme.icon} />
            </View>
          ) : (
            renderContent()
          )}
        </ScrollView>
      )}

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
                    setIsMoreOpen((prev) => !prev);
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
  inlineBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: "transparent",
    zIndex: 15,
  },
  moreSheet: {
    position: "absolute",
    alignSelf: "center",
    width: "92%",
    borderRadius: 34,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 12,
    shadowColor: "#0f172a",
    shadowOpacity: 0.16,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
    zIndex: 20,
  },
  moreHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    marginBottom: 10,
  },
  drawerTitle: {
    fontSize: 18,
    fontWeight: "800",
  },
  moreSubtitle: {
    fontSize: 12,
    marginTop: 4,
  },
  moreGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "flex-start",
  },
  moreItem: {
    width: "31%",
    minWidth: 88,
    aspectRatio: 1.02,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  moreItemText: {
    fontSize: 11,
    textAlign: "center",
  },
  content: {
    flex: 1,
  },
  contentStatic: {
    flex: 1,
    paddingHorizontal: 14,
    paddingTop: 2,
    paddingBottom: 120,
  },
  contentContainer: {
    paddingHorizontal: 14,
    paddingTop: 2,
    paddingBottom: 120,
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
