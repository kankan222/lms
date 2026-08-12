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
import { useNotificationsStore } from "../store/notificationsStore";
import { DashboardSummary, getDashboardSummary } from "../services/dashboardService";
import { getUnreadMessageTotal } from "../services/messagingService";
import { getMyNotifications } from "../services/notificationsService";
import { syncPushNotificationsAfterSignIn } from "../services/pushNotificationService";
import { checkAppUpdate, showAppUpdatePromptOnce } from "../services/appUpdateService";
import { AppNotice, dismissAppNotice, getActiveAppNotice, openAppNoticeAction, wasAppNoticeDismissed } from "../services/appNoticeService";
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
import RoutineTab from "./tabs/RoutineTab";
import AnnouncementsTab from "./tabs/AnnouncementsTab";
import MessagingTab from "./tabs/MessagingTab";
import ProfileTab from "./tabs/ProfileTab";
import ReportsTab from "./tabs/ReportsTab";
import ModulePlaceholderTab from "./tabs/ModulePlaceholderTab";
import type { ParentConversationRequest } from "./tabs/StudentsTab";
import type { TeacherConversationRequest } from "./tabs/TeachersTab";
import type { ParentConversationIntent } from "./tabs/MessagingTab";
import type { MessagingComposeResult } from "./MessagingComposeScreen";

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
  | "routine"
  | "announcements"
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
  { key: "routine", label: "Routine", icon: "time-outline" },
  { key: "announcements", label: "Announcements", icon: "megaphone-outline" },
  { key: "messaging", label: "Messaging", icon: "chatbubble-ellipses-outline" },
  { key: "exams", label: "Exams", icon: "document-text-outline" },
  { key: "reports", label: "Marksheet", icon: "bar-chart-outline" },
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
const MemoRoutineTab = memo(RoutineTab);
const MemoAnnouncementsTab = memo(AnnouncementsTab);
const MemoReportsTab = memo(ReportsTab);
const MemoProfileTab = memo(ProfileTab);

function hasAny(permissions: string[], list: string[]) {
  return list.some((permission) => permissions.includes(permission));
}

function normalizeRole(value?: string | null) {
  const normalized = String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  return normalized === "superadmin" ? "super_admin" : normalized;
}

function hasRole(roles: string[], role: string) {
  const expected = normalizeRole(role);
  return roles.some((value) => normalizeRole(value) === expected);
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
      return isTeacher || permissions.includes("teacher.view");
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
    case "routine":
      return isParent || isTeacher || isSuperAdmin || hasAny(permissions, ["routines.view", "routines.manage"]);
    case "announcements":
      return isParent || isTeacher || isSuperAdmin || hasAny(permissions, ["announcements.view", "announcements.manage"]);
    case "messaging":
      return isSuperAdmin || hasAny(permissions, ["messages.view", "messages.send"]);
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
      { key: "routine", label: "Routines", icon: "time-outline" },
      { key: "announcements", label: "Announcements", icon: "megaphone-outline" },
      { key: "more", label: "More", icon: "apps-outline" },
    ];
  }

  if (isTeacher) {
    return [
      { key: "teachers", label: "Teacher Info", icon: "person-outline" },
      { key: "reports", label: "Marksheet", icon: "bar-chart-outline" },
      { key: "messaging", label: "Messages", icon: "chatbubble-ellipses-outline" },
      { key: "routine", label: "Routines", icon: "time-outline" },
      { key: "more", label: "More", icon: "apps-outline" },
    ];
  }

  if (isParent) {
    return [
      { key: "students", label: "Students", icon: "people-outline" },
      { key: "messaging", label: "Messaging", icon: "chatbubble-ellipses-outline" },
      { key: "routine", label: "Routines", icon: "time-outline" },
      { key: "announcements", label: "Announcements", icon: "megaphone-outline" },
      { key: "more", label: "More", icon: "apps-outline" },
    ];
  }

  if (isStaff) {
    return [
      { key: "messaging", label: "Messaging", icon: "chatbubble-ellipses-outline" },
      { key: "routine", label: "Routine", icon: "time-outline" },
      { key: "announcements", label: "Announcements", icon: "megaphone-outline" },
      { key: "reports", label: "Marksheet", icon: "bar-chart-outline" },
      { key: "more", label: "More", icon: "apps-outline" },
    ];
  }

  if (isAccounts) {
    return [
      { key: "payments", label: "Payments", icon: "card-outline" },
      { key: "transportationFee", label: "Transport", icon: "bus-outline" },
      { key: "routine", label: "Routine", icon: "time-outline" },
      { key: "announcements", label: "Announcements", icon: "megaphone-outline" },
      { key: "messaging", label: "Messaging", icon: "chatbubble-ellipses-outline" },
      { key: "more", label: "More", icon: "apps-outline" },
    ];
  }

  if (permissions.includes("dashboard.view")) {
    return [
      { key: "dashboard", label: "Dashboard", icon: "grid-outline" },
      { key: "messaging", label: "Messaging", icon: "chatbubble-ellipses-outline" },
      { key: "routine", label: "Routine", icon: "time-outline" },
      { key: "announcements", label: "Announcements", icon: "megaphone-outline" },
      { key: "more", label: "More", icon: "apps-outline" },
    ];
  }

  return [
    { key: "users", label: "Profile", icon: "person-circle-outline" },
    { key: "routine", label: "Routine", icon: "time-outline" },
    { key: "announcements", label: "Announcements", icon: "megaphone-outline" },
    { key: "messaging", label: "Messaging", icon: "chatbubble-ellipses-outline" },
    { key: "reports", label: "Marksheet", icon: "bar-chart-outline" },
    { key: "more", label: "More", icon: "apps-outline" },
  ];
}

function resolveDefaultTab(roles: string[], permissions: string[], visibleTabs: TabKey[]) {
  const preferredOrder = hasRole(roles, "super_admin")
    ? (["dashboard", "routine", "announcements", "messaging", "students", "reports", "users"] as TabKey[])
    : hasRole(roles, "teacher")
      ? (["teachers", "reports", "messaging", "routine", "announcements", "attendance", "teacherAttendance", "students", "users"] as TabKey[])
      : hasRole(roles, "parent")
        ? (["students", "messaging", "routine", "announcements", "users"] as TabKey[])
        : hasRole(roles, "staff")
          ? (["routine", "announcements", "reports", "messaging", "attendance", "users"] as TabKey[])
          : hasRole(roles, "accounts")
            ? (["payments", "transportationFee", "routine", "announcements", "messaging", "fees", "users"] as TabKey[])
          : permissions.includes("dashboard.view")
            ? (["dashboard", "routine", "announcements", "reports", "students", "messaging", "users"] as TabKey[])
            : (["routine", "announcements", "users", "reports", "messaging"] as TabKey[]);

  return preferredOrder.find((tab) => visibleTabs.includes(tab)) ?? visibleTabs[0] ?? "users";
}

export default function AppShellScreen({ navigation, route }: Props) {
  const user = useAuthStore((state) => state.user);
  const notificationUnread = useNotificationsStore((state) => state.unread);
  const setNotificationUnread = useNotificationsStore((state) => state.setUnread);
  const insets = useSafeAreaInsets();
  const { theme, isDark, toggleTheme } = useAppTheme();
  const roles = Array.isArray(user?.roles) ? user.roles : [];
  const permissions = Array.isArray(user?.permissions) ? user.permissions : [];
  const canViewNotifications = hasRole(roles, "super_admin") || permissions.includes("notifications.view");
  const visibleTabs = useMemo(
    () => TABS.filter((tab) => canViewTab(tab.key, roles, permissions)).map((tab) => tab.key),
    [permissions, roles],
  );
  const showHeaderAnnouncements = hasRole(roles, "teacher") && visibleTabs.includes("announcements");
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
  const [messagingComposeTarget, setMessagingComposeTarget] = useState<MessagingComposeResult | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [messageUnread, setMessageUnread] = useState(0);
  const [appNotice, setAppNotice] = useState<AppNotice | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visibleTabs.includes(activeTab)) {
      setActiveTab(defaultTab);
    }
  }, [activeTab, defaultTab, visibleTabs]);

  useEffect(() => {
    if (!canViewNotifications) {
      setNotificationUnread(0);
      return;
    }

    let active = true;
    getMyNotifications({ limit: 1 })
      .then((data) => {
        if (active) setNotificationUnread(Number(data.unread || 0));
      })
      .catch(() => {
        if (active) setNotificationUnread(0);
      });

    return () => {
      active = false;
    };
  }, [canViewNotifications, user?.id]);

  useEffect(() => {
    if (!user?.id || !canViewNotifications) return;
    void syncPushNotificationsAfterSignIn(user);
  }, [canViewNotifications, user]);

  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    checkAppUpdate()
      .then((info) => {
        if (active && info?.update_available) {
          void showAppUpdatePromptOnce(info);
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      setAppNotice(null);
      return;
    }
    let active = true;
    async function refreshAppNotice() {
      try {
        const notice = await getActiveAppNotice();
        if (!active) return;
        if (!notice) {
          setAppNotice(null);
          return;
        }
        const dismissed = await wasAppNoticeDismissed(notice);
        if (active) setAppNotice(dismissed ? null : notice);
      } catch {
        if (active) setAppNotice(null);
      }
    }

    void refreshAppNotice();
    const timer = setInterval(() => {
      void refreshAppNotice();
    }, 120000);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [user?.id]);

  useEffect(() => {
    if (!permissions.includes("messages.view") && !hasRole(roles, "super_admin")) {
      setMessageUnread(0);
      return;
    }

    let active = true;
    async function refreshUnreadMessages() {
      try {
        const total = await getUnreadMessageTotal();
        if (active) setMessageUnread(total);
      } catch {
        if (active) setMessageUnread(0);
      }
    }

    void refreshUnreadMessages();
    const timer = setInterval(() => {
      void refreshUnreadMessages();
    }, 30000);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [activeTab, permissions, roles]);

  useEffect(() => {
    const requestedTab = route.params?.tab;
    if (!requestedTab || !visibleTabs.includes(requestedTab as TabKey)) return;
    setActiveTab(requestedTab as TabKey);
    if (requestedTab === "messaging" && route.params?.composeTarget) {
      setMessagingComposeTarget(route.params.composeTarget);
    }
    if (requestedTab !== "messaging") {
      setIsMessagingConversationOpen(false);
    }
    navigation.setParams({ tab: undefined, composeTarget: undefined });
  }, [navigation, route.params?.composeTarget, route.params?.tab, visibleTabs]);

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

  const headerBrand = hasRole(roles, "parent")
    ? "Parent Portal"
    : hasRole(roles, "teacher")
      ? "Teacher Portal"
    : hasRole(roles, "accounts")
      ? "Accounts Portal"
      : "KKV";
  const headerSubtitle = TABS.find((tab) => tab.key === activeTab)?.label || "";

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

  async function dismissCurrentAppNotice() {
    if (!appNotice) return;
    await dismissAppNotice(appNotice);
    setAppNotice(null);
  }

  function noticeColors(notice: AppNotice) {
    if (notice.severity === "critical") {
      return { bg: theme.dangerSoft, border: theme.dangerBorder, icon: theme.danger };
    }
    if (notice.severity === "warning") {
      return { bg: theme.warningSoft, border: theme.warningBorder, icon: theme.warningText };
    }
    return { bg: theme.infoSoft, border: theme.infoBorder, icon: theme.infoText };
  }

  function renderAppNoticeCard(mode: "banner" | "blocking" = "banner") {
    if (!appNotice) return null;
    const colors = noticeColors(appNotice);
    return (
      <View style={[
        styles.appNoticeCard,
        mode === "blocking" && styles.appNoticeBlockingCard,
        { backgroundColor: colors.bg, borderColor: colors.border },
      ]}>
        <View style={styles.appNoticeHeader}>
          <View style={styles.appNoticeTitleRow}>
            <Ionicons name={appNotice.severity === "critical" ? "alert-circle-outline" : "information-circle-outline"} size={18} color={colors.icon} />
            <Text style={[styles.appNoticeTitle, { color: theme.text }]}>{appNotice.title}</Text>
          </View>
          {appNotice.dismissible ? (
            <Pressable style={[styles.appNoticeClose, { borderColor: colors.border }]} onPress={() => void dismissCurrentAppNotice()}>
              <Ionicons name="close" size={15} color={theme.icon} />
            </Pressable>
          ) : null}
        </View>
        <Text style={[styles.appNoticeMessage, { color: theme.subText }]}>{appNotice.message}</Text>
        {appNotice.action_label && appNotice.action_url ? (
          <Pressable style={[styles.appNoticeAction, { borderColor: colors.border }]} onPress={() => void openAppNoticeAction(appNotice)}>
            <Text style={[styles.appNoticeActionText, { color: colors.icon }]}>{appNotice.action_label}</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  function renderTabContent(tab: TabKey) {
    switch (tab) {
      case "dashboard":
        return (
          <DashboardTab
            summary={summary}
            loading={isLoading}
            error={error}
            onRefresh={refreshDashboard}
            onOpenMessages={() => selectTab("messaging")}
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
      case "routine":
        return <MemoRoutineTab />;
      case "announcements":
        return <MemoAnnouncementsTab />;
      case "messaging":
        return (
          <MessagingTab
            isVisible={activeTab === "messaging"}
            onConversationViewChange={setIsMessagingConversationOpen}
            parentConversationIntent={parentConversationIntent}
            onParentConversationIntentHandled={(token) => {
              setParentConversationIntent((prev) => (prev?.token === token ? null : prev));
            }}
            composeTargetIntent={messagingComposeTarget}
            onComposeTargetHandled={(token) => {
              setMessagingComposeTarget((prev) => (prev?.token === token ? null : prev));
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
            minHeight: 58 + Math.max(insets.top, 6),
          },
        ]}
      >
        <View style={styles.headerLeft}>
          <View style={styles.headerCopy}>
            <Text style={[styles.brandText, { color: theme.text }]} numberOfLines={1}>{headerBrand}</Text>
            {headerSubtitle ? (
              <Text style={[styles.brandSubtitle, { color: theme.subText }]} numberOfLines={1}>{headerSubtitle}</Text>
            ) : null}
          </View>
        </View>

        <View style={styles.headerRight}>
          {canViewNotifications ? (
            <Pressable
              style={[
                styles.iconButton,
                {
                  backgroundColor: "transparent",
                  borderColor: theme.border,
                },
              ]}
              onPress={() => navigation.navigate("Notifications")}
            >
              <Ionicons name="notifications-outline" size={18} color={theme.icon} />
              {notificationUnread ? (
                <View style={[styles.headerBadge, { backgroundColor: theme.success }]}>
                  <Text style={styles.headerBadgeText}>{notificationUnread > 99 ? "99+" : notificationUnread}</Text>
                </View>
              ) : null}
            </Pressable>
          ) : null}
          {showHeaderAnnouncements ? (
            <Pressable
              style={[
                styles.iconButton,
                {
                  backgroundColor: activeTab === "announcements" ? theme.primary : "transparent",
                  borderColor: activeTab === "announcements" ? theme.primary : theme.border,
                },
              ]}
              onPress={() => selectTab("announcements")}
            >
              <Ionicons
                name="megaphone-outline"
                size={18}
                color={activeTab === "announcements" ? theme.primaryText : theme.icon}
              />
            </Pressable>
          ) : null}
          <Pressable
            style={[
              styles.iconButton,
              {
                backgroundColor: "transparent",
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
                backgroundColor: activeTab === "users" ? theme.primary : isDark ? theme.card : "#ffffff",
                borderColor: activeTab === "users" ? theme.primary : theme.border,
              },
            ]}
            onPress={() => selectTab("users")}
          >
            <Ionicons name="person-circle-outline" size={20} color={activeTab === "users" ? theme.primaryText : theme.icon} />
          </Pressable>
        </View>
      </View>

      {appNotice && appNotice.severity !== "critical" ? (
        <View style={styles.appNoticeBannerWrap}>{renderAppNoticeCard("banner")}</View>
      ) : null}

      <View style={styles.contentStatic}>
        {appNotice?.severity === "critical" ? (
          <View style={styles.appNoticeBlockingWrap}>
            {renderAppNoticeCard("blocking")}
          </View>
        ) : mountedTabs.map((tab) => {
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
        <View
          pointerEvents="box-none"
          style={[
            styles.floatingNavWrap,
            {
              backgroundColor: theme.bg,
              borderTopColor: theme.border,
              paddingBottom: Math.max(insets.bottom, 8),
            },
          ]}
        >
          <View style={styles.floatingNav}>
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
                      size={19}
                      color={isActive ? theme.primary : theme.subText}
                    />
                    {tab.key === "messaging" && messageUnread ? (
                      <View style={[styles.floatingBadge, { backgroundColor: theme.success }]}>
                        <Text style={styles.floatingBadgeText}>{messageUnread > 99 ? "99+" : messageUnread}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text
                    style={[
                      styles.floatingNavText,
                      {
                        color: isActive ? theme.primary : theme.subText,
                        fontWeight: isActive ? "800" : "600",
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
    height: 58,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    minWidth: 0,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  brandText: {
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  brandSubtitle: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "700",
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  headerBadge: {
    position: "absolute",
    top: -5,
    right: -5,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  headerBadgeText: { color: "#ffffff", fontSize: 10, fontWeight: "800" },
  appNoticeBannerWrap: {
    paddingHorizontal: 12,
    paddingTop: 8,
    backgroundColor: "transparent",
  },
  appNoticeCard: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  appNoticeBlockingWrap: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 18,
    paddingBottom: 120,
  },
  appNoticeBlockingCard: {
    padding: 16,
  },
  appNoticeHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  appNoticeTitleRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  appNoticeTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 18,
  },
  appNoticeClose: {
    width: 30,
    height: 30,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  appNoticeMessage: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "600",
  },
  appNoticeAction: {
    alignSelf: "flex-start",
    minHeight: 34,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  appNoticeActionText: {
    fontSize: 12,
    fontWeight: "900",
  },
  floatingBadge: {
    position: "absolute",
    top: -7,
    right: -12,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  floatingBadgeText: { color: "#ffffff", fontSize: 10, fontWeight: "800" },
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
    borderTopWidth: 1,
  },
  floatingNav: {
    width: "100%",
    paddingHorizontal: 10,
    paddingTop: 9,
    paddingBottom: 8,
    flexDirection: "row",
    justifyContent: "space-around",
  },
  floatingNavItem: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: 0,
  },
  floatingIconWrap: {
    width: 34,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  floatingNavText: {
    fontSize: 10,
    textAlign: "center",
    marginTop: 1,
  },
});
