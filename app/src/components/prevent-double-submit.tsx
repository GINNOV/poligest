"use client";

import { useEffect } from "react";

export function PreventDoubleSubmit() {
  useEffect(() => {
    const handleSubmit = (event: Event) => {
      const submitEvent = event as SubmitEvent;
      const form = submitEvent.target as HTMLFormElement | null;
      if (!form) return;

      const submitter =
        (submitEvent as unknown as { submitter?: HTMLElement }).submitter ??
        (form.querySelector("button[type=submit], input[type=submit]") as HTMLElement | null);

      if (!submitter) return;
      if (submitter.dataset.submitting === "true") {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      submitter.dataset.submitting = "true";
      submitter.setAttribute("aria-busy", "true");

      if ("disabled" in submitter) {
        (submitter as HTMLButtonElement | HTMLInputElement).disabled = true;
      }
      submitter.classList.add("pointer-events-none", "opacity-70");

      const reset = () => {
        submitter.dataset.submitting = "false";
        submitter.removeAttribute("aria-busy");
        if ("disabled" in submitter) {
          (submitter as HTMLButtonElement | HTMLInputElement).disabled = false;
        }
        submitter.classList.remove("pointer-events-none", "opacity-70");
      };

      // In case the page does not navigate (validation error), re-enable after a short delay.
      const timer = window.setTimeout(reset, 4000);
      form.addEventListener(
        "reset",
        () => {
          window.clearTimeout(timer);
          reset();
        },
        { once: true }
      );
    };

    document.addEventListener("submit", handleSubmit, true);
    return () => document.removeEventListener("submit", handleSubmit, true);
  }, []);

  return null;
}
