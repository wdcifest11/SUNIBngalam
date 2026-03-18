import { viewMeta } from "@/lib/app-data";

type ViewMarkerProps = {
  view: string;
  label?: string;
  desc?: string;
};

export default function ViewMarker({ view, label, desc }: ViewMarkerProps) {
  const meta = viewMeta(view);
  const resolvedLabel = (label ?? meta?.label ?? "").trim();
  const resolvedDesc = (desc ?? meta?.desc ?? "").trim();
  return (
    <div
      data-view-marker="1"
      data-view={view}
      data-label={resolvedLabel}
      data-desc={resolvedDesc}
      hidden
      aria-hidden="true"
    />
  );
}

