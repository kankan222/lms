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
import { getClassStructure, getSessions } from "../../services/classesService";
import {
  createFeeStructure,
  createInstallment,
  FeeStructure,
  getAllFeeStructures,
  updateFeeStructure,
  deleteFeeStructure,
  updateInstallment,
  deleteInstallment,
} from "../../services/feesService";
import { formatDateLabel } from "../../utils/format";

type ClassItem = { id: number; name: string };
type SessionItem = { id: number; name: string; is_active?: boolean | number };

export default function FeesTab() {
  const [fees, setFees] = useState<FeeStructure[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [expandedId, setExpandedId] = useState<number | null>(null);

  const [feeModalOpen, setFeeModalOpen] = useState(false);
  const [installmentModalOpen, setInstallmentModalOpen] = useState(false);

  const [editingFeeId, setEditingFeeId] = useState<number | null>(null);
  const [editingInstallmentId, setEditingInstallmentId] = useState<number | null>(null);

  const [classId, setClassId] = useState<number | null>(null);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [admissionFee, setAdmissionFee] = useState("");

  const [structureId, setStructureId] = useState<number | null>(null);
  const [installmentName, setInstallmentName] = useState("");
  const [installmentAmount, setInstallmentAmount] = useState("");
  const [dueDate, setDueDate] = useState("");

  const activeSession = useMemo(
    () => sessions.find((s) => Number(s.is_active) === 1 || s.is_active === true) ?? null,
    [sessions]
  );

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [classRows, sessionRows, feeRows] = await Promise.all([
          getClassStructure(),
          getSessions(),
          getAllFeeStructures(),
        ]);
        setClasses(classRows.map((c) => ({ id: Number(c.id), name: c.name })));
        setSessions(
          (sessionRows ?? []).map((s) => ({
            id: Number(s.id),
            name: s.name,
            is_active: s.is_active,
          }))
        );
        setFees(feeRows);
      } catch (err: unknown) {
        Alert.alert("Load failed", getErrorMessage(err, "Could not load fee data."));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (activeSession && sessionId === null) {
      setSessionId(activeSession.id);
    }
  }, [activeSession, sessionId]);

  function resetFeeForm() {
    setEditingFeeId(null);
    setClassId(null);
    setSessionId(activeSession?.id ?? null);
    setAdmissionFee("");
  }

  function resetInstallmentForm() {
    setEditingInstallmentId(null);
    setStructureId(null);
    setInstallmentName("");
    setInstallmentAmount("");
    setDueDate("");
  }

  async function refreshFees() {
    const feeRows = await getAllFeeStructures();
    setFees(feeRows);
  }

  function openCreateFeeModal() {
    resetFeeForm();
    setFeeModalOpen(true);
  }

  function openEditFeeModal(fee: FeeStructure) {
    setEditingFeeId(Number(fee.id));
    setAdmissionFee(String(fee.admission_fee ?? ""));
    setFeeModalOpen(true);
  }

  async function handleSaveFeeStructure() {
    if (!admissionFee.trim()) {
      Alert.alert("Validation", "Admission fee is required.");
      return;
    }

    const parsedAdmission = Number(admissionFee);
    if (Number.isNaN(parsedAdmission) || parsedAdmission <= 0) {
      Alert.alert("Validation", "Admission fee must be a valid amount.");
      return;
    }

    if (!editingFeeId && (!classId || !sessionId)) {
      Alert.alert("Validation", "Class and session are required.");
      return;
    }

    setSaving(true);
    try {
      if (editingFeeId) {
        await updateFeeStructure(editingFeeId, {
          admission_fee: parsedAdmission,
        });
      } else {
        await createFeeStructure({
          class_id: Number(classId),
          session_id: Number(sessionId),
          admission_fee: parsedAdmission,
        });
      }

      await refreshFees();
      setFeeModalOpen(false);
      resetFeeForm();
    } catch (err: unknown) {
      Alert.alert("Save failed", getErrorMessage(err, "Could not save fee structure."));
    } finally {
      setSaving(false);
    }
  }

  function confirmDeleteFeeStructure(fee: FeeStructure) {
    Alert.alert("Delete fee", `Delete fee for ${fee.class_name} (${fee.session_name})?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteFeeStructure(fee.id);
            await refreshFees();
          } catch (err: unknown) {
            Alert.alert("Delete failed", getErrorMessage(err, "Could not delete fee structure."));
          }
        },
      },
    ]);
  }

  function openCreateInstallmentModal() {
    resetInstallmentForm();
    setInstallmentModalOpen(true);
  }

  function openEditInstallmentModal(feeId: number, inst: FeeStructure["installments"][number]) {
    setEditingInstallmentId(Number(inst.id));
    setStructureId(Number(feeId));
    setInstallmentName(String(inst.installment_name ?? ""));
    setInstallmentAmount(String(inst.amount ?? ""));
    setDueDate(inst.due_date ? String(inst.due_date).split("T")[0] : "");
    setInstallmentModalOpen(true);
  }

  async function handleSaveInstallment() {
    if (!installmentName.trim() || !installmentAmount.trim()) {
      Alert.alert("Validation", "Installment name and amount are required.");
      return;
    }
    if (!editingInstallmentId && !structureId) {
      Alert.alert("Validation", "Fee structure is required.");
      return;
    }

    const parsedAmount = Number(installmentAmount);
    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert("Validation", "Installment amount must be a valid amount.");
      return;
    }

    setSaving(true);
    try {
      if (editingInstallmentId) {
        await updateInstallment(editingInstallmentId, {
          installment_name: installmentName.trim(),
          amount: parsedAmount,
          due_date: dueDate || null,
        });
      } else {
        await createInstallment({
          fee_structure_id: Number(structureId),
          installment_name: installmentName.trim(),
          amount: parsedAmount,
          due_date: dueDate || undefined,
        });
      }

      await refreshFees();
      setInstallmentModalOpen(false);
      resetInstallmentForm();
    } catch (err: unknown) {
      Alert.alert("Save failed", getErrorMessage(err, "Could not save installment."));
    } finally {
      setSaving(false);
    }
  }

  function confirmDeleteInstallment(inst: FeeStructure["installments"][number]) {
    Alert.alert("Delete installment", `Delete installment '${inst.installment_name}'?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteInstallment(inst.id);
            await refreshFees();
          } catch (err: unknown) {
            Alert.alert("Delete failed", getErrorMessage(err, "Could not delete installment."));
          }
        },
      },
    ]);
  }

  return (
    <View style={styles.root}>
      <View style={styles.toolbar}>
        <Text style={styles.title}>Fees</Text>
        <View style={styles.toolbarActions}>
          <Pressable style={styles.secondaryBtn} onPress={openCreateInstallmentModal}>
            <Text style={styles.secondaryBtnText}>Add Installment</Text>
          </Pressable>
          <Pressable style={styles.primaryBtn} onPress={openCreateFeeModal}>
            <Text style={styles.primaryBtnText}>Add Fee</Text>
          </Pressable>
        </View>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#0f172a" />
        </View>
      ) : (
        <ScrollView style={styles.listWrap} contentContainerStyle={styles.listContent}>
          {fees.length ? (
            fees.map((fee) => {
              const isExpanded = expandedId === fee.id;
              return (
                <View key={fee.id} style={styles.card}>
                  <Pressable
                    style={styles.cardHeader}
                    onPress={() => setExpandedId(isExpanded ? null : fee.id)}
                  >
                    <View>
                      <Text style={styles.cardTitle}>Admission Fee Rs {fee.admission_fee}</Text>
                      <Text style={styles.meta}>{fee.class_name}</Text>
                      <Text style={styles.meta}>{fee.session_name}</Text>
                    </View>
                    <Text style={styles.expandText}>{isExpanded ? "Hide" : "Show"}</Text>
                  </Pressable>

                  <View style={styles.actionRow}>
                    <Pressable style={styles.secondaryBtn} onPress={() => openEditFeeModal(fee)}>
                      <Text style={styles.secondaryBtnText}>Edit Fee</Text>
                    </Pressable>
                    <Pressable style={styles.deleteBtn} onPress={() => confirmDeleteFeeStructure(fee)}>
                      <Text style={styles.deleteBtnText}>Delete Fee</Text>
                    </Pressable>
                  </View>

                  {isExpanded ? (
                    <View style={styles.installmentsWrap}>
                      <Text style={styles.installmentsTitle}>Installments</Text>
                      {fee.installments?.length ? (
                        fee.installments.map((inst) => (
                          <View key={inst.id} style={styles.installmentRow}>
                            <View style={styles.installmentInfo}>
                              <Text style={styles.installmentName}>{inst.installment_name}</Text>
                              <Text style={styles.installmentDate}>
                                Due: {formatDateLabel(inst.due_date)}
                              </Text>
                            </View>
                            <View>
                              <Text style={styles.installmentAmount}>Rs {inst.amount}</Text>
                              <View style={styles.installmentActions}>
                                <Pressable
                                  style={styles.installmentActionBtn}
                                  onPress={() => openEditInstallmentModal(fee.id, inst)}
                                >
                                  <Text style={styles.installmentActionText}>Edit</Text>
                                </Pressable>
                                <Pressable
                                  style={styles.installmentDeleteBtn}
                                  onPress={() => confirmDeleteInstallment(inst)}
                                >
                                  <Text style={styles.installmentDeleteText}>Delete</Text>
                                </Pressable>
                              </View>
                            </View>
                          </View>
                        ))
                      ) : (
                        <Text style={styles.emptyText}>No installments yet.</Text>
                      )}
                    </View>
                  ) : null}
                </View>
              );
            })
          ) : (
            <Text style={styles.emptyText}>No fee structures found.</Text>
          )}
        </ScrollView>
      )}

      <Modal visible={feeModalOpen} transparent animationType="slide" onRequestClose={() => setFeeModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setFeeModalOpen(false)} />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{editingFeeId ? "Edit Fee Structure" : "Create Fee Structure"}</Text>
            <ScrollView style={styles.modalBody}>
              <Text style={styles.inputLabel}>Admission Fee *</Text>
              <TextInput
                style={styles.input}
                value={admissionFee}
                onChangeText={setAdmissionFee}
                placeholder="Amount"
                keyboardType="numeric"
              />

              {!editingFeeId ? (
                <>
                  <Text style={[styles.inputLabel, styles.spaceTop]}>Class *</Text>
                  <View style={styles.chipWrap}>
                    {classes.map((item) => {
                      const active = classId === item.id;
                      return (
                        <Pressable
                          key={item.id}
                          style={[styles.chip, active && styles.chipActive]}
                          onPress={() => setClassId(item.id)}
                        >
                          <Text style={[styles.chipText, active && styles.chipTextActive]}>{item.name}</Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  <Text style={[styles.inputLabel, styles.spaceTop]}>Session *</Text>
                  <View style={styles.chipWrap}>
                    {sessions.map((item) => {
                      const active = sessionId === item.id;
                      return (
                        <Pressable
                          key={item.id}
                          style={[styles.chip, active && styles.chipActive]}
                          onPress={() => setSessionId(item.id)}
                        >
                          <Text style={[styles.chipText, active && styles.chipTextActive]}>{item.name}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              ) : null}
            </ScrollView>

            <View style={styles.modalFooter}>
              <Pressable style={styles.secondaryBtn} onPress={() => setFeeModalOpen(false)} disabled={saving}>
                <Text style={styles.secondaryBtnText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.primaryBtn} onPress={handleSaveFeeStructure} disabled={saving}>
                <Text style={styles.primaryBtnText}>{saving ? "Saving..." : "Save"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={installmentModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setInstallmentModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setInstallmentModalOpen(false)} />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{editingInstallmentId ? "Edit Installment" : "Add Installment"}</Text>
            <ScrollView style={styles.modalBody}>
              {!editingInstallmentId ? (
                <>
                  <Text style={styles.inputLabel}>Fee Structure *</Text>
                  <View style={styles.chipWrap}>
                    {fees.map((item) => {
                      const active = structureId === item.id;
                      return (
                        <Pressable
                          key={item.id}
                          style={[styles.chip, active && styles.chipActive]}
                          onPress={() => setStructureId(item.id)}
                        >
                          <Text style={[styles.chipText, active && styles.chipTextActive]}>
                            {item.class_name} - {item.session_name}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              ) : null}

              <Text style={[styles.inputLabel, styles.spaceTop]}>Installment Name *</Text>
              <TextInput
                style={styles.input}
                value={installmentName}
                onChangeText={setInstallmentName}
                placeholder="Installment name"
              />

              <Text style={[styles.inputLabel, styles.spaceTop]}>Amount *</Text>
              <TextInput
                style={styles.input}
                value={installmentAmount}
                onChangeText={setInstallmentAmount}
                placeholder="Amount"
                keyboardType="numeric"
              />

              <Text style={[styles.inputLabel, styles.spaceTop]}>Due Date (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.input}
                value={dueDate}
                onChangeText={setDueDate}
                placeholder="2026-12-31"
              />
            </ScrollView>

            <View style={styles.modalFooter}>
              <Pressable
                style={styles.secondaryBtn}
                onPress={() => setInstallmentModalOpen(false)}
                disabled={saving}
              >
                <Text style={styles.secondaryBtnText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.primaryBtn} onPress={handleSaveInstallment} disabled={saving}>
                <Text style={styles.primaryBtnText}>{saving ? "Saving..." : "Save"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
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
    gap: 8,
  },
  toolbarActions: {
    flexDirection: "row",
    gap: 8,
  },
  title: {
    color: "#0f172a",
    fontWeight: "700",
    fontSize: 18,
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
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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
  expandText: {
    color: "#334155",
    fontWeight: "700",
  },
  actionRow: {
    marginTop: 10,
    flexDirection: "row",
    gap: 8,
  },
  installmentsWrap: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingTop: 10,
    gap: 8,
  },
  installmentsTitle: {
    color: "#0f172a",
    fontWeight: "700",
  },
  installmentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    backgroundColor: "#f8fafc",
    padding: 10,
  },
  installmentInfo: {
    flex: 1,
  },
  installmentName: {
    color: "#0f172a",
    fontWeight: "600",
  },
  installmentDate: {
    color: "#64748b",
    marginTop: 3,
  },
  installmentAmount: {
    color: "#0f172a",
    fontWeight: "700",
    textAlign: "right",
  },
  installmentActions: {
    marginTop: 6,
    flexDirection: "row",
    gap: 6,
    justifyContent: "flex-end",
  },
  installmentActionBtn: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#fff",
  },
  installmentActionText: {
    color: "#334155",
    fontWeight: "600",
    fontSize: 12,
  },
  installmentDeleteBtn: {
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#fee2e2",
  },
  installmentDeleteText: {
    color: "#b91c1c",
    fontWeight: "700",
    fontSize: 12,
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
    maxHeight: 460,
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
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 10,
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
    backgroundColor: "#ffffff",
  },
  chipActive: {
    borderColor: "#0f172a",
    backgroundColor: "#e2e8f0",
  },
  chipText: {
    color: "#334155",
    fontWeight: "600",
  },
  chipTextActive: {
    color: "#0f172a",
  },
  modalFooter: {
    marginTop: 12,
    flexDirection: "row",
    justifyContent: "flex-end",
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
    color: "#ffffff",
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
  spaceTop: {
    marginTop: 10,
  },
});

