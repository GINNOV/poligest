"use client";

import { forwardRef } from "react";

type PhoneInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type" | "inputMode" | "pattern"
>;

export const PhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ onInput, ...props }, ref) => {
    return (
      <input
        {...props}
        ref={ref}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        onInput={(event) => {
          const target = event.currentTarget;
          target.value = target.value.replace(/\D/g, "");
          onInput?.(event);
        }}
      />
    );
  }
);

PhoneInput.displayName = "PhoneInput";
