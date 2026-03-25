import { useState } from "react";
export default function ButtonGroup({
  options = [],
  defaultValue,
  onChange,
}) {
  const [active, setActive] = useState(defaultValue || options[0]?.value);

  const handleClick = (value) => {
    setActive(value);
    if (onChange) onChange(value);
  };

  return (
    <div className="inline-flex rounded-xl border bg-muted p-1">
      {options.map((option) => {
        const isActive = active === option.value;

        return (
          <button
            key={option.value}
            onClick={() => handleClick(option.value)}
            className={`
              px-4 py-2 text-sm font-medium rounded-lg transition-all
              ${isActive
                ? "bg-background text-primary shadow-sm"
                : "text-muted-foreground hover:text-foreground"}
            `}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
