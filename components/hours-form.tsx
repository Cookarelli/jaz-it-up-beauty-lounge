"use client";
import { useState } from "react";
import { AdminForm, Field } from "./admin-form";
import { weekdays } from "@/lib/admin-time";
import type { AdminState } from "@/lib/admin-validation";
export function HoursForm({
  kind,
  hours,
  staff = [],
  action,
}: {
  kind: "working" | "business";
  hours: {
    weekday: number;
    opens_at: string;
    closes_at: string;
    stylist_id?: string;
  }[];
  staff?: { id: string; name: string }[];
  action: (state: AdminState, form: FormData) => Promise<AdminState>;
}) {
  const [day, setDay] = useState(2);
  const [stylist, setStylist] = useState(staff[0]?.id || "");
  const current = hours.find(
    (h) =>
      h.weekday === day && (kind === "business" || h.stylist_id === stylist),
  );
  return (
    <AdminForm
      action={action}
      label={kind === "working" ? "Save working day" : "Save business day"}
      confirm="Update this recurring day? Existing appointments keep their times. Review the calendar before shortening hours."
    >
      <input type="hidden" name="kind" value={kind} />
      {kind === "working" && (
        <label>
          Stylist
          <select
            name="stylist_id"
            value={stylist}
            onChange={(e) => setStylist(e.target.value)}
            required
          >
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <label>
        Day of week
        <select
          name="weekday"
          value={day}
          onChange={(e) => setDay(Number(e.target.value))}
        >
          {weekdays.map((d, i) => (
            <option key={d} value={i}>
              {d}
            </option>
          ))}
        </select>
      </label>
      <p className="booking-help">
        {current
          ? "Current hours are filled in below. Adjust them and save."
          : "No hours are set for this day. Enter opening and closing times to add it."}
      </p>
      <div
        className="hours-inputs"
        key={`${stylist}:${day}:${current?.opens_at}:${current?.closes_at}`}
      >
        <Field
          name="opens_at"
          label={kind === "working" ? "Starts" : "Opens"}
          type="time"
          required
          value={current?.opens_at.slice(0, 5)}
        />
        <Field
          name="closes_at"
          label={kind === "working" ? "Ends" : "Closes"}
          type="time"
          required
          value={current?.closes_at.slice(0, 5)}
        />
      </div>
    </AdminForm>
  );
}
