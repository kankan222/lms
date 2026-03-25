import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button-variants";

function extractButtonText(children) {
  if (typeof children === "string" || typeof children === "number") {
    return String(children);
  }

  if (Array.isArray(children)) {
    return children.map(extractButtonText).join(" ");
  }

  if (children && typeof children === "object" && "props" in children) {
    return extractButtonText(children.props?.children);
  }

  return "";
}

function resolveSemanticVariant({ variant, type, children }) {
  if (variant !== "default") {
    return variant;
  }

  if (type === "submit") {
    return "success";
  }

  const label = extractButtonText(children).trim().toLowerCase();

  if (/^(save|update|submit|approve|assign|send)\b/.test(label)) {
    return "success";
  }

  return variant;
}

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}) {
  const Comp = asChild ? Slot.Root : "button"
  const resolvedVariant = resolveSemanticVariant({
    variant,
    type: props.type,
    children: props.children,
  });

  return (
    <Comp
      data-slot="button"
      data-variant={resolvedVariant}
      data-size={size}
      className={cn(buttonVariants({ variant: resolvedVariant, size, className }))}
      {...props} />
  );
}

export { Button }
