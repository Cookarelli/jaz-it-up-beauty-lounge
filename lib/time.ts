export function salonDayBounds(date: string) {
  function midnight(day: string) {
    const utc = new Date(`${day}T00:00:00Z`);
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Chicago",
      timeZoneName: "longOffset",
    }).formatToParts(utc);
    const offset = parts
      .find((p) => p.type === "timeZoneName")!
      .value.replace("GMT", "");
    return new Date(`${day}T00:00:00${offset}`).toISOString();
  }
  const next = new Date(`${date}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return {
    start: midnight(date),
    end: midnight(next.toISOString().slice(0, 10)),
  };
}
