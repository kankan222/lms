import { useState } from "react";
import { Button } from "./ui/button";
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
    <div className="inline-flex rounded-xl border bg-gray-100 p-1">
      {options.map((option) => {
        const isActive = active === option.value;

        return (
          <button
            key={option.value}
            onClick={() => handleClick(option.value)}
            className={`
              px-4 py-2 text-sm font-medium rounded-lg transition-all
              ${isActive
                ? "bg-white shadow text-blue-600"
                : "text-gray-600 hover:text-gray-900"}
            `}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}