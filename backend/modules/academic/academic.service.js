import * as repo from "./academic.repository.js";
export async function createSession(data) {

  if (data.isActive) {
    await repo.deactivateAllSessions();
  }

  return repo.createSession(data);
}




export function getSessions() {
  return repo.getSessions();
}
export function getClasses() {
  return repo.getClasses();
}
export function createClass(data) {
  console.log('Service', data)
  if (!data.name) throw new Error("Class name required");
  // sections = sections.filter(s => s.trim() !== "")
  return repo.createClass(data.name, data.sections || []);
}
export function updateClass(id, data) {

  if (!data.name)
    throw new Error("Class name required");

  return repo.updateClass(id, data.name , data.sections || []);
}

export async function deleteClass(id) {
  // const sections = await repo.countSections(id);
  // if (sections > 0) {
  //   throw new Error("Cannot delete class with sections");
  // }
  return repo.deleteClass(id);
}