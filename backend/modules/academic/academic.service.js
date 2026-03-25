import * as repo from "./academic.repository.js";

const ALLOWED_CLASS_MEDIA = new Set(["English", "Assamese"]);
const ALLOWED_CLASS_SCOPES = new Set(["school", "hs"]);

function normalizeClassScope(value) {
  const scope = String(value || "school").trim().toLowerCase();
  if (!ALLOWED_CLASS_SCOPES.has(scope)) {
    throw new Error("Invalid class scope. Allowed values: school, hs");
  }
  return scope;
}

function normalizeSections(input, fallbackMediums = []) {
  const fallbackMedium = Array.isArray(fallbackMediums) && fallbackMediums.length
    ? String(fallbackMediums[0] || "").trim()
    : "";
  const rows = Array.isArray(input) ? input : [];
  const mapped = rows
    .map((item) => {
      if (typeof item === "string") {
        return { name: String(item || "").trim(), medium: fallbackMedium };
      }
      return {
        name: String(item?.name || "").trim(),
        medium: String(item?.medium || fallbackMedium).trim(),
      };
    })
    .filter((s) => s.name);
  return mapped;
}
function normalizeMediums(input) {
  let raw = input;
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) {
    raw = String(raw)
      .split(",")
      .map((m) => m.trim())
      .filter(Boolean);
  }
  const deduped = [...new Set(raw.map((m) => String(m).trim()).filter(Boolean))];
  return deduped;
}
export async function createSession(data) {

  if (data.isActive) {
    await repo.deactivateAllSessions();
  }

  return repo.createSession(data);
}

export async function updateSession(id, data) {
  if (!String(data?.name || "").trim()) {
    throw new Error("Session name is required");
  }
  if (!data?.startDate || !data?.endDate) {
    throw new Error("Session start date and end date are required");
  }

  if (data.isActive) {
    await repo.deactivateAllSessions();
  }

  const result = await repo.updateSession(id, data);
  if (!result?.affectedRows) {
    throw new Error("Session not found");
  }
  return result;
}

export async function deleteSession(id) {
  try {
    const result = await repo.deleteSession(id);
    if (!result?.affectedRows) {
      throw new Error("Session not found");
    }
    return result;
  } catch (err) {
    if (err?.code === "ER_ROW_IS_REFERENCED_2" || err?.errno === 1451) {
      throw new Error("This session is already linked to other records and cannot be deleted.");
    }
    throw err;
  }
}




export function getSessions() {
  return repo.getSessions();
}

function normalizeStreamName(value) {
  const name = String(value || "").trim();
  if (!name) {
    throw new Error("Stream name is required");
  }
  return name;
}

export function getStreams() {
  return repo.getStreams();
}

export function createStream(data) {
  return repo.createStream(normalizeStreamName(data?.name));
}

export async function updateStream(id, data) {
  const result = await repo.updateStream(id, normalizeStreamName(data?.name));
  if (!result?.affectedRows) {
    throw new Error("Stream not found");
  }
  return result;
}

export async function deleteStream(id) {
  try {
    const result = await repo.deleteStream(id);
    if (!result?.affectedRows) {
      throw new Error("Stream not found");
    }
    return result;
  } catch (err) {
    if (err?.code === "ER_ROW_IS_REFERENCED_2" || err?.errno === 1451) {
      throw new Error("This stream is already linked to students and cannot be deleted.");
    }
    throw err;
  }
}

export async function getClasses() {
  const rows = await repo.getClasses();
  return rows.map((row) => {
    const sectionMediumPairs = String(row.section_mediums || "")
      .split(",")
      .map((pair) => pair.trim())
      .filter(Boolean)
      .map((pair) => {
        const [name, medium] = pair.split(":");
        return { name: String(name || "").trim(), medium: String(medium || "").trim() };
      })
      .filter((s) => s.name);
    const mediums = normalizeMediums(
      sectionMediumPairs.map((s) => s.medium).filter(Boolean)
    );
    return {
      ...row,
      sections: sectionMediumPairs.map((s) => s.name).join(","),
      section_details: sectionMediumPairs,
      mediums
    };
  });
}
export async function getClassStructure() {

  const rows = await repo.getClassStructure();

  const map = {};

  rows.forEach(r => {

    if (!map[r.class_id]) {
      const mediums = normalizeMediums(r.class_medium);
      map[r.class_id] = {
        id: r.class_id,
        name: r.class_name,
        class_scope: r.class_scope || "school",
        medium: r.class_medium || null,
        mediums,
        _mediumSet: new Set(mediums),
        sections: [],
        subjects: []
      };
    }

    if (r.section_id) {
    
      const exists =
        map[r.class_id].sections
        .some(sec => sec.id === r.section_id);

      if (!exists) {
        if (r.section_medium) {
          map[r.class_id]._mediumSet.add(r.section_medium);
        }
        map[r.class_id].sections.push({
          id: r.section_id,
          name: r.section_name,
          medium: r.section_medium || null
        });
      }

    }

    if (r.subject_id) {

      const exists =
        map[r.class_id].subjects
        .some(sub => sub.id === r.subject_id);

      if (!exists) {
        map[r.class_id].subjects.push({
          id: r.subject_id,
          name: r.subject_name
        });
      }

    }

  });

  return Object.values(map).map((item) => {
    const mediums = Array.from(item._mediumSet || []);
    const { _mediumSet, ...rest } = item;
    return {
      ...rest,
      mediums,
      medium: mediums.join(", ")
    };
  });

}
export function createClass(data) {
  if (!data.name) throw new Error("Class name required");
  const classScope = normalizeClassScope(data.class_scope);
  const legacyMediums = normalizeMediums(data.mediums ?? data.medium);
  const sections = normalizeSections(data.sections || [], legacyMediums);
  if (!sections.length) {
    throw new Error("At least one section is required");
  }
  if (sections.some((s) => !s.medium)) {
    throw new Error("Each section must have a medium");
  }
  if (sections.some((s) => !ALLOWED_CLASS_MEDIA.has(s.medium))) {
    throw new Error("Invalid section medium. Allowed values: English, Assamese");
  }
  return repo.createClass(data.name, classScope, sections);
}
export function updateClass(id, data) {

  if (!data.name)
    throw new Error("Class name required");

  const classScope = normalizeClassScope(data.class_scope);
  const legacyMediums = normalizeMediums(data.mediums ?? data.medium);
  const sections = normalizeSections(data.sections || [], legacyMediums);
  if (!sections.length) {
    throw new Error("At least one section is required");
  }
  if (sections.some((s) => !s.medium)) {
    throw new Error("Each section must have a medium");
  }
  if (sections.some((s) => !ALLOWED_CLASS_MEDIA.has(s.medium))) {
    throw new Error("Invalid section medium. Allowed values: English, Assamese");
  }

  return repo.updateClass(id, data.name, classScope, sections);
}

export async function deleteClass(id) {
  // const sections = await repo.countSections(id);
  // if (sections > 0) {
  //   throw new Error("Cannot delete class with sections");
  // }
  return repo.deleteClass(id);
}
