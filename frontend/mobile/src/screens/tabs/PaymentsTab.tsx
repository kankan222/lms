import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { getClassStructure } from "../../services/classesService";
import { getStudents } from "../../services/studentsService";
import {
  createPayment,
  deletePayment,
  downloadAndShareReceipt,
  getPayments,
  getStudentFeeOptions,
  PaymentItem,
  StudentFeeOption,
  updatePayment,
} from "../../services/paymentsService";

type ClassStructureItem = {
  id: number;
  name: string;
  sections: Array<{ id: number; name: string; medium?: string | null }>;
};

type StudentItem = {
  id: number;
  name: string;
};

type CreateForm = {
  class_id: number | null;
  section_id: number | null;
  student_id: number | null;
  student_fee_id: number | null;
  amount_paid: string;
  remarks: string;
};

type EditForm = {
  id: number | null;
  amount_paid: string;
  remarks: string;
};

const EMPTY_CREATE_FORM: CreateForm = {
  class_id: null,
  section_id: null,
  student_id: null,
  student_fee_id: null,
  amount_paid: "",
  remarks: "",
};

const EMPTY_EDIT_FORM: EditForm = {
  id: null,
  amount_paid: "",
  remarks: "",
};

export default function PaymentsTab() {
  const [classes, setClasses] = useState<ClassStructureItem[]>([]);
  const [payments, setPayments] = useState<PaymentItem[]>([]);

  const [filterClassId, setFilterClassId] = useState<number | null>(null);
  const [filterSectionId, setFilterSectionId] = useState<number | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [students, setStudents] = useState<StudentItem[]>([]);
  const [feeOptions, setFeeOptions] = useState<StudentFeeOption[]>([]);
  const [createForm, setCreateForm] = useState<CreateForm>(EMPTY_CREATE_FORM);
  const [editForm, setEditForm] = useState<EditForm>(EMPTY_EDIT_FORM);

  const selectedFilterClass = useMemo(
    () => classes.find((c) => c.id === filterClassId) ?? null,
    [classes, filterClassId]
  );

  const selectedCreateClass = useMemo(
    () => classes.find((c) => c.id === createForm.class_id) ?? null,
    [classes, createForm.class_id]
  );

  const selectedFee = useMemo(
    () => feeOptions.find((f) => Number(f.id) === Number(createForm.student_fee_id)) ?? null,
    [feeOptions, createForm.student_fee_id]
  );

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const structure = await getClassStructure();
        setClasses(structure as ClassStructureItem[]);
      } catch {
        setClasses([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    loadPayments();
  }, [filterClassId, filterSectionId]);

  useEffect(() => {
    if (!createForm.class_id || !createForm.section_id) {
      setStudents([]);
      setCreateForm((prev) => ({ ...prev, student_id: null, student_fee_id: null }));
      return;
    }
    loadCreateStudents(createForm.class_id, createForm.section_id);
  }, [createForm.class_id, createForm.section_id]);

  useEffect(() => {
    if (!createForm.student_id) {
      setFeeOptions([]);
      setCreateForm((prev) => ({ ...prev, student_fee_id: null }));
      return;
    }
    loadStudentFeeOptions(createForm.student_id);
  }, [createForm.student_id]);

  async function loadPayments() {
    setLoading(true);
    try {
      const rows = await getPayments({
        class_id: filterClassId ?? undefined,
        section_id: filterSectionId ?? undefined,
      });
      setPayments(rows);
    } catch (err: unknown) {
      Alert.alert("Load failed", getErrorMessage(err, "Could not load payments."));
      setPayments([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadCreateStudents(classId: number, sectionId: number) {
    try {
      const rows = await getStudents({
        class_id: String(classId),
        section_id: String(sectionId),
      });
      const list = rows.map((s) => ({ id: Number(s.id), name: s.name }));
      setStudents(list);
    } catch {
      setStudents([]);
    }
  }

  async function loadStudentFeeOptions(studentId: number) {
    try {
      const rows = await getStudentFeeOptions(studentId);
      setFeeOptions(rows);
    } catch (err: unknown) {
      setFeeOptions([]);
      Alert.alert(
        "No due items",
        getErrorMessage(err, "Fee ledger not available for this student.")
      );
    }
  }

  async function handleCreatePayment() {
    if (!createForm.student_fee_id) {
      Alert.alert("Validation", "Select due fee item.");
      return;
    }
    const amount = Number(createForm.amount_paid);
    if (!amount || amount <= 0) {
      Alert.alert("Validation", "Enter valid payment amount.");
      return;
    }
    if (selectedFee && amount > Number(selectedFee.remaining)) {
      Alert.alert("Validation", "Amount cannot exceed remaining fee.");
      return;
    }

    setSaving(true);
    try {
      await createPayment({
        student_fee_id: createForm.student_fee_id,
        amount_paid: amount,
        remarks: createForm.remarks || undefined,
      });
      setCreateOpen(false);
      setCreateForm(EMPTY_CREATE_FORM);
      setStudents([]);
      setFeeOptions([]);
      await loadPayments();
    } catch (err: unknown) {
      Alert.alert("Create failed", getErrorMessage(err, "Failed to create payment."));
    } finally {
      setSaving(false);
    }
  }

  function openEditPayment(row: PaymentItem) {
    setEditForm({
      id: row.id,
      amount_paid: String(row.amount_paid ?? ""),
      remarks: row.remarks ?? "",
    });
    setEditOpen(true);
  }

  async function handleUpdatePayment() {
    if (!editForm.id) return;
    const amount = Number(editForm.amount_paid);
    if (!amount || amount <= 0) {
      Alert.alert("Validation", "Enter valid payment amount.");
      return;
    }

    setSaving(true);
    try {
      await updatePayment(editForm.id, {
        amount_paid: amount,
        remarks: editForm.remarks,
      });
      setEditOpen(false);
      setEditForm(EMPTY_EDIT_FORM);
      await loadPayments();
    } catch (err: unknown) {
      Alert.alert("Update failed", getErrorMessage(err, "Failed to update payment."));
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(row: PaymentItem) {
    Alert.alert("Delete payment", "Delete this payment record?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deletePayment(row.id);
            await loadPayments();
          } catch (err: unknown) {
            Alert.alert("Delete failed", getErrorMessage(err, "Failed to delete payment."));
          }
        },
      },
    ]);
  }

  async function handleReceipt(row: PaymentItem) {
    try {
      const path = await downloadAndShareReceipt(row.id);
      if (!path) {
        Alert.alert("Receipt", "Receipt created.");
      }
    } catch (err: unknown) {
      Alert.alert("Receipt failed", getErrorMessage(err, "Failed to download receipt."));
    }
  }

  return (
    <View style={styles.root}>
      <View style={styles.toolbar}>
        <Text style={styles.title}>Payments</Text>
        <Pressable style={styles.primaryBtn} onPress={() => setCreateOpen(true)}>
          <Text style={styles.primaryBtnText}>Record Payment</Text>
        </Pressable>
      </View>

      <View style={styles.filterBlock}>
        <Text style={styles.filterTitle}>Filters</Text>
        <View style={styles.chipWrap}>
          <Pressable
            style={[styles.chip, filterClassId === null && styles.chipActive]}
            onPress={() => {
              setFilterClassId(null);
              setFilterSectionId(null);
            }}
          >
            <Text style={[styles.chipText, filterClassId === null && styles.chipTextActive]}>
              All Classes
            </Text>
          </Pressable>
          {classes.map((item) => {
            const active = filterClassId === item.id;
            return (
              <Pressable
                key={item.id}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => {
                  setFilterClassId(item.id);
                  setFilterSectionId(null);
                }}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{item.name}</Text>
              </Pressable>
            );
          })}
        </View>

        {filterClassId !== null ? (
          <>
            <Text style={[styles.filterTitle, styles.spaceTop]}>Sections</Text>
            <View style={styles.chipWrap}>
              <Pressable
                style={[styles.chip, filterSectionId === null && styles.chipActive]}
                onPress={() => setFilterSectionId(null)}
              >
                <Text style={[styles.chipText, filterSectionId === null && styles.chipTextActive]}>
                  All Sections
                </Text>
              </Pressable>
              {(selectedFilterClass?.sections ?? []).map((section) => {
                const active = filterSectionId === section.id;
                return (
                  <Pressable
                    key={section.id}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setFilterSectionId(section.id)}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {section.name}{section.medium ? ` (${section.medium})` : ""}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#0f172a" />
        </View>
      ) : (
        <ScrollView style={styles.listWrap} contentContainerStyle={styles.listContent}>
          {payments.length ? (
            payments.map((row) => {
              const status = getPaymentStatus(row);
              return (
                <View key={row.id} style={styles.card}>
                  <Text style={styles.cardTitle}>{row.student_name}</Text>
                  <Text style={styles.meta}>
                    {row.class_name} - {row.section_name}
                  </Text>
                  <Text style={styles.meta}>Medium: {row.medium || "-"}</Text>
                  <Text style={styles.meta}>
                    {row.fee_type} | Paid: Rs {row.amount_paid}
                  </Text>
                  <View style={[styles.statusBadge, statusStyle(status)]}>
                    <Text style={[styles.statusBadgeText, statusTextStyle(status)]}>{toTitle(status)}</Text>
                  </View>
                  <View style={styles.rowActions}>
                    <Pressable style={styles.secondaryBtn} onPress={() => openEditPayment(row)}>
                      <Text style={styles.secondaryBtnText}>Edit</Text>
                    </Pressable>
                    <Pressable style={styles.deleteBtn} onPress={() => confirmDelete(row)}>
                      <Text style={styles.deleteBtnText}>Delete</Text>
                    </Pressable>
                    <Pressable style={styles.secondaryBtn} onPress={() => handleReceipt(row)}>
                      <Text style={styles.secondaryBtnText}>Receipt</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })
          ) : (
            <Text style={styles.emptyText}>No payment records found.</Text>
          )}
        </ScrollView>
      )}

      <Modal visible={createOpen} transparent animationType="slide" onRequestClose={() => setCreateOpen(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setCreateOpen(false)} />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Record Payment</Text>
            <ScrollView style={styles.modalBody}>
              <Text style={styles.inputLabel}>Class *</Text>
              <View style={styles.chipWrap}>
                {classes.map((item) => {
                  const active = createForm.class_id === item.id;
                  return (
                    <Pressable
                      key={item.id}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() =>
                        setCreateForm((prev) => ({
                          ...prev,
                          class_id: item.id,
                          section_id: null,
                          student_id: null,
                          student_fee_id: null,
                        }))
                      }
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{item.name}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={[styles.inputLabel, styles.spaceTop]}>Section *</Text>
              <View style={styles.chipWrap}>
                {(selectedCreateClass?.sections ?? []).map((section) => {
                  const active = createForm.section_id === section.id;
                  return (
                    <Pressable
                      key={section.id}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() =>
                        setCreateForm((prev) => ({
                          ...prev,
                          section_id: section.id,
                          student_id: null,
                          student_fee_id: null,
                        }))
                      }
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>
                        {section.name}{section.medium ? ` (${section.medium})` : ""}
                    </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={[styles.inputLabel, styles.spaceTop]}>Student *</Text>
              <View style={styles.chipWrap}>
                {students.map((student) => {
                  const active = createForm.student_id === student.id;
                  return (
                    <Pressable
                      key={student.id}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() =>
                        setCreateForm((prev) => ({
                          ...prev,
                          student_id: student.id,
                          student_fee_id: null,
                        }))
                      }
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>
                        {student.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={[styles.inputLabel, styles.spaceTop]}>Due Fee Item *</Text>
              <View style={styles.dueItemWrap}>
                {feeOptions.map((f) => {
                  const active = Number(createForm.student_fee_id) === Number(f.id);
                  return (
                    <Pressable
                      key={f.id}
                      style={[styles.dueItem, active && styles.dueItemActive]}
                      onPress={() =>
                        setCreateForm((prev) => ({
                          ...prev,
                          student_fee_id: Number(f.id),
                        }))
                      }
                    >
                      <Text style={[styles.dueText, active && styles.dueTextActive]}>
                        {f.installment_name || f.fee_type}
                      </Text>
                      <Text style={[styles.dueSubText, active && styles.dueTextActive]}>
                        Remaining: {f.remaining}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={[styles.inputLabel, styles.spaceTop]}>Amount Paid *</Text>
              <TextInput
                style={styles.input}
                value={createForm.amount_paid}
                onChangeText={(value) => setCreateForm((prev) => ({ ...prev, amount_paid: value }))}
                keyboardType="numeric"
                placeholder="Amount"
              />
              {selectedFee ? (
                <Text style={styles.helperText}>
                  Due: {selectedFee.amount} | Paid: {selectedFee.paid} | Remaining: {selectedFee.remaining}
                </Text>
              ) : null}

              <Text style={[styles.inputLabel, styles.spaceTop]}>Remarks</Text>
              <TextInput
                style={styles.input}
                value={createForm.remarks}
                onChangeText={(value) => setCreateForm((prev) => ({ ...prev, remarks: value }))}
                placeholder="Optional remarks"
              />
            </ScrollView>
            <View style={styles.modalFooter}>
              <Pressable style={styles.secondaryBtn} onPress={() => setCreateOpen(false)} disabled={saving}>
                <Text style={styles.secondaryBtnText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.primaryBtn} onPress={handleCreatePayment} disabled={saving}>
                <Text style={styles.primaryBtnText}>{saving ? "Saving..." : "Save"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={editOpen} transparent animationType="slide" onRequestClose={() => setEditOpen(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setEditOpen(false)} />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit Payment</Text>
            <ScrollView style={styles.modalBody}>
              <Text style={styles.inputLabel}>Amount Paid *</Text>
              <TextInput
                style={styles.input}
                value={editForm.amount_paid}
                onChangeText={(value) => setEditForm((prev) => ({ ...prev, amount_paid: value }))}
                keyboardType="numeric"
                placeholder="Amount"
              />

              <Text style={[styles.inputLabel, styles.spaceTop]}>Remarks</Text>
              <TextInput
                style={styles.input}
                value={editForm.remarks}
                onChangeText={(value) => setEditForm((prev) => ({ ...prev, remarks: value }))}
                placeholder="Optional remarks"
              />
            </ScrollView>
            <View style={styles.modalFooter}>
              <Pressable style={styles.secondaryBtn} onPress={() => setEditOpen(false)} disabled={saving}>
                <Text style={styles.secondaryBtnText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.primaryBtn} onPress={handleUpdatePayment} disabled={saving}>
                <Text style={styles.primaryBtnText}>{saving ? "Saving..." : "Update"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function getPaymentStatus(row: PaymentItem) {
  const raw = String(row.fee_status || row.status || "").trim().toLowerCase();
  return raw || "-";
}

function statusStyle(status: string) {
  if (status === "paid") return { borderColor: "#86efac", backgroundColor: "#dcfce7" };
  if (status === "partial") return { borderColor: "#fde68a", backgroundColor: "#fef3c7" };
  if (status === "pending") return { borderColor: "#fecaca", backgroundColor: "#fee2e2" };
  return { borderColor: "#cbd5e1", backgroundColor: "#f8fafc" };
}

function statusTextStyle(status: string) {
  if (status === "paid") return { color: "#166534" };
  if (status === "partial") return { color: "#92400e" };
  if (status === "pending") return { color: "#b91c1c" };
  return { color: "#334155" };
}

function toTitle(value: string) {
  if (!value || value === "-") return "-";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function getErrorMessage(err: unknown, fallback: string) {
  if (
    typeof err === "object" &&
    err &&
    "response" in err &&
    typeof (err as { response?: { data?: { message?: string } } }).response?.data?.message ===
      "string"
  ) {
    return (err as { response?: { data?: { message?: string } } }).response?.data?.message || fallback;
  }
  return fallback;
}

const styles = StyleSheet.create({
  root: {
    gap: 12,
  },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    color: "#0f172a",
    fontWeight: "700",
    fontSize: 18,
  },
  filterBlock: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    backgroundColor: "#ffffff",
    padding: 12,
  },
  filterTitle: {
    color: "#334155",
    fontWeight: "700",
    marginBottom: 8,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#fff",
  },
  chipActive: {
    borderColor: "#0f172a",
    backgroundColor: "#e2e8f0",
  },
  chipText: {
    color: "#334155",
    fontWeight: "600",
    textTransform: "capitalize",
  },
  chipTextActive: {
    color: "#0f172a",
  },
  spaceTop: {
    marginTop: 10,
  },
  centered: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 30,
  },
  listWrap: {
    maxHeight: 520,
  },
  listContent: {
    gap: 10,
    paddingBottom: 10,
  },
  card: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    backgroundColor: "#ffffff",
    padding: 12,
  },
  cardTitle: {
    color: "#0f172a",
    fontWeight: "700",
    fontSize: 16,
  },
  meta: {
    marginTop: 4,
    color: "#475569",
  },
  statusBadge: {
    marginTop: 6,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusBadgeText: {
    fontWeight: "700",
    fontSize: 12,
    textTransform: "capitalize",
  },
  rowActions: {
    marginTop: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  primaryBtn: {
    backgroundColor: "#0f172a",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: {
    color: "#fff",
    fontWeight: "600",
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtnText: {
    color: "#334155",
    fontWeight: "600",
  },
  deleteBtn: {
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: "#fee2e2",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteBtnText: {
    color: "#b91c1c",
    fontWeight: "700",
  },
  emptyText: {
    color: "#64748b",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.35)",
  },
  modalCard: {
    maxHeight: "86%",
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
  },
  modalTitle: {
    color: "#0f172a",
    fontWeight: "700",
    fontSize: 18,
    marginBottom: 10,
  },
  modalBody: {
    maxHeight: 470,
  },
  inputLabel: {
    color: "#334155",
    fontWeight: "600",
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  helperText: {
    marginTop: 6,
    color: "#64748b",
    fontSize: 12,
  },
  dueItemWrap: {
    gap: 8,
  },
  dueItem: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    padding: 10,
    backgroundColor: "#fff",
  },
  dueItemActive: {
    borderColor: "#0f172a",
    backgroundColor: "#e2e8f0",
  },
  dueText: {
    color: "#1e293b",
    fontWeight: "700",
  },
  dueSubText: {
    marginTop: 2,
    color: "#64748b",
    fontSize: 12,
  },
  dueTextActive: {
    color: "#0f172a",
  },
  modalFooter: {
    marginTop: 12,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
});




