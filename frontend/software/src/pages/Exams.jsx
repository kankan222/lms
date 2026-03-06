import { useState, useEffect } from "react";
import TopBar from "../components/TopBar";
import { Button } from "../components/ui/button";
import { getExam, createExam } from "../api/exam.api";

import { FileSpreadsheet, TrashIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const Exams = () => {

  const [createOpen, setCreateOpen] = useState(false);
  const [exams, setExams] = useState([]);
  const [form, setForm] = useState({
    name: ""
  });

  useEffect(() => {
    loadExams();
  }, []);

  async function loadExams() {
    const sessionId = 1;

  const res = await getExam(sessionId);

  setExams(res.data);
  }

  function handleChange(e) {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();

    await createExam(form);

    setCreateOpen(false);
    setForm({ name: "" });

    loadExams();
  }

  return (
    <>
      <TopBar
        title="Exams"
        subTitle="Find all exams here"
        action={
          <Sheet open={createOpen} onOpenChange={setCreateOpen}>
            <SheetTrigger asChild>
              <Button>Add Exam</Button>
            </SheetTrigger>

            <SheetContent>
              <form onSubmit={handleSubmit} className="px-4">

                <SheetHeader>
                  <SheetTitle>Create Exam</SheetTitle>
                </SheetHeader>

                <div className="grid gap-2 mb-4">
                  <Label>Exam Name</Label>
                  <Input
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                  />
                </div>

                <SheetFooter>
                  <Button type="submit">Save</Button>
                </SheetFooter>

              </form>
            </SheetContent>
          </Sheet>
        }
      />

      <div className="grid grid-cols-3 gap-2">

        {exams.map((data) => (
          <div
            key={data.id}
            className="flex bg-secondary border border-border rounded-sm px-5 py-5 gap-2.5 items-start w-full"
          >
            <div>
              <Button size="icon">
                <FileSpreadsheet />
              </Button>
            </div>

            <div className="flex-1">
              <p className="text-xl font-bold">{data.name}</p>
              <p className="text-sm">ID : {data.id}</p>
            </div>

          </div>
        ))}

      </div>
    </>
  );
};

export default Exams;