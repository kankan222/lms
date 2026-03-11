import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
} from "@/components/ui/field";
const ParentForm = ({ type, update, errors = {} }) => {
  const section = String(type).toLowerCase();
  const prefix = section === "father" ? "father" : "mother";
  return (
    <div>
      <h3 className="font-medium mb-5">
        {section.charAt(0).toUpperCase() + section.slice(1)} Details
      </h3>
      <FieldGroup className="grid grid-cols-2 gap-3">
        <Field>
          <Label>Name *</Label>
          <Input required onChange={(e) => update(section, "name", e.target.value)} />
          {errors[`${prefix}_name`] && <p className="text-xs text-red-500">{errors[`${prefix}_name`]}</p>}
        </Field>
        <Field>
          <Label>Phone *</Label>
          <Input
            required
            maxLength={10}
            onChange={(e) => update(section, "mobile", e.target.value)}
          />
          {errors[`${prefix}_mobile`] && <p className="text-xs text-red-500">{errors[`${prefix}_mobile`]}</p>}
        </Field>
        <Field>
          <Label>Email</Label>
          <Input onChange={(e) => update(section, "email", e.target.value)} />
          {errors[`${prefix}_email`] && <p className="text-xs text-red-500">{errors[`${prefix}_email`]}</p>}
        </Field>
        <Field>
          <Label>Occupation</Label>
          <Input
            onChange={(e) => update(section, "occupation", e.target.value)}
          />
        </Field>
        <Field>
          <Label>Qualification</Label>
          <Input
            onChange={(e) => update(section, "qualification", e.target.value)}
          />
        </Field>
      </FieldGroup>
    </div>
  );
};

export default ParentForm;
