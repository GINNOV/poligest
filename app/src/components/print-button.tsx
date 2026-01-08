"use client";

type Props = {
  label?: string;
  className?: string;
};

export function PrintButton({ label = "Stampa", className }: Props) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={className}
    >
      {label}
    </button>
  );
}
