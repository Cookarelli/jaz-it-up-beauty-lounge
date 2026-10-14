"use client";
import { useState } from "react";
import type { Service } from "@/lib/service-types";
import { AdminForm, Field, Notes } from "./admin-form";
import { createAppointment } from "@/app/admin/(private)/management-actions";
export function ManualBooking({
  services,
  customers,
  stylists,
  requestId,
  timezone,
  customerId,
}: {
  services: Service[];
  customers: { id: string; name: string; phone: string }[];
  stylists: { id: string; name: string }[];
  requestId: string;
  timezone: string;
  customerId: string;
}) {
  const choices = services.flatMap((s) =>
    s.variants?.filter((v) => v.active && v.status !== "archived").length
      ? s.variants
          .filter((v) => v.active && v.status !== "archived")
          .map((v) => ({
            ...v,
            label: `${s.name} — ${v.name}`,
            parent: s.id,
            variant: v.id,
          }))
      : [{ ...s, label: s.name, parent: s.id, variant: "" }],
  );
  const [selected, setSelected] = useState(choices[0]?.id || "");
  const item = choices.find((s) => s.id === selected);
  return (
    <AdminForm
      action={createAppointment}
      label="Confirm manual booking"
      confirm="Add this appointment with the entered duration and price estimate? Manual bookings may be outside recurring working hours; time off and appointment conflicts are still enforced."
    >
      <input type="hidden" name="request_id" value={requestId} />
      <input type="hidden" name="service_id" value={item?.parent || ""} />
      <input type="hidden" name="variant_id" value={item?.variant || ""} />
      <label>
        Customer
        <select name="customer_id" defaultValue={customerId} required>
          <option value="">Select a customer</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.phone ? ` · ${c.phone}` : ""}
            </option>
          ))}
        </select>
      </label>
      <label>
        Booking source
        <select name="source">
          <option value="phone">Phone booking</option>
          <option value="walk_in">Walk-in</option>
        </select>
      </label>
      <label>
        Service / variant
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          required
        >
          {choices.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
      {item?.includes_cut_style && (
        <p className="notice">
          Haircut and style are included. Enter one combined estimate.
        </p>
      )}
      <label>
        Stylist
        <select name="stylist_id" required>
          {stylists.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      <Field
        name="starts_at"
        label={`Start (${timezone})`}
        type="datetime-local"
        required
      />
      <div key={selected} className="form-grid">
        <Field
          name="duration_minutes"
          label="Confirmed duration in minutes"
          type="number"
          value={item?.duration_minutes}
          min={1}
          max={480}
          required
        />
        <Field
          name="price_cents"
          label="Confirmed estimate in cents"
          type="number"
          value={
            item?.price_approved && item.pricing_type !== "range"
              ? item?.price_cents
              : null
          }
          min={0}
          max={1000000}
          required
        />
      </div>
      <p>
        Enter the duration and price agreed with the customer. These values
        apply only to this appointment; they do not approve the public service
        menu.
      </p>
      <Notes />
    </AdminForm>
  );
}
