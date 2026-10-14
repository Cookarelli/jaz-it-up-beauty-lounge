"use client";
import { useActionState } from "react";
import type { Service } from "@/lib/service-types";
import { formatPrice, formatDuration, bookable } from "@/lib/service-types";
import type { ServiceFormState } from "@/lib/validation";
import { saveService } from "@/app/admin/(private)/actions";
export function ServiceFields({
  service,
  kind = "service",
}: {
  service: Service;
  kind?: "service" | "variant";
}) {
  const [state, action, pending] = useActionState<ServiceFormState, FormData>(
    saveService,
    { message: "" },
  );
  const field = (
    name: string,
    label: string,
    type = "text",
    min?: number,
    max?: number,
  ) => (
    <label key={name}>
      {label}
      <input
        name={name}
        type={type}
        min={min}
        max={max}
        defaultValue={String(service[name as keyof Service] ?? "")}
        aria-invalid={!!state.errors?.[name]}
        aria-describedby={
          state.errors?.[name] ? `${service.id}-${name}` : undefined
        }
      />
      {state.errors?.[name] && (
        <span className="error" id={`${service.id}-${name}`}>
          {state.errors[name].join(" ")}
        </span>
      )}
    </label>
  );
  return (
    <form
      action={action}
      onSubmit={(e) => {
        const data = new FormData(e.currentTarget);
        if (
          (data.get("status") === "archived" || !data.get("active")) &&
          !window.confirm(
            "Hide this service from booking? Existing appointments will remain.",
          )
        )
          e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={service.id} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="revision" value={service.revision} />
      <p>
        {formatPrice(service)} · {formatDuration(service)}
        <br />
        {bookable(service)
          ? "Approved for instant booking"
          : "Owner review / variant selection required"}
      </p>
      {service.includes_cut_style && (
        <p className="notice">
          Chemical bundle: haircut and style included. No separate charge.
        </p>
      )}
      {field("name", "Name")}
      {kind === "service" && field("category", "Category")}
      <label>
        <span>
          <input
            type="checkbox"
            name="active"
            defaultChecked={service.active}
          />{" "}
          Available in catalog / booking
        </span>
      </label>
      {field("description", "Public description")}
      <label>
        Pricing
        <select name="pricing_type" defaultValue={service.pricing_type}>
          <option value="exact">Exact</option>
          <option value="starting">Starting at</option>
          <option value="range">Board range (not instantly bookable)</option>
          <option value="consultation">Salon consultation</option>
        </select>
      </label>
      {field(
        "price_cents",
        "Price / range minimum (cents)",
        "number",
        0,
        1000000,
      )}
      {field(
        "price_max_cents",
        "Range maximum (cents; blank otherwise)",
        "number",
        0,
        1000000,
      )}
      {field(
        "duration_minutes",
        "Exact duration (minutes; blank if TBD)",
        "number",
        1,
        480,
      )}
      {field(
        "duration_min_minutes",
        "Estimated minimum duration (optional)",
        "number",
        1,
        480,
      )}
      {field(
        "duration_max_minutes",
        "Estimated maximum duration (optional)",
        "number",
        1,
        480,
      )}
      <label>
        <span>
          <input
            type="checkbox"
            name="price_approved"
            defaultChecked={service.price_approved}
          />{" "}
          Owner approved this price
        </span>
      </label>
      <label>
        <span>
          <input
            type="checkbox"
            name="duration_approved"
            defaultChecked={service.duration_approved}
          />{" "}
          Owner approved the exact duration
        </span>
      </label>
      <label>
        Status
        <select name="status" defaultValue={service.status}>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
        </select>
      </label>
      <label>
        Length qualification
        <select
          name="length_qualification"
          defaultValue={service.length_qualification}
        >
          {[
            "any",
            "above_shoulder",
            "shoulder",
            "below_shoulder",
            "up_to_shoulder",
          ].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
      </label>
      {field("display_order", "Display order", "number", 0, 10000)}
      {field(
        "preparation_minutes",
        "Preparation buffer (minutes)",
        "number",
        0,
        120,
      )}
      {field("cleanup_minutes", "Cleanup buffer (minutes)", "number", 0, 120)}
      <label>
        Private admin notes
        <textarea
          name="admin_notes"
          maxLength={2000}
          defaultValue={service.admin_notes || ""}
        />
      </label>
      {state.message && (
        <p role="status" className={state.saved ? "" : "error"}>
          {state.message}
        </p>
      )}
      <button disabled={pending}>{pending ? "Saving…" : "Save changes"}</button>
    </form>
  );
}
