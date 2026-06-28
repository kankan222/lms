import { useEffect, useMemo, useState } from "react";
import TopBar from "../components/TopBar";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "../components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert";
import { getClassStructure } from "../api/academic.api";
import { getExamById, getExams } from "../api/exam.api";
import { getSubjects } from "../api/subjects.api";
import { downloadMarkStatement, getAccessibleExamById, getAccessibleExams } from "../api/marks.api";
import { usePermissions } from "../hooks/usePermissions";

const EMPTY_FILTERS = {
  class_scope: "",
  exam_id: "",
  class_id: "",
  section_id: "",
  medium: "",
  subject_id: "",
};

const classScopeLabels = {
  school: "School",
  hs: "Higher Secondary",
};

function normalizeClassScope(value) {
  const scope = String(value || "").trim().toLowerCase();
  if (scope === "higher_secondary" || scope === "higher-secondary") return "hs";
  if (scope === "hs" || scope === "school") return scope;
  return "";
}

function getClassScope(item) {
  return normalizeClassScope(item?.class_scope || item?.scope_code || item?.scope) || "school";
}

function getExamClassScopes(exam) {
  const scopes = String(exam?.class_scope || "")
    .split(",")
    .map(normalizeClassScope)
    .filter(Boolean);

  return scopes.length ? [...new Set(scopes)] : ["school"];
}

function matchesClassScope(item, classScope) {
  const scope = normalizeClassScope(classScope);
  if (!scope) return true;
  return getClassScope(item) === scope;
}

function examMatchesClassScope(exam, classScope) {
  const scope = normalizeClassScope(classScope);
  if (!scope) return true;
  return getExamClassScopes(exam).includes(scope);
}

function downloadBlob(blob, fileName) {
  if (!blob || blob.size === 0) {
    throw new Error("Downloaded file is empty");
  }

  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  window.setTimeout(() => {
    window.URL.revokeObjectURL(url);
  }, 5000);
}

export default function MarkReport() {
  const { can } = usePermissions();
  const canViewExamCatalog = can("exams.view");
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [exams, setExams] = useState([]);
  const [examSubjects, setExamSubjects] = useState([]);
  const [examScopes, setExamScopes] = useState([]);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [loading, setLoading] = useState(true);
  const [examMetaLoading, setExamMetaLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [banner, setBanner] = useState(null);

  const scopeFilteredExams = useMemo(
    () => exams.filter((exam) => examMatchesClassScope(exam, filters.class_scope)),
    [exams, filters.class_scope]
  );

  const scopeFilteredClasses = useMemo(
    () => classes.filter((item) => matchesClassScope(item, filters.class_scope)),
    [classes, filters.class_scope]
  );

  const scopedClassIds = useMemo(
    () => [...new Set((examScopes || []).map((item) => String(item.class_id)))],
    [examScopes]
  );

  const availableClasses = useMemo(
    () =>
      !filters.exam_id
        ? scopeFilteredClasses
        : scopeFilteredClasses.filter((item) => scopedClassIds.includes(String(item.id))),
    [scopeFilteredClasses, filters.exam_id, scopedClassIds]
  );

  const selectedClass = useMemo(
    () => availableClasses.find((item) => String(item.id) === String(filters.class_id)) || null,
    [availableClasses, filters.class_id]
  );

  const availableSections = useMemo(() => {
    if (!selectedClass) return [];
    const sections = selectedClass.sections || [];
    if (!filters.exam_id) return sections;

    const classScopeRows = (examScopes || []).filter(
      (item) => String(item.class_id) === String(selectedClass.id)
    );
    const hasClassWideScope = classScopeRows.some(
      (item) =>
        item.section_id === null ||
        item.section_id === undefined ||
        String(item.section_id).trim() === ""
    );
    if (hasClassWideScope) return sections;

    const allowedSectionIds = new Set(classScopeRows.map((item) => String(item.section_id)));
    return sections.filter((item) => allowedSectionIds.has(String(item.id)));
  }, [selectedClass, filters.exam_id, examScopes]);

  const filteredSubjects = useMemo(
    () =>
      examSubjects.length
        ? subjects.filter((subject) =>
            examSubjects.some((item) => String(item.subject_id) === String(subject.id))
          )
        : subjects,
    [examSubjects, subjects]
  );

  const selectedExam = useMemo(
    () => exams.find((item) => String(item.id) === String(filters.exam_id)) || null,
    [exams, filters.exam_id]
  );
  const selectedSection = useMemo(
    () => availableSections.find((item) => String(item.id) === String(filters.section_id)) || null,
    [availableSections, filters.section_id]
  );
  const selectedSubject = useMemo(
    () => filteredSubjects.find((item) => String(item.id) === String(filters.subject_id)) || null,
    [filteredSubjects, filters.subject_id]
  );

  const ready = Boolean(filters.exam_id && filters.class_id && filters.section_id && filters.subject_id);

  useEffect(() => {
    async function loadBootstrap() {
      setLoading(true);
      try {
        const [classRes, subjectRes, examRes] = await Promise.all([
          getClassStructure(),
          getSubjects(),
          canViewExamCatalog ? getExams() : getAccessibleExams(),
        ]);
        setClasses(Array.isArray(classRes?.data) ? classRes.data : []);
        setSubjects(Array.isArray(subjectRes?.data) ? subjectRes.data : []);
        setExams(Array.isArray(examRes?.data) ? examRes.data : []);
      } catch (err) {
        setBanner({
          type: "destructive",
          title: "Mark statement unavailable",
          message: err?.message || "Failed to load mark statement filters.",
        });
      } finally {
        setLoading(false);
      }
    }

    loadBootstrap();
  }, [canViewExamCatalog]);

  useEffect(() => {
    if (!filters.exam_id) {
      setExamSubjects([]);
      setExamScopes([]);
      setExamMetaLoading(false);
      setFilters((prev) => ({ ...prev, subject_id: "" }));
      return;
    }

    let ignore = false;
    async function loadExamMeta() {
      if (!ignore) setExamMetaLoading(true);
      try {
        const examLoader = canViewExamCatalog ? getExamById : getAccessibleExamById;
        const res = await examLoader(filters.exam_id);
        if (!ignore) {
          setExamSubjects(Array.isArray(res?.data?.subjects) ? res.data.subjects : []);
          setExamScopes(Array.isArray(res?.data?.scopes) ? res.data.scopes : []);
        }
      } catch (err) {
        if (!ignore) {
          setExamSubjects([]);
          setExamScopes([]);
          setBanner({
            type: "destructive",
            title: "Exam load failed",
            message: err?.message || "Failed to load exam subjects.",
          });
        }
      } finally {
        if (!ignore) setExamMetaLoading(false);
      }
    }

    loadExamMeta();
    return () => {
      ignore = true;
    };
  }, [filters.exam_id, canViewExamCatalog]);

  useEffect(() => {
    if (!filters.exam_id) return;
    if (scopeFilteredExams.some((item) => String(item.id) === String(filters.exam_id))) return;

    setFilters((prev) => ({
      ...prev,
      exam_id: "",
      class_id: "",
      section_id: "",
      medium: "",
      subject_id: "",
    }));
  }, [filters.class_scope, filters.exam_id, scopeFilteredExams]);

  useEffect(() => {
    if (!filters.exam_id || examMetaLoading) return;

    if (filters.class_id && !availableClasses.some((item) => String(item.id) === String(filters.class_id))) {
      setFilters((prev) => ({ ...prev, class_id: "", section_id: "", medium: "" }));
      return;
    }

    if (filters.section_id && !availableSections.some((item) => String(item.id) === String(filters.section_id))) {
      setFilters((prev) => ({ ...prev, section_id: "", medium: "" }));
    }
  }, [filters.exam_id, filters.class_id, filters.section_id, availableClasses, availableSections, examMetaLoading]);

  async function handleDownloadMarkStatement() {
    if (!ready) {
      setBanner({
        type: "destructive",
        title: "Missing selection",
        message: "Select exam, class, section, and subject before downloading the marks statement.",
      });
      return;
    }

    setDownloading(true);
    try {
      const blob = await downloadMarkStatement({
        exam_id: filters.exam_id,
        class_id: filters.class_id,
        section_id: filters.section_id,
        medium: filters.medium,
        subject_id: filters.subject_id,
      });
      downloadBlob(
        blob,
        `marks-statement-exam-${filters.exam_id}-class-${filters.class_id}-section-${filters.section_id}-subject-${filters.subject_id}.pdf`
      );
      setBanner({
        type: "success",
        title: "Statement downloaded",
        message: "Marks statement PDF downloaded successfully.",
      });
    } catch (err) {
      setBanner({
        type: "destructive",
        title: "Download failed",
        message: err?.message || "Failed to download marks statement.",
      });
    } finally {
      setDownloading(false);
    }
  }

  return (
    <>
      <div className="pointer-events-none fixed top-6 right-6 z-50 w-full max-w-sm">
        <div
          className={`transition-all duration-500 ease-out ${
            banner ? "translate-x-0 scale-100 opacity-100" : "translate-x-12 scale-95 opacity-0"
          }`}
        >
          {banner ? (
            <Alert
              variant={banner.type}
              className="pointer-events-auto overflow-hidden border shadow-xl"
            >
              <AlertTitle>{banner.title}</AlertTitle>
              <AlertDescription>{banner.message}</AlertDescription>
            </Alert>
          ) : null}
        </div>
      </div>

      <TopBar title="Mark Statement" subTitle="Download blank marks statement PDFs for exam entry" />

      {loading ? <p>Loading...</p> : null}

      {!loading ? (
        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Statement Filters</CardTitle>
              <CardDescription>Select the exact exam scope before downloading the statement.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="grid gap-2">
                  <Label>Class Scope</Label>
                  <select
                    className="rounded-md border bg-background px-3 py-2 text-sm"
                    value={filters.class_scope}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        class_scope: e.target.value,
                        exam_id: "",
                        class_id: "",
                        section_id: "",
                        medium: "",
                        subject_id: "",
                      }))
                    }
                  >
                    <option value="">All scopes</option>
                    {Object.entries(classScopeLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-2">
                  <Label>Exam</Label>
                  <select
                    className="rounded-md border bg-background px-3 py-2 text-sm"
                    value={filters.exam_id}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        exam_id: e.target.value,
                        class_id: "",
                        section_id: "",
                        medium: "",
                        subject_id: "",
                      }))
                    }
                  >
                    <option value="">Select exam</option>
                    {scopeFilteredExams.map((exam) => (
                      <option key={exam.id} value={exam.id}>{exam.name}</option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-2">
                  <Label>Subject</Label>
                  <select
                    className="rounded-md border bg-background px-3 py-2 text-sm"
                    value={filters.subject_id}
                    onChange={(e) => setFilters((prev) => ({ ...prev, subject_id: e.target.value }))}
                    disabled={!filters.exam_id || examMetaLoading}
                  >
                    <option value="">{examMetaLoading ? "Loading subjects..." : "Select subject"}</option>
                    {filteredSubjects.map((subject) => (
                      <option key={subject.id} value={subject.id}>{subject.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="grid gap-2">
                  <Label>Class</Label>
                  <select
                    className="rounded-md border bg-background px-3 py-2 text-sm"
                    value={filters.class_id}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        class_id: e.target.value,
                        section_id: "",
                        medium: "",
                      }))
                    }
                    disabled={!filters.exam_id || examMetaLoading}
                  >
                    <option value="">{examMetaLoading ? "Loading classes..." : "Select class"}</option>
                    {availableClasses.map((item) => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-2">
                  <Label>Section</Label>
                  <select
                    className="rounded-md border bg-background px-3 py-2 text-sm"
                    value={filters.section_id}
                    onChange={(e) => {
                      const section = availableSections.find((item) => String(item.id) === e.target.value);
                      setFilters((prev) => ({
                        ...prev,
                        section_id: e.target.value,
                        medium: section?.medium || "",
                      }));
                    }}
                    disabled={!filters.class_id}
                  >
                    <option value="">Select section</option>
                    {availableSections.map((section) => (
                      <option key={section.id} value={section.id}>
                        {section.name}{section.medium ? ` (${section.medium})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-2">
                  <Label>Medium</Label>
                  <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                    {filters.medium || selectedSection?.medium || "-"}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Mark Statement</CardTitle>
              <CardDescription>
                Download a blank marks statement for the selected exam, class, section, medium, and subject.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                <span>Exam: {selectedExam?.name || "-"}</span>
                <span>Subject: {selectedSubject?.name || "-"}</span>
                <span>Class: {selectedClass?.name || "-"}</span>
                <span>
                  Section:{" "}
                  {selectedSection
                    ? `${selectedSection.name}${selectedSection.medium ? ` (${selectedSection.medium})` : ""}`
                    : "-"}
                </span>
              </div>
              <Button type="button" onClick={handleDownloadMarkStatement} disabled={!ready || downloading}>
                {downloading ? "Downloading..." : "Download Statement PDF"}
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </>
  );
}
