import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "../../theme/AppThemeProvider";

type Props = {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function normalizeDate(value?: string) {
  const raw = String(value || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return "";
}

function formatDisplay(value: string) {
  const normalized = normalizeDate(value);
  if (!normalized) return "";
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return normalized;
  return date.toLocaleDateString();
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

export default function DateField({
  label,
  value,
  onChange,
  placeholder = "Select date",
  disabled = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const { theme } = useAppTheme();

  const normalized = normalizeDate(value);
  const now = new Date();
  const [draftYear, setDraftYear] = useState(Number(normalized.slice(0, 4) || now.getFullYear()));
  const [draftMonth, setDraftMonth] = useState(Number(normalized.slice(5, 7) || now.getMonth() + 1));
  const [draftDay, setDraftDay] = useState(Number(normalized.slice(8, 10) || now.getDate()));

  useEffect(() => {
    if (!open) return;
    const dateValue = normalizeDate(value);
    const current = new Date();
    setDraftYear(Number(dateValue.slice(0, 4) || current.getFullYear()));
    setDraftMonth(Number(dateValue.slice(5, 7) || current.getMonth() + 1));
    setDraftDay(Number(dateValue.slice(8, 10) || current.getDate()));
  }, [open, value]);

  const years = useMemo(() => {
    const currentYear = now.getFullYear();
    return Array.from({ length: 41 }, (_, index) => currentYear - 25 + index);
  }, [now]);
  const months = useMemo(() => Array.from({ length: 12 }, (_, index) => index + 1), []);
  const days = useMemo(() => Array.from({ length: daysInMonth(draftYear, draftMonth) }, (_, index) => index + 1), [draftYear, draftMonth]);

  useEffect(() => {
    const maxDay = daysInMonth(draftYear, draftMonth);
    if (draftDay > maxDay) setDraftDay(maxDay);
  }, [draftYear, draftMonth, draftDay]);

  return (
    <View style={styles.root}>
      {label ? <Text style={[styles.label, { color: theme.subText }]}>{label}</Text> : null}
      <Pressable style={[styles.field, { borderColor: theme.border, backgroundColor: theme.inputBg }, disabled && styles.fieldDisabled]} disabled={disabled} onPress={() => setOpen(true)}>
        <Text style={[styles.valueText, { color: normalized ? theme.text : theme.mutedText }, !normalized && styles.placeholderText]}>
          {normalized ? formatDisplay(normalized) : placeholder}
        </Text>
        <Text style={[styles.chevron, { color: theme.icon }]}>v</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.overlay}>
          <Pressable style={[styles.backdrop, { backgroundColor: theme.overlay }]} onPress={() => setOpen(false)} />
          <View style={[styles.modalCard, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>{label || placeholder}</Text>
              <View style={styles.headerActions}>
                <Pressable
                  style={[styles.headerBtn, { borderColor: theme.border, backgroundColor: theme.inputBg }]}
                  onPress={() => {
                    onChange("");
                    setOpen(false);
                  }}
                >
                  <Text style={[styles.headerBtnText, { color: theme.text }]}>Clear</Text>
                </Pressable>
                <Pressable
                  style={[styles.headerBtn, { borderColor: theme.border, backgroundColor: theme.inputBg }]}
                  onPress={() => {
                    onChange(`${draftYear}-${pad(draftMonth)}-${pad(draftDay)}`);
                    setOpen(false);
                  }}
                >
                  <Text style={[styles.headerBtnText, { color: theme.text }]}>Apply</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.columns}>
              <View style={styles.column}>
                <Text style={[styles.columnTitle, { color: theme.subText }]}>Year</Text>
                <ScrollView style={styles.columnList} showsVerticalScrollIndicator={false}>
                  {years.map((year) => {
                    const active = draftYear === year;
                    return (
                      <Pressable key={year} style={[styles.optionChip, { borderColor: theme.border, backgroundColor: theme.inputBg }, active && styles.optionChipActive]} onPress={() => setDraftYear(year)}>
                        <Text style={[styles.optionText, { color: theme.text }, active && styles.optionTextActive]}>{year}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
              <View style={styles.column}>
                <Text style={[styles.columnTitle, { color: theme.subText }]}>Month</Text>
                <ScrollView style={styles.columnList} showsVerticalScrollIndicator={false}>
                  {months.map((month) => {
                    const active = draftMonth === month;
                    return (
                      <Pressable key={month} style={[styles.optionChip, { borderColor: theme.border, backgroundColor: theme.inputBg }, active && styles.optionChipActive]} onPress={() => setDraftMonth(month)}>
                        <Text style={[styles.optionText, { color: theme.text }, active && styles.optionTextActive]}>{pad(month)}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
              <View style={styles.column}>
                <Text style={[styles.columnTitle, { color: theme.subText }]}>Day</Text>
                <ScrollView style={styles.columnList} showsVerticalScrollIndicator={false}>
                  {days.map((day) => {
                    const active = draftDay === day;
                    return (
                      <Pressable key={day} style={[styles.optionChip, { borderColor: theme.border, backgroundColor: theme.inputBg }, active && styles.optionChipActive]} onPress={() => setDraftDay(day)}>
                        <Text style={[styles.optionText, { color: theme.text }, active && styles.optionTextActive]}>{pad(day)}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            </View>
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
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  fieldDisabled: { opacity: 0.55 },
  valueText: { color: "#0f172a", fontSize: 15, fontWeight: "600" },
  placeholderText: { color: "#94a3b8", fontWeight: "500" },
  chevron: { color: "#475569", fontWeight: "700", fontSize: 12 },
  overlay: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(15, 23, 42, 0.28)" },
  modalCard: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 18,
    gap: 14,
  },
  modalHeader: { gap: 10 },
  modalTitle: { color: "#0f172a", fontWeight: "800", fontSize: 18 },
  headerActions: { flexDirection: "row", gap: 8, justifyContent: "flex-end" },
  headerBtn: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#fff",
  },
  headerBtnText: { color: "#334155", fontWeight: "700" },
  columns: { flexDirection: "row", gap: 10 },
  column: { flex: 1, gap: 8 },
  columnTitle: { color: "#334155", fontWeight: "700", fontSize: 12, textTransform: "uppercase" },
  columnList: { maxHeight: 280 },
  optionChip: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    backgroundColor: "#fff",
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginBottom: 8,
    alignItems: "center",
  },
  optionChipActive: { borderColor: "#0f172a", backgroundColor: "#0f172a" },
  optionText: { color: "#334155", fontWeight: "700" },
  optionTextActive: { color: "#fff" },
});
