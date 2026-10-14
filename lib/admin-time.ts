export function localDate(
  instant: Date | string = new Date(),
  timezone = "America/Chicago",
) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(instant));
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
export function localInput(instant: string, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(instant));
  return `${localDate(instant, timezone)}T${parts.find((p) => p.type === "hour")!.value}:${parts.find((p) => p.type === "minute")!.value}`;
}
export function validDate(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}
export function shiftDay(date: string, days: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export function localToISO(value: string, timezone: string) {
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) ||
    !validDate(value.slice(0, 10))
  )
    throw Error("Choose a valid local date and time.");
  const naive = Date.parse(`${value}:00Z`);
  if (!Number.isFinite(naive)) throw Error("Choose a valid time.");
  const offsets = new Set<number>();
  for (const delta of [-86400000, 0, 86400000]) {
    const sample = new Date(naive + delta);
    const rendered = localInput(sample.toISOString(), timezone);
    offsets.add(Date.parse(`${rendered}:00Z`) - sample.getTime());
  }
  const matches = [...offsets]
    .map((offset) => new Date(naive - offset).toISOString())
    .filter((instant) => localInput(instant, timezone) === value);
  if (matches.length !== 1)
    throw Error(
      "This time is skipped or repeated by daylight saving. Choose another time.",
    );
  return matches[0];
}
export function calendarRange(date: string, view: string) {
  if (!validDate(date)) throw Error("Invalid date");
  let start = date,
    end = shiftDay(date, 1);
  if (view === "week") {
    start = shiftDay(date, -new Date(`${date}T12:00Z`).getUTCDay());
    end = shiftDay(start, 7);
  }
  if (view === "month") {
    start = date.slice(0, 7) + "-01";
    const next = new Date(`${start}T12:00Z`);
    next.setUTCMonth(next.getUTCMonth() + 1);
    end = next.toISOString().slice(0, 10);
  }
  const days: string[] = [];
  for (let d = start; d < end; d = shiftDay(d, 1)) days.push(d);
  return { start, end, days };
}
export function displayTime(value: string, timezone: string, withDate = false) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    ...(withDate
      ? ({ month: "short", day: "numeric", year: "numeric" } as const)
      : {}),
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
export const money = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    cents / 100,
  );
export const weekdays = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
