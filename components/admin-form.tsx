"use client";
import { useActionState, useId } from "react";
import Link from "next/link";
import type { AdminState } from "@/lib/admin-validation";
export function AdminForm({
  action,
  children,
  label = "Save changes",
  confirm,
  preserveValues = false,
  className = "admin-form",
}: {
  action: (state: AdminState, form: FormData) => Promise<AdminState>;
  children: React.ReactNode;
  label?: string;
  confirm?: string;
  preserveValues?: boolean;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(action, { message: "" });
  const id = useId();
  return (
    <form
      action={formAction}
      className={className}
      aria-describedby={state.message ? id : undefined}
      onReset={(e) => {
        // React actions reset native form controls after success. Hours editors
        // must retain the selected weekday/stylist for subsequent edits.
        if (preserveValues) e.preventDefault();
      }}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {children}
      {state.message && (
        <div
          id={id}
          role={state.saved ? "status" : "alert"}
          className={state.saved ? "notice" : "error"}
        >
          <p>{state.message}</p>
          {state.errors && (
            <ul>
              {Object.entries(state.errors).map(([field, messages]) => (
                <li key={field}>
                  {field.replaceAll("_", " ")}: {messages.join(" ")}
                </li>
              ))}
            </ul>
          )}
          {state.href && <Link href={state.href}>Open saved record →</Link>}
        </div>
      )}
      <button disabled={pending}>{pending ? "Saving…" : label}</button>
    </form>
  );
}
export function Field({
  name,
  label,
  value = "",
  type = "text",
  required = false,
  min,
  max,
}: {
  name: string;
  label: string;
  value?: string | number | null;
  type?: string;
  required?: boolean;
  min?: number;
  max?: number;
}) {
  return (
    <label>
      {label}
      <input
        name={name}
        defaultValue={value ?? ""}
        type={type}
        required={required}
        min={min}
        max={max}
      />
    </label>
  );
}
export function Notes({
  name = "notes",
  value = "",
  label = "Private notes",
  max = 2000,
}: {
  name?: string;
  value?: string;
  label?: string;
  max?: number;
}) {
  return (
    <label>
      {label}
      <textarea name={name} defaultValue={value} maxLength={max} />
    </label>
  );
}
export function Identity({ id, revision }: { id: string; revision?: number }) {
  return (
    <>
      <input type="hidden" name="id" value={id} />
      {revision !== undefined && (
        <input type="hidden" name="revision" value={revision} />
      )}
    </>
  );
}
