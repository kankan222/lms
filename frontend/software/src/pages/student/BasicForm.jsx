import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Field, FieldGroup } from "@/components/ui/field";

export default function StudentBasicForm({ update, errors = {} }) {
  return (
    <div>
      <h3 className="font-medium mb-5">Basic Details</h3>
      <FieldGroup className="grid grid-cols-2 gap-3">
        <Field>
          <Label>Name *</Label>
          <Input required onChange={(e) => update("student", "name", e.target.value)} />
          {errors.student_name && <p className="text-xs text-red-500">{errors.student_name}</p>}
        </Field>

        <Field>
          <Label>Phone *</Label>
          <Input
            required
            maxLength={10}
            onChange={(e) => update("student", "mobile", e.target.value)}
          />
          {errors.student_mobile && <p className="text-xs text-red-500">{errors.student_mobile}</p>}
        </Field>

        <Field>
          <Label>Gender *</Label>
          <select
            required
            className="border rounded p-2 w-full"
            onChange={(e) => update("student", "gender", e.target.value)}
          >
            <option value="">Select</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
          {errors.student_gender && <p className="text-xs text-red-500">{errors.student_gender}</p>}
        </Field>

        <Field>
          <Label>Date Of Birth *</Label>
          <Input
            required
            type="date"
            onChange={(e) => update("student", "dob", e.target.value)}
          />
          {errors.student_dob && <p className="text-xs text-red-500">{errors.student_dob}</p>}
        </Field>
        <Field>
          <Label>Date Of Admission *</Label>
          <Input
            required
            type="date"
            onChange={(e) =>
              update("student", "date_of_admission", e.target.value)
            }
          />
          {errors.student_date_of_admission && <p className="text-xs text-red-500">{errors.student_date_of_admission}</p>}
        </Field>
        <Field>
          <Label>Photo Upload</Label>
          <Input
            type="file"
            accept="image/*"
            onChange={(e) => update("student", "photo_file", e.target.files?.[0] || null)}
          />
        </Field>
      </FieldGroup>
    </div>
  );
}
