import { redirect } from "next/navigation";
import { adminClient } from "@/lib/supabase";
import { saveService } from "../actions";
import { ServiceFields } from "@/components/service-fields";
export default async function Services() {
  const db = await adminClient();
  if (!db) redirect("/admin/login");
  const { data, error } = await db!.from("services").select("*").order("name");
  if (error) throw Error("Catalog unavailable");
  return (
    <>
      <h2>Service catalog</h2>
      <div className="cards">
        {data?.map((s) => (
          <article key={s.id} className="card">
            <h3>{s.name}</h3>
            <form action={saveService}>
              <ServiceFields service={s} />
            </form>
          </article>
        ))}
        <article className="card">
          <h3>Add a service</h3>
          <form action={saveService}>
            <ServiceFields />
          </form>
        </article>
      </div>
    </>
  );
}
