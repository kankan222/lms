import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import type { RootStackParamList } from "../navigation/AppNavigator";
import SelectField from "../components/form/SelectField";
import { getTargets, type MessagingTargets, type SendMessagePayload } from "../services/messagingService";
import { useAppTheme } from "../theme/AppThemeProvider";

type TargetType = NonNullable<SendMessagePayload["target_type"]>;
type ComposeTargetPayload = Omit<SendMessagePayload, "message" | "attachment_ids" | "reply_to_message_id" | "forwarded_from_message_id">;

export type MessagingComposeResult = {
  token: number;
  label: string;
  payload: ComposeTargetPayload;
};

type Props = NativeStackScreenProps<RootStackParamList, "MessagingCompose">;

type Compose = {
  target_type: TargetType;
  recipient_user_id: string;
  class_id: string;
  section_id: string;
  teacher_scope: "all" | "school" | "college";
  staff_type: "all" | "teaching" | "non_teaching";
  parent_type: "all" | "school" | "college";
  name: string;
};

type RecipientOption = {
  user_id: number;
  name: string;
  roles: string[];
  phones: string[];
  classNames: string[];
  sectionNames: string[];
  teacherScopes: string[];
  staffTypes: string[];
  studentNames: string[];
};

const EMPTY_TARGETS: MessagingTargets = { parents: [], teachers: [], classes: [], sections: [], broadcast_targets: [] };
const EMPTY_COMPOSE: Compose = {
  target_type: "parent",
  recipient_user_id: "",
  class_id: "",
  section_id: "",
  teacher_scope: "all",
  staff_type: "all",
  parent_type: "all",
  name: "",
};
const GROUP_TARGET_TYPES = ["class", "section", "broadcast", "all_classes", "all_sections", "all_parents", "all_teachers"];

function isGroupTargetType(value: TargetType) {
  return GROUP_TARGET_TYPES.includes(value);
}

function audienceIcon(value: TargetType): keyof typeof Ionicons.glyphMap {
  if (value === "parent") return "person-outline";
  if (value === "teacher") return "school-outline";
  if (value === "class") return "people-outline";
  if (value === "section") return "grid-outline";
  if (value === "all_parents") return "people-circle-outline";
  if (value === "all_teachers") return "briefcase-outline";
  if (value === "broadcast" || value === "all_classes" || value === "all_sections") return "megaphone-outline";
  return "chatbubble-ellipses-outline";
}

function normalizeTeacherScope(value?: string | null) {
  if (value === "college" || value === "hs") return "college";
  if (value === "school") return "school";
  return "all";
}

function normalizeStaffType(value?: string | null) {
  if (value === "non_teaching") return "non_teaching";
  if (value === "teaching") return "teaching";
  return "all";
}

function formatTeacherAudienceName(scope: Compose["teacher_scope"], staffType: Compose["staff_type"]) {
  const scopeLabel = scope === "college" ? "College" : scope === "school" ? "School" : "";
  const staffLabel = staffType === "non_teaching" ? "Non Teaching Staff" : staffType === "teaching" ? "Teaching Staff" : "Staff";
  return ["All", scopeLabel, staffLabel].filter(Boolean).join(" ");
}

export default function MessagingComposeScreen({ navigation }: Props) {
  const { theme, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [targets, setTargets] = useState<MessagingTargets>(EMPTY_TARGETS);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<"audience" | "target">("audience");
  const [compose, setCompose] = useState<Compose>(EMPTY_COMPOSE);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [classFilter, setClassFilter] = useState("");
  const [sectionFilter, setSectionFilter] = useState("");
  const [teacherScopeFilter, setTeacherScopeFilter] = useState<"all" | "school" | "college">("all");
  const [staffTypeFilter, setStaffTypeFilter] = useState<"all" | "teaching" | "non_teaching">("all");

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    getTargets()
      .then((data) => {
        if (mounted) setTargets(data);
      })
      .catch(() => {
        if (mounted) setTargets(EMPTY_TARGETS);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const classOptions = useMemo(
    () => targets.classes.map((item) => ({
      label: item.name,
      value: String(item.id),
      description: [item.medium, item.class_scope === "hs" ? "Higher Secondary" : item.class_scope ? "School" : ""].filter(Boolean).join(" - "),
    })),
    [targets.classes],
  );
  const sectionsBySelectedClass = useMemo(
    () => targets.sections.filter((item) => String(item.class_id) === compose.class_id),
    [targets.sections, compose.class_id],
  );
  const sectionsByFilterClass = useMemo(
    () => (classFilter ? targets.sections.filter((item) => String(item.class_id) === classFilter) : targets.sections),
    [targets.sections, classFilter],
  );
  const sectionOptions = useMemo(
    () => sectionsBySelectedClass.map((item) => ({
      label: `${item.class_name} - ${item.name}`,
      value: String(item.id),
      description: [item.medium, item.class_scope === "hs" ? "Higher Secondary" : item.class_scope ? "School" : ""].filter(Boolean).join(" - "),
    })),
    [sectionsBySelectedClass],
  );
  const filteredSectionOptions = useMemo(
    () => sectionsByFilterClass.map((item) => ({ label: `${item.class_name} - ${item.name}`, value: String(item.id) })),
    [sectionsByFilterClass],
  );
  const targetTypeOptions = useMemo(
    () => [
      { label: "Parent of one student", value: "parent", description: "Search by student, parent, roll, class, or section" },
      { label: "One teacher", value: "teacher", description: "Search by teacher name or type" },
      { label: "One class, one section", value: "section", description: "Parents in one selected section" },
      { label: "Whole class, all sections", value: "class", description: "Parents across the selected class" },
      ...targets.broadcast_targets.map((item) => ({ label: item.label, value: item.key, description: "Group or broadcast conversation" })),
    ],
    [targets.broadcast_targets],
  );
  const recipientOptions = useMemo(() => {
    const grouped = new Map<number, RecipientOption>();
    for (const item of targets.parents) {
      const userId = Number(item.user_id);
      if (!userId) continue;
      const existing = grouped.get(userId) || {
        user_id: userId,
        name: item.name,
        roles: [],
        phones: [],
        classNames: [],
        sectionNames: [],
        teacherScopes: [],
        staffTypes: [],
        studentNames: [],
      };
      if (!existing.roles.includes("parent")) existing.roles.push("parent");
      if (item.mobile && !existing.phones.includes(String(item.mobile))) existing.phones.push(String(item.mobile));
      if (item.class_name && !existing.classNames.includes(String(item.class_name))) existing.classNames.push(String(item.class_name));
      if (item.section_name && !existing.sectionNames.includes(String(item.section_name))) existing.sectionNames.push(String(item.section_name));
      if (item.student_name) {
        const roll = item.roll_number ? ` (Roll ${item.roll_number})` : "";
        const label = `${item.student_name}${roll}`;
        if (!existing.studentNames.includes(label)) existing.studentNames.push(label);
      }
      grouped.set(userId, existing);
    }
    for (const item of targets.teachers) {
      const userId = Number(item.user_id);
      if (!userId) continue;
      const existing = grouped.get(userId) || {
        user_id: userId,
        name: item.name,
        roles: [],
        phones: [],
        classNames: [],
        sectionNames: [],
        teacherScopes: [],
        staffTypes: [],
        studentNames: [],
      };
      if (!existing.roles.includes("teacher")) existing.roles.push("teacher");
      if (item.phone && !existing.phones.includes(String(item.phone))) existing.phones.push(String(item.phone));
      if (item.class_name && !existing.classNames.includes(String(item.class_name))) existing.classNames.push(String(item.class_name));
      if (item.section_name && !existing.sectionNames.includes(String(item.section_name))) existing.sectionNames.push(String(item.section_name));
      const teacherScope = normalizeTeacherScope(item.type || item.class_scope);
      const staffType = normalizeStaffType(item.staff_type || "teaching");
      if (teacherScope !== "all" && !existing.teacherScopes.includes(teacherScope)) existing.teacherScopes.push(teacherScope);
      if (staffType !== "all" && !existing.staffTypes.includes(staffType)) existing.staffTypes.push(staffType);
      grouped.set(userId, existing);
    }

    const query = search.trim().toLowerCase();
    const role = compose.target_type === "parent" ? "parent" : compose.target_type === "teacher" ? "teacher" : roleFilter;
    return Array.from(grouped.values())
      .filter((item) => {
        if (role !== "all" && !item.roles.includes(role)) return false;
        if (classFilter && !item.classNames.length) return false;
        if (sectionFilter && !item.sectionNames.length) return false;
        if (role !== "parent" && teacherScopeFilter !== "all" && item.roles.includes("teacher") && !item.teacherScopes.includes(teacherScopeFilter)) return false;
        if (role !== "parent" && staffTypeFilter !== "all" && item.roles.includes("teacher") && !item.staffTypes.includes(staffTypeFilter)) return false;
        if (!query) return true;
        return [item.name, item.phones.join(" "), item.classNames.join(" "), item.sectionNames.join(" "), item.teacherScopes.join(" "), item.staffTypes.join(" "), item.studentNames.join(" ")]
          .join(" ")
          .toLowerCase()
          .includes(query);
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [targets, compose.target_type, search, roleFilter, classFilter, sectionFilter, teacherScopeFilter, staffTypeFilter]);
  const selectedRecipient = recipientOptions.find((item) => String(item.user_id) === compose.recipient_user_id) || null;
  const selectedClass = targets.classes.find((item) => String(item.id) === compose.class_id) || null;
  const selectedSection = targets.sections.find((item) => String(item.id) === compose.section_id) || null;
  const defaultConversationName = useMemo(() => {
    if (compose.target_type === "class") return selectedClass ? `Class ${selectedClass.name}` : "";
    if (compose.target_type === "section") return selectedSection ? `Section ${selectedSection.class_name} ${selectedSection.name}` : "";
    if (compose.target_type === "broadcast") return "All Users";
    if (compose.target_type === "all_classes") return "All Classes";
    if (compose.target_type === "all_sections") return "All Sections";
    if (compose.target_type === "all_parents") {
      return compose.parent_type === "college" ? "All College Parents" : compose.parent_type === "school" ? "All School Parents" : "All Parents";
    }
    if (compose.target_type === "all_teachers") {
      return formatTeacherAudienceName(compose.teacher_scope, compose.staff_type);
    }
    return "";
  }, [compose.target_type, compose.parent_type, compose.teacher_scope, compose.staff_type, selectedClass, selectedSection]);
  const effectiveConversationName = compose.name.trim() || defaultConversationName;
  const recipientCount = useMemo(() => {
    if (["parent", "teacher", "direct"].includes(compose.target_type)) return selectedRecipient ? 1 : 0;
    if (compose.target_type === "class" && compose.class_id) {
      return new Set(targets.parents.filter((item) => String(item.class_id) === compose.class_id).map((item) => item.user_id).filter(Boolean)).size;
    }
    if (compose.target_type === "section" && compose.section_id) {
      return new Set(targets.parents.filter((item) => String(item.section_id) === compose.section_id).map((item) => item.user_id).filter(Boolean)).size;
    }
    if (compose.target_type === "all_teachers") {
      return new Set(targets.teachers.filter((item) => {
        const teacherScope = normalizeTeacherScope(item.type || item.class_scope);
        const staffType = normalizeStaffType(item.staff_type || "teaching");
        return (compose.teacher_scope === "all" || teacherScope === compose.teacher_scope) && (compose.staff_type === "all" || staffType === compose.staff_type);
      }).map((item) => item.user_id).filter(Boolean)).size;
    }
    if (compose.target_type === "all_parents") {
      return new Set(targets.parents.filter((item) => compose.parent_type === "all" || item.class_scope === (compose.parent_type === "college" ? "hs" : "school")).map((item) => item.user_id).filter(Boolean)).size;
    }
    if (compose.target_type === "broadcast") {
      return new Set([...targets.parents.map((item) => item.user_id), ...targets.teachers.map((item) => item.user_id)].filter(Boolean)).size;
    }
    return new Set(targets.parents.map((item) => item.user_id).filter(Boolean)).size;
  }, [compose, selectedRecipient, targets.parents, targets.teachers]);
  const canOpen = useMemo(() => {
    if (["parent", "teacher", "direct"].includes(compose.target_type)) return Boolean(compose.recipient_user_id);
    if (compose.target_type === "class") return Boolean(compose.class_id);
    if (compose.target_type === "section") return Boolean(compose.section_id);
    return Boolean(effectiveConversationName);
  }, [compose, effectiveConversationName]);

  function selectAudience(value: TargetType) {
    setCompose({ ...EMPTY_COMPOSE, target_type: value });
    setSearch("");
    setRoleFilter("all");
    setClassFilter("");
    setSectionFilter("");
    setTeacherScopeFilter("all");
    setStaffTypeFilter("all");
    setStep("target");
  }

  function openChat() {
    const payload: ComposeTargetPayload = { target_type: compose.target_type };
    let label = "Conversation";
    if (["parent", "teacher", "direct"].includes(compose.target_type)) {
      if (!compose.recipient_user_id) return;
      payload.recipient_user_id = Number(compose.recipient_user_id);
      const studentLabel = selectedRecipient?.studentNames.join(", ").trim();
      label = compose.target_type === "parent" && studentLabel ? studentLabel : selectedRecipient?.name || `User #${compose.recipient_user_id}`;
    } else if (compose.target_type === "class") {
      if (!compose.class_id) return;
      payload.class_id = Number(compose.class_id);
      payload.name = effectiveConversationName;
      label = effectiveConversationName;
    } else if (compose.target_type === "section") {
      if (!compose.section_id) return;
      payload.section_id = Number(compose.section_id);
      payload.name = effectiveConversationName;
      label = effectiveConversationName;
    } else {
      if (compose.target_type === "all_parents") payload.parent_type = compose.parent_type;
      if (compose.target_type === "all_teachers") {
        payload.teacher_scope = compose.teacher_scope;
        payload.staff_type = compose.staff_type;
      }
      payload.name = effectiveConversationName;
      label = effectiveConversationName;
    }
    navigation.navigate("AppShell", {
      tab: "messaging",
      composeTarget: { token: Date.now(), label, payload },
    });
  }

  function renderAudienceCard(option: { label: string; value: string; description?: string }) {
    const value = option.value as TargetType;
    return (
      <Pressable key={option.value} style={[styles.audienceCard, { borderColor: theme.border, backgroundColor: theme.card }]} onPress={() => selectAudience(value)}>
        <View style={[styles.audienceIcon, { backgroundColor: isDark ? theme.cardMuted : "#fff7ed" }]}>
          <Ionicons name={audienceIcon(value)} size={20} color={theme.success} />
        </View>
        <View style={styles.audienceCopy}>
          <Text style={[styles.audienceTitle, { color: theme.text }]}>{option.label}</Text>
          <Text style={[styles.audienceDesc, { color: theme.subText }]}>{option.description || "Choose recipients"}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={theme.icon} />
      </Pressable>
    );
  }

  function renderGroupNameInput() {
    if (!isGroupTargetType(compose.target_type)) return null;
    return (
      <View style={styles.composeSection}>
        <Text style={[styles.inputLabel, { color: theme.text }]}>Conversation Name</Text>
        <TextInput
          value={compose.name}
          onChangeText={(value) => setCompose((prev) => ({ ...prev, name: value }))}
          placeholder={defaultConversationName || "Name this conversation"}
          placeholderTextColor={theme.mutedText}
          style={[styles.input, { borderColor: theme.border, backgroundColor: theme.inputBg, color: theme.text }]}
        />
        <Text style={[styles.meta, { color: theme.subText }]}>
          {effectiveConversationName ? `Will appear as: ${effectiveConversationName}` : "This name helps identify the group thread later."}
        </Text>
      </View>
    );
  }

  const audienceGroups = [
    { title: "One Person", values: ["parent", "teacher"] },
    { title: "Class Or Section", values: ["section", "class", "all_classes"] },
    { title: "Whole Group", values: ["all_parents", "all_teachers", "broadcast", "all_sections"] },
  ];
  const optionByValue = new Map(targetTypeOptions.map((item) => [item.value, item]));

  return (
    <SafeAreaView edges={["top", "left", "right", "bottom"]} style={[styles.safeArea, { backgroundColor: theme.bg }]}>
      <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={0}>
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <Pressable style={[styles.iconBtn, { backgroundColor: theme.cardMuted }]} onPress={() => (step === "audience" ? navigation.goBack() : setStep("audience"))}>
            <Ionicons name="arrow-back-outline" size={20} color={theme.icon} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={[styles.eyebrow, { color: theme.subText }]}>Step {step === "audience" ? "1" : "2"} of 2</Text>
            <Text style={[styles.title, { color: theme.text }]}>New Conversation</Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.centered}><ActivityIndicator color={theme.icon} /></View>
        ) : step === "audience" ? (
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {audienceGroups.map((group) => (
              <View key={group.title} style={styles.composeSection}>
                <Text style={[styles.groupLabel, { color: theme.subText }]}>{group.title}</Text>
                {group.values.map((value) => {
                  const option = optionByValue.get(value);
                  return option ? renderAudienceCard(option) : null;
                })}
              </View>
            ))}
          </ScrollView>
        ) : (
          <>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View style={[styles.identityCard, { borderColor: "#fed7aa", backgroundColor: isDark ? theme.cardMuted : "#fff7ed" }]}>
                <View style={[styles.audienceIcon, { backgroundColor: theme.card }]}>
                  <Ionicons name={audienceIcon(compose.target_type)} size={20} color={theme.success} />
                </View>
                <View style={styles.audienceCopy}>
                  <Text style={[styles.selectedLabel, { color: theme.success }]}>Sending To</Text>
                  <Text style={[styles.audienceTitle, { color: theme.text }]}>{targetTypeOptions.find((item) => item.value === compose.target_type)?.label || "Audience"}</Text>
                  <Text style={[styles.audienceDesc, { color: theme.subText }]}>{recipientCount ? `${recipientCount} recipient${recipientCount === 1 ? "" : "s"}` : "Select the target details"}</Text>
                </View>
              </View>

              {["parent", "teacher", "direct"].includes(compose.target_type) ? (
                <View style={styles.composeSection}>
                  <TextInput value={search} onChangeText={setSearch} placeholder="Search by name, phone, class or section" placeholderTextColor={theme.mutedText} style={[styles.input, { borderColor: theme.border, backgroundColor: theme.inputBg, color: theme.text }]} />
                  {compose.target_type === "direct" ? (
                    <SelectField label="User Type" value={roleFilter} options={[{ label: "All User Types", value: "all" }, { label: "Parents", value: "parent" }, { label: "Teachers", value: "teacher" }]} onChange={setRoleFilter} />
                  ) : null}
                  <SelectField label="Class" value={classFilter} options={classOptions} onChange={(value) => { setClassFilter(value); setSectionFilter(""); }} allowClear clearLabel="All Classes" />
                  <SelectField label="Section" value={sectionFilter} options={filteredSectionOptions} onChange={setSectionFilter} allowClear clearLabel="All Sections" />
                  {(compose.target_type === "teacher" || (compose.target_type === "direct" && roleFilter !== "parent")) ? (
                    <>
                      <SelectField label="Scope" value={teacherScopeFilter} options={[{ label: "All Scopes", value: "all" }, { label: "School", value: "school" }, { label: "College", value: "college" }]} onChange={(value) => setTeacherScopeFilter(value as "all" | "school" | "college")} />
                      <SelectField label="Staff Type" value={staffTypeFilter} options={[{ label: "All Staff Types", value: "all" }, { label: "Teaching", value: "teaching" }, { label: "Non Teaching", value: "non_teaching" }]} onChange={(value) => setStaffTypeFilter(value as "all" | "teaching" | "non_teaching")} />
                    </>
                  ) : null}
                  {recipientOptions.slice(0, 120).map((item) => {
                    const active = compose.recipient_user_id === String(item.user_id);
                    const isParentRow = compose.target_type === "parent" && item.roles.includes("parent");
                    const rowTitle = isParentRow && item.studentNames.length ? item.studentNames.join(", ") : item.name;
                    const rowMetaPrefix = isParentRow && item.studentNames.length ? `Parent: ${item.name}` : item.roles.join(", ");
                    return (
                      <Pressable key={item.user_id} style={[styles.targetRow, { borderColor: active ? theme.success : theme.border, backgroundColor: active ? (isDark ? theme.cardMuted : "#fff7ed") : theme.card }]} onPress={() => setCompose((prev) => ({ ...prev, recipient_user_id: String(item.user_id) }))}>
                        <Text style={[styles.rowTitle, { color: active ? theme.success : theme.text }]}>{rowTitle}</Text>
                        <Text style={[styles.meta, { color: theme.subText }]}>{rowMetaPrefix}{item.phones[0] ? ` - ${item.phones[0]}` : ""}{item.classNames.length ? ` - ${item.classNames.join(", ")}` : ""}{item.sectionNames.length ? ` - ${item.sectionNames.join(", ")}` : ""}</Text>
                      </Pressable>
                    );
                  })}
                  {!recipientOptions.length ? <Text style={[styles.meta, { color: theme.subText }]}>No matching recipients found.</Text> : null}
                </View>
              ) : compose.target_type === "class" ? (
                <View style={styles.composeSection}>
                  <SelectField label="Class" value={compose.class_id} options={classOptions} onChange={(value) => setCompose((prev) => ({ ...prev, class_id: value, name: "" }))} />
                  {renderGroupNameInput()}
                </View>
              ) : compose.target_type === "section" ? (
                <View style={styles.composeSection}>
                  <SelectField label="Class" value={compose.class_id} options={classOptions} onChange={(value) => setCompose((prev) => ({ ...prev, class_id: value, section_id: "", name: "" }))} />
                  <SelectField label="Section" value={compose.section_id} options={sectionOptions} onChange={(value) => setCompose((prev) => ({ ...prev, section_id: value, name: "" }))} />
                  {renderGroupNameInput()}
                </View>
              ) : (
                <View style={styles.composeSection}>
                  {compose.target_type === "all_parents" ? (
                    <SelectField label="Parent Type" value={compose.parent_type} options={[{ label: "All Parents", value: "all" }, { label: "School Parents", value: "school" }, { label: "College Parents", value: "college" }]} onChange={(value) => setCompose((prev) => ({ ...prev, parent_type: value as Compose["parent_type"], name: "" }))} />
                  ) : null}
                  {compose.target_type === "all_teachers" ? (
                    <>
                      <SelectField label="Scope" value={compose.teacher_scope} options={[{ label: "All Scopes", value: "all" }, { label: "School", value: "school" }, { label: "College", value: "college" }]} onChange={(value) => setCompose((prev) => ({ ...prev, teacher_scope: value as Compose["teacher_scope"], name: "" }))} />
                      <SelectField label="Staff Type" value={compose.staff_type} options={[{ label: "All Staff Types", value: "all" }, { label: "Teaching", value: "teaching" }, { label: "Non Teaching", value: "non_teaching" }]} onChange={(value) => setCompose((prev) => ({ ...prev, staff_type: value as Compose["staff_type"], name: "" }))} />
                    </>
                  ) : null}
                  {renderGroupNameInput()}
                </View>
              )}
            </ScrollView>

            <View style={[styles.footer, { borderTopColor: theme.border, paddingBottom: Math.max(insets.bottom, 12) }]}>
              <Pressable style={[styles.secondaryBtn, { borderColor: theme.border, backgroundColor: theme.card }]} onPress={() => setStep("audience")}>
                <Text style={[styles.secondaryText, { color: theme.text }]}>Change Audience</Text>
              </Pressable>
              <Pressable style={[styles.primaryBtn, { backgroundColor: theme.success }, !canOpen && styles.disabled]} onPress={openChat} disabled={!canOpen}>
                <Text style={styles.primaryText}>Open Chat</Text>
              </Pressable>
            </View>
          </>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(theme: ReturnType<typeof useAppTheme>["theme"]) {
  return StyleSheet.create({
    safeArea: { flex: 1 },
    screen: { flex: 1 },
    header: { flexDirection: "row", alignItems: "center", gap: 10, borderBottomWidth: 1, paddingHorizontal: 14, paddingBottom: 12 },
    iconBtn: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
    headerCopy: { flex: 1, gap: 2 },
    eyebrow: { fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.7 },
    title: { fontSize: 22, fontWeight: "800" },
    centered: { flex: 1, alignItems: "center", justifyContent: "center" },
    content: { gap: 16, paddingHorizontal: 14, paddingTop: 14, paddingBottom: 120 },
    composeSection: { gap: 10, marginBottom: 12 },
    groupLabel: { fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.7 },
    audienceCard: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderRadius: 14, padding: 13 },
    audienceIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
    audienceCopy: { flex: 1, gap: 3 },
    audienceTitle: { fontSize: 14, fontWeight: "800" },
    audienceDesc: { fontSize: 12, lineHeight: 17 },
    identityCard: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderRadius: 16, padding: 13 },
    selectedLabel: { fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.4 },
    inputLabel: { fontSize: 12, fontWeight: "800" },
    input: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 12, fontSize: 14 },
    targetRow: { borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 8 },
    rowTitle: { fontSize: 15, fontWeight: "800" },
    meta: { fontSize: 12, lineHeight: 17 },
    footer: { flexDirection: "row", gap: 10, borderTopWidth: 1, paddingHorizontal: 14, paddingTop: 12, backgroundColor: theme.bg },
    secondaryBtn: { flex: 1, borderWidth: 1, borderRadius: 12, paddingVertical: 11, alignItems: "center" },
    secondaryText: { fontWeight: "700" },
    primaryBtn: { flex: 1, borderRadius: 12, paddingVertical: 11, alignItems: "center" },
    primaryText: { color: theme.successText, fontWeight: "700" },
    disabled: { opacity: 0.5 },
  });
}
