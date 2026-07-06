import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import type { RootStackParamList } from "../navigation/AppNavigator";
import { useAuthStore } from "../store/authStore";
import { useAppTheme } from "../theme/AppThemeProvider";
import TeacherDetailsModule from "./tabs/teachers/TeacherDetailsModule";

type Props = NativeStackScreenProps<RootStackParamList, "TeacherDetails">;

export default function TeacherDetailsScreen({ navigation, route }: Props) {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const permissions = useAuthStore((state) => state.user?.permissions || []);
  const canManageTeachers = permissions.includes("teacher.update");
  const teacherId = Number(route.params.teacherId);
  const teacherName = route.params.teacherName || "Teacher profile, assignments, attendance, and security";

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
          accessibilityLabel="Back to teachers"
          style={[styles.backBtn, { borderColor: theme.border, backgroundColor: theme.card }]}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={18} color={theme.icon} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>
            Teacher Details
          </Text>
          <Text style={[styles.headerSubtitle, { color: theme.subText }]} numberOfLines={1}>
            {teacherName}
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        <TeacherDetailsModule teacherId={teacherId} canManageTeachers={canManageTeachers} />
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
  content: { gap: 14, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 28 },
});
