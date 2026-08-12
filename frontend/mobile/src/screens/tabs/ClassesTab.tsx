import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import TopNotice from "../../components/feedback/TopNotice";
import { useAppTheme } from "../../theme/AppThemeProvider";
import {
  ClassItem,
  ClassListResult,
  ClassPayload,
  ClassScope,
  SectionMedium,
  createClass,
  deleteClass,
  getClasses,
  updateClass,
} from "../../services/classesService";

type SectionForm = {
  name: string;
  medium: SectionMedium | "";
};

type ClassForm = {
  name: string;
  class_scope: ClassScope;
  sections: SectionForm[];
};

type ClassView = {
  id: number;
  name: string;
  class_scope: ClassScope;
  sections: SectionForm[];
  subjects: string[];
};

type ValidationResult =
  | { ok: false; message: string }
  | { ok: true; payload: ClassPayload };

type SectionRowError = {
  medium?: string;
};

type NoticeState = {
  tone: "success" | "error";
  title: string;
  message: string;
} | null;
type DeleteTarget = { id: number; name: string } | null;
const CLASS_PAGE_SIZE = 30;

const EMPTY_FORM: ClassForm = {
  name: "",
  class_scope: "school",
  sections: [{ name: "", medium: "" }],
};

function makeEmptyForm(): ClassForm {
  return {
    name: "",
    class_scope: "school",
    sections: [{ name: "", medium: "" }],
  };
}

function formatScope(scope: ClassScope) {
  return scope === "hs" ? "Higher Secondary" : "School";
}

function splitCsv(raw: string) {
  return String(raw || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function normalizeSections(item: ClassItem): SectionForm[] {
  if (Array.isArray(item.section_details) && item.section_details.length) {
    return item.section_details.map((section) => ({
      name: String(section?.name || "").trim(),
      medium: (String(section?.medium || "").trim() as SectionMedium | "") || "",
    }));
  }

  return splitCsv(item.sections).map((name) => ({ name, medium: "" }));
}

function normalizeSubjects(item: ClassItem): string[] {
  return splitCsv(item.subjects);
}

function buildClassRows(items: ClassItem[]): ClassView[] {
  return items
    .map((item) => ({
      id: Number(item.id),
      name: String(item.name || "").trim(),
      class_scope: (item.class_scope || "school") as ClassScope,
      sections: normalizeSections(item),
      subjects: normalizeSubjects(item),
    }));
}

export default function ClassesTab() {
  const { theme } = useAppTheme();
  const [rows, setRows] = useState<ClassView[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<NoticeState>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [totalRows, setTotalRows] = useState<number | null>(null);

  const [scopeFilter, setScopeFilter] = useState<ClassScope | "all">("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [createForm, setCreateForm] = useState<ClassForm>(makeEmptyForm());
  const [editForm, setEditForm] = useState<ClassForm>(makeEmptyForm());
  const [createSectionErrors, setCreateSectionErrors] = useState<SectionRowError[]>([]);
  const [editSectionErrors, setEditSectionErrors] = useState<SectionRowError[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);

  const canSubmitCreate = useMemo(() => !saving, [saving]);
  const canSubmitEdit = useMemo(() => !saving && editingId !== null, [saving, editingId]);

  const loadClasses = useCallback(async (mode: "initial" | "refresh" | "loadMore" = "initial") => {
    if (mode === "loadMore") {
      if (loading || refreshing || loadingMore || !hasMore) {
        return;
      }
      setLoadingMore(true);
    } else if (mode === "refresh") {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const nextPage = mode === "loadMore" ? currentPage + 1 : 1;
      const response: ClassListResult = await getClasses({ page: nextPage, limit: CLASS_PAGE_SIZE });
      const mappedRows = buildClassRows(response.data || []);

      if (mode === "loadMore") {
        setRows((prev) => {
          const seen = new Set(prev.map((item) => item.id));
          const incoming = mappedRows.filter((item) => !seen.has(item.id));
          return [...prev, ...incoming];
        });
      } else {
        setRows(mappedRows);
      }

      setCurrentPage(nextPage);
      setTotalRows(response.pagination?.total ?? null);
      if (response.pagination) {
        setHasMore(nextPage < Number(response.pagination.totalPages || 0));
      } else {
        setHasMore(mappedRows.length >= CLASS_PAGE_SIZE);
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Could not load class records."));
    } finally {
      if (mode === "loadMore") {
        setLoadingMore(false);
      } else if (mode === "refresh") {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, [currentPage, hasMore, loading, loadingMore, refreshing]);

  useEffect(() => {
    void loadClasses("initial");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!notice) return undefined;
    const timeout = setTimeout(() => setNotice(null), 3200);
    return () => clearTimeout(timeout);
  }, [notice]);

  const filteredRows = useMemo(() => {
    if (scopeFilter === "all") return rows;
    return rows.filter((row) => row.class_scope === scopeFilter);
  }, [rows, scopeFilter]);

  const stats = useMemo(() => {
    const totalClasses = rows.length;
    const totalSections = rows.reduce((sum, row) => sum + row.sections.length, 0);
    const schoolCount = rows.filter((row) => row.class_scope === "school").length;
    const higherSecondaryCount = rows.filter((row) => row.class_scope === "hs").length;
    return [
      {
        label: "Class Records",
        value: totalClasses,
        accent: theme.infoSoft,
        border: theme.infoBorder,
        tone: theme.infoText,
        labelTone: theme.subText,
      },
      {
        label: "Sections",
        value: totalSections,
        accent: theme.successSoft,
        border: theme.successBorder,
        tone: theme.success,
        labelTone: theme.subText,
      },
      {
        label: "School",
        value: schoolCount,
        accent: theme.warningSoft,
        border: theme.warningBorder,
        tone: theme.warningText,
        labelTone: theme.subText,
      },
      {
        label: "Higher Secondary",
        value: higherSecondaryCount,
        accent: theme.card,
        border: theme.border,
        tone: theme.text,
        labelTone: theme.subText,
      },
    ];
  }, [rows, theme]);

  const visibleLabel = useMemo(() => {
    if (scopeFilter === "all" && totalRows !== null) {
      return `${filteredRows.length} of ${totalRows} visible`;
    }
    return `${filteredRows.length} visible`;
  }, [filteredRows.length, scopeFilter, totalRows]);

  function showNotice(title: string, message: string, tone: "success" | "error" = "success") {
    setNotice({ title, message, tone });
  }

  function validateForm(form: ClassForm): ValidationResult {
    const name = form.name.trim();
    const sections = (form.sections || [])
      .map((section) => ({
        name: String(section?.name || "").trim(),
        medium: String(section?.medium || "").trim() as SectionMedium | "",
      }))
      .filter((section) => section.name);

    if (!name) return { ok: false, message: "Class name is required." };
    if (!["school", "hs"].includes(form.class_scope)) {
      return { ok: false, message: "Class scope is required." };
    }
    if (sections.some((section) => section.medium !== "English" && section.medium !== "Assamese")) {
      return { ok: false, message: "Each section must have a medium." };
    }

    return {
      ok: true,
      payload: {
        name,
        class_scope: form.class_scope,
        sections: sections as Array<{ name: string; medium: SectionMedium }>,
      },
    };
  }

  function buildSectionErrors(form: ClassForm): SectionRowError[] {
    return (form.sections || []).map((section) => {
      const name = String(section?.name || "").trim();
      const medium = String(section?.medium || "").trim();
      if (name && medium !== "English" && medium !== "Assamese") {
        return { medium: "Select section medium." };
      }
      return {};
    });
  }

  async function handleCreate() {
    setCreateSectionErrors(buildSectionErrors(createForm));
    const result = validateForm(createForm);
    if (!result.ok) {
      showNotice("Validation", result.message, "error");
      return;
    }

    setSaving(true);
    try {
      await createClass(result.payload);
      setCreateOpen(false);
      setCreateForm(makeEmptyForm());
      setCreateSectionErrors([]);
      await loadClasses("refresh");
      showNotice("Class Created", "The class has been added successfully.");
    } catch (err: unknown) {
      showNotice("Create Failed", getErrorMessage(err, "Could not create class."), "error");
    } finally {
      setSaving(false);
    }
  }

  function openEdit(row: ClassView) {
    setEditingId(row.id);
    setEditForm({
      name: row.name,
      class_scope: row.class_scope,
      sections: row.sections.length ? row.sections : [{ name: "", medium: "" }],
    });
    setEditSectionErrors([]);
    setEditOpen(true);
  }

  async function handleEdit() {
    setEditSectionErrors(buildSectionErrors(editForm));
    const result = validateForm(editForm);
    if (!result.ok) {
      showNotice("Validation", result.message, "error");
      return;
    }
    if (editingId === null) return;

    setSaving(true);
    try {
      await updateClass(editingId, result.payload);
      setEditOpen(false);
      setEditingId(null);
      setEditForm(makeEmptyForm());
      setEditSectionErrors([]);
      await loadClasses("refresh");
      showNotice("Class Updated", "The class details have been updated.");
    } catch (err: unknown) {
      showNotice("Update Failed", getErrorMessage(err, "Could not update class."), "error");
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(id: number, className: string) {
    setDeleteTarget({ id, name: className });
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await deleteClass(deleteTarget.id);
      setRows((prev) => prev.filter((item) => item.id !== deleteTarget.id));
      setTotalRows((prev) => (prev === null ? null : Math.max(0, prev - 1)));
      setDeleteTarget(null);
      showNotice("Class Deleted", "The class has been removed.");
    } catch (err: unknown) {
      showNotice("Delete Failed", getErrorMessage(err, "Could not delete class."), "error");
    } finally {
      setSaving(false);
    }
  }

  const showInitialLoader = loading && rows.length === 0;
  const showEmptyState = !loading && !error && filteredRows.length === 0 && !hasMore;
  const showFilteredEmptyState = !loading && !error && filteredRows.length === 0 && rows.length > 0 && hasMore;

  return (
    <View style={styles.screen}>
      <TopNotice notice={notice} style={styles.topNoticeOverlay} />
      <FlatList
        style={styles.root}
        data={filteredRows}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadClasses("refresh")} />}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={9}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (hasMore && !loading && !refreshing && !loadingMore) {
            void loadClasses("loadMore");
          }
        }}
        ListHeaderComponent={
          <View style={styles.innerContent}>
            <View style={styles.compactHeader}>
              <View style={styles.heroCopy}>
                <Text style={[styles.title, { color: theme.subText }]}>CLASS</Text>
              </View>
            </View>

            <View style={[styles.overviewCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={styles.overviewTop}>
                <View style={styles.overviewTitleWrap}>
                  <Text style={[styles.overviewTitle, { color: theme.text }]}>Class Structure</Text>
                  <Text style={[styles.overviewSubtitle, { color: theme.subText }]}>{visibleLabel}</Text>
                </View>
                <Text style={[styles.overviewCount, { color: theme.text }]}>{rows.length}</Text>
              </View>
              <View style={styles.compactStatsRow}>
                {stats.map((item) => (
                  <View key={item.label} style={[styles.compactStat, { backgroundColor: item.accent, borderColor: item.border }]}>
                    <Text style={[styles.compactStatValue, { color: item.tone }]}>{item.value}</Text>
                    <Text style={[styles.compactStatLabel, { color: item.labelTone }]} numberOfLines={1}>{item.label}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={[styles.toolbarCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={styles.scopeRow}>
                {(["all", "school", "hs"] as const).map((scope) => {
                  const active = scopeFilter === scope;
                  return (
                    <Pressable
                      key={scope}
                      style={[
                        styles.filterChip,
                        { borderColor: theme.border, backgroundColor: theme.cardMuted },
                        active && [styles.filterChipActive, { borderColor: theme.primary, backgroundColor: theme.primary }],
                      ]}
                      onPress={() => setScopeFilter(scope)}
                    >
                      <Text
                        style={[
                          styles.filterChipText,
                          { color: theme.subText },
                          active && [styles.filterChipTextActive, { color: theme.primaryText }],
                        ]}
                        numberOfLines={1}
                      >
                        {scope === "all" ? "All" : formatScope(scope)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Pressable style={[styles.addClassBtn, { backgroundColor: theme.primary }]} onPress={() => setCreateOpen(true)}>
                <Ionicons name="add" size={18} color={theme.primaryText} />
                <Text style={[styles.addClassBtnText, { color: theme.primaryText }]}>Add</Text>
              </Pressable>
            </View>

            {error ? <Text style={[styles.errorText, { color: theme.danger }]}>{error}</Text> : null}

            {showInitialLoader ? (
              <View style={styles.centered}>
                <ActivityIndicator size="large" color={theme.text} />
              </View>
            ) : null}

            {showEmptyState ? (
              <View style={[styles.emptyCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <Text style={[styles.emptyTitle, { color: theme.text }]}>No class records found</Text>
                <Text style={[styles.emptyText, { color: theme.subText }]}>
                  {scopeFilter === "all"
                    ? "Add your first class record to start building the academic structure."
                    : "No class records are available for the selected scope."}
                </Text>
              </View>
            ) : null}

            {showFilteredEmptyState ? (
              <View style={[styles.emptyCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <Text style={[styles.emptyTitle, { color: theme.text }]}>No matching class records yet</Text>
                <Text style={[styles.emptyText, { color: theme.subText }]}>Keep loading more class records to continue searching in this scope.</Text>
              </View>
            ) : null}
          </View>
        }
        ItemSeparatorComponent={() => <View style={styles.rowGap} />}
        renderItem={({ item: row }) => (
          <View style={styles.rowWrap}>
            <View style={[styles.classCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={styles.cardTop}>
                <View style={styles.cardCopy}>
                  <Text style={[styles.className, { color: theme.text }]}>{row.name}</Text>
                  <Text style={[styles.classMeta, { color: theme.subText }]}>
                    {formatScope(row.class_scope)} | {row.sections.length} section{row.sections.length === 1 ? "" : "s"}
                  </Text>
                </View>
                <View style={[styles.scopeMiniBadge, { backgroundColor: theme.cardMuted, borderColor: theme.border }]}>
                  <Text style={[styles.scopeMiniBadgeText, { color: theme.text }]}>{row.class_scope === "hs" ? "HS" : "School"}</Text>
                </View>
              </View>

              <View style={styles.detailBlock}>
                <Text style={[styles.detailLabel, { color: theme.subText }]}>Sections</Text>
                <View style={styles.pillWrap}>
                  {row.sections.length ? (
                    row.sections.map((section, index) => (
                      <View
                        key={`${row.id}-section-${index}`}
                        style={[styles.detailPill, { backgroundColor: theme.cardMuted, borderColor: theme.border }]}
                      >
                        <Text style={[styles.detailPillText, { color: theme.text }]}>
                          {section.name}
                          {section.medium ? ` - ${section.medium}` : ""}
                        </Text>
                      </View>
                    ))
                  ) : (
                    <View style={[styles.detailPill, { backgroundColor: theme.cardMuted, borderColor: theme.border }]}>
                      <Text style={[styles.detailPillText, { color: theme.text }]}>No sections</Text>
                    </View>
                  )}
                </View>
              </View>

              <View style={styles.detailBlock}>
                <Text style={[styles.detailLabel, { color: theme.subText }]}>Subjects</Text>
                <Text style={[styles.subjectText, { color: theme.subText }]} numberOfLines={2}>
                  {row.subjects.length ? row.subjects.join(", ") : "No subjects linked yet."}
                </Text>
              </View>

              <View style={styles.cardIconActions}>
                <Pressable
                  style={[styles.iconActionBtn, { backgroundColor: theme.card, borderColor: theme.border }]}
                  onPress={() => openEdit(row)}
                >
                  <Ionicons name="create-outline" size={18} color={theme.text} />
                </Pressable>
                <Pressable
                  style={[styles.iconActionBtn, styles.iconActionBtnDanger, { backgroundColor: theme.dangerSoft, borderColor: theme.dangerBorder }]}
                  onPress={() => confirmDelete(row.id, row.name)}
                >
                  <Ionicons name="trash-outline" size={18} color={theme.danger} />
                </Pressable>
              </View>
            </View>
          </View>
        )}
        ListFooterComponent={
          <View style={styles.listFooter}>
            {loadingMore ? (
              <ActivityIndicator size="small" color={theme.text} />
            ) : hasMore && !error ? (
              <Pressable
                style={[styles.loadMoreBtn, { borderColor: theme.border, backgroundColor: theme.cardMuted }]}
                onPress={() => void loadClasses("loadMore")}
              >
                <Text style={[styles.loadMoreText, { color: theme.text }]}>Load More {totalRows !== null ? `(${rows.length}/${totalRows})` : ""}</Text>
              </Pressable>
            ) : null}
          </View>
        }
      />

      <ClassFormModal
        visible={createOpen}
        title="Add Class"
        submitText="Save"
        form={createForm}
        saving={saving}
        onClose={() => {
          setCreateOpen(false);
          setCreateForm(makeEmptyForm());
          setCreateSectionErrors([]);
        }}
        onChange={setCreateForm}
        onSubmit={handleCreate}
        canSubmit={canSubmitCreate}
        sectionErrors={createSectionErrors}
      />

      <ClassFormModal
        visible={editOpen}
        title="Edit Class"
        submitText="Update"
        form={editForm}
        saving={saving}
        onClose={() => {
          setEditOpen(false);
          setEditingId(null);
          setEditForm(makeEmptyForm());
          setEditSectionErrors([]);
        }}
        onChange={setEditForm}
        onSubmit={handleEdit}
        canSubmit={canSubmitEdit}
        sectionErrors={editSectionErrors}
      />

      <Modal visible={deleteTarget !== null} transparent animationType="fade" onRequestClose={() => setDeleteTarget(null)}>
        <View style={styles.modalOverlay}>
          <Pressable style={[styles.modalBackdrop, { backgroundColor: theme.overlay }]} onPress={() => setDeleteTarget(null)} />
          <View style={[styles.confirmCard, { backgroundColor: theme.card, borderColor: theme.dangerBorder }]}>
            <View style={[styles.confirmIcon, { backgroundColor: theme.dangerSoft, borderColor: theme.dangerBorder }]}>
              <Text style={[styles.confirmIconText, { color: theme.danger }]}>X</Text>
            </View>
            <Text style={[styles.confirmTitle, { color: theme.text }]}>Delete Class</Text>
            <Text style={[styles.confirmMessage, { color: theme.subText }]}>
              {deleteTarget ? `This will remove ${deleteTarget.name} from the active class records list.` : ""}
            </Text>
            <View style={styles.modalFooter}>
              <Pressable
                style={[styles.secondaryBtn, { backgroundColor: theme.card, borderColor: theme.border }]}
                onPress={() => setDeleteTarget(null)}
                disabled={saving}
              >
                <Text style={[styles.secondaryBtnText, { color: theme.text }]}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.deleteBtn, { backgroundColor: theme.dangerSoft, borderColor: theme.dangerBorder }, saving && styles.disabledBtn]}
                onPress={handleDelete}
                disabled={saving}
              >
                <Text style={[styles.deleteBtnText, { color: theme.danger }]}>{saving ? "Deleting..." : "Delete"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

type ClassFormModalProps = {
  visible: boolean;
  title: string;
  submitText: string;
  form: ClassForm;
  saving: boolean;
  canSubmit: boolean;
  onClose: () => void;
  onChange: (next: ClassForm) => void;
  onSubmit: () => void;
  sectionErrors: SectionRowError[];
};

function ClassFormModal({
  visible,
  title,
  submitText,
  form,
  saving,
  canSubmit,
  onClose,
  onChange,
  onSubmit,
  sectionErrors,
}: ClassFormModalProps) {
  const { theme } = useAppTheme();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <Pressable style={[styles.modalBackdrop, { backgroundColor: theme.overlay }]} onPress={onClose} />
        <View style={[styles.modalCard, { backgroundColor: theme.card }]}>
          <View style={styles.sheetHeader}>
            <View style={styles.sheetHeaderCopy}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>{title}</Text>
              <Text style={[styles.sheetSubtitle, { color: theme.subText }]}>Class name, scope, and section mediums.</Text>
            </View>
            <Pressable style={[styles.closeIconBtn, { borderColor: theme.border, backgroundColor: theme.card }]} onPress={onClose}>
              <Ionicons name="close" size={18} color={theme.text} />
            </Pressable>
          </View>
          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            <Text style={[styles.inputLabel, { color: theme.subText }]}>Class Name *</Text>
            <TextInput
              style={[styles.input, { borderColor: theme.border, backgroundColor: theme.inputBg, color: theme.text }]}
              value={form.name}
              onChangeText={(value) => onChange({ ...form, name: value })}
              placeholder="Class name"
              placeholderTextColor={theme.mutedText}
            />

            <Text style={[styles.inputLabel, styles.spaceTop, { color: theme.subText }]}>Class Scope *</Text>
            <View style={styles.scopeRow}>
              {(["school", "hs"] as const).map((scope) => {
                const active = form.class_scope === scope;
                return (
                  <Pressable
                    key={scope}
                    style={[
                      styles.scopeChip,
                      { borderColor: theme.border, backgroundColor: theme.cardMuted },
                      active && [styles.scopeChipActive, { borderColor: theme.primary, backgroundColor: theme.primary }],
                    ]}
                    onPress={() => onChange({ ...form, class_scope: scope })}
                  >
                    <Text
                      style={[
                        styles.scopeChipText,
                        { color: theme.subText },
                        active && [styles.scopeChipTextActive, { color: theme.primaryText }],
                      ]}
                    >
                      {formatScope(scope)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.inputLabel, styles.spaceTop, { color: theme.subText }]}>Sections (Optional)</Text>
            {form.sections.map((section, index) => (
              <View key={`section-${index}`} style={[styles.sectionRow, { borderColor: theme.border, backgroundColor: theme.cardMuted }]}>
                <View style={styles.sectionRowHeader}>
                  <Text style={[styles.sectionRowTitle, { color: theme.text }]}>Section {index + 1}</Text>
                  <Pressable
                    style={[styles.removeSectionIconBtn, { borderColor: theme.dangerBorder, backgroundColor: theme.dangerSoft }]}
                    onPress={() => {
                      const nextSections = form.sections.filter((_, sectionIndex) => sectionIndex !== index);
                      onChange({ ...form, sections: nextSections });
                    }}
                  >
                    <Ionicons name="trash-outline" size={16} color={theme.danger} />
                  </Pressable>
                </View>
                <TextInput
                  style={[styles.input, styles.sectionInput, { borderColor: theme.border, backgroundColor: theme.inputBg, color: theme.text }]}
                  value={section.name}
                  onChangeText={(value) => {
                    const nextSections = [...form.sections];
                    nextSections[index] = { ...nextSections[index], name: value };
                    onChange({ ...form, sections: nextSections });
                  }}
                  placeholder={`Section ${index + 1}`}
                  placeholderTextColor={theme.mutedText}
                />
                <View style={styles.mediumRow}>
                  {(["English", "Assamese"] as const).map((medium) => {
                    const active = section.medium === medium;
                    return (
                      <Pressable
                        key={medium}
                        style={[
                          styles.mediumChip,
                          { borderColor: theme.border, backgroundColor: theme.cardMuted },
                          active && [styles.mediumChipActive, { borderColor: theme.primary, backgroundColor: theme.primary }],
                          sectionErrors[index]?.medium && [styles.mediumChipError, { borderColor: theme.danger }],
                        ]}
                        onPress={() => {
                          const nextSections = [...form.sections];
                          nextSections[index] = { ...nextSections[index], medium };
                          onChange({ ...form, sections: nextSections });
                        }}
                      >
                        <Text
                          style={[
                            styles.mediumChipText,
                            { color: theme.subText },
                            active && [styles.mediumChipTextActive, { color: theme.primaryText }],
                          ]}
                        >
                          {medium}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                {sectionErrors[index]?.medium ? (
                  <Text style={[styles.fieldError, { color: theme.danger }]}>{sectionErrors[index]?.medium}</Text>
                ) : null}
              </View>
            ))}

            <Pressable
              style={[styles.addSectionBtn, { borderColor: theme.border, backgroundColor: theme.cardMuted }]}
              onPress={() => onChange({ ...form, sections: [...form.sections, { name: "", medium: "" }] })}
            >
              <Ionicons name="add" size={16} color={theme.text} />
              <Text style={[styles.addSectionBtnText, { color: theme.text }]}>Add Section</Text>
            </Pressable>
          </ScrollView>
          <View style={styles.modalFooter}>
            <Pressable
              style={[styles.secondaryBtn, { backgroundColor: theme.card, borderColor: theme.border }]}
              onPress={onClose}
              disabled={saving}
            >
              <Text style={[styles.secondaryBtnText, { color: theme.text }]}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[
                styles.successBtn,
                { backgroundColor: theme.success, borderColor: theme.successBorder },
                !canSubmit && styles.disabledBtn,
              ]}
              onPress={onSubmit}
              disabled={!canSubmit}
            >
              <Text style={[styles.successBtnText, { color: theme.successText }]}>{saving ? "Saving..." : submitText}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function getErrorMessage(err: unknown, fallback: string) {
  if (
    typeof err === "object" &&
    err &&
    "response" in err &&
    typeof (
      err as { response?: { data?: { message?: string; error?: string } } }
    ).response?.data === "object"
  ) {
    const data = (
      err as { response?: { data?: { message?: string; error?: string } } }
    ).response?.data;
    return data?.error || data?.message || fallback;
  }
  return fallback;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  root: {
    flex: 1,
  },
  content: {
    gap: 14,
    paddingBottom: 120,
  },
  innerContent: {
    gap: 14,
    paddingHorizontal: 14,
    paddingTop: 10,
  },
  topNoticeOverlay: {
    position: "absolute",
    top: 0,
    left: 14,
    right: 14,
    zIndex: 20,
  },
  compactHeader: {
    paddingTop: 2,
  },
  overviewCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    gap: 10,
  },
  overviewTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  overviewTitleWrap: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  overviewTitle: {
    fontSize: 15,
    lineHeight: 19,
    fontWeight: "800",
  },
  overviewSubtitle: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
  },
  overviewCount: {
    fontSize: 22,
    lineHeight: 26,
    fontWeight: "800",
  },
  compactStatsRow: {
    flexDirection: "row",
    gap: 6,
  },
  compactStat: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 7,
    gap: 1,
  },
  compactStatValue: {
    fontSize: 15,
    lineHeight: 18,
    fontWeight: "800",
  },
  compactStatLabel: {
    fontSize: 9,
    lineHeight: 12,
    fontWeight: "700",
  },
  toolbarCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  heroCard: {
    borderRadius: 24,
    paddingVertical: 0,
    gap: 8,
  },
  heroCopy: {
    gap: 6,
  },
  heroPrimaryActions: {
    flexDirection: "row",
    gap: 10,
  },
  heroEyebrow: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  title: {
    color: "#0f172a",
    fontWeight: "900",
    fontSize: 13,
    lineHeight: 16,
    letterSpacing: 0.8,
  },
  subtitle: {
    color: "#64748b",
    lineHeight: 18,
    fontSize: 12,
    fontWeight: "600",
  },
  noticeCard: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
  },
  noticeSuccessCard: {
    backgroundColor: "#f0fdf4",
    borderColor: "#bbf7d0",
  },
  noticeErrorCard: {
    backgroundColor: "#fef2f2",
    borderColor: "#fecaca",
  },
  noticeTitle: {
    color: "#0f172a",
    fontWeight: "800",
    marginBottom: 2,
  },
  noticeMessage: {
    color: "#475569",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  statCard: {
    width: "48%",
    minHeight: 92,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    justifyContent: "space-between",
  },
  statLabel: {
    color: "#334155",
    fontSize: 12,
    fontWeight: "700",
  },
  statValue: {
    fontSize: 26,
    fontWeight: "800",
  },
  filterCard: {
    backgroundColor: "#ffffff",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 16,
    gap: 12,
  },
  filterHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: {
    color: "#0f172a",
    fontWeight: "800",
    fontSize: 16,
  },
  filterHint: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "600",
  },
  scopeRow: {
    flex: 1,
    flexDirection: "row",
    gap: 6,
    minWidth: 0,
  },
  filterChip: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 8,
    backgroundColor: "#f8fafc",
    alignItems: "center",
    justifyContent: "center",
  },
  filterChipActive: {
    borderColor: "#0f172a",
    backgroundColor: "#0f172a",
  },
  filterChipText: {
    color: "#475569",
    fontWeight: "700",
    fontSize: 11,
    lineHeight: 14,
  },
  filterChipTextActive: {
    color: "#ffffff",
  },
  centered: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  errorText: {
    color: "#dc2626",
    fontWeight: "700",
  },
  emptyCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 18,
    gap: 6,
  },
  emptyTitle: {
    color: "#0f172a",
    fontWeight: "800",
    fontSize: 16,
  },
  emptyText: {
    color: "#64748b",
    lineHeight: 20,
  },
  rowWrap: {
    paddingHorizontal: 14,
  },
  rowGap: {
    height: 12,
  },
  grid: {
    gap: 12,
  },
  classCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 12,
    gap: 10,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconBadge: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
  },
  iconBadgeText: {
    color: "#0f172a",
    fontWeight: "800",
    fontSize: 16,
  },
  cardCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  className: {
    color: "#0f172a",
    fontWeight: "800",
    fontSize: 16,
    lineHeight: 20,
  },
  classMeta: {
    color: "#475569",
    fontWeight: "700",
    fontSize: 12,
    lineHeight: 16,
  },
  scopeMiniBadge: {
    borderWidth: 1,
    borderRadius: 9,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  scopeMiniBadgeText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "800",
  },
  detailBlock: {
    gap: 6,
  },
  detailLabel: {
    color: "#334155",
    fontWeight: "800",
    fontSize: 10,
    lineHeight: 13,
    textTransform: "uppercase",
  },
  pillWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  detailPill: {
    backgroundColor: "#f8fafc",
    borderRadius: 9,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  detailPillText: {
    color: "#334155",
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "600",
  },
  subjectText: {
    color: "#475569",
    lineHeight: 17,
    fontSize: 12,
    fontWeight: "600",
  },
  cardIconActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 0,
  },
  iconActionBtn: {
    width: 38,
    height: 38,
    borderWidth: 1,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  iconActionBtnDanger: {
    borderColor: "#fecaca",
    backgroundColor: "#fef2f2",
  },
  rowActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
  },
  listFooter: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  loadMoreBtn: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  loadMoreText: {
    fontWeight: "700",
    fontSize: 12,
  },
  primaryBtn: {
    backgroundColor: "#0f172a",
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  heroPrimaryBtn: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: {
    color: "#ffffff",
    fontWeight: "700",
  },
  addClassBtn: {
    minWidth: 68,
    height: 38,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingHorizontal: 10,
  },
  addClassBtnText: {
    fontWeight: "800",
    fontSize: 12,
  },
  secondaryBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtnText: {
    color: "#334155",
    fontWeight: "700",
  },
  deleteBtn: {
    flex: 1,
    backgroundColor: "#fee2e2",
    borderWidth: 1,
    borderColor: "#fecaca",
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteBtnText: {
    color: "#b91c1c",
    fontWeight: "700",
  },
  successBtn: {
    flex: 1,
    backgroundColor: "#15803d",
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  successBtnText: {
    color: "#ffffff",
    fontWeight: "700",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.28)",
  },
  modalCard: {
    maxHeight: "88%",
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 30,
    gap: 10,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  sheetHeaderCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  modalTitle: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "800",
    color: "#0f172a",
  },
  sheetSubtitle: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
  },
  closeIconBtn: {
    width: 36,
    height: 36,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  modalBody: {
    maxHeight: 560,
  },
  inputLabel: {
    color: "#334155",
    fontWeight: "700",
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 14,
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginBottom: 7,
    color: "#0f172a",
  },
  scopeChip: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#f8fafc",
    alignItems: "center",
  },
  scopeChipActive: {
    borderColor: "#0f172a",
    backgroundColor: "#0f172a",
  },
  scopeChipText: {
    color: "#334155",
    fontWeight: "700",
    fontSize: 12,
  },
  scopeChipTextActive: {
    color: "#ffffff",
  },
  sectionRow: {
    marginBottom: 9,
    borderWidth: 1,
    borderRadius: 14,
    padding: 10,
    gap: 6,
  },
  sectionRowHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  sectionRowTitle: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
  },
  removeSectionIconBtn: {
    width: 32,
    height: 32,
    borderWidth: 1,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionInput: {
    marginBottom: 2,
  },
  spaceTop: {
    marginTop: 8,
  },
  addSectionBtn: {
    marginTop: 2,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignSelf: "flex-start",
    backgroundColor: "#f8fafc",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  addSectionBtnText: {
    color: "#334155",
    fontWeight: "700",
  },
  removeSectionBtn: {
    alignSelf: "flex-start",
    marginTop: 2,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  removeSectionBtnText: {
    fontSize: 12,
    fontWeight: "700",
  },
  mediumRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
    marginBottom: 4,
  },
  mediumChip: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: "#f8fafc",
  },
  mediumChipActive: {
    borderColor: "#0f172a",
    backgroundColor: "#0f172a",
  },
  mediumChipError: {
    borderColor: "#dc2626",
  },
  mediumChipText: {
    color: "#334155",
    fontWeight: "700",
    fontSize: 12,
  },
  mediumChipTextActive: {
    color: "#ffffff",
  },
  fieldError: {
    color: "#b91c1c",
    marginBottom: 4,
    fontSize: 12,
  },
  confirmCard: {
    marginHorizontal: 18,
    marginBottom: 120,
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 20,
    gap: 12,
  },
  confirmIcon: {
    width: 44,
    height: 44,
    borderWidth: 1,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
  confirmIconText: {
    fontSize: 22,
    fontWeight: "800",
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
  },
  confirmMessage: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  modalFooter: {
    marginTop: 14,
    flexDirection: "row",
    gap: 10,
  },
  disabledBtn: {
    opacity: 0.7,
  },
});

