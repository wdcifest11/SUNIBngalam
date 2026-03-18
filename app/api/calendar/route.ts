export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeFileName(value: string | null) {
  const raw = (value || "").trim();
  if (!raw) return "studium.ics";
  const cleaned = raw.replace(/[^a-zA-Z0-9._-]/g, "_");
  return cleaned.toLowerCase().endsWith(".ics") ? cleaned : `${cleaned}.ics`;
}

export async function POST(req: Request) {
  let fileName = "studium.ics";
  let icsText = "";

  const contentType = req.headers.get("content-type") || "";
  try {
    if (contentType.includes("application/json")) {
      const data = (await req.json()) as any;
      fileName = safeFileName(typeof data?.fileName === "string" ? data.fileName : null);
      const b64 = typeof data?.icsBase64 === "string" ? data.icsBase64 : "";
      icsText = b64 ? Buffer.from(b64, "base64").toString("utf8") : "";
    } else {
      const form = await req.formData();
      fileName = safeFileName(typeof form.get("fileName") === "string" ? (form.get("fileName") as string) : null);
      const b64 = typeof form.get("icsBase64") === "string" ? (form.get("icsBase64") as string) : "";
      icsText = b64 ? Buffer.from(b64, "base64").toString("utf8") : "";
    }
  } catch {
    // ignore; handled below
  }

  if (!icsText) {
    return new Response("missing_ics", { status: 400, headers: { "content-type": "text/plain; charset=utf-8" } });
  }

  return new Response(icsText, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `inline; filename="${fileName}"`,
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
