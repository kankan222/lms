import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useMemo, useState } from "react";
import { useAppTheme } from "../../theme/AppThemeProvider";

type Option = {
  label: string;
  value: string | number;
  description?: string;
};

type Props = {
  label?: string;
  placeholder?: string;
  value: string | number | null | undefined;
  options: Option[];
  onChange: (value: string) => void;
  disabled?: boolean;
  allowClear?: boolean;
  clearLabel?: string;
};

export default function SelectField({
  label,
  placeholder = "Select an option",
  value,
  options,
  onChange,
  disabled = false,
  allowClear = false,
  clearLabel = "Clear selection",
}: Props) {
  const [open, setOpen] = useState(false);
  const { theme } = useAppTheme();

  const selected = useMemo(
    () => options.find((option) => String(option.value) === String(value ?? "")) ?? null,
    [options, value],
  );

  return (
    <View style={styles.root}>
      {label ? <Text style={[styles.label, { color: theme.subText }]}>{label}</Text> : null}
      <Pressable style={[styles.field, { borderColor: theme.border, backgroundColor: theme.inputBg }, disabled && styles.fieldDisabled]} disabled={disabled} onPress={() => setOpen(true)}>
        <View style={styles.fieldCopy}>
          <Text style={[styles.valueText, { color: selected ? theme.text : theme.mutedText }, !selected && styles.placeholderText]} numberOfLines={1}>
            {selected?.label || placeholder}
          </Text>
          {selected?.description ? <Text style={[styles.descriptionText, { color: theme.subText }]} numberOfLines={1}>{selected.description}</Text> : null}
        </View>
        <Text style={[styles.chevron, { color: theme.icon }]}>v</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.overlay}>
          <Pressable style={[styles.backdrop, { backgroundColor: theme.overlay }]} onPress={() => setOpen(false)} />
          <View style={[styles.modalCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>{label || placeholder}</Text>
              <Pressable onPress={() => setOpen(false)} style={[styles.headerBtn, { borderColor: theme.border, backgroundColor: theme.inputBg }]}>
                <Text style={[styles.headerBtnText, { color: theme.text }]}>Done</Text>
              </Pressable>
            </View>
            <ScrollView style={styles.optionList} showsVerticalScrollIndicator={false}>
              {allowClear ? (
                <Pressable
                  style={[
                    styles.clearRow,
                    {
                      borderColor: theme.border,
                      backgroundColor: theme.cardMuted,
                    },
                  ]}
                  onPress={() => {
                    onChange("");
                    setOpen(false);
                  }}
                >
                  <Text style={[styles.clearLabel, { color: theme.text }]}>{clearLabel}</Text>
                  <Text style={[styles.clearMeta, { color: theme.mutedText }]}>Reset</Text>
                </Pressable>
              ) : null}
              {options.map((option) => {
                const active = String(option.value) === String(value ?? "");
                return (
                  <Pressable
                    key={`${option.value}`}
                    style={[
                      styles.optionRow,
                      { borderColor: theme.border, backgroundColor: theme.inputBg },
                      active && {
                        borderColor: theme.primary,
                        backgroundColor: theme.isDark ? "#f8fafc" : theme.cardMuted,
                      },
                    ]}
                    onPress={() => {
                      onChange(String(option.value));
                      setOpen(false);
                    }}
                  >
                    <View style={styles.optionCopy}>
                      <Text
                        style={[
                          styles.optionLabel,
                          { color: theme.text },
                          active && { color: theme.isDark ? "#0f172a" : theme.text },
                        ]}
                      >
                        {option.label}
                      </Text>
                      {option.description ? (
                        <Text
                          style={[
                            styles.optionDescription,
                            { color: theme.subText },
                            active && { color: theme.isDark ? "#334155" : theme.subText },
                          ]}
                        >
                          {option.description}
                        </Text>
                      ) : null}
                    </View>
                    {active ? <Text style={[styles.optionCheck, { color: theme.success }]}>OK</Text> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 6 },
  label: { color: "#334155", fontWeight: "700" },
  field: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 14,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  fieldDisabled: { opacity: 0.55 },
  fieldCopy: { flex: 1, gap: 2 },
  valueText: { color: "#0f172a", fontSize: 15, fontWeight: "600" },
  placeholderText: { color: "#94a3b8", fontWeight: "500" },
  descriptionText: { color: "#64748b", fontSize: 12 },
  chevron: { color: "#475569", fontWeight: "700", fontSize: 12 },
  overlay: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(15, 23, 42, 0.28)" },
  modalCard: {
    maxHeight: "75%",
    borderWidth: 1,
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 18,
    gap: 12,
  },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  modalTitle: { color: "#0f172a", fontWeight: "800", fontSize: 18, flex: 1 },
  headerBtn: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#fff",
  },
  headerBtnText: { color: "#334155", fontWeight: "700" },
  optionList: { maxHeight: 520 },
  clearRow: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 9,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  optionRow: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 14,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  optionCopy: { flex: 1, gap: 2 },
  clearLabel: { color: "#0f172a", fontWeight: "800" },
  clearMeta: { fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.6 },
  optionLabel: { color: "#0f172a", fontWeight: "700" },
  optionDescription: { color: "#64748b", fontSize: 12, lineHeight: 16 },
  optionCheck: { color: "#15803d", fontWeight: "800", fontSize: 12 },
});
