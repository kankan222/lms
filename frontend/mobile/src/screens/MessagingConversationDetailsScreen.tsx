import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import type { RootStackParamList } from "../navigation/AppNavigator";
import { updateConversation } from "../services/messagingService";
import { useAppTheme } from "../theme/AppThemeProvider";

type Props = NativeStackScreenProps<RootStackParamList, "MessagingConversationDetails">;

function getErrorMessage(err: unknown, fallback: string) {
  if (typeof err === "object" && err && "response" in err) {
    const data = (err as { response?: { data?: { error?: string; message?: string } } }).response?.data;
    return data?.error || data?.message || fallback;
  }
  return fallback;
}

export default function MessagingConversationDetailsScreen({ navigation, route }: Props) {
  const { conversationId, name, type } = route.params;
  const { theme, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [conversationName, setConversationName] = useState(name || "");
  const [saving, setSaving] = useState(false);

  const trimmedName = conversationName.trim();
  const canSave = Boolean(trimmedName) && trimmedName !== String(name || "").trim() && !saving;

  async function saveName() {
    if (!canSave) return;
    setSaving(true);
    try {
      await updateConversation(conversationId, { name: trimmedName });
      navigation.goBack();
    } catch (err) {
      Alert.alert("Rename failed", getErrorMessage(err, "Could not update the conversation name."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView edges={["top", "left", "right", "bottom"]} style={[styles.safeArea, { backgroundColor: theme.bg }]}>
      <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={[styles.header, { borderBottomColor: theme.border, paddingTop: Math.max(insets.top, 6) }]}>
          <Pressable style={[styles.iconBtn, { backgroundColor: theme.cardMuted, borderColor: theme.border }]} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back-outline" size={20} color={theme.icon} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={[styles.eyebrow, { color: theme.subText }]}>Conversation</Text>
            <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>Details</Text>
          </View>
        </View>

        <View style={styles.content}>
          <View style={[styles.card, { borderColor: theme.border, backgroundColor: theme.card }]}>
            <View style={[styles.avatar, { backgroundColor: isDark ? theme.cardMuted : "#fff7ed" }]}>
              <Ionicons name={type === "broadcast" ? "megaphone-outline" : type === "class" ? "people-outline" : "grid-outline"} size={22} color={theme.success} />
            </View>
            <View style={styles.cardCopy}>
              <Text style={[styles.label, { color: theme.subText }]}>Current Name</Text>
              <Text style={[styles.currentName, { color: theme.text }]}>{name || "Conversation"}</Text>
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={[styles.inputLabel, { color: theme.text }]}>Conversation Name</Text>
            <TextInput
              value={conversationName}
              onChangeText={setConversationName}
              placeholder="Enter conversation name"
              placeholderTextColor={theme.mutedText}
              maxLength={120}
              autoCapitalize="words"
              style={[styles.input, { borderColor: theme.border, backgroundColor: theme.inputBg, color: theme.text }]}
            />
            <Text style={[styles.counter, { color: theme.subText }]}>{trimmedName.length}/120</Text>
          </View>
        </View>

        <View style={[styles.footer, { borderTopColor: theme.border, backgroundColor: theme.bg, paddingBottom: Math.max(insets.bottom, 12) }]}>
          <Pressable style={[styles.secondaryBtn, { borderColor: theme.border, backgroundColor: theme.card }]} onPress={() => navigation.goBack()} disabled={saving}>
            <Text style={[styles.secondaryText, { color: theme.text }]}>Cancel</Text>
          </Pressable>
          <Pressable style={[styles.primaryBtn, { backgroundColor: theme.success }, !canSave && styles.disabled]} onPress={() => void saveName()} disabled={!canSave}>
            {saving ? <ActivityIndicator color={theme.successText} /> : <Text style={[styles.primaryText, { color: theme.successText }]}>Save</Text>}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(theme: ReturnType<typeof useAppTheme>["theme"]) {
  return StyleSheet.create({
    safeArea: { flex: 1 },
    screen: { flex: 1 },
    header: { flexDirection: "row", alignItems: "center", gap: 10, borderBottomWidth: 1, paddingHorizontal: 14, paddingBottom: 10 },
    iconBtn: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: 1 },
    headerCopy: { flex: 1, minWidth: 0 },
    eyebrow: { fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },
    title: { fontSize: 20, fontWeight: "800" },
    content: { flex: 1, gap: 18, padding: 14 },
    card: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderRadius: 16, padding: 14 },
    avatar: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
    cardCopy: { flex: 1, minWidth: 0 },
    label: { fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.4 },
    currentName: { marginTop: 3, fontSize: 16, fontWeight: "800" },
    fieldGroup: { gap: 8 },
    inputLabel: { fontSize: 13, fontWeight: "800" },
    input: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 12, fontSize: 15, fontWeight: "700" },
    counter: { alignSelf: "flex-end", fontSize: 11, fontWeight: "700" },
    footer: { flexDirection: "row", gap: 10, borderTopWidth: 1, paddingHorizontal: 14, paddingTop: 12 },
    secondaryBtn: { flex: 1, alignItems: "center", justifyContent: "center", borderWidth: 1, borderRadius: 14, paddingVertical: 13 },
    secondaryText: { fontSize: 14, fontWeight: "800" },
    primaryBtn: { flex: 1, alignItems: "center", justifyContent: "center", borderRadius: 14, paddingVertical: 13 },
    primaryText: { fontSize: 14, fontWeight: "800" },
    disabled: { opacity: 0.45 },
  });
}
