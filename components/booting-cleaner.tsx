"use client";

import { useEffect } from "react";

export default function BootingCleaner() {
  useEffect(() => {
    // Only clear the "booting" classes for non-shell routes.
    // The shell experience uses its own boot sequence and removes the class when ready.
    if (document.querySelector(".shellRoot")) return;
    document.body.classList.remove("booting");
    document.documentElement.classList.remove("booting");
  }, []);

  return null;
}

