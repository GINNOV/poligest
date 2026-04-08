"use client";

import { useEffect } from "react";

export function AutoPrintOnLoad() {
  useEffect(() => {
    const handle = window.setTimeout(() => {
      window.print();
    }, 150);

    return () => window.clearTimeout(handle);
  }, []);

  return null;
}
