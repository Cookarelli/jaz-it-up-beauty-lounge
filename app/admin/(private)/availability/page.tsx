import { redirect } from "next/navigation";
import { adminClient } from "@/lib/supabase";
import { addAvailability, removeAvailability } from "../actions";
export default async function Availability() {
  const db = await adminClient();
  if (!db) redirect("/admin/login");
  const [s, a] = await Promise.all([
    db!.from("stylists").select("id,name").eq("active", true),
    db!
      .from("availability")
      .select("*,stylists(name)")
      .gte("ends_at", new Date().toISOString())
      .order("starts_at")
      .limit(100),
  ]);
  if (s.error || a.error) throw Error("Availability unavailable");
  return (
    <>
      <h2>Publish bookable hours</h2>
      <p>
        Enter ISO timestamps with the correct salon timezone offset, for example
        2026-11-10T09:00:00-06:00. Services are offered every 30 minutes within
        these hours.
      </p>
      <form action={addAvailability}>
        <label>
          Stylist
          <select name="stylist_id" required>
            {s.data?.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Starts at
          <input
            required
            name="starts_at"
            placeholder="2026-11-10T09:00:00-06:00"
          />
        </label>
        <label>
          Ends at
          <input
            required
            name="ends_at"
            placeholder="2026-11-10T17:00:00-06:00"
          />
        </label>
        <button>Publish hours</button>
      </form>
      <h2>Upcoming hours</h2>
      {a.data?.map((x) => (
        <article className="card" key={x.id}>
          <p>
            {x.stylists?.name}: {x.starts_at} — {x.ends_at}
          </p>
          <form action={removeAvailability}>
            <input type="hidden" name="id" value={x.id} />
            <button>Remove bookable hours</button>
          </form>
        </article>
      ))}
    </>
  );
}
