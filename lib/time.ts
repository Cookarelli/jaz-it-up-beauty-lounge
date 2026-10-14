import { localToISO, shiftDay } from "./admin-time";
export function salonDayBounds(date: string, timezone = "America/Chicago") {
  return {
    start: localToISO(date + "T00:00", timezone),
    end: localToISO(shiftDay(date, 1) + "T00:00", timezone),
  };
}
