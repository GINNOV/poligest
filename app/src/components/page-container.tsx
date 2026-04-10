import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  width?: "standard" | "wide";
};

export function PageContainer({ children, className = "", width = "standard" }: Props) {
  const maxWidthClass = width === "wide" ? "max-w-screen-2xl" : "max-w-6xl";
  
  return (
    <div className={`mx-auto ${maxWidthClass} px-6 py-8 ${className}`}>
      {children}
    </div>
  );
}
