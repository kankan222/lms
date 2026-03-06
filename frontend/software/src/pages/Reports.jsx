import { useEffect, useState } from "react";
import TopBar from "../components/TopBar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";


import { getClasses } from "../api/academic.api.js";
import { getExam} from "../api/exam.api";
export default function MarksTable({ studentId, classId, sessionId }) {
  const [subjects, setSubjects] = useState([]);
  const [exams, setExams] = useState([]);
  const [marks, setMarks] = useState({});

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const subjectsRes = await getClasses();
    const examsRes = await getExam(1);
    // const marksRes = await fetch(`/api/marks/${studentId}/${sessionId}`);

    // const marksData = await marksRes.json();

    setSubjects(subjectsRes.data);
    setExams(examsRes.data);
    console.log(subjectsRes.data)

    const map = {};

    // marksData.forEach((m) => {
    //   map[`${m.subject_id}_${m.exam_id}`] = m.marks;
    // });

    // setMarks(map);
  }

  function handleChange(subjectId, examId, value) {
    setMarks((prev) => ({
      ...prev,
      [`${subjectId}_${examId}`]: value,
    }));
  }

  async function saveMarks(subjectId, examId) {
    const key = `${subjectId}_${examId}`;

    await fetch("/api/marks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        student_id: studentId,
        subject_id: subjectId,
        exam_id: examId,
        marks: marks[key],
      }),
    });
  }

  async function deleteMarks(subjectId, examId) {
    await fetch(`/api/marks/${studentId}/${subjectId}/${examId}`, {
      method: "DELETE",
    });

    setMarks((prev) => {
      const copy = { ...prev };
      delete copy[`${subjectId}_${examId}`];
      return copy;
    });
  }

  return (
    <>
    <TopBar title="Reports" subTitle="Find all reports here" />
    <div className="">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Subject</TableHead>

            {exams.map((exam) => (
              <TableHead key={exam.id}>{exam.name}</TableHead>
            ))}
          </TableRow>
        </TableHeader>

        <TableBody>
          {subjects.map((subject) => (
            <TableRow key={subject.id}>
              <TableCell className="font-medium">{subject.name}</TableCell>

              {exams.map((exam) => {
                const key = `${subject.id}_${exam.id}`;

                return (
                  <TableCell key={exam.id} className="space-y-2">
                    <Input
                      type="number"
                      value={marks[key] || ""}
                      onChange={(e) =>
                        handleChange(subject.id, exam.id, e.target.value)
                      }
                      className="w-20"
                    />

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => saveMarks(subject.id, exam.id)}
                      >
                        Save
                      </Button>

                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => deleteMarks(subject.id, exam.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
    </>
  );
}
