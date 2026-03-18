export type IslandNotificationKind = "info" | "success" | "warning" | "danger";

export type IslandNotificationInput = {
  title: string;
  message?: string;
  kind?: IslandNotificationKind;
  iconClass?: string;
  href?: string;
  durationMs?: number;
};

export function notifyIsland(input: IslandNotificationInput) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("studium:notify", { detail: input }));
}

