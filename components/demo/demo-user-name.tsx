"use client";

import { useEffect, useState } from "react";

type Props = {
  className?: string;
  fallback?: string;
};

function safeJsonParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export default function DemoUserName({ className, fallback = "Demo User" }: Props) {
  const [name, setName] = useState(fallback);

  useEffect(() => {
    try {
      const parsed = safeJsonParse<any>(localStorage.getItem("studium:demo:profile:v1"));
      const fromProfile = String(parsed?.fullName || "").trim();
      if (fromProfile) setName(fromProfile);
    } catch {
      // ignore
    }
  }, []);

  return (
    <span className={className} suppressHydrationWarning>
      {name}
    </span>
  );
}

