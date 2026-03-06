import * as repo from "./student.repository.js";


export async function getStudents() {
  return repo.getStudents();
}


export async function createStudent(data) {

  const studentId = await repo.createStudent(data);

  await repo.createEnrollment(studentId, data);

  return { studentId};
}


export async function updateStudent(id, data) {

  await repo.updateStudent(id, data);

  await repo.updateEnrollment(id, data);

}


export async function deleteStudent(id) {
  return repo.deleteStudent(id);
}