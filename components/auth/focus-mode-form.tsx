"use client";

import { type FormHTMLAttributes } from "react";

type FocusModeFormProps = Omit<FormHTMLAttributes<HTMLFormElement>, "action"> & {
  action: (formData: FormData) => void | Promise<void>;
};

function requestFullscreenPref() {
  try {
    localStorage.setItem("studium:pref_fullscreen", "1");
  } catch {
    // ignore
  }

  try {
    const el = document.documentElement as any;
    const fn = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
    if (!document.fullscreenElement && typeof fn === "function") {
      const p = fn.call(el);
      if (p && typeof p.catch === "function") p.catch(() => {});
    }
  } catch {
    // ignore
  }
}

export default function FocusModeForm({ action, onSubmit, ...props }: FocusModeFormProps) {
  return (
    <form
      {...props}
      action={action}
      onSubmit={(e) => {
        requestFullscreenPref();
        onSubmit?.(e);
      }}
    />
  );
}

