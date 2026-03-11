import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { getStudentById, type StudentDetails } from "../../../services/studentsService";
import { getPayments, getStudentFeeOptions, type PaymentItem, type StudentFeeOption } from "../../../services/paymentsService";
import { downloadAndShareStudentReport, getStudentReport, type StudentReport } from "../../../services/examsService";
import { formatDateLabel } from "../../../utils/format";

type TabKey = "overview" | "parents" | "fees" | "reports";

type ExamOption = {
  id: number;
  name: string;
};

type Props = {
  studentId: number | null;
  exams: ExamOption[];
};

function normalizeFeeStatus(value?: string | null) {
  const status = String(value || "").trim().toLowerCase();
  return status || "-";
}

function statusBadgeStyle(status: string) {
  if (status === "paid") return styles.statusPaid;
  if (status === "partial") return styles.statusPartial;
  if (status === "pending") return styles.statusPending;
  return styles.statusDefault;
}



export default function StudentDetailsModule({ studentId, exams }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("overview");

  const [student, setStudent] = useState<StudentDetails | null>(null);
  const [feeItems, setFeeItems] = useState<StudentFeeOption[]>([]);
  const [payments, setPayments] = useState<PaymentItem[]>([]);

  const [selectedExamId, setSelectedExamId] = useState<number | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [report, setReport] = useState<StudentReport | null>(null);

  useEffect(() => {
    if (!studentId) return;

    setActiveTab("overview");
    setSelectedExamId(null);
    setReport(null);
    setReportError(null);

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [detail, feeRows, paymentRows] = await Promise.all([
          getStudentById(studentId),
          getStudentFeeOptions(studentId),
          getPayments({ student_id: studentId }),
        ]);

        setStudent(detail);
        setFeeItems(feeRows);
        setPayments(paymentRows);
      } catch {
        setError("Failed to load student details.");
        setStudent(null);
        setFeeItems([]);
        setPayments([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [studentId]);

  useEffect(() => {
    if (!studentId || !selectedExamId) {
      setReport(null);
      setReportError(null);
      return;
    }

    (async () => {
      setReportLoading(true);
      setReportError(null);
      try {
        const next = await getStudentReport(selectedExamId, studentId);
        setReport(next);
      } catch {
        setReport(null);
        setReportError("Report not available for this exam.");
      } finally {
        setReportLoading(false);
      }
    })();
  }, [studentId, selectedExamId]);

  const father = useMemo(
    () => student?.parents?.find((p) => p.relationship?.toLowerCase() === "father"),
    [student]
  );
  const mother = useMemo(
    () => student?.parents?.find((p) => p.relationship?.toLowerCase() === "mother"),
    [student]
  );

  if (!studentId) {
    return <Text style={styles.muted}>Select a student.</Text>;
  }

  if (loading) {
    return <ActivityIndicator />;
  }

  if (error) {
    return <Text style={styles.error}>{error}</Text>;
  }

  if (!student) {
    return <Text style={styles.muted}>Student not found.</Text>;
  }

  return (
    <View style={styles.root}>
      <View style={styles.hero}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{(student.name || "S").slice(0, 1).toUpperCase()}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{student.name}</Text>
          <Text style={styles.muted}>Admission: {student.admission_no || "-"}</Text>
          <Text style={styles.muted}>Phone: {student.mobile || "-"}</Text>
          <View style={styles.row}>
            <Badge text={student.gender || "-"} />
            <Badge text={`${student.class || "-"} - ${student.section || "-"}`} />
          </View>
        </View>
      </View>

      <View style={styles.grid}>
        <InfoCard label="Roll" value={String(student.roll_number || "-")} />
        <InfoCard label="Session" value={student.session || "-"} />
        <InfoCard label="DOB" value={formatDateLabel(student.dob)} />
        <InfoCard label="Admission Date" value={formatDateLabel(student.date_of_admission)} />
      </View>

      <ScrollView horizontal contentContainerStyle={styles.row}>
        {(["overview", "parents", "fees", "reports"] as TabKey[]).map((tab) => (
          <Pressable key={tab} style={[styles.chip, activeTab === tab && styles.chipActive]} onPress={() => setActiveTab(tab)}>
            <Text style={styles.chipText}>{toTitle(tab)}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {activeTab === "overview" ? (
        <View style={styles.section}>
          <InfoRow label="Student ID" value={`#${student.id}`} />
          <InfoRow label="Class" value={student.class || "-"} />
          <InfoRow label="Section" value={student.section || "-"} />
          <InfoRow label="Gender" value={student.gender || "-"} />
        </View>
      ) : null}

      {activeTab === "parents" ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Father</Text>
          <InfoRow label="Name" value={father?.name || "-"} />
          <InfoRow label="Phone" value={father?.mobile || "-"} />
          <InfoRow label="Email" value={father?.email || "-"} />
          <InfoRow label="Occupation" value={father?.occupation || "-"} />
          <InfoRow label="Qualification" value={father?.qualification || "-"} />

          <View style={styles.separator} />

          <Text style={styles.sectionTitle}>Mother</Text>
          <InfoRow label="Name" value={mother?.name || "-"} />
          <InfoRow label="Phone" value={mother?.mobile || "-"} />
          <InfoRow label="Email" value={mother?.email || "-"} />
          <InfoRow label="Occupation" value={mother?.occupation || "-"} />
          <InfoRow label="Qualification" value={mother?.qualification || "-"} />
        </View>
      ) : null}

      {activeTab === "fees" ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pending / Active Fee Items</Text>
          {feeItems.length ? (
            feeItems.map((item) => (
              <View key={`fee-${item.id}`} style={styles.listItem}>
                <Text style={styles.listTitle}>{item.installment_name || item.fee_type}</Text>
                                <View style={styles.statusRow}>
                  <Text style={styles.muted}>Due: {formatDateLabel(item.due_date)}</Text>
                  <View style={[styles.statusBadge, statusBadgeStyle(normalizeFeeStatus(item.status))]}>
                    <Text style={styles.statusBadgeText}>{toTitle(normalizeFeeStatus(item.status))}</Text>
                  </View>
                </View>
                <Text style={styles.muted}>Total: Rs {Number(item.amount || 0)} | Paid: Rs {Number(item.paid || 0)} | Remaining: Rs {Number(item.remaining || 0)}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.muted}>No pending fee items.</Text>
          )}

          <Text style={[styles.sectionTitle, styles.mt]}>Payment History</Text>
          {payments.length ? (
            payments.map((p) => (
              <View key={`pay-${p.id}-${p.created_at}`} style={styles.listItem}>
                <Text style={styles.listTitle}>{p.fee_type || "-"} - Rs {Number(p.amount_paid || 0)}</Text>
                                <View style={styles.statusRow}>
                  <Text style={styles.muted}>Date: {formatDateLabel(p.created_at)}</Text>
                  <View style={[styles.statusBadge, statusBadgeStyle(normalizeFeeStatus(p.fee_status || p.status))]}>
                    <Text style={styles.statusBadgeText}>{toTitle(normalizeFeeStatus(p.fee_status || p.status))}</Text>
                  </View>
                </View>
                <Text style={styles.muted}>Class: {p.class_name || "-"} | Section: {p.section_name || "-"}</Text>
                <Text style={styles.muted}>Remarks: {p.remarks || "-"}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.muted}>No payment history.</Text>
          )}
        </View>
      ) : null}

      {activeTab === "reports" ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Exam Report / Marksheet</Text>
          <ScrollView horizontal contentContainerStyle={styles.row}>
            {exams.map((exam) => (
              <Pressable key={`exam-${exam.id}`} style={[styles.chip, selectedExamId === exam.id && styles.chipActive]} onPress={() => setSelectedExamId(exam.id)}>
                <Text style={styles.chipText}>{exam.name}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <Pressable
            style={[styles.downloadBtn, (!selectedExamId || !report) && styles.btnDisabled]}
            disabled={!selectedExamId || !report}
            onPress={async () => {
              if (!selectedExamId) return;
              await downloadAndShareStudentReport(selectedExamId, student.id);
            }}
          >
            <Text style={styles.downloadText}>Download Marksheet</Text>
          </Pressable>

          {reportLoading ? <ActivityIndicator style={styles.mt} /> : null}
          {reportError ? <Text style={styles.error}>{reportError}</Text> : null}

          {report ? (
            <View style={styles.listItem}>
              <InfoRow label="Exam" value={report.exam?.name || "-"} />
              <InfoRow label="Class" value={report.exam?.class_name || "-"} />
              <InfoRow label="Section" value={report.exam?.section_name || "-"} />
              <InfoRow label="Percentage" value={`${report.summary?.percentage ?? 0}%`} />

              <View style={styles.separator} />

              {(report.subjects || []).map((s, idx) => (
                <InfoRow
                  key={`sub-${s.subject}-${idx}`}
                  label={s.subject}
                  value={`${s.marks}/${s.max_marks} (Pass ${s.pass_marks})`}
                />
              ))}
            </View>
          ) : (
            <Text style={styles.muted}>{selectedExamId ? "No report available." : "Select an exam."}</Text>
          )}
        </View>
      ) : null}
    </View>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoCard}>
      <Text style={styles.muted}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.muted}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

function Badge({ text }: { text: string }) {
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{text}</Text>
    </View>
  );
}

function toTitle(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

const styles = StyleSheet.create({
  root: { gap: 10, paddingBottom: 8 },
  hero: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 12, backgroundColor: "#fff", padding: 12, flexDirection: "row", gap: 12 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: "#e2e8f0", alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 22, fontWeight: "700", color: "#0f172a" },
  name: { color: "#0f172a", fontSize: 18, fontWeight: "700" },
  muted: { color: "#64748b", fontSize: 13 },
  error: { color: "#b91c1c", fontSize: 13 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  infoCard: { width: "48%", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 10, backgroundColor: "#fff", padding: 10 },
  infoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6, gap: 8 },
  value: { color: "#0f172a", fontWeight: "600", textAlign: "right", flexShrink: 1 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" },
  chip: { borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: "#fff" },
  chipActive: { borderColor: "#0f172a", backgroundColor: "#e2e8f0" },
  chipText: { color: "#0f172a", fontWeight: "600" },
  badge: { borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: "#f8fafc" },
  badgeText: { color: "#334155", fontSize: 12, fontWeight: "600" },
  section: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 12, backgroundColor: "#fff", padding: 12 },
  sectionTitle: { color: "#0f172a", fontWeight: "700", marginBottom: 8 },
  listItem: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 10, backgroundColor: "#f8fafc", padding: 10, marginBottom: 8 },
  listTitle: { color: "#0f172a", fontWeight: "700", marginBottom: 4 },
  statusRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 4 },
  statusBadge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  statusBadgeText: { fontSize: 12, fontWeight: "700", textTransform: "capitalize" },
  statusPaid: { borderColor: "#86efac", backgroundColor: "#dcfce7" },
  statusPartial: { borderColor: "#fde68a", backgroundColor: "#fef3c7" },
  statusPending: { borderColor: "#fecaca", backgroundColor: "#fee2e2" },
  statusDefault: { borderColor: "#cbd5e1", backgroundColor: "#f1f5f9" },
  separator: { height: 1, backgroundColor: "#e2e8f0", marginVertical: 8 },
  downloadBtn: { backgroundColor: "#0f172a", borderRadius: 8, paddingVertical: 10, paddingHorizontal: 12, marginTop: 8, alignSelf: "flex-start" },
  downloadText: { color: "#fff", fontWeight: "600" },
  btnDisabled: { opacity: 0.45 },
  mt: { marginTop: 10 },
});





