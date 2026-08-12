import { useEffect, useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function shiftMonth(year: number, month: number, delta: number) {
  const next = new Date(year, month - 1 + delta, 1);
  return { year: next.getFullYear(), month: next.getMonth() + 1 };
}

function buildCalendarDays(year: number, month: number) {
  const totalDays = daysInMonth(year, month);
  const firstWeekday = new Date(year, month - 1, 1).getDay();
  const cells: Array<number | null> = Array.from({ length: firstWeekday }, () => null);
  for (let day = 1; day <= totalDays; day += 1) cells.push(day);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
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
  const insets = useSafeAreaInsets();

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

  const calendarDays = useMemo(() => buildCalendarDays(draftYear, draftMonth), [draftYear, draftMonth]);
  const todayKey = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const selectedKey = `${draftYear}-${pad(draftMonth)}-${pad(draftDay)}`;

  useEffect(() => {
    const maxDay = daysInMonth(draftYear, draftMonth);
    if (draftDay > maxDay) setDraftDay(maxDay);
  }, [draftYear, draftMonth, draftDay]);

  function moveMonth(delta: number) {
    const next = shiftMonth(draftYear, draftMonth, delta);
    const maxDay = daysInMonth(next.year, next.month);
    setDraftYear(next.year);
    setDraftMonth(next.month);
    setDraftDay((current) => Math.min(current, maxDay));
  }

  function moveYear(delta: number) {
    const nextYear = draftYear + delta;
    const maxDay = daysInMonth(nextYear, draftMonth);
    setDraftYear(nextYear);
    setDraftDay((current) => Math.min(current, maxDay));
  }

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
          <View style={[styles.modalCard, { backgroundColor: theme.card, borderColor: theme.border, marginBottom: Math.max(insets.bottom, 12), paddingBottom: Math.max(insets.bottom + 14, 26) }]}>
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

            <View style={styles.calendarPanel}>
              <View style={styles.yearRow}>
                <Pressable style={[styles.iconButton, { borderColor: theme.border, backgroundColor: theme.inputBg }]} onPress={() => moveYear(-1)}>
                  <Ionicons name="remove" size={18} color={theme.icon} />
                </Pressable>
                <Text style={[styles.yearText, { color: theme.text }]}>{draftYear}</Text>
                <Pressable style={[styles.iconButton, { borderColor: theme.border, backgroundColor: theme.inputBg }]} onPress={() => moveYear(1)}>
                  <Ionicons name="add" size={18} color={theme.icon} />
                </Pressable>
              </View>

              <View style={styles.monthRow}>
                <Pressable style={[styles.navButton, { borderColor: theme.border, backgroundColor: theme.inputBg }]} onPress={() => moveMonth(-1)}>
                  <Ionicons name="chevron-back" size={18} color={theme.icon} />
                </Pressable>
                <Text style={[styles.monthTitle, { color: theme.text }]}>{MONTH_NAMES[draftMonth - 1]} {draftYear}</Text>
                <Pressable style={[styles.navButton, { borderColor: theme.border, backgroundColor: theme.inputBg }]} onPress={() => moveMonth(1)}>
                  <Ionicons name="chevron-forward" size={18} color={theme.icon} />
                </Pressable>
              </View>

              <View style={styles.weekRow}>
                {WEEKDAYS.map((day) => (
                  <Text key={day} style={[styles.weekdayText, { color: theme.subText }]}>{day}</Text>
                ))}
              </View>

              <View style={styles.dayGrid}>
                {calendarDays.map((day, index) => {
                  const dateKey = day ? `${draftYear}-${pad(draftMonth)}-${pad(day)}` : "";
                  const active = dateKey === selectedKey;
                  const today = dateKey === todayKey;
                  return (
                    <View key={`${draftYear}-${draftMonth}-${index}`} style={styles.dayCell}>
                      {day ? (
                        <Pressable
                          style={[
                            styles.dayButton,
                            { borderColor: today ? theme.primary : "transparent", backgroundColor: active ? theme.primary : theme.inputBg },
                          ]}
                          onPress={() => setDraftDay(day)}
                        >
                          <Text style={[styles.dayText, { color: active ? theme.primaryText : theme.text }]}>{day}</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  );
                })}
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
    borderWidth: 1,
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
  optionText: { color: "#334155", fontWeight: "700" },
  calendarPanel: { gap: 14 },
  yearRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  yearText: { minWidth: 78, textAlign: "center", color: "#0f172a", fontSize: 18, fontWeight: "800" },
  iconButton: {
    width: 36,
    height: 36,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  monthRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  navButton: {
    width: 42,
    height: 42,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  monthTitle: { flex: 1, textAlign: "center", color: "#0f172a", fontSize: 16, fontWeight: "800" },
  weekRow: { flexDirection: "row" },
  weekdayText: { width: `${100 / 7}%`, textAlign: "center", color: "#64748b", fontSize: 11, fontWeight: "800" },
  dayGrid: { flexDirection: "row", flexWrap: "wrap", rowGap: 6 },
  dayCell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: "center", justifyContent: "center" },
  dayButton: {
    width: 36,
    height: 36,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  dayText: { color: "#0f172a", fontSize: 14, fontWeight: "800" },
});
