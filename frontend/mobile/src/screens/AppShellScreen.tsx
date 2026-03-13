import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
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
import ModulePlaceholderTab from "./tabs/ModulePlaceholderTab";
import ReportsTab from "./tabs/ReportsTab";

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
  { key: "users", label: "Users", icon: "shield-checkmark-outline" },
];

export default function AppShellScreen() {
  const user = useAuthStore((state) => state.user);
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<TabKey>("dashboard");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadDashboard() {
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
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  const title = useMemo(() => {
    const current = TABS.find((tab) => tab.key === activeTab);
    return current?.label ?? "Dashboard";
  }, [activeTab]);

  const theme = isDark
    ? {
        bg: "#0f172a",
        card: "#1e293b",
        text: "#f8fafc",
        subText: "#cbd5e1",
        border: "#334155",
      }
    : {
        bg: "#f8fafc",
        card: "#ffffff",
        text: "#0f172a",
        subText: "#64748b",
        border: "#e2e8f0",
      };

  function selectTab(next: TabKey) {
    setActiveTab(next);
    setIsMenuOpen(false);
  }

  function renderContent() {
    if (activeTab === "dashboard") {
      return (
        <DashboardTab
          summary={summary}
          loading={isLoading}
          error={error}
          onRefresh={loadDashboard}
        />
      );
    }
    if (activeTab === "classes") return <ClassesTab />;
    if (activeTab === "subjects") return <SubjectsTab />;
    if (activeTab === "students") return <StudentsTab />;
    if (activeTab === "teachers") return <TeachersTab />;
    if (activeTab === "attendance") return <AttendanceTab />;
    if (activeTab === "fees") return <FeesTab />;
    if (activeTab === "payments") return <PaymentsTab />;
    if (activeTab === "exams") return <ExamsTab />;
    if (activeTab === "messaging") return <MessagingTab />;
    if (activeTab === "users") return <ProfileTab />;
    if (activeTab === "reports") {
      return <ReportsTab />;
    }
    return <ModulePlaceholderTab title="Module" subtitle="No data available." stats={[]} />;
  }

  return (
    <SafeAreaView
      edges={["top", "left", "right", "bottom"]}
      style={[styles.safeArea, { backgroundColor: theme.bg }]}
    >
      <View
        style={[
          styles.header,
          {
            backgroundColor: theme.card,
            borderBottomColor: theme.border,
            paddingTop: Math.max(insets.top, 4),
            height: 64 + Math.max(insets.top, 4),
          },
        ]}
      >
        <View style={styles.headerLeft}>
          <Pressable style={styles.iconButton} onPress={() => setIsMenuOpen(true)}>
            <Ionicons name="menu" size={20} color={theme.text} />
          </Pressable>
          <View>
            <Text style={[styles.brandText, { color: theme.text }]}>KKV</Text>
            <Text style={[styles.subtitle, { color: theme.subText }]}>{title}</Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          <Pressable style={styles.iconButton} onPress={() => selectTab("messaging")}>
            <Ionicons name="mail-outline" size={18} color={theme.text} />
          </Pressable>
          <Pressable style={styles.iconButton} onPress={() => setIsDark((prev) => !prev)}>
            <Ionicons name={isDark ? "sunny-outline" : "moon-outline"} size={18} color={theme.text} />
          </Pressable>
          <Pressable style={styles.iconButton} onPress={() => selectTab("users")}>
            <Ionicons name="person-circle-outline" size={20} color={theme.text} />
          </Pressable>
        </View>
      </View>

      <Modal visible={isMenuOpen} transparent animationType="fade" onRequestClose={() => setIsMenuOpen(false)}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.backdrop} onPress={() => setIsMenuOpen(false)} />
          <View
            style={[
              styles.drawer,
              {
                backgroundColor: theme.card,
                borderRightColor: theme.border,
              },
            ]}
          >
            <Text style={[styles.drawerTitle, { color: theme.text }]}>KKV Menu</Text>
            {TABS.map((tab) => {
              const isActive = tab.key === activeTab;
              return (
                <Pressable
                  key={tab.key}
                  style={[
                    styles.drawerItem,
                    {
                      backgroundColor: isActive ? (isDark ? "#334155" : "#e2e8f0") : "transparent",
                    },
                  ]}
                  onPress={() => selectTab(tab.key)}
                >
                  <Ionicons
                    name={tab.icon}
                    size={18}
                    color={isActive ? theme.text : theme.subText}
                    style={styles.drawerIcon}
                  />
                  <Text
                    style={[
                      styles.drawerText,
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
      </Modal>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {activeTab !== "dashboard" && isLoading ? (
          <View style={styles.centeredBlock}>
            <ActivityIndicator size="large" color={theme.text} />
          </View>
        ) : (
          renderContent()
        )}
      </ScrollView>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  header: {
    height: 64,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  brandText: {
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  modalRoot: {
    flex: 1,
    flexDirection: "row",
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.28)",
  },
  drawer: {
    width: 260,
    paddingTop: 48,
    paddingHorizontal: 16,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  drawerTitle: {
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 18,
  },
  drawerItem: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginBottom: 6,
  },
  drawerIcon: {
    marginRight: 10,
  },
  drawerText: {
    fontSize: 15,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 14,
    paddingBottom: 28,
  },
  centeredBlock: {
    minHeight: 240,
    alignItems: "center",
    justifyContent: "center",
  },
});
