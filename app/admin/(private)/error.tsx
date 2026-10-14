"use client";
export default function AdminError({ reset }: { reset: () => void }) {
  return (
    <div role="alert" className="notice">
      <h2>This view is unavailable</h2>
      <p>
        Your changes may not have saved. Reload the view and check the record
        before trying again.
      </p>
      <button onClick={reset}>Try again</button>
    </div>
  );
}
