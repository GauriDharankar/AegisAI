const istDateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Kolkata",
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h12",
});

function parseTimestamp(value: string | Date): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const hasExplicitTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(trimmed);
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    ? `${trimmed}T00:00:00Z`
    : trimmed.includes(" ") && !trimmed.includes("T")
      ? trimmed.replace(" ", "T")
      : trimmed;
  const date = new Date(hasExplicitTimezone ? normalized : `${normalized}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatIstTimestamp(
  value: string | Date | null | undefined,
  fallback = "Not available",
): string {
  if (value == null) {
    return fallback;
  }

  const date = parseTimestamp(value);
  if (!date) {
    return fallback;
  }

  const parts = istDateTimeFormatter.formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";

  return `${part("day")} ${part("month")} ${part("year")}, ${part("hour")}:${part("minute")}:${part("second")} ${part("dayPeriod").toUpperCase()} IST`;
}
